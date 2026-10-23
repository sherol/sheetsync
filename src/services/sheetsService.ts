import { CategoryDef, Entry } from '../types';
import { CHANGED_KEY, LAYOUT_KEY, readChangedFlag, valueToCell } from './syncLogic';

/** Thrown when Google rejects the access token (401), so the app can ask to reconnect. */
export class SheetsAuthError extends Error {}

async function failure(res: Response, prefix: string): Promise<Error> {
  const text = await res.text();
  if (res.status === 401) return new SheetsAuthError(`Google sign-in expired. Reconnect to sync. (${prefix})`);
  return new Error(`${prefix}: ${text}`);
}

export interface SheetHeaderConfig {
  sheetName: string;
  headers: string[];
}

const ENTRY_META_HEADERS = ['ID', 'Saved At'];

export const SYSTEM_TABS: SheetHeaderConfig[] = [
  {
    sheetName: 'Monthly_Reports',
    headers: ['Month', 'Entries Logged', 'Avg Mood (1-10)', 'Entries by Category', 'Summary'],
  },
  {
    sheetName: 'App_Config',
    headers: ['Key', 'JSON Value', 'Last Updated'],
  },
];

export function categoryHeaders(category: CategoryDef): string[] {
  return [...ENTRY_META_HEADERS, ...category.fields.map((f) => f.label)];
}

export function tabsForCategories(categories: CategoryDef[]): SheetHeaderConfig[] {
  return [
    ...categories.map((c) => ({ sheetName: c.sheetName, headers: categoryHeaders(c) })),
    ...SYSTEM_TABS,
  ];
}

export function entryToRow(category: CategoryDef, entry: Entry): (string | number)[] {
  return [
    valueToCell(null, entry.id),
    valueToCell(null, entry.timestamp),
    ...category.fields.map((f) => valueToCell(f, entry.values[f.id])),
  ];
}

/** Spreadsheet column letter for a 1-based column index (1 -> A, 27 -> AA). */
function columnLetter(index: number): string {
  let s = '';
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function quoteTab(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function rowRange(sheetName: string, row: number, width: number): string {
  return `${quoteTab(sheetName)}!A${row}:${columnLetter(width)}${row}`;
}

export class SheetsService {
  /**
   * List Google Sheets from user's Google Drive
   */
  static async listUserSpreadsheets(accessToken: string): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    const url = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,modifiedTime)&pageSize=20&orderBy=modifiedTime desc`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw await failure(res, `Failed to list spreadsheets`);
    const data = await res.json();
    return data.files || [];
  }

  /**
   * Verify and fetch spreadsheet info
   */
  static async getSpreadsheet(accessToken: string, spreadsheetId: string) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw await failure(res, 'Failed to load spreadsheet details');
    return await res.json();
  }

  private static async writeHeaders(accessToken: string, spreadsheetId: string, tabs: SheetHeaderConfig[]): Promise<void> {
    if (tabs.length === 0) return;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: tabs.map((tab) => ({
          range: rowRange(tab.sheetName, 1, tab.headers.length),
          values: [tab.headers],
        })),
      }),
    });
    if (!res.ok) throw await failure(res, `Could not write header rows`);
  }

  /**
   * Clear a spreadsheet and rebuild it with one empty tab per category (plus the system tabs),
   * keeping the same file and ID. Every existing tab is deleted.
   */
  static async rebuildSpreadsheet(accessToken: string, spreadsheetId: string, categories: CategoryDef[]): Promise<void> {
    const batch = async (requests: unknown[]) => {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });
      if (!res.ok) throw await failure(res, 'Could not reset the spreadsheet');
      return res.json();
    };

    const info = await this.getSpreadsheet(accessToken, spreadsheetId);
    const oldIds: number[] = (info.sheets || []).map((s: any) => s.properties.sheetId);
    const placeholder = `_reset_${Date.now()}`;

    // A spreadsheet must always have one tab, so add a placeholder before deleting the rest.
    const first = await batch([
      { addSheet: { properties: { title: placeholder } } },
      ...oldIds.map((sheetId) => ({ deleteSheet: { sheetId } })),
    ]);
    const placeholderId = first.replies?.[0]?.addSheet?.properties?.sheetId;

    const tabs = tabsForCategories(categories);
    await batch([
      ...tabs.map((tab) => ({ addSheet: { properties: { title: tab.sheetName, gridProperties: { frozenRowCount: 1 } } } })),
      { deleteSheet: { sheetId: placeholderId } },
    ]);
    await this.writeHeaders(accessToken, spreadsheetId, tabs);
  }

  /**
   * Find the Drive folder SheetSync keeps backups in ("backup" in My Drive), creating it if needed.
   * With the drive.file permission this only sees folders SheetSync created itself.
   */
  static async findBackupFolder(accessToken: string, name = 'backup'): Promise<string | null> {
    const q = encodeURIComponent(
      `name='${name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
    );
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) throw await failure(listRes, 'Could not look for the backup folder');
    return (await listRes.json()).files?.[0]?.id ?? null;
  }

  static async findOrCreateBackupFolder(accessToken: string, name = 'backup'): Promise<string> {
    const found = await this.findBackupFolder(accessToken, name);
    if (found) return found;

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
    });
    if (!createRes.ok) throw await failure(createRes, 'Could not create the backup folder');
    return (await createRes.json()).id;
  }

  /**
   * Copy a spreadsheet into the backup folder. The original is left where it is.
   */
  static async backupSpreadsheet(
    accessToken: string,
    spreadsheetId: string,
    copyName: string
  ): Promise<{ id: string; name: string; folderId: string }> {
    const folderId = await this.findOrCreateBackupFolder(accessToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/copy?fields=id,name`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: copyName, parents: [folderId] }),
    });
    if (res.status === 404) {
      throw new Error(
        'SheetSync is not allowed to copy this spreadsheet. Reconnect it with "Choose from Drive" (or make a copy in Google Drive yourself), then try again.'
      );
    }
    if (!res.ok) throw await failure(res, 'Could not back up the spreadsheet');
    const copy = await res.json();
    return { id: copy.id, name: copy.name, folderId };
  }

  /**
   * Create a new SheetSync spreadsheet with one tab per category
   */
  static async createMasterSpreadsheet(
    accessToken: string,
    categories: CategoryDef[],
    title = 'SheetSync - Personal Tracker'
  ): Promise<{ id: string; name: string }> {
    const tabs = tabsForCategories(categories);

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: tabs.map((tab) => ({
          properties: {
            title: tab.sheetName,
            gridProperties: { frozenRowCount: 1 },
          },
        })),
      }),
    });

    if (!createRes.ok) throw await failure(createRes, `Could not create Google Spreadsheet`);

    const created = await createRes.json();
    const spreadsheetId = created.spreadsheetId;
    await this.writeHeaders(accessToken, spreadsheetId, tabs);
    return { id: spreadsheetId, name: title };
  }

  /**
   * Ensure a tab exists for every category (and the system tabs) in an existing spreadsheet.
   * Tabs from older layouts are left untouched.
   */
  static async ensureTabsExist(accessToken: string, spreadsheetId: string, categories: CategoryDef[]): Promise<string[]> {
    const info = await this.getSpreadsheet(accessToken, spreadsheetId);
    const existingTitles: string[] = (info.sheets || []).map((s: any) => s.properties.title);

    const missingTabs = tabsForCategories(categories).filter((t) => !existingTitles.includes(t.sheetName));
    if (missingTabs.length === 0) return existingTitles;

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: missingTabs.map((tab) => ({
          addSheet: {
            properties: {
              title: tab.sheetName,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        })),
      }),
    });
    if (!res.ok) throw await failure(res, `Could not add tabs`);

    await this.writeHeaders(accessToken, spreadsheetId, missingTabs);
    return [...existingTitles, ...missingTabs.map((t) => t.sheetName)];
  }

  /**
   * Rename a tab in the spreadsheet. Returns false if no tab with the old name exists.
   */
  static async renameTab(accessToken: string, spreadsheetId: string, oldName: string, newName: string): Promise<boolean> {
    const info = await this.getSpreadsheet(accessToken, spreadsheetId);
    const sheets: any[] = info.sheets || [];
    if (sheets.some((s) => s.properties.title === newName)) {
      throw new Error(`A tab named "${newName}" already exists in the spreadsheet.`);
    }
    const sheet = sheets.find((s) => s.properties.title === oldName);
    if (!sheet) return false;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: sheet.properties.sheetId, title: newName },
              fields: 'title',
            },
          },
        ],
      }),
    });
    if (!res.ok) throw await failure(res, `Could not rename tab`);
    return true;
  }

  /**
   * Append a row to a sheet tab
   */
  static async appendRow(accessToken: string, spreadsheetId: string, sheetName: string, rowValues: any[]): Promise<any> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quoteTab(sheetName)}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    });

    if (!res.ok) throw await failure(res, `Append failed on ${sheetName}`);
    return await res.json();
  }

  /**
   * Read whole tabs as displayed in the sheet, in one request. Missing tabs are skipped.
   * Returns rows (header row first) keyed by tab name.
   */
  static async readTabs(accessToken: string, spreadsheetId: string, tabNames: string[]): Promise<Record<string, string[][]>> {
    const info = await this.getSpreadsheet(accessToken, spreadsheetId);
    const existing = new Set<string>((info.sheets || []).map((s: any) => s.properties.title));
    const wanted = tabNames.filter((t) => existing.has(t));
    if (wanted.length === 0) return {};

    const params = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS' });
    wanted.forEach((t) => params.append('ranges', quoteTab(t)));
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw await failure(res, 'Could not read the spreadsheet');
    const data = await res.json();
    const out: Record<string, string[][]> = {};
    (data.valueRanges || []).forEach((vr: any, i: number) => {
      out[wanted[i]] = (vr.values || []).map((row: any[]) => row.map((c) => String(c ?? '')));
    });
    return out;
  }

  /**
   * Read one page of a tab, newest rows first: new entries are appended at the bottom, so a page is
   * the pageSize rows just above `before` (a row number), or the last rows of the tab when `before`
   * is null. Returns the header row followed by the page, and the `before` for the next (older)
   * page, or null when the page reaches the top. A missing tab reads as empty.
   */
  static async readPage(
    accessToken: string,
    spreadsheetId: string,
    sheetName: string,
    before: number | null,
    pageSize: number
  ): Promise<{ rows: string[][]; next: number | null }> {
    const batchGet = async (ranges: string[]): Promise<string[][][] | null> => {
      const params = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS' });
      ranges.forEach((r) => params.append('ranges', r));
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 400) return null; // no such tab
      if (!res.ok) throw await failure(res, `Could not read ${sheetName}`);
      const data = await res.json();
      return (data.valueRanges || []).map((vr: any) => (vr.values || []).map((row: any[]) => row.map((c) => String(c ?? ''))));
    };
    const tab = quoteTab(sheetName);

    let end = before === null ? 0 : before - 1;
    if (before === null) {
      // The ID column tells where the last row is (Sheets leaves trailing empty rows out).
      const ids = await batchGet([`${tab}!A:A`]);
      if (!ids) return { rows: [], next: null };
      end = ids[0].length;
    }
    if (end < 2) return { rows: [], next: null };
    const start = Math.max(2, end - pageSize + 1);
    const got = await batchGet([`${tab}!1:1`, `${tab}!${start}:${end}`]);
    if (!got) return { rows: [], next: null };
    const [header = [], page = []] = got;
    return { rows: [header[0] ?? [], ...page], next: start > 2 ? start : null };
  }

  /**
   * Write entries to their category tab: rows with the same ID are overwritten, the rest are
   * appended. The header row is refreshed so newly added fields get a column.
   */
  static async pushEntries(accessToken: string, spreadsheetId: string, category: CategoryDef, entries: Entry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.ensureTabsExist(accessToken, spreadsheetId, [category]);
    const headers = categoryHeaders(category);

    const idRange = encodeURIComponent(`${quoteTab(category.sheetName)}!A:A`);
    const idsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${idRange}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!idsRes.ok) throw await failure(idsRes, `Could not read ${category.sheetName}`);
    const ids: string[][] = (await idsRes.json()).values || [];
    const rowOf = new Map<string, number>();
    ids.forEach((r, i) => {
      if (i > 0 && r[0]) rowOf.set(r[0], i + 1);
    });

    const updates = [{ range: rowRange(category.sheetName, 1, headers.length), values: [headers] }];
    const appends: (string | number)[][] = [];
    for (const entry of entries) {
      const row = entryToRow(category, entry);
      const at = rowOf.get(entry.id);
      if (at) updates.push({ range: rowRange(category.sheetName, at, row.length), values: [row as any] });
      else appends.push(row);
    }

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates }),
    });
    if (!res.ok) throw await failure(res, `Update failed on ${category.sheetName}`);

    if (appends.length > 0) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quoteTab(category.sheetName)}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const appendRes = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: appends }),
      });
      if (!appendRes.ok) throw await failure(appendRes, `Append failed on ${category.sheetName}`);
    }
  }

  /**
   * Set one key in the App_Config tab (overwriting its row, or adding one).
   */
  static async setConfigValue(accessToken: string, spreadsheetId: string, key: string, value: string, updatedAt: string): Promise<void> {
    await this.ensureTabsExist(accessToken, spreadsheetId, []);
    const range = encodeURIComponent(`${quoteTab('App_Config')}!A:A`);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw await failure(res, 'Could not read App_Config');
    const keys: string[][] = (await res.json()).values || [];
    let row = -1;
    keys.forEach((r, i) => {
      if (i > 0 && r[0] === key) row = i + 1;
    });
    const values = [key, `'${value}`, `'${updatedAt}`];
    if (row < 0) {
      await this.appendRow(accessToken, spreadsheetId, 'App_Config', values);
      return;
    }
    const put = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rowRange('App_Config', row, 3))}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [values] }),
      }
    );
    if (!put.ok) throw await failure(put, `Could not save ${key}`);
  }

  /**
   * Save the layout backup to App_Config.
   */
  static async saveLayout(accessToken: string, spreadsheetId: string, configJson: string, updatedAt: string): Promise<void> {
    await this.setConfigValue(accessToken, spreadsheetId, LAYOUT_KEY, configJson, updatedAt);
  }

  /**
   * Record whether SheetSync has changed the spreadsheet since its last backup / reset / restore.
   */
  static async setChangedSinceBackup(accessToken: string, spreadsheetId: string, changed: boolean): Promise<void> {
    await this.setConfigValue(accessToken, spreadsheetId, CHANGED_KEY, changed ? 'TRUE' : 'FALSE', new Date().toISOString());
  }

  /**
   * The changed-since-backup flag, or null if the spreadsheet has none (treated as changed).
   */
  static async getChangedSinceBackup(accessToken: string, spreadsheetId: string): Promise<boolean | null> {
    const tabs = await this.readTabs(accessToken, spreadsheetId, ['App_Config']);
    return readChangedFlag(tabs['App_Config'] ?? []);
  }

  /**
   * Spreadsheets in the backup folder, newest first (names start with a timestamp).
   */
  static async listBackups(accessToken: string): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    const folderId = await this.findBackupFolder(accessToken);
    if (!folderId) return [];
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=name desc&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw await failure(res, 'Could not list backups');
    return (await res.json()).files || [];
  }

  /**
   * Replace every tab of a spreadsheet with copies of a backup's tabs (values and formatting),
   * keeping the same file and ID.
   */
  static async restoreFromBackup(accessToken: string, spreadsheetId: string, backupId: string): Promise<void> {
    const batch = async (requests: unknown[]) => {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });
      if (!res.ok) throw await failure(res, 'Could not restore the backup');
      return res.json();
    };

    const backup = await this.getSpreadsheet(accessToken, backupId);
    const backupTabs: { sheetId: number; title: string }[] = (backup.sheets || []).map((s: any) => s.properties);
    if (backupTabs.length === 0) throw new Error('That backup has no tabs.');
    const current = await this.getSpreadsheet(accessToken, spreadsheetId);
    const oldIds: number[] = (current.sheets || []).map((s: any) => s.properties.sheetId);

    const first = await batch([
      { addSheet: { properties: { title: `_restore_${Date.now()}` } } },
      ...oldIds.map((sheetId) => ({ deleteSheet: { sheetId } })),
    ]);
    const placeholderId = first.replies?.[0]?.addSheet?.properties?.sheetId;

    const copied: { sheetId: number; title: string }[] = [];
    for (const tab of backupTabs) {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${backupId}/sheets/${tab.sheetId}:copyTo`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationSpreadsheetId: spreadsheetId }),
        }
      );
      if (!res.ok) throw await failure(res, `Could not copy the ${tab.title} tab from the backup`);
      copied.push({ sheetId: (await res.json()).sheetId, title: tab.title });
    }

    // copyTo names tabs "Copy of ..."; give them their original names and order.
    await batch([
      ...copied.map((c, index) => ({
        updateSheetProperties: { properties: { sheetId: c.sheetId, title: c.title, index }, fields: 'title,index' },
      })),
      { deleteSheet: { sheetId: placeholderId } },
    ]);
  }

  /**
   * Save a monthly summary report into the Monthly_Reports tab
   */
  static async appendMonthlyReport(accessToken: string, spreadsheetId: string, reportRow: (string | number)[]): Promise<any> {
    return await this.appendRow(accessToken, spreadsheetId, 'Monthly_Reports', reportRow);
  }
}

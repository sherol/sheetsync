import { CategoryDef, Entry } from '../types';

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
    entry.id,
    entry.timestamp,
    ...category.fields.map((f) => {
      const v = entry.values[f.id];
      if (v === undefined || v === null) return '';
      return typeof v === 'number' ? v : String(v);
    }),
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

function rowRange(sheetName: string, row: number, width: number): string {
  return `'${sheetName}'!A${row}:${columnLetter(width)}${row}`;
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
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list spreadsheets: ${err}`);
    }
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
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to load spreadsheet details: ${err}`);
    }
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
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Could not write header rows: ${err}`);
    }
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

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Could not create Google Spreadsheet: ${err}`);
    }

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
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Could not add tabs: ${err}`);
    }

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
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Could not rename tab: ${err}`);
    }
    return true;
  }

  /**
   * Append a row to a sheet tab
   */
  static async appendRow(accessToken: string, spreadsheetId: string, sheetName: string, rowValues: any[]): Promise<any> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${sheetName}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Append failed on ${sheetName}: ${err}`);
    }
    return await res.json();
  }

  /**
   * Write an entry to its category tab: overwrite the row with the same ID if
   * there is one, otherwise append a new row. The header row is refreshed so
   * newly added fields get a column.
   */
  static async upsertEntry(accessToken: string, spreadsheetId: string, category: CategoryDef, entry: Entry): Promise<void> {
    await this.ensureTabsExist(accessToken, spreadsheetId, [category]);
    const headers = categoryHeaders(category);
    await this.writeHeaders(accessToken, spreadsheetId, [{ sheetName: category.sheetName, headers }]);

    const idRange = encodeURIComponent(`'${category.sheetName}'!A:A`);
    const idsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${idRange}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!idsRes.ok) {
      const err = await idsRes.text();
      throw new Error(`Could not read ${category.sheetName}: ${err}`);
    }
    const ids: string[][] = (await idsRes.json()).values || [];
    const rowIndex = ids.findIndex((r, i) => i > 0 && r[0] === entry.id);
    const row = entryToRow(category, entry);

    if (rowIndex < 0) {
      await this.appendRow(accessToken, spreadsheetId, category.sheetName, row);
      return;
    }

    const range = encodeURIComponent(rowRange(category.sheetName, rowIndex + 1, row.length));
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Update failed on ${category.sheetName}: ${err}`);
    }
  }

  /**
   * Save app config schema to App_Config sheet
   */
  static async saveAppConfigToSheet(accessToken: string, spreadsheetId: string, configJson: string): Promise<void> {
    const now = new Date().toISOString();
    await this.appendRow(accessToken, spreadsheetId, 'App_Config', ['schema_config', configJson, now]);
  }

  /**
   * Save a monthly summary report into the Monthly_Reports tab
   */
  static async appendMonthlyReport(accessToken: string, spreadsheetId: string, reportRow: (string | number)[]): Promise<any> {
    return await this.appendRow(accessToken, spreadsheetId, 'Monthly_Reports', reportRow);
  }
}

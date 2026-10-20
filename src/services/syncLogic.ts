import { AppConfig, CategoryDef, CustomField, Entry } from '../types';
import { upgradeCategories } from './storageService';
import { withDefaultLists } from '../config/categories';

/**
 * Pure helpers for two-way sync between this device and the Google Sheet.
 *
 * An entry is "sent" when entry.syncedTo is the connected spreadsheet's ID. Pulling the sheet
 * merges its rows into the device by ID; when both sides have an entry, the newer Saved At wins.
 * With the same Saved At, the sheet wins (someone edited the cells by hand), except for entries
 * from before two-way sync (syncedTo unset): those are sent again once, so the sheet gets the
 * device's exact values.
 * Nothing is ever deleted from the device by a pull: an entry missing from the sheet is marked
 * unsent and written back on the next push.
 */

export const LAYOUT_KEY = 'schema_config';
/** App_Config key: TRUE once SheetSync has written to the spreadsheet since its last backup. */
export const CHANGED_KEY = 'changed_since_backup';

/** The changed-since-backup flag from App_Config rows; null if there is none. */
export function readChangedFlag(rows: string[][]): boolean | null {
  for (const row of rows.slice(1)) {
    if (row[0] === CHANGED_KEY) return String(row[1]).trim().toUpperCase() !== 'FALSE';
  }
  return null;
}

/** True when this entry still has to be written to the given spreadsheet. */
export function isUnsent(entry: Entry, spreadsheetId: string | null): boolean {
  return !spreadsheetId || entry.syncedTo !== spreadsheetId;
}

/** Milliseconds for an ISO timestamp; NaN for anything else (e.g. a cell Google Sheets reformatted). */
function timeOf(iso: string | undefined): number {
  if (!iso || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso.trim())) return NaN;
  return Date.parse(iso);
}

/** Days since 1899-12-30, the Google Sheets epoch, to YYYY-MM-DD. */
function serialToDate(serial: number): string {
  return new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10);
}

/** "14:05", "2:05 PM", "14:05:00" or a day fraction to HH:MM. */
function toTime(cell: string): string {
  const m = cell.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (m) {
    let h = Number(m[1]) % 24;
    if (m[3]) h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0);
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }
  const n = Number(cell);
  if (cell.trim() !== '' && Number.isFinite(n) && n >= 0 && n < 1) {
    const mins = Math.round(n * 1440);
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  return cell;
}

/** "2026-10-19", "10/19/2026" or a date serial to YYYY-MM-DD. */
function toDate(cell: string): string {
  const s = cell.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d+(\.\d+)?$/.test(s)) return serialToDate(Number(s));
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return s;
}

/** Converts a cell as displayed in the sheet back to the value the app stores for this field. */
export function cellToValue(field: CustomField, cell: string): string | number | undefined {
  if (cell === '') return undefined;
  switch (field.type) {
    case 'number':
    case 'rating': {
      const n = Number(cell.replace(/,/g, ''));
      return Number.isFinite(n) ? n : cell;
    }
    case 'date':
      return toDate(cell);
    case 'time':
      return toTime(cell);
    default:
      return cell;
  }
}

/**
 * Text cells are written with a leading apostrophe so Google Sheets keeps them as typed:
 * otherwise "1-3" (Bible chapters) turns into a date and "=..." into a formula.
 */
export function valueToCell(field: CustomField | null, value: unknown): string | number {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number') return value;
  const s = String(value);
  if (field && (field.type === 'date' || field.type === 'time')) return s;
  return `'${s}`;
}

/** Turns a tab's rows (first row = headers) into entries, matching columns to fields by label. */
export function rowsToEntries(category: CategoryDef, rows: string[][], spreadsheetId: string): Entry[] {
  const [headers = [], ...body] = rows;
  const idCol = headers.indexOf('ID');
  const savedCol = headers.indexOf('Saved At');
  if (idCol < 0) return [];
  const fieldCols = category.fields
    .map((f) => ({ field: f, col: headers.indexOf(f.label) }))
    .filter((fc) => fc.col >= 0);

  const entries: Entry[] = [];
  for (const row of body) {
    const id = (row[idCol] ?? '').trim();
    if (!id) continue;
    const values: Record<string, any> = {};
    for (const { field, col } of fieldCols) {
      const v = cellToValue(field, row[col] ?? '');
      if (v !== undefined) values[field.id] = v;
    }
    entries.push({
      id,
      categoryId: category.id,
      timestamp: savedCol >= 0 ? (row[savedCol] ?? '') : '',
      values,
      syncedTo: spreadsheetId,
    });
  }
  return entries;
}

/**
 * Merges entries read from the sheet into the device's entries.
 * pulledCategoryIds lists the categories whose tab was read; entries of other categories are
 * left as they are.
 */
export function mergeEntries(
  local: Entry[],
  remote: Entry[],
  pulledCategoryIds: Set<string>,
  spreadsheetId: string
): Entry[] {
  const remoteById = new Map(remote.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const merged: Entry[] = [];

  for (const entry of local) {
    if (!pulledCategoryIds.has(entry.categoryId)) {
      merged.push(entry);
      continue;
    }
    seen.add(entry.id);
    const theirs = remoteById.get(entry.id);
    if (!theirs || theirs.categoryId !== entry.categoryId) {
      // Not in the sheet (never sent, or the row was removed): keep it and send it again.
      merged.push(entry.syncedTo === spreadsheetId ? { ...entry, syncedTo: undefined } : entry);
      continue;
    }
    const mine = timeOf(entry.timestamp);
    const other = timeOf(theirs.timestamp);
    if (Number.isFinite(other) && (!Number.isFinite(mine) || other > mine)) {
      merged.push(theirs);
    } else if (Number.isFinite(other) && other === mine) {
      merged.push(entry.syncedTo === undefined ? entry : theirs);
    } else {
      // The device's copy is newer, or the sheet's Saved At can't be read: the device wins.
      merged.push(entry);
    }
  }

  const added = remote.filter((e) => !seen.has(e.id));
  return [...added, ...merged];
}

export interface LayoutBackup {
  layout: Pick<AppConfig, 'categories' | 'defaultCategoryId'> & Partial<Pick<AppConfig, 'appName' | 'enableHaptics' | 'lists'>>;
  updatedAt: string;
}

/** Reads the newest layout backup from the App_Config tab's rows (Key, JSON Value, Last Updated). */
export function parseLayoutBackup(rows: string[][], schemaVersion: number): LayoutBackup | null {
  let best: LayoutBackup | null = null;
  for (const row of rows.slice(1)) {
    if (row[0] !== LAYOUT_KEY || !row[1]) continue;
    try {
      const parsed = JSON.parse(row[1]);
      // Backups from older schemas (v2, v3) are upgraded.
      const version = parsed?.schemaVersion;
      if (![2, 3, 4, 5, 6, schemaVersion].includes(version) || !Array.isArray(parsed.categories)) continue;
      const updatedAt = row[2] ?? '';
      if (best && timeOf(updatedAt) <= timeOf(best.updatedAt)) continue;
      best = {
        layout: {
          categories: upgradeCategories(parsed.categories, version),
          defaultCategoryId: parsed.defaultCategoryId,
          ...(typeof parsed.appName === 'string' ? { appName: parsed.appName } : {}),
          ...(typeof parsed.enableHaptics === 'boolean' ? { enableHaptics: parsed.enableHaptics } : {}),
          ...(Array.isArray(parsed.lists) ? { lists: withDefaultLists(parsed.lists) } : {}),
        },
        updatedAt,
      };
    } catch {
      // ignore unreadable rows
    }
  }
  return best;
}

/**
 * Decides whether the sheet's layout backup should replace this device's layout ('pull'),
 * the device's layout should be written to the sheet ('push'), or neither.
 * A device that never changed its layout (layoutUpdatedAt null and default categories) always
 * takes the backup; a device with untracked changes keeps them and backs them up.
 */
export function layoutDirection(
  config: AppConfig,
  backup: LayoutBackup | null,
  isDefaultLayout: boolean
): 'pull' | 'push' | 'none' {
  const local = timeOf(config.layoutUpdatedAt ?? undefined);
  if (!Number.isFinite(local)) {
    if (isDefaultLayout) return backup ? 'pull' : 'none';
    return 'push';
  }
  if (!backup) return 'push';
  const remote = timeOf(backup.updatedAt);
  if (Number.isFinite(remote) && remote > local) return 'pull';
  if (!Number.isFinite(remote) || local > remote) return 'push';
  return config.layoutSyncedTo === config.spreadsheetId ? 'none' : 'push';
}

import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../config/categories';
import { INITIAL_CONFIG } from '../storageService';
import { AppConfig, Entry } from '../../types';
import {
  cellToValue,
  isUnsent,
  layoutDirection,
  mergePage,
  parseLayoutBackup,
  rowsToEntries,
  valueToCell,
} from '../syncLogic';

const SHEET = 'sheet-1';
const food = DEFAULT_CATEGORIES.find((c) => c.id === 'food')!;
const field = (id: string) => food.fields.find((f) => f.id === id)!;

const entry = (id: string, timestamp: string, extra: Partial<Entry> = {}): Entry => ({
  id,
  categoryId: 'food',
  timestamp,
  values: { item: id },
  ...extra,
});

describe('cells', () => {
  it('writes text with a leading apostrophe so Sheets keeps it as typed', () => {
    expect(valueToCell(null, '1-3')).toBe("'1-3");
    expect(valueToCell(field('item'), '=SUM(A1)')).toBe("'=SUM(A1)");
    expect(valueToCell(field('hunger'), 4)).toBe(4);
    expect(valueToCell(field('date'), '2026-10-19')).toBe('2026-10-19');
    expect(valueToCell(field('item'), undefined)).toBe('');
  });

  it('reads displayed cells back into app values', () => {
    expect(cellToValue(field('hunger'), '7')).toBe(7);
    expect(cellToValue(field('date'), '2026-10-19')).toBe('2026-10-19');
    expect(cellToValue(field('date'), '10/9/2026')).toBe('2026-10-09');
    expect(cellToValue(field('date'), '46314')).toBe('2026-10-19');
    expect(cellToValue(field('time'), '2:05 PM')).toBe('14:05');
    expect(cellToValue(field('time'), '12:30 AM')).toBe('00:30');
    expect(cellToValue(field('time'), '14:05:00')).toBe('14:05');
    expect(cellToValue(field('item'), 'Toast')).toBe('Toast');
    expect(cellToValue(field('item'), '')).toBeUndefined();
  });
});

describe('rowsToEntries', () => {
  it('matches columns to fields by header label, in any order', () => {
    const rows = [
      ['Saved At', 'ID', 'Hunger Level', 'Food / Drink / Activity', 'Unknown'],
      ['2026-10-19T12:00:00.000Z', 'food_1', '3', 'Toast', 'x'],
      ['', '', '', 'no id'],
    ];
    expect(rowsToEntries(food, rows, SHEET)).toEqual([
      { id: 'food_1', categoryId: 'food', timestamp: '2026-10-19T12:00:00.000Z', values: { hunger: 3, item: 'Toast' }, syncedTo: SHEET },
    ]);
  });
});

describe('mergePage', () => {
  it('adds entries that are only in the sheet', () => {
    const remote = [entry('a', '2026-10-01T00:00:00Z', { syncedTo: SHEET })];
    expect(mergePage([], remote)).toEqual(remote);
  });

  it('keeps the newer copy when both sides have an entry', () => {
    const local = [entry('a', '2026-10-01T00:00:00Z', { syncedTo: SHEET }), entry('b', '2026-10-05T00:00:00Z')];
    const remote = [
      { ...entry('a', '2026-10-02T00:00:00Z', { syncedTo: SHEET }), values: { item: 'edited in sheet' } },
      { ...entry('b', '2026-10-03T00:00:00Z', { syncedTo: SHEET }), values: { item: 'older' } },
    ];
    const merged = mergePage(local, remote);
    expect(merged.find((e) => e.id === 'a')!.values.item).toBe('edited in sheet');
    const b = merged.find((e) => e.id === 'b')!;
    expect(b.values.item).toBe('b');
    expect(isUnsent(b, SHEET)).toBe(true);
  });

  it('takes hand edits made in the sheet without a new Saved At', () => {
    const local = [entry('a', '2026-10-01T00:00:00Z', { syncedTo: SHEET })];
    const remote = [{ ...entry('a', '2026-10-01T00:00:00.000Z', { syncedTo: SHEET }), values: { item: 'fixed typo' } }];
    const merged = mergePage(local, remote);
    expect(merged[0].values.item).toBe('fixed typo');
    expect(isUnsent(merged[0], SHEET)).toBe(false);
  });

  it('sends entries from before two-way sync once, even if the sheet has the same Saved At', () => {
    const remote = [{ ...entry('a', '2026-10-01T00:00:00.000Z', { syncedTo: SHEET }), values: { item: '1/3/2026' } }];
    const merged = mergePage([entry('a', '2026-10-01T00:00:00Z')], remote);
    expect(merged[0].values.item).toBe('a');
    expect(isUnsent(merged[0], SHEET)).toBe(true);
  });

  it('keeps the device copy when the sheet time is unreadable', () => {
    const merged = mergePage([entry('a', '2026-10-01T00:00:00Z')], [{ ...entry('a', '10/2/2026 0:00:00'), values: {} }]);
    expect(merged[0].values.item).toBe('a');
  });

  it('treats entries sent to another spreadsheet as unsent', () => {
    expect(isUnsent(entry('a', 't', { syncedTo: 'other' }), SHEET)).toBe(true);
    expect(isUnsent(entry('a', 't', { syncedTo: SHEET }), null)).toBe(true);
  });
});

describe('layout backup', () => {
  const json = (categories = DEFAULT_CATEGORIES.slice(0, 2)) =>
    JSON.stringify({ ...INITIAL_CONFIG, categories, spreadsheetId: 'ignored' });

  it('picks the newest schema_config row and ignores the spreadsheet fields', () => {
    const rows = [
      ['Key', 'JSON Value', 'Last Updated'],
      ['schema_config', json(DEFAULT_CATEGORIES.slice(0, 1)), '2026-10-02T00:00:00Z'],
      ['schema_config', json(), '2026-10-03T00:00:00Z'],
      ['schema_config', '{not json', '2026-10-09T00:00:00Z'],
      ['other', json(), '2026-10-10T00:00:00Z'],
    ];
    const backup = parseLayoutBackup(rows, INITIAL_CONFIG.schemaVersion)!;
    expect(backup.updatedAt).toBe('2026-10-03T00:00:00Z');
    expect(backup.layout.categories).toHaveLength(2);
    expect(backup.layout).not.toHaveProperty('spreadsheetId');
  });

  it('fits in one cell', () => {
    expect(json(DEFAULT_CATEGORIES).length).toBeLessThan(50000);
  });

  const cfg = (patch: Partial<AppConfig>): AppConfig => ({ ...INITIAL_CONFIG, spreadsheetId: SHEET, ...patch });
  const backup = { layout: { categories: [], defaultCategoryId: 'mood' }, updatedAt: '2026-10-05T00:00:00Z' };

  it('restores the backup on a device that never changed its layout', () => {
    expect(layoutDirection(cfg({}), backup, true)).toBe('pull');
    expect(layoutDirection(cfg({}), null, true)).toBe('none');
  });

  it('backs up untracked changes instead of overwriting them', () => {
    expect(layoutDirection(cfg({}), backup, false)).toBe('push');
  });

  it('newer side wins', () => {
    expect(layoutDirection(cfg({ layoutUpdatedAt: '2026-10-04T00:00:00Z' }), backup, false)).toBe('pull');
    expect(layoutDirection(cfg({ layoutUpdatedAt: '2026-10-06T00:00:00Z' }), backup, false)).toBe('push');
    expect(layoutDirection(cfg({ layoutUpdatedAt: '2026-10-05T00:00:00Z', layoutSyncedTo: SHEET }), backup, false)).toBe('none');
  });
});

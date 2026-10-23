import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../config/categories';
import { Entry } from '../../types';
import { PageCursor } from '../sheetsService';
import { loadEntriesPage } from '../syncEngine';
import { mergePage } from '../syncLogic';

const SHEET = 'sheet-1';
const mood = DEFAULT_CATEGORIES.find((c) => c.id === 'mood')!;
const HEADER = ['ID', 'Saved At', 'Date', 'Mood Score', 'Daily Recap'];

/** A Mood tab with `count` rows, mood_1 at the top (oldest) to mood_<count> at the bottom. */
function moodRows(count: number): string[][] {
  return [
    HEADER,
    ...Array.from({ length: count }, (_, i) => [
      `mood_${i + 1}`,
      `2026-10-${String((i % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
      '2026-10-01',
      String((i % 10) + 1),
      `day ${i + 1}`,
    ]),
  ];
}

/** Google's answer for a range on a tab that doesn't exist. */
const NO_TAB = JSON.stringify({ error: { code: 400, message: "Unable to parse range: 'Nope'!A:A", status: 'INVALID_ARGUMENT' } });

/**
 * Answers values:batchGet for 'Tab'!A:A, 'Tab'!1:1 and 'Tab'!5:30 ranges; unknown tabs give 400.
 * Reads the tabs at call time, so a test can change them between pages.
 */
function fakeSheets(tabs: Record<string, string[][]>) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input);
    const ranges = url.searchParams.getAll('ranges');
    const valueRanges = [];
    for (const range of ranges) {
      const m = range.match(/^'((?:[^']|'')*)'!(A:A|(\d+):(\d+))$/)!;
      const rows = tabs[m[1].replace(/''/g, "'")];
      if (!rows) return new Response(NO_TAB, { status: 400 });
      if (m[2] === 'A:A') valueRanges.push({ values: rows.map((r) => [r[0]]) });
      else valueRanges.push({ values: rows.slice(Number(m[3]) - 1, Number(m[4])) });
    }
    return new Response(JSON.stringify({ valueRanges }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function device(entries: Entry[] = []) {
  const ref = { current: entries };
  const load = (before: PageCursor | null, pageSize = 25) =>
    loadEntriesPage({
      token: 't',
      sheetId: SHEET,
      category: mood,
      before,
      pageSize,
      updateEntries: (fn) => (ref.current = fn(ref.current)),
    });
  /** Page from the bottom to the top of the tab, calling between(page) after each page. */
  const loadAll = async (between: (page: number) => void = () => {}) => {
    let next = await load(null);
    for (let page = 1; next && page < 20; page++) {
      between(page);
      next = await load(next);
    }
    expect(next).toBeNull();
  };
  return { ref, load, loadAll };
}

const ids = (entries: Entry[]) => entries.map((e) => e.id).sort();

describe('loadEntriesPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the newest rows first, one page at a time, until the top of the tab', async () => {
    const fetchMock = fakeSheets({ Mood: moodRows(60) });
    const d = device();

    const next1 = await d.load(null);
    expect(d.ref.current.map((e) => e.id).sort()).toEqual(
      Array.from({ length: 25 }, (_, i) => `mood_${36 + i}`).sort()
    );
    expect(next1).toEqual({ row: 37, id: 'mood_36' }); // rows 37..61 hold mood_36..mood_60

    const next2 = await d.load(next1);
    expect(d.ref.current).toHaveLength(50);
    expect(next2).toEqual({ row: 12, id: 'mood_11' });

    const next3 = await d.load(next2);
    expect(d.ref.current).toHaveLength(60);
    expect(next3).toBeNull();

    // First page: the ID column, then header + rows. Later pages: one request each.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(d.ref.current.find((e) => e.id === 'mood_1')!.values).toEqual({ date: '2026-10-01', score: 1, recap: 'day 1' });
  });

  it('treats an empty or missing tab as no entries', async () => {
    fakeSheets({ Mood: [HEADER] });
    expect(await device().load(null)).toBeNull();
    fakeSheets({});
    const d = device();
    expect(await d.load(null)).toBeNull();
    expect(d.ref.current).toEqual([]);
  });

  it('reports errors other than a missing tab', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 400, message: 'Invalid requests' } }), { status: 400 })));
    await expect(device().load(null)).rejects.toThrow(/Could not read Mood: .*Invalid requests/);
  });

  it('neither skips nor repeats entries when rows are inserted above the next page', async () => {
    const tabs = { Mood: moodRows(60) };
    const fetchMock = fakeSheets(tabs);
    const d = device();
    const added = ['inserted_1', '2026-10-02T08:00:00.000Z', '2026-10-01', '5', 'added in mdlife'];
    await d.loadAll((page) => {
      // After the first page, two rows are inserted near the top of the tab (above the cursor).
      if (page === 1) tabs.Mood.splice(3, 0, added, ['inserted_2', ...added.slice(1)]);
    });
    expect(ids(d.ref.current)).toEqual(ids(rowsToEntriesFor(tabs.Mood)));
    expect(d.ref.current).toHaveLength(62);
    // Two extra requests: find where the cursor's row moved to, then read the page above it.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('neither skips nor repeats entries when rows above the next page are deleted', async () => {
    const tabs = { Mood: moodRows(60) };
    const d = device();
    fakeSheets(tabs);
    await d.loadAll((page) => {
      if (page === 1) tabs.Mood.splice(2, 3); // mood_2..mood_4
    });
    expect(ids(d.ref.current)).toEqual(ids(rowsToEntriesFor(tabs.Mood)));
    expect(d.ref.current).toHaveLength(57);
  });

  it("starts again from the bottom when the cursor's own row is deleted", async () => {
    const tabs = { Mood: moodRows(60) };
    const d = device();
    fakeSheets(tabs);
    await d.loadAll((page) => {
      if (page === 1) tabs.Mood.splice(36, 1); // row 37, mood_36: the top row of the first page
    });
    // mood_36 was loaded before it was deleted; every other row is on the device exactly once.
    expect(d.ref.current).toHaveLength(60);
    expect(new Set(d.ref.current.map((e) => e.id)).size).toBe(60);
  });
});

/** The IDs in a Mood tab's rows (header first), as entries. */
function rowsToEntriesFor(rows: string[][]): Entry[] {
  return rows.slice(1).map((r) => ({ id: r[0], categoryId: 'mood', timestamp: r[1], values: {} }));
}

describe('mergePage', () => {
  const entry = (id: string, timestamp: string, extra: Partial<Entry> = {}): Entry => ({
    id,
    categoryId: 'mood',
    timestamp,
    values: { recap: id },
    ...extra,
  });

  it('updates and adds only what is on the page', () => {
    const local = [
      entry('a', '2026-10-01T00:00:00Z', { syncedTo: SHEET }), // older than the sheet
      entry('b', '2026-10-05T00:00:00Z'), // newer on the device, not sent yet
      entry('c', '2026-10-01T00:00:00Z', { syncedTo: SHEET }), // not on this page
    ];
    const page = [
      { ...entry('a', '2026-10-02T00:00:00Z', { syncedTo: SHEET }), values: { recap: 'edited in mdlife' } },
      { ...entry('b', '2026-10-03T00:00:00Z', { syncedTo: SHEET }), values: { recap: 'older' } },
      entry('d', '2026-10-04T00:00:00Z', { syncedTo: SHEET }),
    ];
    const merged = mergePage(local, page);
    const byId = Object.fromEntries(merged.map((e) => [e.id, e]));
    expect(byId.a.values.recap).toBe('edited in mdlife');
    expect(byId.b.values.recap).toBe('b');
    expect(byId.b.syncedTo).toBeUndefined();
    expect(byId.c).toBe(local[2]);
    expect(byId.d).toBeDefined();
  });

  it('adds an ID only once, even if it is on the page twice', () => {
    expect(mergePage([], [entry('d', '2026-10-04T00:00:00Z'), entry('d', '2026-10-04T00:00:00Z')])).toHaveLength(1);
  });

  it('returns the same array when the page changes nothing', () => {
    const local = [entry('a', '2026-10-01T00:00:00Z', { syncedTo: SHEET })];
    expect(mergePage(local, [entry('a', '2026-09-01T00:00:00Z', { syncedTo: SHEET })])).toBe(local);
  });
});

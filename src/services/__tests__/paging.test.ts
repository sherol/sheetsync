import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../config/categories';
import { Entry } from '../../types';
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

/** Answers values:batchGet for 'Tab'!A:A, 'Tab'!1:1 and 'Tab'!5:30 ranges; unknown tabs give 400. */
function fakeSheets(tabs: Record<string, string[][]>) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input);
    const ranges = url.searchParams.getAll('ranges');
    const valueRanges = [];
    for (const range of ranges) {
      const m = range.match(/^'((?:[^']|'')*)'!(A:A|(\d+):(\d+))$/)!;
      const rows = tabs[m[1].replace(/''/g, "'")];
      if (!rows) return new Response('Unable to parse range', { status: 400 });
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
  const load = (before: number | null, pageSize = 25) =>
    loadEntriesPage({
      token: 't',
      sheetId: SHEET,
      category: mood,
      before,
      pageSize,
      updateEntries: (fn) => (ref.current = fn(ref.current)),
    });
  return { ref, load };
}

describe('loadEntriesPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the newest rows first, one page at a time, until the top of the tab', async () => {
    const fetchMock = fakeSheets({ Mood: moodRows(60) });
    const d = device();

    const next1 = await d.load(null);
    expect(d.ref.current.map((e) => e.id).sort()).toEqual(
      Array.from({ length: 25 }, (_, i) => `mood_${36 + i}`).sort()
    );
    expect(next1).toBe(37); // rows 37..61 hold mood_36..mood_60

    const next2 = await d.load(next1);
    expect(d.ref.current).toHaveLength(50);
    expect(next2).toBe(12);

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
});

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

  it('returns the same array when the page changes nothing', () => {
    const local = [entry('a', '2026-10-01T00:00:00Z', { syncedTo: SHEET })];
    expect(mergePage(local, [entry('a', '2026-09-01T00:00:00Z', { syncedTo: SHEET })])).toBe(local);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../config/categories';
import { INITIAL_CONFIG } from '../storageService';
import { AppConfig, Entry } from '../../types';
import { syncOnce } from '../syncEngine';
import { SheetsAuthError } from '../sheetsService';

const SHEET = 'sheet-1';

/** In-memory Google Sheets: stores cells as displayed, and applies USER_ENTERED's apostrophe rule. */
function fakeSheets(initial: Record<string, string[][]> = {}, opts: { status?: number } = {}) {
  const tabs = new Map(Object.entries(initial).map(([k, v]) => [k, v.map((r) => [...r])]));
  const parse = (range: string) => {
    const m = range.match(/^'((?:[^']|'')*)'(?:!A(\d+)?(?::[A-Z]+\d*)?)?$/)!;
    return { tab: m[1].replace(/''/g, "'"), row: m[2] ? Number(m[2]) : undefined };
  };
  const display = (v: unknown, raw: boolean) =>
    typeof v === 'string' && !raw && v.startsWith("'") ? v.slice(1) : String(v ?? '');
  const write = (tab: string, row: number, values: unknown[], raw: boolean) => {
    const rows = tabs.get(tab)!;
    while (rows.length < row) rows.push([]);
    rows[row - 1] = values.map((v) => display(v, raw));
  };
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    if (opts.status) return new Response('nope', { status: opts.status });
    const url = new URL(input);
    const path = decodeURIComponent(url.pathname.replace(`/v4/spreadsheets/${SHEET}`, ''));
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const raw = (body?.valueInputOption ?? url.searchParams.get('valueInputOption')) === 'RAW';

    if (path === '' && !init.method) {
      return json({ sheets: [...tabs.keys()].map((title, i) => ({ properties: { title, sheetId: i } })) });
    }
    if (path === ':batchUpdate') {
      body.requests.forEach((r: any) => tabs.set(r.addSheet.properties.title, []));
      return json({});
    }
    if (path === '/values:batchGet') {
      return json({ valueRanges: url.searchParams.getAll('ranges').map((r) => ({ values: tabs.get(parse(r).tab) })) });
    }
    if (path === '/values:batchUpdate') {
      body.data.forEach((d: any) => {
        const { tab, row } = parse(d.range);
        write(tab, row!, d.values[0], raw);
      });
      return json({});
    }
    const m = path.match(/^\/values\/(.+?)(:append)?$/)!;
    const { tab, row } = parse(m[1]);
    if (m[2]) {
      body.values.forEach((v: unknown[]) => write(tab, tabs.get(tab)!.length + 1, v, raw));
      return json({});
    }
    if (init.method === 'PUT') {
      write(tab, row!, body.values[0], raw);
      return json({});
    }
    return json({ values: (tabs.get(tab) ?? []).map((r) => [r[0] ?? '']) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { tabs, fetchMock };
}

function device(config: Partial<AppConfig> = {}, entries: Entry[] = []) {
  const configRef = { current: { ...INITIAL_CONFIG, spreadsheetId: SHEET, ...config } as AppConfig };
  const entriesRef = { current: entries };
  return {
    configRef,
    entriesRef,
    run: (pull = true, readEntries = true) =>
      syncOnce({
        token: 't',
        sheetId: SHEET,
        pull,
        readEntries,
        configRef,
        updateConfig: (fn) => (configRef.current = fn(configRef.current)),
        entriesRef,
        updateEntries: (fn) => (entriesRef.current = fn(entriesRef.current)),
      }),
  };
}

const prayer = (id: string, timestamp: string, chapters: string): Entry => ({
  id,
  categoryId: 'prayer',
  timestamp,
  values: { date: '2026-10-19', book: 'Psalms', chapters },
});

describe('syncOnce', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends entries saved while offline, keeping text like "1-3" as typed', async () => {
    const { tabs } = fakeSheets({});
    const d = device({}, [prayer('prayer_1', '2026-10-19T08:00:00.000Z', '1-3')]);
    await d.run();

    const rows = tabs.get('Prayer')!;
    expect(rows[0].slice(0, 3)).toEqual(['ID', 'Saved At', 'Date']);
    expect(rows[1]).toContain('1-3');
    expect(rows[1][0]).toBe('prayer_1');
    expect(d.entriesRef.current[0].syncedTo).toBe(SHEET);
    // The untouched default layout is not backed up.
    expect(tabs.get('App_Config')).toEqual([['Key', 'JSON Value', 'Last Updated']]);
  });

  it('restores layout and entries on a new device', async () => {
    const custom = DEFAULT_CATEGORIES.map((c) => (c.id === 'mood' ? { ...c, label: 'Feelings' } : c));
    const layout = JSON.stringify({ ...INITIAL_CONFIG, categories: custom });
    fakeSheets({
      App_Config: [['Key', 'JSON Value', 'Last Updated'], ['schema_config', layout, '2026-10-01T00:00:00.000Z']],
      Mood: [
        ['ID', 'Saved At', 'Date', 'Mood Score', 'Daily Recap'],
        ['mood_1', '2026-10-18T20:00:00.000Z', '10/18/2026', '7', 'Good day'],
      ],
    });
    const d = device();
    await d.run();

    expect(d.configRef.current.categories.find((c) => c.id === 'mood')!.label).toBe('Feelings');
    expect(d.configRef.current.layoutSyncedTo).toBe(SHEET);
    expect(d.entriesRef.current).toEqual([
      {
        id: 'mood_1',
        categoryId: 'mood',
        timestamp: '2026-10-18T20:00:00.000Z',
        values: { date: '2026-10-18', score: 7, recap: 'Good day' },
        syncedTo: SHEET,
      },
    ]);
  });

  it('takes newer edits from the sheet and sends newer edits from the device, in place', async () => {
    const header = ['ID', 'Saved At', 'Date', 'Mood Score', 'Daily Recap'];
    const { tabs } = fakeSheets({
      Mood: [
        header,
        ['mood_1', '2026-10-18T21:00:00.000Z', '2026-10-18', '8', 'edited in mdlife'],
        ['mood_2', '2026-10-18T09:00:00.000Z', '2026-10-17', '5', 'old'],
      ],
    });
    const d = device({}, [
      { id: 'mood_1', categoryId: 'mood', timestamp: '2026-10-18T20:00:00.000Z', values: { score: 7 }, syncedTo: SHEET },
      { id: 'mood_2', categoryId: 'mood', timestamp: '2026-10-18T10:00:00.000Z', values: { date: '2026-10-17', score: 6, recap: 'edited on phone' } },
    ]);
    await d.run();

    const byId = Object.fromEntries(d.entriesRef.current.map((e) => [e.id, e]));
    expect(byId.mood_1.values.recap).toBe('edited in mdlife');
    expect(byId.mood_2.syncedTo).toBe(SHEET);
    const rows = tabs.get('Mood')!;
    expect(rows).toHaveLength(3);
    expect(rows[2]).toEqual(['mood_2', '2026-10-18T10:00:00.000Z', '2026-10-17', '6', 'edited on phone']);
  });

  it('backs up a changed layout and reports an expired sign-in', async () => {
    const { tabs } = fakeSheets({});
    const d = device({ layoutUpdatedAt: '2026-10-19T00:00:00.000Z' });
    await d.run(false);
    const backup = tabs.get('App_Config')!;
    expect(backup[1][0]).toBe('schema_config');
    expect(backup[1][2]).toBe('2026-10-19T00:00:00.000Z');
    expect(JSON.parse(backup[1][1]).categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(d.configRef.current.layoutSyncedTo).toBe(SHEET);

    // A second change updates the same row.
    d.configRef.current = { ...d.configRef.current, layoutUpdatedAt: '2026-10-19T01:00:00.000Z', layoutSyncedTo: null };
    await d.run(false);
    expect(tabs.get('App_Config')!).toHaveLength(2);

    fakeSheets({}, { status: 401 });
    await expect(device({}, [prayer('p', '2026-10-19T00:00:00.000Z', '1')]).run()).rejects.toBeInstanceOf(SheetsAuthError);
  });

  it('by default restores only the layout, not entries, and still sends unsent entries', async () => {
    const custom = DEFAULT_CATEGORIES.map((c) => (c.id === 'mood' ? { ...c, label: 'Feelings' } : c));
    const layout = JSON.stringify({ ...INITIAL_CONFIG, categories: custom });
    const { tabs, fetchMock } = fakeSheets({
      App_Config: [['Key', 'JSON Value', 'Last Updated'], ['schema_config', layout, '2026-10-01T00:00:00.000Z']],
      Mood: [
        ['ID', 'Saved At', 'Date', 'Mood Score', 'Daily Recap'],
        ['mood_1', '2026-10-18T20:00:00.000Z', '10/18/2026', '7', 'Good day'],
      ],
    });
    const d = device({}, [prayer('prayer_1', '2026-10-19T08:00:00.000Z', '4-6')]);
    await d.run(true, false);

    expect(d.configRef.current.categories.find((c) => c.id === 'mood')!.label).toBe('Feelings');
    expect(d.entriesRef.current.map((e) => e.id)).toEqual(['prayer_1']);
    expect(d.entriesRef.current[0].syncedTo).toBe(SHEET);
    expect(tabs.get('Prayer')![1]).toContain('4-6');
    expect(tabs.get('Mood')!.length).toBe(2);
    const reads = fetchMock.mock.calls.map(([u]) => decodeURIComponent(String(u))).filter((u) => u.includes('batchGet'));
    expect(reads.every((u) => !u.includes("'Mood'"))).toBe(true);
  });

  it('upgrades a layout backup saved before short tab names', async () => {
    const v2 = DEFAULT_CATEGORIES.map((c) =>
      c.id === 'media' ? { ...c, label: 'Media', title: undefined } : c.id === 'mood' ? { ...c, label: 'My Mood', title: undefined } : c
    );
    const layout = JSON.stringify({ schemaVersion: 2, categories: v2, defaultCategoryId: 'mood' });
    fakeSheets({ App_Config: [['Key', 'JSON Value', 'Last Updated'], ['schema_config', layout, '2026-10-01T00:00:00.000Z']] });
    const d = device();
    await d.run(true, false);

    const cats = d.configRef.current.categories;
    expect(cats.find((c) => c.id === 'media')).toMatchObject({ label: 'Media', title: 'Media & Books' });
    expect(cats.find((c) => c.id === 'mood')).toMatchObject({ label: 'My Mood' });
  });
});

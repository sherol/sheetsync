import { afterEach, describe, expect, it, vi } from 'vitest';
import { SheetsService } from '../sheetsService';
import { DEFAULT_CATEGORIES, withDefaultLists } from '../../config/categories';
import { upgradeCategories } from '../storageService';

function fakeDrive(opts: { existingFolder?: string; copyStatus?: number } = {}) {
  const calls: { method: string; url: string; body: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ method: init.method || 'GET', url: decodeURIComponent(input), body });
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
      if (input.includes('/copy')) {
        if (opts.copyStatus) return new Response('no', { status: opts.copyStatus });
        return json({ id: 'copy-1', name: body.name });
      }
      if (init.method === 'POST') return json({ id: 'folder-new' });
      return json({ files: opts.existingFolder ? [{ id: opts.existingFolder }] : [] });
    })
  );
  return calls;
}

describe('backupSpreadsheet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates the backup folder in My Drive and copies the sheet into it', async () => {
    const calls = fakeDrive();
    const result = await SheetsService.backupSpreadsheet('t', 'sheet-1', 'Tracker (backup 2026-10-20 03:00)');

    expect(calls[0].url).toContain("name='backup' and mimeType='application/vnd.google-apps.folder' and 'root' in parents");
    expect(calls[1]).toMatchObject({ method: 'POST', body: { name: 'backup', mimeType: 'application/vnd.google-apps.folder' } });
    expect(calls[2].url).toContain('/files/sheet-1/copy');
    expect(calls[2].body).toEqual({ name: 'Tracker (backup 2026-10-20 03:00)', parents: ['folder-new'] });
    expect(result).toEqual({ id: 'copy-1', name: 'Tracker (backup 2026-10-20 03:00)', folderId: 'folder-new' });
  });

  it('reuses an existing backup folder', async () => {
    const calls = fakeDrive({ existingFolder: 'folder-old' });
    await SheetsService.backupSpreadsheet('t', 'sheet-1', 'copy');
    expect(calls.filter((c) => c.method === 'POST' && !c.url.includes('/copy'))).toHaveLength(0);
    expect(calls.at(-1)!.body.parents).toEqual(['folder-old']);
  });

  it('explains when Drive does not let SheetSync copy the sheet', async () => {
    fakeDrive({ copyStatus: 404 });
    await expect(SheetsService.backupSpreadsheet('t', 'sheet-1', 'copy')).rejects.toThrow(/not allowed to copy/);
  });
});

/** A spreadsheet with tabs addressed by sheetId, enough for rebuild/restore. */
function fakeBook(files: Record<string, string[]>) {
  let nextId = 1;
  const books = new Map(
    Object.entries(files).map(([file, titles]) => [file, titles.map((title) => ({ sheetId: nextId++, title }))])
  );
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    const copy = url.pathname.match(/spreadsheets\/([^/]+)\/sheets\/(\d+):copyTo$/);
    if (copy) {
      const src = books.get(copy[1])!.find((t) => t.sheetId === Number(copy[2]))!;
      const tab = { sheetId: nextId++, title: `Copy of ${src.title}` };
      books.get(body.destinationSpreadsheetId)!.push(tab);
      return json({ sheetId: tab.sheetId, title: tab.title });
    }
    const file = url.pathname.match(/spreadsheets\/([^/:]+)/)![1];
    const tabs = books.get(file)!;
    if (url.pathname.endsWith(':batchUpdate') && !url.pathname.includes('/values')) {
      const replies = body.requests.map((r: any) => {
        if (r.addSheet) {
          const tab = { sheetId: nextId++, title: r.addSheet.properties.title };
          tabs.push(tab);
          return { addSheet: { properties: tab } };
        }
        if (r.deleteSheet) tabs.splice(tabs.findIndex((t) => t.sheetId === r.deleteSheet.sheetId), 1);
        if (r.updateSheetProperties) {
          const p = r.updateSheetProperties.properties;
          const tab = tabs.find((t) => t.sheetId === p.sheetId)!;
          tab.title = p.title;
          tabs.splice(tabs.indexOf(tab), 1);
          tabs.splice(p.index, 0, tab);
        }
        return {};
      });
      return json({ replies });
    }
    if (url.pathname.includes('/values')) return json({});
    return json({ sheets: tabs.map((t) => ({ properties: t })) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { titles: (file: string) => books.get(file)!.map((t) => t.title) };
}

describe('rebuildSpreadsheet / restoreFromBackup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('empties the same file and recreates one tab per category plus the system tabs', async () => {
    const book = fakeBook({ main: ['Media', 'Medicine_Food', 'Old_Tab'] });
    await SheetsService.rebuildSpreadsheet('t', 'main', DEFAULT_CATEGORIES.slice(0, 2));
    expect(book.titles('main')).toEqual(['Media', 'Medicine', 'Monthly_Reports', 'App_Config']);
  });

  it("replaces the file's tabs with the backup's, under their original names and order", async () => {
    const book = fakeBook({ main: ['Media', 'Junk'], backup1: ['Media', 'Prayer', 'App_Config'] });
    await SheetsService.restoreFromBackup('t', 'main', 'backup1');
    expect(book.titles('main')).toEqual(['Media', 'Prayer', 'App_Config']);
  });
});

describe('listBackups', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists spreadsheets in the backup folder, newest name first, and is empty without a folder', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        urls.push(decodeURIComponent(input));
        if (input.includes(encodeURIComponent("name='backup'"))) return new Response(JSON.stringify({ files: [{ id: 'f1' }] }));
        return new Response(JSON.stringify({ files: [{ id: 'b1', name: '2026-10-20 03.30 SheetSync', modifiedTime: 'x' }] }));
      })
    );
    expect(await SheetsService.listBackups('t')).toHaveLength(1);
    expect(urls[1]).toContain("'f1' in parents");
    expect(urls[1]).toContain('orderBy=name desc');

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ files: [] }))));
    expect(await SheetsService.listBackups('t')).toEqual([]);
  });
});

describe('upgradeCategories v3 -> v4', () => {
  it('moves old two-word sheet tab names to the first word and remembers the old name', () => {
    const v3 = DEFAULT_CATEGORIES.map((c) =>
      c.id === 'food' ? { ...c, sheetName: 'Medicine_Food' } : c.id === 'recipes' ? { ...c, sheetName: 'My_Recipes' } : c
    );
    const out = upgradeCategories(v3, 3);
    expect(out.find((c) => c.id === 'food')).toMatchObject({ sheetName: 'Medicine', renameFrom: 'Medicine_Food' });
    // A sheet tab the user named themselves is left alone.
    expect(out.find((c) => c.id === 'recipes')).toMatchObject({ sheetName: 'My_Recipes' });
    expect(out.find((c) => c.id === 'recipes').renameFrom).toBeUndefined();
  });
});

describe('upgradeCategories v4 -> v5', () => {
  it('renames the default Media title and adds Album to its untouched Type choices', () => {
    const v4 = DEFAULT_CATEGORIES.map((c) =>
      c.id === 'media'
        ? {
            ...c,
            title: 'Media & Books',
            fields: c.fields.map((f) => (f.id === 'type' ? { ...f, options: ['Book', 'Movie', 'TV', 'Game'] } : f)),
          }
        : c
    );
    const media = upgradeCategories(v4, 4).find((c) => c.id === 'media');
    expect(media.title).toBe('Media & Music');
    expect(media.fields.find((f: any) => f.id === 'type').options).toEqual(['Book', 'Movie', 'TV', 'Game', 'Album']);
  });

  it('renames the default Projects title', () => {
    const v4 = DEFAULT_CATEGORIES.map((c) => (c.id === 'projects' ? { ...c, title: 'Projects & Initiatives' } : c));
    expect(upgradeCategories(v4, 4).find((c) => c.id === 'projects').title).toBe('Projects & Practice');
  });

  it('leaves a custom Media title and custom choices alone', () => {
    const v4 = DEFAULT_CATEGORIES.map((c) =>
      c.id === 'media'
        ? { ...c, title: 'Media & Podcasts', fields: c.fields.map((f) => (f.id === 'type' ? { ...f, options: ['Podcast'] } : f)) }
        : c
    );
    const media = upgradeCategories(v4, 4).find((c) => c.id === 'media');
    expect(media.title).toBe('Media & Podcasts');
    expect(media.fields.find((f: any) => f.id === 'type').options).toEqual(['Podcast']);
  });
});

describe('upgradeCategories v5 -> v6', () => {
  it('turns project pickers into shared-list dropdowns and gives Medicine quick picks', () => {
    const v5 = DEFAULT_CATEGORIES.map((c) => {
      if (c.id === 'people' || c.id === 'ideas') {
        return {
          ...c,
          fields: c.fields.map((f) =>
            f.id === 'projects' ? { id: 'projects', label: f.label, type: 'relation', relatedCategoryId: 'projects' } : f
          ),
        };
      }
      if (c.id === 'food') {
        const { quickPicksEnabled: _q, quickPicks: _p, ...rest } = c;
        return rest;
      }
      return c;
    });
    const out = upgradeCategories(v5 as any[], 5);
    for (const id of ['people', 'ideas']) {
      const f = out.find((c) => c.id === id).fields.find((x: any) => x.id === 'projects');
      expect(f).toMatchObject({ type: 'list', listId: 'projects', multiple: true });
      expect(f.relatedCategoryId).toBeUndefined();
    }
    expect(out.find((c) => c.id === 'food')).toMatchObject({ quickPicksEnabled: true, quickPicks: [] });
  });
});

describe('upgradeCategories v6 -> v7', () => {
  it("makes Projects' Name and Type dropdowns that take new items", () => {
    const v6 = DEFAULT_CATEGORIES.map((c) =>
      c.id === 'projects'
        ? {
            ...c,
            fields: c.fields.map((f) =>
              f.id === 'name' || f.id === 'type' ? { id: f.id, label: f.label, type: 'text', required: f.required } : f
            ),
          }
        : c
    );
    const fields = upgradeCategories(v6 as any[], 6).find((c) => c.id === 'projects').fields;
    expect(fields.find((f: any) => f.id === 'name')).toMatchObject({ type: 'list', listId: 'projects', allowNew: true, required: true });
    expect(fields.find((f: any) => f.id === 'type')).toMatchObject({ type: 'list', listId: 'projectTypes', allowNew: true });
  });

  it('adds the Project types list to saved lists that lack it, keeping the rest', () => {
    const lists = withDefaultLists([{ id: 'projects', label: 'Projects', items: ['SheetSync'], fromCategoryId: 'projects' }]);
    expect(lists.map((l) => l.id)).toEqual(['projects', 'projectTypes']);
    expect(lists[0].items).toEqual(['SheetSync']);
    expect(lists[1].items).toContain('Practice');
  });
});

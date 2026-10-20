import { afterEach, describe, expect, it, vi } from 'vitest';
import { SheetsService } from '../sheetsService';

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

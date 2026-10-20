import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { AppConfig, Entry, SyncStatus } from '../types';
import { SheetsAuthError } from '../services/sheetsService';
import { markTokenExpired } from '../services/auth';
import { syncOnce } from '../services/syncEngine';

// Pull again when the app comes back to the foreground, at most this often.
const PULL_ON_FOCUS_MS = 60 * 1000;

interface Options {
  accessToken: string | null;
  configRef: MutableRefObject<AppConfig>;
  updateConfig: (fn: (c: AppConfig) => AppConfig) => void;
  entriesRef: MutableRefObject<Entry[]>;
  updateEntries: (fn: (e: Entry[]) => Entry[]) => void;
}

/**
 * Sync with the connected Google Sheet.
 * - sync(true) reads the layout backup (and category tabs only if readEntries is on), merges them into the
 *   device (newer Saved At wins), then sends everything not yet in the sheet.
 * - sync(false) only sends what's unsent.
 * Runs one at a time; a request made while syncing runs once the current one finishes.
 */
export function useSheetSync({ accessToken, configRef, updateConfig, entriesRef, updateEntries }: Options) {
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle', pendingCount: 0 });
  const running = useRef(false);
  const queued = useRef<{ pull: boolean } | null>(null);
  const lastPullAt = useRef(0);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const run = useCallback(
    async (pull: boolean): Promise<void> => {
      const token = tokenRef.current;
      const sheetId = configRef.current.spreadsheetId;
      if (!token || !sheetId) return;
      if (running.current) {
        queued.current = { pull: pull || !!queued.current?.pull };
        return;
      }
      running.current = true;
      setStatus((s) => ({ ...s, state: 'syncing', message: undefined }));

      try {
        await syncOnce({ token, sheetId, pull, configRef, updateConfig, entriesRef, updateEntries });
        if (pull) lastPullAt.current = Date.now();
        setStatus((s) => ({ ...s, state: 'synced', message: undefined }));
      } catch (err: any) {
        if (err instanceof SheetsAuthError) markTokenExpired();
        setStatus((s) => ({ ...s, state: 'error', message: err?.message || 'Sync failed' }));
      } finally {
        running.current = false;
        const next = queued.current;
        queued.current = null;
        if (next) void run(next.pull);
      }
    },
    [configRef, entriesRef, updateConfig, updateEntries]
  );

  const spreadsheetId = configRef.current.spreadsheetId;

  // Full sync whenever we get connected or switch spreadsheets.
  useEffect(() => {
    if (accessToken && spreadsheetId) void run(true);
  }, [accessToken, spreadsheetId, run]);

  // Pull again when the app comes back to the foreground; send when the network returns.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastPullAt.current > PULL_ON_FOCUS_MS) void run(true);
    };
    const onOnline = () => void run(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [run]);

  // Show "synced" briefly, then go quiet.
  useEffect(() => {
    if (status.state !== 'synced') return;
    const t = setTimeout(() => setStatus((s) => (s.state === 'synced' ? { ...s, state: 'idle' } : s)), 2500);
    return () => clearTimeout(t);
  }, [status.state]);

  return { status, sync: run };
}

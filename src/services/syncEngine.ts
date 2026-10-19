import { AppConfig, Entry } from '../types';
import { SheetsService } from './sheetsService';
import { INITIAL_CONFIG, SCHEMA_VERSION } from './storageService';
import { DEFAULT_CATEGORIES } from '../config/categories';
import { isUnsent, layoutDirection, mergeEntries, parseLayoutBackup, rowsToEntries } from './syncLogic';

export interface SyncContext {
  token: string;
  sheetId: string;
  /** Read the sheet and merge it into the device before sending. */
  pull: boolean;
  /** Always-current device state; updates must apply synchronously to the ref. */
  configRef: { current: AppConfig };
  updateConfig: (fn: (c: AppConfig) => AppConfig) => void;
  entriesRef: { current: Entry[] };
  updateEntries: (fn: (e: Entry[]) => Entry[]) => void;
}

function isDefaultLayout(config: AppConfig): boolean {
  return (
    config.defaultCategoryId === INITIAL_CONFIG.defaultCategoryId &&
    JSON.stringify(config.categories) === JSON.stringify(DEFAULT_CATEGORIES)
  );
}

function layoutJson(config: AppConfig): string {
  const { schemaVersion, appName, categories, defaultCategoryId, enableHaptics } = config;
  return JSON.stringify({ schemaVersion, appName, categories, defaultCategoryId, enableHaptics });
}

/**
 * One sync pass. With pull, reads every category tab and the layout backup and merges them into
 * the device (newer Saved At wins); then sends the layout if it changed and every unsent entry.
 */
export async function syncOnce({ token, sheetId, pull, configRef, updateConfig, entriesRef, updateEntries }: SyncContext): Promise<void> {
  let pushLayout = false;

  if (pull) {
    let cfg = configRef.current;
    let tabs = await SheetsService.readTabs(token, sheetId, [...cfg.categories.map((c) => c.sheetName), 'App_Config']);

    const backup = parseLayoutBackup(tabs['App_Config'] ?? [], SCHEMA_VERSION);
    const direction = layoutDirection(cfg, backup, isDefaultLayout(cfg));
    if (direction === 'pull' && backup) {
      updateConfig((c) => ({ ...c, ...backup.layout, layoutUpdatedAt: backup.updatedAt, layoutSyncedTo: sheetId }));
      cfg = configRef.current;
      const unread = cfg.categories.map((c) => c.sheetName).filter((t) => !(t in tabs));
      if (unread.length > 0) tabs = { ...tabs, ...(await SheetsService.readTabs(token, sheetId, unread)) };
    }
    pushLayout = direction === 'push';

    const pulled = new Set<string>();
    const remote: Entry[] = [];
    for (const category of cfg.categories) {
      const rows = tabs[category.sheetName];
      if (!rows) continue;
      pulled.add(category.id);
      remote.push(...rowsToEntries(category, rows, sheetId));
    }
    updateEntries((local) => mergeEntries(local, remote, pulled, sheetId));
  } else {
    const cfg = configRef.current;
    pushLayout = cfg.layoutUpdatedAt !== null && cfg.layoutSyncedTo !== sheetId;
  }

  if (pushLayout) {
    if (!configRef.current.layoutUpdatedAt) {
      const now = new Date().toISOString();
      updateConfig((c) => ({ ...c, layoutUpdatedAt: now }));
    }
    const cfg = configRef.current;
    const pushedAt = cfg.layoutUpdatedAt!;
    await SheetsService.saveLayout(token, sheetId, layoutJson(cfg), pushedAt);
    updateConfig((c) => (c.layoutUpdatedAt === pushedAt ? { ...c, layoutSyncedTo: sheetId } : c));
  }

  const categories = configRef.current.categories;
  const pending = entriesRef.current.filter((e) => isUnsent(e, sheetId));
  for (const category of categories) {
    const batch = pending.filter((e) => e.categoryId === category.id);
    if (batch.length === 0) continue;
    await SheetsService.pushEntries(token, sheetId, category, batch);
    const sent = new Map(batch.map((e) => [e.id, e.timestamp]));
    // An entry edited again while this was sending stays unsent.
    updateEntries((list) =>
      list.map((e) => (sent.get(e.id) === e.timestamp && e.categoryId === category.id ? { ...e, syncedTo: sheetId } : e))
    );
  }

  updateConfig((c) => ({ ...c, lastSyncedAt: new Date().toISOString() }));
}

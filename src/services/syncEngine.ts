import { AppConfig, Entry, CategoryDef } from '../types';
import { PageCursor, SheetsAuthError, SheetsService } from './sheetsService';
import { INITIAL_CONFIG, SCHEMA_VERSION } from './storageService';
import { DEFAULT_CATEGORIES, DEFAULT_LISTS } from '../config/categories';
import { isUnsent, layoutDirection, parseLayoutBackup, readChangedFlag, rowsToEntries, mergePage } from './syncLogic';

export interface SyncContext {
  token: string;
  sheetId: string;
  /**
   * Read the layout backup from App_Config before sending. Entries are not read here: a
   * category's rows are loaded page by page as its list scrolls (loadEntriesPage).
   */
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
    JSON.stringify(config.categories) === JSON.stringify(DEFAULT_CATEGORIES) &&
    JSON.stringify(config.lists) === JSON.stringify(DEFAULT_LISTS)
  );
}

export function layoutJson(config: AppConfig): string {
  const { schemaVersion, appName, categories, lists, defaultCategoryId, enableHaptics } = config;
  return JSON.stringify({ schemaVersion, appName, categories, lists, defaultCategoryId, enableHaptics });
}

/**
 * One sync pass. With pull, reads the layout backup (the newer of it and this device's layout
 * wins). Then sends the layout if it changed and every unsent entry.
 */
export async function syncOnce({
  token,
  sheetId,
  pull,
  configRef,
  updateConfig,
  entriesRef,
  updateEntries,
}: SyncContext): Promise<void> {
  let pushLayout = false;

  if (pull) {
    const cfg = configRef.current;
    const tabs = await SheetsService.readTabs(token, sheetId, ['App_Config']);

    const backup = parseLayoutBackup(tabs['App_Config'] ?? [], SCHEMA_VERSION);
    const changed = readChangedFlag(tabs['App_Config'] ?? []) ?? true;
    if (configRef.current.sheetChanged !== changed) updateConfig((c) => ({ ...c, sheetChanged: changed }));
    const direction = layoutDirection(cfg, backup, isDefaultLayout(cfg));
    if (direction === 'pull' && backup) {
      updateConfig((c) => ({ ...c, ...backup.layout, layoutUpdatedAt: backup.updatedAt, layoutSyncedTo: sheetId }));
    }
    pushLayout = direction === 'push';
  } else {
    const cfg = configRef.current;
    pushLayout = cfg.layoutUpdatedAt !== null && cfg.layoutSyncedTo !== sheetId;
  }

  // Before SheetSync writes anything, flag the sheet as changed since its last backup.
  const markChanged = async () => {
    if (configRef.current.sheetChanged === true) return;
    await SheetsService.setChangedSinceBackup(token, sheetId, true);
    updateConfig((c) => ({ ...c, sheetChanged: true }));
  };

  // Rename sheet tabs whose name changed (a new title, or an older two-word name) before
  // anything is written to them, so their rows stay with the category.
  const renames = configRef.current.categories.filter((c) => c.renameFrom && c.renameFrom !== c.sheetName);
  if (renames.length > 0) await markChanged();
  for (const c of renames) {
    try {
      await SheetsService.renameTab(token, sheetId, c.renameFrom!, c.sheetName);
    } catch (err) {
      if (err instanceof SheetsAuthError) throw err;
      // A tab with the new name already exists: keep both and write to the new one.
    }
  }
  if (configRef.current.categories.some((c) => c.renameFrom !== undefined)) {
    updateConfig((cfg) => ({
      ...cfg,
      categories: cfg.categories.map(({ renameFrom: _done, ...rest }) => rest),
    }));
  }

  if (pushLayout) {
    await markChanged();
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
    await markChanged();
    await SheetsService.pushEntries(token, sheetId, category, batch);
    const sent = new Map(batch.map((e) => [e.id, e.timestamp]));
    // An entry edited again while this was sending stays unsent.
    updateEntries((list) =>
      list.map((e) => (sent.get(e.id) === e.timestamp && e.categoryId === category.id ? { ...e, syncedTo: sheetId } : e))
    );
  }

  updateConfig((c) => ({ ...c, lastSyncedAt: new Date().toISOString() }));
}

/** Entries read from the sheet per page as a category's list scrolls. */
export const ENTRIES_PAGE_SIZE = 25;

/**
 * Load one page of a category's tab (newest rows first; see SheetsService.readPage) and merge
 * it into the device. Returns the `before` for the next, older page, or null at the top.
 */
export async function loadEntriesPage({
  token,
  sheetId,
  category,
  before,
  updateEntries,
  pageSize = ENTRIES_PAGE_SIZE,
}: {
  token: string;
  sheetId: string;
  category: CategoryDef;
  before: PageCursor | null;
  updateEntries: (fn: (e: Entry[]) => Entry[]) => void;
  pageSize?: number;
}): Promise<PageCursor | null> {
  const { rows, next } = await SheetsService.readPage(token, sheetId, category.sheetName, before, pageSize);
  const page = rowsToEntries(category, rows, sheetId);
  if (page.length > 0) updateEntries((local) => mergePage(local, page));
  return next;
}

import { AppConfig, Entry } from '../types';
import { DEFAULT_CATEGORIES } from '../config/categories';

export const SCHEMA_VERSION = 2;

export const INITIAL_CONFIG: AppConfig = {
  schemaVersion: SCHEMA_VERSION,
  appName: 'SheetSync',
  categories: DEFAULT_CATEGORIES,
  defaultCategoryId: 'mood',
  enableHaptics: true,
  spreadsheetId: null,
  spreadsheetName: null,
  lastSyncedAt: null,
  layoutUpdatedAt: null,
  layoutSyncedTo: null,
};

const STORAGE_KEYS = {
  CONFIG: 'sheetsync_config',
  ENTRIES: 'sheetsync_entries',
};

export class StorageService {
  static getConfig(): AppConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.categories)) {
          return { ...INITIAL_CONFIG, ...parsed };
        }
        // Config from the old life/health/prayer/habits layout: start from the new
        // categories but keep the connected spreadsheet and preferences.
        return {
          ...INITIAL_CONFIG,
          enableHaptics: parsed.enableHaptics ?? INITIAL_CONFIG.enableHaptics,
          spreadsheetId: parsed.spreadsheetId ?? null,
          spreadsheetName: parsed.spreadsheetName ?? null,
          lastSyncedAt: parsed.lastSyncedAt ?? null,
        };
      }
    } catch (e) {
      console.warn('Storage read failed', e);
    }
    return INITIAL_CONFIG;
  }

  static saveConfig(config: AppConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  }

  static getEntries(): Entry[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ENTRIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Storage read failed', e);
    }
    return [];
  }

  static saveEntries(entries: Entry[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  }
}

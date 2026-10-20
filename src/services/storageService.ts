import { AppConfig, Entry } from '../types';
import { DEFAULT_CATEGORIES } from '../config/categories';

export const SCHEMA_VERSION = 3;

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

// Built-in tab names before short labels and full titles were split (schema v2).
const V2_LABELS: Record<string, string> = {
  media: 'Media',
  food: 'Medicine & Food',
  memories: 'Memories',
  mood: 'Mood',
  recipes: 'Meals & Recipes',
  projects: 'Projects',
  people: 'People',
  presentations: 'Presentations & Writings',
  ideas: 'Prototypes & Ideas',
  prayer: 'Prayer',
};

const STORAGE_KEYS = {
  CONFIG: 'sheetsync_config',
  ENTRIES: 'sheetsync_entries',
};

/**
 * Bring categories saved under an older schema up to date. v2 -> v3: built-in
 * tabs still using their original names get the short label + full title;
 * renamed tabs, fields and sheet tabs are kept.
 */
export function upgradeCategories(categories: any[], fromVersion: number): any[] {
  if (fromVersion >= SCHEMA_VERSION) return categories;
  return categories.map((c: any) => {
    const def = DEFAULT_CATEGORIES.find((d) => d.id === c.id);
    if (!def || c.title || c.label !== V2_LABELS[c.id]) return c;
    return { ...c, label: def.label, title: def.title };
  });
}

export class StorageService {
  static getConfig(): AppConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.categories)) {
          return { ...INITIAL_CONFIG, ...parsed };
        }
        if (parsed.schemaVersion === 2 && Array.isArray(parsed.categories)) {
          const categories = upgradeCategories(parsed.categories, 2);
          return { ...INITIAL_CONFIG, ...parsed, categories, schemaVersion: SCHEMA_VERSION };
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

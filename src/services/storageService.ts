import { AppConfig, Entry } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_LISTS, withDefaultLists } from '../config/categories';

export const SCHEMA_VERSION = 7;

export const INITIAL_CONFIG: AppConfig = {
  schemaVersion: SCHEMA_VERSION,
  appName: 'SheetSync',
  categories: DEFAULT_CATEGORIES,
  lists: DEFAULT_LISTS,
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

// Built-in Google Sheet tab names before they became the first word of the title (schema v3).
const V3_SHEET_NAMES: Record<string, string> = {
  food: 'Medicine_Food',
  recipes: 'Meals_Recipes',
  presentations: 'Presentations_Writings',
  ideas: 'Prototypes_Ideas',
};

const STORAGE_KEYS = {
  CONFIG: 'sheetsync_config',
  ENTRIES: 'sheetsync_entries',
};

/**
 * Bring categories saved under an older schema up to date.
 * - v2 -> v3: built-in tabs still using their original names get the short label + full title.
 * - v3 -> v4: built-in sheet tabs still using their old two-word names (Medicine_Food, ...) get
 *   the first word (Medicine, ...); the old tab is renamed in the spreadsheet on the next sync.
 * - v4 -> v5: Media's default title becomes "Media & Music" and its Type choices gain "Album";
 *   Projects' default title becomes "Projects & Practice" (only where still the old defaults).
 * - v5 -> v6: People's and Prototypes' project pickers become dropdowns from the shared Projects list;
 *   Medicine & Food gets quick-pick buttons.
 * - v6 -> v7: Projects' Name and Type become dropdowns (Projects list, Project types list) that
 *   also take new items, when they're still plain text fields.
 * Renamed tabs and fields are kept.
 */
export function upgradeCategories(categories: any[], fromVersion: number): any[] {
  if (fromVersion >= SCHEMA_VERSION) return categories;
  return categories.map((c: any) => {
    const def = DEFAULT_CATEGORIES.find((d) => d.id === c.id);
    if (!def) return c;
    let next = c;
    if (fromVersion <= 2 && !c.title && c.label === V2_LABELS[c.id]) {
      next = { ...next, label: def.label, title: def.title };
    }
    if (fromVersion <= 3 && V3_SHEET_NAMES[c.id] && c.sheetName === V3_SHEET_NAMES[c.id]) {
      next = { ...next, sheetName: def.sheetName, renameFrom: next.renameFrom ?? c.sheetName };
    }
    if (fromVersion <= 6 && c.id === 'projects') {
      next = {
        ...next,
        fields: (next.fields || []).map((f: any) => {
          if (f.type !== 'text') return f;
          if (f.id === 'name') return { ...f, type: 'list', listId: 'projects', allowNew: true };
          if (f.id === 'type') return { ...f, type: 'list', listId: 'projectTypes', allowNew: true };
          return f;
        }),
      };
    }
    if (fromVersion <= 5 && c.id === 'food' && next.quickPicksEnabled === undefined) {
      next = { ...next, quickPicksEnabled: true, quickPicks: next.quickPicks ?? [] };
    }
    if (fromVersion <= 5 && (c.id === 'people' || c.id === 'ideas')) {
      next = {
        ...next,
        fields: (next.fields || []).map((f: any) =>
          f.type === 'relation' && f.relatedCategoryId === 'projects'
            ? (({ relatedCategoryId: _r, ...rest }) => ({ ...rest, type: 'list', listId: 'projects', multiple: true }))(f)
            : f
        ),
      };
    }
    if (fromVersion <= 4 && c.id === 'projects' && next.title === 'Projects & Initiatives') {
      next = { ...next, title: def.title };
    }
    if (fromVersion <= 4 && c.id === 'media') {
      if (next.title === 'Media & Books') next = { ...next, title: def.title };
      next = {
        ...next,
        fields: (next.fields || []).map((f: any) =>
          f.id === 'type' && f.type === 'select' && JSON.stringify(f.options) === JSON.stringify(['Book', 'Movie', 'TV', 'Game'])
            ? { ...f, options: [...f.options, 'Album'] }
            : f
        ),
      };
    }
    return next;
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
        if ([2, 3, 4, 5, 6].includes(parsed.schemaVersion) && Array.isArray(parsed.categories)) {
          const categories = upgradeCategories(parsed.categories, parsed.schemaVersion);
          return { ...INITIAL_CONFIG, ...parsed, categories, lists: withDefaultLists(parsed.lists), schemaVersion: SCHEMA_VERSION };
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

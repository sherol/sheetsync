export type FieldType =
  | 'text'
  | 'notes'
  | 'number'
  | 'rating'
  | 'select'
  | 'date'
  | 'time'
  | 'links'
  | 'relation';

export interface CustomField {
  id: string;
  label: string;
  type: FieldType;
  options?: string[]; // for select
  unit?: string; // for number, e.g. "mg", "cups"
  placeholder?: string;
  min?: number; // for rating
  max?: number; // for rating
  relatedCategoryId?: string; // for relation: pick entries from this category by their title field
  required?: boolean;
  showInQuickLog?: boolean;
}

/** Key into the icon library (see components/CategoryIcon). */
export type CategoryIcon = string;

export interface BibleTrackerDef {
  bookFieldId: string; // select field whose options are Bible book names
  chaptersFieldId: string; // text field such as "1-3, 5"
}

export interface CategoryDef {
  id: string;
  label: string;
  sheetName: string; // Google Sheet tab name
  icon: CategoryIcon;
  color: string; // hex accent
  titleFieldId?: string; // field that names an entry in lists and relation pickers
  dateFieldId?: string; // field that dates an entry for sorting and monthly reports
  bibleTracker?: BibleTrackerDef; // show Bible study progress for this category
  fields: CustomField[];
}

export interface Entry {
  id: string;
  categoryId: string;
  timestamp: string; // ISO string, last saved
  values: Record<string, any>;
}

export interface AppConfig {
  schemaVersion: number;
  appName: string;
  categories: CategoryDef[];
  defaultCategoryId: string;
  enableHaptics: boolean;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  lastSyncedAt: string | null;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  message?: string;
  pendingCount: number;
}

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
  label: string; // short name used on tabs and in lists
  title?: string; // full title, e.g. "Media & Music"
  sheetName: string; // Google Sheet tab name: the first word of the title
  renameFrom?: string; // previous sheet tab name, renamed in the spreadsheet on the next sync
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
  syncedTo?: string; // spreadsheet ID this version was written to; unset = not sent yet
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
  layoutUpdatedAt: string | null; // when categories or home order last changed on this device
  layoutSyncedTo: string | null; // spreadsheet ID the current layout was backed up to
  sheetChanged?: boolean; // this device's view of the sheet's changed-since-backup flag
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  message?: string;
  pendingCount: number;
}

export type FieldType =
  | 'text'
  | 'notes'
  | 'number'
  | 'rating'
  | 'select'
  | 'date'
  | 'time'
  | 'links'
  | 'relation'
  | 'list';

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
  listId?: string; // for list: the shared list (AppConfig.lists) to pick from
  multiple?: boolean; // for list: allow several picks, stored comma-separated
  allowNew?: boolean; // for list: offer "New …" to type an item that isn't in the list yet (it's added)
  required?: boolean;
  showInQuickLog?: boolean;
}

/** Key into the icon library (see components/CategoryIcon). */
export type CategoryIcon = string;

export interface BibleTrackerDef {
  bookFieldId: string; // select field whose options are Bible book names
  chaptersFieldId: string; // text field such as "1-3, 5"
}

/** A saved set of field values, one tap to fill a form (e.g. "Vitamin D · 1000 IU"). */
export interface QuickPick {
  id: string;
  label: string;
  values: Record<string, any>;
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
  quickPicksEnabled?: boolean; // show quick-pick buttons on this tab's form
  quickPicks?: QuickPick[];
  fields: CustomField[];
}

export interface Entry {
  id: string;
  categoryId: string;
  timestamp: string; // ISO string, last saved
  values: Record<string, any>;
  syncedTo?: string; // spreadsheet ID this version was written to; unset = not sent yet
}

/** A named list of choices shared by fields (e.g. Projects), editable from the app and synced with the layout. */
export interface ListDef {
  id: string;
  label: string;
  items: string[];
  /** Entries saved in this category add their value to the list... */
  fromCategoryId?: string;
  /** ...from this field (default: the category's title field). */
  fromFieldId?: string;
}

export interface AppConfig {
  schemaVersion: number;
  appName: string;
  categories: CategoryDef[];
  lists: ListDef[];
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from './services/auth';
import { StorageService, INITIAL_CONFIG, SCHEMA_VERSION } from './services/storageService';
import { DEFAULT_CATEGORIES } from './config/categories';
import { SheetsService } from './services/sheetsService';
import { AppConfig, Entry, CategoryDef, CustomField, QuickPick } from './types';
import { useSheetSync } from './hooks/useSheetSync';
import { isUnsent, parseLayoutBackup } from './services/syncLogic';
import { layoutJson } from './services/syncEngine';
import { Navbar, AppViewMode } from './components/Navbar';
import { DesktopStudio } from './components/DesktopStudio';
import { MobileView } from './components/MobileView';
import { MonthlyReportView } from './components/MonthlyReportView';
import { SpreadsheetModal } from './components/SpreadsheetModal';
import { DestructiveConfirmModal } from './components/DestructiveConfirmModal';
import { Smartphone, Eye, EyeOff } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Auto-detect initial view: Desktop (>=1024px) -> Schema Editor, Mobile/iPad (<1024px) -> Mobile App
  const [currentView, setCurrentView] = useState<AppViewMode>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return 'schema-editor';
    }
    return 'mobile-app';
  });

  // Optional side-by-side preview on desktop
  const [showDesktopMobilePreview, setShowDesktopMobilePreview] = useState(false);

  // App Configuration. Every change goes through updateConfig so the ref (read by the background
  // sync) is always current and the device copy is saved.
  const [config, setConfig] = useState<AppConfig>(() => StorageService.getConfig());
  const configRef = useRef(config);
  const updateConfig = useCallback((fn: (c: AppConfig) => AppConfig) => {
    const next = fn(configRef.current);
    if (next === configRef.current) return;
    configRef.current = next;
    setConfig(next);
    StorageService.saveConfig(next);
  }, []);

  // Logged entries for every category, updated the same way
  const [entries, setEntries] = useState<Entry[]>(() => StorageService.getEntries());
  const entriesRef = useRef(entries);
  const updateEntries = useCallback((fn: (e: Entry[]) => Entry[]) => {
    const next = fn(entriesRef.current);
    if (next === entriesRef.current) return;
    entriesRef.current = next;
    setEntries(next);
    StorageService.saveEntries(next);
  }, []);

  // Sync with the Google Sheet: shared layout + sending unsent entries
  const { status: sync, sync: runSync } = useSheetSync({ accessToken, configRef, updateConfig, entriesRef, updateEntries });
  const pendingCount = entries.filter((e) => isUnsent(e, config.spreadsheetId)).length;
  const syncStatus = { ...sync, pendingCount };
  const [isSyncingReport, setIsSyncingReport] = useState(false);

  // Modals
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);

  // Destructive Confirmation Dialog State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionText: 'Delete',
    onConfirm: () => {},
  });

  // Initialize auth listener safely
  useEffect(() => {
    try {
      const unsubscribe = initAuth(
        (authUser, token) => {
          setUser(authUser);
          setAccessToken(token);
        },
        () => {
          setUser(null);
          setAccessToken(null);
        },
        // Token expired: stay signed in to Firebase so the header offers a one-tap reconnect.
        () => setAccessToken(null)
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn('Auth init failed:', e);
    }
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
      }
    } catch (err) {
      console.error('Sign-in error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  // Update Config (from the studio and the spreadsheet dialog)
  const handleUpdateConfig = (newConfig: AppConfig) => {
    updateConfig((prev) => {
      const layoutChanged =
        newConfig.categories !== prev.categories ||
        newConfig.lists !== prev.lists ||
        newConfig.defaultCategoryId !== prev.defaultCategoryId;
      // Sync bookkeeping always comes from the latest config, not the caller's copy.
      const synced = { lastSyncedAt: prev.lastSyncedAt, layoutUpdatedAt: prev.layoutUpdatedAt, layoutSyncedTo: prev.layoutSyncedTo };
      return layoutChanged
        ? { ...newConfig, ...synced, layoutUpdatedAt: new Date().toISOString(), layoutSyncedTo: null }
        : { ...newConfig, ...synced };
    });
  };

  // Back up layout changes to the sheet a moment after the last edit.
  useEffect(() => {
    if (!config.layoutUpdatedAt || config.layoutSyncedTo === config.spreadsheetId) return;
    const t = setTimeout(() => void runSync(false), 2000);
    return () => clearTimeout(t);
  }, [config.layoutUpdatedAt, config.layoutSyncedTo, config.spreadsheetId, runSync]);

  // Connect / Select Spreadsheet (a full sync follows automatically)
  const handleUpdateSpreadsheet = (sheetId: string, sheetName: string) => {
    updateConfig((c) => ({ ...c, spreadsheetId: sheetId, spreadsheetName: sheetName }));
  };

  const backupStamp = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}`;
  };

  /**
   * Copy the connected spreadsheet into Drive's backup/ folder, named with a timestamp first, unless
   * SheetSync hasn't changed it since its last backup. Returns the backup's name, or null if skipped.
   */
  const backupIfChanged = async (token: string, sheetId: string, sheetName: string): Promise<string | null> => {
    const changed = await SheetsService.getChangedSinceBackup(token, sheetId);
    if (changed === false) return null;
    const backup = await SheetsService.backupSpreadsheet(token, sheetId, `${backupStamp()} ${sheetName}`);
    return backup.name;
  };

  /** An error from a step after the backup, saying where the backup is. */
  const afterBackupError = (what: string, backupName: string | null, err: any) =>
    new Error(
      `${what} stopped partway: ${err?.message || err}. ` +
        (backupName
          ? `Your spreadsheet was backed up first as "backup/${backupName}"; load it from Backups to restore it.`
          : 'Load your latest backup from Backups to restore it.')
    );

  /**
   * After a reset or restore: save the layout to the sheet, mark the sheet unchanged since its
   * backup, and point this device at it with an empty entry list.
   */
  const adoptSheetState = async (token: string, sheetId: string, sheetName: string, layout: Partial<AppConfig>) => {
    const now = new Date().toISOString();
    const next: AppConfig = {
      ...configRef.current,
      ...layout,
      spreadsheetId: sheetId,
      spreadsheetName: sheetName,
      layoutUpdatedAt: now,
    };
    await SheetsService.saveLayout(token, sheetId, layoutJson(next), now);
    await SheetsService.setChangedSinceBackup(token, sheetId, false);
    updateEntries(() => []);
    updateConfig(() => ({ ...next, layoutSyncedTo: sheetId, sheetChanged: false, lastSyncedAt: now }));
  };

  /**
   * Reset Sheet. With a spreadsheet connected: back it up (unless unchanged since the last backup),
   * then clear and rebuild the same file, so every device stays connected to it. With none
   * connected: create the SheetSync spreadsheet. If the backup fails, nothing changes.
   */
  const handleResetSpreadsheet = async ({ keepLayout }: { keepLayout: boolean }): Promise<string> => {
    const token = accessToken;
    if (!token) throw new Error('Sign in with Google first.');
    const current = configRef.current;
    const categories = (keepLayout ? current.categories : DEFAULT_CATEGORIES).map(({ renameFrom: _old, ...c }) => c);
    const layout: Partial<AppConfig> = keepLayout
      ? { categories }
      : { categories, lists: INITIAL_CONFIG.lists, defaultCategoryId: INITIAL_CONFIG.defaultCategoryId };

    if (!current.spreadsheetId) {
      const created = await SheetsService.createMasterSpreadsheet(token, categories, 'SheetSync');
      await adoptSheetState(token, created.id, created.name, layout);
      return `Created and connected "${created.name}".`;
    }

    const sheetId = current.spreadsheetId;
    const sheetName = current.spreadsheetName || 'SheetSync';
    const backupName = await backupIfChanged(token, sheetId, sheetName);
    try {
      await SheetsService.rebuildSpreadsheet(token, sheetId, categories);
      await adoptSheetState(token, sheetId, sheetName, layout);
    } catch (err: any) {
      throw afterBackupError('Reset', backupName, err);
    }
    return backupName
      ? `Backed up to "backup/${backupName}" in Google Drive and reset "${sheetName}".`
      : `Reset "${sheetName}". No backup was needed: nothing had changed since the last one.`;
  };

  /**
   * Load a backup into the SheetSync spreadsheet (same file), after backing up the current
   * contents unless they're unchanged. Takes the backup's layout if it has one.
   */
  const handleLoadBackup = async (backup: { id: string; name: string }): Promise<string> => {
    const token = accessToken;
    const current = configRef.current;
    if (!token || !current.spreadsheetId) throw new Error('Sign in and connect your SheetSync spreadsheet first.');
    const sheetId = current.spreadsheetId;
    const sheetName = current.spreadsheetName || 'SheetSync';

    const backupName = await backupIfChanged(token, sheetId, sheetName);
    try {
      await SheetsService.restoreFromBackup(token, sheetId, backup.id);
      const tabs = await SheetsService.readTabs(token, sheetId, ['App_Config']);
      const restored = parseLayoutBackup(tabs['App_Config'] ?? [], SCHEMA_VERSION);
      await adoptSheetState(token, sheetId, sheetName, restored ? restored.layout : {});
    } catch (err: any) {
      throw afterBackupError('Loading the backup', backupName, err);
    }
    return `${backupName ? `Backed up the current sheet to "backup/${backupName}", then loaded` : 'Loaded'} "${backup.name}" into "${sheetName}".`;
  };

  // "Save Layout to Sheet": back up the layout now
  const handleSaveSchemaToSheet = async () => {
    if (!accessToken || !config.spreadsheetId) {
      setIsSpreadsheetModalOpen(true);
      return;
    }
    updateConfig((c) => ({ ...c, layoutUpdatedAt: c.layoutUpdatedAt ?? new Date().toISOString(), layoutSyncedTo: null }));
    await runSync(false);
  };

  // Header sync button: sign in if needed, otherwise sync now
  const handleTriggerSync = () => {
    if (!accessToken) void handleLogin();
    else if (!config.spreadsheetId) setIsSpreadsheetModalOpen(true);
    else void runSync(true);
  };

  // Save (or update) an entry in any category; it's sent to the sheet when connected
  const handleSaveEntry = async (categoryId: string, values: Record<string, any>, existingId?: string) => {
    const category = config.categories.find((c) => c.id === categoryId);
    if (!category) return;

    const entry: Entry = {
      id: existingId ?? `${categoryId}_${Date.now()}`,
      categoryId,
      timestamp: new Date().toISOString(),
      values,
    };

    updateEntries((list) => (existingId ? list.map((e) => (e.id === existingId ? entry : e)) : [entry, ...list]));
    // Saving a project adds its name and type to the shared lists that follow them.
    const lists = configRef.current.lists.map((l) => {
      if (l.fromCategoryId !== categoryId) return l;
      const fieldId = l.fromFieldId ?? category.titleFieldId;
      const value = String((fieldId && values[fieldId]) ?? '').trim();
      return value && !l.items.some((i) => i.toLowerCase() === value.toLowerCase()) ? { ...l, items: [...l.items, value] } : l;
    });
    if (lists.some((l, i) => l !== configRef.current.lists[i])) handleUpdateConfig({ ...configRef.current, lists });
    void runSync(false);
  };

  // Save a tab's quick-pick buttons (synced with the layout)
  const handleUpdateQuickPicks = (categoryId: string, quickPicks: QuickPick[]) => {
    handleUpdateConfig({
      ...configRef.current,
      categories: configRef.current.categories.map((c) => (c.id === categoryId ? { ...c, quickPicks } : c)),
    });
  };

  // Edit a shared list (e.g. Projects) from a form's dropdown
  const handleUpdateList = (listId: string, items: string[]) => {
    handleUpdateConfig({
      ...configRef.current,
      lists: configRef.current.lists.map((l) => (l.id === listId ? { ...l, items } : l)),
    });
  };

  // Seed shared lists from entries already on this device (e.g. projects logged before lists existed).
  useEffect(() => {
    const cfg = configRef.current;
    const lists = cfg.lists.map((l) => {
      const source = cfg.categories.find((c) => c.id === l.fromCategoryId);
      const fieldId = l.fromFieldId ?? source?.titleFieldId;
      if (!source || !fieldId) return l;
      const names = entriesRef.current
        .filter((e) => e.categoryId === source.id)
        .map((e) => String(e.values[fieldId] ?? '').trim())
        .filter(Boolean);
      const missing = [...new Set(names)].filter((n) => !l.items.some((i) => i.toLowerCase() === n.toLowerCase()));
      return missing.length ? { ...l, items: [...l.items, ...missing] } : l;
    });
    if (lists.some((l, i) => l !== cfg.lists[i])) handleUpdateConfig({ ...cfg, lists });
    // Once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save a monthly report row
  const handleSyncMonthlyReport = async (row: (string | number)[]) => {
    if (!accessToken || !config.spreadsheetId) {
      setIsSpreadsheetModalOpen(true);
      throw new Error('No spreadsheet connected');
    }
    setIsSyncingReport(true);
    try {
      await SheetsService.ensureTabsExist(accessToken, config.spreadsheetId, config.categories);
      await SheetsService.appendMonthlyReport(accessToken, config.spreadsheetId, row);
    } finally {
      setIsSyncingReport(false);
    }
  };

  // Destructive Confirmation: Delete Category
  const requestDeleteCategory = (category: CategoryDef) => {
    if (config.categories.length <= 1) return;
    const count = entries.filter((e) => e.categoryId === category.id).length;
    setConfirmModalState({
      isOpen: true,
      title: `Delete the "${category.label}" tab?`,
      description: `It will be removed from the app${count ? ` along with its ${count} saved entr${count === 1 ? 'y' : 'ies'} on this device` : ''}. The ${category.sheetName} tab in your Google Sheet is not touched, so anything already synced stays there.`,
      actionText: 'Delete Tab',
      onConfirm: () => {
        updateEntries((list) => list.filter((e) => e.categoryId !== category.id));
        handleUpdateConfig({
          ...config,
          categories: config.categories.filter((c) => c.id !== category.id),
        });
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Destructive Confirmation: Delete Custom Field
  const requestDeleteField = (category: CategoryDef, field: CustomField) => {
    setConfirmModalState({
      isOpen: true,
      title: `Delete field "${field.label}" from ${category.label}?`,
      description: `It will disappear from the form and from the header row of the ${category.sheetName} tab the next time an entry is saved. Values already in the sheet are not deleted, but older rows keep their original column positions.`,
      actionText: 'Delete Field',
      onConfirm: () => {
        handleUpdateConfig({
          ...config,
          categories: config.categories.map((c) =>
            c.id === category.id ? { ...c, fields: c.fields.filter((f) => f.id !== field.id) } : c
          ),
        });
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0c0d14] text-stone-100 flex flex-col font-sans">
      
      {/* Top Navigation Bar */}
      <Navbar
        user={user}
        config={config}
        syncStatus={syncStatus}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLoginClick={handleLogin}
        onLogoutClick={handleLogout}
        onOpenSpreadsheetModal={() => setIsSpreadsheetModalOpen(true)}
        isLoggingIn={isLoggingIn}
        isConnected={!!accessToken}
        onTriggerSync={handleTriggerSync}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col">
        
        {/* VIEW 1: DESKTOP SCHEMA EDITOR (Full width AppSheet Studio for Desktop) */}
        {currentView === 'schema-editor' && (
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Desktop Toolbar with Optional Mobile Preview Toggle */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h1 className="text-base font-extrabold text-white tracking-wide">
                  Category Studio
                </h1>
                <p className="text-xs text-stone-400">
                  Customize the fields in each category and how they map to your Google Sheet.
                </p>
              </div>

              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={() => setShowDesktopMobilePreview(!showDesktopMobilePreview)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                    showDesktopMobilePreview
                      ? 'bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 border-pink-500/40 text-pink-300 shadow-md shadow-pink-500/10'
                      : 'bg-[#141622] border-stone-800 text-stone-300 hover:text-white hover:border-stone-700'
                  }`}
                >
                  {showDesktopMobilePreview ? <EyeOff className="w-3.5 h-3.5 text-pink-400" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{showDesktopMobilePreview ? 'Hide Phone Preview' : 'Side-by-Side Phone Preview'}</span>
                </button>
              </div>
            </div>

            {/* Layout: Full width or split if preview is opened */}
            <div className={`flex-1 grid gap-6 ${showDesktopMobilePreview ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
              
              <div className={showDesktopMobilePreview ? 'lg:col-span-7' : 'w-full'}>
                <DesktopStudio
                  config={config}
                  onUpdateConfig={handleUpdateConfig}
                  onSaveToSheet={handleSaveSchemaToSheet}
                  isSavingToSheet={sync.state === 'syncing'}
                  onRequestDeleteField={requestDeleteField}
                  onRequestDeleteCategory={requestDeleteCategory}
                />
              </div>

              {showDesktopMobilePreview && (
                <div className="lg:col-span-5 flex flex-col items-center">
                  <div className="w-full max-w-[380px] h-[720px] bg-stone-900 rounded-[44px] p-3 shadow-2xl border-4 border-stone-800 relative flex flex-col ring-1 ring-stone-700/50">
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-end px-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-stone-800" />
                    </div>
                    <div className="w-full h-full rounded-[34px] overflow-hidden bg-white dark:bg-stone-950 flex flex-col">
                      <MobileView
                        config={config}
                        entries={entries}
                        onSaveEntry={handleSaveEntry}
              onUpdateList={handleUpdateList}
              onUpdateQuickPicks={handleUpdateQuickPicks}
                        isSyncing={syncStatus.state === 'syncing'}
                        isInDesktopFrame={true}
                      />
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-stone-700 rounded-full pointer-events-none" />
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* VIEW 2: THE MOBILE & IPAD / TABLET APP ITSELF */}
        {currentView === 'mobile-app' && (
          <div className="flex-1 flex justify-center py-1 sm:py-3">
            <MobileView
              config={config}
              entries={entries}
              onSaveEntry={handleSaveEntry}
              onUpdateList={handleUpdateList}
              onUpdateQuickPicks={handleUpdateQuickPicks}
              isSyncing={syncStatus.state === 'syncing'}
              isInDesktopFrame={false}
            />
          </div>
        )}

        {/* VIEW 3: AUTOMATED MONTHLY REPORTS */}
        {currentView === 'reports' && (
          <div className="flex-1">
            <MonthlyReportView
              config={config}
              entries={entries}
              onSyncReportToSheet={handleSyncMonthlyReport}
              isSyncingReport={isSyncingReport}
            />
          </div>
        )}

      </main>

      {/* Spreadsheet Connection & Creation Modal */}
      <SpreadsheetModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        config={config}
        onUpdateSpreadsheet={handleUpdateSpreadsheet}
        onResetSpreadsheet={handleResetSpreadsheet}
        onLoadBackup={handleLoadBackup}
        entryCount={entries.length}
        accessToken={accessToken}
        onLoginClick={handleLogin}
      />

      {/* Destructive Action Confirmation Modal */}
      <DestructiveConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        description={confirmModalState.description}
        actionButtonText={confirmModalState.actionText}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}

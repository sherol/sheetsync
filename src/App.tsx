/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  setAccessTokenManually 
} from './services/auth';
import { StorageService } from './services/storageService';
import { SheetsService } from './services/sheetsService';
import { AppConfig, SyncStatus, Entry, CategoryDef, CustomField } from './types';
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

  // App Configuration
  const [config, setConfig] = useState<AppConfig>(() => StorageService.getConfig());

  // Logged entries for every category
  const [entries, setEntries] = useState<Entry[]>(() => StorageService.getEntries());

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    pendingCount: 0,
  });
  const [isSavingToSheet, setIsSavingToSheet] = useState(false);
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
        }
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
        setAccessTokenManually(res.accessToken);
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

  // Update Config
  const handleUpdateConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    StorageService.saveConfig(newConfig);
  };

  // Connect / Select Spreadsheet
  const handleUpdateSpreadsheet = (sheetId: string, sheetName: string) => {
    const updated = {
      ...config,
      spreadsheetId: sheetId,
      spreadsheetName: sheetName,
      lastSyncedAt: new Date().toISOString(),
    };
    handleUpdateConfig(updated);
  };

  // Save Schema Config to Google Sheet
  const handleSaveSchemaToSheet = async () => {
    if (!accessToken || !config.spreadsheetId) {
      setIsSpreadsheetModalOpen(true);
      return;
    }
    setIsSavingToSheet(true);
    try {
      await SheetsService.saveAppConfigToSheet(
        accessToken,
        config.spreadsheetId,
        JSON.stringify(config)
      );
      setSyncStatus({ state: 'synced', pendingCount: 0, message: 'Schema synced to Google Sheet!' });
      setTimeout(() => setSyncStatus({ state: 'idle', pendingCount: 0 }), 3000);
    } catch (err: any) {
      setSyncStatus({ state: 'error', pendingCount: 0, message: err.message });
    } finally {
      setIsSavingToSheet(false);
    }
  };

  // Save (or update) an entry in any category
  const handleSaveEntry = async (categoryId: string, values: Record<string, any>, existingId?: string) => {
    const category = config.categories.find((c) => c.id === categoryId);
    if (!category) return;

    const entry: Entry = {
      id: existingId ?? `${categoryId}_${Date.now()}`,
      categoryId,
      timestamp: new Date().toISOString(),
      values,
    };

    const updated = existingId
      ? entries.map((e) => (e.id === existingId ? entry : e))
      : [entry, ...entries];
    setEntries(updated);
    StorageService.saveEntries(updated);

    if (accessToken && config.spreadsheetId) {
      setSyncStatus({ state: 'syncing', pendingCount: 1 });
      try {
        await SheetsService.upsertEntry(accessToken, config.spreadsheetId, category, entry);
        setSyncStatus({ state: 'synced', pendingCount: 0 });
        setTimeout(() => setSyncStatus({ state: 'idle', pendingCount: 0 }), 2500);
      } catch (err: any) {
        setSyncStatus({ state: 'error', pendingCount: 1, message: err.message });
      }
    }
  };

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
                  isSavingToSheet={isSavingToSheet}
                  onRequestDeleteField={requestDeleteField}
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

import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Plus, 
  ExternalLink, 
  Check, 
  RefreshCw, 
  AlertCircle,
  FileText,
  RotateCcw
} from 'lucide-react';
import { SheetsService } from '../services/sheetsService';
import { AppConfig } from '../types';

interface SpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onUpdateSpreadsheet: (sheetId: string, sheetName: string) => void;
  accessToken: string | null;
  onLoginClick: () => void;
  /** Back up the connected sheet into Drive's backup/ folder and start a new one. Resolves with a summary. */
  onResetSpreadsheet: (opts: { keepLayout: boolean; title: string }) => Promise<string>;
  entryCount: number;
}

export const SpreadsheetModal: React.FC<SpreadsheetModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateSpreadsheet,
  accessToken,
  onLoginClick,
  onResetSpreadsheet,
  entryCount,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'drive' | 'manual' | 'reset'>('create');
  const [keepLayout, setKeepLayout] = useState(true);
  const [resetTitle, setResetTitle] = useState('');
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!accessToken || !config.spreadsheetId || !resetConfirmed) return;
    setIsResetting(true);
    setStatusMessage(null);
    try {
      const text = await onResetSpreadsheet({
        keepLayout,
        title: resetTitle.trim() || config.spreadsheetName || 'SheetSync - Personal Tracker',
      });
      setStatusMessage({ type: 'success', text });
      setResetConfirmed(false);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Reset failed. Nothing was changed.' });
    } finally {
      setIsResetting(false);
    }
  };
  const [newTitle, setNewTitle] = useState('SheetSync - Personal Tracker');
  const [manualInput, setManualInput] = useState('');
  const [driveSheets, setDriveSheets] = useState<Array<{ id: string; name: string; modifiedTime: string }>>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && accessToken && activeTab === 'drive') {
      loadDriveFiles();
    }
  }, [isOpen, accessToken, activeTab]);

  const loadDriveFiles = async () => {
    if (!accessToken) return;
    setIsLoadingDrive(true);
    setStatusMessage(null);
    try {
      const files = await SheetsService.listUserSpreadsheets(accessToken);
      setDriveSheets(files);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Could not load spreadsheets from Drive' });
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleCreateNew = async () => {
    if (!accessToken) {
      setStatusMessage({ type: 'error', text: 'Please sign in with Google first to create a spreadsheet.' });
      return;
    }
    setIsCreating(true);
    setStatusMessage(null);
    try {
      const res = await SheetsService.createMasterSpreadsheet(accessToken, config.categories, newTitle || 'SheetSync - Personal Tracker');
      onUpdateSpreadsheet(res.id, res.name);
      setStatusMessage({ type: 'success', text: `Created and linked "${res.name}"!` });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create spreadsheet' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectDriveSheet = async (sheet: { id: string; name: string }) => {
    if (!accessToken) return;
    setIsCreating(true);
    setStatusMessage(null);
    try {
      await SheetsService.ensureTabsExist(accessToken, sheet.id, config.categories);
      onUpdateSpreadsheet(sheet.id, sheet.name);
      setStatusMessage({ type: 'success', text: `Connected to "${sheet.name}" and ensured tabs!` });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to connect sheet' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleManualConnect = async () => {
    if (!manualInput.trim()) return;
    let id = manualInput.trim();
    const urlMatch = manualInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      id = urlMatch[1];
    }

    if (!accessToken) {
      onUpdateSpreadsheet(id, 'Custom Linked Sheet');
      onClose();
      return;
    }

    setIsCreating(true);
    try {
      const details = await SheetsService.getSpreadsheet(accessToken, id);
      await SheetsService.ensureTabsExist(accessToken, id, config.categories);
      const title = details.properties?.title || 'Google Sheet';
      onUpdateSpreadsheet(id, title);
      setStatusMessage({ type: 'success', text: `Linked "${title}" successfully!` });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Spreadsheet ID invalid or not accessible. Make sure you have permission.' });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div 
        className="w-full max-w-xl bg-[#12141f] border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col max-h-[90vh] relative overflow-hidden"
        role="dialog"
      >
        <div className="absolute top-0 left-0 right-0 h-1 rainbow-bar" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl rainbow-bg flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Google Sheets Connection</h2>
              <p className="text-xs text-stone-400">
                Link or create a Google Spreadsheet to store your mobile logs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Linked Sheet Status */}
        {config.spreadsheetId && (
          <div className="mt-4 p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
              <div className="truncate">
                <span className="text-[11px] text-stone-400 block">Currently Active Sheet:</span>
                <span className="text-xs font-bold text-cyan-300 truncate block">
                  {config.spreadsheetName || config.spreadsheetId}
                </span>
              </div>
            </div>
            <a
              href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 rounded-xl transition-colors shrink-0"
            >
              <span>Open in Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Status notice */}
        {statusMessage && (
          <div className={`mt-3 p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30' 
              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
          }`}>
            {statusMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Auth prompt if not logged in */}
        {!accessToken && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-300">Google Account Required</p>
              <p className="text-xs text-amber-400/80">Sign in to read and create spreadsheets in your Google Drive.</p>
            </div>
            <button
              onClick={onLoginClick}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-white text-xs font-bold shadow-md shrink-0"
            >
              Sign In with Google
            </button>
          </div>
        )}

        {/* Tab Selection */}
        <div className="mt-4 flex border-b border-stone-800 text-xs font-semibold gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3.5 border-b-2 transition-all ${
              activeTab === 'create'
                ? 'border-pink-500 text-pink-300 font-extrabold'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Create New Sheet
          </button>
          <button
            onClick={() => setActiveTab('drive')}
            className={`pb-2.5 px-3.5 border-b-2 transition-all ${
              activeTab === 'drive'
                ? 'border-cyan-500 text-cyan-300 font-extrabold'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Choose from Drive
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-2.5 px-3.5 border-b-2 transition-all ${
              activeTab === 'manual'
                ? 'border-purple-500 text-purple-300 font-extrabold'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Enter ID / URL
          </button>
          {config.spreadsheetId && (
            <button
              onClick={() => setActiveTab('reset')}
              className={`pb-2.5 px-3.5 border-b-2 transition-all ${
                activeTab === 'reset'
                  ? 'border-rose-500 text-rose-300 font-extrabold'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              Reset Sheet
            </button>
          )}
        </div>

        {/* Content per Tab */}
        <div className="mt-4 flex-1 overflow-y-auto">
          {activeTab === 'reset' && config.spreadsheetId && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#171926] border border-stone-800 text-xs text-stone-300 space-y-2">
                <span className="font-bold text-white block">Reset starts a fresh spreadsheet:</span>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    A copy of <span className="font-semibold text-white">{config.spreadsheetName || 'the current sheet'}</span> is
                    saved to the <span className="font-mono text-white">backup</span> folder in your Google Drive. The original
                    stays where it is.
                  </li>
                  <li>A new, empty spreadsheet is created and connected.</li>
                  <li>
                    This device's list of {entryCount} entr{entryCount === 1 ? 'y' : 'ies'} is cleared, so nothing old is sent to the
                    new sheet. Everything is still in the backup.
                  </li>
                </ol>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-stone-300 mb-1">Tabs and fields for the new sheet</legend>
                {[
                  { value: true, title: 'Keep the current schema', body: 'Same tabs, names, icons and fields you have now.' },
                  { value: false, title: 'Start with a new schema', body: 'The default ten tabs and fields. You can customise them afterwards.' },
                ].map((o) => (
                  <label
                    key={String(o.value)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      keepLayout === o.value ? 'border-rose-500/50 bg-rose-950/20' : 'border-stone-800 bg-stone-900/60 hover:border-stone-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reset-schema"
                      checked={keepLayout === o.value}
                      onChange={() => setKeepLayout(o.value)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-xs font-bold text-white">{o.title}</span>
                      <span className="block text-[11px] text-stone-400">{o.body}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div>
                <label htmlFor="reset-title" className="block text-xs font-medium text-stone-300 mb-1">
                  New spreadsheet title
                </label>
                <input
                  id="reset-title"
                  type="text"
                  value={resetTitle}
                  placeholder={config.spreadsheetName || 'SheetSync - Personal Tracker'}
                  onChange={(e) => setResetTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                <input type="checkbox" checked={resetConfirmed} onChange={(e) => setResetConfirmed(e.target.checked)} />
                <span>I understand this device starts with an empty entry list.</span>
              </label>

              <button
                type="button"
                onClick={handleReset}
                disabled={!accessToken || !resetConfirmed || isResetting}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-95 disabled:opacity-40 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {isResetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>{isResetting ? 'Backing up and resetting…' : 'Back up and reset'}</span>
              </button>
              {!accessToken && <p className="text-[11px] text-amber-400">Sign in with Google first.</p>}
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Spreadsheet Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. SheetSync - Personal Tracker"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#171926] border border-stone-800 text-xs text-stone-300 space-y-2">
                <span className="font-bold text-white block">
                  SheetSync will automatically initialize:
                </span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[...config.categories.map((c) => ({ name: c.sheetName, color: c.color })),
                    { name: 'Monthly_Reports', color: '#a8a29e' },
                    { name: 'App_Config', color: '#a8a29e' },
                  ].map((t) => (
                    <span key={t.name} className="flex items-center gap-1.5" style={{ color: t.color }}>
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> {t.name}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateNew}
                disabled={isCreating}
                className="w-full py-3 px-4 rounded-2xl rainbow-bg hover:opacity-95 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 transition-all active:scale-[0.99]"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Spreadsheet in Drive...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create & Connect Spreadsheet</span>
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'drive' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Recent Spreadsheets in your Drive:</span>
                <button
                  onClick={loadDriveFiles}
                  disabled={isLoadingDrive}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingDrive ? (
                <div className="py-8 text-center text-xs text-stone-400">Loading spreadsheets from Drive...</div>
              ) : driveSheets.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  No spreadsheets found. You can create a new one using the "Create New Sheet" tab.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {driveSheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="p-3 rounded-2xl border border-stone-800 hover:border-cyan-500/50 bg-[#161824] flex items-center justify-between transition-colors cursor-pointer group"
                      onClick={() => handleSelectDriveSheet(sheet)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate group-hover:text-cyan-300">
                            {sheet.name}
                          </p>
                          <span className="text-[10px] text-stone-500">
                            Modified: {new Date(sheet.modifiedTime).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button className="px-3 py-1.5 text-xs rounded-xl bg-cyan-500/20 text-cyan-300 font-bold group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Google Sheet URL or Spreadsheet ID
                </label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <p className="text-xs text-stone-400 leading-relaxed">
                Make sure your Google account has editor permissions on this sheet. SheetSync will verify tabs and add missing categories.
              </p>

              <button
                type="button"
                onClick={handleManualConnect}
                disabled={isCreating || !manualInput.trim()}
                className="w-full py-3 px-4 rounded-2xl rainbow-bg hover:opacity-95 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>Verify & Connect Sheet</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

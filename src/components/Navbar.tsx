import React from 'react';
import { User } from 'firebase/auth';
import { 
  ExternalLink, 
  Smartphone, 
  Settings2, 
  BarChart3, 
  LogOut, 
  CheckCircle2,
  RefreshCw,
  CloudUpload,
  AlertCircle,
} from 'lucide-react';
import { SquirrelIcon } from './SquirrelIcon';
import { AppConfig, SyncStatus } from '../types';

export type AppViewMode = 'schema-editor' | 'mobile-app' | 'reports';

interface NavbarProps {
  user: User | null;
  config: AppConfig;
  syncStatus: SyncStatus;
  currentView: AppViewMode;
  onViewChange: (view: AppViewMode) => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onOpenSpreadsheetModal: () => void;
  isLoggingIn: boolean;
  /** Has a usable Google access token (signed in and not expired). */
  isConnected: boolean;
  onTriggerSync: () => void;
}

/** Sync state next to the sheet name; tap to sync now (or reconnect). */
const SyncBadge: React.FC<{ syncStatus: SyncStatus; isConnected: boolean; onClick: () => void }> = ({
  syncStatus,
  isConnected,
  onClick,
}) => {
  const { state, pendingCount, message } = syncStatus;
  const unsent = `${pendingCount} unsent`;
  if (state === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 ml-1 text-cyan-400" title="Syncing with Google Sheets">
        <RefreshCw className="w-3 h-3 animate-spin" />
      </span>
    );
  }
  if (state === 'error' || pendingCount > 0 || !isConnected) {
    const title =
      state === 'error'
        ? `${message || 'Sync failed'}. Tap to try again.`
        : !isConnected
        ? `Not connected${pendingCount ? `: ${unsent} entr${pendingCount === 1 ? 'y' : 'ies'} saved on this device only` : ''}. Tap to connect.`
        : `${unsent}. Tap to send now.`;
    return (
      <button
        onClick={onClick}
        title={title}
        className={`inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap shrink-0 ${
          state === 'error'
            ? 'border-red-500/40 bg-red-500/10 text-red-300'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        }`}
      >
        {state === 'error' ? <AlertCircle className="w-3 h-3" /> : <CloudUpload className="w-3 h-3" />}
        {pendingCount > 0 ? (
          <span>
            {pendingCount}
            <span className="hidden sm:inline"> unsent</span>
          </span>
        ) : state === 'error' ? (
          'Retry'
        ) : (
          'Offline'
        )}
      </button>
    );
  }
  return (
    <button onClick={onClick} title="Synced. Tap to sync now." className="ml-1 text-emerald-400 hover:text-emerald-300">
      <CheckCircle2 className="w-3 h-3" />
    </button>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  user,
  config,
  syncStatus,
  currentView,
  onViewChange,
  onLoginClick,
  onLogoutClick,
  onOpenSpreadsheetModal,
  isLoggingIn,
  isConnected,
  onTriggerSync,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-800 bg-[#0f1118]/95 backdrop-blur-md">
      {/* Top rainbow glowing line */}
      <div className="h-[2px] w-full rainbow-bar opacity-80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Brand & Spreadsheet badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md shadow-rose-500/25 shrink-0 transition-transform duration-200 hover:scale-105">
            <SquirrelIcon className="w-full h-full object-cover" variant="mascot" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-base rainbow-text">
                SheetSync
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500/15 via-amber-500/15 to-cyan-500/15 text-pink-300 border border-pink-500/30">
                Rainbow Studio
              </span>
            </div>
            
            {/* Sheet Link */}
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              {config.spreadsheetId ? (
                <>
                  <button 
                    onClick={onOpenSpreadsheetModal}
                    className="hover:text-cyan-400 font-medium truncate max-w-[150px] sm:max-w-[200px] text-left transition-colors"
                    title={config.spreadsheetName || 'Connected Sheet'}
                  >
                    {config.spreadsheetName || 'Connected Sheet'}
                  </button>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stone-400 hover:text-emerald-400 transition-colors"
                    title="Open in Google Sheets"
                  >
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                  <SyncBadge syncStatus={syncStatus} isConnected={isConnected} onClick={onTriggerSync} />
                </>
              ) : (
                <button
                  onClick={onOpenSpreadsheetModal}
                  className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-medium"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block"></span>
                  Connect Google Sheet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* View Switcher Navigation in Rainbow Order (Red -> Green -> Violet) */}
        <div className="hidden sm:flex items-center p-1 bg-stone-900/90 rounded-2xl border border-stone-800 text-xs font-medium">
          <button
            onClick={() => onViewChange('schema-editor')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
              currentView === 'schema-editor'
                ? 'bg-gradient-to-r from-rose-500/20 via-red-500/20 to-orange-500/20 text-rose-300 border border-rose-500/30 font-semibold shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Settings2 className={`w-3.5 h-3.5 ${currentView === 'schema-editor' ? 'text-rose-400' : 'text-stone-400'}`} />
            <span>Category Studio</span>
          </button>

          <button
            onClick={() => onViewChange('mobile-app')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
              currentView === 'mobile-app'
                ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Smartphone className={`w-3.5 h-3.5 ${currentView === 'mobile-app' ? 'text-emerald-400' : 'text-stone-400'}`} />
            <span>Mobile / iPad App</span>
          </button>

          <button
            onClick={() => onViewChange('reports')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
              currentView === 'reports'
                ? 'bg-gradient-to-r from-purple-500/20 via-violet-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 font-semibold shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <BarChart3 className={`w-3.5 h-3.5 ${currentView === 'reports' ? 'text-purple-400' : 'text-stone-400'}`} />
            <span>Monthly Reports</span>
          </button>
        </div>

        {/* Mobile View Toggles in Rainbow Order (Red -> Green -> Violet) */}
        <div className="flex sm:hidden items-center gap-1 bg-stone-900/90 p-1 rounded-xl border border-stone-800 text-xs">
          <button
            onClick={() => onViewChange('schema-editor')}
            className={`p-2 rounded-lg transition-colors ${currentView === 'schema-editor' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-stone-400'}`}
            title="Category Studio"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewChange('mobile-app')}
            className={`p-2 rounded-lg transition-colors ${currentView === 'mobile-app' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-stone-400'}`}
            title="Mobile / iPad App"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewChange('reports')}
            className={`p-2 rounded-lg transition-colors ${currentView === 'reports' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-stone-400'}`}
            title="Monthly Reports"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>

        {/* Auth status & actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full bg-stone-900 border border-stone-800">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full border border-purple-500/40 object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full rainbow-bg text-white text-xs flex items-center justify-center font-bold">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-stone-200 hidden sm:inline max-w-[120px] truncate">
                  {user.displayName || user.email}
                </span>
                {!isConnected && (
                  <button
                    onClick={onLoginClick}
                    disabled={isLoggingIn}
                    className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold"
                    title="Google sign-in expired. Tap to reconnect and sync."
                  >
                    {isLoggingIn ? 'Connecting...' : 'Reconnect'}
                  </button>
                )}
                <button
                  onClick={onLogoutClick}
                  className="p-1 text-stone-400 hover:text-stone-200 rounded-full transition-colors ml-1"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              disabled={isLoggingIn}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-stone-700 bg-stone-900/90 hover:border-pink-500/40 text-stone-200 text-xs font-semibold shadow-xs transition-all hover:shadow-md hover:shadow-pink-500/10"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12c0 2.02.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{isLoggingIn ? 'Connecting...' : 'Connect Google'}</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};

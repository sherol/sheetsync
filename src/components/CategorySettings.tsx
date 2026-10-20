import React, { useMemo, useState } from 'react';
import { Trash2, Search, Check } from 'lucide-react';
import { CategoryDef } from '../types';
import { CategoryIcon, ICON_LIBRARY } from './CategoryIcon';
import { shortLabel, uniqueSheetName } from '../config/categories';

export const COLOR_SWATCHES = [
  '#f43f5e', '#fb923c', '#facc15', '#84cc16', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f472b6',
];

interface CategorySettingsProps {
  category: CategoryDef;
  onChange: (updated: CategoryDef) => void;
  onRequestDelete: () => void;
  /** Sheet tab names used by the other tabs, to keep this one unique. */
  takenSheetNames: string[];
}

const inputClass =
  'w-full px-3 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500';

/** Split a camelCase icon key into searchable words ("handHeart" -> "hand heart"). */
const words = (key: string) => key.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();

export const CategorySettings: React.FC<CategorySettingsProps> = ({
  category,
  onChange,
  onRequestDelete,
  takenSheetNames,
}) => {
  // The title's first word names the tab in the app and in Google Sheets. A changed sheet tab name
  // is remembered in renameFrom, and the tab is renamed in the spreadsheet on the next sync.
  const setTitle = (title: string) => {
    const label = shortLabel(title);
    const original = category.renameFrom ?? category.sheetName;
    const sheetName = label ? uniqueSheetName(label, takenSheetNames) : category.sheetName;
    const { renameFrom: _prev, ...rest } = category;
    onChange({ ...rest, title, label, sheetName, ...(sheetName !== original ? { renameFrom: original } : {}) });
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ICON_LIBRARY.map((g) => ({
      label: g.label,
      keys: Object.keys(g.icons).filter((k) => !q || words(k).includes(q) || g.label.toLowerCase().includes(q)),
    })).filter((g) => g.keys.length > 0);
  }, [query]);

  return (
    <div className="p-4 rounded-2xl border border-stone-800 bg-[#141620] space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          className="w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 shrink-0 hover:scale-[1.03] transition-transform"
          style={{ backgroundColor: `${category.color}1f`, borderColor: `${category.color}88` }}
          title="Choose icon"
          aria-expanded={pickerOpen}
        >
          <CategoryIcon name={category.icon} className="w-7 h-7" color={category.color} />
          <span className="text-[9px] font-bold text-stone-400">Icon</span>
        </button>

        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <label htmlFor="category-title" className="block text-[11px] font-medium text-stone-300 mb-1">
              Title
            </label>
            <input
              id="category-title"
              type="text"
              value={category.title ?? category.label}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => {
                if (!e.target.value.trim()) setTitle('Untitled');
              }}
              className={inputClass}
            />
            <p className="text-[10px] text-stone-500 mt-1">
              The form heading. Tabs, lists and the Google Sheet tab use the first word:{' '}
              <span className="font-mono text-stone-300">{category.sheetName}</span>
              {category.renameFrom && category.renameFrom !== category.sheetName && (
                <> (renamed from <span className="font-mono">{category.renameFrom}</span> on the next sync)</>
              )}
              .
            </p>
          </div>

          <div>
            <span className="block text-[11px] font-medium text-stone-300 mb-1">Colour</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...category, color: c })}
                  className="w-6 h-6 rounded-full flex items-center justify-center ring-offset-2 ring-offset-[#141620]"
                  style={{ backgroundColor: c, boxShadow: category.color === c ? `0 0 0 2px #141620, 0 0 0 4px ${c}` : undefined }}
                  aria-label={`Colour ${c}`}
                  aria-pressed={category.color === c}
                >
                  {category.color === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
              <label className="w-6 h-6 rounded-full overflow-hidden border border-stone-600 cursor-pointer relative" title="Custom colour">
                <input
                  type="color"
                  value={category.color}
                  onChange={(e) => onChange({ ...category, color: e.target.value })}
                  className="absolute -inset-2 w-10 h-10 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRequestDelete}
          className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl border border-stone-800 text-stone-400 hover:text-rose-300 hover:border-rose-500/40"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete tab
        </button>
      </div>

      {pickerOpen && (
        <div className="pt-3 border-t border-stone-800 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons (e.g. book, heart, food)"
              className={`${inputClass} pl-8`}
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
            {groups.map((g) => (
              <div key={g.label}>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">{g.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {g.keys.map((key) => {
                    const selected = category.icon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        title={words(key)}
                        aria-label={words(key)}
                        aria-pressed={selected}
                        onClick={() => {
                          onChange({ ...category, icon: key });
                          setPickerOpen(false);
                          setQuery('');
                        }}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                          selected ? '' : 'border-stone-800 bg-stone-900 hover:border-stone-600'
                        }`}
                        style={selected ? { backgroundColor: `${category.color}33`, borderColor: category.color } : undefined}
                      >
                        <CategoryIcon name={key} className="w-4 h-4" color={selected ? category.color : '#d6d3d1'} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-xs text-stone-500">No icons match "{query}".</p>}
          </div>
        </div>
      )}
    </div>
  );
};

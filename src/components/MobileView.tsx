import React, { useEffect, useMemo, useState } from 'react';
import { Send, CheckCircle, ChevronDown, ChevronUp, Pencil, X, ExternalLink, AlertCircle } from 'lucide-react';
import { AppConfig, CategoryDef, Entry } from '../types';
import { SquirrelIcon } from './SquirrelIcon';
import { CategoryIcon } from './CategoryIcon';
import { FieldInput } from './FieldInput';
import { BibleProgress } from './BibleProgress';
import { entryDate, entryTitle, ratingColor, splitLinks } from '../config/categories';

interface MobileViewProps {
  config: AppConfig;
  entries: Entry[];
  onSaveEntry: (categoryId: string, values: Record<string, any>, existingId?: string) => Promise<void>;
  isSyncing: boolean;
  isInDesktopFrame?: boolean;
}

const localToday = () => new Date().toLocaleDateString('en-CA');
const localTime = () => new Date().toTimeString().slice(0, 5);

function blankValues(category: CategoryDef): Record<string, any> {
  const values: Record<string, any> = {};
  for (const f of category.fields) {
    if (f.type === 'date' && f.id === category.dateFieldId) values[f.id] = localToday();
    if (f.type === 'time') values[f.id] = localTime();
  }
  return values;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

export const MobileView: React.FC<MobileViewProps> = ({
  config,
  entries,
  onSaveEntry,
  isSyncing,
  isInDesktopFrame = false,
}) => {
  const categories = config.categories;
  const [activeId, setActiveId] = useState<string>(
    categories.some((c) => c.id === config.defaultCategoryId) ? config.defaultCategoryId : categories[0]?.id
  );
  const category = categories.find((c) => c.id === activeId) ?? categories[0];

  const [values, setValues] = useState<Record<string, any>>(() => (category ? blankValues(category) : {}));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!category) return;
    setValues(blankValues(category));
    setEditingId(null);
    setShowMore(false);
  }, [category?.id]);

  const recent = useMemo(() => {
    if (!category) return [];
    return entries
      .filter((e) => e.categoryId === category.id)
      .sort((a, b) => {
        const byDate = entryDate(category, b).localeCompare(entryDate(category, a));
        return byDate !== 0 ? byDate : b.timestamp.localeCompare(a.timestamp);
      })
      .slice(0, 10);
  }, [entries, category]);

  if (!category) {
    return <div className="p-6 text-xs text-stone-400">No categories configured.</div>;
  }

  const quickFields = category.fields.filter((f) => f.showInQuickLog !== false);
  const moreFields = category.fields.filter((f) => f.showInQuickLog === false);

  const flash = (kind: 'ok' | 'error', text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = category.fields.filter((f) => f.required && isEmpty(values[f.id]));
    if (missing.length > 0) {
      flash('error', `Fill in: ${missing.map((f) => f.label).join(', ')}`);
      if (missing.some((f) => f.showInQuickLog === false)) setShowMore(true);
      return;
    }
    const wasEditing = editingId !== null;
    await onSaveEntry(category.id, values, editingId ?? undefined);
    setValues(blankValues(category));
    setEditingId(null);
    flash('ok', wasEditing ? `${category.label} entry updated` : `${category.label} entry saved`);
  };

  const startEdit = (entry: Entry) => {
    setValues({ ...entry.values });
    setEditingId(entry.id);
    if (moreFields.some((f) => !isEmpty(entry.values[f.id]))) setShowMore(true);
  };

  const cancelEdit = () => {
    setValues(blankValues(category));
    setEditingId(null);
  };

  const ratingFields = category.fields.filter((f) => f.type === 'rating');
  const linkFields = category.fields.filter((f) => f.type === 'links');

  return (
    <div
      className={`flex flex-col bg-[#0b0c10] text-stone-100 ${
        isInDesktopFrame
          ? 'h-full'
          : 'min-h-[calc(100vh-4rem)] w-full max-w-xl md:max-w-2xl mx-auto shadow-2xl md:rounded-3xl md:my-4 md:border border-stone-800'
      }`}
    >
      {/* Top bar with category switcher */}
      <div className="sticky top-0 z-20 bg-[#10121a]/95 backdrop-blur-md border-b border-stone-800 px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl overflow-hidden shadow-xs shrink-0">
            <SquirrelIcon className="w-full h-full object-cover" />
          </div>
          <span className="font-extrabold text-sm tracking-tight rainbow-text">SheetSync</span>
        </div>

        <div className="mt-3 -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist">
          {categories.map((c) => {
            const active = c.id === category.id;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveId(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold border transition-all ${
                  active ? 'text-white' : 'border-stone-800 bg-stone-900/80 text-stone-400 hover:text-stone-200'
                }`}
                style={active ? { backgroundColor: `${c.color}2e`, borderColor: `${c.color}99` } : undefined}
              >
                <CategoryIcon name={c.icon} className="w-3.5 h-3.5" color={c.color} />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`text-white text-xs font-bold py-2 px-4 text-center flex items-center justify-center gap-1.5 shadow-md ${
            notice.kind === 'ok' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-rose-600 to-red-600'
          }`}
        >
          {notice.kind === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#13151f] p-4 rounded-2xl border border-stone-800 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <CategoryIcon name={category.icon} className="w-4 h-4" color={category.color} />
                {editingId ? `Edit ${category.label}` : `New ${category.label} entry`}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel edit
                </button>
              )}
            </div>

            {quickFields.map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={values[f.id]}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))}
                accent={category.color}
                categories={categories}
                entries={entries}
              />
            ))}

            {moreFields.length > 0 && (
              <div className="pt-1 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowMore(!showMore)}
                  className="w-full pt-3 text-[11px] font-bold text-stone-400 hover:text-stone-200 flex items-center justify-center gap-1"
                >
                  {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showMore ? 'Fewer fields' : `${moreFields.length} more field${moreFields.length > 1 ? 's' : ''}`}
                </button>
                {showMore && (
                  <div className="space-y-4 pt-3">
                    {moreFields.map((f) => (
                      <FieldInput
                        key={f.id}
                        field={f}
                        value={values[f.id]}
                        onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))}
                        accent={category.color}
                        categories={categories}
                        entries={entries}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSyncing}
            className="w-full py-3.5 px-4 rounded-2xl text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
            style={{ background: `linear-gradient(90deg, ${category.color}, ${category.color}bb)` }}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{editingId ? 'Update entry' : `Save to ${category.label}`}</span>
          </button>
        </form>

        {category.bibleTracker && <BibleProgress category={category} entries={entries} accent={category.color} />}

        {/* Recent entries */}
        <section className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 px-1">
            Recent {category.label}
          </h3>
          {recent.length === 0 ? (
            <p className="text-xs text-stone-500 px-1">Nothing logged here yet.</p>
          ) : (
            recent.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-2xl border bg-[#13151f] flex items-start justify-between gap-3 ${
                  entry.id === editingId ? 'border-stone-500' : 'border-stone-800'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <span className="text-xs font-bold text-white block break-words">{entryTitle(category, entry)}</span>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-stone-400">
                    <span className="font-mono">{entryDate(category, entry)}</span>
                    {category.fields
                      .filter((f) => f.type === 'select' && entry.values[f.id])
                      .map((f) => (
                        <span key={f.id} className="px-1.5 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-stone-300">
                          {entry.values[f.id]}
                        </span>
                      ))}
                    {ratingFields
                      .filter((f) => typeof entry.values[f.id] === 'number')
                      .map((f) => (
                        <span
                          key={f.id}
                          className="px-1.5 py-0.5 rounded-md font-bold text-white"
                          style={{ backgroundColor: ratingColor(entry.values[f.id], f.min ?? 1, f.max ?? 10, 0.85) }}
                          title={f.label}
                        >
                          {f.label.replace(/ (Level|Score)$/, '')} {entry.values[f.id]}
                        </span>
                      ))}
                  </div>
                  {linkFields.flatMap((f) => splitLinks(entry.values[f.id])).length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                      {linkFields.flatMap((f) =>
                        splitLinks(entry.values[f.id]).map((url, i) => (
                          <a
                            key={`${f.id}-${i}`}
                            href={/^https?:\/\//i.test(url) ? url : `https://${url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-cyan-400 hover:underline inline-flex items-center gap-1 max-w-full truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{url.replace(/^https?:\/\//i, '')}</span>
                          </a>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(entry)}
                  className="p-1.5 text-stone-500 hover:text-stone-200 rounded-lg shrink-0"
                  aria-label={`Edit ${entryTitle(category, entry)}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
};

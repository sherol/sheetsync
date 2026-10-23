import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, X, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { AppConfig, CategoryDef, Entry, QuickPick } from '../types';
import type { PageCursor } from '../services/sheetsService';
import { SquirrelIcon } from './SquirrelIcon';
import { CategoryIcon } from './CategoryIcon';
import { FieldInput } from './FieldInput';
import { BibleProgress } from './BibleProgress';
import { QuickPicks } from './QuickPicks';
import { categoryTitle, entryDate, entryTitle, ratingColor, splitLinks } from '../config/categories';

interface MobileViewProps {
  config: AppConfig;
  entries: Entry[];
  onSaveEntry: (categoryId: string, values: Record<string, any>, existingId?: string) => Promise<void>;
  onUpdateList: (listId: string, items: string[]) => void;
  onUpdateQuickPicks: (categoryId: string, picks: QuickPick[]) => void;
  isSyncing: boolean;
  isInDesktopFrame?: boolean;
  /**
   * Load one page of a category's entries from the sheet, newest first. `before` is null for the
   * newest page, then whatever the previous call returned. Resolves to the next page's `before`,
   * null when there are no older rows, or undefined when the sheet isn't connected.
   */
  onLoadEntriesPage?: (categoryId: string, before: PageCursor | null) => Promise<PageCursor | null | undefined>;
}

// Entries shown per step as the list scrolls.
const LIST_STEP = 25;

/** Where paging through the sheet has got to: 'start' = nothing read yet, the next page's cursor, or 'end'. */
type SheetCursor = 'start' | PageCursor | 'end' | 'offline';

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
  onUpdateList,
  onUpdateQuickPicks,
  isSyncing,
  isInDesktopFrame = false,
  onLoadEntriesPage,
}) => {
  const categories = config.categories;
  // null = home screen listing every category
  const [activeId, setActiveId] = useState<string | null>(null);
  const category = activeId ? categories.find((c) => c.id === activeId) : undefined;

  const [values, setValues] = useState<Record<string, any>>(() => (category ? blankValues(category) : {}));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isInDesktopFrame) window.scrollTo(0, 0);
  }, [activeId]);

  useEffect(() => {
    if (!category) return;
    setValues(blankValues(category));
    setEditingId(null);
    setShowMore(false);
  }, [category?.id]);

  const summaries = useMemo(
    () =>
      categories.map((c) => {
        const mine = entries.filter((e) => e.categoryId === c.id);
        const last = mine.reduce<string | null>((max, e) => {
          const d = entryDate(c, e);
          return max === null || d > max ? d : max;
        }, null);
        return { category: c, count: mine.length, last };
      }),
    [categories, entries]
  );

  const allEntries = useMemo(() => {
    if (!category) return [];
    return entries
      .filter((e) => e.categoryId === category.id)
      .sort((a, b) => {
        const byDate = entryDate(category, b).localeCompare(entryDate(category, a));
        return byDate !== 0 ? byDate : b.timestamp.localeCompare(a.timestamp);
      });
  }, [entries, category]);

  // Page-by-page list: show LIST_STEP more entries each time the end of the list scrolls into
  // view, reading older pages from the sheet once the device's own entries run out.
  const [shown, setShown] = useState(LIST_STEP);
  const [cursor, setCursor] = useState<SheetCursor>('start');
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [atListEnd, setAtListEnd] = useState(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  // Each load gets a number; a load whose number is no longer current (the category changed, the
  // sign-in changed, or the list was reset) is ignored when it finishes.
  const loadSeq = useRef(0);
  const loadInFlight = useRef(false);
  const recent = allEntries.slice(0, shown);

  const loadPage = useCallback(
    async (categoryId: string, from: SheetCursor) => {
      if (!onLoadEntriesPage || loadInFlight.current) return;
      const seq = ++loadSeq.current;
      loadInFlight.current = true;
      setPageLoading(true);
      setPageError(null);
      try {
        const next = await onLoadEntriesPage(categoryId, typeof from === 'object' ? from : null);
        if (seq !== loadSeq.current) return; // reset meanwhile
        setCursor(next === undefined ? 'offline' : next === null ? 'end' : next);
      } catch (err: any) {
        if (seq === loadSeq.current) setPageError(err?.message || 'Could not load entries from the sheet');
      } finally {
        if (seq === loadSeq.current) {
          loadInFlight.current = false;
          setPageLoading(false);
        }
      }
    },
    [onLoadEntriesPage]
  );

  // Opening a category reads its newest page, so recent edits made elsewhere (e.g. mdlife) show up.
  useEffect(() => {
    loadSeq.current++;
    loadInFlight.current = false;
    setShown(LIST_STEP);
    setCursor('start');
    setPageLoading(false);
    setPageError(null);
    if (category) void loadPage(category.id, 'start');
  }, [category?.id, loadPage]);

  useEffect(() => {
    const el = listEndRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([e]) => setAtListEnd(e.isIntersecting), { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [category?.id]);

  useEffect(() => {
    if (!atListEnd || !category || pageLoading || pageError) return;
    if (shown < allEntries.length) setShown((n) => n + LIST_STEP);
    else if (cursor === 'start' || typeof cursor === 'object') void loadPage(category.id, cursor);
  }, [atListEnd, shown, allEntries.length, cursor, pageLoading, pageError, category, loadPage]);

  const shellClass = `flex flex-col bg-[#0b0c10] text-stone-100 ${
    isInDesktopFrame
      ? 'h-full'
      : 'min-h-[calc(100vh-4rem)] w-full max-w-xl md:max-w-2xl mx-auto shadow-2xl md:rounded-3xl md:my-4 md:border border-stone-800'
  }`;
  // Below the app's own sticky navbar on a full page; at the top inside the desktop phone frame.
  const stickyTop = isInDesktopFrame ? 'top-0' : 'top-16';

  if (!category) {
    return (
      <div className={shellClass}>
        <div className={`sticky ${stickyTop} z-20 bg-[#10121a]/95 backdrop-blur-md border-b border-stone-800 px-4 py-3 shrink-0`}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl overflow-hidden shadow-xs shrink-0">
              <SquirrelIcon className="w-full h-full object-cover" />
            </div>
            <span className="font-extrabold text-sm tracking-tight rainbow-text">SheetSync</span>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto space-y-2" aria-label="Categories">
          {summaries.map(({ category: c, count, last }) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className="w-full p-3.5 rounded-2xl border border-stone-800 bg-[#13151f] hover:border-stone-600 active:scale-[0.99] flex items-center gap-3 text-left transition-all"
            >
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                style={{ backgroundColor: `${c.color}1f`, borderColor: `${c.color}55` }}
              >
                <CategoryIcon name={c.icon} className="w-5 h-5" color={c.color} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-white truncate">{c.label}</span>
                {categoryTitle(c) !== c.label && (
                  <span className="block text-[11px] font-semibold truncate" style={{ color: c.color }}>
                    {categoryTitle(c)}
                  </span>
                )}
                <span className="block text-[11px] text-stone-400">
                  {count === 0 ? 'No entries yet' : `${count} entr${count === 1 ? 'y' : 'ies'} · last ${last}`}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />
            </button>
          ))}
          {categories.length === 0 && <p className="text-xs text-stone-400">No categories configured.</p>}
        </nav>
      </div>
    );
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
    <div className={shellClass}>
      <div className={`sticky ${stickyTop} z-20 bg-[#10121a]/95 backdrop-blur-md border-b border-stone-800 px-2 py-2 shrink-0`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveId(null)}
            className="flex items-center gap-0.5 pl-1 pr-2.5 py-1.5 rounded-xl text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800/60"
          >
            <ChevronLeft className="w-4 h-4" />
            All
          </button>
          <span className="flex items-center gap-1.5 text-sm font-extrabold text-white min-w-0">
            <CategoryIcon name={category.icon} className="w-4 h-4 shrink-0" color={category.color} />
            <span className="truncate">{category.label}</span>
          </span>
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
                {editingId ? `Edit · ${categoryTitle(category)}` : categoryTitle(category)}
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

            {category.quickPicksEnabled && (
              <QuickPicks
                category={category}
                values={values}
                onApply={(picked) => setValues((prev) => ({ ...prev, ...picked }))}
                onUpdate={(picks) => onUpdateQuickPicks(category.id, picks)}
              />
            )}

            {quickFields.map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={values[f.id]}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))}
                accent={category.color}
                categories={categories}
                entries={entries}
                lists={config.lists}
                onUpdateList={onUpdateList}
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
                        lists={config.lists}
                        onUpdateList={onUpdateList}
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
            {category.label} entries
          </h3>
          {recent.length === 0 ? (
            pageLoading ? null : <p className="text-xs text-stone-500 px-1">Nothing logged here yet.</p>
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
                      .filter((f) => (f.type === 'select' || (f.type === 'list' && !f.multiple && f.id !== category.titleFieldId)) && entry.values[f.id])
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
          <div ref={listEndRef} className="px-1 py-2 text-[11px] text-stone-500 flex items-center justify-center gap-1.5 min-h-8">
            {pageLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading entries from your sheet…
              </>
            ) : pageError ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Couldn't load more from the sheet.</span>
                <button type="button" onClick={() => setPageError(null)} className="font-bold text-stone-300 underline">
                  Retry
                </button>
              </>
            ) : shown < allEntries.length ? null : cursor === 'offline' ? (
              <span>Connect Google to see older entries from your sheet.</span>
            ) : cursor === 'end' && allEntries.length > 0 ? (
              <span>That's every {category.label} entry.</span>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};

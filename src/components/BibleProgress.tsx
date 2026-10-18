import React, { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { CategoryDef, Entry } from '../types';
import { bibleProgress, BookProgress, TOTAL_BIBLE_CHAPTERS } from '../config/bible';

interface BibleProgressProps {
  category: CategoryDef;
  entries: Entry[];
  accent: string;
}

export const BibleProgress: React.FC<BibleProgressProps> = ({ category, entries, accent }) => {
  const tracker = category.bibleTracker;
  const [selected, setSelected] = useState<string | null>(null);

  const progress = useMemo<BookProgress[]>(() => {
    if (!tracker) return [];
    return bibleProgress(
      entries
        .filter((e) => e.categoryId === category.id)
        .map((e) => ({ book: e.values[tracker.bookFieldId], chapters: e.values[tracker.chaptersFieldId] }))
    );
  }, [entries, category.id, tracker]);

  if (!tracker) return null;

  const chaptersStudied = progress.reduce((n, p) => n + p.studied.size, 0);
  const booksStarted = progress.filter((p) => p.sessions > 0).length;
  const booksFinished = progress.filter((p) => p.studied.size === p.book.chapters).length;
  const selectedBook = progress.find((p) => p.book.name === selected);

  const renderTestament = (testament: 'OT' | 'NT', title: string) => (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{title}</span>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
        {progress
          .filter((p) => p.book.testament === testament)
          .map((p) => {
            const pct = p.studied.size / p.book.chapters;
            const started = p.sessions > 0;
            return (
              <button
                key={p.book.name}
                type="button"
                onClick={() => setSelected(selected === p.book.name ? null : p.book.name)}
                title={`${p.book.name}: ${p.studied.size}/${p.book.chapters} chapters`}
                aria-pressed={selected === p.book.name}
                className={`relative overflow-hidden rounded-md border py-1 text-[9px] font-bold leading-tight ${
                  selected === p.book.name ? 'ring-1 ring-white/60' : ''
                } ${started ? 'text-white' : 'text-stone-500 border-stone-800 bg-stone-900'}`}
                style={started ? { borderColor: `${accent}88`, backgroundColor: '#1c1917' } : undefined}
              >
                <span
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${Math.max(pct, started ? 0.06 : 0) * 100}%`, backgroundColor: `${accent}66` }}
                />
                <span className="relative">{p.book.abbr}</span>
              </button>
            );
          })}
      </div>
    </div>
  );

  return (
    <section className="bg-[#13151f] p-4 rounded-2xl border border-stone-800 shadow-md space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" style={{ color: accent }} />
          Bible Study Progress
        </h3>
        <span className="text-[11px] font-bold" style={{ color: accent }}>
          {Math.round((chaptersStudied / TOTAL_BIBLE_CHAPTERS) * 100)}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-stone-900 border border-stone-800 p-2">
          <span className="block text-sm font-black text-white">{chaptersStudied}</span>
          <span className="text-[10px] text-stone-400">of {TOTAL_BIBLE_CHAPTERS} chapters</span>
        </div>
        <div className="rounded-xl bg-stone-900 border border-stone-800 p-2">
          <span className="block text-sm font-black text-white">{booksStarted}</span>
          <span className="text-[10px] text-stone-400">of 66 books started</span>
        </div>
        <div className="rounded-xl bg-stone-900 border border-stone-800 p-2">
          <span className="block text-sm font-black text-white">{booksFinished}</span>
          <span className="text-[10px] text-stone-400">books finished</span>
        </div>
      </div>

      {renderTestament('OT', 'Old Testament')}
      {renderTestament('NT', 'New Testament')}

      {selectedBook && (
        <div className="rounded-xl bg-stone-900 border border-stone-800 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">{selectedBook.book.name}</span>
            <span className="text-stone-400">
              {selectedBook.studied.size}/{selectedBook.book.chapters} chapters · {selectedBook.sessions} session
              {selectedBook.sessions === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: selectedBook.book.chapters }, (_, i) => i + 1).map((c) => {
              const done = selectedBook.studied.has(c);
              return (
                <span
                  key={c}
                  className={`w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center ${
                    done ? 'text-white' : 'text-stone-600 bg-stone-950 border border-stone-800'
                  }`}
                  style={done ? { backgroundColor: accent } : undefined}
                >
                  {c}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-stone-500">
        Log a Prayer entry with a book and chapters (e.g. "1-3, 5" or "all") to fill in the map. Tap a book for details.
      </p>
    </section>
  );
};

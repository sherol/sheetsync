import React, { useMemo, useState } from 'react';
import { BarChart3, Calendar, Check, FileSpreadsheet, Sparkles } from 'lucide-react';
import { AppConfig, CategoryDef, Entry } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { BibleProgress } from './BibleProgress';
import { entryDate, ratingColor } from '../config/categories';
import { bibleProgress } from '../config/bible';

interface MonthlyReportViewProps {
  config: AppConfig;
  entries: Entry[];
  onSyncReportToSheet: (row: (string | number)[]) => Promise<void>;
  isSyncingReport: boolean;
}

export interface MonthlyReport {
  month: string;
  total: number;
  counts: { category: CategoryDef; count: number }[];
  avgMood: number | null;
  moodPoints: { date: string; score: number }[];
  ratingAverages: { category: CategoryDef; label: string; avg: number; min: number; max: number; n: number }[];
  selectBreakdowns: { category: CategoryDef; label: string; counts: [string, number][] }[];
  chaptersThisMonth: number;
  summary: string[];
}

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const average = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

export function buildMonthlyReport(categories: CategoryDef[], entries: Entry[], month: string): MonthlyReport {
  const inMonth = (c: CategoryDef) =>
    entries.filter((e) => e.categoryId === c.id && entryDate(c, e).startsWith(month));

  const counts = categories.map((c) => ({ category: c, count: inMonth(c).length }));
  const total = counts.reduce((n, c) => n + c.count, 0);

  const moodCat = categories.find((c) => c.id === 'mood');
  const moodField = moodCat?.fields.find((f) => f.type === 'rating');
  const moodPoints =
    moodCat && moodField
      ? inMonth(moodCat)
          .filter((e) => typeof e.values[moodField.id] === 'number')
          .map((e) => ({ date: entryDate(moodCat, e), score: e.values[moodField.id] as number }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
  const avgMood = average(moodPoints.map((p) => p.score));

  const ratingAverages: MonthlyReport['ratingAverages'] = [];
  const selectBreakdowns: MonthlyReport['selectBreakdowns'] = [];
  for (const c of categories) {
    const rows = inMonth(c);
    if (rows.length === 0) continue;
    for (const f of c.fields) {
      if (f.type === 'rating' && !(c.id === 'mood' && f.id === moodField?.id)) {
        const nums = rows.map((e) => e.values[f.id]).filter((v): v is number => typeof v === 'number');
        const avg = average(nums);
        if (avg !== null) ratingAverages.push({ category: c, label: f.label, avg, min: f.min ?? 1, max: f.max ?? 10, n: nums.length });
      }
      if (f.type === 'select' && (f.options || []).length <= 12) {
        const tally = new Map<string, number>();
        for (const e of rows) {
          const v = String(e.values[f.id] ?? '').trim();
          if (v) tally.set(v, (tally.get(v) ?? 0) + 1);
        }
        if (tally.size > 0) {
          selectBreakdowns.push({ category: c, label: f.label, counts: [...tally.entries()].sort((a, b) => b[1] - a[1]) });
        }
      }
    }
  }

  let chaptersThisMonth = 0;
  for (const c of categories) {
    if (!c.bibleTracker) continue;
    const t = c.bibleTracker;
    chaptersThisMonth += bibleProgress(
      inMonth(c).map((e) => ({ book: e.values[t.bookFieldId], chapters: e.values[t.chaptersFieldId] }))
    ).reduce((n, p) => n + p.studied.size, 0);
  }

  const summary: string[] = [];
  if (total === 0) {
    summary.push(`Nothing logged in ${monthLabel(month)}.`);
  } else {
    const top = counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
    summary.push(
      `${total} entr${total === 1 ? 'y' : 'ies'} across ${top.length} categor${top.length === 1 ? 'y' : 'ies'}; most in ${top[0].category.label} (${top[0].count}).`
    );
    if (avgMood !== null) {
      const lo = Math.min(...moodPoints.map((p) => p.score));
      const hi = Math.max(...moodPoints.map((p) => p.score));
      summary.push(`Mood averaged ${avgMood.toFixed(1)}/10 over ${moodPoints.length} day${moodPoints.length === 1 ? '' : 's'} (range ${lo}–${hi}).`);
    }
    for (const r of ratingAverages) {
      summary.push(`${r.category.label}: average ${r.label.toLowerCase()} ${r.avg.toFixed(1)}/${r.max} over ${r.n} entr${r.n === 1 ? 'y' : 'ies'}.`);
    }
    if (chaptersThisMonth > 0) summary.push(`Studied ${chaptersThisMonth} Bible chapter${chaptersThisMonth === 1 ? '' : 's'}.`);
  }

  return { month, total, counts, avgMood, moodPoints, ratingAverages, selectBreakdowns, chaptersThisMonth, summary };
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({ config, entries, onSyncReportToSheet, isSyncingReport }) => {
  const currentMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);

  const months = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    for (const e of entries) {
      const c = config.categories.find((cat) => cat.id === e.categoryId);
      if (c) set.add(entryDate(c, e).slice(0, 7));
    }
    return [...set].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort().reverse();
  }, [entries, config.categories, currentMonth]);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [syncState, setSyncState] = useState<'idle' | 'done' | 'error'>('idle');

  const report = useMemo(
    () => buildMonthlyReport(config.categories, entries, selectedMonth),
    [config.categories, entries, selectedMonth]
  );

  const prayerCat = config.categories.find((c) => c.bibleTracker);

  const handleExport = async () => {
    try {
      await onSyncReportToSheet([
        report.month,
        report.total,
        report.avgMood !== null ? Number(report.avgMood.toFixed(1)) : '',
        report.counts.filter((c) => c.count > 0).map((c) => `${c.category.label}: ${c.count}`).join(', '),
        report.summary.join(' '),
      ]);
      setSyncState('done');
    } catch {
      setSyncState('error');
    }
    setTimeout(() => setSyncState('idle'), 3000);
  };

  const maxCount = Math.max(1, ...report.counts.map((c) => c.count));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#11131c] p-6 rounded-3xl border border-stone-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl rainbow-bg flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-extrabold text-white tracking-wide">Monthly Report</h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">What you logged across every category this month.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-stone-900 px-3.5 py-2 rounded-2xl border border-stone-800">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-stone-200 focus:outline-none cursor-pointer"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExport}
            disabled={isSyncingReport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl rainbow-bg hover:opacity-95 text-white text-xs font-extrabold shadow-lg shadow-pink-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSyncingReport ? (
              <span>Syncing...</span>
            ) : syncState === 'done' ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Saved to Sheet</span>
              </>
            ) : syncState === 'error' ? (
              <span>Sync failed — try again</span>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Save Report to Sheet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#131520] p-4 rounded-3xl border border-stone-800 space-y-1">
          <span className="text-xs font-bold text-stone-300">Entries logged</span>
          <span className="block text-3xl font-black text-white">{report.total}</span>
        </div>
        <div className="bg-[#131520] p-4 rounded-3xl border border-stone-800 space-y-1">
          <span className="text-xs font-bold text-stone-300">Average mood</span>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-black"
              style={{ color: report.avgMood !== null ? ratingColor(report.avgMood) : '#78716c' }}
            >
              {report.avgMood !== null ? report.avgMood.toFixed(1) : '—'}
            </span>
            <span className="text-xs text-stone-500">/ 10</span>
          </div>
        </div>
        <div className="bg-[#131520] p-4 rounded-3xl border border-stone-800 space-y-1">
          <span className="text-xs font-bold text-stone-300">Days with mood</span>
          <span className="block text-3xl font-black text-white">{report.moodPoints.length}</span>
        </div>
        <div className="bg-[#131520] p-4 rounded-3xl border border-stone-800 space-y-1">
          <span className="text-xs font-bold text-stone-300">Bible chapters studied</span>
          <span className="block text-3xl font-black text-white">{report.chaptersThisMonth}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-br from-[#151726] to-[#0f111a] p-6 rounded-3xl border border-purple-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 rainbow-bar" />
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-300" />
          Summary
        </h3>
        <ul className="space-y-1.5 text-xs text-stone-200 list-disc pl-5">
          {report.summary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Mood chart */}
        <div className="bg-[#131520] p-6 rounded-3xl border border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-white">Daily mood</h3>
            <span className="text-[11px] text-stone-400 flex items-center gap-1.5">
              1
              <span
                className="inline-block w-16 h-1.5 rounded-full"
                style={{ background: `linear-gradient(90deg, ${[1, 3, 5, 7, 10].map((n) => ratingColor(n)).join(', ')})` }}
              />
              10
            </span>
          </div>
          {report.moodPoints.length === 0 ? (
            <p className="text-xs text-stone-500 h-44 flex items-center justify-center">No mood entries this month.</p>
          ) : (
            <div className="h-44 w-full flex items-end gap-1.5 border-b border-stone-800 px-1">
              {report.moodPoints.map((pt, i) => (
                <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end" title={`${pt.date}: ${pt.score}/10`}>
                  <span className="text-[9px] text-stone-300 font-bold">{pt.score}</span>
                  <div
                    className="w-full max-w-8 rounded-t-md"
                    style={{ height: `${(pt.score / 10) * 85}%`, backgroundColor: ratingColor(pt.score) }}
                  />
                  <span className="text-[9px] text-stone-500 font-mono">{pt.date.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Counts by category */}
        <div className="bg-[#131520] p-6 rounded-3xl border border-stone-800 space-y-3">
          <h3 className="text-xs font-extrabold text-white">Entries by category</h3>
          <div className="space-y-2">
            {report.counts.map(({ category, count }) => (
              <div key={category.id} className="flex items-center gap-2 text-xs">
                <CategoryIcon name={category.icon} className="w-3.5 h-3.5 shrink-0" color={category.color} />
                <span className="w-40 truncate text-stone-300">{category.label}</span>
                <div className="flex-1 h-2 rounded-full bg-stone-900 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: category.color }} />
                </div>
                <span className="w-6 text-right font-mono text-stone-300">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(report.ratingAverages.length > 0 || report.selectBreakdowns.length > 0) && (
        <div className="bg-[#131520] p-6 rounded-3xl border border-stone-800 space-y-4">
          <h3 className="text-xs font-extrabold text-white">Details</h3>
          {report.ratingAverages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {report.ratingAverages.map((r) => (
                <div key={`${r.category.id}-${r.label}`} className="rounded-2xl bg-stone-900 border border-stone-800 p-3">
                  <span className="text-[11px] text-stone-400 block">
                    {r.category.label} · {r.label}
                  </span>
                  <span className="text-xl font-black" style={{ color: ratingColor(r.avg, r.min, r.max) }}>
                    {r.avg.toFixed(1)}
                  </span>
                  <span className="text-[11px] text-stone-500"> / {r.max} avg</span>
                </div>
              ))}
            </div>
          )}
          {report.selectBreakdowns.map((b) => (
            <div key={`${b.category.id}-${b.label}`} className="text-xs">
              <span className="text-stone-400">
                {b.category.label} by {b.label.toLowerCase()}:{' '}
              </span>
              <span className="text-stone-200">{b.counts.map(([k, n]) => `${k} ${n}`).join(' · ')}</span>
            </div>
          ))}
        </div>
      )}

      {prayerCat && <BibleProgress category={prayerCat} entries={entries} accent={prayerCat.color} />}
    </div>
  );
};

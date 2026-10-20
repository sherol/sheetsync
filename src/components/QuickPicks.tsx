import React, { useState } from 'react';
import { Zap, Plus, Pencil, Check, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { CategoryDef, QuickPick } from '../types';

interface QuickPicksProps {
  category: CategoryDef;
  values: Record<string, any>;
  /** Fill the form with a pick's values. */
  onApply: (values: Record<string, any>) => void;
  onUpdate: (picks: QuickPick[]) => void;
}

/** Field types a quick pick remembers. Dates, times, ratings, notes and links are per entry. */
const REMEMBERED = new Set(['text', 'select', 'number', 'list']);

function pickFrom(category: CategoryDef, values: Record<string, any>): QuickPick | null {
  const kept: Record<string, any> = {};
  for (const f of category.fields) {
    const v = values[f.id];
    if (!REMEMBERED.has(f.type) || v === undefined || v === null || String(v).trim() === '') continue;
    kept[f.id] = v;
  }
  const title = category.titleFieldId ? String(kept[category.titleFieldId] ?? '').trim() : '';
  if (!title) return null;
  // Label: the title, plus the first other text/number value (e.g. an amount).
  const extra = category.fields
    .filter((f) => f.id !== category.titleFieldId && (f.type === 'text' || f.type === 'number') && kept[f.id] !== undefined)
    .map((f) => String(kept[f.id]).trim())[0];
  return { id: `qp_${Date.now()}`, label: extra ? `${title} · ${extra}` : title, values: kept };
}

/**
 * One-tap buttons that fill a form with saved values, e.g. a medicine and its dose. Saved with
 * the tab's layout, so they're the same on every device.
 */
export const QuickPicks: React.FC<QuickPicksProps> = ({ category, values, onApply, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const picks = category.quickPicks ?? [];
  const candidate = pickFrom(category, values);
  const duplicate = !!candidate && picks.some((p) => p.label.toLowerCase() === candidate.label.toLowerCase());
  const titleLabel = category.fields.find((f) => f.id === category.titleFieldId)?.label ?? 'the name';

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= picks.length) return;
    const next = [...picks];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdate(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" style={{ color: category.color }} />
          Quick picks
        </span>
        {picks.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="text-[11px] font-semibold text-stone-400 hover:text-stone-200 flex items-center gap-1"
            aria-expanded={editing}
          >
            {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {picks.length === 0 ? (
        <p className="text-[11px] text-stone-500">
          Fill in {titleLabel.toLowerCase()} (and anything else you repeat, like the type and amount), then tap “Save as quick
          pick” to make a one-tap button.
        </p>
      ) : editing ? (
        <ul className="space-y-1">
          {picks.map((p, i) => (
            <li key={p.id} className="flex items-center gap-1">
              <span className="flex-1 text-xs text-stone-200 px-2 py-1 truncate">{p.label}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-stone-500 hover:text-stone-200 disabled:opacity-30" aria-label={`Move ${p.label} up`}>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === picks.length - 1} className="p-1 text-stone-500 hover:text-stone-200 disabled:opacity-30" aria-label={`Move ${p.label} down`}>
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => onUpdate(picks.filter((x) => x.id !== p.id))} className="p-1 text-stone-500 hover:text-rose-400" aria-label={`Remove ${p.label}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {picks.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApply(p.values)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border text-white hover:opacity-90 active:scale-[0.98] transition-all"
              style={{ backgroundColor: `${category.color}26`, borderColor: `${category.color}88` }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {!editing && (
        <button
          type="button"
          onClick={() => candidate && !duplicate && onUpdate([...picks, candidate])}
          disabled={!candidate || duplicate}
          className="text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40"
          style={{ color: category.color }}
          title={!candidate ? `Fill in ${titleLabel.toLowerCase()} first` : duplicate ? 'Already a quick pick' : undefined}
        >
          <Plus className="w-3.5 h-3.5" />
          {duplicate ? 'Already a quick pick' : candidate ? `Save “${candidate.label}” as quick pick` : 'Save as quick pick'}
        </button>
      )}
    </div>
  );
};

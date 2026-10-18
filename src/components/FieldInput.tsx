import React from 'react';
import { CustomField, Entry, CategoryDef } from '../types';
import { ratingColor, entryTitle, splitList } from '../config/categories';

interface FieldInputProps {
  field: CustomField;
  value: any;
  onChange: (value: any) => void;
  accent: string;
  categories: CategoryDef[];
  entries: Entry[];
}

const inputClass =
  'w-full px-3 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-stone-500';

export const FieldInput: React.FC<FieldInputProps> = ({ field, value, onChange, accent, categories, entries }) => {
  const label = (
    <label htmlFor={`field-${field.id}`} className="block text-xs font-bold text-stone-200 mb-1.5">
      {field.label}
      {field.unit && <span className="text-stone-400 font-medium"> ({field.unit})</span>}
      {field.required && <span className="text-rose-400"> *</span>}
    </label>
  );

  switch (field.type) {
    case 'rating': {
      const min = field.min ?? 1;
      const max = field.max ?? 10;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      const current = typeof value === 'number' ? value : undefined;
      return (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-stone-200">
              {field.label}
              {field.required && <span className="text-rose-400"> *</span>}
            </span>
            <span
              className="text-xs font-extrabold px-2.5 py-0.5 rounded-full border"
              style={
                current !== undefined
                  ? { color: ratingColor(current, min, max), borderColor: ratingColor(current, min, max) }
                  : { color: '#a8a29e', borderColor: '#44403c' }
              }
            >
              {current !== undefined ? `${current} / ${max}` : `— / ${max}`}
            </span>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((n) => {
              const color = ratingColor(n, min, max);
              const selected = current === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${field.label} ${n}`}
                  aria-pressed={selected}
                  onClick={() => onChange(selected ? undefined : n)}
                  className={`py-2 text-xs font-black rounded-lg border transition-all ${
                    selected ? 'text-white scale-110 ring-2 ring-white/40 z-10' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={
                    selected
                      ? { backgroundColor: color, borderColor: color }
                      : { color, borderColor: ratingColor(n, min, max, 0.4), backgroundColor: ratingColor(n, min, max, 0.12) }
                  }
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case 'select':
      if ((field.options || []).length > 12) {
        return (
          <div>
            {label}
            <select
              id={`field-${field.id}`}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <div>
          <span className="block text-xs font-bold text-stone-200 mb-1.5">
            {field.label}
            {field.required && <span className="text-rose-400"> *</span>}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(field.options || []).map((opt) => {
              const selected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(selected ? '' : opt)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    selected ? 'text-white' : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
                  }`}
                  style={selected ? { backgroundColor: `${accent}33`, borderColor: accent } : undefined}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'relation': {
      const related = categories.find((c) => c.id === field.relatedCategoryId);
      const names = related
        ? Array.from(
            new Set(
              entries
                .filter((e) => e.categoryId === related.id)
                .map((e) => entryTitle(related, e))
                .filter((n) => n !== 'Untitled')
            )
          ).sort((a, b) => a.localeCompare(b))
        : [];
      const chosen = splitList(value);
      const toggle = (name: string) => {
        const next = chosen.includes(name) ? chosen.filter((n) => n !== name) : [...chosen, name];
        onChange(next.join(', '));
      };
      return (
        <div>
          {label}
          {names.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {names.map((name) => {
                const selected = chosen.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(name)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                      selected ? 'text-white' : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
                    }`}
                    style={selected && related ? { backgroundColor: `${related.color}33`, borderColor: related.color } : undefined}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          <input
            id={`field-${field.id}`}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={related ? `Comma-separated ${related.label.toLowerCase()}` : 'Comma-separated'}
            className={inputClass}
          />
        </div>
      );
    }

    case 'notes':
      return (
        <div>
          {label}
          <textarea
            id={`field-${field.id}`}
            rows={3}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </div>
      );

    case 'links':
      return (
        <div>
          {label}
          <textarea
            id={`field-${field.id}`}
            rows={2}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="One link per line"
            className={`${inputClass} resize-y font-mono`}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          {label}
          <input
            id={`field-${field.id}`}
            type="number"
            inputMode="decimal"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
            className={inputClass}
          />
        </div>
      );

    case 'date':
    case 'time':
      return (
        <div>
          {label}
          <input
            id={`field-${field.id}`}
            type={field.type}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
      );

    case 'text':
    default:
      return (
        <div>
          {label}
          <input
            id={`field-${field.id}`}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        </div>
      );
  }
};

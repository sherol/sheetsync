import React, { useState } from 'react';
import { Pencil, X, Plus, Check, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { CustomField, ListDef } from '../types';
import { splitList } from '../config/categories';

interface ListPickerProps {
  field: CustomField;
  list: ListDef | undefined;
  value: any;
  onChange: (value: any) => void;
  accent: string;
  /** Save the list's items (shared by every field that uses it, and synced with the layout). */
  onUpdateList: (listId: string, items: string[]) => void;
}

const inputClass =
  'w-full px-3 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-stone-500';

/**
 * A dropdown of a shared list's items, with an inline editor to add, rename, reorder and remove
 * items. With `multiple`, each pick becomes a removable chip and the value is comma-separated.
 */
export const ListPicker: React.FC<ListPickerProps> = ({ field, list, value, onChange, accent, onUpdateList }) => {
  const [editing, setEditing] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [renaming, setRenaming] = useState<{ index: number; text: string } | null>(null);

  const items = list?.items ?? [];
  const chosen = field.multiple ? splitList(value) : value ? [String(value)] : [];
  const listName = list?.label ?? 'list';

  const choose = (item: string) => {
    if (!item) return;
    if (field.multiple) {
      if (!chosen.includes(item)) onChange([...chosen, item].join(', '));
    } else {
      onChange(item);
    }
  };
  const unchoose = (item: string) => {
    const next = chosen.filter((c) => c !== item);
    onChange(field.multiple ? next.join(', ') : '');
  };

  const save = (next: string[]) => {
    if (list) onUpdateList(list.id, next);
  };
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    if (!items.some((i) => i.toLowerCase() === text.toLowerCase())) save([...items, text]);
    setNewItem('');
  };
  const renameItem = (index: number, text: string) => {
    const clean = text.trim();
    setRenaming(null);
    if (!clean || clean === items[index]) return;
    const old = items[index];
    save(items.map((it, i) => (i === index ? clean : it)));
    // Keep the current pick pointing at the renamed item.
    if (chosen.includes(old)) onChange((field.multiple ? chosen.map((c) => (c === old ? clean : c)).join(', ') : clean));
  };
  const moveItem = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };
  const removeItem = (index: number) => save(items.filter((_, i) => i !== index));

  const available = items.filter((i) => !chosen.includes(i));

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={`field-${field.id}`} className="block text-xs font-bold text-stone-200">
          {field.label}
          {field.required && <span className="text-rose-400"> *</span>}
        </label>
        {list && (
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="text-[11px] font-semibold text-stone-400 hover:text-stone-200 flex items-center gap-1"
            aria-expanded={editing}
          >
            {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editing ? 'Done' : `Edit ${listName.toLowerCase()}`}
          </button>
        )}
      </div>

      {field.multiple && chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {chosen.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-[11px] font-bold rounded-lg border text-white"
              style={{ backgroundColor: `${accent}26`, borderColor: `${accent}88` }}
            >
              {c}
              <button type="button" onClick={() => unchoose(c)} aria-label={`Remove ${c}`} className="p-0.5 rounded hover:bg-black/20">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!list ? (
        <p className="text-[11px] text-rose-400">This field's list is missing. Edit the field in Category Studio.</p>
      ) : (
        <select
          id={`field-${field.id}`}
          value={field.multiple ? '' : chosen[0] ?? ''}
          onChange={(e) => (e.target.value ? choose(e.target.value) : !field.multiple && onChange(''))}
          className={inputClass}
        >
          <option value="">
            {items.length === 0
              ? `No ${listName.toLowerCase()} yet. Tap “Edit ${listName.toLowerCase()}” to add some`
              : field.multiple
                ? `Add from ${listName.toLowerCase()}…`
                : '—'}
          </option>
          {(field.multiple ? available : items).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      )}

      {editing && list && (
        <div className="mt-2 p-3 rounded-xl border border-stone-700 bg-stone-950/60 space-y-2">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
            {listName}, shared by every device
          </span>
          {items.length === 0 && <p className="text-[11px] text-stone-500">Empty. Add the first one below.</p>}
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={`${item}-${i}`} className="flex items-center gap-1">
                {renaming?.index === i ? (
                  <input
                    autoFocus
                    value={renaming.text}
                    onChange={(e) => setRenaming({ index: i, text: e.target.value })}
                    onBlur={() => renameItem(i, renaming.text)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        renameItem(i, renaming.text);
                      }
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className={`${inputClass} py-1`}
                    aria-label={`Rename ${item}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setRenaming({ index: i, text: item })}
                    className="flex-1 text-left text-xs text-stone-200 px-2 py-1 rounded-lg hover:bg-stone-800/70 truncate"
                    title="Tap to rename"
                  >
                    {item}
                  </button>
                )}
                <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-1 text-stone-500 hover:text-stone-200 disabled:opacity-30" aria-label={`Move ${item} up`}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="p-1 text-stone-500 hover:text-stone-200 disabled:opacity-30" aria-label={`Move ${item} down`}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => removeItem(i)} className="p-1 text-stone-500 hover:text-rose-400" aria-label={`Remove ${item} from the list`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder={`New ${listName.toLowerCase().replace(/s$/, '')}`}
              className={inputClass}
              aria-label={`Add to ${listName}`}
            />
            <button
              type="button"
              onClick={addItem}
              className="shrink-0 px-3 rounded-xl text-xs font-bold text-white flex items-center gap-1"
              style={{ backgroundColor: accent }}
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <p className="text-[10px] text-stone-500">Removing an item from the list doesn't change entries that already use it.</p>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Plus, Trash2, Settings2, Eye, EyeOff, Sparkles, Save, Database, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { AppConfig, CategoryDef, CustomField, FieldType } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CategorySettings, COLOR_SWATCHES } from './CategorySettings';
import { uniqueSheetName } from '../config/categories';
import { SYSTEM_TABS } from '../services/sheetsService';

interface DesktopStudioProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onSaveToSheet: () => void;
  isSavingToSheet: boolean;
  onRequestDeleteField: (category: CategoryDef, field: CustomField) => void;
  onRequestDeleteCategory: (category: CategoryDef) => void;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Single-line text',
  notes: 'Long notes',
  number: 'Number',
  rating: 'Rating scale',
  select: 'Choice (one of a list)',
  date: 'Date',
  time: 'Time',
  links: 'Links',
  relation: 'Link to another category',
  list: 'Dropdown from a shared list',
};

const inputClass =
  'w-full px-3 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500';

export const DesktopStudio: React.FC<DesktopStudioProps> = ({
  config,
  onUpdateConfig,
  onSaveToSheet,
  isSavingToSheet,
  onRequestDeleteField,
  onRequestDeleteCategory,
}) => {
  const [activeTab, setActiveTab] = useState<string>(config.categories[0]?.id ?? 'settings');
  const [isAddingField, setIsAddingField] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');
  const [newUnit, setNewUnit] = useState('');
  const [newOptions, setNewOptions] = useState('');
  const [newMin, setNewMin] = useState(1);
  const [newMax, setNewMax] = useState(10);
  const [newRelated, setNewRelated] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [newQuickLog, setNewQuickLog] = useState(true);
  const [newListId, setNewListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [newMultiple, setNewMultiple] = useState(true);
  const [newAllowNew, setNewAllowNew] = useState(true);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const category =
    config.categories.find((c) => c.id === activeTab) ??
    (activeTab === 'settings' ? undefined : config.categories[0]);

  const updateCategory = (updated: CategoryDef) => {
    onUpdateConfig({
      ...config,
      categories: config.categories.map((c) => (c.id === updated.id ? updated : c)),
    });
  };

  const toggleQuickLog = (cat: CategoryDef, fieldId: string) => {
    updateCategory({
      ...cat,
      fields: cat.fields.map((f) => (f.id === fieldId ? { ...f, showInQuickLog: f.showInQuickLog === false } : f)),
    });
  };

  const moveField = (cat: CategoryDef, index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= cat.fields.length) return;
    const fields = [...cat.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    updateCategory({ ...cat, fields });
  };

  const addCategory = () => {
    const taken = [...config.categories.map((c) => c.sheetName), ...SYSTEM_TABS.map((t) => t.sheetName)];
    const sheetName = uniqueSheetName('New', taken);
    const stamp = Date.now();
    const created: CategoryDef = {
      id: `c_${stamp}`,
      label: 'New',
      title: sheetName === 'New' ? 'New Tab' : `New Tab ${sheetName.split('_')[1]}`,
      sheetName,
      icon: 'star',
      color: COLOR_SWATCHES[config.categories.length % COLOR_SWATCHES.length],
      titleFieldId: `f_${stamp}_name`,
      dateFieldId: `f_${stamp}_date`,
      fields: [
        { id: `f_${stamp}_name`, label: 'Name', type: 'text', required: true, showInQuickLog: true },
        { id: `f_${stamp}_date`, label: 'Date', type: 'date', showInQuickLog: true },
        { id: `f_${stamp}_notes`, label: 'Notes', type: 'notes', showInQuickLog: true },
      ],
    };
    onUpdateConfig({ ...config, categories: [...config.categories, created] });
    setActiveTab(created.id);
    resetForm();
  };

  const moveCategory = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= config.categories.length) return;
    const categories = [...config.categories];
    [categories[index], categories[target]] = [categories[target], categories[index]];
    onUpdateConfig({ ...config, categories });
  };

  const resetForm = () => {
    setNewLabel('');
    setNewType('text');
    setNewUnit('');
    setNewOptions('');
    setNewMin(1);
    setNewMax(10);
    setNewRelated('');
    setNewRequired(false);
    setNewQuickLog(true);
    setNewListId('');
    setNewListName('');
    setNewMultiple(true);
    setNewAllowNew(true);
    setIsAddingField(false);
    setEditingFieldId(null);
  };

  const editingOriginal = category?.fields.find((f) => f.id === editingFieldId);
  // The Bible tracker reads its book and chapters fields by type, so those keep theirs.
  const typeLocked =
    !!editingOriginal &&
    !!category?.bibleTracker &&
    [category.bibleTracker.bookFieldId, category.bibleTracker.chaptersFieldId].includes(editingOriginal.id);

  const startEditField = (field: CustomField) => {
    setIsAddingField(false);
    setEditingFieldId(field.id);
    setNewLabel(field.label);
    setNewType(field.type);
    setNewUnit(field.unit ?? '');
    setNewOptions((field.options ?? []).join(', '));
    setNewMin(field.min ?? 1);
    setNewMax(field.max ?? 10);
    setNewRelated(field.relatedCategoryId ?? '');
    setNewRequired(!!field.required);
    setNewQuickLog(field.showInQuickLog !== false);
    setNewListId(field.listId ?? '');
    setNewListName('');
    setNewMultiple(!!field.multiple);
    setNewAllowNew(!!field.allowNew);
  };

  // Add a field, or save changes to the one being edited. An edited field keeps its ID, so values
  // already logged stay with it (and with its sheet column).
  const handleSubmitField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !newLabel.trim()) return;

    const field: CustomField = {
      id: editingOriginal?.id ?? `f_${Date.now()}`,
      label: newLabel.trim(),
      type: newType,
      required: newRequired,
      showInQuickLog: newQuickLog,
      ...(editingOriginal?.placeholder ? { placeholder: editingOriginal.placeholder } : {}),
    };
    if (newType === 'number' && newUnit.trim()) field.unit = newUnit.trim();
    if (newType === 'select') {
      field.options = newOptions.split(',').map((s) => s.trim()).filter(Boolean);
      if (field.options.length === 0) return;
    }
    if (newType === 'rating') {
      field.min = Math.min(newMin, newMax);
      field.max = Math.max(newMin, newMax);
    }
    if (newType === 'relation') {
      if (!newRelated) return;
      field.relatedCategoryId = newRelated;
    }
    let lists = config.lists;
    if (newType === 'list') {
      if (newListId === '__new') {
        const name = newListName.trim();
        if (!name) return;
        const id = `l_${Date.now()}`;
        lists = [...lists, { id, label: name, items: [] }];
        field.listId = id;
      } else {
        if (!newListId) return;
        field.listId = newListId;
      }
      field.multiple = newMultiple;
      field.allowNew = newAllowNew;
    }

    const fields = editingOriginal
      ? category.fields.map((f) => (f.id === editingOriginal.id ? field : f))
      : [...category.fields, field];
    onUpdateConfig({
      ...config,
      lists,
      categories: config.categories.map((c) => (c.id === category.id ? { ...category, fields } : c)),
    });
    resetForm();
  };

  const fieldDetails = (field: CustomField): string => {
    if (field.type === 'select') {
      const opts = field.options || [];
      return opts.length > 6 ? `${opts.length} choices` : opts.join(', ');
    }
    if (field.type === 'rating') return `${field.min ?? 1} to ${field.max ?? 10}, green to red`;
    if (field.type === 'relation') {
      const rel = config.categories.find((c) => c.id === field.relatedCategoryId);
      return rel ? `Picks from ${rel.label}` : 'Linked category missing';
    }
    if (field.type === 'list') {
      const list = config.lists.find((l) => l.id === field.listId);
      if (!list) return 'List missing';
      return `${list.label} (${list.items.length} item${list.items.length === 1 ? '' : 's'})${field.multiple ? ', several allowed' : ''}${field.allowNew ? ', new allowed' : ''}`;
    }
    if (field.unit) return `Unit: ${field.unit}`;
    return '';
  };

  const renderFieldForm = () => {
    if (!category) return null;
    return (
      <form
                  onSubmit={handleSubmitField}
                  className="p-4 rounded-2xl border border-purple-500/30 bg-[#161926] space-y-3 shadow-xl"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {editingFieldId ? `Edit field: ${editingOriginal?.label ?? ''}` : `New field for ${category.label}`}
                    </span>
                    <button type="button" onClick={resetForm} className="text-stone-400 hover:text-stone-200 text-xs">
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-300 mb-1">Field label *</label>
                      <input
                        type="text"
                        required
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-300 mb-1">Input type</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as FieldType)}
                        disabled={typeLocked}
                        className={`${inputClass} disabled:opacity-50`}
                      >
                        {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                          <option key={t} value={t}>
                            {FIELD_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {newType === 'select' && (
                    <div>
                      <label className="block text-[11px] font-medium text-stone-300 mb-1">Choices (comma-separated) *</label>
                      <input
                        type="text"
                        required
                        value={newOptions}
                        onChange={(e) => setNewOptions(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}

                  {newType === 'number' && (
                    <div className="max-w-xs">
                      <label className="block text-[11px] font-medium text-stone-300 mb-1">Unit (optional)</label>
                      <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className={inputClass} />
                    </div>
                  )}

                  {newType === 'rating' && (
                    <div className="grid grid-cols-2 gap-3 max-w-xs">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-300 mb-1">Lowest (green)</label>
                        <input
                          type="number"
                          value={newMin}
                          onChange={(e) => setNewMin(parseInt(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-300 mb-1">Highest (red)</label>
                        <input
                          type="number"
                          value={newMax}
                          onChange={(e) => setNewMax(parseInt(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  {newType === 'relation' && (
                    <div className="max-w-xs">
                      <label className="block text-[11px] font-medium text-stone-300 mb-1">Pick entries from *</label>
                      <select required value={newRelated} onChange={(e) => setNewRelated(e.target.value)} className={inputClass}>
                        <option value="">Choose a category</option>
                        {config.categories
                          .filter((c) => c.id !== category.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {newType === 'list' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-300 mb-1">Shared list *</label>
                        <select required value={newListId} onChange={(e) => setNewListId(e.target.value)} className={inputClass}>
                          <option value="">Choose a list</option>
                          {config.lists.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.label} ({l.items.length})
                            </option>
                          ))}
                          <option value="__new">New list…</option>
                        </select>
                      </div>
                      {newListId === '__new' && (
                        <div>
                          <label className="block text-[11px] font-medium text-stone-300 mb-1">New list name *</label>
                          <input
                            type="text"
                            required
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            placeholder="e.g. Places"
                            className={inputClass}
                          />
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer sm:col-span-2">
                        <input type="checkbox" checked={newMultiple} onChange={(e) => setNewMultiple(e.target.checked)} />
                        <span>Allow several picks</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer sm:col-span-2">
                        <input type="checkbox" checked={newAllowNew} onChange={(e) => setNewAllowNew(e.target.checked)} />
                        <span>Offer “＋ New…” to add an item that isn't in the list</span>
                      </label>
                      <p className="text-[11px] text-stone-500 sm:col-span-2">
                        The list's items are edited from the form in the app (“Edit list”) and shared by every field that uses it.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                      <input type="checkbox" checked={newQuickLog} onChange={(e) => setNewQuickLog(e.target.checked)} />
                      <span>Show on main form</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                      <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
                      <span>Required</span>
                    </label>
                    <button
                      type="submit"
                      className="ml-auto px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-95 text-white text-xs font-bold shadow-md"
                    >
                      {editingFieldId ? 'Save Field' : 'Add Field'}
                    </button>
                  </div>
                </form>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#11131a] rounded-3xl border border-stone-800 shadow-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 bg-[#141722]/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 flex items-center justify-center text-white text-xs">
              <Settings2 className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide">Category & Field Editor</h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Each category is a tab in your Google Sheet; each field is a column.
          </p>
        </div>

        <button
          onClick={onSaveToSheet}
          disabled={isSavingToSheet}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-500 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSavingToSheet ? 'Saving...' : 'Save Layout to Sheet'}</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Category list */}
        <nav className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-stone-800 bg-[#0d0f15]/80 p-2 flex md:flex-col gap-1 overflow-x-auto">
          {config.categories.map((c) => {
            const active = c.id === category?.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveTab(c.id);
                  resetForm();
                }}
                className={`shrink-0 px-3 py-2 rounded-xl flex items-center gap-2 text-xs text-left transition-all border ${
                  active ? 'text-white font-bold' : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
                style={active ? { backgroundColor: `${c.color}22`, borderColor: `${c.color}66` } : undefined}
              >
                <CategoryIcon name={c.icon} className="w-4 h-4 shrink-0" color={c.color} />
                <span className="flex-1 truncate">{c.label}</span>
                <span className="text-[10px] font-mono text-stone-500">{c.fields.length}</span>
              </button>
            );
          })}
          <button
            onClick={addCategory}
            className="shrink-0 px-3 py-2 rounded-xl flex items-center gap-2 text-xs text-left transition-all border border-dashed border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 md:mt-1"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New tab</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('settings');
              resetForm();
            }}
            className={`shrink-0 px-3 py-2 rounded-xl flex items-center gap-2 text-xs text-left transition-all border md:mt-2 ${
              activeTab === 'settings'
                ? 'text-white font-bold bg-purple-500/15 border-purple-500/40'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Settings2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Settings</span>
          </button>
        </nav>

        <div className="flex-1 p-5 overflow-y-auto bg-[#0e1017]">
          {category && (
            <div className="space-y-4">
              <CategorySettings
                key={category.id}
                category={category}
                onChange={updateCategory}
                onRequestDelete={() => onRequestDeleteCategory(category)}
                takenSheetNames={[
                  ...config.categories.filter((c) => c.id !== category.id).map((c) => c.sheetName),
                  ...SYSTEM_TABS.map((t) => t.sheetName),
                ]}
              />

              <div className="flex items-center justify-between gap-3 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Fields</h3>
                <button
                  onClick={() => {
                    const opening = !isAddingField;
                    resetForm();
                    setIsAddingField(opening);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all text-white"
                  style={{ backgroundColor: `${category.color}22`, borderColor: `${category.color}66` }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Field</span>
                </button>
              </div>

              {isAddingField && renderFieldForm()}

              <div className="space-y-2">
                {category.fields.map((field, idx) =>
                  editingFieldId === field.id ? (
                    <div key={field.id}>{renderFieldForm()}</div>
                  ) : (
                  <div
                    key={field.id}
                    className="p-3.5 rounded-2xl border border-stone-800 hover:border-stone-700 bg-[#141620] flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 text-center text-xs font-mono text-stone-500">{idx + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{field.label}</span>
                          {field.required && <span className="text-[10px] text-rose-400 font-bold">required</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400 min-w-0">
                          <span className="font-mono bg-stone-900 border border-stone-800 px-2 py-0.5 rounded text-[10px] text-stone-300 shrink-0">
                            {FIELD_TYPE_LABELS[field.type] ?? field.type}
                          </span>
                          <span className="truncate">{fieldDetails(field)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveField(category, idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 text-stone-500 hover:text-stone-200 disabled:opacity-30 rounded-lg"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveField(category, idx, 1)}
                        disabled={idx === category.fields.length - 1}
                        className="p-1.5 text-stone-500 hover:text-stone-200 disabled:opacity-30 rounded-lg"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => startEditField(field)}
                        className="p-1.5 text-stone-500 hover:text-stone-200 rounded-lg"
                        title="Edit field"
                        aria-label={`Edit ${field.label}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleQuickLog(category, field.id)}
                        className={`p-1.5 rounded-xl text-xs flex items-center gap-1.5 border transition-all ${
                          field.showInQuickLog !== false
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-stone-900 border-stone-800 text-stone-500'
                        }`}
                        title={field.showInQuickLog !== false ? 'Shown on the main form' : 'Under "more fields"'}
                      >
                        {field.showInQuickLog !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline text-[11px] font-medium">
                          {field.showInQuickLog !== false ? 'Main form' : 'More fields'}
                        </span>
                      </button>
                      <button
                        onClick={() => onRequestDeleteField(category, field)}
                        className="p-1.5 text-stone-500 hover:text-rose-400 rounded-lg transition-colors"
                        title="Remove field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Home Screen Order</h3>
                <p className="text-xs text-stone-400 mt-0.5">The app opens on a list of every category, top to bottom in this order.</p>
              </div>

              <div className="p-2 rounded-2xl border border-stone-800 bg-[#141620] space-y-1">
                {config.categories.map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-stone-900/60">
                    <span className="w-5 text-center text-[11px] font-mono text-stone-500">{idx + 1}</span>
                    <CategoryIcon name={c.icon} className="w-4 h-4 shrink-0" color={c.color} />
                    <span className="flex-1 text-xs text-stone-200 truncate">{c.label}</span>
                    <button
                      onClick={() => moveCategory(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 text-stone-500 hover:text-stone-200 disabled:opacity-30 rounded-lg"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveCategory(idx, 1)}
                      disabled={idx === config.categories.length - 1}
                      className="p-1.5 text-stone-500 hover:text-stone-200 disabled:opacity-30 rounded-lg"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-blue-950/30 border border-purple-500/20 text-xs text-stone-300 space-y-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-cyan-400" />
                  How fields map to your sheet
                </span>
                <p>
                  Every saved entry is a row in its category's tab, with an ID and save time followed by one column per
                  field, in the order shown here. Adding or reordering fields updates the header row the next time you
                  save an entry; rows already in the sheet keep their original column positions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

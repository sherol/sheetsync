import { CategoryDef } from '../types';
import { BIBLE_BOOKS } from './bible';

const SCALE_1_10 = { min: 1, max: 10 };

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  {
    id: 'media',
    label: 'Media',
    sheetName: 'Media',
    icon: 'media',
    color: '#f43f5e',
    titleFieldId: 'title',
    dateFieldId: 'date',
    fields: [
      { id: 'title', label: 'Title', type: 'text', required: true, showInQuickLog: true },
      { id: 'type', label: 'Type', type: 'select', options: ['Book', 'Movie', 'TV', 'Game'], required: true, showInQuickLog: true },
      { id: 'date', label: 'Date Consumed', type: 'date', showInQuickLog: true },
      { id: 'review', label: 'Review', type: 'notes', showInQuickLog: true },
      { id: 'links', label: 'Links', type: 'links', showInQuickLog: true },
    ],
  },
  {
    id: 'food',
    label: 'Medicine & Food',
    sheetName: 'Medicine_Food',
    icon: 'food',
    color: '#fb923c',
    titleFieldId: 'item',
    dateFieldId: 'date',
    fields: [
      { id: 'date', label: 'Date', type: 'date', required: true, showInQuickLog: true },
      { id: 'time', label: 'Time', type: 'time', showInQuickLog: true },
      { id: 'type', label: 'Type', type: 'select', options: ['Med', 'Snack', 'Meal', 'Drink'], required: true, showInQuickLog: true },
      { id: 'item', label: 'Food / Drink / Activity', type: 'text', required: true, showInQuickLog: true },
      { id: 'amount', label: 'Amount', type: 'text', showInQuickLog: true },
      { id: 'feeling', label: 'How do I feel?', type: 'notes', showInQuickLog: true },
      { id: 'hunger', label: 'Hunger Level', type: 'rating', ...SCALE_1_10, showInQuickLog: true },
      { id: 'burning', label: 'Burning Level', type: 'rating', ...SCALE_1_10, showInQuickLog: true },
      { id: 'stress', label: 'Stress', type: 'rating', ...SCALE_1_10, showInQuickLog: true },
    ],
  },
  {
    id: 'memories',
    label: 'Memories',
    sheetName: 'Memories',
    icon: 'memories',
    color: '#facc15',
    titleFieldId: 'what',
    dateFieldId: 'date',
    fields: [
      { id: 'date', label: 'Date', type: 'date', required: true, showInQuickLog: true },
      { id: 'location', label: 'Location', type: 'text', showInQuickLog: true },
      { id: 'who', label: 'Who Was There', type: 'text', showInQuickLog: true },
      { id: 'what', label: 'What Happened', type: 'notes', required: true, showInQuickLog: true },
      { id: 'results', label: 'Results', type: 'notes', showInQuickLog: true },
    ],
  },
  {
    id: 'mood',
    label: 'Mood',
    sheetName: 'Mood',
    icon: 'mood',
    color: '#84cc16',
    titleFieldId: 'recap',
    dateFieldId: 'date',
    fields: [
      { id: 'date', label: 'Date', type: 'date', required: true, showInQuickLog: true },
      { id: 'score', label: 'Mood Score', type: 'rating', ...SCALE_1_10, required: true, showInQuickLog: true },
      { id: 'recap', label: 'Daily Recap', type: 'notes', showInQuickLog: true },
    ],
  },
  {
    id: 'recipes',
    label: 'Meals & Recipes',
    sheetName: 'Meals_Recipes',
    icon: 'recipes',
    color: '#10b981',
    titleFieldId: 'name',
    dateFieldId: 'lastCooked',
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true, showInQuickLog: true },
      { id: 'type', label: 'Type', type: 'text', showInQuickLog: true },
      { id: 'ingredients', label: 'Ingredients', type: 'notes', showInQuickLog: true },
      { id: 'directions', label: 'Directions', type: 'notes', showInQuickLog: true },
      { id: 'lastCooked', label: 'Last Cooked', type: 'date', showInQuickLog: true },
      { id: 'links', label: 'Links', type: 'links', showInQuickLog: true },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    sheetName: 'Projects',
    icon: 'projects',
    color: '#06b6d4',
    titleFieldId: 'name',
    dateFieldId: 'date',
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true, showInQuickLog: true },
      { id: 'type', label: 'Type', type: 'text', showInQuickLog: true },
      { id: 'date', label: 'Date', type: 'date', showInQuickLog: true },
      { id: 'about', label: 'About', type: 'notes', showInQuickLog: true },
      { id: 'links', label: 'Links', type: 'links', showInQuickLog: true },
    ],
  },
  {
    id: 'people',
    label: 'People',
    sheetName: 'People',
    icon: 'people',
    color: '#3b82f6',
    titleFieldId: 'name',
    dateFieldId: 'lastContact',
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true, showInQuickLog: true },
      { id: 'lastContact', label: 'Last Contact', type: 'date', showInQuickLog: true },
      { id: 'todos', label: 'To-dos', type: 'notes', showInQuickLog: true },
      { id: 'projects', label: 'Associated Projects', type: 'relation', relatedCategoryId: 'projects', showInQuickLog: true },
    ],
  },
  {
    id: 'presentations',
    label: 'Presentations & Writings',
    sheetName: 'Presentations_Writings',
    icon: 'presentations',
    color: '#8b5cf6',
    titleFieldId: 'title',
    dateFieldId: 'when',
    fields: [
      { id: 'title', label: 'Title', type: 'text', required: true, showInQuickLog: true },
      { id: 'about', label: 'About', type: 'notes', showInQuickLog: true },
      { id: 'where', label: 'Where', type: 'text', showInQuickLog: true },
      { id: 'when', label: 'When', type: 'date', showInQuickLog: true },
      { id: 'who', label: 'Who Was There', type: 'text', showInQuickLog: true },
      { id: 'slides', label: 'Slides', type: 'links', showInQuickLog: true },
      { id: 'links', label: 'Links', type: 'links', showInQuickLog: true },
    ],
  },
  {
    id: 'ideas',
    label: 'Prototypes & Ideas',
    sheetName: 'Prototypes_Ideas',
    icon: 'ideas',
    color: '#d946ef',
    titleFieldId: 'name',
    dateFieldId: 'date',
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true, showInQuickLog: true },
      { id: 'type', label: 'Type', type: 'text', showInQuickLog: true },
      { id: 'date', label: 'Date', type: 'date', showInQuickLog: true },
      { id: 'idea', label: 'Idea', type: 'notes', showInQuickLog: true },
      { id: 'projects', label: 'Related Projects', type: 'relation', relatedCategoryId: 'projects', showInQuickLog: true },
      { id: 'links', label: 'Links', type: 'links', showInQuickLog: true },
    ],
  },
  {
    id: 'prayer',
    label: 'Prayer',
    sheetName: 'Prayer',
    icon: 'prayer',
    color: '#f472b6',
    titleFieldId: 'prayer',
    dateFieldId: 'date',
    bibleTracker: { bookFieldId: 'book', chaptersFieldId: 'chapters' },
    fields: [
      { id: 'date', label: 'Date', type: 'date', required: true, showInQuickLog: true },
      { id: 'prayer', label: 'Prayer', type: 'notes', showInQuickLog: true },
      { id: 'book', label: 'Book Studied', type: 'select', options: BIBLE_BOOKS.map((b) => b.name), showInQuickLog: true },
      { id: 'chapters', label: 'Chapters', type: 'text', placeholder: 'e.g. 1-3, 5 or all', showInQuickLog: true },
      { id: 'studyNotes', label: 'Study Notes', type: 'notes', showInQuickLog: true },
      { id: 'answered', label: 'Answered', type: 'select', options: ['Waiting', 'Answered'], showInQuickLog: true },
    ],
  },
];

/**
 * Colour for a value on a rating scale, running from blue at the minimum
 * through cyan, green, yellow and orange to red at the maximum.
 */
export function ratingColor(value: number, min = 1, max = 10, alpha = 1): string {
  const t = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const hue = Math.round(220 - t * 220);
  return `hsl(${hue} 85% 55% / ${alpha})`;
}

export function entryTitle(category: CategoryDef, entry: { values: Record<string, any> }): string {
  const raw = category.titleFieldId ? entry.values[category.titleFieldId] : undefined;
  const text = String(raw ?? '').trim();
  if (text) return text.length > 80 ? `${text.slice(0, 77)}...` : text;
  for (const f of category.fields) {
    if (f.type !== 'text' && f.type !== 'notes' && f.type !== 'select') continue;
    const v = String(entry.values[f.id] ?? '').trim();
    if (v) return v.length > 80 ? `${v.slice(0, 77)}...` : v;
  }
  return 'Untitled';
}

export function entryDate(category: CategoryDef, entry: { timestamp: string; values: Record<string, any> }): string {
  const d = category.dateFieldId ? entry.values[category.dateFieldId] : undefined;
  return typeof d === 'string' && d ? d : entry.timestamp.slice(0, 10);
}

export function splitLinks(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function splitList(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

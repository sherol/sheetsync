export interface BibleBook {
  name: string;
  abbr: string;
  chapters: number;
  testament: 'OT' | 'NT';
}

export const BIBLE_BOOKS: BibleBook[] = [
  { name: 'Genesis', abbr: 'Gen', chapters: 50, testament: 'OT' },
  { name: 'Exodus', abbr: 'Exod', chapters: 40, testament: 'OT' },
  { name: 'Leviticus', abbr: 'Lev', chapters: 27, testament: 'OT' },
  { name: 'Numbers', abbr: 'Num', chapters: 36, testament: 'OT' },
  { name: 'Deuteronomy', abbr: 'Deut', chapters: 34, testament: 'OT' },
  { name: 'Joshua', abbr: 'Josh', chapters: 24, testament: 'OT' },
  { name: 'Judges', abbr: 'Judg', chapters: 21, testament: 'OT' },
  { name: 'Ruth', abbr: 'Ruth', chapters: 4, testament: 'OT' },
  { name: '1 Samuel', abbr: '1Sam', chapters: 31, testament: 'OT' },
  { name: '2 Samuel', abbr: '2Sam', chapters: 24, testament: 'OT' },
  { name: '1 Kings', abbr: '1Kgs', chapters: 22, testament: 'OT' },
  { name: '2 Kings', abbr: '2Kgs', chapters: 25, testament: 'OT' },
  { name: '1 Chronicles', abbr: '1Chr', chapters: 29, testament: 'OT' },
  { name: '2 Chronicles', abbr: '2Chr', chapters: 36, testament: 'OT' },
  { name: 'Ezra', abbr: 'Ezra', chapters: 10, testament: 'OT' },
  { name: 'Nehemiah', abbr: 'Neh', chapters: 13, testament: 'OT' },
  { name: 'Esther', abbr: 'Esth', chapters: 10, testament: 'OT' },
  { name: 'Job', abbr: 'Job', chapters: 42, testament: 'OT' },
  { name: 'Psalms', abbr: 'Ps', chapters: 150, testament: 'OT' },
  { name: 'Proverbs', abbr: 'Prov', chapters: 31, testament: 'OT' },
  { name: 'Ecclesiastes', abbr: 'Eccl', chapters: 12, testament: 'OT' },
  { name: 'Song of Songs', abbr: 'Song', chapters: 8, testament: 'OT' },
  { name: 'Isaiah', abbr: 'Isa', chapters: 66, testament: 'OT' },
  { name: 'Jeremiah', abbr: 'Jer', chapters: 52, testament: 'OT' },
  { name: 'Lamentations', abbr: 'Lam', chapters: 5, testament: 'OT' },
  { name: 'Ezekiel', abbr: 'Ezek', chapters: 48, testament: 'OT' },
  { name: 'Daniel', abbr: 'Dan', chapters: 12, testament: 'OT' },
  { name: 'Hosea', abbr: 'Hos', chapters: 14, testament: 'OT' },
  { name: 'Joel', abbr: 'Joel', chapters: 3, testament: 'OT' },
  { name: 'Amos', abbr: 'Amos', chapters: 9, testament: 'OT' },
  { name: 'Obadiah', abbr: 'Obad', chapters: 1, testament: 'OT' },
  { name: 'Jonah', abbr: 'Jonah', chapters: 4, testament: 'OT' },
  { name: 'Micah', abbr: 'Mic', chapters: 7, testament: 'OT' },
  { name: 'Nahum', abbr: 'Nah', chapters: 3, testament: 'OT' },
  { name: 'Habakkuk', abbr: 'Hab', chapters: 3, testament: 'OT' },
  { name: 'Zephaniah', abbr: 'Zeph', chapters: 3, testament: 'OT' },
  { name: 'Haggai', abbr: 'Hag', chapters: 2, testament: 'OT' },
  { name: 'Zechariah', abbr: 'Zech', chapters: 14, testament: 'OT' },
  { name: 'Malachi', abbr: 'Mal', chapters: 4, testament: 'OT' },
  { name: 'Matthew', abbr: 'Matt', chapters: 28, testament: 'NT' },
  { name: 'Mark', abbr: 'Mark', chapters: 16, testament: 'NT' },
  { name: 'Luke', abbr: 'Luke', chapters: 24, testament: 'NT' },
  { name: 'John', abbr: 'John', chapters: 21, testament: 'NT' },
  { name: 'Acts', abbr: 'Acts', chapters: 28, testament: 'NT' },
  { name: 'Romans', abbr: 'Rom', chapters: 16, testament: 'NT' },
  { name: '1 Corinthians', abbr: '1Cor', chapters: 16, testament: 'NT' },
  { name: '2 Corinthians', abbr: '2Cor', chapters: 13, testament: 'NT' },
  { name: 'Galatians', abbr: 'Gal', chapters: 6, testament: 'NT' },
  { name: 'Ephesians', abbr: 'Eph', chapters: 6, testament: 'NT' },
  { name: 'Philippians', abbr: 'Phil', chapters: 4, testament: 'NT' },
  { name: 'Colossians', abbr: 'Col', chapters: 4, testament: 'NT' },
  { name: '1 Thessalonians', abbr: '1Thess', chapters: 5, testament: 'NT' },
  { name: '2 Thessalonians', abbr: '2Thess', chapters: 3, testament: 'NT' },
  { name: '1 Timothy', abbr: '1Tim', chapters: 6, testament: 'NT' },
  { name: '2 Timothy', abbr: '2Tim', chapters: 4, testament: 'NT' },
  { name: 'Titus', abbr: 'Titus', chapters: 3, testament: 'NT' },
  { name: 'Philemon', abbr: 'Phlm', chapters: 1, testament: 'NT' },
  { name: 'Hebrews', abbr: 'Heb', chapters: 13, testament: 'NT' },
  { name: 'James', abbr: 'Jas', chapters: 5, testament: 'NT' },
  { name: '1 Peter', abbr: '1Pet', chapters: 5, testament: 'NT' },
  { name: '2 Peter', abbr: '2Pet', chapters: 3, testament: 'NT' },
  { name: '1 John', abbr: '1John', chapters: 5, testament: 'NT' },
  { name: '2 John', abbr: '2John', chapters: 1, testament: 'NT' },
  { name: '3 John', abbr: '3John', chapters: 1, testament: 'NT' },
  { name: 'Jude', abbr: 'Jude', chapters: 1, testament: 'NT' },
  { name: 'Revelation', abbr: 'Rev', chapters: 22, testament: 'NT' },
];

export const TOTAL_BIBLE_CHAPTERS = BIBLE_BOOKS.reduce((n, b) => n + b.chapters, 0);

/**
 * Parse a chapter list such as "1-3, 5, 7–9" into chapter numbers within
 * 1..max. "all" means the whole book; a blank value means no chapters.
 */
export function parseChapters(input: unknown, max: number): number[] {
  const text = String(input ?? '').trim();
  if (!text) return [];
  if (/^(all|whole|entire)/i.test(text)) return Array.from({ length: max }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
    if (!m) continue;
    let a = parseInt(m[1], 10);
    let b = m[2] ? parseInt(m[2], 10) : a;
    if (a > b) [a, b] = [b, a];
    for (let c = Math.max(1, a); c <= Math.min(max, b); c++) out.add(c);
  }
  return [...out].sort((x, y) => x - y);
}

export interface BookProgress {
  book: BibleBook;
  studied: Set<number>;
  sessions: number;
}

/** Chapters studied per book, from (book, chapters) pairs. */
export function bibleProgress(records: { book: unknown; chapters: unknown }[]): BookProgress[] {
  const byName = new Map(BIBLE_BOOKS.map((b) => [b.name, { book: b, studied: new Set<number>(), sessions: 0 }]));
  for (const r of records) {
    const p = byName.get(String(r.book ?? ''));
    if (!p) continue;
    p.sessions += 1;
    for (const c of parseChapters(r.chapters, p.book.chapters)) p.studied.add(c);
  }
  return [...byName.values()];
}

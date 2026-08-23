// Parse human verse references ("Gen 12:8", "1 Kings 18:19-21") and check
// them against a place's known OSIS refs ("Gen.12.8") from the gazetteer.

const BOOKS: [string, string[]][] = [
  ['Gen', ['genesis', 'gen', 'gn', 'ge']],
  ['Exod', ['exodus', 'exod', 'exo', 'ex']],
  ['Lev', ['leviticus', 'lev', 'lv']],
  ['Num', ['numbers', 'num', 'nm', 'nu', 'nb']],
  ['Deut', ['deuteronomy', 'deut', 'deu', 'dt']],
  ['Josh', ['joshua', 'josh', 'jos', 'jsh']],
  ['Judg', ['judges', 'judg', 'jdg', 'jgs']],
  ['Ruth', ['ruth', 'ru', 'rth']],
  ['1Sam', ['1samuel', '1sam', '1sa', '1sm']],
  ['2Sam', ['2samuel', '2sam', '2sa', '2sm']],
  ['1Kgs', ['1kings', '1kgs', '1ki', '1kin']],
  ['2Kgs', ['2kings', '2kgs', '2ki', '2kin']],
  ['1Chr', ['1chronicles', '1chr', '1ch', '1chron']],
  ['2Chr', ['2chronicles', '2chr', '2ch', '2chron']],
  ['Ezra', ['ezra', 'ezr']],
  ['Neh', ['nehemiah', 'neh', 'ne']],
  ['Esth', ['esther', 'esth', 'est', 'es']],
  ['Job', ['job', 'jb']],
  ['Ps', ['psalms', 'psalm', 'ps', 'psa', 'pss']],
  ['Prov', ['proverbs', 'prov', 'prv', 'pr']],
  ['Eccl', ['ecclesiastes', 'eccl', 'ecc']],
  ['Song', ['songofsolomon', 'songofsongs', 'song', 'sos', 'canticles', 'cant']],
  ['Isa', ['isaiah', 'isa', 'is']],
  ['Jer', ['jeremiah', 'jer', 'je']],
  ['Lam', ['lamentations', 'lam', 'la']],
  ['Ezek', ['ezekiel', 'ezek', 'eze', 'ezk']],
  ['Dan', ['daniel', 'dan', 'da', 'dn']],
  ['Hos', ['hosea', 'hos', 'ho']],
  ['Joel', ['joel', 'joe', 'jl']],
  ['Amos', ['amos', 'am']],
  ['Obad', ['obadiah', 'obad', 'ob']],
  ['Jonah', ['jonah', 'jon', 'jnh']],
  ['Mic', ['micah', 'mic', 'mc']],
  ['Nah', ['nahum', 'nah', 'na']],
  ['Hab', ['habakkuk', 'hab', 'hb']],
  ['Zeph', ['zephaniah', 'zeph', 'zep']],
  ['Hag', ['haggai', 'hag', 'hg']],
  ['Zech', ['zechariah', 'zech', 'zec']],
  ['Mal', ['malachi', 'mal', 'ml']],
  ['Matt', ['matthew', 'matt', 'mat', 'mt']],
  ['Mark', ['mark', 'mrk', 'mk', 'mr']],
  ['Luke', ['luke', 'luk', 'lk']],
  ['John', ['john', 'joh', 'jhn', 'jn']],
  ['Acts', ['acts', 'act', 'ac']],
  ['Rom', ['romans', 'rom', 'ro', 'rm']],
  ['1Cor', ['1corinthians', '1cor', '1co']],
  ['2Cor', ['2corinthians', '2cor', '2co']],
  ['Gal', ['galatians', 'gal', 'ga']],
  ['Eph', ['ephesians', 'eph']],
  ['Phil', ['philippians', 'phil', 'php', 'philip']],
  ['Col', ['colossians', 'col']],
  ['1Thess', ['1thessalonians', '1thess', '1thes', '1th']],
  ['2Thess', ['2thessalonians', '2thess', '2thes', '2th']],
  ['1Tim', ['1timothy', '1tim', '1ti']],
  ['2Tim', ['2timothy', '2tim', '2ti']],
  ['Titus', ['titus', 'tit']],
  ['Phlm', ['philemon', 'phlm', 'phm', 'philem']],
  ['Heb', ['hebrews', 'heb']],
  ['Jas', ['james', 'jas', 'jam']],
  ['1Pet', ['1peter', '1pet', '1pe', '1pt']],
  ['2Pet', ['2peter', '2pet', '2pe', '2pt']],
  ['1John', ['1john', '1jn', '1jo', '1jhn']],
  ['2John', ['2john', '2jn', '2jo']],
  ['3John', ['3john', '3jn', '3jo']],
  ['Jude', ['jude', 'jud']],
  ['Rev', ['revelation', 'rev', 're', 'apocalypse']],
];

const bookIndex = new Map<string, string>();
for (const [osis, names] of BOOKS) {
  bookIndex.set(osis.toLowerCase(), osis);
  for (const n of names) bookIndex.set(n, osis);
}

function normBook(raw: string): string | null {
  let s = raw.trim().toLowerCase()
    .replace(/^first\s+/, '1').replace(/^second\s+/, '2').replace(/^third\s+/, '3')
    .replace(/^iii\s*/, '3').replace(/^ii\s*/, '2').replace(/^i\s+/, '1');
  s = s.replace(/[^a-z0-9]/g, '');
  return bookIndex.get(s) ?? null;
}

export interface ParsedRef {
  book: string; // OSIS code
  chapter: number;
  vStart: number | null; // null = whole chapter
  vEnd: number | null;
}

export function parseRef(ref: string): ParsedRef | null {
  const m = ref.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!m) return null;
  const book = normBook(m[1]);
  if (!book) return null;
  const vStart = m[3] ? Number(m[3]) : null;
  return { book, chapter: Number(m[2]), vStart, vEnd: m[4] ? Number(m[4]) : vStart };
}

/**
 * Does `ref` fall among a place's known OSIS mentions?
 * Returns null when the ref can't be parsed (no verdict).
 */
export function refMatchesPlace(osisRefs: string[], ref: string): boolean | null {
  const p = parseRef(ref);
  if (!p) return null;
  for (const osis of osisRefs) {
    const [b, c, v] = osis.split('.');
    if (b !== p.book || Number(c) !== p.chapter) continue;
    if (p.vStart === null) return true; // chapter-level ref
    const vn = Number(v);
    if (vn >= p.vStart && vn <= (p.vEnd ?? p.vStart)) return true;
  }
  return false;
}

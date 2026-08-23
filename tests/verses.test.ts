import { describe, it, expect } from 'vitest';
import { parseRef, refMatchesPlace } from '../src/services/verses';

describe('parseRef', () => {
  it('parses book chapter:verse', () => {
    expect(parseRef('Gen 12:8')).toEqual({ book: 'Gen', chapter: 12, vStart: 8, vEnd: 8 });
  });
  it('parses ranges and full book names', () => {
    expect(parseRef('Genesis 12:6-7')).toEqual({ book: 'Gen', chapter: 12, vStart: 6, vEnd: 7 });
  });
  it('parses numbered books in several styles', () => {
    expect(parseRef('1 Kings 18:19')?.book).toBe('1Kgs');
    expect(parseRef('I Kings 18:19')?.book).toBe('1Kgs');
    expect(parseRef('First Kings 18:19')?.book).toBe('1Kgs');
    expect(parseRef('2 Cor 11:32')?.book).toBe('2Cor');
  });
  it('parses chapter-only refs', () => {
    expect(parseRef('Acts 27')).toEqual({ book: 'Acts', chapter: 27, vStart: null, vEnd: null });
  });
  it('returns null for garbage', () => {
    expect(parseRef('somewhere nice')).toBeNull();
    expect(parseRef('')).toBeNull();
  });
});

describe('refMatchesPlace', () => {
  const refs = ['Gen.12.8', 'Gen.13.3', '1Kgs.18.19'];
  it('matches exact verse', () => {
    expect(refMatchesPlace(refs, 'Gen 12:8')).toBe(true);
  });
  it('matches when ref range covers a mention', () => {
    expect(refMatchesPlace(refs, 'Gen 12:6-9')).toBe(true);
  });
  it('matches chapter-only refs', () => {
    expect(refMatchesPlace(refs, 'Genesis 13')).toBe(true);
  });
  it('rejects verses the place never appears in', () => {
    expect(refMatchesPlace(refs, 'Gen 14:1')).toBe(false);
    expect(refMatchesPlace(refs, 'Exod 12:8')).toBe(false);
  });
  it('returns null (no verdict) for unparsable refs', () => {
    expect(refMatchesPlace(refs, 'near the altar')).toBeNull();
  });
});

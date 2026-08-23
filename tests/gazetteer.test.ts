import { describe, it, expect } from 'vitest';
import { lookupPlace, applyGazetteer, gazetteerCount } from '../src/services/gazetteer';
import type { RawStop } from '../src/types';

describe('lookupPlace (OpenBible dataset)', () => {
  it('ships the full dataset', () => {
    expect(gazetteerCount).toBeGreaterThanOrEqual(1300);
  });
  it('matches case-insensitively with verified coordinates', () => {
    const e = lookupPlace('bethel')!;
    expect(e.name).toBe('Bethel');
    expect(e.lat).toBeCloseTo(31.92, 1);
    expect(e.confidence).toBeGreaterThan(900);
    expect(e.photo?.url).toContain('wikimedia');
  });
  it('matches translation-variant aliases', () => {
    expect(lookupPlace('Beth-el')?.name).toBe('Bethel');
    expect(lookupPlace('Charran')?.name).toBe('Haran');
  });
  it('ignores a leading "the"', () => {
    expect(lookupPlace('the Negeb')?.name).toBe('Negeb');
  });
  it('disambiguates duplicates by proximity to the model guess', () => {
    const pisidian = lookupPlace('Antioch', { lat: 38.3, lng: 31.2 })!;
    expect(pisidian.lng).toBeCloseTo(31.19, 1);
    const syrian = lookupPlace('Antioch', { lat: 36.2, lng: 36.2 })!;
    expect(syrian.lng).toBeCloseTo(36.17, 1);
  });
  it('falls back to highest identification confidence without a hint', () => {
    expect(lookupPlace('Ur')!.lng).toBeCloseTo(46.1, 1); // Tell el-Muqayyir over the Urfa tradition
  });
  it('returns null for unknown places', () => {
    expect(lookupPlace('Narnia')).toBeNull();
  });
});

describe('applyGazetteer', () => {
  const raw = (name: string, lat = 0, lng = 0, verseRef = 'Gen 12:8'): RawStop => ({
    name, modernHint: '', lat, lng, event: 'x', verseRef,
  });

  it('overrides coords, attaches confidence/photo, and validates the verse', () => {
    const [s] = applyGazetteer([raw('Bethel', 31.9, 35.2, 'Gen 12:8')]);
    expect(s.coordSource).toBe('gazetteer');
    expect(s.lat).toBeCloseTo(31.92, 1);
    expect(s.confidence).toBeGreaterThan(900);
    expect(s.photo?.url).toBeTruthy();
    expect(s.verseOk).toBe(true);
    expect(s.modernHint).toBe('Beitin'); // filled from the dataset when the model gave none
  });
  it('flags verse mismatches', () => {
    const [s] = applyGazetteer([raw('Bethel', 31.9, 35.2, 'Gen 40:1')]);
    expect(s.verseOk).toBe(false);
  });
  it('keeps model coords for unknown places', () => {
    const [s] = applyGazetteer([raw('Narnia', 12.3, 45.6)]);
    expect(s.coordSource).toBe('model');
    expect(s.lat).toBe(12.3);
    expect(s.verseOk).toBeUndefined();
    expect(s.confidence).toBeUndefined();
  });
});

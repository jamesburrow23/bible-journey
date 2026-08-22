import { describe, it, expect } from 'vitest';
import { lookupPlace, applyGazetteer, GAZETTEER } from '../src/services/gazetteer';
import type { RawStop } from '../src/types';

describe('lookupPlace', () => {
  it('matches case-insensitively', () => {
    expect(lookupPlace('bethel')?.name).toBe('Bethel');
  });
  it('matches aliases', () => {
    expect(lookupPlace('Luz')?.name).toBe('Bethel');
    expect(lookupPlace('Salem')?.name).toBe('Jerusalem');
    expect(lookupPlace('Horeb')?.name).toBe('Mount Sinai');
  });
  it('ignores a leading "the"', () => {
    expect(lookupPlace('the Negev')?.name).toBe('Negev');
    expect(lookupPlace('The Jordan')?.name).toBe('Jordan River');
  });
  it('returns null for unknown places', () => {
    expect(lookupPlace('Narnia')).toBeNull();
  });
  it('ships a substantial gazetteer', () => {
    expect(GAZETTEER.length).toBeGreaterThanOrEqual(100);
  });
});

describe('applyGazetteer', () => {
  const raw = (name: string, lat = 0, lng = 0): RawStop => ({
    name, modernHint: '', lat, lng, event: 'x', verseRef: 'Gen 1:1',
  });

  it('overrides coords on match and flags source', () => {
    const [s] = applyGazetteer([raw('Bethel', 99, 99)]);
    expect(s.coordSource).toBe('gazetteer');
    expect(s.lat).toBeCloseTo(31.93, 1);
    expect(s.lng).toBeCloseTo(35.221, 2);
    expect(s.id).toBeTruthy();
  });
  it('keeps model coords when unmatched', () => {
    const [s] = applyGazetteer([raw('Narnia', 12.3, 45.6)]);
    expect(s.coordSource).toBe('model');
    expect(s.lat).toBe(12.3);
  });
});

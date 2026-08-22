import { describe, it, expect } from 'vitest';
import { legsFromStops, sliceLeg, legLineString, type LngLat } from '../src/services/route';
import type { Stop } from '../src/types';

const stop = (name: string, lat: number, lng: number): Stop => ({
  id: name, name, modernHint: '', lat, lng, event: '', verseRef: '', coordSource: 'manual',
});

describe('legsFromStops', () => {
  it('returns empty for 0 or 1 stops', () => {
    expect(legsFromStops([])).toEqual([]);
    expect(legsFromStops([stop('a', 1, 2)])).toEqual([]);
  });
  it('returns [lng,lat] pairs per consecutive stop pair', () => {
    const legs = legsFromStops([stop('a', 10, 20), stop('b', 30, 40), stop('c', 50, 60)]);
    expect(legs).toEqual([
      [[20, 10], [40, 30]],
      [[40, 30], [60, 50]],
    ]);
  });
});

describe('sliceLeg', () => {
  const a: LngLat = [0, 0];
  const b: LngLat = [10, 20];
  it('interpolates linearly', () => {
    expect(sliceLeg(a, b, 0.5)).toEqual([[0, 0], [5, 10]]);
  });
  it('clamps t to [0,1]', () => {
    expect(sliceLeg(a, b, -1)).toEqual([[0, 0], [0, 0]]);
    expect(sliceLeg(a, b, 2)).toEqual([[0, 0], [10, 20]]);
  });
});

describe('legLineString', () => {
  it('wraps coords in a GeoJSON Feature', () => {
    const f = legLineString([[1, 2], [3, 4]]);
    expect(f.type).toBe('Feature');
    expect(f.geometry).toEqual({ type: 'LineString', coordinates: [[1, 2], [3, 4]] });
  });
});

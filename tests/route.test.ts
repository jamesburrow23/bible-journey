import { describe, it, expect } from 'vitest';
import { legPathsFromStops, slicePath, legLineString, type LngLat } from '../src/services/route';
import type { Stop, Waypoint } from '../src/types';

const stop = (name: string, lat: number, lng: number, via?: Waypoint[]): Stop => ({
  id: name, name, modernHint: '', lat, lng, event: '', verseRef: '', coordSource: 'manual', via,
});

// Perpendicular deviation of a path's midpoint from the straight chord (signed).
function midDeviation(path: LngLat[]): number {
  const a = path[0];
  const b = path[path.length - 1];
  const m = path[Math.floor(path.length / 2)];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return ((m[0] - a[0]) * -dy + (m[1] - a[1]) * dx) / len;
}

describe('legPathsFromStops', () => {
  it('returns empty for 0 or 1 stops', () => {
    expect(legPathsFromStops([])).toEqual([]);
    expect(legPathsFromStops([stop('a', 1, 2)])).toEqual([]);
  });

  it('produces one path per leg, anchored exactly at stop coordinates', () => {
    const paths = legPathsFromStops([stop('a', 10, 20), stop('b', 30, 40), stop('c', 50, 60)]);
    expect(paths).toHaveLength(2);
    expect(paths[0][0]).toEqual([20, 10]);
    expect(paths[0][paths[0].length - 1]).toEqual([40, 30]);
    expect(paths[1][0]).toEqual([40, 30]);
    expect(paths[1][paths[1].length - 1]).toEqual([60, 50]);
  });

  it('curves plain legs, bowing consecutive legs to opposite sides', () => {
    const paths = legPathsFromStops([stop('a', 0, 0), stop('b', 0, 10), stop('c', 0, 20)]);
    const d0 = midDeviation(paths[0]);
    const d1 = midDeviation(paths[1]);
    expect(Math.abs(d0)).toBeGreaterThan(0.1); // genuinely curved
    expect(Math.sign(d0)).not.toBe(Math.sign(d1)); // alternating sides
  });

  it('threads legs with via waypoints through every waypoint', () => {
    const via = [{ lat: 33.5, lng: 36.3 }]; // Damascus-ish detour
    const paths = legPathsFromStops([stop('Haran', 36.9, 39.0), stop('Shechem', 32.2, 35.3, via)]);
    const hits = paths[0].filter(
      (p) => Math.abs(p[0] - 36.3) < 1e-9 && Math.abs(p[1] - 33.5) < 1e-9,
    );
    expect(hits.length).toBeGreaterThan(0); // spline passes exactly through the waypoint
    expect(paths[0][0]).toEqual([39.0, 36.9]);
    expect(paths[0][paths[0].length - 1]).toEqual([35.3, 32.2]);
  });
});

describe('slicePath', () => {
  const path: LngLat[] = [[0, 0], [10, 0], [20, 0]];

  it('returns a degenerate start segment at t=0 and the full path at t=1', () => {
    expect(slicePath(path, 0)).toEqual([[0, 0], [0, 0]]);
    expect(slicePath(path, 1)).toEqual(path);
  });

  it('interpolates along cumulative length', () => {
    expect(slicePath(path, 0.5)).toEqual([[0, 0], [10, 0]]);
    expect(slicePath(path, 0.75)).toEqual([[0, 0], [10, 0], [15, 0]]);
  });

  it('clamps t outside [0,1]', () => {
    expect(slicePath(path, -1)).toEqual([[0, 0], [0, 0]]);
    expect(slicePath(path, 2)).toEqual(path);
  });
});

describe('legLineString', () => {
  it('wraps coords in a GeoJSON Feature', () => {
    const f = legLineString([[1, 2], [3, 4], [5, 6]]);
    expect(f.type).toBe('Feature');
    expect(f.geometry).toEqual({ type: 'LineString', coordinates: [[1, 2], [3, 4], [5, 6]] });
  });
});

import type { Stop } from '../types';

export type LngLat = [number, number];

export function legsFromStops(stops: Stop[]): [LngLat, LngLat][] {
  const legs: [LngLat, LngLat][] = [];
  for (let i = 1; i < stops.length; i++) {
    legs.push([
      [stops[i - 1].lng, stops[i - 1].lat],
      [stops[i].lng, stops[i].lat],
    ]);
  }
  return legs;
}

export function sliceLeg(from: LngLat, to: LngLat, t: number): [LngLat, LngLat] {
  const c = Math.min(1, Math.max(0, t));
  return [from, [from[0] + (to[0] - from[0]) * c, from[1] + (to[1] - from[1]) * c]];
}

export function legLineString(coords: [LngLat, LngLat]): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  };
}

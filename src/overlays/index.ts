import { dividedKingdom } from './dividedKingdom';

export interface RegionStyle {
  fill: string;
  stroke: string;
  opacity: number;
}

export interface OverlayPreset {
  id: string;
  name: string;
  regions: GeoJSON.Feature[];
}

/**
 * Build one overlay region: a closed polygon feature carrying its style and
 * a label anchor in its properties. (Function declaration on purpose — it is
 * hoisted, so preset modules in this circular import graph can call it.)
 */
export function region(
  name: string,
  style: RegionStyle,
  labelAt: [number, number],
  ring: [number, number][],
): GeoJSON.Feature {
  const closed = [...ring, ring[0]];
  return {
    type: 'Feature',
    properties: { name, ...style, labelAt },
    geometry: { type: 'Polygon', coordinates: [closed] },
  };
}

export const OVERLAYS: OverlayPreset[] = [dividedKingdom];

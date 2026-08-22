import { describe, it, expect } from 'vitest';
import { toParchment } from '../src/services/mapStyle';

const fixture = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: {} },
    { id: 'water', type: 'fill', paint: { 'fill-color': 'blue' } },
    { id: 'waterway-river', type: 'line', paint: {} },
    { id: 'landcover-grass', type: 'fill', paint: {} },
    { id: 'highway-major', type: 'line', paint: {} },
    { id: 'building', type: 'fill', paint: {} },
    { id: 'poi-level-1', type: 'symbol', layout: {} },
    { id: 'place-city', type: 'symbol', paint: {} },
    { id: 'label-country', type: 'symbol', paint: {} },
    { id: 'boundary-admin', type: 'line', paint: {} },
  ],
};

describe('toParchment', () => {
  const out = toParchment(fixture);
  const ids = out.layers.map((l: any) => l.id);

  it('drops roads, buildings, POIs, and modern city labels', () => {
    expect(ids).not.toContain('highway-major');
    expect(ids).not.toContain('building');
    expect(ids).not.toContain('poi-level-1');
    expect(ids).not.toContain('place-city');
  });

  it('keeps and recolors background, water, land, boundaries, country labels', () => {
    expect(out.layers.find((l: any) => l.id === 'background').paint['background-color']).toBe('#E8DBB7');
    expect(out.layers.find((l: any) => l.id === 'water').paint['fill-color']).toBe('#A9C2B4');
    expect(out.layers.find((l: any) => l.id === 'waterway-river').paint['line-color']).toBe('#7E9A8B');
    expect(out.layers.find((l: any) => l.id === 'landcover-grass').paint['fill-color']).toBe('#DFD0A4');
    expect(out.layers.find((l: any) => l.id === 'boundary-admin').paint['line-color']).toBe('#B9A576');
    const country = out.layers.find((l: any) => l.id === 'label-country');
    expect(country.paint['text-color']).toBe('#8A7448');
    expect(country.paint['text-halo-color']).toBe('#E8DBB7');
  });

  it('does not mutate the input style', () => {
    expect(fixture.layers.find((l) => l.id === 'water')!.paint!['fill-color']).toBe('blue');
    expect(fixture.layers).toHaveLength(10);
  });
});

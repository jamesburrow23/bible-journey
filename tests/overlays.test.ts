import { describe, it, expect } from 'vitest';
import { OVERLAYS } from '../src/overlays';

describe('overlay presets', () => {
  it('have unique ids and at least one region', () => {
    const ids = OVERLAYS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of OVERLAYS) expect(o.regions.length).toBeGreaterThan(0);
  });

  it('every region is a closed polygon with style props and an in-bounds label anchor', () => {
    for (const o of OVERLAYS) {
      for (const r of o.regions) {
        const props = r.properties as any;
        expect(typeof props.name).toBe('string');
        expect(props.fill).toMatch(/^#/);
        expect(props.stroke).toMatch(/^#/);
        expect(props.opacity).toBeGreaterThan(0);

        expect(r.geometry.type).toBe('Polygon');
        const ring = (r.geometry as GeoJSON.Polygon).coordinates[0];
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]); // closed

        const lngs = ring.map((p) => p[0]);
        const lats = ring.map((p) => p[1]);
        const [lng, lat] = props.labelAt;
        expect(lng).toBeGreaterThan(Math.min(...lngs));
        expect(lng).toBeLessThan(Math.max(...lngs));
        expect(lat).toBeGreaterThan(Math.min(...lats));
        expect(lat).toBeLessThan(Math.max(...lats));
      }
    }
  });

  it('kingdom regions of the divided kingdom do not obviously overlap (Israel north of Judah)', () => {
    const dk = OVERLAYS.find((o) => o.id === 'divided-kingdom')!;
    const israel = dk.regions.find((r) => (r.properties as any).name === 'Israel')!;
    const judah = dk.regions.find((r) => (r.properties as any).name === 'Judah')!;
    const minLatIsrael = Math.min(...(israel.geometry as GeoJSON.Polygon).coordinates[0].map((p) => p[1]));
    const maxLatJudah = Math.max(...(judah.geometry as GeoJSON.Polygon).coordinates[0].map((p) => p[1]));
    expect(maxLatJudah).toBeLessThanOrEqual(minLatIsrael + 0.1); // border zone near Bethel
  });
});

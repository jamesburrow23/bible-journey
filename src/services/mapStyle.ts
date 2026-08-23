export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const HIDE = /poi|transit|road|highway|motorway|bridge|tunnel|rail|building|housen|aeroway|ferry|path|airport|oneway|pattern|boundary/i;
const KEEP_LABEL = /ocean|sea/i;

export function toParchment(style: any): any {
  const s = structuredClone(style);
  s.layers = s.layers
    .filter((l: any) => !HIDE.test(l.id))
    .filter((l: any) => l.type !== 'symbol' || KEEP_LABEL.test(l.id));
  for (const layer of s.layers) {
    layer.paint = { ...(layer.paint ?? {}) };
    if (layer.type === 'background') {
      layer.paint['background-color'] = '#E8DBB7';
    } else if (layer.type === 'fill') {
      if (/water/i.test(layer.id)) {
        layer.paint['fill-color'] = '#A9C2B4';
      } else if (/wood|forest/i.test(layer.id)) {
        layer.paint['fill-color'] = '#A9B285';
        layer.paint['fill-opacity'] = 0.55;
      } else if (/grass|meadow|park|orchard|vineyard|farmland/i.test(layer.id)) {
        layer.paint['fill-color'] = '#C7C797';
        layer.paint['fill-opacity'] = 0.5;
      } else if (/sand|beach|desert|bare/i.test(layer.id)) {
        layer.paint['fill-color'] = '#E6D5A6';
        layer.paint['fill-opacity'] = 0.6;
      } else if (/residential|urban|suburb/i.test(layer.id)) {
        layer.paint['fill-color'] = '#D9C497';
        layer.paint['fill-opacity'] = 0.45;
      } else {
        layer.paint['fill-color'] = '#DFD0A4';
        layer.paint['fill-opacity'] = 0.5;
      }
      delete layer.paint['fill-pattern'];
    } else if (layer.type === 'line') {
      layer.paint['line-color'] = /water|river/i.test(layer.id) ? '#7E9A8B' : '#B9A576';
    } else if (layer.type === 'symbol') {
      layer.paint['text-color'] = '#8A7448';
      layer.paint['text-halo-color'] = '#E8DBB7';
    }
  }
  return s;
}

export async function loadParchmentStyle(): Promise<any> {
  const res = await fetch(STYLE_URL);
  if (!res.ok) throw new Error(`Failed to load base map style (HTTP ${res.status})`);
  return toParchment(await res.json());
}

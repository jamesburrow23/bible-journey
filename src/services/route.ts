import type { Stop } from '../types';

export type LngLat = [number, number];

const ARC_CURVATURE = 0.12;
const ARC_SAMPLES = 16;
const SPLINE_SAMPLES = 8;

/** Gentle quadratic arc between two points; `side` picks which way it bows. */
function quadArc(a: LngLat, b: LngLat, side: 1 | -1): LngLat[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return [a, b];
  const ctrl: LngLat = [
    (a[0] + b[0]) / 2 + (-dy / len) * len * ARC_CURVATURE * side,
    (a[1] + b[1]) / 2 + (dx / len) * len * ARC_CURVATURE * side,
  ];
  const pts: LngLat[] = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const t = i / ARC_SAMPLES;
    const u = 1 - t;
    pts.push([
      u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1],
    ]);
  }
  return pts;
}

/** Smooth Catmull-Rom spline that passes exactly through every anchor. */
function catmullRom(anchors: LngLat[]): LngLat[] {
  const P = [anchors[0], ...anchors, anchors[anchors.length - 1]];
  const pts: LngLat[] = [anchors[0]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let j = 1; j < SPLINE_SAMPLES; j++) {
      const t = j / SPLINE_SAMPLES;
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
    pts.push([p2[0], p2[1]]); // land exactly on each anchor, no float drift
  }
  return pts;
}

/**
 * One polyline per leg (the leg arriving at stop i uses stop i's `via`
 * waypoints). Legs with waypoints follow a spline through them; plain legs
 * get a gentle arc, alternating sides so consecutive legs don't all bow
 * the same way.
 */
export function legPathsFromStops(stops: Stop[]): LngLat[][] {
  const paths: LngLat[][] = [];
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].breakBefore) {
      paths.push([]); // new chapter: no travel from the previous stop
      continue;
    }
    const from: LngLat = [stops[i - 1].lng, stops[i - 1].lat];
    const to: LngLat = [stops[i].lng, stops[i].lat];
    const via = (stops[i].via ?? []).map((w): LngLat => [w.lng, w.lat]);
    paths.push(via.length ? catmullRom([from, ...via, to]) : quadArc(from, to, i % 2 ? 1 : -1));
  }
  return paths;
}

/** Leading portion of a polyline, by fraction `t` of its total length. */
export function slicePath(path: LngLat[], t: number): LngLat[] {
  const c = Math.min(1, Math.max(0, t));
  if (path.length < 2) return path.slice();
  if (c === 0) return [path[0], path[0]];
  if (c === 1) return path.slice();
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    segLens.push(l);
    total += l;
  }
  if (total === 0) return [path[0], path[0]];
  let target = total * c;
  const out: LngLat[] = [path[0]];
  for (let i = 0; i < segLens.length; i++) {
    if (target > segLens[i]) {
      out.push(path[i + 1]);
      target -= segLens[i];
    } else {
      const f = segLens[i] === 0 ? 0 : target / segLens[i];
      out.push([
        path[i][0] + (path[i + 1][0] - path[i][0]) * f,
        path[i][1] + (path[i + 1][1] - path[i][1]) * f,
      ]);
      break;
    }
  }
  return out;
}

/** Total polyline length in degrees (planar approximation). */
export function pathLength(path: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  }
  return total;
}

/**
 * Point at fraction `t` of a polyline's length, plus the travel bearing
 * (degrees clockwise from north) of the segment it falls on.
 */
export function pointAlong(path: LngLat[], t: number): { point: LngLat; bearing: number } {
  const c = Math.min(1, Math.max(0, t));
  const bearingOf = (a: LngLat, b: LngLat): number => {
    const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
    const dy = b[1] - a[1];
    return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  };
  if (path.length < 2) return { point: path[0] ?? [0, 0], bearing: 0 };
  const total = pathLength(path);
  if (total === 0) return { point: path[0], bearing: 0 };
  let target = total * c;
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (target <= seg || i === path.length - 1) {
      const f = seg === 0 ? 0 : Math.min(1, target / seg);
      return {
        point: [
          path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f,
          path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f,
        ],
        bearing: bearingOf(path[i - 1], path[i]),
      };
    }
    target -= seg;
  }
  return { point: path[path.length - 1], bearing: bearingOf(path[path.length - 2], path[path.length - 1]) };
}

export function legLineString(coords: LngLat[], properties: Record<string, unknown> = {}): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'LineString', coordinates: coords },
  };
}

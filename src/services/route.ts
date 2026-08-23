import type { Stop, Waypoint } from '../types';

export type LngLat = [number, number];

const ARC_CURVATURE = 0.045; // nearly straight by default
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

/**
 * Centripetal Catmull-Rom spline through every anchor. Unlike the uniform
 * variant, centripetal parameterization never loops or overshoots between
 * unevenly spaced anchors — dragged or model-generated waypoints stay tame.
 */
function catmullRom(anchors: LngLat[]): LngLat[] {
  const P = [anchors[0], ...anchors, anchors[anchors.length - 1]];
  const pts: LngLat[] = [anchors[0]];
  const EPS = 1e-9;
  const knot = (a: LngLat, b: LngLat): number => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || EPS;
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const d01 = knot(p0, p1);
    const d12 = knot(p1, p2);
    const d23 = knot(p2, p3);
    // Centripetal tangents at p1 and p2.
    const tan = (a: LngLat, b: LngLat, c: LngLat, dab: number, dbc: number, k: 0 | 1): number =>
      ((b[k] - a[k]) / dab - (c[k] - a[k]) / (dab + dbc) + (c[k] - b[k]) / dbc) * dbc;
    const t1: LngLat = [tan(p0, p1, p2, d01, d12, 0), tan(p0, p1, p2, d01, d12, 1)];
    const t2: LngLat = [tan(p1, p2, p3, d12, d23, 0), tan(p1, p2, p3, d12, d23, 1)];
    for (let j = 1; j < SPLINE_SAMPLES; j++) {
      const t = j / SPLINE_SAMPLES;
      const tt = t * t;
      const ttt = tt * t;
      const h00 = 2 * ttt - 3 * tt + 1;
      const h10 = ttt - 2 * tt + t;
      const h01 = -2 * ttt + 3 * tt;
      const h11 = ttt - tt;
      pts.push([
        h00 * p1[0] + h10 * t1[0] + h01 * p2[0] + h11 * t2[0],
        h00 * p1[1] + h10 * t1[1] + h01 * p2[1] + h11 * t2[1],
      ]);
    }
    pts.push([p2[0], p2[1]]); // land exactly on each anchor, no float drift
  }
  return pts;
}

/**
 * Keep only waypoints that make steady progress from `from` to `to` without
 * wild detours: each must project further along the straight chord than the
 * last (strictly between the endpoints) and sit within 35% of the chord's
 * length from it. Applied to model-generated routes at extraction time —
 * hand-dragged bends are never filtered.
 */
export function sanitizeVia(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  via: Waypoint[],
): Waypoint[] {
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return [];
  const len = Math.sqrt(len2);
  const out: Waypoint[] = [];
  let lastT = 0;
  for (const w of via) {
    const t = ((w.lng - from.lng) * dx + (w.lat - from.lat) * dy) / len2;
    const perp = Math.abs((w.lng - from.lng) * dy - (w.lat - from.lat) * dx) / len;
    if (t <= lastT || t >= 1) continue; // backtracking or beyond the endpoints
    if (perp > 0.35 * len) continue; // wild detour
    out.push(w);
    lastT = t;
  }
  return out;
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

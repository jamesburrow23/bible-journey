import type { RawStop, Stop } from '../types';
import { refMatchesPlace } from './verses';
import { sanitizeVia } from './route';
import data from '../assets/gazetteer.json';

// Bundled distillation of OpenBible.info Bible Geocoding Data (CC-BY 4.0):
// ~1,335 biblical places with scholar-scored identifications, coordinates,
// translation-variant aliases, known verse mentions, and site photos.
// Regenerate with: node scripts/build-gazetteer.mjs <path-to-clone>

export interface GazetteerEntry {
  name: string;
  slug: string;
  aliases: string[];
  lat: number;
  lng: number;
  /** Identification confidence, 0-1000 (OpenBible best path score). */
  confidence: number;
  modern: string;
  types: string[];
  /** OSIS refs of every verse mentioning this place (capped at 200). */
  verses: string[];
  photo?: { url: string; credit: string; creditUrl?: string };
}

const entries = data as GazetteerEntry[];

export const gazetteerCount = entries.length;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^the\s+/, '');
}

const index = new Map<string, GazetteerEntry[]>();
for (const e of entries) {
  for (const key of [e.name, ...e.aliases]) {
    const k = norm(key);
    const list = index.get(k);
    if (list) { if (!list.includes(e)) list.push(e); }
    else index.set(k, [e]);
  }
}

/**
 * Find a place by name. With several candidates (three Bethels, two
 * Antiochs), `near` — typically the model's rough coordinates — picks the
 * nearest; candidates within ~1° of the nearest are tie-broken by
 * identification confidence. Without `near`, highest confidence wins.
 */
export function lookupPlace(name: string, near?: { lat: number; lng: number }): GazetteerEntry | null {
  const cands = index.get(norm(name));
  if (!cands?.length) return null;
  if (cands.length === 1) return cands[0];
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    const ranked = cands
      .map((c) => ({ c, d: Math.hypot(c.lat - near.lat, c.lng - near.lng) }))
      .sort((a, b) => a.d - b.d);
    const close = ranked.filter((x) => x.d - ranked[0].d < 1);
    return close.sort((a, b) => b.c.confidence - a.c.confidence)[0].c;
  }
  return [...cands].sort((a, b) => b.confidence - a.confidence)[0];
}

/**
 * Ground extracted stops: verified coordinates, identification confidence,
 * site photo, and a verse cross-check against the place's known mentions.
 * Unmatched places keep the model's coordinates (flagged 'model').
 */
export function applyGazetteer(raw: RawStop[]): Stop[] {
  const stops: Stop[] = raw.map((r) => {
    const hit = lookupPlace(r.name, { lat: r.lat, lng: r.lng });
    const verseOk = hit ? refMatchesPlace(hit.verses, r.verseRef) : null;
    // Confidence 0 means the dataset has NO modern identification — its
    // coordinate is a fallback point (often a centroid between competing
    // traditions, e.g. Mount Horeb). For those, the model's search-grounded
    // guess is better; use the fallback only when the model gave nothing.
    const modelCoordsUsable = Number.isFinite(r.lat) && Number.isFinite(r.lng) && !(r.lat === 0 && r.lng === 0);
    const useHitCoords = !!hit && (hit.confidence > 0 || !modelCoordsUsable);
    // Fallback miniature type from the dataset when the model didn't say.
    const siteType = r.siteType ?? (hit
      ? /^mount(ain)?\b/i.test(hit.name) ? 'mountain' as const
        : hit.types.includes('water') ? 'water' as const
        : hit.types.includes('settlement') ? 'village' as const
        : 'wilderness' as const
      : undefined);
    return {
      ...r,
      id: crypto.randomUUID(),
      lat: useHitCoords ? hit!.lat : r.lat,
      lng: useHitCoords ? hit!.lng : r.lng,
      modernHint: r.modernHint || hit?.modern || '',
      coordSource: useHitCoords ? 'gazetteer' : 'model',
      ...(useHitCoords ? { confidence: hit!.confidence } : {}),
      ...(hit?.photo ? { photo: hit.photo } : {}),
      ...(siteType ? { siteType } : {}),
      ...(verseOk === null ? {} : { verseOk }),
    };
  });
  // Model routes zigzag sometimes — keep only waypoints that progress
  // cleanly toward each destination (grounded coordinates, so post-override).
  for (let i = 0; i < stops.length; i++) {
    stops[i].via = i === 0 ? [] : sanitizeVia(stops[i - 1], stops[i], stops[i].via ?? []);
  }
  return stops;
}

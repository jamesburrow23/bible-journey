#!/usr/bin/env node
/**
 * Distill OpenBible.info Bible Geocoding Data (CC-BY 4.0) into the app's
 * bundled gazetteer.
 *
 * Usage: node scripts/build-gazetteer.mjs /path/to/Bible-Geocoding-Data
 * Writes: src/assets/gazetteer.json
 *
 * Per ancient place: display name + translation-variant aliases, the
 * best-scored modern identification's coordinates, the identification
 * confidence (0-1000), the modern site name, a site photo (Wikimedia
 * thumbnail + credit), and the OSIS refs of every verse mentioning it.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src || !existsSync(join(src, 'data', 'ancient.jsonl'))) {
  console.error('Usage: node scripts/build-gazetteer.mjs /path/to/Bible-Geocoding-Data');
  process.exit(1);
}

const readJsonl = (f) =>
  readFileSync(join(src, 'data', f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const images = new Map(readJsonl('image.jsonl').map((i) => [i.id, i]));
const moderns = new Map(readJsonl('modern.jsonl').map((m) => [m.id, m]));

const VERSE_CAP = 200; // giant lists (Jerusalem, Israel) matter least for validation

const entries = [];
let skippedNoCoords = 0;

for (const a of readJsonl('ancient.jsonl')) {
  const display = a.friendly_id.replace(/ \d+$/, '');

  // Best modern identification by path score.
  let best = null;
  for (const ident of a.identifications ?? []) {
    if (ident.id_source !== 'modern') continue;
    const score = Math.max(...(ident.resolutions ?? []).map((r) => r.best_path_score ?? 0), 0);
    if (!best || score > best.score) best = { ident, score };
  }

  let lat = null;
  let lng = null;
  let modernName = '';
  if (best) {
    const m = moderns.get(best.ident.id);
    if (m?.lonlat) {
      const [x, y] = m.lonlat.split(',').map(Number);
      lng = x;
      lat = y;
      modernName = m.names?.[0]?.name ?? '';
    }
  }
  // Fallback: representative point from the place's own geometry file.
  if (lat == null && a.geojson_file) {
    try {
      const g = JSON.parse(readFileSync(join(src, 'geometry', a.geojson_file), 'utf8'));
      const pt = (g.features ?? []).find((f) => f.geometry?.type === 'Point');
      if (pt) [lng, lat] = pt.geometry.coordinates;
    } catch { /* no usable geometry */ }
  }
  if (lat == null || lng == null) {
    skippedNoCoords++;
    continue;
  }

  // Translation-variant names, minus gentilics ("Bethelite", "Jews") which
  // are people-words that would false-match place lookups.
  const aliases = Object.keys(a.translation_name_counts ?? {})
    .filter((n) => n !== display && !/(ite|ites)$/i.test(n) && n !== 'Jews');

  let photo;
  const thumb = best?.ident?.media?.thumbnail;
  if (thumb?.image_id) {
    const img = images.get(thumb.image_id);
    if (img?.thumbnail_url_pattern) {
      // Wikimedia only serves whitelisted thumb widths (250/330/500/960px)
      // to hotlinkers, and refuses thumbs >= the source width — use the
      // original file for small sources.
      const url = img.width && img.width <= 500 && img.file_url
        ? img.file_url
        : img.thumbnail_url_pattern.replace('####', '500');
      photo = {
        url,
        credit: thumb.credit ?? img.credit ?? '',
        creditUrl: thumb.credit_url ?? img.credit_url ?? '',
      };
    }
  }

  entries.push({
    name: display,
    slug: a.url_slug ?? a.friendly_id,
    aliases,
    lat: Math.round(lat * 1e4) / 1e4,
    lng: Math.round(lng * 1e4) / 1e4,
    confidence: best?.score ?? 0,
    modern: modernName,
    types: a.types ?? [],
    verses: (a.verses ?? []).slice(0, VERSE_CAP).map((v) => v.osis),
    ...(photo ? { photo } : {}),
  });
}

entries.sort((x, y) => x.slug.localeCompare(y.slug));
const out = join(process.cwd(), 'src', 'assets', 'gazetteer.json');
writeFileSync(out, JSON.stringify(entries));
const kb = Math.round(JSON.stringify(entries).length / 1024);
console.log(`wrote ${entries.length} places (${kb} KB) to ${out}; skipped ${skippedNoCoords} without coordinates; ${entries.filter((e) => e.photo).length} with photos`);

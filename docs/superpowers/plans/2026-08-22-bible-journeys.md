# Bible Journeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local-only browser app where a Sunday-school teacher pastes Bible chapters, Gemini extracts the journey stops, and a parchment-styled MapLibre map presents the route as a step-through red dashed line.

**Architecture:** Vite + Vue 3 SPA, no backend. Composables own all state (settings, journey library, playback step index); pure services handle Gemini calls, gazetteer matching, route geometry, and map-style transformation. `MapStage.vue` encapsulates MapLibre and reacts to `activeJourney` + `stepIndex`.

**Tech Stack:** Vue 3.5 (`<script setup lang="ts">`), Vite 7, TypeScript, Tailwind CSS 4 (via `@tailwindcss/vite`), MapLibre GL JS 5, Vitest 3 + happy-dom. Google Gemini REST API (`gemini-3.1-flash` default).

**Spec:** `docs/superpowers/specs/2026-08-22-bible-journeys-design.md`

## Global Constraints

- Project root: `~/Projects/personal/bible-journey` (repo already exists with the spec committed).
- Default Gemini model: `gemini-3.1-flash`; model name user-editable in settings.
- localStorage keys: `bj.journeys`, `bj.settings`, `bj.activeJourneyId`.
- Palette (exact values, defined once as CSS variables): chrome `#221B10`, panel `#2B2317`, panel-2 `#332A1B`, line `#453A26`, ink `#E8DCC3`, muted `#9C8E72`, faint `#6E6349`, parchment `#E8DBB7`, water `#A9C2B4`, route `#A93226`, gold `#B08D4F`, map-ink `#4A3B22`.
- Fonts (Google Fonts, loaded in `index.html`): IM Fell English + IM Fell English SC (display), Alegreya Sans (UI), IBM Plex Mono (numeric).
- Single committed dark theme; no light/dark switching.
- Respect `prefers-reduced-motion`: no leg-draw animation, no marker pulse.
- All unit tests run with `npx vitest run`; build must pass with `npm run build`.
- Commit after every task (messages given per task).

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `src/main.ts`, `src/App.vue`, `src/style.css`, `tests/sanity.test.ts`

**Interfaces:**
- Produces: a running dev server (`npm run dev`), passing test runner (`npx vitest run`), passing build (`npm run build`), CSS design tokens on `:root` that every later component uses via `var(--...)`.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "bible-journeys",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "maplibre-gl": "^5.6.0",
    "vue": "^3.5.13"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@vitejs/plugin-vue": "^6.0.0",
    "happy-dom": "^18.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.8.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0",
    "vue-tsc": "^3.0.0"
  }
}
```

- [ ] **Step 2: Write vite.config.ts** (includes vitest config)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  test: {
    environment: 'happy-dom',
  },
});
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "tests/**/*.ts"]
}
```

- [ ] **Step 4: Write index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bible Journeys</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
    />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Write src/style.css** (Tailwind + design tokens; single dark theme per spec)

```css
@import 'tailwindcss';
@import 'maplibre-gl/dist/maplibre-gl.css';

:root {
  --chrome: #221b10;
  --panel: #2b2317;
  --panel-2: #332a1b;
  --line: #453a26;
  --ink: #e8dcc3;
  --muted: #9c8e72;
  --faint: #6e6349;
  --parchment: #e8dbb7;
  --water: #a9c2b4;
  --route: #a93226;
  --gold: #b08d4f;
  --map-ink: #4a3b22;
  --ok: #6e8b5e;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
}

body {
  background: var(--chrome);
  color: var(--ink);
  font-family: 'Alegreya Sans', system-ui, sans-serif;
  font-size: 15px;
}

.font-fell { font-family: 'IM Fell English', serif; }
.font-fell-sc { font-family: 'IM Fell English SC', serif; }
.font-mono-num { font-family: 'IBM Plex Mono', monospace; }

textarea, input[type='text'], input[type='password'] {
  width: 100%;
  background: var(--chrome);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 14px;
}
textarea:focus, input:focus { outline: 2px solid var(--gold); outline-offset: -1px; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 8px 14px;
  background: var(--panel-2);
  color: var(--ink);
  font: inherit;
  font-weight: 500;
}
.btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.btn-primary { background: var(--route); border-color: #7e241b; color: #f6e9d8; }
.btn-primary:hover { background: #b93c2f; }

.sec-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
```

- [ ] **Step 6: Write src/main.ts and placeholder src/App.vue**

`src/main.ts`:

```ts
import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

createApp(App).mount('#app');
```

`src/App.vue` (placeholder; replaced in Task 13):

```vue
<script setup lang="ts"></script>

<template>
  <div class="flex h-full items-center justify-center">
    <h1 class="font-fell-sc text-3xl">Bible Journeys</h1>
  </div>
</template>
```

- [ ] **Step 7: Write .gitignore**

```
node_modules
dist
*.local
.DS_Store
```

- [ ] **Step 8: Write tests/sanity.test.ts**

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs tests with DOM + localStorage available', () => {
    localStorage.setItem('x', '1');
    expect(localStorage.getItem('x')).toBe('1');
  });
});
```

- [ ] **Step 9: Install and verify**

Run: `npm install`
Run: `npx vitest run` — Expected: 1 test passes.
Run: `npm run build` — Expected: builds without errors.
Run: `npm run dev` briefly and load the page — Expected: dark background, "Bible Journeys" in small-caps Fell English.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + Vue 3 + TS + Tailwind app with design tokens"
```

---

### Task 2: Types and route geometry helpers

**Files:**
- Create: `src/types.ts`, `src/services/route.ts`
- Test: `tests/route.test.ts`

**Interfaces:**
- Produces (used everywhere later):

```ts
// src/types.ts
export type CoordSource = 'gazetteer' | 'model' | 'manual';

export interface RawStop {
  name: string;
  modernHint: string;
  lat: number;
  lng: number;
  event: string;
  verseRef: string;
}

export interface Stop extends RawStop {
  id: string;
  coordSource: CoordSource;
}

export interface Journey {
  id: string;
  name: string;
  passageText: string;
  stops: Stop[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  geminiApiKey: string;
  geminiModel: string;
  customPrompt: string | null;
}
```

- Produces from `src/services/route.ts`:
  - `type LngLat = [number, number]`
  - `legsFromStops(stops: Stop[]): [LngLat, LngLat][]` — one `[from, to]` pair per consecutive stop pair (empty for <2 stops).
  - `sliceLeg(from: LngLat, to: LngLat, t: number): [LngLat, LngLat]` — linear interpolation, `t` clamped to [0,1]; returns `[from, lerp(from,to,t)]`.
  - `legLineString(coords: [LngLat, LngLat]): GeoJSON.Feature` — wraps a pair as a GeoJSON LineString Feature.

- [ ] **Step 1: Write src/types.ts** exactly as above.

- [ ] **Step 2: Write the failing tests** — `tests/route.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { legsFromStops, sliceLeg, legLineString, type LngLat } from '../src/services/route';
import type { Stop } from '../src/types';

const stop = (name: string, lat: number, lng: number): Stop => ({
  id: name, name, modernHint: '', lat, lng, event: '', verseRef: '', coordSource: 'manual',
});

describe('legsFromStops', () => {
  it('returns empty for 0 or 1 stops', () => {
    expect(legsFromStops([])).toEqual([]);
    expect(legsFromStops([stop('a', 1, 2)])).toEqual([]);
  });
  it('returns [lng,lat] pairs per consecutive stop pair', () => {
    const legs = legsFromStops([stop('a', 10, 20), stop('b', 30, 40), stop('c', 50, 60)]);
    expect(legs).toEqual([
      [[20, 10], [40, 30]],
      [[40, 30], [60, 50]],
    ]);
  });
});

describe('sliceLeg', () => {
  const a: LngLat = [0, 0];
  const b: LngLat = [10, 20];
  it('interpolates linearly', () => {
    expect(sliceLeg(a, b, 0.5)).toEqual([[0, 0], [5, 10]]);
  });
  it('clamps t to [0,1]', () => {
    expect(sliceLeg(a, b, -1)).toEqual([[0, 0], [0, 0]]);
    expect(sliceLeg(a, b, 2)).toEqual([[0, 0], [10, 20]]);
  });
});

describe('legLineString', () => {
  it('wraps coords in a GeoJSON Feature', () => {
    const f = legLineString([[1, 2], [3, 4]]);
    expect(f.type).toBe('Feature');
    expect(f.geometry).toEqual({ type: 'LineString', coordinates: [[1, 2], [3, 4]] });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/route.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Write src/services/route.ts**

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/route.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/services/route.ts tests/route.test.ts
git commit -m "feat: core types and route geometry helpers"
```

---

### Task 3: Gazetteer service

**Files:**
- Create: `src/services/gazetteer.ts`
- Test: `tests/gazetteer.test.ts`

**Interfaces:**
- Produces:
  - `interface GazetteerEntry { name: string; lat: number; lng: number; aliases?: string[] }`
  - `GAZETTEER: GazetteerEntry[]` — the shipped data.
  - `lookupPlace(name: string): GazetteerEntry | null` — case-insensitive; ignores a leading `the `; matches canonical name or any alias.
  - `applyGazetteer(raw: RawStop[]): Stop[]` — assigns `id: crypto.randomUUID()`; on match overrides `lat`/`lng` and sets `coordSource: 'gazetteer'`; otherwise keeps model coords with `coordSource: 'model'`.

- [ ] **Step 1: Write the failing tests** — `tests/gazetteer.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { lookupPlace, applyGazetteer, GAZETTEER } from '../src/services/gazetteer';
import type { RawStop } from '../src/types';

describe('lookupPlace', () => {
  it('matches case-insensitively', () => {
    expect(lookupPlace('bethel')?.name).toBe('Bethel');
  });
  it('matches aliases', () => {
    expect(lookupPlace('Luz')?.name).toBe('Bethel');
    expect(lookupPlace('Salem')?.name).toBe('Jerusalem');
    expect(lookupPlace('Horeb')?.name).toBe('Mount Sinai');
  });
  it('ignores a leading "the"', () => {
    expect(lookupPlace('the Negev')?.name).toBe('Negev');
    expect(lookupPlace('The Jordan')?.name).toBe('Jordan River');
  });
  it('returns null for unknown places', () => {
    expect(lookupPlace('Narnia')).toBeNull();
  });
  it('ships a substantial gazetteer', () => {
    expect(GAZETTEER.length).toBeGreaterThanOrEqual(100);
  });
});

describe('applyGazetteer', () => {
  const raw = (name: string, lat = 0, lng = 0): RawStop => ({
    name, modernHint: '', lat, lng, event: 'x', verseRef: 'Gen 1:1',
  });

  it('overrides coords on match and flags source', () => {
    const [s] = applyGazetteer([raw('Bethel', 99, 99)]);
    expect(s.coordSource).toBe('gazetteer');
    expect(s.lat).toBeCloseTo(31.93, 1);
    expect(s.lng).toBeCloseTo(35.221, 2);
    expect(s.id).toBeTruthy();
  });
  it('keeps model coords when unmatched', () => {
    const [s] = applyGazetteer([raw('Narnia', 12.3, 45.6)]);
    expect(s.coordSource).toBe('model');
    expect(s.lat).toBe(12.3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gazetteer.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Write src/services/gazetteer.ts**

Lookup logic:

```ts
import type { RawStop, Stop } from '../types';

export interface GazetteerEntry {
  name: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^the\s+/, '');
}

const index = new Map<string, GazetteerEntry>();

export function lookupPlace(name: string): GazetteerEntry | null {
  return index.get(norm(name)) ?? null;
}

export function applyGazetteer(raw: RawStop[]): Stop[] {
  return raw.map((r) => {
    const hit = lookupPlace(r.name);
    return {
      ...r,
      id: crypto.randomUUID(),
      lat: hit ? hit.lat : r.lat,
      lng: hit ? hit.lng : r.lng,
      coordSource: hit ? 'gazetteer' : 'model',
    };
  });
}
```

The data (place it above the `index` construction; after `GAZETTEER` is defined, build the index):

```ts
export const GAZETTEER: GazetteerEntry[] = [
  // — Israel / Canaan —
  { name: 'Jerusalem', lat: 31.778, lng: 35.235, aliases: ['Salem', 'Jebus', 'Zion', 'Mount Moriah', 'City of David', 'Golgotha', 'Calvary'] },
  { name: 'Bethel', lat: 31.930, lng: 35.221, aliases: ['Luz'] },
  { name: 'Shechem', lat: 32.213, lng: 35.282, aliases: ['Sychar'] },
  { name: 'Hebron', lat: 31.525, lng: 35.110, aliases: ['Kiriath-arba', 'Mamre'] },
  { name: 'Beersheba', lat: 31.245, lng: 34.840, aliases: ['Beer-sheba'] },
  { name: 'Bethlehem', lat: 31.705, lng: 35.210, aliases: ['Ephrath', 'Ephrathah'] },
  { name: 'Jericho', lat: 31.871, lng: 35.444 },
  { name: 'Nazareth', lat: 32.702, lng: 35.298 },
  { name: 'Capernaum', lat: 32.881, lng: 35.575 },
  { name: 'Cana', lat: 32.747, lng: 35.339 },
  { name: 'Bethsaida', lat: 32.910, lng: 35.631 },
  { name: 'Chorazin', lat: 32.911, lng: 35.564 },
  { name: 'Magdala', lat: 32.825, lng: 35.516 },
  { name: 'Bethany', lat: 31.771, lng: 35.256 },
  { name: 'Bethphage', lat: 31.778, lng: 35.245 },
  { name: 'Emmaus', lat: 31.839, lng: 35.089 },
  { name: 'Mount of Olives', lat: 31.778, lng: 35.245, aliases: ['Olivet', 'Gethsemane'] },
  { name: 'Jordan River', lat: 31.837, lng: 35.550, aliases: ['Jordan'] },
  { name: 'Sea of Galilee', lat: 32.833, lng: 35.583, aliases: ['Lake Gennesaret', 'Sea of Tiberias', 'Lake of Gennesaret'] },
  { name: 'Dan', lat: 33.249, lng: 35.652, aliases: ['Laish'] },
  { name: 'Shiloh', lat: 32.055, lng: 35.289 },
  { name: 'Ai', lat: 31.917, lng: 35.261 },
  { name: 'Gilgal', lat: 31.870, lng: 35.500 },
  { name: 'Gibeon', lat: 31.847, lng: 35.185 },
  { name: 'Gibeah', lat: 31.823, lng: 35.231 },
  { name: 'Ramah', lat: 31.833, lng: 35.231 },
  { name: 'Mizpah', lat: 31.885, lng: 35.181, aliases: ['Mizpeh'] },
  { name: 'Nob', lat: 31.790, lng: 35.240 },
  { name: 'Anathoth', lat: 31.810, lng: 35.270 },
  { name: 'Tekoa', lat: 31.630, lng: 35.220 },
  { name: 'Kiriath-jearim', lat: 31.795, lng: 35.103 },
  { name: 'Samaria', lat: 32.276, lng: 35.190, aliases: ['Sebaste'] },
  { name: 'Dothan', lat: 32.417, lng: 35.318 },
  { name: 'Megiddo', lat: 32.585, lng: 35.183 },
  { name: 'Jezreel', lat: 32.559, lng: 35.331 },
  { name: 'Beth-shan', lat: 32.503, lng: 35.504, aliases: ['Beth-shean', 'Bethshan'] },
  { name: 'Mount Carmel', lat: 32.733, lng: 35.050, aliases: ['Carmel'] },
  { name: 'Mount Tabor', lat: 32.687, lng: 35.390 },
  { name: 'Mount Gilboa', lat: 32.520, lng: 35.417 },
  { name: 'Endor', lat: 32.632, lng: 35.389, aliases: ['En-dor'] },
  { name: 'Mount Gerizim', lat: 32.200, lng: 35.273 },
  { name: 'Mount Ebal', lat: 32.234, lng: 35.273 },
  { name: 'En-gedi', lat: 31.462, lng: 35.388, aliases: ['Engedi'] },
  { name: 'Negev', lat: 30.985, lng: 34.930, aliases: ['Negeb', 'the South'] },
  { name: 'Gaza', lat: 31.505, lng: 34.464 },
  { name: 'Ashkelon', lat: 31.663, lng: 34.546 },
  { name: 'Ashdod', lat: 31.755, lng: 34.655 },
  { name: 'Ekron', lat: 31.780, lng: 34.850 },
  { name: 'Gath', lat: 31.700, lng: 34.847 },
  { name: 'Lachish', lat: 31.565, lng: 34.849 },
  { name: 'Azekah', lat: 31.700, lng: 34.936 },
  { name: 'Valley of Elah', lat: 31.690, lng: 34.963, aliases: ['Elah'] },
  { name: 'Ziklag', lat: 31.380, lng: 34.870 },
  { name: 'Adullam', lat: 31.650, lng: 34.980, aliases: ['Cave of Adullam'] },
  { name: 'Gerar', lat: 31.380, lng: 34.600 },
  { name: 'Joppa', lat: 32.054, lng: 34.752, aliases: ['Jaffa'] },
  { name: 'Aphek', lat: 32.105, lng: 34.930 },
  { name: 'Caesarea', lat: 32.500, lng: 34.892, aliases: ['Caesarea Maritima'] },
  { name: 'Caesarea Philippi', lat: 33.248, lng: 35.694 },
  { name: 'Sodom', lat: 31.130, lng: 35.400, aliases: ['Gomorrah'] },
  { name: 'Zoar', lat: 30.950, lng: 35.470 },
  // — Transjordan / neighbors —
  { name: 'Mount Nebo', lat: 31.768, lng: 35.725, aliases: ['Nebo', 'Pisgah'] },
  { name: 'Penuel', lat: 32.190, lng: 35.700, aliases: ['Peniel'] },
  { name: 'Mahanaim', lat: 32.190, lng: 35.770 },
  { name: 'Jabbok River', lat: 32.190, lng: 35.650, aliases: ['Jabbok'] },
  { name: 'Moab', lat: 31.500, lng: 35.750, aliases: ['Plains of Moab'] },
  { name: 'Edom', lat: 30.600, lng: 35.400, aliases: ['Seir', 'Mount Seir'] },
  { name: 'Sela', lat: 30.329, lng: 35.442, aliases: ['Petra'] },
  { name: 'Rabbah', lat: 31.950, lng: 35.930, aliases: ['Rabbath-ammon', 'Ammon'] },
  { name: 'Gilead', lat: 32.300, lng: 35.800 },
  { name: 'Bashan', lat: 32.900, lng: 36.000 },
  { name: 'Gerasa', lat: 32.281, lng: 35.891, aliases: ['Jerash'] },
  { name: 'Gadara', lat: 32.650, lng: 35.680 },
  { name: 'Zarephath', lat: 33.460, lng: 35.300, aliases: ['Sarepta'] },
  { name: 'Tyre', lat: 33.270, lng: 35.196 },
  { name: 'Sidon', lat: 33.561, lng: 35.369, aliases: ['Zidon'] },
  { name: 'Damascus', lat: 33.511, lng: 36.306 },
  // — Egypt / Sinai / wilderness —
  { name: 'Egypt', lat: 30.588, lng: 31.500, aliases: ['Land of Egypt'] },
  { name: 'Goshen', lat: 30.879, lng: 31.594, aliases: ['Land of Goshen'] },
  { name: 'Rameses', lat: 30.799, lng: 31.834, aliases: ['Raamses'] },
  { name: 'Pithom', lat: 30.550, lng: 32.100 },
  { name: 'Succoth', lat: 30.550, lng: 32.100 },
  { name: 'Memphis', lat: 29.845, lng: 31.251, aliases: ['Noph'] },
  { name: 'On', lat: 30.129, lng: 31.307, aliases: ['Heliopolis'] },
  { name: 'Alexandria', lat: 31.200, lng: 29.919 },
  { name: 'Red Sea', lat: 29.500, lng: 32.600, aliases: ['Sea of Reeds', 'Yam Suph'] },
  { name: 'Marah', lat: 29.870, lng: 32.650 },
  { name: 'Elim', lat: 29.350, lng: 32.950 },
  { name: 'Rephidim', lat: 28.720, lng: 33.750 },
  { name: 'Mount Sinai', lat: 28.539, lng: 33.975, aliases: ['Sinai', 'Horeb', 'Mount Horeb'] },
  { name: 'Wilderness of Zin', lat: 30.550, lng: 34.850, aliases: ['Zin'] },
  { name: 'Wilderness of Paran', lat: 29.800, lng: 34.900, aliases: ['Paran'] },
  { name: 'Kadesh-barnea', lat: 30.687, lng: 34.494, aliases: ['Kadesh'] },
  { name: 'Midian', lat: 28.400, lng: 34.800, aliases: ['Land of Midian'] },
  // — Mesopotamia / Persia —
  { name: 'Haran', lat: 36.864, lng: 39.031, aliases: ['Harran', 'Paddan-aram', 'Padan-aram'] },
  { name: 'Ur', lat: 30.962, lng: 46.103, aliases: ['Ur of the Chaldeans', 'Ur of the Chaldees'] },
  { name: 'Babylon', lat: 32.542, lng: 44.421 },
  { name: 'Nineveh', lat: 36.359, lng: 43.153 },
  { name: 'Susa', lat: 32.190, lng: 48.258, aliases: ['Shushan'] },
  { name: 'Mount Ararat', lat: 39.702, lng: 44.298, aliases: ['Ararat'] },
  // — Asia Minor / Greece / Mediterranean (Acts & Revelation) —
  { name: 'Antioch', lat: 36.200, lng: 36.160, aliases: ['Antioch of Syria', 'Syrian Antioch'] },
  { name: 'Tarsus', lat: 36.917, lng: 34.895 },
  { name: 'Salamis', lat: 35.183, lng: 33.900 },
  { name: 'Paphos', lat: 34.757, lng: 32.406 },
  { name: 'Perga', lat: 36.961, lng: 30.854 },
  { name: 'Antioch of Pisidia', lat: 38.306, lng: 31.189, aliases: ['Pisidian Antioch'] },
  { name: 'Iconium', lat: 37.875, lng: 32.493 },
  { name: 'Lystra', lat: 37.579, lng: 32.454 },
  { name: 'Derbe', lat: 37.350, lng: 33.350 },
  { name: 'Attalia', lat: 36.885, lng: 30.705 },
  { name: 'Troas', lat: 39.751, lng: 26.159 },
  { name: 'Philippi', lat: 41.013, lng: 24.286 },
  { name: 'Thessalonica', lat: 40.640, lng: 22.944 },
  { name: 'Berea', lat: 40.524, lng: 22.203, aliases: ['Beroea'] },
  { name: 'Athens', lat: 37.972, lng: 23.726 },
  { name: 'Corinth', lat: 37.906, lng: 22.879 },
  { name: 'Cenchreae', lat: 37.888, lng: 22.994, aliases: ['Cenchrea'] },
  { name: 'Ephesus', lat: 37.941, lng: 27.342 },
  { name: 'Miletus', lat: 37.530, lng: 27.276 },
  { name: 'Rhodes', lat: 36.435, lng: 28.217 },
  { name: 'Patara', lat: 36.260, lng: 29.314 },
  { name: 'Patmos', lat: 37.309, lng: 26.548 },
  { name: 'Smyrna', lat: 38.419, lng: 27.139 },
  { name: 'Pergamum', lat: 39.132, lng: 27.184, aliases: ['Pergamos'] },
  { name: 'Thyatira', lat: 38.921, lng: 27.841 },
  { name: 'Sardis', lat: 38.488, lng: 28.040 },
  { name: 'Philadelphia', lat: 38.350, lng: 28.520 },
  { name: 'Laodicea', lat: 37.836, lng: 29.107 },
  { name: 'Colossae', lat: 37.789, lng: 29.261 },
  { name: 'Fair Havens', lat: 34.945, lng: 24.809 },
  { name: 'Crete', lat: 35.240, lng: 24.810 },
  { name: 'Malta', lat: 35.917, lng: 14.400, aliases: ['Melita'] },
  { name: 'Syracuse', lat: 37.069, lng: 15.287 },
  { name: 'Rhegium', lat: 38.110, lng: 15.647 },
  { name: 'Puteoli', lat: 40.826, lng: 14.122 },
  { name: 'Rome', lat: 41.893, lng: 12.483 },
  { name: 'Cyrene', lat: 32.821, lng: 21.858 },
];

for (const entry of GAZETTEER) {
  index.set(norm(entry.name), entry);
  for (const a of entry.aliases ?? []) index.set(norm(a), entry);
}
```

(Order the file: imports → interface → `norm` → `GAZETTEER` → `index` construction → `lookupPlace` → `applyGazetteer`. Several wilderness/region entries are traditional approximations — that is fine; they exist so journeys have a plottable point.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gazetteer.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/gazetteer.ts tests/gazetteer.test.ts
git commit -m "feat: biblical gazetteer with alias matching and coordinate override"
```

---

### Task 4: Gemini extraction service

**Files:**
- Create: `src/services/gemini.ts`
- Test: `tests/gemini.test.ts`

**Interfaces:**
- Consumes: `RawStop` from `src/types.ts`.
- Produces:
  - `DEFAULT_PROMPT: string`
  - `class GeminiError extends Error { userMessage: string }`
  - `parseGeminiResponse(body: unknown): RawStop[]` — pulls `candidates[0].content.parts[0].text`, JSON-parses it, validates shape; throws `GeminiError` on any problem.
  - `extractStops(passage: string, prompt: string, apiKey: string, model: string): Promise<RawStop[]>` — one retry on parse failure; maps HTTP errors to human-readable `userMessage`.

- [ ] **Step 1: Write the failing tests** — `tests/gemini.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGeminiResponse, extractStops, GeminiError, DEFAULT_PROMPT } from '../src/services/gemini';

const stopJson = JSON.stringify([
  { name: 'Haran', modernHint: 'Harran, Turkey', lat: 36.86, lng: 39.03, event: 'Abram departs.', verseRef: 'Gen 12:4' },
]);

const goodBody = {
  candidates: [{ content: { parts: [{ text: stopJson }] } }],
};

describe('parseGeminiResponse', () => {
  it('parses a valid response into RawStop[]', () => {
    const stops = parseGeminiResponse(goodBody);
    expect(stops).toHaveLength(1);
    expect(stops[0].name).toBe('Haran');
    expect(stops[0].lat).toBeCloseTo(36.86);
  });
  it('defaults missing modernHint to empty string', () => {
    const body = {
      candidates: [{ content: { parts: [{ text: JSON.stringify([{ name: 'X', lat: 1, lng: 2, event: 'e', verseRef: 'v' }]) }] } }],
    };
    expect(parseGeminiResponse(body)[0].modernHint).toBe('');
  });
  it('throws GeminiError on non-JSON text', () => {
    const body = { candidates: [{ content: { parts: [{ text: 'sorry, I cannot' }] } }] };
    expect(() => parseGeminiResponse(body)).toThrow(GeminiError);
  });
  it('throws GeminiError when a stop is missing required fields', () => {
    const body = { candidates: [{ content: { parts: [{ text: JSON.stringify([{ name: 'X' }]) }] } }] };
    expect(() => parseGeminiResponse(body)).toThrow(GeminiError);
  });
});

describe('extractStops', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

  it('POSTs to the model endpoint with key header and returns stops', async () => {
    vi.mocked(fetch).mockResolvedValue(ok(goodBody));
    const stops = await extractStops('passage', DEFAULT_PROMPT, 'KEY', 'gemini-3.1-flash');
    expect(stops[0].name).toBe('Haran');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/models/gemini-3.1-flash:generateContent');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY');
    const payload = JSON.parse(String(init!.body));
    expect(payload.contents[0].parts[0].text).toContain('passage');
    expect(payload.generationConfig.responseMimeType).toBe('application/json');
  });

  it('retries once on invalid JSON, then succeeds', async () => {
    const bad = { candidates: [{ content: { parts: [{ text: 'not json' }] } }] };
    vi.mocked(fetch).mockResolvedValueOnce(ok(bad)).mockResolvedValueOnce(ok(goodBody));
    const stops = await extractStops('p', 'prompt', 'KEY', 'm');
    expect(stops).toHaveLength(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('maps 400/403 to an API-key message', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403, json: async () => ({}) } as Response);
    await expect(extractStops('p', 'x', 'BAD', 'm')).rejects.toMatchObject({
      userMessage: expect.stringContaining('API key'),
    });
  });

  it('maps 429 to a quota message', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429, json: async () => ({}) } as Response);
    await expect(extractStops('p', 'x', 'K', 'm')).rejects.toMatchObject({
      userMessage: expect.stringContaining('quota'),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gemini.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Write src/services/gemini.ts**

```ts
import type { RawStop } from '../types';

export const DEFAULT_PROMPT = `You are a biblical geography assistant. From the passage below, extract every place a character travels to or through, in narrative order. For each stop return: name (the biblical place name), modernHint (nearest modern location), lat and lng (best-guess coordinates of the ancient site, in decimal degrees), event (a one-sentence summary of what happens there, suitable for children), and verseRef (book chapter:verse). Only include places on the journey itself, not places merely mentioned. Return JSON only.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      modernHint: { type: 'STRING' },
      lat: { type: 'NUMBER' },
      lng: { type: 'NUMBER' },
      event: { type: 'STRING' },
      verseRef: { type: 'STRING' },
    },
    required: ['name', 'lat', 'lng', 'event', 'verseRef'],
  },
};

export class GeminiError extends Error {
  userMessage: string;
  constructor(userMessage: string, detail?: string) {
    super(detail ?? userMessage);
    this.name = 'GeminiError';
    this.userMessage = userMessage;
  }
}

export function parseGeminiResponse(body: unknown): RawStop[] {
  const text = (body as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new GeminiError('Gemini returned an empty response. Try again.', JSON.stringify(body).slice(0, 500));
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GeminiError('Gemini did not return valid JSON.', text.slice(0, 500));
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new GeminiError('Gemini found no journey stops in this passage.', text.slice(0, 500));
  }
  return data.map((s: any, i: number) => {
    if (typeof s?.name !== 'string' || typeof s?.lat !== 'number' || typeof s?.lng !== 'number'
      || typeof s?.event !== 'string' || typeof s?.verseRef !== 'string') {
      throw new GeminiError(`Stop ${i + 1} in Gemini's response is malformed.`, JSON.stringify(s));
    }
    return {
      name: s.name,
      modernHint: typeof s.modernHint === 'string' ? s.modernHint : '',
      lat: s.lat,
      lng: s.lng,
      event: s.event,
      verseRef: s.verseRef,
    };
  });
}

async function callOnce(passage: string, prompt: string, apiKey: string, model: string): Promise<RawStop[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\nPASSAGE:\n${passage}` }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
    }),
  });
  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new GeminiError('Request rejected — check your Gemini API key in Settings.');
    }
    if (res.status === 429) {
      throw new GeminiError('Gemini quota exceeded — wait a minute and try again.');
    }
    throw new GeminiError(`Gemini request failed (HTTP ${res.status}). Try again.`);
  }
  return parseGeminiResponse(await res.json());
}

export async function extractStops(passage: string, prompt: string, apiKey: string, model: string): Promise<RawStop[]> {
  try {
    return await callOnce(passage, prompt, apiKey, model);
  } catch (e) {
    // Retry once only for malformed-content errors, not auth/quota failures.
    if (e instanceof GeminiError && !e.userMessage.includes('API key') && !e.userMessage.includes('quota')) {
      return await callOnce(passage, prompt, apiKey, model);
    }
    throw e;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gemini.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/gemini.ts tests/gemini.test.ts
git commit -m "feat: Gemini extraction service with schema, validation, retry, and error mapping"
```

---

### Task 5: Settings composable

**Files:**
- Create: `src/composables/useSettings.ts`
- Test: `tests/useSettings.test.ts`

**Interfaces:**
- Consumes: `Settings` type, `DEFAULT_PROMPT` from `src/services/gemini.ts`.
- Produces: `useSettings()` returning a shared (module-singleton) object:
  - `settings: Ref<Settings>` — persisted to `bj.settings` on every change.
  - `effectivePrompt: ComputedRef<string>` — `customPrompt ?? DEFAULT_PROMPT`.
  - `resetPrompt(): void` — sets `customPrompt` to `null`.
  - Defaults: `{ geminiApiKey: '', geminiModel: 'gemini-3.1-flash', customPrompt: null }`.

- [ ] **Step 1: Write the failing tests** — `tests/useSettings.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { useSettings, _resetForTest } from '../src/composables/useSettings';
import { DEFAULT_PROMPT } from '../src/services/gemini';

beforeEach(() => {
  localStorage.clear();
  _resetForTest();
});

describe('useSettings', () => {
  it('starts with defaults', () => {
    const { settings, effectivePrompt } = useSettings();
    expect(settings.value.geminiModel).toBe('gemini-3.1-flash');
    expect(settings.value.geminiApiKey).toBe('');
    expect(effectivePrompt.value).toBe(DEFAULT_PROMPT);
  });

  it('persists changes to localStorage', async () => {
    const { settings } = useSettings();
    settings.value.geminiApiKey = 'abc';
    await nextTick();
    expect(JSON.parse(localStorage.getItem('bj.settings')!).geminiApiKey).toBe('abc');
  });

  it('loads persisted settings on init', () => {
    localStorage.setItem('bj.settings', JSON.stringify({ geminiApiKey: 'k', geminiModel: 'm2', customPrompt: 'p' }));
    _resetForTest();
    const { settings, effectivePrompt } = useSettings();
    expect(settings.value.geminiModel).toBe('m2');
    expect(effectivePrompt.value).toBe('p');
  });

  it('resetPrompt restores the default', () => {
    const { settings, effectivePrompt, resetPrompt } = useSettings();
    settings.value.customPrompt = 'custom';
    resetPrompt();
    expect(settings.value.customPrompt).toBeNull();
    expect(effectivePrompt.value).toBe(DEFAULT_PROMPT);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/useSettings.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write src/composables/useSettings.ts**

```ts
import { ref, computed, watch, type Ref } from 'vue';
import type { Settings } from '../types';
import { DEFAULT_PROMPT } from '../services/gemini';

const KEY = 'bj.settings';

const DEFAULTS: Settings = {
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash',
  customPrompt: null,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* corrupted storage falls back to defaults */ }
  return { ...DEFAULTS };
}

let settings: Ref<Settings> | null = null;

/** Test-only: drop the singleton so the next useSettings() re-reads storage. */
export function _resetForTest(): void {
  settings = null;
}

export function useSettings() {
  if (!settings) {
    settings = ref(load());
    watch(settings, (v) => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true });
  }
  const s = settings;
  const effectivePrompt = computed(() => s.value.customPrompt ?? DEFAULT_PROMPT);
  const resetPrompt = () => { s.value.customPrompt = null; };
  return { settings: s, effectivePrompt, resetPrompt };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/useSettings.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useSettings.ts tests/useSettings.test.ts
git commit -m "feat: persisted settings composable with custom-prompt handling"
```

---

### Task 6: Journeys composable (library + active journey)

**Files:**
- Create: `src/composables/useJourneys.ts`
- Test: `tests/useJourneys.test.ts`

**Interfaces:**
- Consumes: `Journey`, `Stop` from `src/types.ts`.
- Produces: `useJourneys()` returning shared singleton state:
  - `journeys: Ref<Journey[]>` — persisted to `bj.journeys`.
  - `activeJourney: Ref<Journey | null>` — its id persisted to `bj.activeJourneyId`; restored on init when found in the library.
  - `isActiveSaved: ComputedRef<boolean>` — active id exists in `journeys`.
  - `startJourney(name: string, passageText: string, stops: Stop[]): void` — sets a new unsaved active journey (`id: crypto.randomUUID()`, ISO timestamps via `new Date().toISOString()`).
  - `saveActive(): void` — insert or update into `journeys` (bumps `updatedAt`).
  - `selectJourney(id: string): void` — set active from library.
  - `deleteJourney(id: string): void` — remove; clears active if it was active.
  - `touchActive(): void` — call after any stop edit; bumps `updatedAt` and, when saved, syncs the library copy (autosave per spec).
  - `exportAll(): string` — `JSON.stringify(journeys.value, null, 2)`.
  - `importJson(json: string): { added: number; updated: number }` — merge by id, imported wins; throws `Error('Invalid journey file')` on malformed input.
  - `_resetForTest(): void`.

- [ ] **Step 1: Write the failing tests** — `tests/useJourneys.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { useJourneys, _resetForTest } from '../src/composables/useJourneys';
import type { Stop } from '../src/types';

const stops = (): Stop[] => [
  { id: 's1', name: 'Haran', modernHint: '', lat: 36.9, lng: 39.0, event: 'Departs', verseRef: 'Gen 12:4', coordSource: 'gazetteer' },
  { id: 's2', name: 'Shechem', modernHint: '', lat: 32.2, lng: 35.3, event: 'Promise', verseRef: 'Gen 12:6', coordSource: 'gazetteer' },
];

beforeEach(() => {
  localStorage.clear();
  _resetForTest();
});

describe('useJourneys', () => {
  it('startJourney creates an unsaved active journey', () => {
    const j = useJourneys();
    j.startJourney('Abram', 'text', stops());
    expect(j.activeJourney.value?.name).toBe('Abram');
    expect(j.isActiveSaved.value).toBe(false);
    expect(j.journeys.value).toHaveLength(0);
  });

  it('saveActive adds to library and persists', async () => {
    const j = useJourneys();
    j.startJourney('Abram', 'text', stops());
    j.saveActive();
    await nextTick();
    expect(j.isActiveSaved.value).toBe(true);
    expect(JSON.parse(localStorage.getItem('bj.journeys')!)).toHaveLength(1);
  });

  it('touchActive autosaves edits to a saved journey', () => {
    const j = useJourneys();
    j.startJourney('Abram', 'text', stops());
    j.saveActive();
    j.activeJourney.value!.stops[0].name = 'Edited';
    j.touchActive();
    expect(j.journeys.value[0].stops[0].name).toBe('Edited');
  });

  it('selectJourney and deleteJourney manage the active journey', () => {
    const j = useJourneys();
    j.startJourney('A', 't', stops());
    j.saveActive();
    const id = j.activeJourney.value!.id;
    j.startJourney('B', 't2', stops());
    j.selectJourney(id);
    expect(j.activeJourney.value?.name).toBe('A');
    j.deleteJourney(id);
    expect(j.journeys.value).toHaveLength(0);
    expect(j.activeJourney.value).toBeNull();
  });

  it('restores active journey id from storage on init', () => {
    const j = useJourneys();
    j.startJourney('A', 't', stops());
    j.saveActive();
    const id = j.activeJourney.value!.id;
    _resetForTest();
    const j2 = useJourneys();
    expect(j2.activeJourney.value?.id).toBe(id);
  });

  it('exportAll/importJson round-trips and merges by id', () => {
    const j = useJourneys();
    j.startJourney('A', 't', stops());
    j.saveActive();
    const dump = j.exportAll();
    const parsed = JSON.parse(dump);
    parsed[0].name = 'A-imported';
    const result = j.importJson(JSON.stringify(parsed));
    expect(result).toEqual({ added: 0, updated: 1 });
    expect(j.journeys.value[0].name).toBe('A-imported');
  });

  it('importJson rejects malformed input', () => {
    const j = useJourneys();
    expect(() => j.importJson('{"not":"an array"}')).toThrow('Invalid journey file');
    expect(() => j.importJson('garbage')).toThrow('Invalid journey file');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/useJourneys.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write src/composables/useJourneys.ts**

```ts
import { ref, computed, watch, type Ref } from 'vue';
import type { Journey, Stop } from '../types';

const KEY = 'bj.journeys';
const ACTIVE_KEY = 'bj.activeJourneyId';

let journeys: Ref<Journey[]> | null = null;
let activeJourney: Ref<Journey | null> | null = null;

export function _resetForTest(): void {
  journeys = null;
  activeJourney = null;
}

function loadJourneys(): Journey[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* fall through */ }
  return [];
}

function isJourney(x: any): x is Journey {
  return x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.stops);
}

export function useJourneys() {
  if (!journeys || !activeJourney) {
    journeys = ref(loadJourneys());
    const activeId = localStorage.getItem(ACTIVE_KEY);
    activeJourney = ref(journeys.value.find((j) => j.id === activeId) ?? null);
    watch(journeys, (v) => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true });
    watch(activeJourney, (v) => {
      if (v) localStorage.setItem(ACTIVE_KEY, v.id);
      else localStorage.removeItem(ACTIVE_KEY);
    });
  }
  const js = journeys;
  const active = activeJourney;

  const isActiveSaved = computed(() =>
    !!active.value && js.value.some((j) => j.id === active.value!.id),
  );

  function startJourney(name: string, passageText: string, stops: Stop[]): void {
    const now = new Date().toISOString();
    active.value = { id: crypto.randomUUID(), name, passageText, stops, createdAt: now, updatedAt: now };
  }

  function saveActive(): void {
    if (!active.value) return;
    active.value.updatedAt = new Date().toISOString();
    const i = js.value.findIndex((j) => j.id === active.value!.id);
    if (i >= 0) js.value[i] = active.value;
    else js.value.push(active.value);
  }

  function touchActive(): void {
    if (!active.value) return;
    active.value.updatedAt = new Date().toISOString();
    if (isActiveSaved.value) saveActive();
  }

  function selectJourney(id: string): void {
    active.value = js.value.find((j) => j.id === id) ?? null;
  }

  function deleteJourney(id: string): void {
    js.value = js.value.filter((j) => j.id !== id);
    if (active.value?.id === id) active.value = null;
  }

  function exportAll(): string {
    return JSON.stringify(js.value, null, 2);
  }

  function importJson(json: string): { added: number; updated: number } {
    let data: unknown;
    try { data = JSON.parse(json); } catch { throw new Error('Invalid journey file'); }
    if (!Array.isArray(data) || !data.every(isJourney)) throw new Error('Invalid journey file');
    let added = 0, updated = 0;
    for (const imported of data as Journey[]) {
      const i = js.value.findIndex((j) => j.id === imported.id);
      if (i >= 0) { js.value[i] = imported; updated++; }
      else { js.value.push(imported); added++; }
    }
    return { added, updated };
  }

  return { journeys: js, activeJourney: active, isActiveSaved, startJourney, saveActive, touchActive, selectJourney, deleteJourney, exportAll, importJson };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/useJourneys.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useJourneys.ts tests/useJourneys.test.ts
git commit -m "feat: journey library composable with autosave, persistence, export/import"
```

---

### Task 7: Playback composable

**Files:**
- Create: `src/composables/usePlayback.ts`
- Test: `tests/usePlayback.test.ts`

**Interfaces:**
- Produces: `usePlayback(stopCount: () => number)` — NOT a singleton; App creates one and passes it down. Returns:
  - `stepIndex: Ref<number>` (0-based; clamped to `[0, stopCount()-1]`).
  - `playing: Ref<boolean>`.
  - `next(): void`, `prev(): void`, `reset(): void` (reset also stops playback and returns to 0).
  - `togglePlay(): void` — from a play press: restart at 0 if already at the end, then advance every 1600ms; stops at the last stop.
  - `onKeydown(e: KeyboardEvent): void` — ArrowRight → next, ArrowLeft → prev; ignored when `e.target` is an `INPUT`, `TEXTAREA`, or contenteditable element.

- [ ] **Step 1: Write the failing tests** — `tests/usePlayback.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePlayback } from '../src/composables/usePlayback';

describe('usePlayback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('steps forward and back within bounds', () => {
    const p = usePlayback(() => 3);
    expect(p.stepIndex.value).toBe(0);
    p.next(); p.next(); p.next();
    expect(p.stepIndex.value).toBe(2); // clamped at last
    p.prev(); p.prev(); p.prev();
    expect(p.stepIndex.value).toBe(0); // clamped at first
  });

  it('play advances every 1600ms and stops at the end', () => {
    const p = usePlayback(() => 3);
    p.togglePlay();
    expect(p.playing.value).toBe(true);
    vi.advanceTimersByTime(1600);
    expect(p.stepIndex.value).toBe(1);
    vi.advanceTimersByTime(1600);
    expect(p.stepIndex.value).toBe(2);
    vi.advanceTimersByTime(1600);
    expect(p.playing.value).toBe(false);
  });

  it('play from the end restarts at 0', () => {
    const p = usePlayback(() => 2);
    p.next();
    p.togglePlay();
    expect(p.stepIndex.value).toBe(0);
  });

  it('togglePlay pauses', () => {
    const p = usePlayback(() => 5);
    p.togglePlay();
    p.togglePlay();
    expect(p.playing.value).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(p.stepIndex.value).toBe(0);
  });

  it('keyboard steps unless typing in a field', () => {
    const p = usePlayback(() => 3);
    const key = (k: string, target: HTMLElement) => {
      const e = new KeyboardEvent('keydown', { key: k });
      Object.defineProperty(e, 'target', { value: target });
      p.onKeydown(e);
    };
    key('ArrowRight', document.createElement('div'));
    expect(p.stepIndex.value).toBe(1);
    key('ArrowRight', document.createElement('textarea'));
    expect(p.stepIndex.value).toBe(1); // ignored
    key('ArrowLeft', document.createElement('div'));
    expect(p.stepIndex.value).toBe(0);
  });

  it('reset returns to 0 and stops playing', () => {
    const p = usePlayback(() => 5);
    p.next(); p.togglePlay(); p.reset();
    expect(p.stepIndex.value).toBe(0);
    expect(p.playing.value).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/usePlayback.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write src/composables/usePlayback.ts**

```ts
import { ref } from 'vue';

export const PLAY_INTERVAL_MS = 1600;

export function usePlayback(stopCount: () => number) {
  const stepIndex = ref(0);
  const playing = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  function clamp(n: number): number {
    return Math.min(Math.max(0, stopCount() - 1), Math.max(0, n));
  }

  function stopTimer(): void {
    if (timer) clearInterval(timer);
    timer = null;
    playing.value = false;
  }

  function next(): void { stepIndex.value = clamp(stepIndex.value + 1); }
  function prev(): void { stepIndex.value = clamp(stepIndex.value - 1); }

  function reset(): void {
    stopTimer();
    stepIndex.value = 0;
  }

  function togglePlay(): void {
    if (playing.value) { stopTimer(); return; }
    if (stepIndex.value >= stopCount() - 1) stepIndex.value = 0;
    playing.value = true;
    timer = setInterval(() => {
      if (stepIndex.value >= stopCount() - 1) { stopTimer(); return; }
      next();
      if (stepIndex.value >= stopCount() - 1) stopTimer();
    }, PLAY_INTERVAL_MS);
  }

  function onKeydown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  }

  return { stepIndex, playing, next, prev, reset, togglePlay, onKeydown };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/usePlayback.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/usePlayback.ts tests/usePlayback.test.ts
git commit -m "feat: playback composable with stepper, auto-play, keyboard handling"
```

---

### Task 8: Parchment map-style transform

**Files:**
- Create: `src/services/mapStyle.ts`
- Test: `tests/mapStyle.test.ts`

**Interfaces:**
- Produces:
  - `STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'`
  - `toParchment(style: any): any` — pure transform of a MapLibre style JSON (typed loosely to avoid coupling tests to maplibre types):
    - Drops layers whose id matches `/poi|transit|road|highway|motorway|bridge|tunnel|rail|building|housen|aeroway|ferry|path|airport|oneway|pattern/i`.
    - Drops symbol layers EXCEPT those whose id matches `/country|continent|ocean|sea/i` (modern city labels off; faint country/water labels stay for orientation).
    - `background` layers → `background-color: '#E8DBB7'`.
    - Fill layers with `water` in the id → `fill-color: '#A9C2B4'`.
    - Other fill layers → `fill-color: '#DFD0A4'`, `fill-opacity: 0.5` (landcover tint).
    - Line layers with `water|river` in id → `line-color: '#7E9A8B'`; other surviving line layers (boundaries etc.) → `line-color: '#B9A576'`.
    - Surviving symbol layers → `text-color: '#8A7448'`, `text-halo-color: '#E8DBB7'`.
  - `loadParchmentStyle(): Promise<any>` — fetches `STYLE_URL`, returns `toParchment(json)`.

- [ ] **Step 1: Write the failing tests** — `tests/mapStyle.test.ts`

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mapStyle.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write src/services/mapStyle.ts**

```ts
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const HIDE = /poi|transit|road|highway|motorway|bridge|tunnel|rail|building|housen|aeroway|ferry|path|airport|oneway|pattern/i;
const KEEP_LABEL = /country|continent|ocean|sea/i;

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mapStyle.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/mapStyle.ts tests/mapStyle.test.ts
git commit -m "feat: parchment restyle transform for the free vector basemap"
```

---

### Task 9: MapStage component (MapLibre, markers, animated legs)

**Files:**
- Create: `src/components/MapStage.vue`
- Modify: `src/App.vue` (temporary dev harness for manual verification; replaced in Task 13)

**Interfaces:**
- Consumes: `loadParchmentStyle` (Task 8); `legsFromStops`, `sliceLeg`, `legLineString` (Task 2); `Journey` type.
- Produces: `<MapStage :journey="Journey | null" :step-index="number" />`. No emits. WebGL cannot run under happy-dom, so this task is verified manually via the dev harness; all geometry logic it uses is already unit-tested.

Behavior contract:
- Journey change → clear markers/legs, `fitBounds` over all stops (padding 80, or `easeTo` center/zoom 6 for a single stop); show stop 0's marker.
- `stepIndex` increases by 1 → animate the new leg over ~1100ms (rAF + `sliceLeg`, updating the `leg-active` GeoJSON source), then move it into the `legs-static` source; drop the new stop's marker; camera `fitBounds` over the leg's two endpoints (padding 120, duration 800).
- Any other `stepIndex` change (backward, jump) → rebuild instantly, no animation.
- `prefers-reduced-motion` → skip leg animation entirely.
- Markers: DOM `maplibregl.Marker` with a custom element — red dot (`--route`, 11px circle, 2px `#F1E6C8` border) + Fell English label with parchment text-shadow halo; the current stop's dot gets a CSS pulse animation (disabled under reduced motion).

- [ ] **Step 1: Write src/components/MapStage.vue**

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import type { Journey } from '../types';
import { loadParchmentStyle } from '../services/mapStyle';
import { legsFromStops, sliceLeg, legLineString, type LngLat } from '../services/route';

const props = defineProps<{ journey: Journey | null; stepIndex: number }>();

const container = ref<HTMLDivElement>();
const mapError = ref('');
let map: maplibregl.Map | null = null;
let markers: maplibregl.Marker[] = [];
let ready = false;
let animFrame = 0;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function makeMarkerEl(name: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bj-marker';
  el.innerHTML = `<span class="bj-dot"></span><span class="bj-label">${name.replace(/</g, '&lt;')}</span>`;
  return el;
}

function setSource(id: string, features: GeoJSON.Feature[]): void {
  (map!.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
}

function clearAll(): void {
  cancelAnimationFrame(animFrame);
  markers.forEach((m) => m.remove());
  markers = [];
  if (ready) { setSource('legs-static', []); setSource('leg-active', []); }
}

function showMarkersUpTo(step: number): void {
  markers.forEach((m) => m.remove());
  markers = [];
  const stops = props.journey?.stops ?? [];
  stops.slice(0, step + 1).forEach((s, i) => {
    const el = makeMarkerEl(s.name);
    if (i === step && !reducedMotion) el.classList.add('bj-current');
    markers.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map!));
  });
}

function renderStep(step: number, animate: boolean): void {
  if (!map || !ready || !props.journey) return;
  cancelAnimationFrame(animFrame);
  const stops = props.journey.stops;
  const legs = legsFromStops(stops);
  const clamped = Math.min(step, stops.length - 1);
  const staticCount = animate ? clamped - 1 : clamped;
  setSource('legs-static', legs.slice(0, Math.max(0, staticCount)).map(legLineString));
  setSource('leg-active', []);
  showMarkersUpTo(clamped);

  if (animate && clamped > 0 && !reducedMotion) {
    const [from, to] = legs[clamped - 1];
    const start = performance.now();
    const DURATION = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setSource('leg-active', [legLineString(sliceLeg(from, to, eased))]);
      if (t < 1) animFrame = requestAnimationFrame(tick);
      else { setSource('legs-static', legs.slice(0, clamped).map(legLineString)); setSource('leg-active', []); }
    };
    animFrame = requestAnimationFrame(tick);
  } else if (animate && clamped > 0) {
    setSource('legs-static', legs.slice(0, clamped).map(legLineString));
  }

  // Camera
  if (clamped === 0) {
    map.easeTo({ center: [stops[0].lng, stops[0].lat], zoom: Math.max(map.getZoom(), 5.5), duration: 800 });
  } else {
    const [from, to] = legs[clamped - 1] as [LngLat, LngLat];
    map.fitBounds(new maplibregl.LngLatBounds(from, from).extend(to), { padding: 120, duration: 800, maxZoom: 9 });
  }
}

function fitJourney(): void {
  const stops = props.journey?.stops ?? [];
  if (!map || !stops.length) return;
  if (stops.length === 1) {
    map.easeTo({ center: [stops[0].lng, stops[0].lat], zoom: 6, duration: 0 });
    return;
  }
  const b = new maplibregl.LngLatBounds([stops[0].lng, stops[0].lat], [stops[0].lng, stops[0].lat]);
  stops.forEach((s) => b.extend([s.lng, s.lat]));
  map.fitBounds(b, { padding: 80, duration: 0 });
}

onMounted(async () => {
  let style: any;
  try {
    style = await loadParchmentStyle();
  } catch {
    mapError.value = 'Could not load the base map — check your internet connection and reload.';
    return;
  }
  map = new maplibregl.Map({
    container: container.value!,
    style,
    center: [35.2, 31.6],
    zoom: 5.5,
    attributionControl: { compact: true },
  });
  map.on('load', () => {
    for (const id of ['legs-static', 'leg-active']) {
      map!.addSource(id, { type: 'geojson', data: EMPTY });
      map!.addLayer({
        id,
        type: 'line',
        source: id,
        paint: { 'line-color': '#A93226', 'line-width': 3.5, 'line-dasharray': [2.2, 1.8] },
        layout: { 'line-cap': 'round' },
      });
    }
    ready = true;
    if (props.journey) { fitJourney(); renderStep(props.stepIndex, false); }
  });
});

onBeforeUnmount(() => { cancelAnimationFrame(animFrame); map?.remove(); });

watch(() => props.journey?.id, () => {
  if (!ready) return;
  clearAll();
  if (props.journey) { fitJourney(); renderStep(0, false); }
});

// Re-render on any stop edit (coords, names) without animation.
watch(() => JSON.stringify(props.journey?.stops ?? []), () => {
  if (ready && props.journey) renderStep(props.stepIndex, false);
});

watch(() => props.stepIndex, (n, o) => {
  if (ready) renderStep(n, n === (o ?? 0) + 1);
});
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="container" class="h-full w-full" />
    <div
      v-if="mapError"
      class="absolute inset-0 flex items-center justify-center p-8 text-center"
      style="background: var(--panel); color: var(--muted)"
    >
      {{ mapError }}
    </div>
  </div>
</template>

<style>
.bj-marker { display: flex; align-items: center; gap: 6px; pointer-events: none; }
.bj-dot {
  width: 11px; height: 11px; border-radius: 50%;
  background: var(--route); border: 2px solid #f1e6c8; box-shadow: 0 0 0 1px rgba(74, 59, 34, 0.4);
  flex: none;
}
.bj-current .bj-dot { animation: bj-pulse 1.6s ease-out infinite; }
@keyframes bj-pulse {
  0% { box-shadow: 0 0 0 0 rgba(169, 50, 38, 0.55); }
  100% { box-shadow: 0 0 0 14px rgba(169, 50, 38, 0); }
}
.bj-label {
  font-family: 'IM Fell English', serif; font-size: 16px; color: var(--map-ink);
  text-shadow: 0 0 3px var(--parchment), 0 0 6px var(--parchment), 0 0 9px var(--parchment);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .bj-current .bj-dot { animation: none; }
}
</style>
```

- [ ] **Step 2: Replace src/App.vue with a temporary dev harness**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import MapStage from './components/MapStage.vue';
import type { Journey } from './types';

const sample: Journey = {
  id: 'sample', name: 'Abram — Genesis 12', passageText: '',
  createdAt: '', updatedAt: '',
  stops: [
    { id: '1', name: 'Haran', modernHint: '', lat: 36.864, lng: 39.031, event: 'Abram departs.', verseRef: 'Gen 12:4', coordSource: 'gazetteer' },
    { id: '2', name: 'Shechem', modernHint: '', lat: 32.213, lng: 35.282, event: 'The promise.', verseRef: 'Gen 12:6', coordSource: 'gazetteer' },
    { id: '3', name: 'Bethel', modernHint: '', lat: 31.930, lng: 35.221, event: 'An altar.', verseRef: 'Gen 12:8', coordSource: 'gazetteer' },
    { id: '4', name: 'Negev', modernHint: '', lat: 30.985, lng: 34.930, event: 'Southward.', verseRef: 'Gen 12:9', coordSource: 'gazetteer' },
    { id: '5', name: 'Egypt', modernHint: '', lat: 30.588, lng: 31.500, event: 'Famine.', verseRef: 'Gen 12:10', coordSource: 'gazetteer' },
  ],
};
const step = ref(0);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 min-h-0"><MapStage :journey="sample" :step-index="step" /></div>
    <div class="flex gap-2 p-3" style="background: var(--panel)">
      <button class="btn" @click="step = Math.max(0, step - 1)">←</button>
      <button class="btn" @click="step = Math.min(4, step + 1)">→</button>
      <span class="font-mono-num self-center">{{ step + 1 }} / 5</span>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the browser. Verify each:
- Map loads in parchment tones: cream land, sea-glass Mediterranean, no roads/POIs/modern city labels; country labels faint sepia.
- Haran marker visible with Fell English label; map framed over all five stops.
- `→` animates a red dashed line crawling Haran→Shechem (~1s), camera frames the leg, Shechem marker drops with a pulse.
- Stepping to the end accumulates all legs; `←` retracts instantly.
- No console errors.

- [ ] **Step 4: Run full test suite + build**

Run: `npx vitest run` — Expected: all pass.
Run: `npm run build` — Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapStage.vue src/App.vue
git commit -m "feat: MapStage with parchment basemap, markers, animated dashed legs"
```

---

### Task 10: Passage section + settings popover (extraction wiring)

**Files:**
- Create: `src/components/PassageSection.vue`, `src/components/SettingsPopover.vue`
- Test: `tests/extraction-flow.test.ts` (tests the pipeline function, extracted for testability)
- Create: `src/services/extraction.ts`

**Interfaces:**
- Consumes: `extractStops`/`GeminiError` (Task 4), `applyGazetteer` (Task 3), `useSettings` (Task 5), `useJourneys` (Task 6).
- Produces:
  - `src/services/extraction.ts`: `runExtraction(passage: string): Promise<{ name: string; stops: Stop[] }>` — throws `GeminiError` with `userMessage 'Add your Gemini API key in Settings first.'` when the key is empty; calls Gemini with `effectivePrompt`, applies gazetteer, and suggests a name: first stop's `verseRef` book+chapter (e.g. `"Gen 12"` from `"Gen 12:4"`) or `'New Journey'` when unparsable.
  - `PassageSection.vue` — emits nothing; drives `useJourneys().startJourney(...)` on success. Shows: passage textarea, collapsible prompt editor (`<details>`, textarea bound to `settings.customPrompt`, falls back to showing the default), `Extract Journey` btn-primary (disabled + "Extracting…" while pending), `Reset prompt` button, inline error paragraph showing `userMessage` (never blank on failure).
  - `SettingsPopover.vue` — props `open: boolean`, emits `close`; password input for API key, text input for model name, bound directly to `useSettings().settings`.

- [ ] **Step 1: Write the failing tests** — `tests/extraction-flow.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runExtraction } from '../src/services/extraction';
import { _resetForTest as resetSettings, useSettings } from '../src/composables/useSettings';

beforeEach(() => { localStorage.clear(); resetSettings(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());

const geminiBody = {
  candidates: [{ content: { parts: [{ text: JSON.stringify([
    { name: 'Haran', modernHint: 'Harran', lat: 1, lng: 2, event: 'Departs.', verseRef: 'Gen 12:4' },
    { name: 'Narnia', modernHint: '', lat: 3, lng: 4, event: 'Fictional.', verseRef: 'Gen 12:5' },
  ]) }] } }],
};

describe('runExtraction', () => {
  it('requires an API key', async () => {
    await expect(runExtraction('text')).rejects.toMatchObject({
      userMessage: expect.stringContaining('API key'),
    });
  });

  it('extracts, applies gazetteer, and suggests a name', async () => {
    useSettings().settings.value.geminiApiKey = 'KEY';
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => geminiBody } as Response);
    const { name, stops } = await runExtraction('passage text');
    expect(name).toBe('Gen 12');
    expect(stops[0].coordSource).toBe('gazetteer');
    expect(stops[0].lat).toBeCloseTo(36.864, 2); // gazetteer override, not Gemini's lat:1
    expect(stops[1].coordSource).toBe('model');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/extraction-flow.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write src/services/extraction.ts**

```ts
import type { Stop } from '../types';
import { extractStops, GeminiError } from './gemini';
import { applyGazetteer } from './gazetteer';
import { useSettings } from '../composables/useSettings';

export async function runExtraction(passage: string): Promise<{ name: string; stops: Stop[] }> {
  const { settings, effectivePrompt } = useSettings();
  if (!settings.value.geminiApiKey.trim()) {
    throw new GeminiError('Add your Gemini API key in Settings first.');
  }
  const raw = await extractStops(passage, effectivePrompt.value, settings.value.geminiApiKey, settings.value.geminiModel);
  const stops = applyGazetteer(raw);
  const m = stops[0]?.verseRef.match(/^(.+?)\s+(\d+)/);
  const name = m ? `${m[1]} ${m[2]}` : 'New Journey';
  return { name, stops };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/extraction-flow.test.ts` — Expected: PASS.

- [ ] **Step 5: Write src/components/SettingsPopover.vue**

```vue
<script setup lang="ts">
import { useSettings } from '../composables/useSettings';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const { settings } = useSettings();
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(20, 15, 6, 0.6)" @click.self="emit('close')">
    <div class="w-96 rounded border p-5" style="background: var(--panel); border-color: var(--line)">
      <h2 class="sec-title mb-4">Settings</h2>
      <label class="mb-1 block text-sm" for="bj-key">Gemini API key</label>
      <input id="bj-key" v-model="settings.geminiApiKey" type="password" autocomplete="off" placeholder="AIza…" />
      <p class="mb-3 mt-1 text-xs" style="color: var(--faint)">Stored only in this browser's localStorage.</p>
      <label class="mb-1 block text-sm" for="bj-model">Model</label>
      <input id="bj-model" v-model="settings.geminiModel" type="text" />
      <div class="mt-4 flex justify-end">
        <button class="btn" @click="emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Write src/components/PassageSection.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { runExtraction } from '../services/extraction';
import { GeminiError, DEFAULT_PROMPT } from '../services/gemini';
import { useSettings } from '../composables/useSettings';
import { useJourneys } from '../composables/useJourneys';

const { settings, resetPrompt } = useSettings();
const { startJourney } = useJourneys();

const passage = ref('');
const busy = ref(false);
const error = ref('');

const promptText = computed({
  get: () => settings.value.customPrompt ?? DEFAULT_PROMPT,
  set: (v: string) => { settings.value.customPrompt = v === DEFAULT_PROMPT ? null : v; },
});

async function extract(): Promise<void> {
  error.value = '';
  if (!passage.value.trim()) { error.value = 'Paste a passage first.'; return; }
  busy.value = true;
  try {
    const { name, stops } = await runExtraction(passage.value);
    startJourney(name, passage.value, stops);
  } catch (e) {
    error.value = e instanceof GeminiError ? e.userMessage : 'Something went wrong — try again.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="border-b px-4 py-4" style="border-color: var(--line)">
    <h2 class="sec-title mb-2">Passage</h2>
    <textarea v-model="passage" rows="5" placeholder="Paste one or more Bible chapters here…" spellcheck="false" />

    <details class="mt-2">
      <summary class="cursor-pointer text-sm" style="color: var(--gold)">Customize extraction prompt</summary>
      <textarea v-model="promptText" rows="6" class="mt-2 text-[13px]" spellcheck="false" />
      <p class="mt-1 text-xs" style="color: var(--faint)">The passage is appended after this prompt. Saved with your settings.</p>
    </details>

    <p v-if="error" class="mt-2 text-sm" style="color: #d8846f">{{ error }}</p>

    <div class="mt-3 flex gap-2">
      <button class="btn btn-primary" :disabled="busy" @click="extract">
        {{ busy ? 'Extracting…' : 'Extract Journey' }}
      </button>
      <button class="btn" :disabled="!settings.customPrompt" @click="resetPrompt">Reset prompt</button>
    </div>
  </section>
</template>
```

- [ ] **Step 7: Run full test suite + typecheck**

Run: `npx vitest run` — Expected: all pass.
Run: `npm run build` — Expected: success (components compile; not yet mounted anywhere).

- [ ] **Step 8: Commit**

```bash
git add src/services/extraction.ts src/components/PassageSection.vue src/components/SettingsPopover.vue tests/extraction-flow.test.ts
git commit -m "feat: extraction pipeline with passage UI, prompt editor, settings popover"
```

---

### Task 11: Stops list with inline editing

**Files:**
- Create: `src/components/StopsSection.vue`, `src/components/StopRow.vue`

**Interfaces:**
- Consumes: `useJourneys()` (`activeJourney`, `touchActive`), `lookupPlace` (Task 3), `Stop`/`CoordSource` types.
- Produces:
  - `StopRow.vue` — props `stop: Stop`, `index: number`, `isLast: boolean`; emits `update` (after any field edit), `move: [delta: -1 | 1]`, `remove`. Read mode shows: roman-ish index (plain number is fine: `1.`), name, coord badge (`✓ gazetteer` green / `? model guess` gold / `✎ manual` muted), coords in IBM Plex Mono (3 decimals), italic event + verseRef. Edit mode (toggled by ✎): text inputs for name, lat, lng, event, verseRef; editing lat/lng sets `coordSource = 'manual'`; a `↺ lookup` button re-queries the gazetteer by name (sets coords + `'gazetteer'` when found).
  - `StopsSection.vue` — renders `StopRow` per stop of `activeJourney`; handles `move`/`remove`/`update` by mutating `activeJourney.value.stops` then calling `touchActive()`; `+ Add stop` appends `{ id: crypto.randomUUID(), name: '', modernHint: '', lat: 31.5, lng: 35.0, event: '', verseRef: '', coordSource: 'manual' }` opened in edit mode; header shows journey name; a `Save to library` btn-primary appears when `!isActiveSaved`, calling `saveActive()`.

- [ ] **Step 1: Write src/components/StopRow.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { Stop } from '../types';
import { lookupPlace } from '../services/gazetteer';

const props = defineProps<{ stop: Stop; index: number; isLast: boolean }>();
const emit = defineEmits<{ update: []; move: [delta: -1 | 1]; remove: [] }>();

const editing = ref(!props.stop.name); // new blank stops open in edit mode

function setCoord(field: 'lat' | 'lng', value: string): void {
  const n = Number(value);
  if (Number.isFinite(n)) {
    props.stop[field] = n;
    props.stop.coordSource = 'manual';
    emit('update');
  }
}

function relookup(): void {
  const hit = lookupPlace(props.stop.name);
  if (hit) {
    props.stop.lat = hit.lat;
    props.stop.lng = hit.lng;
    props.stop.coordSource = 'gazetteer';
    emit('update');
  }
}

const badge = { gazetteer: '✓ gazetteer', model: '? model guess', manual: '✎ manual' } as const;
</script>

<template>
  <div class="border-b border-dashed py-2" style="border-color: var(--line)">
    <div class="flex items-baseline gap-2">
      <span class="font-fell w-5 text-right" style="color: var(--gold)">{{ index + 1 }}</span>

      <template v-if="!editing">
        <span class="font-bold">{{ stop.name }}</span>
        <span
          class="rounded-full px-2 text-[11px]"
          :style="stop.coordSource === 'gazetteer'
            ? 'background:#31402b;color:#a9c495'
            : stop.coordSource === 'model'
              ? 'background:#463517;color:#d8b26a'
              : 'background:#3a3325;color:#9c8e72'"
        >{{ badge[stop.coordSource] }}</span>
        <span class="ml-auto flex gap-2">
          <button title="Edit" style="color: var(--faint)" @click="editing = true">✎</button>
          <button v-if="index > 0" title="Move up" style="color: var(--faint)" @click="emit('move', -1)">↑</button>
          <button v-if="!isLast" title="Move down" style="color: var(--faint)" @click="emit('move', 1)">↓</button>
          <button title="Delete" style="color: var(--faint)" @click="emit('remove')">✕</button>
        </span>
      </template>
      <input
        v-else
        :value="stop.name"
        class="flex-1"
        placeholder="Place name"
        @input="stop.name = ($event.target as HTMLInputElement).value; emit('update')"
      />
    </div>

    <template v-if="!editing">
      <p class="font-mono-num ml-7 text-[11.5px]" style="color: var(--muted)">
        {{ stop.lat.toFixed(3) }} N, {{ stop.lng.toFixed(3) }} E
      </p>
      <p class="ml-7 text-[13px] italic" style="color: #c6b892">{{ stop.event }} — {{ stop.verseRef }}</p>
    </template>

    <div v-else class="ml-7 mt-2 flex flex-col gap-2">
      <div class="flex gap-2">
        <input :value="stop.lat" class="font-mono-num" @change="setCoord('lat', ($event.target as HTMLInputElement).value)" />
        <input :value="stop.lng" class="font-mono-num" @change="setCoord('lng', ($event.target as HTMLInputElement).value)" />
        <button class="btn whitespace-nowrap" title="Look up coordinates by name" @click="relookup">↺ lookup</button>
      </div>
      <input :value="stop.event" placeholder="What happens here (one sentence)" @input="stop.event = ($event.target as HTMLInputElement).value; emit('update')" />
      <input :value="stop.verseRef" placeholder="Gen 12:8" @input="stop.verseRef = ($event.target as HTMLInputElement).value; emit('update')" />
      <div><button class="btn" @click="editing = false">Done</button></div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Write src/components/StopsSection.vue**

```vue
<script setup lang="ts">
import { useJourneys } from '../composables/useJourneys';
import StopRow from './StopRow.vue';

const { activeJourney, isActiveSaved, saveActive, touchActive } = useJourneys();

function move(i: number, delta: -1 | 1): void {
  const stops = activeJourney.value!.stops;
  const j = i + delta;
  [stops[i], stops[j]] = [stops[j], stops[i]];
  touchActive();
}

function remove(i: number): void {
  activeJourney.value!.stops.splice(i, 1);
  touchActive();
}

function addStop(): void {
  activeJourney.value!.stops.push({
    id: crypto.randomUUID(), name: '', modernHint: '', lat: 31.5, lng: 35.0,
    event: '', verseRef: '', coordSource: 'manual',
  });
  touchActive();
}
</script>

<template>
  <section v-if="activeJourney" class="border-b px-4 py-4" style="border-color: var(--line)">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="sec-title">Stops — {{ activeJourney.name }}</h2>
      <button class="text-sm" style="color: var(--gold)" @click="addStop">+ Add stop</button>
    </div>

    <StopRow
      v-for="(stop, i) in activeJourney.stops"
      :key="stop.id"
      :stop="stop"
      :index="i"
      :is-last="i === activeJourney.stops.length - 1"
      @update="touchActive"
      @move="(d) => move(i, d)"
      @remove="remove(i)"
    />

    <button v-if="!isActiveSaved" class="btn btn-primary mt-3" @click="saveActive">Save to library</button>
  </section>
</template>
```

- [ ] **Step 3: Verify compile + tests**

Run: `npm run build` — Expected: success.
Run: `npx vitest run` — Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/StopsSection.vue src/components/StopRow.vue
git commit -m "feat: editable stops list with reorder, delete, add, gazetteer relookup"
```

---

### Task 12: Library section (saved journeys, export/import)

**Files:**
- Create: `src/components/LibrarySection.vue`

**Interfaces:**
- Consumes: `useJourneys()` — `journeys`, `activeJourney`, `selectJourney`, `deleteJourney`, `exportAll`, `importJson`.
- Produces: `LibrarySection.vue`, no props/emits. Rows show name + stop count; the active one gets a gold border; ✕ deletes after `confirm()`. Export triggers a download of `bible-journeys.json` (Blob + temporary `<a download>`). Import opens a hidden `<input type="file" accept=".json">`, reads via `file.text()`, calls `importJson`, shows `Imported: N added, M updated` or the error message inline.

- [ ] **Step 1: Write src/components/LibrarySection.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useJourneys } from '../composables/useJourneys';

const { journeys, activeJourney, selectJourney, deleteJourney, exportAll, importJson } = useJourneys();
const fileInput = ref<HTMLInputElement>();
const status = ref('');

function doExport(): void {
  const blob = new Blob([exportAll()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bible-journeys.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function doImport(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const { added, updated } = importJson(await file.text());
    status.value = `Imported: ${added} added, ${updated} updated.`;
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'Import failed.';
  }
  (e.target as HTMLInputElement).value = '';
}

function remove(id: string, name: string): void {
  if (confirm(`Delete "${name}" from the library?`)) deleteJourney(id);
}
</script>

<template>
  <section class="px-4 py-4">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="sec-title">Library</h2>
      <span class="flex gap-3 text-sm" style="color: var(--gold)">
        <button @click="doExport">Export</button>
        <button @click="fileInput?.click()">Import</button>
      </span>
    </div>
    <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="doImport" />

    <p v-if="status" class="mb-2 text-sm" style="color: var(--muted)">{{ status }}</p>
    <p v-if="!journeys.length" class="text-sm italic" style="color: var(--faint)">
      No saved journeys yet — extract one above.
    </p>

    <div class="flex flex-col gap-1.5">
      <div
        v-for="j in journeys"
        :key="j.id"
        class="flex cursor-pointer items-center justify-between rounded border px-3 py-1.5"
        :style="`background: var(--panel-2); border-color: ${activeJourney?.id === j.id ? 'var(--gold)' : 'var(--line)'}`"
        @click="selectJourney(j.id)"
      >
        <span>{{ j.name }}</span>
        <span class="flex items-center gap-3">
          <span class="text-xs" style="color: var(--faint)">{{ j.stops.length }} stops</span>
          <button title="Delete" style="color: var(--faint)" @click.stop="remove(j.id, j.name)">✕</button>
        </span>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Verify compile + tests**

Run: `npm run build` — Expected: success.
Run: `npx vitest run` — Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/LibrarySection.vue
git commit -m "feat: journey library UI with export/import"
```

---

### Task 13: Presentation bar, sidebar shell, and App assembly

**Files:**
- Create: `src/components/PresentationBar.vue`, `src/components/SidebarPanel.vue`
- Modify: `src/App.vue` (replace the Task 9 dev harness with the real layout)

**Interfaces:**
- Consumes: everything above; `usePlayback` (Task 7).
- Produces:
  - `PresentationBar.vue` — props `journey: Journey | null`, `stepIndex: number`, `playing: boolean`; emits `next`, `prev`, `toggle-play`. Round ← / → buttons (44px, disabled at bounds), current stop name in Fell English 20px + gold verseRef, italic muted event line (single line, ellipsis), `n / N` mono counter, `▶ Play journey` / `❚❚ Pause` button, `← →` kbd hints. Hidden entirely when `journey` is null or has no stops.
  - `SidebarPanel.vue` — props `collapsed: boolean`, emits `toggle-collapse`, `open-settings`; brand row ("Bible Journeys" in Fell SC + ⚙ button + ‹ collapse button); slots the three sections in order: `PassageSection`, `StopsSection`, `LibrarySection`; width 330px, `overflow-y: auto`; when collapsed renders only a thin 36px rail with a › expand button.
  - `App.vue` — owns `usePlayback`, `useJourneys`; resets playback when the active journey id changes; global `keydown` listener wired to `playback.onKeydown` (added `onMounted`, removed `onBeforeUnmount`); settings popover state.

- [ ] **Step 1: Write src/components/PresentationBar.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Journey } from '../types';

const props = defineProps<{ journey: Journey | null; stepIndex: number; playing: boolean }>();
const emit = defineEmits<{ next: []; prev: []; 'toggle-play': [] }>();

const stop = computed(() => props.journey?.stops[props.stepIndex] ?? null);
const count = computed(() => props.journey?.stops.length ?? 0);
</script>

<template>
  <div
    v-if="journey && count > 0 && stop"
    class="flex items-center gap-4 border-t px-4 py-3"
    style="background: var(--panel); border-color: var(--line)"
  >
    <button
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg disabled:opacity-35"
      style="background: var(--panel-2); border-color: var(--line)"
      :disabled="stepIndex === 0"
      aria-label="Previous stop"
      @click="emit('prev')"
    >←</button>
    <button
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg disabled:opacity-35"
      style="background: var(--panel-2); border-color: var(--line)"
      :disabled="stepIndex >= count - 1"
      aria-label="Next stop"
      @click="emit('next')"
    >→</button>

    <div class="min-w-0 flex-1">
      <div class="font-fell text-xl leading-tight">
        {{ stop.name }}
        <span class="ml-2 align-middle text-[13px]" style="color: var(--gold); font-family: 'Alegreya Sans'">{{ stop.verseRef }}</span>
      </div>
      <div class="truncate text-sm italic" style="color: var(--muted)">{{ stop.event }}</div>
    </div>

    <span class="font-mono-num text-[13px]" style="color: var(--muted)">{{ stepIndex + 1 }} / {{ count }}</span>
    <button class="btn whitespace-nowrap" @click="emit('toggle-play')">
      {{ playing ? '❚❚ Pause' : '▶ Play journey' }}
    </button>
    <span class="hidden text-xs sm:inline" style="color: var(--faint)">
      <kbd class="rounded border px-1" style="border-color: var(--line)">←</kbd>
      <kbd class="rounded border px-1" style="border-color: var(--line)">→</kbd>
    </span>
  </div>
</template>
```

- [ ] **Step 2: Write src/components/SidebarPanel.vue**

```vue
<script setup lang="ts">
import PassageSection from './PassageSection.vue';
import StopsSection from './StopsSection.vue';
import LibrarySection from './LibrarySection.vue';

defineProps<{ collapsed: boolean }>();
const emit = defineEmits<{ 'toggle-collapse': []; 'open-settings': [] }>();
</script>

<template>
  <aside
    v-if="!collapsed"
    class="flex w-[330px] flex-none flex-col overflow-y-auto border-r"
    style="background: var(--panel); border-color: var(--line)"
  >
    <div class="flex items-center justify-between border-b px-4 py-4" style="border-color: var(--line)">
      <h1 class="font-fell-sc text-[22px]">Bible Journeys</h1>
      <span class="flex gap-3">
        <button title="Settings" style="color: var(--muted)" @click="emit('open-settings')">⚙</button>
        <button title="Collapse sidebar (presentation mode)" style="color: var(--muted)" @click="emit('toggle-collapse')">‹</button>
      </span>
    </div>
    <PassageSection />
    <StopsSection />
    <LibrarySection />
  </aside>

  <aside
    v-else
    class="flex w-9 flex-none items-start justify-center border-r pt-4"
    style="background: var(--panel); border-color: var(--line)"
  >
    <button title="Expand sidebar" style="color: var(--muted)" @click="emit('toggle-collapse')">›</button>
  </aside>
</template>
```

- [ ] **Step 3: Replace src/App.vue**

```vue
<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import SidebarPanel from './components/SidebarPanel.vue';
import SettingsPopover from './components/SettingsPopover.vue';
import MapStage from './components/MapStage.vue';
import PresentationBar from './components/PresentationBar.vue';
import { useJourneys } from './composables/useJourneys';
import { usePlayback } from './composables/usePlayback';

const { activeJourney } = useJourneys();
const playback = usePlayback(() => activeJourney.value?.stops.length ?? 0);

const collapsed = ref(false);
const settingsOpen = ref(false);

watch(() => activeJourney.value?.id, () => playback.reset());

const onKey = (e: KeyboardEvent) => playback.onKeydown(e);
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="flex h-full">
    <SidebarPanel
      :collapsed="collapsed"
      @toggle-collapse="collapsed = !collapsed"
      @open-settings="settingsOpen = true"
    />
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="min-h-0 flex-1">
        <MapStage :journey="activeJourney" :step-index="playback.stepIndex.value" />
      </div>
      <PresentationBar
        :journey="activeJourney"
        :step-index="playback.stepIndex.value"
        :playing="playback.playing.value"
        @next="playback.next()"
        @prev="playback.prev()"
        @toggle-play="playback.togglePlay()"
      />
    </div>
    <SettingsPopover :open="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>
```

- [ ] **Step 4: Verify compile + full suite**

Run: `npx vitest run` — Expected: all pass.
Run: `npm run build` — Expected: success.

- [ ] **Step 5: Manual verification (end-to-end without Gemini)**

Run: `npm run dev`. In the browser devtools console, seed a journey to avoid needing a key:

```js
localStorage.setItem('bj.journeys', JSON.stringify([{ id: 'j1', name: 'Abram — Gen 12', passageText: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', stops: [
  { id: '1', name: 'Haran', modernHint: '', lat: 36.864, lng: 39.031, event: 'Abram departs at God\'s call.', verseRef: 'Gen 12:4', coordSource: 'gazetteer' },
  { id: '2', name: 'Shechem', modernHint: '', lat: 32.213, lng: 35.282, event: 'The LORD appears to Abram.', verseRef: 'Gen 12:6', coordSource: 'gazetteer' },
  { id: '3', name: 'Egypt', modernHint: '', lat: 30.588, lng: 31.500, event: 'Famine drives Abram to Egypt.', verseRef: 'Gen 12:10', coordSource: 'gazetteer' }
]}]));
localStorage.setItem('bj.activeJourneyId', 'j1');
location.reload();
```

Verify: library shows the journey; selecting shows stops; bar shows "Haran — 1 / 3"; → animates legs; arrow keys work but NOT while the cursor is in the passage textarea; sidebar ‹ collapses to a rail; play/pause works; stop editing (✎, coords, ↺ lookup) updates the map immediately; reload preserves everything.

- [ ] **Step 6: Commit**

```bash
git add src/components/PresentationBar.vue src/components/SidebarPanel.vue src/App.vue
git commit -m "feat: presentation bar, collapsible sidebar, full app assembly"
```

---

### Task 14: README, smoke checklist, live Gemini verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the finished app.
- Produces: documented setup + the spec's manual smoke checklist.

- [ ] **Step 1: Write README.md**

```markdown
# Bible Journeys

A local browser tool for Sunday school: paste Bible chapters, let Gemini
extract the journey stops, and present the route on a parchment-styled map —
a red dashed line that steps forward/back through the story.

## Setup

    npm install
    npm run dev

Open the printed URL. Click ⚙ and paste a Gemini API key
(https://aistudio.google.com/apikey). Default model: `gemini-3.1-flash`.

## Use

1. Paste a chapter into **Passage** (optionally tweak the extraction prompt).
2. **Extract Journey** → review the stops (✓ gazetteer = verified ancient-site
   coordinates; ? model guess = spot-check these; ✎ to edit anything).
3. **Save to library**, collapse the sidebar (‹), and present with ← / → or
   ▶ Play journey.

Journeys live in this browser's localStorage — use Library → Export for a
JSON backup, Import to restore.

## Development

    npx vitest run   # unit tests
    npm run build    # typecheck + production build

## Smoke checklist (manual, needs an API key)

- [ ] Extract Genesis 12 → ordered stops appear, Haran/Shechem/Bethel/Egypt
      flagged ✓ gazetteer.
- [ ] Step through on the map; dashed line animates; camera follows.
- [ ] Edit a stop's coordinates → marker moves immediately; badge → ✎ manual.
- [ ] Save, reload the page → journey and step position at 1, library intact.
- [ ] Export, delete the journey, import → journey restored.
- [ ] Wrong API key → clear inline error mentioning the key.
```

- [ ] **Step 2: Run the smoke checklist live**

With the user's real Gemini API key entered in Settings (ask the user to paste it into the running app — do NOT commit it anywhere), run every checklist item above and fix anything that fails before proceeding.

- [ ] **Step 3: Final full verification**

Run: `npx vitest run` — Expected: all pass.
Run: `npm run build` — Expected: success.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with setup, usage, and smoke checklist"
```

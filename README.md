# Bible Journeys

An interactive map for teaching Bible stories. Paste a chapter, let AI extract
the journey, and present it as an animated route on a parchment-styled map —
a red dashed line that steps from stop to stop, Indiana-Jones style, with
verse cards, real site photos, 3D terrain flyovers, and a ground-level hike
view.

**Live app:** https://jamesburrow23.github.io/bible-journey/

Built for Sunday-school teaching, useful for anyone walking a class through
the geography of a story. Everything runs in your browser — there is no
backend, and your journeys live in your browser's local storage.

## Quick start

1. Open the app and click **⚙** to add a Google Gemini API key
   (free at https://aistudio.google.com/apikey — stored only in your browser).
2. Paste a chapter into **Passage** (any translation) and click
   **Extract Journey**.
3. Review the stops, then **Save to library**.
4. Collapse the sidebar (**‹**) and present with **← / →**, arrow keys, or
   **▶ Play journey**.

## What it does

- **AI journey extraction** — Gemini (search-grounded) reads the passage and
  returns the stops in narrative order, each with a kid-friendly one-line
  summary, verse reference, and 2–5 waypoints tracing the historically
  plausible route (Via Maris, King's Highway, coastal shipping lanes; sea
  legs flagged separately).
- **Scholar-verified coordinates** — every extracted place is checked against
  a bundled gazetteer of **1,335 biblical places** distilled from
  OpenBible.info's geocoding data: verified coordinates, identification
  confidence, translation-variant names (Beth-el/Bethel), and duplicate-name
  disambiguation (three Bethels, two Antiochs) by proximity. Places without a
  confident identification fall back to the AI's search-grounded guess,
  badged `? model guess` for spot-checking. Verse references are validated
  against each place's known mentions (`⚠ verse?` flags mismatches).
- **Three view modes** — classic top-down parchment **Map**; **✈ Flight**, a
  cinematic terrain flyover chasing each leg; **🥾 Hike**, a ground-level
  traversal with blue sky, shaded relief, and the trail unspooling ahead.
  Terrain is real elevation data (AWS Terrain Tiles), with hillshade and
  landcover tinting in every mode.
- **Parchment stop cards** — place name, verse, story blurb, and a photo of
  the actual site today (Wikimedia, credited; click to enlarge).
- **Route sculpting** — drag handles to bend any leg, add bends anywhere,
  and move stops; every curve is stored with the journey.
- **Story tools** — per-stop trail colors for following different characters,
  a corner ledger that reveals each named color as it appears, chapter
  breaks for scene jumps with no travel line, stop duplication for return
  visits, and editable everything (names, coordinates, verses, blurbs).
- **Historical overlays** — a Divided Kingdom (~930–722 BC) preset with
  Israel, Judah, and their neighbors, derived from OpenBible.info region
  contours; the overlay system is data-driven and extensible.
- **Library + export** — journeys autosave locally; export/import as JSON to
  back up or share, with every curve, color, and label preserved.
- **Presentation controls** — adjustable line-draw, camera, and auto-play
  speeds; toggles for the card and overlays; keyboard stepping that ignores
  typing in inputs.

## Running locally

```
npm install
npm run dev
```

- `npm test` — unit tests (Vitest)
- `npm run build` — typecheck + production build
- `node scripts/build-gazetteer.mjs <path-to-Bible-Geocoding-Data-clone>` —
  regenerate `src/assets/gazetteer.json` from
  [openbibleinfo/Bible-Geocoding-Data](https://github.com/openbibleinfo/Bible-Geocoding-Data)

Deploys to GitHub Pages automatically on push to `main`
(`.github/workflows/deploy.yml`).

## Stack

Vue 3 + TypeScript + Vite + Tailwind, MapLibre GL JS (vector basemap restyled
to parchment at runtime, raster-DEM terrain + hillshade), Google Gemini
(`gemini-3.1-flash` by default, model configurable) with Google-Search
grounding and structured output. No backend; the API key and all data stay in
the browser.

## Data credits

- Place data, verse indexes, region contours, and site-photo references from
  [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data)
  (CC-BY 4.0, Stephen Smith / OpenBible.info).
- Basemap tiles by [OpenFreeMap](https://openfreemap.org) © OpenStreetMap
  contributors.
- Terrain elevation from [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
  (Mapzen terrarium).
- Site photos hotlinked from Wikimedia Commons, credited per photo in-app.
- The Israel/Judah kingdom outlines and all historical boundaries are
  traditional scholarly approximations — ancient borders were zones, not
  lines.

## A note on accuracy

The gazetteer carries per-place identification confidence from 10+ scholarly
sources, and the app prefers verified identifications over AI guesses — but
disputed places (Mount Horeb, the Red Sea crossing…) are genuinely disputed.
Badges in the stop list tell you which coordinates are verified (✓), which
are the model's search-grounded best guess (?), and which you set yourself
(✎). When it matters, check against the atlas in the back of your Bible.

# Bible Journeys — Design Spec

**Date:** 2026-08-22
**Status:** Approved design, pre-implementation
**Mockup:** https://claude.ai/code/artifact/97128fd9-93df-4309-b523-8d536969112d

## Purpose

A browser tool for Sunday school: paste one or more Bible chapters, extract the
places characters travel through (via Gemini), and present the journey on a
stylized parchment map — a red dashed "Indiana Jones" line that advances stop
by stop with forward/back controls, so students can follow the progression of
the story visually.

Single user (the teacher), runs locally, presented from a laptop in class.

## Stack

- **App:** Vite + Vue 3 + TypeScript + Tailwind CSS. No backend — everything
  runs in the browser.
- **Map:** MapLibre GL JS with free vector tiles (OpenFreeMap `liberty` style
  as the tile source), restyled at runtime to a parchment look.
- **LLM:** Google Gemini REST API (`generativelanguage.googleapis.com`),
  default model `gemini-3.1-flash`, called directly from the browser with the
  user's API key. Model name is a user-editable setting.
- **Persistence:** localStorage (journeys, settings, API key, custom prompt).
  JSON file export/import for backup.
- **Location:** `~/Projects/personal/bible-journey`, its own git repo.

## Visual identity (from approved mockup)

Dark warm "projection room" chrome around a lit parchment map canvas.

- Chrome `#221B10`, panel `#2B2317`, borders `#453A26`, text ivory `#E8DCC3`,
  muted `#9C8E72`.
- Map: parchment land `#E8DBB7`, sea-glass water `#A9C2B4`, route red
  `#A93226`, map ink `#4A3B22`, gold accent `#B08D4F`.
- Type: **IM Fell English / IM Fell English SC** (wordmark, map-adjacent
  display text, stop names), **Alegreya Sans** (UI), **IBM Plex Mono**
  (coordinates, counters). Google Fonts.
- Single committed theme (no light/dark switching).

## Layout

Two regions plus a bottom bar (as in the mockup):

1. **Left sidebar (~330px, collapsible)** — sections top to bottom:
   - **Brand row:** wordmark + settings affordance (API key, model name).
   - **Passage:** textarea for pasted chapter text; collapsible **"Customize
     extraction prompt"** editor; `Extract Journey` (primary) and
     `Reset prompt` buttons.
   - **Stops:** ordered, editable list for the active journey.
   - **Library:** saved journeys + Export/Import.
2. **Map stage:** full-bleed MapLibre canvas.
3. **Presentation bar:** ← / → round buttons, current stop name (Fell English)
   + verse ref + one-line event caption, `n / N` counter, `▶ Play journey`,
   arrow-key hints.

**Presentation mode:** collapsing the sidebar leaves map + bar only; arrow
keys drive the stepper globally (except when focus is in an input).

## Data model

```ts
interface Stop {
  id: string;            // uuid
  name: string;          // "Bethel"
  modernHint: string;    // "Beitin, West Bank"
  lat: number;
  lng: number;
  event: string;         // one-sentence, kid-friendly
  verseRef: string;      // "Gen 12:8"
  coordSource: 'gazetteer' | 'model' | 'manual';
}

interface Journey {
  id: string;
  name: string;          // "Abram's Call — Genesis 12"
  passageText: string;   // what was pasted
  stops: Stop[];
  createdAt: string;     // ISO
  updatedAt: string;
}

interface Settings {
  geminiApiKey: string;
  geminiModel: string;   // default "gemini-3.1-flash"
  customPrompt: string | null;  // null = built-in default
}
```

localStorage keys: `bj.journeys` (Journey[]), `bj.settings`,
`bj.activeJourneyId`. Export writes a `Journey[]` JSON file; import merges by
id (imported wins on conflict).

## Extraction pipeline

1. User pastes passage text, clicks **Extract Journey**.
2. One `generateContent` call: system/prompt text (custom prompt if set, else
   built-in default) + passage, with `responseMimeType: application/json` and
   a `responseSchema` matching an ordered array of
   `{name, modernHint, lat, lng, event, verseRef}`.
3. **Gazetteer pass:** each stop's `name` (case-insensitive, plus an alias
   table — e.g. Salem→Jerusalem) is looked up in a built-in gazetteer of
   ~120 biblical places with verified coordinates, shipped as a static TS
   module. Match → coordinates overridden, `coordSource: 'gazetteer'`.
   No match → keep Gemini's coordinates, `coordSource: 'model'`, shown with a
   `? model guess` badge so the teacher can spot-check.
4. Result becomes the active (unsaved) journey with an auto-suggested name;
   user reviews/edits stops, then saves to the library.

**Prompt customization:** the default prompt is a visible, editable template
(the passage is appended after it — the prompt never needs a placeholder
token). Edits persist in settings; "Reset prompt" restores the built-in
default. The default prompt asks for: every place traveled to or through, in
narrative order, kid-friendly one-sentence event summaries, verse refs,
best-guess ancient-site coordinates, JSON only.

**Error handling:** missing key → inline nudge to settings; HTTP/quota errors
→ human-readable message in the passage section (never a blank failure);
schema-invalid response → one automatic retry, then error with the raw text
available to copy.

## Stop editing

- Inline edit per stop: name, lat/lng, event text, verse ref
  (mockup's ✎ control opens the row for editing).
- Reorder via up/down controls; delete; **+ Add stop** appends a blank row
  (with a name-based gazetteer lookup button to fill coordinates).
- Any manual coordinate change sets `coordSource: 'manual'`.
- Edits to a saved journey autosave to the library (`updatedAt` bumped).

## Map & presentation behavior

- **Parchment restyle:** load the free style JSON, then programmatically
  recolor layers (land → parchment, water → sea-glass, boundaries/labels
  muted serif tones) and hide modern clutter (roads, POIs, transit). Modern
  country labels kept faint at low zoom for orientation; ancient names come
  from our own stop markers.
- **Route rendering:** one GeoJSON LineString per leg, red dashed line
  (`line-dasharray`), great-circle-ish simple straight legs (adequate at this
  scale). Stops rendered as red dot markers with parchment-halo labels
  (Fell English via a MapLibre symbol layer or DOM markers).
- **Stepper:** advancing reveals the next leg with a ~1s animated draw
  (progressive LineString slicing via `requestAnimationFrame`), drops the
  marker, and `fitBounds`/`easeTo` frames the new leg. Stepping back retracts
  instantly. Visited stops/legs accumulate. `▶ Play journey` auto-advances
  (~1.6s/leg) and toggles to pause.
- **Initial view:** fit all stops of the active journey (or a default
  Israel/Near-East view when none).
- Reduced-motion preference disables draw animation and marker pulse.

## Component breakdown

```
src/
  main.ts, App.vue
  components/
    SidebarPanel.vue        # shell: brand, sections, collapse
    PassageSection.vue      # textarea, prompt editor, extract button, errors
    StopsSection.vue        # list + StopRow.vue (inline edit)
    LibrarySection.vue      # saved journeys, export/import
    SettingsPopover.vue     # API key, model name
    MapStage.vue            # MapLibre init, parchment restyle, markers/legs
    PresentationBar.vue     # stepper UI, caption, play
  composables/
    useJourneys.ts          # library CRUD + localStorage persistence
    useSettings.ts
    usePlayback.ts          # step index, play timer, keyboard handling
  services/
    gemini.ts               # request building, schema, retry, error mapping
    gazetteer.ts            # data + lookup/alias matching
    mapStyle.ts             # style JSON transform to parchment
  types.ts
```

State flows one way: composables own state; `MapStage` and `PresentationBar`
react to `activeJourney` + `stepIndex`. MapLibre object stays encapsulated in
`MapStage`.

## Testing

- **Vitest** unit tests for the pure logic: gazetteer matching/aliases,
  Gemini response parsing/validation (fixture responses, including malformed),
  journey persistence round-trip, export/import merge, step-index reducer.
- Map rendering and Gemini network calls are exercised manually (documented
  smoke checklist in README): extract Genesis 12, step through, edit a stop,
  save, reload, export/import.

## Out of scope (v1)

- Multi-user/sharing, hosting, auth.
- Automatic verse lookup (user pastes text from their preferred translation).
- Historical-borders overlays, terrain, images per stop.
- Mobile layout (laptop/projector only).

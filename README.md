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

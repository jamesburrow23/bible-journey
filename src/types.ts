export type CoordSource = 'gazetteer' | 'model' | 'manual';

export interface Waypoint {
  lat: number;
  lng: number;
}

export interface RawStop {
  name: string;
  modernHint: string;
  lat: number;
  lng: number;
  event: string;
  verseRef: string;
  /** Intermediate waypoints tracing the route from the previous stop. */
  via?: Waypoint[];
  /** How the traveler reached this stop from the previous one. */
  legMode?: 'land' | 'sea';
  /** Kind of place, for the 3D miniature shown on arrival. */
  siteType?: 'city' | 'village' | 'palace' | 'temple' | 'mountain' | 'wilderness' | 'water' | 'camp';
  /** New chapter: the narrative jumps here with no travel from the previous stop — no connecting line. */
  breakBefore?: boolean;
}

export interface Stop extends RawStop {
  id: string;
  coordSource: CoordSource;
  /** Identification confidence (0-1000) when matched in the gazetteer. */
  confidence?: number;
  /** Photo of the identified site (Wikimedia, credited). */
  photo?: { url: string; credit: string; creditUrl?: string };
  /** Whether verseRef appears among the place's known verse mentions. */
  verseOk?: boolean;
  /** Trail color for this stop and the leg arriving at it (default route red). */
  color?: string;
}

export interface Journey {
  id: string;
  name: string;
  passageText: string;
  stops: Stop[];
  /** Trail-color legend labels, hex → name (e.g. "#6B7A3A" → "Elijah"). */
  colorLabels?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  geminiApiKey: string;
  geminiModel: string;
  customPrompt: string | null;
  /** Leg draw animation duration (ms). */
  drawMs: number;
  /** Camera pan/zoom duration (ms). */
  cameraMs: number;
  /** Auto-play pace between stops (ms). */
  playMs: number;
  /** Show the parchment info card on the map at the current stop. */
  showMapCard: boolean;
  /** Camera style: flat map, high chase flight, or ground-level hike. */
  viewMode: 'map' | 'flight' | 'hike';
}

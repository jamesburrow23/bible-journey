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
  /** Leg draw animation duration (ms). */
  drawMs: number;
  /** Camera pan/zoom duration (ms). */
  cameraMs: number;
  /** Auto-play pace between stops (ms). */
  playMs: number;
  /** Show the parchment info card on the map at the current stop. */
  showMapCard: boolean;
  /** Active historical overlay preset id, or null for none. */
  activeOverlay: string | null;
  /** Camera style: flat map, high chase flight, or ground-level hike. */
  viewMode: 'map' | 'flight' | 'hike';
}

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

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

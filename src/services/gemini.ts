import type { RawStop } from '../types';

export const DEFAULT_PROMPT = `You are a biblical geography assistant with access to Google Search. From the passage below, extract every place a character travels to or through, in narrative order. For each stop return: name (the biblical place name), modernHint (the identified modern location or archaeological site), lat and lng (decimal-degree coordinates of the ancient site), event (a one-sentence summary of what happens there, suitable for children), verseRef (book chapter:verse), siteType (what kind of place this stop is in the story: city, village, palace, temple, mountain, wilderness, water, or camp), legMode ("land" or "sea" — how the traveler reached this stop from the previous stop), and via (2-5 intermediate {lat, lng} waypoints tracing the historically plausible route from the previous stop: follow ancient roads such as the Via Maris, the King's Highway, or the Fertile Crescent arc for land travel, and coastal shipping lanes for sea travel; never route a land journey across open water; the first stop's via is an empty array), and breakBefore (true only when the narrative jumps to this place as a new scene WITHOUT the characters traveling there from the previous stop — e.g. the story picks up with someone else in another city; travel legs, even implied ones, are false). Coordinate accuracy is critical — an incorrect location is a total failure. If you are not fully certain of a place's location, use Google Search to find the identified ancient site (tell, ruin, or modern successor town) and use its coordinates. Only include places on the journey itself, not places merely mentioned. Return JSON only.`;

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
      legMode: { type: 'STRING', enum: ['land', 'sea'] },
      siteType: { type: 'STRING', enum: ['city', 'village', 'palace', 'temple', 'mountain', 'wilderness', 'water', 'camp'] },
      breakBefore: { type: 'BOOLEAN' },
      via: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { lat: { type: 'NUMBER' }, lng: { type: 'NUMBER' } },
          required: ['lat', 'lng'],
        },
      },
    },
    required: ['name', 'lat', 'lng', 'event', 'verseRef'],
  },
};

export class GeminiError extends Error {
  userMessage: string;
  kind: 'auth' | 'quota' | 'content' | 'http';
  constructor(userMessage: string, detail?: string, kind: 'auth' | 'quota' | 'content' | 'http' = 'content') {
    super(detail ?? userMessage);
    this.name = 'GeminiError';
    this.userMessage = userMessage;
    this.kind = kind;
  }
}

export function parseGeminiResponse(body: unknown): RawStop[] {
  // Grounded responses can split the answer across several text parts.
  const parts = (body as any)?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('')
    : undefined;
  if (typeof text !== 'string' || text === '') {
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
      legMode: s.legMode === 'sea' ? 'sea' as const : 'land' as const,
      ...(['city', 'village', 'palace', 'temple', 'mountain', 'wilderness', 'water', 'camp'].includes(s.siteType)
        ? { siteType: s.siteType }
        : {}),
      ...(s.breakBefore === true ? { breakBefore: true } : {}),
      via: Array.isArray(s.via)
        ? s.via
            .filter((w: any) => typeof w?.lat === 'number' && typeof w?.lng === 'number')
            .map((w: any) => ({ lat: w.lat, lng: w.lng }))
        : [],
    };
  });
}

async function callOnce(passage: string, prompt: string, apiKey: string, model: string): Promise<RawStop[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\nPASSAGE:\n${passage}` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
    });
  } catch (err) {
    throw new GeminiError('Network error — check your internet connection and try again.', String(err), 'http');
  }
  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new GeminiError('Request rejected — check your Gemini API key in Settings.', undefined, 'auth');
    }
    if (res.status === 429) {
      throw new GeminiError('Gemini quota exceeded — wait a minute and try again.', undefined, 'quota');
    }
    throw new GeminiError(`Gemini request failed (HTTP ${res.status}). Try again.`, undefined, 'http');
  }
  return parseGeminiResponse(await res.json());
}

export async function extractStops(passage: string, prompt: string, apiKey: string, model: string): Promise<RawStop[]> {
  try {
    return await callOnce(passage, prompt, apiKey, model);
  } catch (e) {
    // Retry once only for content and http errors, not auth/quota failures.
    if (e instanceof GeminiError && e.kind !== 'auth' && e.kind !== 'quota') {
      return await callOnce(passage, prompt, apiKey, model);
    }
    throw e;
  }
}

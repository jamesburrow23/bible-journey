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
  kind: 'auth' | 'quota' | 'content' | 'http';
  constructor(userMessage: string, detail?: string, kind: 'auth' | 'quota' | 'content' | 'http' = 'content') {
    super(detail ?? userMessage);
    this.name = 'GeminiError';
    this.userMessage = userMessage;
    this.kind = kind;
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
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\nPASSAGE:\n${passage}` }] }],
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

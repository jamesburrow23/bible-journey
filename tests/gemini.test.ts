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
  it('joins multiple text parts before parsing (grounded responses)', () => {
    const half = stopJson.length >> 1;
    const body = {
      candidates: [{ content: { parts: [{ text: stopJson.slice(0, half) }, { text: stopJson.slice(half) }] } }],
    };
    expect(parseGeminiResponse(body)).toHaveLength(1);
  });
  it('passes through via waypoints and legMode, defaulting when absent or malformed', () => {
    const body = {
      candidates: [{ content: { parts: [{ text: JSON.stringify([
        { name: 'A', lat: 1, lng: 2, event: 'e', verseRef: 'v' },
        { name: 'B', lat: 3, lng: 4, event: 'e', verseRef: 'v', legMode: 'sea', via: [{ lat: 5, lng: 6 }, { lat: 'x' }] },
      ]) }] } }],
    };
    const [a, b] = parseGeminiResponse(body);
    expect(a.via).toEqual([]);
    expect(a.legMode).toBe('land');
    expect(b.legMode).toBe('sea');
    expect(b.via).toEqual([{ lat: 5, lng: 6 }]); // malformed waypoint dropped
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
    expect(payload.tools).toEqual([{ google_search: {} }]); // search grounding enabled
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

  it('maps fetch rejection (TypeError) to network error message', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));
    await expect(extractStops('p', 'x', 'K', 'm')).rejects.toMatchObject({
      userMessage: expect.stringContaining('Network'),
    });
  });

  it('maps 404 to a model-name message with Google\'s error attached, and does not retry', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, text: async () => '{"error":"model not found"}' } as Response);
    await expect(extractStops('p', 'x', 'K', 'no-such-model')).rejects.toMatchObject({
      userMessage: expect.stringContaining('no-such-model'),
      message: expect.stringContaining('model not found'),
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 403 (auth error)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403, json: async () => ({}) } as Response);
    await expect(extractStops('p', 'x', 'BAD', 'm')).rejects.toThrow(GeminiError);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});

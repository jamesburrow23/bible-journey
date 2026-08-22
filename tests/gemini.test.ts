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
});

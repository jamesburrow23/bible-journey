import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runExtraction } from '../src/services/extraction';
import { _resetForTest as resetSettings, useSettings } from '../src/composables/useSettings';

beforeEach(() => { localStorage.clear(); resetSettings(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());

const geminiBody = {
  candidates: [{ content: { parts: [{ text: JSON.stringify([
    { name: 'Haran', modernHint: 'Harran', lat: 1, lng: 2, event: 'Departs.', verseRef: 'Gen 12:4' },
    { name: 'Narnia', modernHint: '', lat: 3, lng: 4, event: 'Fictional.', verseRef: 'Gen 12:5' },
  ]) }] } }],
};

describe('runExtraction', () => {
  it('requires an API key', async () => {
    await expect(runExtraction('text')).rejects.toMatchObject({
      userMessage: expect.stringContaining('API key'),
    });
  });

  it('extracts, applies gazetteer, and suggests a name', async () => {
    useSettings().settings.value.geminiApiKey = 'KEY';
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => geminiBody } as Response);
    const { name, stops } = await runExtraction('passage text');
    expect(name).toBe('Gen 12');
    expect(stops[0].coordSource).toBe('gazetteer');
    expect(stops[0].lat).toBeCloseTo(36.864, 2); // gazetteer override, not Gemini's lat:1
    expect(stops[1].coordSource).toBe('model');
  });
});

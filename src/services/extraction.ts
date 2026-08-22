import type { Stop } from '../types';
import { extractStops, GeminiError } from './gemini';
import { applyGazetteer } from './gazetteer';
import { useSettings } from '../composables/useSettings';

export async function runExtraction(passage: string): Promise<{ name: string; stops: Stop[] }> {
  const { settings, effectivePrompt } = useSettings();
  if (!settings.value.geminiApiKey.trim()) {
    throw new GeminiError('Add your Gemini API key in Settings first.');
  }
  const raw = await extractStops(passage, effectivePrompt.value, settings.value.geminiApiKey, settings.value.geminiModel);
  const stops = applyGazetteer(raw);
  const m = stops[0]?.verseRef.match(/^(.+?)\s+(\d+)/);
  const name = m ? `${m[1]} ${m[2]}` : 'New Journey';
  return { name, stops };
}

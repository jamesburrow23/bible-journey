import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { useSettings, _resetForTest } from '../src/composables/useSettings';
import { DEFAULT_PROMPT } from '../src/services/gemini';

beforeEach(() => {
  localStorage.clear();
  _resetForTest();
});

describe('useSettings', () => {
  it('starts with defaults', () => {
    const { settings, effectivePrompt } = useSettings();
    expect(settings.value.geminiModel).toBe('gemini-3.7-flash');
    expect(settings.value.geminiApiKey).toBe('');
    expect(effectivePrompt.value).toBe(DEFAULT_PROMPT);
  });

  it('persists changes to localStorage', async () => {
    const { settings } = useSettings();
    settings.value.geminiApiKey = 'abc';
    await nextTick();
    expect(JSON.parse(localStorage.getItem('bj.settings')!).geminiApiKey).toBe('abc');
  });

  it('loads persisted settings on init', () => {
    localStorage.setItem('bj.settings', JSON.stringify({ geminiApiKey: 'k', geminiModel: 'm2', customPrompt: 'p' }));
    _resetForTest();
    const { settings, effectivePrompt } = useSettings();
    expect(settings.value.geminiModel).toBe('m2');
    expect(effectivePrompt.value).toBe('p');
  });

  it('resetPrompt restores the default', () => {
    const { settings, effectivePrompt, resetPrompt } = useSettings();
    settings.value.customPrompt = 'custom';
    resetPrompt();
    expect(settings.value.customPrompt).toBeNull();
    expect(effectivePrompt.value).toBe(DEFAULT_PROMPT);
  });
});

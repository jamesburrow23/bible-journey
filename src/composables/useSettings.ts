import { ref, computed, watch, type Ref } from 'vue';
import type { Settings } from '../types';
import { DEFAULT_PROMPT } from '../services/gemini';

const KEY = 'bj.settings';

const DEFAULTS: Settings = {
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash',
  customPrompt: null,
  drawMs: 1100,
  cameraMs: 800,
  playMs: 1600,
  showMapCard: true,
  activeOverlay: null,
  viewMode: 'map',
  showMinis: true,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate the pre-hike-mode boolean toggle.
      if (parsed.flightMode && !parsed.viewMode) parsed.viewMode = 'flight';
      delete parsed.flightMode;
      return { ...DEFAULTS, ...parsed };
    }
  } catch { /* corrupted storage falls back to defaults */ }
  return { ...DEFAULTS };
}

let settings: Ref<Settings> | null = null;

/** Test-only: drop the singleton so the next useSettings() re-reads storage. */
export function _resetForTest(): void {
  settings = null;
}

export function useSettings() {
  if (!settings) {
    settings = ref(load());
    watch(settings, (v) => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true });
  }
  const s = settings;
  const effectivePrompt = computed(() => s.value.customPrompt ?? DEFAULT_PROMPT);
  const resetPrompt = () => { s.value.customPrompt = null; };
  return { settings: s, effectivePrompt, resetPrompt };
}

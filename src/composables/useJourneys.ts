import { ref, computed, watch, type Ref } from 'vue';
import type { Journey, Stop } from '../types';

const KEY = 'bj.journeys';
const ACTIVE_KEY = 'bj.activeJourneyId';

let journeys: Ref<Journey[]> | null = null;
let activeJourney: Ref<Journey | null> | null = null;

export function _resetForTest(): void {
  journeys = null;
  activeJourney = null;
}

function loadJourneys(): Journey[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* fall through */ }
  return [];
}

function isJourney(x: any): x is Journey {
  return x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.stops);
}

export function useJourneys() {
  if (!journeys || !activeJourney) {
    journeys = ref(loadJourneys());
    const activeId = localStorage.getItem(ACTIVE_KEY);
    activeJourney = ref(journeys.value.find((j) => j.id === activeId) ?? null);
    watch(journeys, (v) => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true, flush: 'sync' });
    watch(activeJourney, (v) => {
      if (v) localStorage.setItem(ACTIVE_KEY, v.id);
      else localStorage.removeItem(ACTIVE_KEY);
    }, { flush: 'sync' });
  }
  const js = journeys;
  const active = activeJourney;

  const isActiveSaved = computed(() =>
    !!active.value && js.value.some((j) => j.id === active.value!.id),
  );

  function startJourney(name: string, passageText: string, stops: Stop[]): void {
    const now = new Date().toISOString();
    active.value = { id: crypto.randomUUID(), name, passageText, stops, createdAt: now, updatedAt: now };
  }

  function saveActive(): void {
    if (!active.value) return;
    active.value.updatedAt = new Date().toISOString();
    const i = js.value.findIndex((j) => j.id === active.value!.id);
    if (i >= 0) js.value[i] = active.value;
    else js.value.push(active.value);
  }

  function touchActive(): void {
    if (!active.value) return;
    active.value.updatedAt = new Date().toISOString();
    if (isActiveSaved.value) saveActive();
  }

  function selectJourney(id: string): void {
    active.value = js.value.find((j) => j.id === id) ?? null;
  }

  function deleteJourney(id: string): void {
    js.value = js.value.filter((j) => j.id !== id);
    if (active.value?.id === id) active.value = null;
  }

  function exportAll(): string {
    return JSON.stringify(js.value, null, 2);
  }

  function importJson(json: string): { added: number; updated: number } {
    let data: unknown;
    try { data = JSON.parse(json); } catch { throw new Error('Invalid journey file'); }
    if (!Array.isArray(data) || !data.every(isJourney)) throw new Error('Invalid journey file');
    let added = 0, updated = 0;
    for (const imported of data as Journey[]) {
      const i = js.value.findIndex((j) => j.id === imported.id);
      if (i >= 0) { js.value[i] = imported; updated++; }
      else { js.value.push(imported); added++; }
    }
    if (active.value) {
      const fresh = js.value.find((j) => j.id === active.value!.id);
      if (fresh) active.value = fresh;
    }
    return { added, updated };
  }

  return { journeys: js, activeJourney: active, isActiveSaved, startJourney, saveActive, touchActive, selectJourney, deleteJourney, exportAll, importJson };
}

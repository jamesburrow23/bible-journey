import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { useJourneys, _resetForTest } from '../src/composables/useJourneys';
import type { Stop } from '../src/types';

const stops = (): Stop[] => [
  { id: 's1', name: 'Haran', modernHint: '', lat: 36.9, lng: 39.0, event: 'Departs', verseRef: 'Gen 12:4', coordSource: 'gazetteer' },
  { id: 's2', name: 'Shechem', modernHint: '', lat: 32.2, lng: 35.3, event: 'Promise', verseRef: 'Gen 12:6', coordSource: 'gazetteer' },
];

beforeEach(() => {
  localStorage.clear();
  _resetForTest();
});

describe('useJourneys', () => {
  it('startJourney creates an unsaved active journey', () => {
    const j = useJourneys();
    j.startJourney('Abram', 'text', stops());
    expect(j.activeJourney.value?.name).toBe('Abram');
    expect(j.isActiveSaved.value).toBe(false);
    expect(j.journeys.value).toHaveLength(0);
  });

  it('saveActive adds to library and persists', async () => {
    const j = useJourneys();
    j.startJourney('Abram', 'text', stops());
    j.saveActive();
    await nextTick();
    expect(j.isActiveSaved.value).toBe(true);
    expect(JSON.parse(localStorage.getItem('bj.journeys')!)).toHaveLength(1);
  });

  it('touchActive autosaves edits to a saved journey', () => {
    const j = useJourneys();
    j.startJourney('Abram', 'text', stops());
    j.saveActive();
    j.activeJourney.value!.stops[0].name = 'Edited';
    j.touchActive();
    expect(j.journeys.value[0].stops[0].name).toBe('Edited');
  });

  it('selectJourney and deleteJourney manage the active journey', () => {
    const j = useJourneys();
    j.startJourney('A', 't', stops());
    j.saveActive();
    const id = j.activeJourney.value!.id;
    j.startJourney('B', 't2', stops());
    j.selectJourney(id);
    expect(j.activeJourney.value?.name).toBe('A');
    j.deleteJourney(id);
    expect(j.journeys.value).toHaveLength(0);
    expect(j.activeJourney.value).toBeNull();
  });

  it('restores active journey id from storage on init', () => {
    const j = useJourneys();
    j.startJourney('A', 't', stops());
    j.saveActive();
    const id = j.activeJourney.value!.id;
    _resetForTest();
    const j2 = useJourneys();
    expect(j2.activeJourney.value?.id).toBe(id);
  });

  it('exportAll/importJson round-trips and merges by id', () => {
    const j = useJourneys();
    j.startJourney('A', 't', stops());
    j.saveActive();
    const dump = j.exportAll();
    const parsed = JSON.parse(dump);
    parsed[0].name = 'A-imported';
    const result = j.importJson(JSON.stringify(parsed));
    expect(result).toEqual({ added: 0, updated: 1 });
    expect(j.journeys.value[0].name).toBe('A-imported');
  });

  it('importJson rejects malformed input', () => {
    const j = useJourneys();
    expect(() => j.importJson('{"not":"an array"}')).toThrow('Invalid journey file');
    expect(() => j.importJson('garbage')).toThrow('Invalid journey file');
  });
});

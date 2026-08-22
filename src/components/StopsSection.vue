<script setup lang="ts">
import { useJourneys } from '../composables/useJourneys';
import StopRow from './StopRow.vue';

const { activeJourney, isActiveSaved, saveActive, touchActive } = useJourneys();

function move(i: number, delta: -1 | 1): void {
  const stops = activeJourney.value!.stops;
  const j = i + delta;
  [stops[i], stops[j]] = [stops[j], stops[i]];
  touchActive();
}

function remove(i: number): void {
  activeJourney.value!.stops.splice(i, 1);
  touchActive();
}

function addStop(): void {
  activeJourney.value!.stops.push({
    id: crypto.randomUUID(), name: '', modernHint: '', lat: 31.5, lng: 35.0,
    event: '', verseRef: '', coordSource: 'manual',
  });
  touchActive();
}
</script>

<template>
  <section v-if="activeJourney" class="border-b px-4 py-4" style="border-color: var(--line)">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="sec-title">Stops — {{ activeJourney.name }}</h2>
      <button class="text-sm" style="color: var(--gold)" @click="addStop">+ Add stop</button>
    </div>

    <StopRow
      v-for="(stop, i) in activeJourney.stops"
      :key="stop.id"
      :stop="stop"
      :index="i"
      :is-last="i === activeJourney.stops.length - 1"
      @update="touchActive"
      @move="(d) => move(i, d)"
      @remove="remove(i)"
    />

    <button v-if="!isActiveSaved" class="btn btn-primary mt-3" @click="saveActive">Save to library</button>
  </section>
</template>

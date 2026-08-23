<script setup lang="ts">
import { computed } from 'vue';
import { useJourneys } from '../composables/useJourneys';
import { routeEditing } from '../composables/useUiState';
import StopRow from './StopRow.vue';

const { activeJourney, isActiveSaved, saveActive, touchActive } = useJourneys();

const DEFAULT_COLOR = '#A93226';

/** Every trail color the journey uses, in order of first appearance. */
const usedColors = computed(() => {
  const seen: string[] = [];
  for (const s of activeJourney.value?.stops ?? []) {
    const c = s.color ?? DEFAULT_COLOR;
    if (!seen.includes(c)) seen.push(c);
  }
  return seen;
});

function setColorLabel(color: string, label: string): void {
  const j = activeJourney.value!;
  if (!j.colorLabels) j.colorLabels = {};
  if (label.trim()) j.colorLabels[color] = label;
  else delete j.colorLabels[color];
  touchActive();
}

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

function duplicate(i: number): void {
  const stops = activeJourney.value!.stops;
  const src = stops[i];
  stops.splice(i + 1, 0, {
    ...src,
    id: crypto.randomUUID(),
    via: src.via?.map((w) => ({ ...w })), // deep-copy waypoints so edits don't couple
  });
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
      <span class="flex gap-3">
        <button
          class="text-sm"
          :style="routeEditing ? 'color: var(--gold); font-weight: 700' : 'color: var(--gold)'"
          :aria-pressed="routeEditing"
          title="Drag handles on the map to sculpt each leg's curve; changes save with the journey"
          @click="routeEditing = !routeEditing"
        >{{ routeEditing ? '✔ Done editing' : '✏ Edit route' }}</button>
        <button class="text-sm" style="color: var(--gold)" @click="addStop">+ Add stop</button>
      </span>
    </div>
    <p v-if="routeEditing" class="mb-2 text-xs" style="color: var(--faint)">
      Drag a gold-ringed dot to move a stop. Drag a square to bend the route, a dashed circle to add a bend; each new bend adds more circles, so the path can be shaped as finely as you like. Double-click a square to remove it.
    </p>

    <StopRow
      v-for="(stop, i) in activeJourney.stops"
      :key="stop.id"
      :stop="stop"
      :index="i"
      :is-last="i === activeJourney.stops.length - 1"
      @update="touchActive"
      @move="(d) => move(i, d)"
      @remove="remove(i)"
      @duplicate="duplicate(i)"
    />

    <div class="mt-3 border-t pt-3" style="border-color: var(--line)">
      <h3 class="sec-title mb-2">Trail ledger</h3>
      <p class="mb-2 text-xs" style="color: var(--faint)">
        Name a color and it appears in the map's corner ledger once that color is on screen.
      </p>
      <div v-for="c in usedColors" :key="c" class="mb-1.5 flex items-center gap-2">
        <span class="h-4 w-4 flex-none rounded-full" :style="`background: ${c}`" />
        <input
          type="text"
          :value="activeJourney.colorLabels?.[c] ?? ''"
          placeholder="e.g. Elijah"
          class="!py-1 text-sm"
          @input="setColorLabel(c, ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <button v-if="!isActiveSaved" class="btn btn-primary mt-3" @click="saveActive">Save to library</button>
  </section>
</template>

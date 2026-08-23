<script setup lang="ts">
import { computed } from 'vue';
import type { Journey } from '../types';
import { useSettings } from '../composables/useSettings';

const props = defineProps<{ journey: Journey | null; stepIndex: number; playing: boolean }>();
const emit = defineEmits<{ next: []; prev: []; 'toggle-play': [] }>();
const { settings } = useSettings();

const VIEW_MODES = [
  { id: 'map', label: 'Map', hint: 'Classic top-down parchment map' },
  { id: 'flight', label: '✈ Flight', hint: 'Cinematic terrain flyover on each step' },
  { id: 'hike', label: '🥾 Hike', hint: 'Ground-level traversal, up close to the terrain' },
] as const;

const stop = computed(() => {
  const stops = props.journey?.stops;
  if (!stops || !stops.length) return null;
  return stops[Math.min(props.stepIndex, stops.length - 1)] ?? null;
});
const count = computed(() => props.journey?.stops.length ?? 0);
</script>

<template>
  <div
    v-if="journey && count > 0 && stop"
    class="flex items-center gap-4 border-t px-4 py-3"
    style="background: var(--panel); border-color: var(--line)"
  >
    <button
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg disabled:opacity-35"
      style="background: var(--panel-2); border-color: var(--line)"
      :disabled="stepIndex === 0"
      aria-label="Previous stop"
      @click="emit('prev')"
    >←</button>
    <button
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg disabled:opacity-35"
      style="background: var(--panel-2); border-color: var(--line)"
      :disabled="stepIndex >= count - 1"
      aria-label="Next stop"
      @click="emit('next')"
    >→</button>

    <div class="min-w-0 flex-1">
      <div class="font-fell text-xl leading-tight">
        {{ stop.name }}
        <span class="ml-2 align-middle text-[13px]" style="color: var(--gold); font-family: 'Alegreya Sans'">{{ stop.verseRef }}</span>
      </div>
      <div class="truncate text-sm italic" style="color: var(--muted)">{{ stop.event }}</div>
    </div>

    <span class="font-mono-num text-[13px]" style="color: var(--muted)">{{ stepIndex + 1 }} / {{ count }}</span>
    <button class="btn whitespace-nowrap" @click="emit('toggle-play')">
      {{ playing ? '❚❚ Pause' : '▶ Play journey' }}
    </button>
    <button
      class="btn whitespace-nowrap"
      :style="settings.showMapCard ? 'border-color: var(--gold)' : ''"
      :aria-pressed="settings.showMapCard"
      title="Toggle the parchment info card on the map"
      @click="settings.showMapCard = !settings.showMapCard"
    >Card</button>
    <span class="flex overflow-hidden rounded border" style="border-color: var(--line)">
      <button
        v-for="m in VIEW_MODES"
        :key="m.id"
        class="whitespace-nowrap px-3 py-2 text-sm"
        :style="settings.viewMode === m.id
          ? 'background: var(--panel-2); color: var(--gold); font-weight: 700'
          : 'background: transparent; color: var(--muted)'"
        :aria-pressed="settings.viewMode === m.id"
        :title="m.hint"
        @click="settings.viewMode = m.id"
      >{{ m.label }}</button>
    </span>
    <span class="hidden text-xs sm:inline" style="color: var(--faint)">
      <kbd class="rounded border px-1" style="border-color: var(--line)">←</kbd>
      <kbd class="rounded border px-1" style="border-color: var(--line)">→</kbd>
    </span>
  </div>
</template>

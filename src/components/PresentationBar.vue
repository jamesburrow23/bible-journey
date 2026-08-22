<script setup lang="ts">
import { computed } from 'vue';
import type { Journey } from '../types';

const props = defineProps<{ journey: Journey | null; stepIndex: number; playing: boolean }>();
const emit = defineEmits<{ next: []; prev: []; 'toggle-play': [] }>();

const stop = computed(() => props.journey?.stops[props.stepIndex] ?? null);
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
    <span class="hidden text-xs sm:inline" style="color: var(--faint)">
      <kbd class="rounded border px-1" style="border-color: var(--line)">←</kbd>
      <kbd class="rounded border px-1" style="border-color: var(--line)">→</kbd>
    </span>
  </div>
</template>

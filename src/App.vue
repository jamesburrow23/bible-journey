<script setup lang="ts">
import { ref } from 'vue';
import MapStage from './components/MapStage.vue';
import type { Journey } from './types';

const sample: Journey = {
  id: 'sample', name: 'Abram — Genesis 12', passageText: '',
  createdAt: '', updatedAt: '',
  stops: [
    { id: '1', name: 'Haran', modernHint: '', lat: 36.864, lng: 39.031, event: 'Abram departs.', verseRef: 'Gen 12:4', coordSource: 'gazetteer' },
    { id: '2', name: 'Shechem', modernHint: '', lat: 32.213, lng: 35.282, event: 'The promise.', verseRef: 'Gen 12:6', coordSource: 'gazetteer' },
    { id: '3', name: 'Bethel', modernHint: '', lat: 31.930, lng: 35.221, event: 'An altar.', verseRef: 'Gen 12:8', coordSource: 'gazetteer' },
    { id: '4', name: 'Negev', modernHint: '', lat: 30.985, lng: 34.930, event: 'Southward.', verseRef: 'Gen 12:9', coordSource: 'gazetteer' },
    { id: '5', name: 'Egypt', modernHint: '', lat: 30.588, lng: 31.500, event: 'Famine.', verseRef: 'Gen 12:10', coordSource: 'gazetteer' },
  ],
};
const step = ref(0);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 min-h-0"><MapStage :journey="sample" :step-index="step" /></div>
    <div class="flex gap-2 p-3" style="background: var(--panel)">
      <button class="btn" @click="step = Math.max(0, step - 1)">←</button>
      <button class="btn" @click="step = Math.min(4, step + 1)">→</button>
      <span class="font-mono-num self-center">{{ step + 1 }} / 5</span>
    </div>
  </div>
</template>

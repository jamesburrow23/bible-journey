<script setup lang="ts">
import { ref } from 'vue';
import type { Stop } from '../types';
import { lookupPlace } from '../services/gazetteer';

const props = defineProps<{ stop: Stop; index: number; isLast: boolean }>();
const emit = defineEmits<{ update: []; move: [delta: -1 | 1]; remove: [] }>();

const editing = ref(!props.stop.name); // new blank stops open in edit mode

function setCoord(field: 'lat' | 'lng', value: string): void {
  const n = Number(value);
  if (Number.isFinite(n)) {
    props.stop[field] = n;
    props.stop.coordSource = 'manual';
    emit('update');
  }
}

function relookup(): void {
  const hit = lookupPlace(props.stop.name);
  if (hit) {
    props.stop.lat = hit.lat;
    props.stop.lng = hit.lng;
    props.stop.coordSource = 'gazetteer';
    emit('update');
  }
}

const badge = { gazetteer: '✓ gazetteer', model: '? model guess', manual: '✎ manual' } as const;
</script>

<template>
  <div class="border-b border-dashed py-2" style="border-color: var(--line)">
    <div class="flex items-baseline gap-2">
      <span class="font-fell w-5 text-right" style="color: var(--gold)">{{ index + 1 }}</span>

      <template v-if="!editing">
        <span class="font-bold">{{ stop.name }}</span>
        <span
          class="rounded-full px-2 text-[11px]"
          :style="stop.coordSource === 'gazetteer'
            ? 'background:#31402b;color:#a9c495'
            : stop.coordSource === 'model'
              ? 'background:#463517;color:#d8b26a'
              : 'background:#3a3325;color:#9c8e72'"
        >{{ badge[stop.coordSource] }}</span>
        <span class="ml-auto flex gap-2">
          <button title="Edit" style="color: var(--faint)" @click="editing = true">✎</button>
          <button v-if="index > 0" title="Move up" style="color: var(--faint)" @click="emit('move', -1)">↑</button>
          <button v-if="!isLast" title="Move down" style="color: var(--faint)" @click="emit('move', 1)">↓</button>
          <button title="Delete" style="color: var(--faint)" @click="emit('remove')">✕</button>
        </span>
      </template>
      <input
        v-else
        :value="stop.name"
        class="flex-1"
        placeholder="Place name"
        @input="stop.name = ($event.target as HTMLInputElement).value; emit('update')"
      />
    </div>

    <template v-if="!editing">
      <p class="font-mono-num ml-7 text-[11.5px]" style="color: var(--muted)">
        {{ stop.lat.toFixed(3) }} N, {{ stop.lng.toFixed(3) }} E
      </p>
      <p class="ml-7 text-[13px] italic" style="color: #c6b892">{{ stop.event }} — {{ stop.verseRef }}</p>
    </template>

    <div v-else class="ml-7 mt-2 flex flex-col gap-2">
      <div class="flex gap-2">
        <input :value="stop.lat" class="font-mono-num" @change="setCoord('lat', ($event.target as HTMLInputElement).value)" />
        <input :value="stop.lng" class="font-mono-num" @change="setCoord('lng', ($event.target as HTMLInputElement).value)" />
        <button class="btn whitespace-nowrap" title="Look up coordinates by name" @click="relookup">↺ lookup</button>
      </div>
      <input :value="stop.event" placeholder="What happens here (one sentence)" @input="stop.event = ($event.target as HTMLInputElement).value; emit('update')" />
      <input :value="stop.verseRef" placeholder="Gen 12:8" @input="stop.verseRef = ($event.target as HTMLInputElement).value; emit('update')" />
      <div><button class="btn" @click="editing = false">Done</button></div>
    </div>
  </div>
</template>

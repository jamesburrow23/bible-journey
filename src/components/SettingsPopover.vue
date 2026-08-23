<script setup lang="ts">
import { useSettings } from '../composables/useSettings';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const { settings } = useSettings();
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(20, 15, 6, 0.6)" @click.self="emit('close')">
    <div class="w-96 rounded border p-5" style="background: var(--panel); border-color: var(--line)">
      <h2 class="sec-title mb-4">Settings</h2>
      <label class="mb-1 block text-sm" for="bj-key">Gemini API key</label>
      <input id="bj-key" v-model="settings.geminiApiKey" type="password" autocomplete="off" placeholder="AIza…" />
      <p class="mb-3 mt-1 text-xs" style="color: var(--faint)">Stored only in this browser's localStorage.</p>
      <label class="mb-1 block text-sm" for="bj-model">Model</label>
      <input id="bj-model" v-model="settings.geminiModel" type="text" />

      <h2 class="sec-title mb-3 mt-5">Presentation speed</h2>
      <div class="flex flex-col gap-3">
        <label class="block text-sm" for="bj-draw">
          <span class="flex justify-between">Line draw <span class="font-mono-num text-xs" style="color: var(--muted)">{{ settings.drawMs }} ms</span></span>
          <input id="bj-draw" v-model.number="settings.drawMs" type="range" min="300" max="3000" step="100" class="w-full" />
        </label>
        <label class="block text-sm" for="bj-camera">
          <span class="flex justify-between">Camera glide <span class="font-mono-num text-xs" style="color: var(--muted)">{{ settings.cameraMs }} ms</span></span>
          <input id="bj-camera" v-model.number="settings.cameraMs" type="range" min="0" max="2000" step="100" class="w-full" />
        </label>
        <label class="block text-sm" for="bj-play">
          <span class="flex justify-between">Auto-play pace <span class="font-mono-num text-xs" style="color: var(--muted)">{{ settings.playMs }} ms</span></span>
          <input id="bj-play" v-model.number="settings.playMs" type="range" min="800" max="5000" step="200" class="w-full" />
        </label>
      </div>
      <p class="mt-2 text-xs" style="color: var(--faint)">Auto-play pace applies the next time you press Play.</p>

      <div class="mt-4 flex justify-end">
        <button class="btn" @click="emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

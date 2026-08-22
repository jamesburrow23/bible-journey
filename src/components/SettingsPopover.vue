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
      <div class="mt-4 flex justify-end">
        <button class="btn" @click="emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

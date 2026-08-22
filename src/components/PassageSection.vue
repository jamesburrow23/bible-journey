<script setup lang="ts">
import { ref, computed } from 'vue';
import { runExtraction } from '../services/extraction';
import { GeminiError, DEFAULT_PROMPT } from '../services/gemini';
import { useSettings } from '../composables/useSettings';
import { useJourneys } from '../composables/useJourneys';

const { settings, resetPrompt } = useSettings();
const { startJourney } = useJourneys();

const passage = ref('');
const busy = ref(false);
const error = ref('');
const errorDetail = ref('');

const promptText = computed({
  get: () => settings.value.customPrompt ?? DEFAULT_PROMPT,
  set: (v: string) => { settings.value.customPrompt = v === DEFAULT_PROMPT ? null : v; },
});

async function extract(): Promise<void> {
  error.value = '';
  errorDetail.value = '';
  if (!passage.value.trim()) { error.value = 'Paste a passage first.'; return; }
  busy.value = true;
  try {
    const { name, stops } = await runExtraction(passage.value);
    startJourney(name, passage.value, stops);
  } catch (e) {
    error.value = e instanceof GeminiError ? e.userMessage : 'Something went wrong — try again.';
    errorDetail.value = e instanceof GeminiError && e.message !== e.userMessage ? e.message : '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="border-b px-4 py-4" style="border-color: var(--line)">
    <h2 class="sec-title mb-2">Passage</h2>
    <textarea v-model="passage" rows="5" placeholder="Paste one or more Bible chapters here…" spellcheck="false" />

    <details class="mt-2">
      <summary class="cursor-pointer text-sm" style="color: var(--gold)">Customize extraction prompt</summary>
      <textarea v-model="promptText" rows="6" class="mt-2 text-[13px]" spellcheck="false" />
      <p class="mt-1 text-xs" style="color: var(--faint)">The passage is appended after this prompt. Saved with your settings.</p>
    </details>

    <p v-if="error" class="mt-2 text-sm" style="color: #d8846f">{{ error }}</p>
    <details v-if="errorDetail" class="mt-1">
      <summary class="cursor-pointer text-xs" style="color: var(--faint)">Show raw response</summary>
      <pre
        class="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs select-text"
        style="color: var(--faint)"
      >{{ errorDetail }}</pre>
    </details>

    <div class="mt-3 flex gap-2">
      <button class="btn btn-primary" :disabled="busy" @click="extract">
        {{ busy ? 'Extracting…' : 'Extract Journey' }}
      </button>
      <button class="btn" :disabled="!settings.customPrompt" @click="resetPrompt">Reset prompt</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useJourneys } from '../composables/useJourneys';

const { journeys, activeJourney, selectJourney, deleteJourney, exportAll, importJson } = useJourneys();
const fileInput = ref<HTMLInputElement>();
const status = ref('');

function doExport(): void {
  const blob = new Blob([exportAll()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bible-journeys.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function doImport(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const { added, updated } = importJson(await file.text());
    status.value = `Imported: ${added} added, ${updated} updated.`;
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'Import failed.';
  }
  (e.target as HTMLInputElement).value = '';
}

function remove(id: string, name: string): void {
  if (confirm(`Delete "${name}" from the library?`)) deleteJourney(id);
}
</script>

<template>
  <section class="px-4 py-4">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="sec-title">Library</h2>
      <span class="flex gap-3 text-sm" style="color: var(--gold)">
        <button @click="doExport">Export</button>
        <button @click="fileInput?.click()">Import</button>
      </span>
    </div>
    <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="doImport" />

    <p v-if="status" class="mb-2 text-sm" style="color: var(--muted)">{{ status }}</p>
    <p v-if="!journeys.length" class="text-sm italic" style="color: var(--faint)">
      No saved journeys yet — extract one above.
    </p>

    <div class="flex flex-col gap-1.5">
      <div
        v-for="j in journeys"
        :key="j.id"
        class="flex cursor-pointer items-center justify-between rounded border px-3 py-1.5"
        :style="`background: var(--panel-2); border-color: ${activeJourney?.id === j.id ? 'var(--gold)' : 'var(--line)'}`"
        @click="selectJourney(j.id)"
      >
        <span>{{ j.name }}</span>
        <span class="flex items-center gap-3">
          <span class="text-xs" style="color: var(--faint)">{{ j.stops.length }} stops</span>
          <button title="Delete" style="color: var(--faint)" @click.stop="remove(j.id, j.name)">✕</button>
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import PassageSection from './PassageSection.vue';
import StopsSection from './StopsSection.vue';
import LibrarySection from './LibrarySection.vue';

defineProps<{ collapsed: boolean }>();
const emit = defineEmits<{ 'toggle-collapse': []; 'open-settings': [] }>();
</script>

<template>
  <aside
    v-if="!collapsed"
    class="flex w-[330px] flex-none flex-col overflow-y-auto border-r"
    style="background: var(--panel); border-color: var(--line)"
  >
    <div class="flex items-center justify-between border-b px-4 py-4" style="border-color: var(--line)">
      <h1 class="font-fell-sc text-[22px]">Bible Journeys</h1>
      <span class="flex gap-3">
        <button title="Settings" style="color: var(--muted)" @click="emit('open-settings')">⚙</button>
        <button title="Collapse sidebar (presentation mode)" style="color: var(--muted)" @click="emit('toggle-collapse')">‹</button>
      </span>
    </div>
    <PassageSection />
    <StopsSection />
    <LibrarySection />
  </aside>

  <aside
    v-else
    class="flex w-9 flex-none items-start justify-center border-r pt-4"
    style="background: var(--panel); border-color: var(--line)"
  >
    <button title="Expand sidebar" style="color: var(--muted)" @click="emit('toggle-collapse')">›</button>
  </aside>
</template>

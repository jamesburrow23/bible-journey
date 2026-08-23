<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import SidebarPanel from './components/SidebarPanel.vue';
import SettingsPopover from './components/SettingsPopover.vue';
import MapStage from './components/MapStage.vue';
import PresentationBar from './components/PresentationBar.vue';
import { useJourneys } from './composables/useJourneys';
import { usePlayback } from './composables/usePlayback';
import { useSettings } from './composables/useSettings';

const { activeJourney } = useJourneys();
const { settings } = useSettings();
const playback = usePlayback(
  () => activeJourney.value?.stops.length ?? 0,
  () => settings.value.playMs,
  () => settings.value.flightMode, // flights pace playback via leg-complete
);

// In flight mode, auto-play advances when each flyover lands.
function onLegComplete(): void {
  if (!playback.playing.value || !settings.value.flightMode) return;
  const count = activeJourney.value?.stops.length ?? 0;
  if (playback.stepIndex.value >= count - 1) {
    playback.togglePlay(); // journey finished — stop playing
    return;
  }
  setTimeout(() => { if (playback.playing.value) playback.next(); }, 900);
}

const collapsed = ref(false);
const settingsOpen = ref(false);

watch(() => activeJourney.value?.id, () => playback.reset());

const onKey = (e: KeyboardEvent) => playback.onKeydown(e);
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="flex h-full">
    <SidebarPanel
      :collapsed="collapsed"
      @toggle-collapse="collapsed = !collapsed"
      @open-settings="settingsOpen = true"
    />
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="min-h-0 flex-1">
        <MapStage :journey="activeJourney" :step-index="playback.stepIndex.value" @leg-complete="onLegComplete" />
      </div>
      <PresentationBar
        :journey="activeJourney"
        :step-index="playback.stepIndex.value"
        :playing="playback.playing.value"
        @next="playback.next()"
        @prev="playback.prev()"
        @toggle-play="playback.togglePlay()"
      />
    </div>
    <SettingsPopover :open="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>

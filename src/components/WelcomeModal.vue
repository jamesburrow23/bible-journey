<script setup lang="ts">
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; 'open-settings': [] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    style="background: rgba(20, 15, 6, 0.7)"
    @click.self="emit('close')"
  >
    <div class="max-h-[90vh] w-[440px] overflow-y-auto rounded border p-6" style="background: var(--panel); border-color: var(--line)">
      <h1 class="font-fell-sc mb-1 text-2xl">Welcome to Bible Journeys</h1>
      <p class="mb-4 text-sm" style="color: var(--muted)">
        Paste a Bible chapter, and watch the journey unfold on an animated map —
        stop by stop, with verses, photos of the real places, and 3D terrain.
      </p>

      <ol class="flex flex-col gap-3 text-sm">
        <li class="flex gap-3">
          <span class="font-fell flex-none text-lg" style="color: var(--gold)">1.</span>
          <span>
            <b>Get a free Gemini API key</b> — the AI that reads passages runs on your own
            Google key.
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="underline" style="color: var(--gold)">Create one at aistudio.google.com/apikey</a>
            (takes about a minute), then paste it into <b>⚙ Settings</b>. It's stored only in
            this browser — never sent anywhere except to Google.
          </span>
        </li>
        <li class="flex gap-3">
          <span class="font-fell flex-none text-lg" style="color: var(--gold)">2.</span>
          <span><b>Paste a passage</b> (any translation) into the Passage box and click <b>Extract Journey</b>.</span>
        </li>
        <li class="flex gap-3">
          <span class="font-fell flex-none text-lg" style="color: var(--gold)">3.</span>
          <span><b>Review the stops</b> — every place is checked against 1,335 scholar-verified locations. Edit anything (✎), then <b>Save to library</b>.</span>
        </li>
        <li class="flex gap-3">
          <span class="font-fell flex-none text-lg" style="color: var(--gold)">4.</span>
          <span>
            <b>Present</b> — collapse the sidebar (‹) and step with <kbd class="rounded border px-1" style="border-color: var(--line)">←</kbd>
            <kbd class="rounded border px-1" style="border-color: var(--line)">→</kbd> or ▶ Play.
            Try <b>✈ Flight</b> and <b>🥾 Hike</b> for 3D terrain views, and click a stop's photo to enlarge it.
          </span>
        </li>
      </ol>

      <p class="mt-4 text-xs" style="color: var(--faint)">
        Journeys are saved in this browser. Use Library → Export for a backup or to move
        between computers. Reopen this guide anytime with the ? button.
      </p>

      <div class="mt-5 flex justify-end gap-2">
        <button class="btn" @click="emit('close')">Maybe later</button>
        <button class="btn btn-primary" @click="emit('open-settings')">Add my API key</button>
      </div>
    </div>
  </div>
</template>

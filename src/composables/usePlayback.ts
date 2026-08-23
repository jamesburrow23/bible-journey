import { ref, getCurrentInstance, onUnmounted } from 'vue';

export const PLAY_INTERVAL_MS = 1600;

export function usePlayback(stopCount: () => number, intervalMs?: () => number) {
  const stepIndex = ref(0);
  const playing = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  if (getCurrentInstance()) onUnmounted(stopTimer);

  function clamp(n: number): number {
    return Math.min(Math.max(0, stopCount() - 1), Math.max(0, n));
  }

  function stopTimer(): void {
    if (timer) clearInterval(timer);
    timer = null;
    playing.value = false;
  }

  function next(): void { stepIndex.value = clamp(stepIndex.value + 1); }
  function prev(): void { stepIndex.value = clamp(stepIndex.value - 1); }

  function reset(): void {
    stopTimer();
    stepIndex.value = 0;
  }

  function togglePlay(): void {
    if (playing.value) { stopTimer(); return; }
    if (stepIndex.value >= stopCount() - 1) stepIndex.value = 0;
    playing.value = true;
    timer = setInterval(() => {
      if (stepIndex.value >= stopCount() - 1) { stopTimer(); return; }
      next();
      if (stepIndex.value >= stopCount() - 1) stopTimer();
    }, intervalMs?.() ?? PLAY_INTERVAL_MS);
  }

  function onKeydown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  }

  return { stepIndex, playing, next, prev, reset, togglePlay, onKeydown };
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePlayback } from '../src/composables/usePlayback';

describe('usePlayback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('steps forward and back within bounds', () => {
    const p = usePlayback(() => 3);
    expect(p.stepIndex.value).toBe(0);
    p.next(); p.next(); p.next();
    expect(p.stepIndex.value).toBe(2); // clamped at last
    p.prev(); p.prev(); p.prev();
    expect(p.stepIndex.value).toBe(0); // clamped at first
  });

  it('play advances every 1600ms and stops at the end', () => {
    const p = usePlayback(() => 3);
    p.togglePlay();
    expect(p.playing.value).toBe(true);
    vi.advanceTimersByTime(1600);
    expect(p.stepIndex.value).toBe(1);
    vi.advanceTimersByTime(1600);
    expect(p.stepIndex.value).toBe(2);
    vi.advanceTimersByTime(1600);
    expect(p.playing.value).toBe(false);
  });

  it('play from the end restarts at 0', () => {
    const p = usePlayback(() => 2);
    p.next();
    p.togglePlay();
    expect(p.stepIndex.value).toBe(0);
  });

  it('togglePlay pauses', () => {
    const p = usePlayback(() => 5);
    p.togglePlay();
    p.togglePlay();
    expect(p.playing.value).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(p.stepIndex.value).toBe(0);
  });

  it('keyboard steps unless typing in a field', () => {
    const p = usePlayback(() => 3);
    const key = (k: string, target: HTMLElement) => {
      const e = new KeyboardEvent('keydown', { key: k });
      Object.defineProperty(e, 'target', { value: target });
      p.onKeydown(e);
    };
    key('ArrowRight', document.createElement('div'));
    expect(p.stepIndex.value).toBe(1);
    key('ArrowRight', document.createElement('textarea'));
    expect(p.stepIndex.value).toBe(1); // ignored
    key('ArrowLeft', document.createElement('div'));
    expect(p.stepIndex.value).toBe(0);
  });

  it('reset returns to 0 and stops playing', () => {
    const p = usePlayback(() => 5);
    p.next(); p.togglePlay(); p.reset();
    expect(p.stepIndex.value).toBe(0);
    expect(p.playing.value).toBe(false);
  });
});

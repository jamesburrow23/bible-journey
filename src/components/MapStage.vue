<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import type { Journey } from '../types';
import { loadParchmentStyle } from '../services/mapStyle';
import { legPathsFromStops, slicePath, legLineString } from '../services/route';

const props = defineProps<{ journey: Journey | null; stepIndex: number }>();

const container = ref<HTMLDivElement>();
const mapError = ref('');
let map: maplibregl.Map | null = null;
let markers: maplibregl.Marker[] = [];
let ready = false;
let animFrame = 0;
let suppressNextStepCamera = false;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function makeMarkerEl(name: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bj-marker';
  el.innerHTML = `<span class="bj-dot"></span><span class="bj-label">${name.replace(/</g, '&lt;')}</span>`;
  return el;
}

function setSource(id: string, features: GeoJSON.Feature[]): void {
  (map!.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
}

function clearAll(): void {
  cancelAnimationFrame(animFrame);
  markers.forEach((m) => m.remove());
  markers = [];
  if (ready) { setSource('legs-static', []); setSource('leg-active', []); }
}

function showMarkersUpTo(step: number): void {
  markers.forEach((m) => m.remove());
  markers = [];
  const stops = props.journey?.stops ?? [];
  stops.slice(0, step + 1).forEach((s, i) => {
    const el = makeMarkerEl(s.name);
    if (i === step && !reducedMotion) el.classList.add('bj-current');
    markers.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map!));
  });
}

function renderStep(step: number, animate: boolean, moveCamera: boolean): void {
  if (!map || !ready || !props.journey) return;
  cancelAnimationFrame(animFrame);
  const stops = props.journey.stops;
  if (!stops.length) {
    setSource('legs-static', []);
    setSource('leg-active', []);
    showMarkersUpTo(-1);
    return;
  }
  const paths = legPathsFromStops(stops);
  const clamped = Math.min(step, stops.length - 1);
  const staticCount = animate ? clamped - 1 : clamped;
  setSource('legs-static', paths.slice(0, Math.max(0, staticCount)).map(legLineString));
  setSource('leg-active', []);
  showMarkersUpTo(clamped);

  if (animate && clamped > 0 && !reducedMotion) {
    const path = paths[clamped - 1];
    const start = performance.now();
    const DURATION = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setSource('leg-active', [legLineString(slicePath(path, eased))]);
      if (t < 1) animFrame = requestAnimationFrame(tick);
      else { setSource('legs-static', paths.slice(0, clamped).map(legLineString)); setSource('leg-active', []); }
    };
    animFrame = requestAnimationFrame(tick);
  } else if (animate && clamped > 0) {
    setSource('legs-static', paths.slice(0, clamped).map(legLineString));
  }

  // Camera
  if (moveCamera) {
    if (clamped === 0) {
      map.easeTo({ center: [stops[0].lng, stops[0].lat], zoom: Math.max(map.getZoom(), 5.5), duration: 800 });
    } else {
      const path = paths[clamped - 1];
      const b = new maplibregl.LngLatBounds(path[0], path[0]);
      path.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: 120, duration: 800, maxZoom: 9 });
    }
  }
}

function fitJourney(): void {
  const stops = props.journey?.stops ?? [];
  if (!map || !stops.length) return;
  if (stops.length === 1) {
    map.easeTo({ center: [stops[0].lng, stops[0].lat], zoom: 6, duration: 0 });
    return;
  }
  const b = new maplibregl.LngLatBounds([stops[0].lng, stops[0].lat], [stops[0].lng, stops[0].lat]);
  stops.forEach((s) => b.extend([s.lng, s.lat]));
  map.fitBounds(b, { padding: 80, duration: 0 });
}

onMounted(async () => {
  let style: any;
  try {
    style = await loadParchmentStyle();
  } catch {
    mapError.value = 'Could not load the base map — check your internet connection and reload.';
    return;
  }
  map = new maplibregl.Map({
    container: container.value!,
    style,
    center: [35.2, 31.6],
    zoom: 5.5,
    attributionControl: { compact: true },
  });
  map.on('load', () => {
    for (const id of ['legs-static', 'leg-active']) {
      map!.addSource(id, { type: 'geojson', data: EMPTY });
      map!.addLayer({
        id,
        type: 'line',
        source: id,
        paint: { 'line-color': '#A93226', 'line-width': 3.5, 'line-dasharray': [2.2, 1.8] },
        layout: { 'line-cap': 'round' },
      });
    }
    ready = true;
    if (props.journey) { fitJourney(); renderStep(props.stepIndex, false, false); }
  });
});

onBeforeUnmount(() => { cancelAnimationFrame(animFrame); map?.remove(); });

watch(() => props.journey?.id, () => {
  if (!ready) return;
  suppressNextStepCamera = true;
  // If the step reset is a no-op (already at 0), the stepIndex watcher never
  // fires to consume the flag — clear it once this flush cycle completes.
  queueMicrotask(() => { suppressNextStepCamera = false; });
  clearAll();
  if (props.journey) { fitJourney(); renderStep(0, false, false); }
});

// Re-render on any stop edit (coords, names) without animation.
watch(() => JSON.stringify(props.journey?.stops ?? []), () => {
  if (ready && props.journey) renderStep(props.stepIndex, false, false);
});

watch(() => props.stepIndex, (n, o) => {
  const moveCam = !suppressNextStepCamera;
  suppressNextStepCamera = false;
  if (ready) renderStep(n, n === (o ?? 0) + 1, moveCam);
});
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="container" class="h-full w-full" />
    <div
      v-if="mapError"
      class="absolute inset-0 flex items-center justify-center p-8 text-center"
      style="background: var(--panel); color: var(--muted)"
    >
      {{ mapError }}
    </div>
  </div>
</template>

<style>
/* The marker element is exactly the dot, so MapLibre's center anchor lands
   the dot on the coordinate; the label hangs off it without shifting it. */
.bj-marker { position: relative; width: 11px; height: 11px; pointer-events: none; }
.bj-dot {
  position: absolute; inset: 0; border-radius: 50%;
  background: var(--route); border: 2px solid #f1e6c8; box-shadow: 0 0 0 1px rgba(74, 59, 34, 0.4);
}
.bj-current .bj-dot { animation: bj-pulse 1.6s ease-out infinite; }
@keyframes bj-pulse {
  0% { box-shadow: 0 0 0 0 rgba(169, 50, 38, 0.55); }
  100% { box-shadow: 0 0 0 14px rgba(169, 50, 38, 0); }
}
.bj-label {
  position: absolute; left: 17px; top: 50%; transform: translateY(-50%);
  font-family: 'IM Fell English', serif; font-size: 16px; color: var(--map-ink);
  text-shadow: 0 0 3px var(--parchment), 0 0 6px var(--parchment), 0 0 9px var(--parchment);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .bj-current .bj-dot { animation: none; }
}
</style>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import type { Journey, Stop } from '../types';
import { loadParchmentStyle } from '../services/mapStyle';
import { legPathsFromStops, slicePath, legLineString } from '../services/route';
import { useSettings } from '../composables/useSettings';
import { OVERLAYS } from '../overlays';

const props = defineProps<{ journey: Journey | null; stepIndex: number }>();
const { settings } = useSettings();

const container = ref<HTMLDivElement>();
const mapError = ref('');
let map: maplibregl.Map | null = null;
let labelMarkers: maplibregl.Marker[] = [];
let cardMarker: maplibregl.Marker | null = null;
const cardEl = document.createElement('div');
cardEl.className = 'bj-card';
let regionMarkers: maplibregl.Marker[] = [];
let ready = false;
let animFrame = 0;
let suppressNextStepCamera = false;

const overlayModel = computed({
  get: () => settings.value.activeOverlay ?? '',
  set: (v: string) => { settings.value.activeOverlay = v || null; },
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Dots and lines are native map layers so they share the map's projection
// and zoom scaling exactly — they cannot drift apart the way DOM markers can.
const LINE_WIDTH: any = ['interpolate', ['linear'], ['zoom'], 4, 2.2, 7, 3.5, 10, 5.5];
const DOT_RADIUS: any = ['interpolate', ['linear'], ['zoom'], 4, 4, 7, 5.5, 10, 8];
const HALO_RADIUS: any = ['interpolate', ['linear'], ['zoom'], 4, 9, 7, 12, 10, 17];

function currentStep(): number {
  return Math.min(props.stepIndex, (props.journey?.stops.length ?? 1) - 1);
}

function setSource(id: string, features: GeoJSON.Feature[]): void {
  (map!.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
}

function clearAll(): void {
  cancelAnimationFrame(animFrame);
  labelMarkers.forEach((m) => m.remove());
  labelMarkers = [];
  cardMarker?.remove();
  cardMarker = null;
  if (ready) { setSource('legs-static', []); setSource('leg-active', []); setSource('stops', []); }
}

function showStops(step: number): void {
  const stops = props.journey?.stops ?? [];
  const visible = stops.slice(0, step + 1);
  setSource('stops', visible.map((s, i): GeoJSON.Feature => ({
    type: 'Feature',
    properties: { current: i === step },
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
  })));
  labelMarkers.forEach((m) => m.remove());
  labelMarkers = [];
  visible.forEach((s, i) => {
    // The card names the current stop already — skip its label to avoid overlap.
    if (i === step && settings.value.showMapCard) return;
    const el = document.createElement('div');
    el.className = 'bj-label';
    el.textContent = s.name;
    labelMarkers.push(
      new maplibregl.Marker({ element: el, anchor: 'left', offset: [12, 0] }).setLngLat([s.lng, s.lat]).addTo(map!),
    );
  });
}

function updateCard(step: number): void {
  const s: Stop | undefined = props.journey?.stops[step];
  if (!ready || !s || !settings.value.showMapCard) {
    cardMarker?.remove();
    cardMarker = null;
    return;
  }
  cardEl.replaceChildren();
  const name = document.createElement('div');
  name.className = 'bj-card-name';
  name.textContent = s.name;
  const ref_ = document.createElement('div');
  ref_.className = 'bj-card-ref';
  ref_.textContent = s.verseRef;
  const event = document.createElement('div');
  event.className = 'bj-card-event';
  event.textContent = s.event;
  cardEl.append(name, ref_, event);
  if (!cardMarker) {
    cardMarker = new maplibregl.Marker({ element: cardEl, anchor: 'left', offset: [26, -10] })
      .setLngLat([s.lng, s.lat])
      .addTo(map!);
  } else {
    cardMarker.setLngLat([s.lng, s.lat]);
  }
}

function applyOverlay(): void {
  if (!map || !ready) return;
  const preset = OVERLAYS.find((o) => o.id === settings.value.activeOverlay);
  setSource('overlay', preset?.regions ?? []);
  regionMarkers.forEach((m) => m.remove());
  regionMarkers = [];
  for (const r of preset?.regions ?? []) {
    const props = r.properties as any;
    const el = document.createElement('div');
    el.className = 'bj-region-label';
    el.textContent = props.name;
    el.style.color = props.stroke;
    regionMarkers.push(
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(props.labelAt).addTo(map!),
    );
  }
}

function renderStep(step: number, animate: boolean, moveCamera: boolean): void {
  if (!map || !ready || !props.journey) return;
  cancelAnimationFrame(animFrame);
  const stops = props.journey.stops;
  if (!stops.length) {
    setSource('legs-static', []);
    setSource('leg-active', []);
    showStops(-1);
    updateCard(-1);
    return;
  }
  const paths = legPathsFromStops(stops);
  const clamped = Math.min(step, stops.length - 1);
  const staticCount = animate ? clamped - 1 : clamped;
  setSource('legs-static', paths.slice(0, Math.max(0, staticCount)).map(legLineString));
  setSource('leg-active', []);
  showStops(clamped);

  const animating = animate && clamped > 0 && !reducedMotion;
  // The card lands with the traveler: hidden while the leg is drawing.
  if (animating) updateCard(-1);
  else updateCard(clamped);

  if (animating) {
    const path = paths[clamped - 1];
    const start = performance.now();
    const duration = Math.max(100, settings.value.drawMs);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setSource('leg-active', [legLineString(slicePath(path, eased))]);
      if (t < 1) animFrame = requestAnimationFrame(tick);
      else {
        setSource('legs-static', paths.slice(0, clamped).map(legLineString));
        setSource('leg-active', []);
        updateCard(clamped);
      }
    };
    animFrame = requestAnimationFrame(tick);
  } else if (animate && clamped > 0) {
    setSource('legs-static', paths.slice(0, clamped).map(legLineString));
  }

  // Camera
  if (moveCamera) {
    const duration = Math.max(0, settings.value.cameraMs);
    if (clamped === 0) {
      map.easeTo({ center: [stops[0].lng, stops[0].lat], zoom: Math.max(map.getZoom(), 5.5), duration });
    } else {
      const path = paths[clamped - 1];
      const b = new maplibregl.LngLatBounds(path[0], path[0]);
      path.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: 120, duration, maxZoom: 9 });
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

function syncLabelScale(): void {
  if (!map || !container.value) return;
  const size = Math.max(11, Math.min(24, 16 * Math.pow(1.15, map.getZoom() - 5.5)));
  container.value.style.setProperty('--bj-label-size', `${size.toFixed(1)}px`);
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
    attributionControl: { compact: true, customAttribution: 'Region data © <a href="https://www.openbible.info/geo/">OpenBible.info</a> (CC-BY 4.0)' },
  });
  map.on('load', () => {
    // Overlay layers slot in BENEATH the basemap's water so seas and lakes
    // clip the historical regions — a border can never trace over water.
    const waterId = map!.getStyle().layers?.find((l: any) => l.type === 'fill' && /water/i.test(l.id))?.id;
    map!.addSource('overlay', { type: 'geojson', data: EMPTY });
    map!.addLayer({
      id: 'overlay-fill',
      type: 'fill',
      source: 'overlay',
      paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': ['get', 'opacity'] },
    }, waterId);
    map!.addLayer({
      id: 'overlay-outline',
      type: 'line',
      source: 'overlay',
      paint: { 'line-color': ['get', 'stroke'], 'line-width': 1.4, 'line-dasharray': [3, 2.5], 'line-opacity': 0.7 },
    }, waterId);
    for (const id of ['legs-static', 'leg-active']) {
      map!.addSource(id, { type: 'geojson', data: EMPTY });
      map!.addLayer({
        id,
        type: 'line',
        source: id,
        paint: { 'line-color': '#A93226', 'line-width': LINE_WIDTH, 'line-dasharray': [2.2, 1.8] },
        layout: { 'line-cap': 'round' },
      });
    }
    map!.addSource('stops', { type: 'geojson', data: EMPTY });
    map!.addLayer({
      id: 'stop-halo',
      type: 'circle',
      source: 'stops',
      filter: ['==', ['get', 'current'], true],
      paint: {
        'circle-color': 'rgba(169, 50, 38, 0.16)',
        'circle-stroke-color': '#A93226',
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': 0.5,
        'circle-radius': HALO_RADIUS,
      },
    });
    map!.addLayer({
      id: 'stop-dots',
      type: 'circle',
      source: 'stops',
      paint: {
        'circle-color': '#A93226',
        'circle-stroke-color': '#F1E6C8',
        'circle-stroke-width': 2,
        'circle-radius': DOT_RADIUS,
      },
    });
    map!.on('zoom', syncLabelScale);
    syncLabelScale();
    ready = true;
    applyOverlay();
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

watch(() => settings.value.showMapCard, () => {
  if (!ready || !props.journey) return;
  updateCard(currentStep());
  showStops(currentStep()); // restore/remove the current stop's label to match
});

watch(() => settings.value.activeOverlay, applyOverlay);
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="container" class="h-full w-full" />
    <div class="absolute right-3 top-3 z-10">
      <select v-model="overlayModel" class="bj-overlay-select" title="Historical overlay">
        <option value="">No overlay</option>
        <option v-for="o in OVERLAYS" :key="o.id" :value="o.id">{{ o.name }}</option>
      </select>
    </div>
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
.bj-label {
  font-family: 'IM Fell English', serif;
  font-size: var(--bj-label-size, 16px);
  color: var(--map-ink);
  text-shadow: 0 0 3px var(--parchment), 0 0 6px var(--parchment), 0 0 9px var(--parchment);
  white-space: nowrap;
  pointer-events: none;
}
.bj-region-label {
  font-family: 'IM Fell English SC', serif;
  font-size: 15px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  opacity: 0.85;
  text-shadow: 0 0 3px var(--parchment), 0 0 6px var(--parchment), 0 0 9px var(--parchment);
  white-space: nowrap;
  pointer-events: none;
}
.bj-overlay-select {
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 6px 8px;
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 13px;
}
.bj-overlay-select:focus-visible { outline: 2px solid var(--gold); }
.bj-card {
  max-width: 240px;
  background: linear-gradient(160deg, #f0e5c8, #e4d5af);
  border: 1px solid #b09a68;
  outline: 1px solid rgba(176, 154, 104, 0.55);
  outline-offset: -5px;
  box-shadow: 2px 4px 14px rgba(40, 30, 10, 0.35);
  padding: 11px 14px 12px;
  transform: rotate(-1.4deg);
  pointer-events: none;
}
.bj-card-name {
  font-family: 'IM Fell English SC', serif;
  font-size: 17px;
  line-height: 1.15;
  color: #4a3b22;
}
.bj-card-ref {
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #8c6d3f;
  margin: 3px 0 5px;
}
.bj-card-event {
  font-family: 'IM Fell English', serif;
  font-style: italic;
  font-size: 13.5px;
  line-height: 1.4;
  color: #5a492d;
}
</style>

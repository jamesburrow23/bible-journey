<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import type { Journey, Stop } from '../types';
import { loadParchmentStyle } from '../services/mapStyle';
import { legPathsFromStops, slicePath, legLineString, pathLength, pointAlong, type LngLat } from '../services/route';
import { useSettings } from '../composables/useSettings';
import { useJourneys } from '../composables/useJourneys';
import { routeEditing } from '../composables/useUiState';
import { OVERLAYS } from '../overlays';
import { MiniModelLayer } from '../services/modelLayer';

const props = defineProps<{ journey: Journey | null; stepIndex: number }>();
const emit = defineEmits<{ 'leg-complete': [] }>();
const { settings } = useSettings();
const { touchActive } = useJourneys();

const container = ref<HTMLDivElement>();
const mapError = ref('');
const lightbox = ref<{ url: string; alt: string; credit: string; creditUrl?: string } | null>(null);

function closeLightbox(): void {
  lightbox.value = null;
  window.removeEventListener('keydown', onLightboxKey);
}
function onLightboxKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeLightbox();
}
function openLightbox(photo: { url: string; credit: string; creditUrl?: string }, alt: string): void {
  // The 960px thumb is the largest size Wikimedia serves hotlinkers.
  const url = photo.url.includes('px-') ? photo.url.replace(/\/\d+px-/, '/960px-') : photo.url;
  lightbox.value = { url, alt, credit: photo.credit, creditUrl: photo.creditUrl };
  window.addEventListener('keydown', onLightboxKey);
}
let map: maplibregl.Map | null = null;
let labelMarkers: maplibregl.Marker[] = [];
let cardMarker: maplibregl.Marker | null = null;
const cardEl = document.createElement('div');
cardEl.className = 'bj-card';
let regionMarkers: maplibregl.Marker[] = [];
const miniLayer = new MiniModelLayer();
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
    // At ground level, labels don't sit on the terrain and mislead on the
    // horizon — in hike mode show only the current stop's name.
    if (settings.value.viewMode === 'hike' && i !== step) return;
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

/** Show the current stop's miniature (flight/hike only), or hide it. */
let miniToken = 0;
function updateMini(step: number): void {
  if (!map || !ready) return;
  const s: Stop | undefined = props.journey?.stops[step];
  if (!s || settings.value.viewMode === 'map' || !settings.value.showMinis || routeEditing.value) {
    miniToken++;
    miniLayer.hide();
    return;
  }
  const place = { lng: s.lng, lat: s.lat };
  const LIFT = 6; // small lift so sloped ground doesn't clip the base
  const token = ++miniToken;
  miniLayer.show(place, (map.queryTerrainElevation(place) ?? 0) + LIFT, s.siteType ?? 'village');
  // DEM tiles may not be loaded yet (mode just toggled, fresh area) — the
  // elevation query returns null/stale then, sinking the model into the
  // terrain. Re-seat once the map settles.
  map.once('idle', () => {
    if (token !== miniToken || !map) return;
    const fresh = map.queryTerrainElevation(place);
    if (fresh != null) miniLayer.setAltitude(fresh + LIFT);
  });
}

function updateCard(step: number): void {
  updateMini(step); // the miniature travels with the card's lifecycle
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
  if (s.photo?.url) {
    const img = document.createElement('img');
    img.className = 'bj-card-photo';
    const credit = document.createElement('div');
    credit.className = 'bj-card-credit';
    credit.textContent = `Photo: ${s.photo.credit}`;
    img.alt = `The site of ${s.name} today`;
    img.loading = 'lazy';
    img.title = 'Click to enlarge';
    img.onclick = () => openLightbox(s.photo!, img.alt);
    img.onerror = () => { img.remove(); credit.remove(); };
    // Journeys saved before the size-whitelist fix carry 480px thumb URLs
    // Wikimedia refuses; 500px is the nearest allowed size.
    img.src = s.photo.url.replace('/480px-', '/500px-');
    cardEl.append(img, credit);
  }
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

// ---------- Route editing (drag the curve) ----------
let handleMarkers: maplibregl.Marker[] = [];

function viaOf(i: number): { lat: number; lng: number }[] {
  return props.journey?.stops[i].via ?? [];
}

/** Show the whole route (optionally with one leg's via previewed mid-drag). */
function renderEditLines(previewLeg?: number, previewVia?: { lat: number; lng: number }[]): void {
  if (!map || !ready || !props.journey) return;
  const stops = props.journey.stops.map((s, i) =>
    previewLeg === i ? { ...s, via: previewVia } : s,
  );
  setSource('legs-static', legPathsFromStops(stops).map(legLineString));
  setSource('leg-active', []);
}

function commitVia(leg: number, via: { lat: number; lng: number }[]): void {
  if (!props.journey) return;
  props.journey.stops[leg].via = via;
  touchActive(); // autosaves; the stops watcher re-renders + rebuilds handles
}

function rebuildHandles(): void {
  handleMarkers.forEach((m) => m.remove());
  handleMarkers = [];
  if (!routeEditing.value || !map || !ready || !props.journey) return;
  const stops = props.journey.stops;
  for (let i = 1; i < stops.length; i++) {
    const via = viaOf(i);
    const anchors: LngLat[] = [
      [stops[i - 1].lng, stops[i - 1].lat],
      ...via.map((w): LngLat => [w.lng, w.lat]),
      [stops[i].lng, stops[i].lat],
    ];
    // Draggable handle per existing waypoint; double-click removes it.
    via.forEach((w, vi) => {
      const el = document.createElement('div');
      el.className = 'bj-handle';
      el.title = 'Drag to bend the route · double-click to remove';
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([w.lng, w.lat]).addTo(map!);
      m.on('drag', () => {
        const p = m.getLngLat();
        const next = via.map((x, xi) => (xi === vi ? { lat: p.lat, lng: p.lng } : x));
        renderEditLines(i, next);
      });
      m.on('dragend', () => {
        const p = m.getLngLat();
        commitVia(i, via.map((x, xi) => (xi === vi ? { lat: p.lat, lng: p.lng } : x)));
      });
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        commitVia(i, via.filter((_, xi) => xi !== vi));
      });
      handleMarkers.push(m);
    });
    // Ghost handle at each segment midpoint: drag it to add a new bend there.
    for (let s = 0; s < anchors.length - 1; s++) {
      const mid: LngLat = [(anchors[s][0] + anchors[s + 1][0]) / 2, (anchors[s][1] + anchors[s + 1][1]) / 2];
      const el = document.createElement('div');
      el.className = 'bj-handle bj-handle-ghost';
      el.title = 'Drag to add a bend here';
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(mid).addTo(map!);
      const insertAt = s; // segment s sits before via[s]
      m.on('drag', () => {
        const p = m.getLngLat();
        const next = [...via.slice(0, insertAt), { lat: p.lat, lng: p.lng }, ...via.slice(insertAt)];
        renderEditLines(i, next);
      });
      m.on('dragend', () => {
        const p = m.getLngLat();
        commitVia(i, [...via.slice(0, insertAt), { lat: p.lat, lng: p.lng }, ...via.slice(insertAt)]);
      });
      handleMarkers.push(m);
    }
  }
}

function enterEditView(): void {
  if (!map || !ready || !props.journey) return;
  cancelAnimationFrame(animFrame);
  updateCard(-1);
  showStops(props.journey.stops.length - 1); // whole route visible while sculpting
  renderEditLines();
  rebuildHandles();
}

watch(routeEditing, (on) => {
  if (!ready) return;
  if (on) { fitJourney(); enterEditView(); }
  else { rebuildHandles(); if (props.journey) renderStep(currentStep(), false, true); }
});
// ---------- end route editing ----------

function renderStep(step: number, animate: boolean, moveCamera: boolean): void {
  if (!map || !ready || !props.journey) return;
  if (routeEditing.value) { enterEditView(); return; }
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

  if (animating && settings.value.viewMode === 'flight') {
    runFlight(paths[clamped - 1], paths, clamped);
    return; // the flight owns line drawing, camera, card, and completion
  }
  if (animating && settings.value.viewMode === 'hike') {
    runHike(paths[clamped - 1], paths, clamped);
    return;
  }

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
        emit('leg-complete');
      }
    };
    animFrame = requestAnimationFrame(tick);
  } else if (animate && clamped > 0) {
    setSource('legs-static', paths.slice(0, clamped).map(legLineString));
  }

  // Camera
  if (moveCamera) {
    const duration = Math.max(0, settings.value.cameraMs);
    if (settings.value.viewMode === 'flight') {
      // Non-animated transitions (back-step, jump) keep the chase pose.
      const s = stops[clamped];
      map.easeTo({ center: [s.lng, s.lat], zoom: 10.8, pitch: 62, duration });
    } else if (settings.value.viewMode === 'hike') {
      const s = stops[clamped];
      map.easeTo({ center: [s.lng, s.lat], zoom: 13.2, pitch: 84, duration });
    } else if (clamped === 0) {
      map.easeTo({ center: [stops[0].lng, stops[0].lat], zoom: Math.max(map.getZoom(), 5.5), duration });
    } else {
      const path = paths[clamped - 1];
      const b = new maplibregl.LngLatBounds(path[0], path[0]);
      path.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: 120, duration, maxZoom: 9 });
    }
  }
}

/**
 * Cinematic flyover: settle in behind the traveler, then chase the route
 * spline at altitude — bearing smoothed to the path, dashed line drawing
 * underfoot, the next stop rising on the horizon. Card lands on arrival.
 */
function runFlight(path: LngLat[], paths: LngLat[][], clamped: number): void {
  const lenDeg = pathLength(path);
  const durationMs = Math.min(14000, Math.max(3500, 2500 + lenDeg * 111 * 30));
  const zoom = lenDeg <= 0.25 ? 12.2 : lenDeg <= 0.8 ? 11.2 : lenDeg <= 2 ? 10.2 : 9.2;
  const PREROLL = 1400;
  const start = pointAlong(path, 0.001);
  let smooth = start.bearing;
  map!.easeTo({ center: path[0], zoom, pitch: 62, bearing: smooth, duration: PREROLL });
  const begin = performance.now() + PREROLL;
  const tick = (now: number) => {
    if (now < begin) { animFrame = requestAnimationFrame(tick); return; }
    const t = Math.min(1, (now - begin) / durationMs);
    const eased = t * t * (3 - 2 * t); // smoothstep: gentle take-off and landing
    const { point, bearing } = pointAlong(path, eased);
    smooth += (((bearing - smooth + 540) % 360) - 180) * 0.08;
    setSource('leg-active', [legLineString(slicePath(path, eased))]);
    map!.jumpTo({ center: point, zoom, pitch: 62, bearing: smooth });
    if (t < 1) animFrame = requestAnimationFrame(tick);
    else {
      setSource('legs-static', paths.slice(0, clamped).map(legLineString));
      setSource('leg-active', []);
      updateCard(clamped);
      emit('leg-complete');
    }
  };
  animFrame = requestAnimationFrame(tick);
}

/**
 * Ground-level traversal: the free camera hangs ~180m over the trail a few
 * hundred meters behind the traveler, pitched almost to the horizon, so the
 * hills rise around you and the next stop walks in over the ridge line.
 */
function runHike(path: LngLat[], paths: LngLat[][], clamped: number): void {
  const lenDeg = pathLength(path);
  const durationMs = Math.min(45000, Math.max(9000, 4000 + lenDeg * 111 * 160));
  const PREROLL = 1700;
  const start = pointAlong(path, 0.001);
  let smooth = start.bearing;
  let altSmooth: number | null = null;
  // No labels mid-hike — they float off the terrain and mislead on the horizon.
  labelMarkers.forEach((m) => m.remove());
  labelMarkers = [];
  map!.easeTo({ center: path[0], zoom: 13.2, pitch: 84, bearing: smooth, duration: PREROLL - 100 });
  const begin = performance.now() + PREROLL;

  const placeCamera = (cur: LngLat, bearingDeg: number, frac: number): void => {
    const rad = (bearingDeg * Math.PI) / 180;
    const backDeg = 420 / 111000; // camera ~420m behind the traveler
    const back: LngLat = [
      cur[0] - (Math.sin(rad) * backDeg) / Math.cos((cur[1] * Math.PI) / 180),
      cur[1] - Math.cos(rad) * backDeg,
    ];
    const ground = Math.max(
      map!.queryTerrainElevation({ lng: cur[0], lat: cur[1] }) ?? 0,
      map!.queryTerrainElevation({ lng: back[0], lat: back[1] }) ?? 0,
      0,
    );
    altSmooth = altSmooth === null ? ground : altSmooth + (ground - altSmooth) * 0.06;
    // Look farther ahead and higher, so the view rides the horizon.
    const ahead = pointAlong(path, Math.min(1, frac + 0.12)).point;
    const aheadElev = map!.queryTerrainElevation({ lng: ahead[0], lat: ahead[1] }) ?? 0;
    const camOpts = map!.calculateCameraOptionsFromTo(
      new maplibregl.LngLat(back[0], back[1]),
      altSmooth + 150,
      new maplibregl.LngLat(ahead[0], ahead[1]),
      aheadElev + 140,
    );
    map!.jumpTo(camOpts);
  };

  const tick = (now: number) => {
    if (now < begin) { animFrame = requestAnimationFrame(tick); return; }
    const t = Math.min(1, (now - begin) / durationMs);
    const eased = t * t * (3 - 2 * t);
    const { point, bearing } = pointAlong(path, eased);
    smooth += (((bearing - smooth + 540) % 360) - 180) * 0.06;
    setSource('leg-active', [legLineString(slicePath(path, eased))]);
    placeCamera(point, smooth, eased);
    if (t < 1) animFrame = requestAnimationFrame(tick);
    else {
      setSource('legs-static', paths.slice(0, clamped).map(legLineString));
      setSource('leg-active', []);
      showStops(clamped); // arrival: the destination's label (only) returns
      updateCard(clamped);
      emit('leg-complete');
    }
  };
  animFrame = requestAnimationFrame(tick);
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
    maxPitch: 85,
    attributionControl: { compact: true, customAttribution: 'Region data © <a href="https://www.openbible.info/geo/">OpenBible.info</a> (CC-BY 4.0) · Terrain © <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen/AWS</a>' },
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
    // Elevation tiles for flight mode (free AWS terrarium DEM, no key).
    map!.addSource('dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 13,
    });
    applySky();
    map!.addLayer(miniLayer as unknown as maplibregl.CustomLayerInterface);
    map!.on('zoom', syncLabelScale);
    syncLabelScale();
    ready = true;
    applyOverlay();
    applyViewMode(false);
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

function applySky(): void {
  if (!map) return;
  if (settings.value.viewMode === 'hike') {
    // Blue sky at ground level — strong contrast against the ridge line.
    map.setSky({
      'sky-color': '#9dbfdd',
      'horizon-color': '#dfe3d8',
      'fog-color': '#e6dfc6',
      'sky-horizon-blend': 0.7,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.4,
      'atmosphere-blend': 0.85,
    });
  } else {
    // Parchment-tinted atmosphere so the flight horizon fades like an aged map.
    map.setSky({
      'sky-color': '#d7d2bd',
      'horizon-color': '#e8dbb7',
      'fog-color': '#e3d8b8',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.5,
      'atmosphere-blend': 0.8,
    });
  }
}

function applyViewMode(animateCamera: boolean): void {
  applySky();
  if (!map || !ready) return;
  const mode = settings.value.viewMode;
  if (mode === 'map') {
    map.setTerrain(null);
    if (animateCamera) map.easeTo({ pitch: 0, bearing: 0, zoom: Math.min(map.getZoom(), 8), duration: 900 });
    return;
  }
  // Lower exaggeration up close — hills read as cartoonish at hike altitude.
  map.setTerrain({ source: 'dem', exaggeration: mode === 'hike' ? 1.15 : 1.4 });
  const s = props.journey?.stops[currentStep()];
  if (animateCamera && s) {
    if (mode === 'flight') map.easeTo({ center: [s.lng, s.lat], zoom: 10.8, pitch: 62, duration: 1400 });
    else map.easeTo({ center: [s.lng, s.lat], zoom: 13.2, pitch: 84, duration: 1400 });
  }
}

watch(() => settings.value.viewMode, () => {
  applyViewMode(true);
  updateMini(currentStep()); // appears/disappears with the mode
});

watch(() => settings.value.showMinis, () => updateMini(currentStep()));
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
    <div
      v-if="lightbox"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-8"
      style="background: rgba(20, 15, 6, 0.88); cursor: zoom-out"
      @click="closeLightbox"
    >
      <img :src="lightbox.url" :alt="lightbox.alt" class="bj-lightbox-img" />
      <div class="text-center">
        <div class="font-fell text-lg" style="color: var(--ink)">{{ lightbox.alt }}</div>
        <a
          v-if="lightbox.creditUrl"
          :href="lightbox.creditUrl"
          target="_blank"
          rel="noopener"
          class="text-xs underline"
          style="color: var(--muted)"
          @click.stop
        >Photo: {{ lightbox.credit }}</a>
        <div v-else class="text-xs" style="color: var(--muted)">Photo: {{ lightbox.credit }}</div>
      </div>
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
.bj-handle {
  width: 13px; height: 13px; border-radius: 3px;
  background: #f1e6c8; border: 2px solid var(--route);
  box-shadow: 0 1px 4px rgba(40, 30, 10, 0.4);
  cursor: grab;
}
.bj-handle:active { cursor: grabbing; }
.bj-handle-ghost {
  border-radius: 50%;
  background: rgba(241, 230, 200, 0.55);
  border: 1.5px dashed var(--route);
  box-shadow: none;
}
.bj-card {
  max-width: 310px;
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
  font-size: 26px;
  font-weight: 700;
  -webkit-text-stroke: 0.6px #4a3b22; /* Fell SC ships one weight; thicken it */
  line-height: 1.1;
  color: #4a3b22;
}
.bj-card-ref {
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #8c6d3f;
  margin: 4px 0 7px;
}
.bj-card-event {
  font-family: 'IM Fell English', serif;
  font-style: italic;
  font-size: 17px;
  line-height: 1.42;
  color: #5a492d;
}
.bj-card-photo {
  display: block;
  width: 100%;
  height: 150px;
  object-fit: cover;
  margin-top: 10px;
  border: 1px solid #b09a68;
  filter: sepia(0.35) contrast(0.92) saturate(0.85);
  pointer-events: auto; /* the card itself is click-through; the photo isn't */
  cursor: zoom-in;
}
.bj-lightbox-img {
  max-width: min(90vw, 960px);
  max-height: 78vh;
  object-fit: contain;
  border: 3px solid #b09a68;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.bj-card-credit {
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 11px;
  letter-spacing: 0.03em;
  color: #8c7a52;
  margin-top: 4px;
}
</style>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import type { Journey, Stop } from '../types';
import { loadParchmentStyle } from '../services/mapStyle';
import { legPathsFromStops, slicePath, legLineString, pathLength, pointAlong, type LngLat } from '../services/route';
import { useSettings } from '../composables/useSettings';
import { useJourneys } from '../composables/useJourneys';
import { routeEditing } from '../composables/useUiState';

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
let ready = false;
let animFrame = 0;
let suppressNextStepCamera = false;

/** Corner ledger: labeled trail colors, shown only once visible on the map. */
const legendEntries = computed(() => {
  const j = props.journey;
  if (!j) return [];
  const labels = j.colorLabels ?? {};
  const upto = routeEditing.value ? j.stops.length : currentStep() + 1;
  const seen: string[] = [];
  for (const s of j.stops.slice(0, upto)) {
    const c = s.color ?? '#A93226';
    if (!seen.includes(c)) seen.push(c);
  }
  return seen.filter((c) => labels[c]?.trim()).map((c) => ({ color: c, label: labels[c] }));
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Dots and lines are native map layers so they share the map's projection
// and zoom scaling exactly — they cannot drift apart the way DOM markers can.
// Widths keep climbing at close zooms — at hike-mode grazing angles a thin
// draped line foreshortens to invisibility.
const LINE_WIDTH: any = ['interpolate', ['linear'], ['zoom'], 4, 2.2, 7, 3.5, 10, 5.5, 12, 10, 14, 18];
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
    properties: { current: i === step, ...(s.color ? { color: s.color } : {}) },
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

// ---------- Route editing (drag the curve) ----------
let handleMarkers: maplibregl.Marker[] = [];

function viaOf(i: number): { lat: number; lng: number }[] {
  return props.journey?.stops[i].via ?? [];
}

/** Handles get a generous invisible hit area around a small visual. */
function makeHandleEl(visualClass: string, title: string): HTMLElement {
  const hit = document.createElement('div');
  hit.className = 'bj-hit';
  hit.title = title;
  const visual = document.createElement('span');
  visual.className = visualClass;
  hit.appendChild(visual);
  return hit;
}

/** Leg features carrying each leg's trail color (from its arrival stop). */
function legFeatures(paths: LngLat[][], stops: Stop[], count?: number): GeoJSON.Feature[] {
  return paths
    .slice(0, count ?? paths.length)
    .map((p, i) => legLineString(p, stops[i + 1]?.color ? { color: stops[i + 1].color } : {}))
    .filter((f) => (f.geometry as GeoJSON.LineString).coordinates.length >= 2); // broken legs draw nothing
}

function legColorProps(stop: Stop | undefined): Record<string, unknown> {
  return stop?.color ? { color: stop.color } : {};
}

/** Show the whole route, optionally from a temporary stops array mid-drag. */
function renderEditLines(tempStops?: Stop[]): void {
  if (!map || !ready || !props.journey) return;
  const stops = tempStops ?? props.journey.stops;
  setSource('legs-static', legFeatures(legPathsFromStops(stops), stops));
  setSource('leg-active', []);
}

function withVia(leg: number, via: { lat: number; lng: number }[]): Stop[] {
  return props.journey!.stops.map((s, i) => (i === leg ? { ...s, via } : s));
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
  const paths = legPathsFromStops(stops);

  // Draggable handle on every STOP: reposition the destination itself.
  stops.forEach((stop, i) => {
    const el = makeHandleEl('bj-handle bj-handle-stop', `Drag to move ${stop.name || 'this stop'}`);
    const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([stop.lng, stop.lat]).addTo(map!);
    m.on('drag', () => {
      const p = m.getLngLat();
      renderEditLines(stops.map((s, si) => (si === i ? { ...s, lat: p.lat, lng: p.lng } : s)));
    });
    m.on('dragend', () => {
      const p = m.getLngLat();
      stop.lat = p.lat;
      stop.lng = p.lng;
      stop.coordSource = 'manual';
      touchActive();
    });
    handleMarkers.push(m);
  });

  for (let i = 1; i < stops.length; i++) {
    if (!paths[i - 1].length) continue; // scene cut: nothing to bend
    const via = viaOf(i);
    const segCount = via.length + 1; // anchors: prev stop, ...via, stop
    // Draggable handle per existing waypoint; double-click removes it.
    via.forEach((w, vi) => {
      const el = makeHandleEl('bj-handle', 'Drag to bend the route · double-click to remove');
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([w.lng, w.lat]).addTo(map!);
      m.on('drag', () => {
        const p = m.getLngLat();
        renderEditLines(withVia(i, via.map((x, xi) => (xi === vi ? { lat: p.lat, lng: p.lng } : x))));
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
    // Ghost handle on the drawn curve at each segment's middle: drag to add
    // a bend there. Every committed bend creates new segments — and new
    // ghosts — so the path subdivides as finely as needed.
    for (let s = 0; s < segCount; s++) {
      const mid = pointAlong(paths[i - 1], (s + 0.5) / segCount).point;
      const el = makeHandleEl('bj-handle bj-handle-ghost', 'Drag to add a bend here');
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(mid).addTo(map!);
      const insertAt = s; // segment s sits before via[s]
      m.on('drag', () => {
        const p = m.getLngLat();
        renderEditLines(withVia(i, [...via.slice(0, insertAt), { lat: p.lat, lng: p.lng }, ...via.slice(insertAt)]));
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
  setSource('legs-static', legFeatures(paths, stops, Math.max(0, staticCount)));
  setSource('leg-active', []);
  showStops(clamped);

  const broken = clamped > 0 && paths[clamped - 1].length === 0;
  const animating = animate && clamped > 0 && !reducedMotion && !broken;
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
      setSource('leg-active', [legLineString(slicePath(path, eased), legColorProps(props.journey!.stops[clamped]))]);
      if (t < 1) animFrame = requestAnimationFrame(tick);
      else {
        setSource('legs-static', legFeatures(paths, props.journey!.stops, clamped));
        setSource('leg-active', []);
        updateCard(clamped);
        emit('leg-complete');
      }
    };
    animFrame = requestAnimationFrame(tick);
  } else if (animate && clamped > 0) {
    setSource('legs-static', legFeatures(paths, props.journey!.stops, clamped));
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
    } else if (broken) {
      const s = stops[clamped];
      map.easeTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 6), duration });
    } else {
      const path = paths[clamped - 1];
      const b = new maplibregl.LngLatBounds(path[0], path[0]);
      path.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: 120, duration, maxZoom: 9 });
    }
  }
  // A forward step over a scene cut still completes a "leg" for auto-play.
  if (animate && broken) emit('leg-complete');
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
    setSource('leg-active', [legLineString(slicePath(path, eased), legColorProps(props.journey!.stops[clamped]))]);
    map!.jumpTo({ center: point, zoom, pitch: 62, bearing: smooth });
    if (t < 1) animFrame = requestAnimationFrame(tick);
    else {
      setSource('legs-static', legFeatures(paths, props.journey!.stops, clamped));
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
  const lenKm = lenDeg * 111;
  const durationMs = Math.min(25000, Math.max(7000, 3000 + lenKm * 70));
  // Ground level for short legs; longer legs lift the camera (and lengthen
  // the trail) so the ground speed stays renderable and the line visible —
  // at 140m altitude a 100km leg means several km/s over unloadable tiles.
  const camAlt = Math.min(1500, 140 + Math.max(0, lenKm - 15) * 12);
  const trailM = Math.min(15000, 1400 + Math.max(0, lenKm - 15) * 120);
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
    // Far enough behind that the painted line's tip sits visibly ahead
    // in the lower-middle of the frame while it draws.
    const backDeg = trailM / 111000;
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
    const ahead = pointAlong(path, Math.min(1, frac + 0.15)).point;
    const aheadElev = map!.queryTerrainElevation({ lng: ahead[0], lat: ahead[1] }) ?? 0;
    const camOpts = map!.calculateCameraOptionsFromTo(
      new maplibregl.LngLat(back[0], back[1]),
      altSmooth + camAlt,
      new maplibregl.LngLat(ahead[0], ahead[1]),
      aheadElev + camAlt * 0.8,
    );
    map!.jumpTo(camOpts);
  };

  let lastPaint = 0;
  const tick = (now: number) => {
    if (now < begin) { animFrame = requestAnimationFrame(tick); return; }
    const t = Math.min(1, (now - begin) / durationMs);
    const eased = t * t * (3 - 2 * t);
    const { point, bearing } = pointAlong(path, eased);
    smooth += (((bearing - smooth + 540) % 360) - 180) * 0.06;
    // Throttle line updates — re-tiling the GeoJSON every frame while the
    // camera races starves the renderer and the line never shows.
    if (now - lastPaint > 80 || t === 1) {
      lastPaint = now;
      setSource('leg-active', [legLineString(slicePath(path, eased), legColorProps(props.journey!.stops[clamped]))]);
    }
    placeCamera(point, smooth, eased);
    if (t < 1) animFrame = requestAnimationFrame(tick);
    else {
      setSource('legs-static', legFeatures(paths, props.journey!.stops, clamped));
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
    maxPitch: 88,
    attributionControl: { compact: true, customAttribution: 'Region data © <a href="https://www.openbible.info/geo/">OpenBible.info</a> (CC-BY 4.0) · Terrain © <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen/AWS</a>' },
  });
  map.on('load', () => {
    const waterId = map!.getStyle().layers?.find((l: any) => l.type === 'fill' && /water/i.test(l.id))?.id;
    // Shaded relief from a dedicated DEM source (sharing the terrain's
    // raster-dem source with a hillshade layer causes artifacts). Sits under
    // the water fill so bathymetry doesn't get shaded.
    map!.addSource('dem-hillshade', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 13,
    });
    map!.addLayer({
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem-hillshade',
      paint: {
        'hillshade-exaggeration': 0.45,
        'hillshade-shadow-color': '#7a6742',
        'hillshade-highlight-color': '#fdf6e0',
        'hillshade-accent-color': '#857249',
      },
    }, waterId);
    for (const id of ['legs-static', 'leg-active']) {
      map!.addSource(id, { type: 'geojson', data: EMPTY });
      map!.addLayer({
        id,
        type: 'line',
        source: id,
        paint: { 'line-color': ['coalesce', ['get', 'color'], '#A93226'] as any, 'line-width': LINE_WIDTH, 'line-dasharray': [2.2, 1.8] },
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
        'circle-stroke-color': ['coalesce', ['get', 'color'], '#A93226'] as any,
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
        'circle-color': ['coalesce', ['get', 'color'], '#A93226'] as any,
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
    map!.on('zoom', syncLabelScale);
    syncLabelScale();
    ready = true;
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
    <div v-if="legendEntries.length" class="bj-ledger">
      <div v-for="e in legendEntries" :key="e.color" class="flex items-center gap-2">
        <span class="bj-ledger-line" :style="`background: ${e.color}`" />
        <span>{{ e.label }}</span>
      </div>
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
  z-index: 1;
  font-family: 'IM Fell English', serif;
  font-size: var(--bj-label-size, 16px);
  color: var(--map-ink);
  text-shadow: 0 0 3px var(--parchment), 0 0 6px var(--parchment), 0 0 9px var(--parchment);
  white-space: nowrap;
  pointer-events: none;
}
.bj-hit {
  z-index: 2;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: grab;
}
.bj-hit:active { cursor: grabbing; }
.bj-handle {
  display: block;
  width: 13px; height: 13px; border-radius: 3px;
  background: #f1e6c8; border: 2px solid var(--route);
  box-shadow: 0 1px 4px rgba(40, 30, 10, 0.4);
  pointer-events: none;
}
.bj-handle-ghost {
  border-radius: 50%;
  background: rgba(241, 230, 200, 0.55);
  border: 1.5px dashed var(--route);
  box-shadow: none;
}
.bj-handle-stop {
  width: 17px; height: 17px; border-radius: 50%;
  background: var(--route); border: 3px solid #f1e6c8;
  box-shadow: 0 0 0 1.5px var(--gold), 0 1px 5px rgba(40, 30, 10, 0.45);
}
.bj-ledger {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: linear-gradient(160deg, #f0e5c8, #e4d5af);
  border: 1px solid #b09a68;
  outline: 1px solid rgba(176, 154, 104, 0.55);
  outline-offset: -4px;
  box-shadow: 2px 3px 10px rgba(40, 30, 10, 0.3);
  padding: 9px 13px;
  font-family: 'IM Fell English', serif;
  font-size: 16px;
  color: #4a3b22;
  pointer-events: none;
}
.bj-ledger-line {
  display: inline-block;
  width: 26px;
  height: 4px;
  border-radius: 2px;
  flex: none;
}
.bj-card {
  z-index: 3; /* the card always sits above map labels */
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

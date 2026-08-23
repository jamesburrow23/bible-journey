import * as THREE from 'three';
import maplibregl from 'maplibre-gl';
import { buildMini, MINI_SIZE, type SiteType } from './minis';

/**
 * MapLibre custom 3D layer rendering one procedural miniature (the current
 * stop's) with three.js, popping up with a spring when shown.
 */
export class MiniModelLayer {
  id = 'bj-mini';
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map: maplibregl.Map | null = null;
  private camera = new THREE.Camera();
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer | null = null;
  private group: THREE.Group | null = null;
  private merc: maplibregl.MercatorCoordinate | null = null;
  private meterScale = 0;
  private popStart = 0;
  private reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    this.map = map;
    this.scene.add(new THREE.AmbientLight(0xfff6e5, 1.1));
    const sun = new THREE.DirectionalLight(0xffefd0, 2.2);
    sun.position.set(0.6, 1, 0.4);
    this.scene.add(sun);
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  onRemove(): void {
    this.renderer?.dispose();
  }

  show(lngLat: { lng: number; lat: number }, altitude: number, type: SiteType): void {
    if (this.group) this.scene.remove(this.group);
    this.group = buildMini(type);
    this.scene.add(this.group);
    this.merc = maplibregl.MercatorCoordinate.fromLngLat(lngLat, altitude);
    this.meterScale = this.merc.meterInMercatorCoordinateUnits() * MINI_SIZE[type];
    this.popStart = performance.now();
    this.map?.triggerRepaint();
  }

  hide(): void {
    if (this.group) {
      this.scene.remove(this.group);
      this.group = null;
    }
    this.map?.triggerRepaint();
  }

  render(_gl: unknown, args: any): void {
    if (!this.renderer || !this.map || !this.group || !this.merc) return;

    // v5 passes CustomRenderMethodInput; older signatures pass the matrix.
    const arr: number[] | Float32Array | Float64Array | null =
      args?.defaultProjectionData?.mainMatrix ?? (args?.length === 16 ? args : null);
    if (!arr) return;

    // Pop with a little overshoot (easeOutBack), instant under reduced motion.
    const t = this.reducedMotion ? 1 : Math.min(1, (performance.now() - this.popStart) / 700);
    const c1 = 1.70158;
    const s = t >= 1 ? 1 : 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    this.group.scale.setScalar(Math.max(0.001, s));

    const rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const l = new THREE.Matrix4()
      .makeTranslation(this.merc.x, this.merc.y, this.merc.z)
      .scale(new THREE.Vector3(this.meterScale, -this.meterScale, this.meterScale))
      .multiply(rotX);
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(arr as number[]).multiply(l);

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    if (t < 1) this.map.triggerRepaint();
  }
}

import * as THREE from 'three';

// Procedural "cartographer's miniatures" — stylized low-poly models that pop
// out of the map at the current stop in flight/hike mode. Built in Y-up
// space inside roughly a unit footprint; the model layer scales to meters.

export type SiteType = 'city' | 'village' | 'palace' | 'temple' | 'mountain' | 'wilderness' | 'water' | 'camp';

export const SITE_TYPES: SiteType[] = ['city', 'village', 'palace', 'temple', 'mountain', 'wilderness', 'water', 'camp'];

/** Model footprint in meters, per type. */
export const MINI_SIZE: Record<SiteType, number> = {
  city: 850, village: 520, palace: 650, temple: 650,
  mountain: 1500, wilderness: 520, water: 600, camp: 500,
};

const C = {
  stone: 0xe8dbb7, stoneDark: 0xcbb98d, trim: 0xb09a68,
  roof: 0xa93226, green: 0x6e8b5e, sand: 0xdccf9f, ivory: 0xf1e6c8,
};

function mat(color: number): THREE.Material {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true });
}

function box(w: number, h: number, d: number, color: number, x = 0, y?: number, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y ?? h / 2, z);
  return m;
}

function cone(r: number, h: number, seg: number, color: number, x = 0, y?: number, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x, y ?? h / 2, z);
  return m;
}

function cyl(r: number, h: number, color: number, x = 0, y?: number, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat(color));
  m.position.set(x, y ?? h / 2, z);
  return m;
}

function house(x: number, z: number, s = 1, rot = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.2 * s, 0.14 * s, 0.16 * s, C.stone));
  g.add(cone(0.15 * s, 0.1 * s, 4, C.trim, 0, 0.19 * s));
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

function tent(x: number, z: number, s = 1, rot = 0): THREE.Mesh {
  const t = cone(0.14 * s, 0.18 * s, 4, C.sand, x, 0.09 * s, z);
  t.rotation.y = rot;
  return t;
}

function buildCity(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.15, 0.05, 1.15, C.stoneDark)); // tell/platform
  // wall ring
  g.add(box(1.0, 0.14, 0.06, C.stone, 0, 0.12, 0.48));
  g.add(box(1.0, 0.14, 0.06, C.stone, 0, 0.12, -0.48));
  g.add(box(0.06, 0.14, 1.0, C.stone, 0.48, 0.12, 0));
  g.add(box(0.06, 0.14, 1.0, C.stone, -0.48, 0.12, 0));
  // gate towers
  g.add(box(0.12, 0.26, 0.12, C.stone, -0.14, 0.18, 0.48));
  g.add(box(0.12, 0.26, 0.12, C.stone, 0.14, 0.18, 0.48));
  // houses inside
  g.add(house(-0.2, -0.1, 1.1, 0.4), house(0.18, 0.12, 1, 1.1), house(0.05, -0.28, 0.9, 2.2), house(-0.28, 0.22, 0.9, 0.9), house(0.3, -0.18, 0.8, 1.7));
  // citadel tower
  const t = cyl(0.09, 0.34, C.stone, 0, 0.22, 0);
  g.add(t, cone(0.12, 0.12, 8, C.roof, 0, 0.45, 0));
  return g;
}

function buildVillage(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.04, 12), mat(C.sand)));
  g.add(house(-0.18, 0.05, 1.1, 0.3), house(0.16, -0.12, 1, 1.4), house(0.08, 0.22, 0.85, 2.4));
  const tree = new THREE.Group();
  tree.add(cyl(0.02, 0.12, C.trim, 0, 0.06, 0), new THREE.Mesh(new THREE.IcosahedronGeometry(0.09), mat(C.green)));
  tree.children[1].position.set(0, 0.18, 0);
  tree.position.set(-0.3, 0.02, -0.25);
  g.add(tree);
  return g;
}

function colonnade(g: THREE.Group, count: number, spread: number, z: number, h: number, y0: number): void {
  for (let i = 0; i < count; i++) {
    const x = -spread / 2 + (spread * i) / (count - 1);
    g.add(cyl(0.028, h, C.ivory, x, y0 + h / 2, z));
  }
}

function buildPalace(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.0, 0.06, 0.7, C.stoneDark));
  g.add(box(0.86, 0.05, 0.56, C.stone, 0, 0.085, 0));
  g.add(box(0.7, 0.3, 0.4, C.stone, 0, 0.26, -0.05));
  colonnade(g, 6, 0.6, 0.22, 0.24, 0.11);
  g.add(box(0.8, 0.05, 0.55, C.trim, 0, 0.435, 0));
  g.add(box(0.3, 0.16, 0.3, C.stone, 0, 0.54, -0.08)); // upper hall
  g.add(box(0.32, 0.04, 0.32, C.roof, 0, 0.64, -0.08));
  return g;
}

function buildTemple(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.0, 0.08, 0.66, C.stoneDark));
  g.add(box(0.84, 0.06, 0.52, C.stone, 0, 0.11, 0));
  g.add(box(0.5, 0.34, 0.34, C.stone, 0, 0.31, -0.04)); // cella
  colonnade(g, 7, 0.72, 0.2, 0.3, 0.14);
  g.add(box(0.8, 0.05, 0.5, C.trim, 0, 0.465, 0));
  // pediment: triangular prism (3-sided cylinder on its side)
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.78, 3), mat(C.stone));
  ped.rotation.z = Math.PI / 2;
  ped.rotation.x = Math.PI;
  ped.position.set(0, 0.53, 0);
  g.add(ped);
  return g;
}

function buildMountain(): THREE.Group {
  const g = new THREE.Group();
  const main = cone(0.5, 0.85, 5, C.stoneDark);
  main.rotation.y = 0.4;
  g.add(main);
  const side = cone(0.28, 0.45, 5, C.sand, 0.3, 0.22, 0.18);
  g.add(side);
  g.add(cone(0.14, 0.22, 5, C.ivory, 0, 0.74, 0)); // sunlit summit
  return g;
}

function buildWilderness(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.03, 10), mat(C.sand)));
  g.add(tent(0.05, 0.05, 1.2, 0.5));
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), mat(C.stoneDark));
  rock.position.set(-0.28, 0.06, -0.15);
  g.add(rock);
  for (const [x, z] of [[-0.15, 0.3], [0.3, -0.22], [0.25, 0.28]] as const) {
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055), mat(C.green));
    shrub.position.set(x, 0.05, z);
    g.add(shrub);
  }
  return g;
}

function buildCamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.03, 10), mat(C.sand)));
  g.add(tent(-0.18, 0.08, 1.2, 0.4), tent(0.2, 0.02, 1, 1.6), tent(0.02, -0.24, 0.9, 2.8));
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 6), new THREE.MeshStandardMaterial({ color: C.roof, emissive: 0xa93226, emissiveIntensity: 0.7, roughness: 1 }));
  fire.position.set(0.02, 0.06, -0.02);
  g.add(fire);
  return g;
}

function buildBoat(): THREE.Group {
  const g = new THREE.Group();
  const hull = box(0.55, 0.1, 0.2, C.trim, 0, 0.09, 0);
  g.add(hull);
  g.add(box(0.62, 0.03, 0.24, C.stoneDark, 0, 0.15, 0)); // deck rim
  g.add(cyl(0.015, 0.42, C.stoneDark, 0, 0.36, 0)); // mast
  const sail = box(0.02, 0.26, 0.3, C.ivory, 0.03, 0.36, 0);
  g.add(sail);
  return g;
}

export function buildMini(type: SiteType): THREE.Group {
  switch (type) {
    case 'city': return buildCity();
    case 'palace': return buildPalace();
    case 'temple': return buildTemple();
    case 'mountain': return buildMountain();
    case 'wilderness': return buildWilderness();
    case 'water': return buildBoat();
    case 'camp': return buildCamp();
    case 'village':
    default: return buildVillage();
  }
}

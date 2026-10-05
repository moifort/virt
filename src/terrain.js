// Terrain: coastal frame, work areas, heightfield, water.
import * as THREE from 'three';
import { fbm, smoothstep } from './noise.js';
import { GLOBALS, PATH_COUNT, WATER_LEVEL, paint } from './style.js';

export { WATER_LEVEL };
export const WORLD_RADIUS = 110;
export const SUN_DIR = new THREE.Vector3(-0.25, 0.58, 1).normalize();

export const WORLD_SIZE = 380;
export const SEGMENTS = 380;
export const CELL = WORLD_SIZE / SEGMENTS;
export const HALF = WORLD_SIZE / 2;
export const UP = new THREE.Vector3(0, 1, 0);

// Coastal frame: u climbs from the sea toward the mountain (away from the default camera),
// v runs along the shore (left to right on screen).
export const toX = (u, v) => (-u + v) / Math.SQRT2;
export const toZ = (u, v) => (-u - v) / Math.SQRT2;
export const toU = (x, z) => (-x - z) / Math.SQRT2;
export const toV = (x, z) => (x - z) / Math.SQRT2;
// To the right a headland reaches far out to sea; to the left the land falls back and the sea opens.
export const headland = (v) => smoothstep(52, 96, v + (fbm(v * 0.05, 9.4, 2) - 0.5) * 16);
export const openSea = (v) => smoothstep(-35, -105, v);
export const coastU = (v) => -40 + (fbm(v * 0.02, 3.1, 3) - 0.5) * 20 - headland(v) * 58 + openSea(v) * 95;
export const footU = (v) => 50 + (fbm(v * 0.025, 7.7, 3) - 0.5) * 18 + openSea(v) * 70;

export const placeZone = (id, name, hint, u, v, r) => ({ id, name, hint, u, v, r, x: toX(u, v), z: toZ(u, v) });
export const ZONES = [
  placeZone('agora', 'Agora', "l'Arbre-Mère", 0, 0, 12),
  placeZone('library', 'La Bibliothèque', 'bureau de Bob', 34, -34, 13),
  placeZone('moot', 'Salle du Moot', 'réunions', 30, 36, 15),
  placeZone('pub', 'Le Pub', 'après le travail', -22, -40, 12),
  placeZone('pods', 'Bulles focus', 'concentration', 2, 52, 13),
  placeZone('atelier', "L'Atelier", 'prototypes', 8, -54, 12),
  placeZone('port', 'Le Port', 'pause au bord de l\'eau', 4, -72, 16),
];
export const zone = (id) => ZONES.find((z) => z.id === id);

export const PATHS = [
  ...ZONES.slice(1).map((z) => [0, 0, z.x, z.z]),
  [zone('pub').x, zone('pub').z, zone('port').x, zone('port').z],
  [zone('atelier').x, zone('atelier').z, zone('port').x, zone('port').z],
];

// ---------------------------------------------------------------- Ground

export function heightAt(x, z) {
  const u = toU(x, z);
  const v = toV(x, z);
  let h = 0.7 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 2.2;
  // The mountain: steep terraced slopes, like the Ligurian coast.
  const foot = footU(v);
  const back = smoothstep(foot, foot + 95, u) * (62 + (fbm(x * 0.015, z * 0.015, 3) - 0.5) * 30) + Math.max(0, u - foot) * 0.08;
  // Side ridges run down from the mountain and plunge into the sea, closing the bay.
  const ridge = headland(v) * (16 + smoothstep(-110, 70, u) * 46 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 14);
  h += Math.max(back, ridge);
  // The sea: sheer cliffs under the headlands, softer coves in the bay.
  const coast = coastU(v);
  const sheer = (4 + fbm(v * 0.04 + 11, 2.3, 2) * 14) * (1 - headland(v) * 0.75);
  h -= smoothstep(coast + 2, coast - sheer, u) * (9 + headland(v) * 20);
  // Terraces: shelves and short dry-stone walls.
  const step = 2.4;
  const shelf = Math.floor(h / step) * step;
  h = shelf + smoothstep(0.72, 1, (h - shelf) / step) * step;
  // Work areas sit on level pads.
  for (const zn of ZONES) h += (0 - h) * smoothstep(zn.r + 7, zn.r + 1, Math.hypot(x - zn.x, z - zn.z));
  return h;
}

export const GRID = new Float32Array((SEGMENTS + 1) ** 2);
for (let iz = 0; iz <= SEGMENTS; iz++) {
  for (let ix = 0; ix <= SEGMENTS; ix++) GRID[iz * (SEGMENTS + 1) + ix] = heightAt(ix * CELL - HALF, iz * CELL - HALF);
}

/** Ground height matching the rendered triangles exactly. */
export function groundAt(x, z) {
  const u = Math.min(SEGMENTS - 1e-6, Math.max(0, (x + HALF) / CELL));
  const v = Math.min(SEGMENTS - 1e-6, Math.max(0, (z + HALF) / CELL));
  const ix = Math.floor(u);
  const iz = Math.floor(v);
  const fu = u - ix;
  const fv = v - iz;
  const row = SEGMENTS + 1;
  const a = GRID[iz * row + ix];
  const b = GRID[(iz + 1) * row + ix];
  const c = GRID[(iz + 1) * row + ix + 1];
  const d = GRID[iz * row + ix + 1];
  if (fu + fv <= 1) return a + (d - a) * fu + (b - a) * fv;
  return c + (b - c) * (1 - fu) + (d - c) * (1 - fv);
}

export function segmentDistance(x, z, [ax, az, bx, bz]) {
  const px = x - ax;
  const pz = z - az;
  const dx = bx - ax;
  const dz = bz - az;
  const h = Math.min(1, Math.max(0, (px * dx + pz * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - dx * h, pz - dz * h);
}

/** True where nature may grow: off the work pads, off the paths, above water. */
export function isWild(x, z, margin = 0) {
  if (groundAt(x, z) < WATER_LEVEL + 0.4) return false;
  for (const zn of ZONES) if (Math.hypot(x - zn.x, z - zn.z) < zn.r + 3 + margin) return false;
  for (const p of PATHS) if (segmentDistance(x, z, p) < 2.6 + margin) return false;
  return true;
}

export function slopeAt(x, z) {
  return (Math.abs(groundAt(x + 1, z) - groundAt(x - 1, z)) + Math.abs(groundAt(x, z + 1) - groundAt(x, z - 1))) / 4;
}

export function buildTerrain() {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, paint(0xffffff, { terrain: true }));
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWater() {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3), paint(0xffffff, { water: true }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.receiveShadow = true;
  return water;
}


export function scatterInstanced(scene, rng, geo, mat, count, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  let n = 0;
  for (let i = 0; i < count * 5 && n < count; i++) {
    if (!place(rng, p, s, c)) continue;
    q.setFromAxisAngle(UP, rng() * Math.PI * 2);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function randomSpot(rng, p, maxR = 110) {
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * maxR;
  p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  p.y = groundAt(p.x, p.z);
  return p;
}


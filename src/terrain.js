// Terrain: coastal frame, work areas, heightfield, water.
import * as THREE from 'three';
import { fbm, smoothstep } from './noise.js';
import { GLOBALS, PATH_COUNT, WATER_LEVEL, paint } from './style.js';

export { WATER_LEVEL };
// The map is a square diorama aligned with the bay (u toward the mountain, v along the shore),
// cut out of the land with its sides showing the cross-section down to a base.
export const SQUARE = { u0: -100, u1: 110, v0: -105, v1: 105 };
export const BASE_Y = -16;
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
// Past the harbour the water runs all the way up the left side.
const farLeft = (v) => smoothstep(-74, -94, v);
// Pass `u` to make the left shore wander instead of running in a straight line.
const wander = (u) => (u === undefined ? 0 : (fbm(u * 0.035, 4.2, 3) - 0.5) * 30);
export const coastU = (v, u) => -40 + (fbm(v * 0.02, 3.1, 3) - 0.5) * 20 - headland(v) * 58 + openSea(v) * 95 + farLeft(v + wander(u)) * 260;
export const footU = (v, u) => 50 + (fbm(v * 0.025, 7.7, 3) - 0.5) * 18 + openSea(v) * 70 + farLeft(v + wander(u)) * 260;
// A white sand beach along the middle of the bay.
const beachBand = (v) => smoothstep(-30, -18, v) * smoothstep(64, 50, v);

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
  const foot = footU(v, u);
  const back = smoothstep(foot, foot + 80, u) * (40 + (fbm(x * 0.015, z * 0.015, 3) - 0.5) * 20) + Math.max(0, u - foot) * 0.05;
  // Side ridges run down from the mountain and plunge into the sea, closing the bay.
  const ridge = headland(v) * (13 + smoothstep(-110, 70, u) * 30 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 10);
  h += Math.max(back, ridge);
  // The sea: sheer cliffs under the headlands, softer coves in the bay.
  const coast = coastU(v, u);
  const sheer = (4 + fbm(v * 0.04 + 11, 2.3, 2) * 14) * (1 - headland(v) * 0.75);
  h -= smoothstep(coast + 2, coast - sheer, u) * (9 + headland(v) * 20);
  // Terraces: shelves and short dry-stone walls.
  const step = 2.4;
  const shelf = Math.floor(h / step) * step;
  h = shelf + smoothstep(0.72, 1, (h - shelf) / step) * step;
  // The beach: a smooth gentle slope down into turquoise shallows, no terraces.
  const beach = beachBand(v) * smoothstep(coast + 14, coast + 8, u) * smoothstep(coast - 5, coast + 1, u);
  h += (WATER_LEVEL + 0.25 + Math.max(0, u - coast) * 0.08 - h) * beach;
  // Work areas sit on level pads.
  for (const zn of ZONES) h += (0 - h) * smoothstep(zn.r + 7, zn.r + 1, Math.hypot(x - zn.x, z - zn.z));
  return h;
}

export const GRID = new Float32Array((SEGMENTS + 1) ** 2);
for (let iz = 0; iz <= SEGMENTS; iz++) {
  for (let ix = 0; ix <= SEGMENTS; ix++) {
    const x = ix * CELL - HALF;
    const z = iz * CELL - HALF;
    // Outside the diorama there is only open sea, deep enough to read as such.
    GRID[iz * (SEGMENTS + 1) + ix] = inSquare(x, z, -1.5) ? heightAt(x, z) : -14;
  }
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
/** True inside the diorama square, at least `margin` from its edges. */
export function inSquare(x, z, margin = 0) {
  const u = toU(x, z);
  const v = toV(x, z);
  return u > SQUARE.u0 + margin && u < SQUARE.u1 - margin && v > SQUARE.v0 + margin && v < SQUARE.v1 - margin;
}

export function isWild(x, z, margin = 0) {
  if (!inSquare(x, z, 2)) return false;
  if (groundAt(x, z) < WATER_LEVEL + 0.4) return false;
  for (const zn of ZONES) if (Math.hypot(x - zn.x, z - zn.z) < zn.r + 3 + margin) return false;
  for (const p of PATHS) if (segmentDistance(x, z, p) < 2.6 + margin) return false;
  return true;
}

export function slopeAt(x, z) {
  return (Math.abs(groundAt(x + 1, z) - groundAt(x - 1, z)) + Math.abs(groundAt(x, z + 1) - groundAt(x, z - 1))) / 4;
}

/** Terrain surface: a grid laid out in (u, v) so its edges are the sides of the square. */
export function buildTerrain() {
  const nu = SQUARE.u1 - SQUARE.u0;
  const nv = SQUARE.v1 - SQUARE.v0;
  const geo = new THREE.PlaneGeometry(1, 1, nv, nu);
  const pos = geo.attributes.position;
  for (let iu = 0; iu <= nu; iu++) {
    for (let iv = 0; iv <= nv; iv++) {
      const i = iu * (nv + 1) + iv;
      const x = toX(SQUARE.u0 + iu, SQUARE.v0 + iv);
      const z = toZ(SQUARE.u0 + iu, SQUARE.v0 + iv);
      pos.setXYZ(i, x, groundAt(x, z), z);
    }
  }
  // Make sure the triangles face up.
  const index = geo.index.array;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  a.fromBufferAttribute(pos, index[0]);
  b.fromBufferAttribute(pos, index[1]);
  c.fromBufferAttribute(pos, index[2]);
  if (b.sub(a).cross(c.sub(a)).y < 0) {
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, paint(0xffffff, { terrain: true }));
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * The cut faces of the island: earth strata from the base up to the ground (the endless sea
 * hides them below the waterline). `holes` open windows in the back face
 * ({ v0, v1, y0, y1 } in back-face coordinates) to look into the mountain.
 */
export function buildSides(holes = []) {
  const earth = [];
  const quad = (out, p0, p1, y0a, y0b, y1a, y1b) => {
    // p0, p1: column positions (x, z); bottom y0a/y0b, top y1a/y1b.
    out.push(p0.x, y0a, p0.z, p1.x, y0b, p1.z, p1.x, y1b, p1.z, p0.x, y0a, p0.z, p1.x, y1b, p1.z, p0.x, y1a, p0.z);
  };
  const edges = [
    { fixed: 'u', at: SQUARE.u1, from: SQUARE.v0, to: SQUARE.v1, back: true },
    { fixed: 'u', at: SQUARE.u0, from: SQUARE.v0, to: SQUARE.v1 },
    { fixed: 'v', at: SQUARE.v0, from: SQUARE.u0, to: SQUARE.u1 },
    { fixed: 'v', at: SQUARE.v1, from: SQUARE.u0, to: SQUARE.u1 },
  ];
  for (const edge of edges) {
    const point = (s) => {
      const [u, v] = edge.fixed === 'u' ? [edge.at, s] : [s, edge.at];
      const p = new THREE.Vector3(toX(u, v), 0, toZ(u, v));
      p.y = groundAt(p.x, p.z);
      return p;
    };
    for (let s = edge.from; s < edge.to; s++) {
      const p0 = point(s);
      const p1 = point(s + 1);
      // Vertical intervals of earth, minus any window opened in the back face.
      let spans = [[BASE_Y, Infinity]];
      if (edge.back) {
        for (const h of holes) {
          if (s + 0.5 < h.v0 || s + 0.5 > h.v1) continue;
          spans = spans.flatMap(([lo, hi]) => (h.y1 <= lo || h.y0 >= hi ? [[lo, hi]] : [[lo, h.y0], [h.y1, hi]].filter(([a, b]) => b > a)));
        }
      }
      for (const [lo, hi] of spans) {
        const ta = Math.min(hi, p0.y);
        const tb = Math.min(hi, p1.y);
        if (ta > lo || tb > lo) quad(earth, p0, p1, lo, lo, Math.max(lo, ta), Math.max(lo, tb));
      }
    }
  }
  const group = new THREE.Group();
  const make = (data, material) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  make(earth, paint(0xffffff, { terrain: true, doubleSide: true }));
  return group;
}


/** The sea: it runs on past the island to the horizon. */
export function buildWater() {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), paint(0xffffff, { water: true }));
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


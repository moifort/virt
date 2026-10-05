// The VIRT: a Bob-style virtual workplace set in a Mœbius techno-ecological valley.
// A flat plateau of work areas linked by footpaths, ringed by terraced mesas,
// under a perpetual late-afternoon sun.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, mulberry32, pick, smoothstep } from './noise.js';
import { GLOBALS, PAL, PATH_COUNT, WATER_LEVEL, paint, solid } from './style.js';

export { WATER_LEVEL };
export const WORLD_RADIUS = 92;
export const SUN_DIR = new THREE.Vector3(-0.25, 0.58, 1).normalize();

const WORLD_SIZE = 260;
const SEGMENTS = 260;
const CELL = WORLD_SIZE / SEGMENTS;
const HALF = WORLD_SIZE / 2;
const UP = new THREE.Vector3(0, 1, 0);

export const ZONES = [
  { id: 'agora', name: 'Agora', hint: "l'Arbre-Mère", x: 0, z: 0, r: 12 },
  { id: 'library', name: 'La Bibliothèque', hint: 'bureau de Bob', x: -36, z: -24, r: 13 },
  { id: 'moot', name: 'Salle du Moot', hint: 'réunions', x: 36, z: -28, r: 15 },
  { id: 'pub', name: 'Le Pub', hint: 'après le travail', x: -38, z: 30, r: 12 },
  { id: 'pods', name: 'Bulles focus', hint: 'concentration', x: 38, z: 32, r: 13 },
  { id: 'atelier', name: "L'Atelier", hint: 'prototypes', x: 2, z: 56, r: 12 },
  { id: 'pond', name: 'Le Bassin', hint: 'pause', x: 0, z: -56, r: 12 },
];
const zone = (id) => ZONES.find((z) => z.id === id);

const PATHS = [
  ...ZONES.slice(1).map((z) => [0, 0, z.x, z.z]),
  [zone('pond').x, zone('pond').z, zone('library').x, zone('library').z],
  [zone('pond').x, zone('pond').z, zone('moot').x, zone('moot').z],
];

// ---------------------------------------------------------------- Ground

function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 0.7 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 2.2;
  const edge = r + (fbm(x * 0.02 + 5, z * 0.02 - 3, 3) - 0.5) * 46;
  h += smoothstep(82, 104, edge) * (8 + fbm(x * 0.012, z * 0.012, 3) * 30);
  const pond = zone('pond');
  h -= smoothstep(13, 4, Math.hypot(x - pond.x, z - pond.z + 2)) * 4.5;
  // Terraces: shelves and short cliffs, the stepped look of the mesas.
  const step = 2;
  const shelf = Math.floor(h / step) * step;
  h = shelf + smoothstep(0.72, 1, (h - shelf) / step) * step;
  // Work areas sit on level pads.
  for (const zn of ZONES) {
    if (zn.id === 'pond') continue;
    h += (0 - h) * smoothstep(zn.r + 7, zn.r + 1, Math.hypot(x - zn.x, z - zn.z));
  }
  return h;
}

const GRID = new Float32Array((SEGMENTS + 1) ** 2);
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

function segmentDistance(x, z, [ax, az, bx, bz]) {
  const px = x - ax;
  const pz = z - az;
  const dx = bx - ax;
  const dz = bz - az;
  const h = Math.min(1, Math.max(0, (px * dx + pz * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - dx * h, pz - dz * h);
}

/** True where nature may grow: off the work pads, off the paths, above water. */
function isWild(x, z, margin = 0) {
  if (groundAt(x, z) < WATER_LEVEL + 0.4) return false;
  for (const zn of ZONES) if (Math.hypot(x - zn.x, z - zn.z) < zn.r + 3 + margin) return false;
  for (const p of PATHS) if (segmentDistance(x, z, p) < 2.6 + margin) return false;
  return true;
}

function slopeAt(x, z) {
  return (Math.abs(groundAt(x + 1, z) - groundAt(x - 1, z)) + Math.abs(groundAt(x, z + 1) - groundAt(x, z - 1))) / 4;
}

function buildTerrain() {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, paint(0xffffff, { terrain: true }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildWater() {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE), paint(0xffffff, { water: true }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.receiveShadow = true;
  return water;
}

// ---------------------------------------------------------------- Small building blocks

const box = (w, h, d, color, opts) => solid(new THREE.BoxGeometry(w, h, d), paint(color, opts));
const cyl = (rt, rb, h, color, seg = 12, opts) => solid(new THREE.CylinderGeometry(rt, rb, h, seg), paint(color, opts));
const ball = (r, color, opts, ws = 14, hs = 10) => solid(new THREE.SphereGeometry(r, ws, hs), paint(color, opts));
const cone = (r, h, color, seg = 10, opts) => solid(new THREE.ConeGeometry(r, h, seg), paint(color, opts));
function at(obj, x, y, z, parent) {
  obj.position.set(x, y, z);
  parent?.add(obj);
  return obj;
}

const INK = 0x2b2533;
const STONE = 0xe8d9c0;
const DARK_WOOD = 0x8a5a41;
const WARM_LIGHT = 0xffe2a6;
const SCREEN = 0x7fe3dc;

/** Floating holographic panel with a few UI bars, Bob-style. */
function screen(w, h, parent, x, y, z, rotY, animated, rng) {
  const g = new THREE.Group();
  at(box(w, h, 0.06, SCREEN, { glow: true }), 0, 0, 0, g);
  const bars = Math.max(2, Math.round(h / 0.32));
  for (let i = 0; i < bars; i++) {
    const bw = w * (0.35 + rng() * 0.5);
    at(box(bw, 0.08, 0.04, i === 0 ? PAL.ivory : 0x3f8f99), -w / 2 + 0.15 + bw / 2, h / 2 - 0.25 - i * 0.28, 0.04, g);
  }
  g.rotation.y = rotY;
  at(g, x, y, z, parent);
  const phase = rng() * 6;
  animated.push((t) => (g.position.y = y + Math.sin(t * 1.4 + phase) * 0.06));
  return g;
}

function plant(parent, x, y, z, rng) {
  at(cyl(0.35, 0.28, 0.6, PAL.coral, 10), x, y + 0.3, z, parent);
  const leaves = ball(0.55 + rng() * 0.2, pick(rng, [PAL.grassDeep, PAL.teal, PAL.moss]), { flat: true }, 7, 5);
  leaves.scale.y = 1.3;
  at(leaves, x, y + 1.1, z, parent);
}

function lantern(parent, x, y, z, color = WARM_LIGHT) {
  at(cyl(0.07, 0.09, 2.2, INK, 6), x, y + 1.1, z, parent);
  at(box(0.42, 0.5, 0.42, color, { glow: true }), x, y + 2.35, z, parent);
  at(cone(0.36, 0.3, INK, 4), x, y + 2.75, z, parent).rotation.y = Math.PI / 4;
}

/** Shelves of books along a wall. axis 'x' runs along x facing +z; axis 'z' runs along z facing +x. */
function bookshelf(parent, books, rng, { axis, from, to, at: fixed, y0, rows = 5, rowH = 1.18 }) {
  const len = to - from;
  const mid = (from + to) / 2;
  const depth = 0.75;
  const frame = (w, h, d, a, b, c) =>
    axis === 'x' ? at(box(w, h, d, DARK_WOOD), a, b, c, parent) : at(box(d, h, w, DARK_WOOD), c, b, a, parent);
  frame(len, rows * rowH + 0.2, 0.1, mid, y0 + (rows * rowH) / 2, fixed);
  for (let r = 0; r <= rows; r++) frame(len, 0.1, depth, mid, y0 + r * rowH, fixed + depth / 2);
  frame(0.12, rows * rowH, depth, from, y0 + (rows * rowH) / 2, fixed + depth / 2);
  frame(0.12, rows * rowH, depth, to, y0 + (rows * rowH) / 2, fixed + depth / 2);
  for (let r = 0; r < rows; r++) {
    let s = from + 0.12;
    while (s < to - 0.35) {
      const w = 0.16 + rng() * 0.16;
      const h = rowH * (0.55 + rng() * 0.32);
      const lean = rng() < 0.08 ? 0.25 : 0;
      const along = s + w / 2;
      const y = y0 + r * rowH + 0.05 + h / 2;
      const across = fixed + depth / 2 + 0.05;
      books.push({
        pos: axis === 'x' ? new THREE.Vector3(along, y, across) : new THREE.Vector3(across, y, along),
        scale: axis === 'x' ? new THREE.Vector3(w, h, depth * 0.85) : new THREE.Vector3(depth * 0.85, h, w),
        rot: lean,
        axis,
        color: pick(rng, [PAL.red, PAL.teal, PAL.saffron, PAL.plum, PAL.coral, PAL.blue, PAL.grassDeep, PAL.cream, 0x5b3f6e]),
      });
      s += w + (rng() < 0.06 ? 0.4 : 0.01);
    }
  }
}

function instanceBooks(parent, books) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), paint(0xffffff), books.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const xAxis = new THREE.Vector3(1, 0, 0);
  books.forEach((b, i) => {
    q.setFromAxisAngle(b.axis === 'x' ? zAxis : xAxis, b.rot);
    m.compose(b.pos, q, b.scale);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(b.color));
  });
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
}

function armchair(color) {
  const g = new THREE.Group();
  at(box(1.8, 0.7, 1.7, color), 0, 0.45, 0, g);
  const back = at(box(1.8, 1.9, 0.5, color), 0, 1.3, 0.8, g);
  back.rotation.x = 0.22; // reclined, La-Z-Boy style
  at(box(0.38, 0.95, 1.7, color), -0.95, 0.75, 0, g);
  at(box(0.38, 0.95, 1.7, color), 0.95, 0.75, 0, g);
  at(box(1.4, 0.32, 0.9, color), 0, 0.42, -1.25, g); // footrest out
  return g;
}

function chair(color, back = 1.3) {
  const g = new THREE.Group();
  at(box(0.85, 0.12, 0.85, color), 0, 0.78, 0, g);
  at(box(0.85, back, 0.12, color), 0, 0.78 + back / 2, 0.38, g);
  at(cyl(0.07, 0.12, 0.75, INK, 6), 0, 0.38, 0, g);
  return g;
}

function cat(animated) {
  const g = new THREE.Group();
  const fur = 0x6f6680;
  const body = at(ball(0.45, fur, {}, 12, 8), 0, 0.3, 0, g);
  body.scale.set(1.3, 0.62, 0.95);
  at(ball(0.29, fur, {}, 10, 8), 0.5, 0.36, 0.12, g);
  for (const s of [-1, 1]) at(cone(0.09, 0.2, fur, 4), 0.55, 0.65, 0.12 + s * 0.14, g);
  const tail = new THREE.Group();
  at(tail, -0.5, 0.18, 0, g);
  const t = at(cyl(0.07, 0.05, 0.9, fur, 6), 0, 0, 0.45, tail);
  t.rotation.x = Math.PI / 2;
  animated.push((time) => {
    body.scale.y = 0.62 + Math.sin(time * 2.2) * 0.03; // sleepy breathing
    tail.rotation.y = Math.sin(time * 0.9) * 0.5 + 0.6;
  });
  return g;
}

function butler(animated) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) at(cyl(0.13, 0.12, 1.25, INK, 6), s * 0.17, 0.62, 0, g);
  at(cyl(0.4, 0.46, 1.45, INK, 10), 0, 1.92, 0, g);
  at(box(0.5, 0.9, 0.12, INK), 0, 1.25, -0.36, g).rotation.x = -0.15; // coat tails
  at(box(0.36, 0.95, 0.08, PAL.ivory), 0, 2.05, 0.37, g);
  at(box(0.22, 0.09, 0.06, INK), 0, 2.45, 0.42, g);
  at(ball(0.3, PAL.skin), 0, 2.95, 0, g);
  const hair = at(ball(0.31, 0x8c8496, {}, 12, 6), 0, 3.02, -0.04, g);
  hair.scale.y = 0.6;
  const arm = new THREE.Group();
  at(arm, 0.48, 2.3, 0.05, g);
  const sleeve = at(box(0.2, 0.7, 0.2, INK), 0, -0.25, 0.2, arm);
  sleeve.rotation.x = -1.1;
  const tray = new THREE.Group();
  at(tray, 0, -0.2, 0.62, arm);
  at(cyl(0.45, 0.45, 0.05, 0xd8d4e0, 16), 0, 0, 0, tray);
  at(cyl(0.12, 0.1, 0.2, PAL.ivory, 10), 0.12, 0.12, 0, tray);
  at(cyl(0.1, 0.1, 0.16, PAL.coral, 10), -0.15, 0.1, 0.1, tray);
  animated.push((t) => (g.position.y = Math.sin(t * 1.1) * 0.02));
  return g;
}

// ---------------------------------------------------------------- Work areas

function buildLibrary(g, rng, animated) {
  const W = 16;
  const D = 12;
  const F = 0.4;
  const H = 7;
  at(box(W, F, D, PAL.wood), 0, F / 2, 0, g);
  for (let i = 0; i < 8; i++) at(box(0.06, 0.02, D, DARK_WOOD), -W / 2 + 1 + i * 2, F + 0.01, 0, g); // floorboards
  at(cyl(3.3, 3.3, 0.05, PAL.coral, 28), 0.4, F + 0.03, -2, g);
  at(cyl(2.6, 2.6, 0.06, PAL.saffron, 28), 0.4, F + 0.04, -2, g);
  at(cyl(1.6, 1.6, 0.07, PAL.plum, 24), 0.4, F + 0.05, -2, g);

  // Two walls on the far sides, open toward the viewer like a dollhouse.
  at(box(W, H, 0.6, PAL.cream), 0, F + H / 2, -D / 2 + 0.3, g);
  at(box(0.6, H, D, PAL.cream), -W / 2 + 0.3, F + H / 2, 0, g);
  at(box(W + 0.7, 0.5, 1.1, PAL.rose), 0.35, F + H + 0.25, -D / 2 + 0.45, g);
  at(box(1.1, 0.5, D + 0.7, PAL.rose), -W / 2 + 0.45, F + H + 0.25, 0.35, g);
  for (const [x, z] of [[W / 2 - 0.5, D / 2 - 0.5], [W / 2 - 0.5, -D / 2 + 0.5], [-W / 2 + 0.5, D / 2 - 0.5]]) {
    at(cyl(0.38, 0.45, H, PAL.ivory, 12), x, F + H / 2, z, g);
    at(box(1.1, 0.4, 1.1, PAL.rose), x, F + H + 0.2, z, g);
  }

  // Floor-to-ceiling books.
  const books = [];
  bookshelf(g, books, rng, { axis: 'x', from: -W / 2 + 0.7, to: -2.5, at: -D / 2 + 0.6, y0: F });
  bookshelf(g, books, rng, { axis: 'x', from: 2.5, to: W / 2 - 1.1, at: -D / 2 + 0.6, y0: F });
  bookshelf(g, books, rng, { axis: 'z', from: -D / 2 + 1.5, to: -3.4, at: -W / 2 + 0.6, y0: F });
  bookshelf(g, books, rng, { axis: 'z', from: -1.4, to: 1.4, at: -W / 2 + 0.6, y0: F });
  bookshelf(g, books, rng, { axis: 'z', from: 3.4, to: D / 2 - 0.9, at: -W / 2 + 0.6, y0: F });
  instanceBooks(g, books);

  // Tall narrow windows, lit by the perpetual late-afternoon sun.
  for (const z of [-2.4, 2.4]) {
    at(box(0.12, 4.6, 1.3, WARM_LIGHT, { glow: true }), -W / 2 + 0.66, F + 3.2, z, g);
    at(box(0.16, 4.8, 0.12, DARK_WOOD), -W / 2 + 0.7, F + 3.2, z, g);
    at(box(0.16, 0.12, 1.5, DARK_WOOD), -W / 2 + 0.7, F + 3.6, z, g);
  }

  // Fireplace.
  const fz = -D / 2 + 0.6;
  at(box(4.6, 4.3, 1.3, PAL.rose, { flat: true }), 0, F + 2.15, fz + 0.65, g);
  at(box(2.4, 1.9, 0.3, 0x3a2b4f), 0, F + 1.05, fz + 1.2, g);
  at(box(5.2, 0.3, 1.7, PAL.wood), 0, F + 4.3, fz + 0.75, g);
  at(box(3.4, H - 4.6, 1.0, PAL.rose), 0, F + 4.45 + (H - 4.6) / 2, fz + 0.5, g);
  at(cyl(0.18, 0.18, 0.35, PAL.ivory, 8), -1.8, F + 4.62, fz + 0.9, g);
  at(box(0.16, 0.25, 0.16, WARM_LIGHT, { glow: true }), -1.8, F + 4.92, fz + 0.9, g);
  at(box(0.7, 0.6, 0.25, PAL.saffron), 1.5, F + 4.75, fz + 0.9, g); // mantel clock
  for (const s of [-0.5, 0.5]) {
    const log = at(cyl(0.16, 0.16, 1.6, DARK_WOOD, 6), 0, F + 0.25, fz + 1.55 + s * 0.15, g);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = s * 0.4;
  }
  const flames = [
    [0, 1.1, 0.5, 0xff8a3d],
    [-0.4, 0.8, 0.4, PAL.saffron],
    [0.42, 0.75, 0.38, PAL.saffron],
    [0.05, 0.55, 0.28, 0xfff1b0],
  ].map(([x, h, r, color]) => at(cone(r, h, color, 6, { glow: true }), x, F + 0.35 + h / 2, fz + 1.6, g));
  animated.push((t) => {
    flames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(t * 11 + i * 2.1) * 0.2 + Math.sin(t * 17 + i) * 0.1;
      f.rotation.y = t * (1 + i * 0.3);
    });
  });

  // Bob's corner: La-Z-Boy facing the fire, coffee, Spike and Jeeves.
  at(armchair(PAL.red), 0.4, F, 0.4, g);
  at(cyl(0.08, 0.1, 1.0, DARK_WOOD, 6), 2.2, F + 0.5, 0.2, g);
  at(cyl(0.55, 0.55, 0.08, PAL.wood, 16), 2.2, F + 1.04, 0.2, g);
  at(cyl(0.13, 0.11, 0.24, PAL.ivory, 10), 2.1, F + 1.2, 0.1, g);
  at(box(0.5, 0.1, 0.36, PAL.teal), 2.35, F + 1.13, 0.35, g);
  const spike = at(cat(animated), -1.2, F + 0.06, -2.4, g);
  spike.rotation.y = 0.5;
  const jeeves = at(butler(animated), 3.6, F, -1.4, g);
  jeeves.rotation.y = -Math.PI / 2 - 0.4;

  // Work desk with floating displays.
  at(box(3.8, 0.14, 1.6, PAL.wood), -4.6, F + 1.1, 3, g);
  for (const [dx, dz] of [[-1.7, -0.6], [1.7, -0.6], [-1.7, 0.6], [1.7, 0.6]]) at(box(0.12, 1.05, 0.12, DARK_WOOD), -4.6 + dx, F + 0.55, 3 + dz, g);
  at(box(0.6, 0.04, 0.4, INK), -4.6, F + 1.19, 3.2, g);
  at(chair(PAL.teal, 1.1), -4.6, F, 4.4, g);
  screen(1.6, 1.0, g, -5.9, F + 2.3, 2.5, 0.4, animated, rng);
  screen(1.8, 1.1, g, -4.6, F + 2.5, 2.2, 0, animated, rng);
  screen(1.6, 1.0, g, -3.3, F + 2.3, 2.5, -0.4, animated, rng);

  // Floor lamp and plants.
  at(cyl(0.06, 0.08, 2.6, INK, 6), -2.4, F + 1.3, -0.8, g);
  at(cone(0.55, 0.6, WARM_LIGHT, 10, { glow: true }), -2.4, F + 2.75, -0.8, g);
  plant(g, W / 2 - 1.4, F, -D / 2 + 1.5, rng);
  plant(g, -W / 2 + 1.6, F, D / 2 - 1.2, rng);
  plant(g, 6.2, F, 4.8, rng);
}

function buildMoot(g, rng, animated) {
  const W = 22;
  const D = 13;
  at(box(W, 0.35, D, STONE), 0, 0.17, 0, g);
  at(box(W - 2, 0.04, D - 2, PAL.rose), 0, 0.36, 0, g);
  at(box(W - 2.6, 0.05, D - 2.6, STONE), 0, 0.37, 0, g);
  const F = 0.4;

  // The long banquet table of the Bob-moots.
  at(box(15.5, 0.25, 3, PAL.wood), 0, F + 1.2, 0, g);
  at(box(15.5, 0.03, 1, PAL.red), 0, F + 1.34, 0, g);
  for (const x of [-6.5, 0, 6.5]) at(box(0.4, 1.1, 2.2, DARK_WOOD), x, F + 0.55, 0, g);
  for (let i = 0; i < 7; i++) {
    const x = -6 + i * 2;
    for (const s of [-1, 1]) {
      const c = at(chair(pick(rng, [PAL.teal, PAL.coral, PAL.saffron, PAL.lilac]), 1.5), x, F, s * 2.3, g);
      c.rotation.y = s > 0 ? 0 : Math.PI;
      at(cyl(0.32, 0.32, 0.03, PAL.ivory, 14), x, F + 1.35, s * 0.95, g);
      at(cyl(0.09, 0.07, 0.3, pick(rng, [PAL.saffron, PAL.coral, PAL.teal]), 8), x + 0.45, F + 1.48, s * 0.9, g);
    }
  }
  for (const s of [-1, 1]) {
    const c = at(chair(PAL.plum, 2), s * 8.8, F, 0, g);
    c.rotation.y = (s * Math.PI) / 2;
  }
  for (const x of [-4, 0, 4]) {
    at(cyl(0.08, 0.1, 0.4, PAL.ivory, 8), x, F + 1.53, 0, g);
    at(box(0.12, 0.2, 0.12, WARM_LIGHT, { glow: true }), x, F + 1.83, 0, g);
  }
  const bowl = at(ball(0.45, PAL.wood, {}, 12, 6), 2, F + 1.4, 0, g);
  bowl.scale.y = 0.5;
  for (let i = 0; i < 5; i++) at(ball(0.16, pick(rng, [PAL.red, PAL.saffron, PAL.grass]), {}, 8, 6), 2 + (rng() - 0.5) * 0.5, F + 1.6, (rng() - 0.5) * 0.5, g);

  // Pergola: slatted shade, so the sun draws stripes on the table.
  for (const x of [-10, -5, 0, 5, 10]) {
    for (const z of [-6, 6]) {
      at(cyl(0.32, 0.38, 6, PAL.ivory, 10), x, F + 3, z, g);
      at(box(0.9, 0.35, 0.9, PAL.rose), x, F + 6, z, g);
    }
  }
  for (const z of [-6, 6]) at(box(W, 0.4, 0.5, PAL.ivory), 0, F + 6.3, z, g);
  for (let i = 0; i < 20; i++) at(box(0.28, 0.24, D + 1, PAL.wood), -10.45 + i * 1.1, F + 6.62, 0, g);
  for (let i = 0; i < 12; i++) {
    at(ball(0.5 + rng() * 0.4, pick(rng, [PAL.grassDeep, PAL.moss, PAL.teal]), { flat: true }, 6, 4), -10 + rng() * 20, F + 6.9, (rng() < 0.5 ? -1 : 1) * (5 + rng() * 1.5), g);
  }
  [PAL.teal, PAL.coral, PAL.saffron, PAL.lilac].forEach((color, i) => {
    const x = -7.5 + i * 5;
    at(box(1.4, 2.8, 0.08, color), x, F + 4.4, -6.3, g);
    at(cyl(0.35, 0.35, 0.05, PAL.ivory, 12), x, F + 4.6, -6.25, g).rotation.x = Math.PI / 2;
    at(cone(0.7, 0.6, color, 3), x, F + 2.75, -6.3, g).rotation.z = Math.PI;
  });

  // Presentation screen at the head of the table.
  screen(4.2, 2.4, g, -10.6, F + 3.3, 0, Math.PI / 2, animated, rng);
  lantern(g, W / 2 - 0.6, 0.35, D / 2 + 0.6);
  lantern(g, -W / 2 + 0.6, 0.35, D / 2 + 0.6);
}

function buildPub(g, rng, animated) {
  const W = 15;
  const D = 12;
  const F = 0.4;
  at(box(W, F, D, 0x9a6448), 0, F / 2, 0, g);
  for (let i = 0; i < 7; i++) at(box(W, 0.02, 0.06, DARK_WOOD), 0, F + 0.01, -D / 2 + 1 + i * 1.7, g);

  // Bar counter (L-shaped) with a wall of bottles behind.
  at(box(10, 1.2, 1.1, DARK_WOOD), -1.5, F + 0.6, -3.6, g);
  at(box(10.4, 0.14, 1.4, PAL.cream), -1.5, F + 1.27, -3.6, g);
  at(box(1.1, 1.2, 5, DARK_WOOD), -6.6, F + 0.6, -0.6, g);
  at(box(1.4, 0.14, 5.4, PAL.cream), -6.6, F + 1.27, -0.6, g);
  for (const x of [-3, -1.6]) {
    at(cyl(0.06, 0.06, 0.6, PAL.saffron, 6), x, F + 1.6, -3.9, g);
    at(box(0.3, 0.12, 0.12, PAL.saffron), x, F + 1.88, -3.8, g);
  }
  at(box(12, 3.6, 0.6, DARK_WOOD), -0.5, F + 1.8, -D / 2 + 0.3, g);
  const bottles = [];
  for (let row = 0; row < 3; row++) {
    at(box(11, 0.1, 0.5, PAL.wood), -0.5, F + 1.4 + row * 0.85, -D / 2 + 0.8, g);
    for (let x = -5.6; x < 4.8; x += 0.3 + rng() * 0.15) bottles.push([x, F + 1.45 + row * 0.85, -D / 2 + 0.8]);
  }
  const bottleGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.55, 6);
  bottleGeo.translate(0, 0.27, 0);
  const bm = new THREE.InstancedMesh(bottleGeo, paint(0xffffff), bottles.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  bottles.forEach(([x, y, z], i) => {
    m.makeScale(1, 0.7 + rng() * 0.6, 1).setPosition(x, y, z);
    bm.setMatrixAt(i, m);
    bm.setColorAt(i, c.setHex(pick(rng, [0x5a9a6a, 0xc98a3a, 0x7fc4c8, 0xb04a5a, 0xe8d39a])));
  });
  bm.castShadow = true;
  g.add(bm);
  for (const [x, y, z] of [[5.9, 0.7, -4.6], [5.9, 0.7, -2.8], [5.9, 2.0, -3.7]]) {
    const barrel = at(cyl(0.65, 0.65, 1.4, PAL.wood, 12), x, F + y, z, g);
    barrel.rotation.x = Math.PI / 2;
    for (const s of [-0.45, 0.45]) at(cyl(0.67, 0.67, 0.08, INK, 12), 0, s, 0, barrel);
  }

  for (let i = 0; i < 5; i++) {
    const x = -5 + i * 1.6;
    at(cyl(0.3, 0.3, 0.12, PAL.red, 10), x, F + 1.05, -2.4, g);
    at(cyl(0.06, 0.1, 1.0, INK, 6), x, F + 0.5, -2.4, g);
  }
  // Tables with pints.
  for (const [x, z] of [[-2.8, 1.4], [1.2, 2.6], [4.4, -0.2]]) {
    at(cyl(0.9, 0.9, 0.1, PAL.wood, 14), x, F + 1.1, z, g);
    at(cyl(0.1, 0.25, 1.05, INK, 6), x, F + 0.53, z, g);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rng();
      at(cyl(0.28, 0.28, 0.1, pick(rng, [PAL.teal, PAL.coral, PAL.lilac]), 10), x + Math.cos(a) * 1.4, F + 0.75, z + Math.sin(a) * 1.4, g);
      at(cyl(0.06, 0.09, 0.7, INK, 6), x + Math.cos(a) * 1.4, F + 0.35, z + Math.sin(a) * 1.4, g);
      at(cyl(0.11, 0.1, 0.3, PAL.saffron, 8), x + Math.cos(a) * 0.45, F + 1.3, z + Math.sin(a) * 0.45, g);
      at(cyl(0.12, 0.12, 0.07, PAL.ivory, 8), x + Math.cos(a) * 0.45, F + 1.48, z + Math.sin(a) * 0.45, g);
    }
  }

  // String lights between four poles.
  const poles = [[-W / 2 + 0.4, -D / 2 + 0.4], [W / 2 - 0.4, -D / 2 + 0.4], [W / 2 - 0.4, D / 2 - 0.4], [-W / 2 + 0.4, D / 2 - 0.4]];
  for (const [x, z] of poles) at(cyl(0.1, 0.13, 5, INK, 6), x, F + 2.5, z, g);
  const bulbs = [PAL.saffron, PAL.pink, SCREEN, WARM_LIGHT];
  for (let e = 0; e < 4; e++) {
    const [ax, az] = poles[e];
    const [bx, bz] = poles[(e + 1) % 4];
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      const sag = Math.sin(t * Math.PI) * 0.9;
      at(ball(0.14, bulbs[(i + e) % 4], { glow: true }, 6, 4), ax + (bx - ax) * t, F + 4.9 - sag, az + (bz - az) * t, g);
    }
  }

  // Hanging sign, painted on a tiny canvas.
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2533';
  ctx.fillRect(0, 0, 64, 24);
  ctx.fillStyle = '#f6c54f';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BOB&PINT', 32, 16);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  at(cyl(0.1, 0.12, 3.6, INK, 6), W / 2 + 0.6, 1.8, D / 2 - 1, g);
  const sign = at(solid(new THREE.BoxGeometry(2.6, 1, 0.1), paint(0xffffff, { map: tex })), W / 2 + 0.6, 3.1, D / 2 - 1, g);
  sign.rotation.y = Math.PI / 4;
  animated.push((t) => (sign.rotation.z = Math.sin(t * 0.8) * 0.04));
}

function buildPods(g, rng, animated) {
  const colors = [PAL.teal, PAL.lilac, PAL.coral, PAL.saffron];
  [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([x, z], i) => {
    const pod = at(new THREE.Group(), x, 0, z, g);
    at(cyl(3.1, 3.3, 0.4, STONE, 24), 0, 0.2, 0, pod);
    // Shell around the far quarter (-x / -z), open toward the viewer.
    const shell = solid(
      new THREE.SphereGeometry(3.1, 24, 12, (7 * Math.PI) / 4 - 0.6 * Math.PI, 1.2 * Math.PI, 0, Math.PI / 2),
      paint(colors[i], { doubleSide: true }),
    );
    at(shell, 0, 0.4, 0, pod);
    at(box(2.2, 0.12, 1.0, PAL.wood), -0.9, 1.45, -0.9, pod).rotation.y = Math.PI / 4;
    at(cyl(0.1, 0.1, 1.05, INK, 6), -0.9, 0.92, -0.9, pod);
    const c = at(chair(PAL.ivory, 1.0), 0.2, 0.4, 0.2, pod);
    c.rotation.y = Math.PI / 4;
    screen(1.3, 0.8, pod, -1.35, 2.25, -1.35, Math.PI / 4, animated, rng);
    at(cyl(0.05, 0.05, 0.6, INK, 6), -1.6, 1.8, -0.2, pod);
    at(ball(0.2, WARM_LIGHT, { glow: true }, 8, 6), -1.6, 2.15, -0.2, pod);
    plant(pod, 1.6, 0.4, -1.6, rng);
  });
  lantern(g, 0, 0, 0, SCREEN);
}

function buildTower(g, rng, H) {
  const R = 2.2;
  at(cyl(R * 0.75, R * 1.15, H, PAL.ivory, 18), 0, H / 2, 0, g);
  for (let k = 1; k <= 3; k++) {
    const band = at(solid(new THREE.TorusGeometry(R * (1.15 - (0.4 * k) / 4) + 0.12, 0.25, 6, 24), paint(k % 2 ? PAL.coral : PAL.teal)), 0, (H * k) / 4, 0, g);
    band.rotation.x = Math.PI / 2;
  }
  at(cyl(R * 2.1, R * 0.8, 1.6, PAL.ivory, 20), 0, H + 0.2, 0, g);
  const dome = at(solid(new THREE.SphereGeometry(R * 1.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), paint(PAL.teal)), 0, H + 1, 0, g);
  dome.scale.y = 0.9;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const h = 1.8 + rng() * 1.2;
    at(cone(0.6, h, pick(rng, [PAL.grassDeep, PAL.teal]), 6), Math.cos(a) * R * 1.75, H + 1 + h / 2, Math.sin(a) * R * 1.75, g);
  }
  at(cyl(0.08, 0.12, 4, PAL.ivory, 6), 0, H + 1 + R * 1.1 + 2, 0, g);
  const flag = at(cone(0.35, 1.8, PAL.red, 3), 0.9, H + R * 1.1 + 4.2, 0, g);
  flag.rotation.z = -Math.PI / 2;
}

function turbine(rng, animated) {
  const g = new THREE.Group();
  const H = 9 + rng() * 4;
  at(cyl(0.16, 0.36, H, PAL.ivory, 8), 0, H / 2, 0, g);
  const nacelle = at(ball(0.5, PAL.ivory, {}, 10, 8), 0, H, 0, g);
  nacelle.scale.z = 1.6;
  const rotor = at(new THREE.Group(), 0, H, 0.75, g);
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.ConeGeometry(0.42, 4.4, 4);
    geo.translate(0, 2.2, 0);
    geo.scale(1, 1, 0.25);
    const blade = solid(geo, paint(PAL.coral));
    blade.rotation.z = (k / 3) * Math.PI * 2;
    rotor.add(blade);
  }
  g.rotation.y = 0.6;
  const speed = 0.9 + rng();
  animated.push((t, dt) => (rotor.rotation.z += speed * dt));
  return g;
}

/** Photovoltaic flower turned toward the sun. */
function sunFlower(rng) {
  const g = new THREE.Group();
  const H = 1.6 + rng() * 1.6;
  at(cyl(0.07, 0.11, H, PAL.grassDeep, 5), 0, H / 2, 0, g);
  const head = at(new THREE.Group(), 0, H, 0, g);
  const disc = new THREE.CylinderGeometry(0.85, 0.85, 0.1, 12);
  disc.rotateX(Math.PI / 2);
  head.add(solid(disc, paint(PAL.saffron)));
  at(ball(0.25, PAL.coral, {}, 8, 6), 0, 0, 0.08, head);
  head.lookAt(head.getWorldPosition(new THREE.Vector3()).add(SUN_DIR));
  return g;
}

function buildAtelier(g, rng, animated) {
  const tower = at(new THREE.Group(), -5, 0, -4, g);
  buildTower(tower, rng, 15);
  at(box(16, 0.3, 11, STONE), 1, 0.15, 1, g);
  // Greenhouse: an open frame with slanted glass panes.
  const gh = at(new THREE.Group(), 4, 0.3, 0, g);
  for (const x of [-3, 0, 3]) {
    for (const z of [-2, 2]) at(box(0.18, 3, 0.18, PAL.ivory), x, 1.5, z, gh);
  }
  for (const s of [-1, 1]) {
    for (const x of [-2.2, -0.75, 0.75, 2.2]) {
      const pane = at(box(1.3, 0.06, 2.5, 0xb9ecd9), x, 3.6, s * 1.05, gh);
      pane.rotation.x = s * 0.55;
    }
  }
  for (let i = 0; i < 9; i++) {
    const x = -2.4 + (i % 3) * 2.4;
    const z = -1 + Math.floor(i / 3);
    at(box(1.6, 0.4, 0.6, DARK_WOOD), x, 0.2, z, gh);
    for (let k = 0; k < 3; k++) at(ball(0.22, pick(rng, [PAL.grass, PAL.pink, PAL.saffron, PAL.teal]), { flat: true }, 6, 4), x - 0.5 + k * 0.5, 0.55, z, gh);
  }
  // Workbench with a prototype spinning on it.
  at(box(3.6, 0.14, 1.4, PAL.wood), -1, 1.4, 4.5, g);
  for (const dx of [-1.6, 1.6]) at(box(0.14, 1.1, 1.2, DARK_WOOD), -1 + dx, 0.85, 4.5, g);
  const proto = at(new THREE.Group(), -1.2, 1.75, 4.5, g);
  at(ball(0.35, PAL.ivory, { flat: true }, 6, 4), 0, 0, 0, proto);
  at(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 24), paint(SCREEN, { glow: true })), 0, 0, 0, proto);
  animated.push((t) => proto.rotation.set(t * 0.7, t, 0));
  for (let i = 0; i < 4; i++) at(box(0.9, 0.9, 0.9, pick(rng, [PAL.wood, PAL.ochre])), 6.5 - (i % 2), 0.75 + Math.floor(i / 2) * 0.9, 5 - (i % 2) * 0.3, g).rotation.y = rng();
  for (let i = 0; i < 12; i++) at(sunFlower(rng), 9 + (i % 4) * 1.9, 0, -8 + Math.floor(i / 4) * 1.9, g);
  for (const [x, z] of [[-11, 6], [-12, -3], [12, 7]]) at(turbine(rng, animated), x, groundAt(g.position.x + x, g.position.z + z), z, g);
}

function buildPond(g, rng, animated) {
  const surface = WATER_LEVEL - g.position.y;
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2;
    const r = 2 + rng() * 6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 2;
    if (groundAt(g.position.x + x, g.position.z + z) > WATER_LEVEL - 0.3) continue;
    const pad = at(cyl(0.55 + rng() * 0.3, 0.55, 0.05, PAL.grassDeep, 10), x, surface + 0.04, z, g);
    if (rng() < 0.4) at(cone(0.18, 0.2, PAL.pink, 5), 0.1, 0.12, 0, pad);
  }
  // A little pier for coffee breaks by the water.
  const pier = at(new THREE.Group(), 5, surface + 0.3, 4, g);
  pier.rotation.y = -0.6;
  for (let i = 0; i < 9; i++) at(box(2.2, 0.15, 0.55, PAL.wood), 0, 0, -i * 0.62, pier);
  for (const z of [0, -2.5, -5]) for (const x of [-1, 1]) at(cyl(0.1, 0.1, 2, DARK_WOOD, 6), x, -0.8, z, pier);
  at(box(1.8, 0.12, 0.5, PAL.coral), 0, 0.5, -2.2, pier);
  for (const x of [-0.75, 0.75]) at(box(0.12, 0.45, 0.4, INK), x, 0.25, -2.2, pier);
  lantern(pier, 1, 0.07, -5.2);
  for (let i = 0; i < 3; i++) {
    const duck = at(new THREE.Group(), 0, surface + 0.15, 0, g);
    at(ball(0.3, i === 0 ? 0x5a9a6a : PAL.ivory, {}, 8, 6), 0, 0, 0, duck).scale.set(1, 0.7, 1.4);
    at(ball(0.17, i === 0 ? 0x2f6f4a : PAL.ivory, {}, 8, 6), 0, 0.28, 0.32, duck);
    at(cone(0.06, 0.18, PAL.saffron, 4), 0, 0.26, 0.52, duck).rotation.x = Math.PI / 2;
    const phase = i * 2.1;
    animated.push((t) => {
      const a = t * 0.12 + phase;
      duck.position.x = Math.cos(a) * 4;
      duck.position.z = Math.sin(a) * 3 - 3;
      duck.rotation.y = -a;
      duck.position.y = surface + 0.15 + Math.sin(t * 2 + phase) * 0.03;
    });
  }
}

function buildAgora(g, rng) {
  // The Mother Tree, in full bloom.
  at(cyl(0.9, 1.6, 8, PAL.ivory, 10), 0, 4, 0, g);
  [PAL.grassDeep, PAL.teal, PAL.pink, PAL.moss, PAL.saffron, PAL.grass].forEach((color, k) => {
    const yaw = at(new THREE.Group(), 0, 7.5, 0, g);
    yaw.rotation.y = (k / 6) * Math.PI * 2;
    const tilt = at(new THREE.Group(), 0, 0, 0, yaw);
    tilt.rotation.z = -0.8 - (k % 2) * 0.2;
    at(cyl(0.2, 0.42, 4.6, PAL.ivory, 6), 0, 2.3, 0, tilt);
    at(ball(2.1 + (k % 3) * 0.3, color, { flat: true }, 9, 6), 0, 5, 0, tilt);
  });
  at(ball(2.6, PAL.grass, { flat: true }, 9, 6), 0, 11.5, 0, g);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const bench = at(new THREE.Group(), Math.cos(a) * 7, 0, Math.sin(a) * 7, g);
    bench.rotation.y = -a + Math.PI / 2;
    at(box(2.6, 0.18, 0.8, PAL.wood), 0, 0.7, 0, bench);
    for (const x of [-1, 1]) at(box(0.25, 0.65, 0.7, STONE), x, 0.32, 0, bench);
  }
  // Signpost pointing to every area.
  const post = at(new THREE.Group(), 4.2, 0, 4.2, g);
  at(cyl(0.12, 0.15, 4.2, DARK_WOOD, 6), 0, 2.1, 0, post);
  ZONES.slice(1).forEach((zn, i) => {
    const geo = new THREE.BoxGeometry(1.5, 0.32, 0.08).translate(0.7, 0, 0);
    const arrow = at(solid(geo, paint([PAL.teal, PAL.coral, PAL.saffron, PAL.lilac, PAL.pink, PAL.blue][i])), 0, 1.6 + i * 0.42, 0, post);
    arrow.rotation.y = Math.atan2(-(zn.z - 4.2), zn.x - 4.2);
  });
  const rs = mulberry32(7);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const s = at(solid(new THREE.DodecahedronGeometry(0.9 + rs() * 0.5, 0), paint(pick(rs, [PAL.lilac, PAL.rose, PAL.peach]), { flat: true })), Math.cos(a) * 11.5, 0.6, Math.sin(a) * 11.5, g);
    s.scale.y = 1.6 + rs();
    s.rotation.y = rs() * 3;
  }
}

// ---------------------------------------------------------------- Nature and life

function scatterInstanced(scene, rng, geo, mat, count, place) {
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

function randomSpot(rng, p, maxR = 110) {
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * maxR;
  p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  p.y = groundAt(p.x, p.z);
  return p;
}

function tree(rng) {
  const g = new THREE.Group();
  const kind = rng();
  if (kind < 0.4) {
    // Umbrella acacia: crooked trunk, flat layered crown.
    const H = 4 + rng() * 3;
    const trunk = at(cyl(0.18, 0.35, H, PAL.wood, 6), 0, H / 2, 0, g);
    trunk.rotation.z = (rng() - 0.5) * 0.3;
    const color = pick(rng, [PAL.grassDeep, PAL.teal, 0x7fb07a]);
    for (let k = 0; k < 2; k++) {
      const crown = at(ball(2.2 - k * 0.6 + rng() * 0.6, k ? PAL.grass : color, { flat: true }, 8, 5), 0, H + k * 0.55, 0, g);
      crown.scale.y = 0.35;
    }
  } else if (kind < 0.75) {
    const H = 2.5 + rng() * 2;
    at(cyl(0.15, 0.26, H, PAL.ivory, 6), 0, H / 2, 0, g);
    at(ball(1.3 + rng() * 0.6, pick(rng, [PAL.pink, PAL.teal, PAL.grass, PAL.saffron, PAL.lilac]), { flat: true }, 8, 6), 0, H + 0.8, 0, g);
  } else {
    const H = 5 + rng() * 3;
    at(cyl(0.12, 0.18, 1, PAL.wood, 5), 0, 0.5, 0, g);
    at(cone(0.9, H, pick(rng, [PAL.grassDeep, 0x3f8f7a]), 7, { flat: true }), 0, 0.8 + H / 2, 0, g);
  }
  g.rotation.y = rng() * Math.PI * 2;
  return g;
}

function mushroom(rng) {
  const g = new THREE.Group();
  const H = 5 + rng() * 6;
  const R = 2.5 + rng() * 2.5;
  at(cyl(0.3 + H * 0.03, 0.55 + H * 0.06, H, PAL.ivory, 8), 0, H / 2, 0, g);
  const cap = at(solid(new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint(pick(rng, [PAL.rose, PAL.lilac, PAL.coral, PAL.teal]))), 0, H - 0.2, 0, g);
  cap.scale.y = 0.55;
  const gill = at(new THREE.Mesh(new THREE.CircleGeometry(R, 16), paint(PAL.plum)), 0, H - 0.2, 0, g);
  gill.rotation.x = Math.PI / 2;
  for (let k = 0; k < 4; k++) {
    const a = rng() * Math.PI * 2;
    const p = 0.4 + rng() * 0.6;
    at(ball(0.3, PAL.ivory, {}, 6, 4), Math.cos(a) * Math.sin(p) * R, H - 0.2 + Math.cos(p) * R * 0.55, Math.sin(a) * Math.sin(p) * R, g);
  }
  g.rotation.z = (rng() - 0.5) * 0.2;
  return g;
}

function buildNature(scene, rng) {
  // Grass tufts swaying in the wind.
  const blades = [];
  for (let k = 0; k < 4; k++) {
    const b = new THREE.ConeGeometry(0.12, 0.9 + (k % 2) * 0.3, 3);
    b.translate(0, 0.45, 0);
    b.rotateZ((k - 1.5) * 0.25);
    b.rotateY((k / 4) * Math.PI);
    blades.push(b);
  }
  scatterInstanced(scene, rng, mergeGeometries(blades), paint(0xffffff, { sway: true }), 4500, (r, p, s, c) => {
    randomSpot(r, p);
    if (!isWild(p.x, p.z, -1.5) || slopeAt(p.x, p.z) > 0.5) return false;
    const lush = fbm(p.x * 0.05 + 3, p.z * 0.05 - 8, 3);
    if (lush < 0.5 && r() < 0.85) return false;
    s.setScalar(0.7 + r() * 0.8);
    c.setHex(lush > 0.55 ? pick(r, [PAL.grass, PAL.grassDeep, PAL.moss]) : pick(r, [0xc9cf86, PAL.ochre, PAL.grass]));
    return true;
  });

  // Wildflowers.
  const flowerGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.03, 0.03, 0.6, 3).translate(0, 0.3, 0).toNonIndexed(),
    new THREE.IcosahedronGeometry(0.17, 0).translate(0, 0.66, 0),
  ]);
  scatterInstanced(scene, rng, flowerGeo, paint(0xffffff, { sway: true }), 2200, (r, p, s, c) => {
    randomSpot(r, p);
    if (!isWild(p.x, p.z, -1) || slopeAt(p.x, p.z) > 0.4) return false;
    if (fbm(p.x * 0.06 - 4, p.z * 0.06 + 9, 2) < 0.5) return false;
    s.setScalar(0.8 + r() * 0.6);
    c.setHex(pick(r, [PAL.pink, PAL.saffron, PAL.ivory, PAL.lilac, PAL.coral, PAL.blue]));
    return true;
  });

  scatterInstanced(scene, rng, new THREE.IcosahedronGeometry(1, 0), paint(0xffffff, { flat: true }), 160, (r, p, s, c) => {
    randomSpot(r, p);
    if (!isWild(p.x, p.z) || slopeAt(p.x, p.z) > 0.4) return false;
    s.set(0.8 + r() * 0.9, 0.6 + r() * 0.6, 0.8 + r() * 0.9);
    p.y += s.y * 0.5;
    c.setHex(pick(r, [PAL.grassDeep, PAL.teal, PAL.moss, 0x5f9c86]));
    return true;
  });

  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(1, 0), paint(0xffffff, { flat: true }), 90, (r, p, s, c) => {
    randomSpot(r, p, 118);
    if (!isWild(p.x, p.z)) return false;
    s.set(0.6 + r() * 1.4, 0.5 + r() * 1.8, 0.6 + r() * 1.4);
    p.y += s.y * 0.3;
    c.setHex(pick(r, [PAL.lilac, PAL.rose, PAL.peach, STONE]));
    return true;
  });

  for (let i = 0, n = 0; i < 400 && n < 70; i++) {
    const p = randomSpot(rng, new THREE.Vector3(), 105);
    if (!isWild(p.x, p.z, 1.5) || slopeAt(p.x, p.z) > 0.35) continue;
    scene.add(at(tree(rng), p.x, p.y - 0.1, p.z));
    n++;
  }
  for (let i = 0, n = 0; i < 300 && n < 10; i++) {
    const p = randomSpot(rng, new THREE.Vector3(), 112);
    if (Math.hypot(p.x, p.z) < 70 || !isWild(p.x, p.z) || slopeAt(p.x, p.z) > 0.3) continue;
    scene.add(at(mushroom(rng), p.x, p.y - 0.2, p.z));
    n++;
  }

  // Reeds around the pond.
  const pond = zone('pond');
  const reedGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.8, 3).translate(0, 0.9, 0);
  scatterInstanced(scene, rng, reedGeo, paint(0xffffff, { sway: true }), 260, (r, p, s, c) => {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 7;
    p.set(pond.x + Math.cos(a) * d, 0, pond.z - 2 + Math.sin(a) * d);
    const y = groundAt(p.x, p.z);
    if (y < WATER_LEVEL - 0.6 || y > WATER_LEVEL + 1.2) return false;
    p.y = y;
    s.set(1, 0.6 + r() * 0.8, 1);
    c.setHex(pick(r, [PAL.grassDeep, 0x8f9f5a, PAL.ochre]));
    return true;
  });

  // Lanterns along the footpaths.
  for (const [ax, az, bx, bz] of PATHS.slice(0, 6)) {
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let d = 15, side = 1; d < len - 14; d += 9, side = -side) {
      const x = ax + ((bx - ax) * d) / len + nx * 2.4 * side;
      const z = az + ((bz - az) * d) / len + nz * 2.4 * side;
      lantern(scene, x, groundAt(x, z), z);
    }
  }
}

function buildLife(scene, rng, animated) {
  // Butterflies fluttering over the meadows.
  for (let i = 0; i < 36; i++) {
    const home = randomSpot(rng, new THREE.Vector3(), 90);
    if (!isWild(home.x, home.z)) continue;
    const b = new THREE.Group();
    const color = pick(rng, [PAL.saffron, PAL.pink, PAL.ivory, PAL.blue, PAL.coral]);
    const wings = [-1, 1].map((s) => {
      const pivot = at(new THREE.Group(), 0, 0, 0, b);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.26).translate(s * 0.16, 0, 0), paint(color, { doubleSide: true }));
      w.rotation.x = -Math.PI / 2;
      pivot.add(w);
      return pivot;
    });
    scene.add(b);
    const phase = rng() * 100;
    animated.push((t) => {
      const x = home.x + Math.sin(t * 0.31 + phase) * 4 + Math.sin(t * 0.73 + phase * 2) * 1.5;
      const z = home.z + Math.cos(t * 0.27 + phase) * 4;
      b.position.set(x, groundAt(x, z) + 1.2 + Math.sin(t * 2.3 + phase) * 0.4, z);
      b.rotation.y = t * 0.3 + phase;
      const flap = Math.sin(t * 18 + phase) * 0.9;
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
    });
  }

  // Jellyfish airships drifting overhead, dragging their shadows across the valley.
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const R = 2.4 + rng() * 1.2;
    at(solid(new THREE.SphereGeometry(R, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), paint(pick(rng, [PAL.rose, PAL.lilac, PAL.teal]))), 0, 0, 0, g);
    const belly = at(new THREE.Mesh(new THREE.CircleGeometry(Math.sin(Math.PI * 0.55) * R, 18), paint(PAL.plum)), 0, Math.cos(Math.PI * 0.55) * R, 0, g);
    belly.rotation.x = Math.PI / 2;
    at(ball(0.6, PAL.saffron, { glow: true }, 8, 6), 0, -R * 0.9, 0, g);
    const strands = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const pivot = at(new THREE.Group(), Math.cos(a) * R * 0.55, belly.position.y, Math.sin(a) * R * 0.55, g);
      at(cyl(0.08, 0.04, R * 1.6, PAL.ivory, 4), 0, -R * 0.8, 0, pivot);
      strands.push(pivot);
    }
    scene.add(g);
    const orbit = { r: 40 + rng() * 40, speed: 0.015 + rng() * 0.015, phase: rng() * 6, alt: 22 + rng() * 8 };
    animated.push((t) => {
      const a = t * orbit.speed + orbit.phase;
      g.position.set(Math.cos(a) * orbit.r, orbit.alt + Math.sin(t * 0.6 + orbit.phase) * 1.2, Math.sin(a) * orbit.r);
      strands.forEach((p, k) => {
        p.rotation.x = Math.sin(t * 1.3 + k) * 0.25;
        p.rotation.z = Math.cos(t * 1.1 + k * 1.7) * 0.25;
      });
    });
  }

  // Floating islands at the valley rim.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const g = new THREE.Group();
    const R = 2.5 + rng() * 2;
    at(cyl(R, R * 0.9, 1, PAL.grass, 9, { flat: true }), 0, 0, 0, g);
    at(cone(R * 0.9, R * 2, PAL.rose, 9, { flat: true }), 0, -0.5 - R, 0, g).rotation.x = Math.PI;
    at(tree(rng), 0, 0.5, 0, g);
    const baseY = 16 + rng() * 8;
    scene.add(at(g, Math.cos(a) * 84, baseY, Math.sin(a) * 84));
    animated.push((t) => (g.position.y = baseY + Math.sin(t * 0.4 + i) * 0.8));
  }
}

// ---------------------------------------------------------------- World

export function createWorld(scene) {
  const rng = mulberry32(20261005);
  const animated = [];
  PATHS.forEach((p, i) => GLOBALS.uPaths.value[i].set(...p));
  for (let i = PATHS.length; i < PATH_COUNT; i++) GLOBALS.uPaths.value[i].set(1e4, 1e4, 1e4, 1e4);

  scene.add(buildTerrain(), buildWater());
  const builders = {
    agora: buildAgora,
    library: buildLibrary,
    moot: buildMoot,
    pub: buildPub,
    pods: buildPods,
    atelier: buildAtelier,
    pond: buildPond,
  };
  for (const zn of ZONES) {
    const g = new THREE.Group();
    g.position.set(zn.x, zn.id === 'pond' ? groundAt(zn.x, zn.z) : 0, zn.z);
    scene.add(g);
    builders[zn.id](g, rng, animated);
  }
  buildNature(scene, rng);
  buildLife(scene, rng, animated);

  return {
    update(t, dt) {
      for (const fn of animated) fn(t, dt);
    },
  };
}

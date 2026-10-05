// Old Ligurian fishing villages: tall narrow houses in ochre, salmon and faded red, stacked on
// the slope, with framed windows, green shutters, balconies, laundry, tile and slate roofs,
// roof terraces and chimneys. They are lived in: bougainvillea and wisteria climb the fronts,
// a lamp hangs by the door, gutters run under the eaves and empty through a spout when it
// rains, smoke rises from the chimneys when it is cold.
// Every part is a unit shape instanced with its own matrix and colour: thousands of details,
// a handful of draw calls.
import * as THREE from 'three';
import { fbm, pick } from './noise.js';
import { PAL, paint } from './style.js';
import { lamplight } from './kit.js';
import { SQUARE, VILLAGES, cultivated, estateWeight, footU, groundAt, isWild, slopeAt, toX, toZ, UP } from './terrain.js';

const ballShape = new THREE.SphereGeometry(0.5, 8, 6);
const boxShape = new THREE.BoxGeometry(1, 1, 1);
// What parts are made of: a unit shape and the way it is painted.
const KINDS = {
  box: { shape: boxShape, paint: { wall: true } },
  pyramid: { shape: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), paint: { flat: true, roof: true } },
  cyl: { shape: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), paint: {} },
  ball: { shape: ballShape, paint: {} },
  cone: { shape: new THREE.ConeGeometry(0.5, 1, 8), paint: { flat: true } },
  // Half disc standing in the XY plane, flat side down (fanlights, arched openings).
  arch: { shape: new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), paint: {} },
  // Greenery, a lit lamp, and rain water running off a roof (its colour is how much it carries).
  leaf: { shape: ballShape, paint: { leaf: true } },
  lamp: { shape: ballShape, paint: { glow: true } },
  flow: { shape: boxShape, paint: { flow: true }, shadow: false },
};

const WALLS = [0xe6ba6c, 0xdfa590, 0xdc826a, 0xefca7c, 0xf1bf98, 0xf3cea4, 0xe89a78, 0xcf705c, 0xf5e4c0, 0xf0b287, 0xead8aa, 0xe8c4b0, 0xd9d2b0];
const TRIM = [PAL.ivory, PAL.cream, 0xf7e9cf];
const SHUTTER = [0x4a7a58, 0x56866a, 0x3f6c56, 0x6a8a58, 0x5a86a0, 0x7a6a4a];
const GLASS = 0x3b3346;
const SLATE = 0x8a8c98;
const TILE = 0xcc6e48;
const WOOD = 0x8a5a41;
const STONE = 0xd9cbb5;
const IRON = 0x4a4654;
const WARM_LIGHT = 0xffe2a6;
// How much water a spout or a dripping eave carries, as the red of its instance colour.
const POURING = 0xffffff;
const DRIPPING = 0x8c8c8c;
// Climbers on the house fronts: (foliage, flower, flower highlight).
const CLIMBERS = [
  [0x4f8456, 0xd9508a, 0xee82b0], // bougainvillea
  [0x5a8c5c, 0xa890d8, 0xc8b4ea], // wisteria
  [0x4a7c52, 0xf7efe6, 0xffffff], // jasmine
  [0x456f4c, 0x5a8858, 0x6f9c64], // ivy
];

/** Collects instanced parts, positioned in the local frame of the current building. */
class Parts {
  constructor() {
    this.lists = new Map(Object.keys(KINDS).map((k) => [k, []]));
    this.lights = [];
    this.chimneys = [];
    this.frame = new THREE.Matrix4();
    this._local = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  at(position, yaw) {
    this.frame.compose(position, new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1));
  }

  add(kind, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
    this._q.setFromEuler(this._e.set(rx, ry, rz));
    this._local.compose(new THREE.Vector3(x, y, z), this._q, new THREE.Vector3(sx, sy, sz));
    this.lists.get(kind).push({ m: this.frame.clone().multiply(this._local), c: color });
  }

  /** Adds a part on a face: `face` 0 = front (+z), 1 = right (+x), 2 = left (-x), 3 = back (-z). */
  onFace(face, w, d, kind, across, y, out, sx, sy, sz, color) {
    const [x, z, ry] = [
      [across, d / 2 + out, 0],
      [w / 2 + out, -across, Math.PI / 2],
      [-w / 2 - out, across, -Math.PI / 2],
      [-across, -d / 2 - out, Math.PI],
    ][face];
    this.add(kind, x, y, z, sx, sy, sz, color, 0, ry);
  }

  /** A point of the current building, in the world. */
  world(x, y, z) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.frame);
  }

  build(scene) {
    const c = new THREE.Color();
    for (const [kind, items] of this.lists) {
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(KINDS[kind].shape, paint(0xffffff, KINDS[kind].paint), items.length);
      items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, c.setHex(it.c));
      });
      mesh.castShadow = KINDS[kind].shadow !== false;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    for (const { p, reach } of this.lights) lamplight(scene, p.x, p.y, p.z, reach);
  }
}

function windowOn(parts, rng, face, w, d, across, y) {
  const trim = parts.trim;
  parts.onFace(face, w, d, 'box', across, y, 0.025, 0.58, 0.88, 0.05, trim);
  parts.onFace(face, w, d, 'box', across, y - 0.47, 0.08, 0.7, 0.08, 0.18, trim);
  const state = rng();
  if (state < 0.22) {
    parts.onFace(face, w, d, 'box', across, y, 0.06, 0.48, 0.74, 0.05, parts.shutter);
    for (let k = -1; k <= 1; k++) parts.onFace(face, w, d, 'box', across, y + k * 0.22, 0.09, 0.46, 0.03, 0.02, 0x2f5f4a);
  } else {
    parts.onFace(face, w, d, 'box', across, y, 0.05, 0.42, 0.7, 0.05, GLASS);
    parts.onFace(face, w, d, 'box', across, y + 0.08, 0.075, 0.42, 0.04, 0.02, trim);
    if (state < 0.8) for (const s of [-1, 1]) parts.onFace(face, w, d, 'box', across + s * 0.44, y, 0.04, 0.24, 0.76, 0.05, parts.shutter);
  }
  if (rng() < 0.34) {
    parts.onFace(face, w, d, 'box', across, y - 0.6, 0.18, 0.56, 0.16, 0.2, TILE);
    for (let k = -1; k <= 1; k++) parts.onFace(face, w, d, 'ball', across + k * 0.17, y - 0.46, 0.2, 0.17, 0.17, 0.17, pick(rng, [0xd9584a, 0xe2826a, 0xf08aa8, 0xf6d24a, 0xf7efe6]));
    parts.onFace(face, w, d, 'leaf', across, y - 0.52, 0.2, 0.5, 0.14, 0.16, 0x5a9050);
  }
}

/** A climber rooted by the wall and spreading as it goes up: leaves, then flowers on top. */
function climber(parts, rng, face, w, d, across, top) {
  const [leaf, flower, bright] = pick(rng, CLIMBERS);
  const lean = (rng() - 0.5) * 0.5;
  for (let y = 0.4; y < top; y += 0.42) {
    const spread = 0.25 + (y / top) * (0.5 + rng() * 0.5);
    for (let k = 0; k < 2 + Math.floor(spread * 3); k++) {
      const x = across + lean * y + (rng() - 0.5) * 2 * spread;
      const size = 0.42 + rng() * 0.3;
      parts.onFace(face, w, d, 'leaf', x, y + (rng() - 0.5) * 0.3, 0.1, size, size * 0.9, 0.3, leaf);
      if (y > top * 0.3 && rng() < 0.75) parts.onFace(face, w, d, 'ball', x + (rng() - 0.5) * 0.4, y + 0.1 + (rng() - 0.5) * 0.3, 0.2, size * 0.6, size * 0.55, 0.26, rng() < 0.6 ? flower : bright);
    }
  }
}

function house(parts, rng, w, d, floors, sunk) {
  const H = 1.2 + floors * 1.7;
  const wall = pick(rng, WALLS);
  parts.trim = pick(rng, TRIM);
  parts.shutter = pick(rng, SHUTTER);
  parts.add('box', 0, H / 2, 0, w, H, d, wall);
  parts.add('box', 0, 0.6, 0, w + 0.12, 1.2, d + 0.12, STONE);
  for (let f = 1; f < floors; f++) parts.add('box', 0, 1.2 + f * 1.7 - 0.1, 0, w + 0.1, 0.12, d + 0.1, parts.trim);
  parts.add('box', 0, H + 0.09, 0, w + 0.26, 0.18, d + 0.26, parts.trim);

  // Door with its step and fanlight, and a lamp on its bracket that is lit all night.
  const doorX = (rng() - 0.5) * (w - 1.2);
  parts.onFace(0, w, d, 'box', doorX, 0.95, 0.03, 0.95, 1.65, 0.05, parts.trim);
  parts.onFace(0, w, d, 'box', doorX, 0.85, 0.05, 0.72, 1.45, 0.05, pick(rng, [WOOD, 0x4a7a58, 0x5a4034, 0x4a6a8a, 0x8a3a3a]));
  parts.onFace(0, w, d, 'arch', doorX, 1.58, 0.04, 0.72, 0.72, 0.05, GLASS);
  parts.onFace(0, w, d, 'box', doorX, 0.08, 0.2, 1.1, 0.16, 0.42, STONE);
  if (rng() < 0.6) {
    const side = doorX > 0 ? -1 : 1;
    parts.onFace(0, w, d, 'box', doorX + side * 0.72, 2.1, 0.16, 0.05, 0.05, 0.3, IRON);
    parts.onFace(0, w, d, 'lamp', doorX + side * 0.72, 1.92, 0.3, 0.24, 0.3, 0.24, WARM_LIGHT);
    parts.lights.push({ p: parts.world(doorX + side * 0.72, 1.9, d / 2 + 1), reach: 4.2 });
  }

  // Windows on the three visible faces, floor by floor.
  for (let f = 0; f < floors; f++) {
    const y = 1.2 + f * 1.7 + 0.75;
    for (const face of [0, 1, 2]) {
      const span = face === 0 ? w : d;
      const n = Math.max(1, Math.floor(span / 1.35));
      for (let k = 0; k < n; k++) {
        const across = -span / 2 + (span * (k + 0.5)) / n;
        if (f === 0 && face === 0 && Math.abs(across - doorX) < 0.9) continue;
        if (rng() < 0.1) continue;
        windowOn(parts, rng, face, w, d, across, y);
      }
    }
  }

  // A balcony with railings, pots and maybe the laundry.
  if (floors > 1 && rng() < 0.55) {
    const y = 1.2 + (1 + Math.floor(rng() * (floors - 1))) * 1.7;
    const bw = Math.min(w - 0.4, 2.2);
    parts.add('box', 0, y - 0.05, d / 2 + 0.38, bw, 0.12, 0.76, STONE);
    parts.add('box', 0, y + 0.55, d / 2 + 0.74, bw, 0.06, 0.06, parts.shutter);
    for (let k = 0; k <= 4; k++) parts.add('box', -bw / 2 + (bw * k) / 4, y + 0.27, d / 2 + 0.74, 0.05, 0.55, 0.05, parts.shutter);
    for (const s of [-1, 1]) parts.add('leaf', s * (bw / 2 - 0.25), y + 0.25, d / 2 + 0.45, 0.34, 0.34, 0.34, pick(rng, [0x5a9050, 0x4f8456, 0x6a9c5c]));
    for (const s of [-1, 1]) if (rng() < 0.6) parts.add('ball', s * (bw / 2 - 0.25), y + 0.42, d / 2 + 0.5, 0.2, 0.18, 0.2, pick(rng, [0xd9584a, 0xf08aa8, 0xf6d24a]));
    if (rng() < 0.5) {
      parts.add('box', 0, y + 1.25, d / 2 + 0.7, bw, 0.02, 0.02, 0xd8d4e0);
      for (let k = 0; k < 3; k++) parts.add('box', -bw / 3 + (k * bw) / 3, y + 1.0, d / 2 + 0.7, 0.36, 0.48, 0.03, pick(rng, [PAL.ivory, 0x9ab4d0, 0xe2826a, PAL.ivory, 0xe8d2a0, 0xb8d0b0]));
    }
  }

  // A striped awning over a ground-floor window, a bench or a row of pots by the door.
  if (rng() < 0.22) {
    const stripe = pick(rng, [0xd9584a, 0x58a0a0, 0xe6b450, 0x5a86a0]);
    for (let k = 0; k < 5; k++) parts.add('box', -0.6 + k * 0.3, 2.9, d / 2 + 0.42, 0.3, 0.05, 0.9, k % 2 ? PAL.ivory : stripe, 0.4);
  }
  if (rng() < 0.5) {
    const x = doorX > 0 ? doorX - 1.3 : doorX + 1.3;
    if (rng() < 0.5) {
      parts.add('box', x, sunk + 0.45, d / 2 + 0.4, 1.1, 0.08, 0.36, WOOD);
      for (const s of [-1, 1]) parts.add('box', x + s * 0.45, sunk + 0.22, d / 2 + 0.4, 0.08, 0.44, 0.3, WOOD);
    } else {
      for (const s of [-1, 0, 1]) {
        parts.add('cyl', x + s * 0.4, sunk + 0.2, d / 2 + 0.36, 0.3, 0.36, 0.3, TILE);
        parts.add('leaf', x + s * 0.4, sunk + 0.55, d / 2 + 0.36, 0.42, 0.46, 0.42, pick(rng, [0x5a9050, 0x4f8456, 0x74a862]));
      }
    }
  }
  // Bougainvillea, wisteria, jasmine or ivy up the front or a side wall.
  if (rng() < 0.42) {
    const face = pick(rng, [0, 0, 1, 2]);
    const span = face === 0 ? w : d;
    climber(parts, rng, face, w, d, (rng() < 0.5 ? -1 : 1) * (span / 2 - 0.35), H * (0.5 + rng() * 0.5));
  }

  // Roof: hipped tiles or slate with a chimney, or a roof terrace with a parasol or a pergola.
  const roof = rng();
  if (roof < 0.68) {
    const color = rng() < 0.4 ? SLATE : pick(rng, [TILE, 0xbc6444, 0xd47c54, 0xc87850]);
    parts.add('pyramid', 0, H + 0.18 + (roof < 0.4 ? 0.5 : 0.36), 0, w + 0.45, roof < 0.4 ? 1.0 : 0.72, d + 0.45, color);
    parts.add('box', w * 0.25, H + 0.8, -d * 0.2, 0.36, 1.1, 0.36, wall);
    parts.add('box', w * 0.25, H + 1.4, -d * 0.2, 0.52, 0.1, 0.52, parts.trim);
    parts.add('pyramid', w * 0.25, H + 1.55, -d * 0.2, 0.5, 0.2, 0.5, TILE);
    parts.chimneys.push(parts.world(w * 0.25, H + 1.8, -d * 0.2));
    // The gutter under the front eave empties through a spout at one corner: a thread of
    // water down to the street while it rains. Drops fall from the eaves long after, and
    // freeze there as icicles.
    const side = rng() < 0.5 ? -1 : 1;
    parts.add('box', 0, H + 0.2, d / 2 + 0.27, w + 0.5, 0.09, 0.1, IRON);
    parts.add('box', side * (w / 2 + 0.3), H + 0.17, d / 2 + 0.36, 0.1, 0.1, 0.3, IRON);
    parts.add('flow', side * (w / 2 + 0.3), (H + 0.1 + sunk) / 2, d / 2 + 0.5, 0.1, H + 0.1 - sunk, 0.1, POURING);
    parts.add('flow', side * (w / 2 + 0.3), sunk + 0.06, d / 2 + 0.5, 0.5, 0.1, 0.5, POURING);
    for (const x of [-0.31, 0.12, 0.38]) {
      if (rng() < 0.7) parts.add('flow', x * w, (H + 0.14 + sunk) / 2, d / 2 + 0.34, 0.07, H + 0.14 - sunk, 0.07, DRIPPING);
    }
    for (const z of [-0.24, 0.2]) {
      if (rng() < 0.5) parts.add('flow', -side * (w / 2 + 0.28), (H + 0.14 + sunk) / 2, z * d, 0.07, H + 0.14 - sunk, 0.07, DRIPPING);
    }
  } else {
    for (const [x, z, sx, sz] of [[0, d / 2, w, 0.12], [0, -d / 2, w, 0.12], [w / 2, 0, 0.12, d], [-w / 2, 0, 0.12, d]]) parts.add('box', x, H + 0.4, z, sx + 0.1, 0.45, sz + 0.1, parts.trim);
    if (rng() < 0.5) {
      parts.add('cyl', -w * 0.2, H + 1.2, 0, 0.06, 1.9, 0.06, 0x3b3346);
      parts.add('cone', -w * 0.2, H + 2.1, 0, 2.2, 0.55, 2.2, pick(rng, [0xe9e0c8, 0xd9584a, 0x56866a]));
    } else {
      // A vine pergola for the shade, with a lantern under it for the evenings.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.add('box', sx * (w / 2 - 0.5), H + 1.1, sz * (d / 2 - 0.5), 0.08, 1.5, 0.08, WOOD);
      parts.add('box', 0, H + 1.86, 0, w - 0.6, 0.06, d - 0.6, WOOD);
      for (let k = 0; k < 7; k++) parts.add('leaf', (rng() - 0.5) * (w - 0.8), H + 1.98, (rng() - 0.5) * (d - 0.8), 0.9, 0.3, 0.9, pick(rng, [0x5f8e4c, 0x6c9a54, 0x54844a]));
      parts.add('lamp', 0, H + 1.6, 0, 0.22, 0.26, 0.22, WARM_LIGHT);
      parts.lights.push({ p: parts.world(0, H + 1.6, 0), reach: 3.4 });
    }
    for (let k = 0; k < 3; k++) parts.add('leaf', (rng() - 0.5) * (w - 0.8), H + 0.45, (rng() - 0.5) * (d - 0.8), 0.5, 0.45, 0.5, pick(rng, [0x5a9050, 0x74a862, 0x4f8456]));
  }

  // A television aerial here and there.
  if (rng() < 0.2) {
    parts.add('cyl', -w * 0.3, H + 1.4, d * 0.25, 0.04, 2.0, 0.04, 0x3b3346);
    for (const [y, l] of [[2.2, 0.9], [1.95, 0.7], [1.7, 0.5]]) parts.add('box', -w * 0.3, H + y, d * 0.25, l, 0.03, 0.03, 0x3b3346);
  }
  return H;
}

function campanile(parts, rng) {
  const color = pick(rng, [PAL.cream, 0xe8d2a0, 0xd9c7a8]);
  const trim = PAL.ivory;
  parts.add('box', 0, 7, 0, 2.4, 14, 2.4, color);
  parts.add('box', 0, 0.6, 0, 2.6, 1.2, 2.6, STONE);
  for (const y of [3.5, 7, 10, 13.2]) parts.add('box', 0, y, 0, 2.55, 0.2, 2.55, trim);
  for (const face of [0, 1, 2, 3]) {
    parts.onFace(face, 2.4, 2.4, 'box', 0, 11.4, 0.02, 0.85, 1.5, 0.05, GLASS);
    parts.onFace(face, 2.4, 2.4, 'arch', 0, 12.15, 0.02, 0.85, 0.85, 0.05, GLASS);
    for (const s of [-1, 1]) parts.onFace(face, 2.4, 2.4, 'box', s * 0.55, 4.8, 0.02, 0.28, 0.6, 0.05, GLASS);
  }
  parts.add('cyl', 0, 8.6, 1.24, 1.1, 0.06, 1.1, trim, Math.PI / 2);
  parts.add('box', 0, 8.75, 1.28, 0.06, 0.4, 0.03, 0x3b3346);
  parts.add('box', 0.12, 8.6, 1.28, 0.3, 0.06, 0.03, 0x3b3346);
  parts.add('box', 0, 14.15, 0, 2.7, 0.3, 2.7, trim);
  // A stone spire with a cross, as on the church of San Lorenzo in Manarola.
  parts.add('pyramid', 0, 15.6, 0, 2.6, 2.8, 2.6, rng() < 0.5 ? SLATE : TILE);
  parts.add('box', 0, 17.5, 0, 0.08, 1.0, 0.08, 0x3b3346);
  parts.add('box', 0, 17.7, 0, 0.5, 0.08, 0.08, 0x3b3346);
  parts.lights.push({ p: parts.world(0, 2, 2.2), reach: 7 });
}

/**
 * Wood smoke from the chimneys: a few puffs rising, swelling and thinning on the wind. Fires
 * are lit when it is cold, and for supper every evening.
 */
function buildSmoke(scene, rng, chimneys, animated) {
  const PUFFS = 4;
  const hearths = chimneys.filter(() => rng() < 0.45);
  if (!hearths.length) return;
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), paint(0xe6e2e6, { flat: true }), hearths.length * PUFFS);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const phases = hearths.map(() => rng() * 10);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let strength = 0;
  animated.push((t, dt, climate) => {
    const cold = climate ? Math.max(climate.season.winter, climate.season.autumn * 0.5, climate.night * 0.5 * (1 - climate.season.summer), climate.now.snow) : 0;
    strength += (cold - strength) * Math.min(1, dt);
    mesh.visible = strength > 0.03;
    if (!mesh.visible) return;
    const wind = climate.wind;
    const blow = 0.4 + climate.now.wind * 2.2;
    hearths.forEach((hearth, i) => {
      for (let k = 0; k < PUFFS; k++) {
        const life = (t * 0.22 + phases[i] + k / PUFFS) % 1;
        const rise = life * 3.2;
        p.set(hearth.x + wind.x * blow * life * rise * 0.6 + Math.sin(t + k * 2 + phases[i]) * 0.12, hearth.y + rise, hearth.z + wind.y * blow * life * rise * 0.6);
        s.setScalar((0.25 + life * 0.75) * Math.sin(Math.min(1, (1 - life) * 2.2) * Math.PI * 0.5) * strength);
        mesh.setMatrixAt(i * PUFFS + k, m.compose(p, q, s));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
}

export function buildVillages(scene, rng, animated) {
  const parts = new Parts();
  const placed = [];
  const yaw = Math.PI / 4;
  const SUNK = 1.4; // houses are dug into the slope: their street door is this far up

  // Houses packed in rows along the slope, as in Manarola, inside an organic blob.
  const villages = VILLAGES.map((village) => ({ cu: village.u, cv: village.v, radius: village.r, bell: village.bell }));
  for (const village of villages) {
    for (let v = village.cv - village.radius - 4; v <= village.cv + village.radius + 4; v += 3.4) {
      for (let u = village.cu - village.radius - 4; u <= village.cu + village.radius + 4; u += 3.2) {
        // Ragged outline: the edge of the blob wanders with noise.
        const a = Math.atan2(u - village.cu, v - village.cv);
        const edge = village.radius * (0.75 + fbm(Math.cos(a) * 1.5 + village.cv, Math.sin(a) * 1.5, 2) * 0.5);
        const d = Math.hypot(u - village.cu, (v - village.cv) * 0.85);
        if (d > edge) continue;
        const jv = v + (rng() - 0.5) * 0.4;
        const ju = u + (rng() - 0.5) * 0.3;
        const x = toX(ju, jv);
        const z = toZ(ju, jv);
        if (rng() < 0.05 || (village.bell && Math.hypot(ju - village.cu, jv - village.cv) < 3.5)) continue;
        if (!isWild(x, z, -2) || slopeAt(x, z) > 1.8 || groundAt(x, z) < 0.5) continue;
        placed.push([x, z]);
        parts.at(new THREE.Vector3(x, groundAt(x, z) - SUNK, z), yaw);
        // Taller houses toward the heart of the village.
        const floors = 2 + Math.floor(rng() * 2) + (d < edge * 0.5 ? 1 : 0);
        house(parts, rng, 2.8 + rng() * 0.6, 2.6 + rng() * 0.5, floors, SUNK);
      }
    }
    if (village.bell) {
      const x = toX(village.cu, village.cv);
      const z = toZ(village.cu, village.cv);
      parts.at(new THREE.Vector3(x, groundAt(x, z) - 0.5, z), yaw);
      campanile(parts, rng);
      placed.push([x, z]);
    }
  }

  // Vineyards: rows of vines on posts, following the terraces.
  for (let v = SQUARE.v0; v < SQUARE.v1; v += 0.95) {
    for (let u = 40; u < SQUARE.u1; u += 1.6) {
      const x = toX(u, v);
      const z = toZ(u, v);
      // Vines grow wherever the mountain has been terraced for them.
      if (u < footU(v) + 1 || cultivated(u, v) < 0.6) continue;
      if (estateWeight(u, v) > 0.25) continue; // the estate plants its own rows
      if (slopeAt(x, z) > 0.3 || !isWild(x, z, -1)) continue;
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 3)) continue;
      parts.at(new THREE.Vector3(x, groundAt(x, z), z), yaw);
      parts.add('leaf', 0, 0.55, 0, 0.85, 0.95 + rng() * 0.3, 0.6, pick(rng, [0x6a9e5e, 0x66a070, 0x82b06a, 0x8ab464]));
      if (Math.round(v / 0.95) % 3 === 0) parts.add('cyl', 0.55, 0.6, 0, 0.06, 1.2, 0.06, WOOD);
      if (rng() < 0.2) parts.add('ball', 0.2, 0.45, 0.3, 0.14, 0.14, 0.14, 0x6d4a8f);
    }
  }

  parts.build(scene);
  buildSmoke(scene, rng, parts.chimneys, animated);
}

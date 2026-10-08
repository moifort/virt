// Old Ligurian fishing villages, laid out the way the real ones grew: lanes that follow the
// contours of the hill, stairs that climb between them, a square or two where they meet, and
// tall narrow houses in ochre, salmon and faded red built wall to wall along the lanes,
// stacked up the slope with their fronts to the sea, with more of them scattered loosely over
// the terraces beyond. The houses have framed windows, green shutters, balconies, laundry, tile
// and slate roofs, roof terraces and chimneys, and they are lived in: bougainvillea and
// wisteria climb the fronts, a lamp hangs by the door, gutters run under the eaves and empty
// through a spout when it rains, smoke rises from the chimneys when it is cold.
// Every part is a unit shape instanced with its own matrix and colour: thousands of details,
// a handful of draw calls.
import * as THREE from 'three';
import { pick, smoothstep } from './noise.js';
import { PAL, WATER_LEVEL, paint } from './style.js';
import { at, bake, lamplight, lantern, seat } from './kit.js';
import { festoon, gozzo } from './zones.js';
import { CLEARINGS, PATHS, SQUARE, UP, VILLAGES, ZONES, bankAt, cultivated, estateWeight, footU, groundAt, inSquare, isWild, laneAt, lanePoint, occupy, segmentDistance, slopeAt, toU, toV, toX, toZ, villagePlan } from './terrain.js';

const ballShape = new THREE.SphereGeometry(0.5, 8, 6);
const boxShape = new THREE.BoxGeometry(1, 1, 1);
// What parts are made of: a unit shape and the way it is painted.
const KINDS = {
  box: { shape: boxShape, paint: { wall: true, cutaway: true } },
  pyramid: { shape: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), paint: { flat: true, roof: true, cutaway: true } },
  // A gable roof: a triangular prism lying along z, ridge up, 0.866 wide, from -0.25 to +0.5.
  gable: { shape: new THREE.CylinderGeometry(0.5, 0.5, 1, 3).rotateX(-Math.PI / 2), paint: { flat: true, roof: true, cutaway: true } },
  cyl: { shape: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), paint: { cutaway: true } },
  ball: { shape: ballShape, paint: { cutaway: true } },
  cone: { shape: new THREE.ConeGeometry(0.5, 1, 8), paint: { flat: true, cutaway: true } },
  // Half disc standing in the XY plane, flat side down (fanlights, arched openings).
  arch: { shape: new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), paint: { cutaway: true } },
  // Evergreen greenery, vines that turn with the seasons, a lit lamp, and rain water running
  // off a roof (its colour is how much it carries).
  leaf: { shape: ballShape, paint: { leaf: true, cutaway: true } },
  vine: { shape: ballShape, paint: { leaf: true, deciduous: true, cutaway: true } },
  lamp: { shape: ballShape, paint: { glow: true, cutaway: true } },
  drystone: { shape: boxShape, paint: { stones: true, cutaway: true } },
  flow: { shape: boxShape, paint: { flow: true, cutaway: true }, shadow: false },
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
// The stone of the streets: flags and treads, the walls beside them, the blocks of the quay.
const PAVING = [0xbfb4a0, 0xb4a995, 0xc9bea9, 0xaba08c];
const PLINTH = [0xc4b59c, 0xb9aa92, 0xcdbfa6];
const WALL_STONE = 0xc9bca4;
const BLOCK = [0xcdc2ab, 0xbcb09c, 0xd8cdb7];
// The terrace walls of the gardens, the same sandstone gone grey with weather and lichen.
const DRYSTONE = [0xb9ad97, 0xb0a48e, 0xc2b7a0, 0xaa9f8b];
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
// A tread of paving: the stones are laid across the lane this far apart.
const TREAD = 0.62;

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

  at(position, yaw, scale = 1) {
    this.frame.compose(position, new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(scale, scale, scale));
    this.scale = scale;
    this.yaw = yaw;
  }

  add(kind, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
    this._q.setFromEuler(this._e.set(rx, ry, rz));
    this._local.compose(new THREE.Vector3(x, y, z), this._q, new THREE.Vector3(sx, sy, sz));
    this.lists.get(kind).push({ m: this.frame.clone().multiply(this._local), c: color });
    // Whatever is the size of a room or more takes up its ground: nothing grows there, and
    // nobody walks through its walls.
    const s = this.scale ?? 1;
    if (kind === 'box' && sx * s >= 1.5 && sz * s >= 1.5 && sy * s >= 1) {
      const c = this.world(x, y, z);
      occupy(c.x, c.z, this.yaw + ry, (sx * s) / 2, (sz * s) / 2, c.y + (sy * s) / 2);
    }
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

/**
 * A house, its front on the street at y = 0. `plinth` is how far its stone footing goes on
 * down below that, where the ground falls away behind or beside it; `terrace` asks for a flat
 * roof (the house runs in under the lane above, whose paving is level with it); `door` puts
 * the door at the left (-1) or right (1) end of the front.
 */
function house(parts, rng, w, d, floors, { plinth = 0, terrace = false, door = 0 } = {}) {
  const H = 1.2 + floors * 1.7;
  const wall = pick(rng, WALLS);
  parts.trim = pick(rng, TRIM);
  parts.shutter = pick(rng, SHUTTER);
  parts.add('box', 0, H / 2, 0, w, H, d, wall);
  parts.add('box', 0, 0.6, 0, w + 0.12, 1.2, d + 0.12, STONE);
  // Where the ground falls away a storey or more below the street, the house goes on down the
  // slope: the floors under the street are lived in too, with windows wherever they stand
  // clear of the ground, over a stone footing. A shallower drop is only the footing.
  const below = Math.floor((plinth - 0.5) / 1.7);
  if (below >= 1) {
    parts.add('box', 0, -plinth / 2, 0, w, plinth, d, wall);
    parts.add('box', 0, 0.52 - plinth, 0, w + 0.16, 1.04, d + 0.16, pick(rng, PLINTH));
    for (let f = 1; f <= below; f++) {
      parts.add('box', 0, 0.06 - f * 1.7, 0, w + 0.1, 0.12, d + 0.1, parts.trim);
      const y = 0.85 - f * 1.7;
      for (const face of [0, 1, 2, 3]) {
        const span = face === 0 || face === 3 ? w : d;
        const n = Math.max(1, Math.floor(span / 1.35));
        for (let k = 0; k < n; k++) {
          const across = -span / 2 + (span * (k + 0.5)) / n;
          const [x, z] = [[across, d / 2 + 0.3], [w / 2 + 0.3, -across], [-w / 2 - 0.3, across], [-across, -d / 2 - 0.3]][face];
          const sill = parts.world(x, y - 0.6, z);
          if (groundAt(sill.x, sill.z) > sill.y || rng() < 0.15) continue;
          windowOn(parts, rng, face, w, d, across, y);
        }
      }
    }
  } else if (plinth > 0.15) parts.add('box', 0, 0.02 - plinth / 2, 0, w + 0.16, plinth + 0.04, d + 0.16, pick(rng, PLINTH));
  for (let f = 1; f < floors; f++) parts.add('box', 0, 1.2 + f * 1.7 - 0.1, 0, w + 0.1, 0.12, d + 0.1, parts.trim);
  parts.add('box', 0, H + 0.09, 0, w + 0.26, 0.18, d + 0.26, parts.trim);

  // Door with its step and fanlight, and a lamp on its bracket that is lit all night.
  const doorX = door ? door * (w / 2 - 0.7) : (rng() - 0.5) * (w - 1.2);
  parts.onFace(0, w, d, 'box', doorX, 0.95, 0.03, 0.95, 1.65, 0.05, parts.trim);
  parts.onFace(0, w, d, 'box', doorX, 0.85, 0.05, 0.72, 1.45, 0.05, pick(rng, [WOOD, 0x4a7a58, 0x5a4034, 0x4a6a8a, 0x8a3a3a]));
  parts.onFace(0, w, d, 'arch', doorX, 1.58, 0.04, 0.72, 0.72, 0.05, GLASS);
  parts.onFace(0, w, d, 'box', doorX, 0.08, 0.2, 1.1, 0.16, 0.42, STONE);
  if (rng() < 0.45) {
    const side = doorX > 0 ? -1 : 1;
    parts.onFace(0, w, d, 'box', doorX + side * 0.72, 2.1, 0.16, 0.05, 0.05, 0.3, IRON);
    parts.onFace(0, w, d, 'lamp', doorX + side * 0.72, 1.92, 0.3, 0.24, 0.3, 0.24, WARM_LIGHT);
    parts.lights.push({ p: parts.world(doorX + side * 0.72, 1.9, d / 2 + 1), reach: 3.8 * parts.scale });
  }

  // Windows on every face, floor by floor: a house with its back to the sea looks at it too.
  for (let f = 0; f < floors; f++) {
    const y = 1.2 + f * 1.7 + 0.75;
    for (const face of [0, 1, 2, 3]) {
      const span = face === 0 || face === 3 ? w : d;
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
      parts.add('box', x, 0.45, d / 2 + 0.4, 1.1, 0.08, 0.36, WOOD);
      for (const s of [-1, 1]) parts.add('box', x + s * 0.45, 0.22, d / 2 + 0.4, 0.08, 0.44, 0.3, WOOD);
    } else {
      for (const s of [-1, 0, 1]) {
        parts.add('cyl', x + s * 0.4, 0.2, d / 2 + 0.36, 0.3, 0.36, 0.3, TILE);
        parts.add('leaf', x + s * 0.4, 0.55, d / 2 + 0.36, 0.42, 0.46, 0.42, pick(rng, [0x5a9050, 0x4f8456, 0x74a862]));
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
  const roof = terrace ? 0.9 : rng();
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
    parts.add('flow', side * (w / 2 + 0.3), (H + 0.1) / 2, d / 2 + 0.5, 0.1, H + 0.1, 0.1, POURING);
    parts.add('flow', side * (w / 2 + 0.3), 0.06, d / 2 + 0.5, 0.5, 0.1, 0.5, POURING);
    for (const x of [-0.31, 0.12, 0.38]) {
      if (rng() < 0.7) parts.add('flow', x * w, (H + 0.14) / 2, d / 2 + 0.34, 0.07, H + 0.14, 0.07, DRIPPING);
    }
    for (const z of [-0.24, 0.2]) {
      if (rng() < 0.5) parts.add('flow', -side * (w / 2 + 0.28), (H + 0.14) / 2, z * d, 0.07, H + 0.14, 0.07, DRIPPING);
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
      parts.lights.push({ p: parts.world(0, H + 1.6, 0), reach: 3.4 * parts.scale });
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
  parts.lights.push({ p: parts.world(0, 2, 2.2), reach: 7 * parts.scale });
}

/** A gable roof `W` wide and `R` high at the ridge, `L` long, its base at `y0`. */
function gable(parts, x, y0, z, W, R, L, color) {
  parts.add('gable', x, y0 + R / 3, z, W / 0.866, R / 0.75, L, color);
}

/** The village church: a plain Ligurian nave with a pediment, a rose window and an arched door, facing the square. */
function church(parts, rng) {
  const w = 4.2;
  const d = 5.6;
  const H = 4.0;
  const R = 1.4;
  const wall = pick(rng, [0xf3e7cb, 0xefdfc0]);
  const trim = PAL.ivory;
  parts.add('box', 0, H / 2, 0, w, H, d, wall);
  parts.add('box', 0, 0.5, 0, w + 0.14, 1.0, d + 0.14, STONE);
  parts.add('box', 0, -1.5, 0, w + 0.18, 3.0, d + 0.18, PLINTH[0]);
  parts.add('box', 0, H + 0.05, 0, w + 0.2, 0.12, d + 0.2, trim);
  // The pediment in the wall colour, the slate roof behind it, a cross on the ridge.
  gable(parts, 0, H + 0.1, 0, w, R, d + 0.08, wall);
  gable(parts, 0, H + 0.14, -0.35, w + 0.5, R, d - 0.3, 0x707484);
  parts.add('box', 0, H + 0.1 + R + 0.5, d / 2 - 0.3, 0.08, 1.0, 0.08, IRON);
  parts.add('box', 0, H + 0.1 + R + 0.7, d / 2 - 0.3, 0.55, 0.08, 0.08, IRON);
  // The front: an arched door, a rose window above it, a lamp by the door, the step.
  parts.add('box', 0, 1.2, d / 2 + 0.02, 1.7, 2.4, 0.06, trim);
  parts.add('arch', 0, 2.4, d / 2 + 0.02, 1.7, 1.7, 0.06, trim);
  parts.add('box', 0, 1.1, d / 2 + 0.05, 1.3, 2.2, 0.06, WOOD);
  parts.add('arch', 0, 2.2, d / 2 + 0.05, 1.3, 1.3, 0.06, GLASS);
  parts.add('cyl', 0, H - 0.75, d / 2 + 0.03, 1.5, 0.06, 1.5, trim, Math.PI / 2);
  parts.add('cyl', 0, H - 0.75, d / 2 + 0.06, 1.15, 0.06, 1.15, GLASS, Math.PI / 2);
  for (let k = 0; k < 4; k++) parts.add('box', 0, H - 0.75, d / 2 + 0.09, 0.06, 1.1, 0.03, trim, 0, 0, (k * Math.PI) / 4);
  parts.add('box', 0, 0.06, d / 2 + 0.5, 2.6, 0.12, 1.0, STONE);
  parts.add('box', 1.25, 2.9, d / 2 + 0.16, 0.05, 0.05, 0.3, IRON);
  parts.add('lamp', 1.25, 2.72, d / 2 + 0.3, 0.24, 0.3, 0.24, WARM_LIGHT);
  parts.lights.push({ p: parts.world(1.25, 2.7, d / 2 + 1), reach: 4 * parts.scale });
  // Tall arched windows along the sides.
  for (const face of [1, 2]) {
    for (const z of [-1.7, 0, 1.7]) {
      parts.onFace(face, w, d, 'box', z, H * 0.55, 0.02, 0.55, 1.5, 0.05, trim);
      parts.onFace(face, w, d, 'arch', z, H * 0.55 + 0.75, 0.02, 0.55, 0.55, 0.05, trim);
      parts.onFace(face, w, d, 'box', z, H * 0.55, 0.04, 0.4, 1.4, 0.05, GLASS);
      parts.onFace(face, w, d, 'arch', z, H * 0.55 + 0.7, 0.04, 0.4, 0.4, 0.05, GLASS);
    }
  }
}

/** A plane tree for the shade of a square, a ring of stone round its foot. */
function planeTree(parts, rng, x, y, z, size = 1) {
  parts.at(new THREE.Vector3(x, y, z), rng() * Math.PI * 2, size);
  parts.add('cyl', 0, 0.25, 0, 1.9, 0.5, 1.9, WALL_STONE);
  parts.add('cyl', 0, 2.4, 0, 0.5, 4.8, 0.5, 0xb6a68c);
  parts.add('cyl', 0, 0.9, 0, 0.64, 1.8, 0.64, 0x9a8a72);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + rng() * 0.6;
    const r = k === 0 ? 0 : 1.4 + rng() * 1.4;
    const s = 2.4 + rng() * 1.3;
    parts.add('vine', Math.cos(a) * r, 5.4 + (rng() - 0.3) * 1.5 + (k === 0 ? 1.0 : 0), Math.sin(a) * r, s, s * 0.75, s, pick(rng, [0x5f9a50, 0x6faa58, 0x7fb860, 0x58924c]));
  }
}

function lemonTree(parts, rng, x, y, z) {
  parts.at(new THREE.Vector3(x, y, z), rng() * Math.PI * 2, 1);
  parts.add('cyl', 0, 0.9, 0, 0.26, 1.8, 0.26, 0x8a6a4a);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const r = k === 0 ? 0 : 0.8;
    parts.add('leaf', Math.cos(a) * r, 2.3 + (k === 0 ? 0.5 : 0), Math.sin(a) * r, 1.5, 1.3, 1.5, pick(rng, [0x357a44, 0x4f9a50, 0x3f8a48]));
  }
  for (let k = 0; k < 7; k++) parts.add('ball', (rng() - 0.5) * 2.2, 1.9 + rng() * 1.2, (rng() - 0.5) * 2.2, 0.22, 0.26, 0.22, 0xf6d24a);
}

function fountain(parts, x, y, z) {
  parts.at(new THREE.Vector3(x, y, z), 0, 1);
  parts.add('cyl', 0, 0.4, 0, 3.2, 0.8, 3.2, 0xd3c7b0);
  parts.add('cyl', 0, 0.78, 0, 2.7, 0.08, 2.7, 0x8fd0d8);
  parts.add('cyl', 0, 0.9, 0, 0.6, 1.4, 0.6, WALL_STONE);
  parts.add('cyl', 0, 1.6, 0, 1.6, 0.25, 1.6, 0xd3c7b0);
  parts.add('cyl', 0, 1.72, 0, 1.3, 0.06, 1.3, 0x8fd0d8);
  parts.add('cyl', 0, 2.0, 0, 0.2, 0.6, 0.2, WALL_STONE);
  parts.add('ball', 0, 2.35, 0, 0.3, 0.3, 0.3, WALL_STONE);
}

function well(parts, x, y, z, yaw) {
  parts.at(new THREE.Vector3(x, y, z), yaw, 1);
  parts.add('cyl', 0, 0.5, 0, 1.8, 1.0, 1.8, WALL_STONE);
  parts.add('cyl', 0, 1.02, 0, 2.0, 0.14, 2.0, 0xb3a58c);
  parts.add('cyl', 0, 1.06, 0, 1.3, 0.1, 1.3, 0x2f3540);
  for (const s of [-1, 1]) parts.add('box', s * 0.95, 1.8, 0, 0.14, 1.7, 0.14, WOOD);
  parts.add('box', 0, 2.6, 0, 2.1, 0.12, 0.12, WOOD);
  parts.add('cyl', 0, 2.25, 0, 0.1, 1.9, 0.1, IRON, 0, 0, Math.PI / 2);
  parts.add('pyramid', 0, 3.0, 0, 2.6, 0.6, 2.6, TILE);
  parts.add('cyl', 0.2, 1.3, 0, 0.3, 0.36, 0.3, WOOD);
}

/** A wooden bench facing `yaw`, with two places to sit. */
function bench(parts, furniture, x, y, z, yaw) {
  parts.at(new THREE.Vector3(x, y, z), yaw, 1);
  parts.add('box', 0, 0.5, 0, 2.0, 0.12, 0.5, PAL.wood);
  parts.add('box', 0, 0.85, -0.24, 2.0, 0.45, 0.08, PAL.wood);
  for (const dx of [-0.8, 0.8]) parts.add('box', dx, 0.25, 0, 0.12, 0.5, 0.48, IRON);
  for (const dx of [-0.5, 0.5]) {
    const p = parts.world(dx, 0.56, 0);
    seat(furniture, p.x, p.y, p.z, yaw);
  }
}

// ---------------------------------------------------------------- Streets

/** The oriented footprint of a house in the world: centre, yaw, half-length along the front, half-depth. */
function footprint(x, z, yaw, hw, hd) {
  return { x, z, yaw, hw, hd, ax: Math.cos(yaw), az: -Math.sin(yaw), bx: Math.sin(yaw), bz: Math.cos(yaw) };
}

/** A point of a footprint: `sx` across the front (-1..1), `sz` toward the front (-1..1). */
function corner(f, sx, sz) {
  return { x: f.x + f.ax * f.hw * sx + f.bx * f.hd * sz, z: f.z + f.az * f.hw * sx + f.bz * f.hd * sz };
}

/** Whether two footprints overlap, each shrunk by `slack` (grown, if negative). */
function overlap(a, b, slack = 0.25) {
  for (const [ax, az] of [[a.ax, a.az], [a.bx, a.bz], [b.ax, b.az], [b.bx, b.bz]]) {
    const span = (f) => {
      const c = f.x * ax + f.z * az;
      const e = Math.abs(ax * f.ax + az * f.az) * (f.hw - slack) + Math.abs(ax * f.bx + az * f.bz) * (f.hd - slack);
      return [c - e, c + e];
    };
    const [a0, a1] = span(a);
    const [b0, b1] = span(b);
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

/**
 * Whether a house can stand on a footprint: on land, off the work areas, the paths and the
 * squares, clear of the other houses and of every lane but its own. A house on the uphill
 * side may run in under a higher lane, if its roof stays below the paving there: the result
 * then caps its floors.
 */
function siteFits(foot, lane, lanes, piazzas, placed, level, uphill, { waterfront = false, slack = 0.25, clearance = 3, scale }) {
  const pts = [];
  for (const sx of [-0.85, 0, 0.85]) for (const sz of [-0.85, 0, 0.85]) pts.push(corner(foot, sx, sz));
  const floor = WATER_LEVEL + (waterfront ? -2.4 : 0.6);
  for (const p of pts) {
    if (!inSquare(p.x, p.z, 3)) return null;
    if (groundAt(p.x, p.z) < floor) return null;
    if (estateWeight(toU(p.x, p.z), toV(p.x, p.z)) > 0.5) return null;
    for (const zn of ZONES) if (Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r + clearance) return null;
    for (const path of PATHS) if (segmentDistance(p.x, p.z, path) < 2.2) return null;
    for (const pz of piazzas) if (Math.hypot(p.x - pz.x, p.z - pz.z) < pz.r + 0.4) return null;
    for (const c of CLEARINGS) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.5) return null;
  }
  for (const other of placed) if (overlap(foot, other, slack)) return null;
  let cap;
  for (const other of lanes) {
    if (other === lane) continue;
    let near = Infinity;
    let there = 0;
    for (const p of pts) {
      const q = laneAt(other, p.x, p.z);
      if (q.d < near) {
        near = q.d;
        there = q.level;
      }
    }
    if (near >= other.half + (other.quay ?? 0) + 0.5) continue;
    // A stair climbs as it goes: whatever level a roof is capped at, some of its flight
    // would run into the walls. Nothing is built across one.
    if (!uphill || other.stair) return null;
    const fit = Math.floor(((there - level - 0.4) / scale - 1.2) / 1.7);
    if (fit < 1) return null;
    cap = cap === undefined ? fit : Math.min(cap, fit);
  }
  return { cap };
}

/** The gap left after a house: none (a party wall), a slit, an alley or a garden. */
function gap(rng) {
  const r = rng();
  return r < 0.6 ? 0.06 : r < 0.78 ? 0.3 + rng() * 0.4 : r < 0.93 ? 1.5 + rng() * 0.8 : 3 + rng() * 1.5;
}

/** Paves a lane with stone: flags laid across it on the level, treads that step up and down where it climbs. */
function paveLane(parts, rng, lane, piazzas) {
  const ground = (s) => {
    const q = lanePoint(lane, s);
    return groundAt(q.x, q.z);
  };
  for (let s = TREAD / 2; s < lane.length; s += TREAD) {
    const p = lanePoint(lane, s);
    if (piazzas.some((pz) => Math.hypot(p.x - pz.x, p.z - pz.z) < pz.r - 0.3)) continue;
    const here = groundAt(p.x, p.z);
    const before = s > TREAD ? ground(s - TREAD) : here;
    const after = s + TREAD < lane.length ? ground(s + TREAD) : here;
    const top = here + 0.1;
    const bottom = Math.min(here, before, after) - 0.2;
    parts.at(new THREE.Vector3(p.x, 0, p.z), Math.atan2(p.tx, p.tz), 1);
    // The quay strip is paved with its lane; side -1 lies toward local +x.
    const extra = lane.quay ?? 0;
    const cx = (-(lane.seaSide ?? 0) * extra) / 2;
    const w = lane.width + extra;
    if (lane.stair || rng() < 0.45) parts.add('box', cx, (top + bottom) / 2, 0, w, top - bottom, TREAD + 0.05, pick(rng, PAVING));
    else {
      const cut = cx + (rng() - 0.5) * w * 0.5;
      const l = cx - w / 2;
      const r = cx + w / 2;
      parts.add('box', (l + cut) / 2, (top + bottom) / 2, 0, cut - l, top - bottom, TREAD + 0.05, pick(rng, PAVING));
      parts.add('box', (cut + r) / 2, (top + bottom) / 2, 0, r - cut, top - bottom, TREAD + 0.05, pick(rng, PAVING));
    }
  }
}

/**
 * A few steps climbing into the hill up an alley between two houses, out to the terrace behind
 * them. If the way up runs into a wall of rock or out over a drop, the alley is left without
 * steps rather than given a stair that leads nowhere.
 */
function alleySteps(parts, rng, lane, s, side, width, placed) {
  const p = lanePoint(lane, s);
  const nx = -p.tz * side;
  const nz = p.tx * side;
  let prev = groundAt(p.x + nx * lane.half, p.z + nz * lane.half);
  const treads = [];
  for (let k = 0; k < 9; k++) {
    const out = lane.half + 0.4 + k * TREAD;
    const x = p.x + nx * out;
    const z = p.z + nz * out;
    const g = groundAt(x, z);
    if (g > prev + 1.3 || g < prev - 0.6) return;
    const top = Math.max(g, prev) + 0.1;
    treads.push([x, z, top, prev]);
    prev = top - 0.1;
  }
  for (const [x, z, top, below] of treads) {
    parts.at(new THREE.Vector3(x, 0, z), Math.atan2(nx, nz), 1);
    parts.add('box', 0, (top + below - 0.2) / 2, 0, width, top - below + 0.2, TREAD + 0.05, pick(rng, PAVING));
  }
  const run = (treads.length * TREAD) / 2;
  const mid = lane.half + 0.4 + run;
  placed.push(footprint(p.x + nx * mid, p.z + nz * mid, Math.atan2(nx, nz), width / 2 + 0.2, run + 0.3));
}

/** A little walled garden in a gap of the row: a lemon tree and some shrubs behind a low wall. */
function garden(parts, rng, lane, s, side, width, placed) {
  const p = lanePoint(lane, s);
  const nx = -p.tz * side;
  const nz = p.tx * side;
  const x0 = p.x + nx * (lane.half + 0.3);
  const z0 = p.z + nz * (lane.half + 0.3);
  parts.at(new THREE.Vector3(x0, groundAt(x0, z0), z0), Math.atan2(nx, nz), 1);
  parts.add('box', 0, 0.45, 0, width, 0.9, 0.4, WALL_STONE);
  const tx = p.x + nx * (lane.half + 2.8);
  const tz = p.z + nz * (lane.half + 2.8);
  lemonTree(parts, rng, tx, groundAt(tx, tz) - 0.2, tz);
  for (let k = 0; k < 3; k++) {
    const along = (rng() - 0.5) * (width - 1.5);
    const out = lane.half + 1.0 + rng() * 1.2;
    const x = p.x + nx * out + p.tx * along;
    const z = p.z + nz * out + p.tz * along;
    parts.at(new THREE.Vector3(x, groundAt(x, z), z), 0, 1);
    parts.add('leaf', 0, 0.5, 0, 1.0 + rng() * 0.5, 0.9, 1.0 + rng() * 0.5, pick(rng, [0x5a9050, 0x4f8456, 0x74a862]));
  }
  const mid = lane.half + 2.2;
  placed.push(footprint(p.x + nx * mid, p.z + nz * mid, Math.atan2(nx, nz), width / 2, 2.1));
}

/**
 * Houses built wall to wall along both sides of a lane, their fronts to it, thinning out
 * toward its ends so the village frays into the hillside instead of stopping at a line.
 * Returns the stretches of each side that they cover.
 */
function houseRows(parts, rng, lane, lanes, piazzas, placed, village, SCALE) {
  const heart = { x: toX(village.u, village.v), z: toZ(village.u, village.v) };
  const covered = { [-1]: [], [1]: [] };
  for (const side of [-1, 1]) {
    if (lane.quay && side === lane.seaSide) continue; // the quay keeps its view of the water
    let s = 0.8 + rng() * 2.5;
    while (s < lane.length - 2.5) {
      const toEnd = Math.min(s, lane.length - s);
      if (rng() > 0.6 + 0.4 * smoothstep(0, 4, toEnd)) {
        s += 2 + rng() * 3;
        continue;
      }
      const wUnits = rng() < 0.12 ? 3.2 + rng() * 0.4 : 2.0 + rng() * 1.1;
      const len = wUnits * SCALE;
      if (s + len > lane.length - 0.8) break;
      const p = lanePoint(lane, s + len / 2);
      const nx = -p.tz * side;
      const nz = p.tx * side;
      const yaw = Math.atan2(-nx, -nz);
      const uphill = groundAt(p.x + nx * (lane.half + 7), p.z + nz * (lane.half + 7)) > p.level + 1.2;
      const jog = rng() * 0.5;
      let site = null;
      for (const dUnits of [3.1, 2.7, 2.3, 1.9]) {
        const depth = dUnits * SCALE;
        const off = lane.half + jog + depth / 2;
        const foot = footprint(p.x + nx * off, p.z + nz * off, yaw, len / 2, depth / 2);
        const fit = siteFits(foot, lane, lanes, piazzas, placed, p.level, uphill, { waterfront: village.waterfront, scale: SCALE });
        if (fit) {
          site = { foot, dUnits, cap: fit.cap };
          break;
        }
      }
      if (!site) {
        s += 1.2;
        continue;
      }
      const base = groundAt(p.x + nx * (lane.half + 0.25), p.z + nz * (lane.half + 0.25)) - 0.04;
      let floors = 2 + Math.floor(rng() * 2);
      if (lane.quay || (!lane.stair && Math.hypot(p.x - heart.x, p.z - heart.z) < village.r * 0.6)) floors += 1;
      if (floors >= 3 && rng() < 0.18) floors += 1;
      if (lane.stair) floors = Math.min(floors, 3);
      if (site.cap !== undefined) floors = Math.min(floors, site.cap);
      if (floors < 1) {
        s += 1.2;
        continue;
      }
      let low = base;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const c = corner(site.foot, sx, sz);
        low = Math.min(low, groundAt(c.x, c.z));
      }
      const plinth = Math.max(0, base - low + 0.5);
      if (plinth > 12) {
        s += 1.2;
        continue;
      }
      // On a stair the door is at the lower end of the front, where the steps reach it.
      let door = 0;
      if (lane.stair) {
        const rise = lanePoint(lane, Math.min(lane.length, s + len)).level - lanePoint(lane, s).level;
        door = -Math.sign((Math.cos(yaw) * p.tx - Math.sin(yaw) * p.tz) * rise) || 0;
      }
      parts.at(new THREE.Vector3(site.foot.x, base, site.foot.z), yaw, SCALE);
      house(parts, rng, wUnits, site.dUnits, floors, { plinth: plinth / SCALE, terrace: site.cap !== undefined, door });
      placed.push(site.foot);
      const g = gap(rng);
      covered[side].push([s - 0.3, s + len + (g < 1.2 ? g : 0) + 0.3]);
      if (uphill && g >= 1.4 && g < 3) alleySteps(parts, rng, lane, s + len + g / 2, side, g - 0.5, placed);
      else if (uphill && g >= 3) garden(parts, rng, lane, s + len + g / 2, side, g - 0.6, placed);
      s += len + g;
    }
  }
  return covered;
}

/**
 * Along the lane wherever no house stands: a parapet where the ground drops away, a retaining
 * wall where it rises, low walls beside the stairs. Street lamps, and strings of little lights
 * from one front to the one across the lane.
 */
function laneEdges(parts, rng, lane, covered, furniture) {
  const isCovered = (side, s) => covered[side].some(([a, b]) => s > a && s < b);
  let nextLamp = 4 + rng() * 5;
  let nextString = 7 + rng() * 6;
  for (let s = TREAD / 2; s < lane.length; s += TREAD) {
    const p = lanePoint(lane, s);
    const here = groundAt(p.x, p.z);
    for (const side of [-1, 1]) {
      if (isCovered(side, s)) continue;
      if (lane.quay && side === lane.seaSide) continue; // the quay has its own wall
      const nx = -p.tz * side;
      const nz = p.tx * side;
      const beyond = groundAt(p.x + nx * (lane.half + 2.8), p.z + nz * (lane.half + 2.8));
      parts.at(new THREE.Vector3(p.x + nx * (lane.half + 0.15), 0, p.z + nz * (lane.half + 0.15)), Math.atan2(p.tx, p.tz), 1);
      if (lane.stair) parts.add('box', 0, here + 0.3, 0, 0.3, 1.1, TREAD + 0.05, WALL_STONE);
      else if (beyond < here - 0.9) parts.add('box', 0, here + 0.4, 0, 0.36, 0.95, TREAD + 0.05, WALL_STONE);
      else if (beyond > here + 1.0) {
        const h = Math.min(3.2, beyond - here + 0.3);
        parts.add('box', 0, here + h / 2 - 0.1, 0, 0.4, h, TREAD + 0.05, WALL_STONE);
      }
    }
    if (lane.stair) continue;
    if (s > nextLamp && !lane.quay) {
      const side = lane.quay ? -lane.seaSide : rng() < 0.5 ? -1 : 1;
      const out = lane.half - 0.35;
      lantern(furniture, p.x - p.tz * side * out, here + 0.1, p.z + p.tx * side * out, { toward: [p.x, p.z] });
      nextLamp = s + 9 + rng() * 5;
    }
    if (s > nextString && isCovered(-1, s) && isCovered(1, s)) {
      const out = lane.half + 0.1;
      festoon(furniture, p.x - p.tz * out, here + 4.6, p.z + p.tx * out, p.x + p.tz * out, here + 4.6, p.z - p.tx * out, 0.5);
      nextString = s + 8 + rng() * 6;
    }
  }
}

/**
 * Where a lane stops short over a drop, with no stair or square going on from its end, a
 * parapet closes it, so that it ends at a wall to lean on rather than at the edge of a ledge.
 */
function laneEnds(parts, rng, lane, lanes, piazzas) {
  if (lane.stair || lane.quay) return;
  for (const [s, dir] of [[0, -1], [lane.length, 1]]) {
    const p = lanePoint(lane, s);
    const ahead = (d) => ({ x: p.x + p.tx * dir * d, z: p.z + p.tz * dir * d });
    const next = ahead(2.5);
    if (lanes.some((o) => o !== lane && laneAt(o, next.x, next.z).d < o.half + 0.3)) continue;
    if (piazzas.some((pz) => Math.hypot(next.x - pz.x, next.z - pz.z) < pz.r + 0.5)) continue;
    const far = ahead(3);
    const level = groundAt(p.x, p.z);
    if (groundAt(far.x, far.z) > level - 0.9) continue;
    const wall = ahead(0.2);
    parts.at(new THREE.Vector3(wall.x, 0, wall.z), Math.atan2(p.tx, p.tz), 1);
    parts.add('box', 0, level + 0.4, 0, lane.width + 0.7, 0.95, 0.36, WALL_STONE);
    parts.add('box', 0, level + 0.92, 0, lane.width + 0.8, 0.1, 0.46, pick(rng, PLINTH));
  }
}

/** The quay along the sea front: a wall of sandstone blocks standing in the water, a kerb, bollards, lamps, mussels at the waterline, boats hauled up on it. */
function quayWall(parts, rng, lane, furniture) {
  const sea = lane.seaSide;
  const edge = lane.half + lane.quay;
  let nextLamp = 3 + rng() * 4;
  let nextBollard = 2;
  for (let s = 1.0; s < lane.length - 1; s += 2.0) {
    const p = lanePoint(lane, s);
    const nx = -p.tz * sea;
    const nz = p.tx * sea;
    const here = groundAt(p.x, p.z);
    parts.at(new THREE.Vector3(p.x + nx * edge, 0, p.z + nz * edge), Math.atan2(p.tx, p.tz), 1);
    const bottom = WATER_LEVEL - 2.6;
    parts.add('box', 0, (here + 0.1 + bottom) / 2, 0, 0.9, here + 0.1 - bottom, 2.05, BLOCK[Math.round(s / 2) % 3]);
    parts.add('box', sea * 0.2, here + 0.17, 0, 1.3, 0.16, 2.05, 0xd8cdb7);
    for (let k = 0; k < 4; k++) parts.add('ball', -0.46, WATER_LEVEL - 0.2 + rng() * 0.6, (rng() - 0.5) * 1.8, 0.2, 0.3, 0.2, pick(rng, [0x23283c, 0x2f3550, 0x1b1f30]));
    if (s > nextBollard) {
      parts.add('cyl', sea * 0.35, here + 0.55, 0, 0.3, 0.8, 0.3, IRON);
      parts.add('ball', sea * 0.35, here + 0.98, 0, 0.36, 0.3, 0.36, IRON);
      nextBollard = s + 5 + rng() * 3;
    }
    if (s > nextLamp) {
      const q = parts.world(sea * 1.3, here + 0.1, 0);
      lantern(furniture, q.x, q.y, q.z, { toward: [p.x, p.z] });
      nextLamp = s + 9 + rng() * 5;
    }
  }
  // Two or three boats hauled up on the quay, lying over on their keels.
  for (const t of [0.12, 0.3, 0.86]) {
    if (rng() < 0.3) continue;
    const p = lanePoint(lane, lane.length * t);
    const out = lane.half + lane.quay * 0.45;
    const boat = at(gozzo(rng), p.x - p.tz * sea * out, groundAt(p.x, p.z) + 0.35, p.z + p.tx * sea * out, furniture);
    boat.rotation.y = Math.atan2(p.tx, p.tz) + (rng() - 0.5) * 0.3;
    boat.rotation.z = 0.22 * (rng() < 0.5 ? 1 : -1);
  }
}

/** A square: flagstones, the church with its campanile or a well, trees for shade, benches, lamps. */
function buildPiazza(parts, rng, pz, furniture, SCALE, placed) {
  const y = pz.level;
  for (let row = -Math.ceil(pz.r / 0.8); row <= Math.ceil(pz.r / 0.8); row++) {
    const z = row * 0.8;
    for (let col = -Math.ceil(pz.r / 1.1) - 1; col <= Math.ceil(pz.r / 1.1); col++) {
      const x = col * 1.1 + (row % 2 ? 0.55 : 0);
      if (Math.hypot(x, z) > pz.r - 0.4) continue;
      parts.at(new THREE.Vector3(pz.x + x, y, pz.z + z), 0, 1);
      parts.add('box', 0, 0.02, 0, 1.06, 0.24, 0.76, pick(rng, PAVING));
    }
  }
  // The square looks out toward the lowest ground: the sea. Its back is the hill.
  let view = 0;
  let lowest = Infinity;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const g = groundAt(pz.x + Math.sin(a) * (pz.r + 6), pz.z + Math.cos(a) * (pz.r + 6));
    if (g < lowest) {
      lowest = g;
      view = a;
    }
  }
  const dir = { x: Math.sin(view), z: Math.cos(view) };
  const perp = { x: Math.cos(view), z: -Math.sin(view) };
  const spot = (along, across) => ({ x: pz.x + dir.x * along + perp.x * across, z: pz.z + dir.z * along + perp.z * across });
  if (pz.church) {
    const nave = spot(-(pz.r - 0.8 + 5.6), 0.8);
    parts.at(new THREE.Vector3(nave.x, y - 0.3, nave.z), view, SCALE);
    church(parts, rng);
    const tower = parts.world(-3.6, 0, 1.6);
    parts.at(new THREE.Vector3(tower.x, y - 0.5, tower.z), view, SCALE * 0.85);
    campanile(parts, rng);
    // The church and its tower stand clear: no garden is terraced up against them.
    placed.push(footprint(nave.x, nave.z, view, 2.1 * SCALE + 1.2, 2.8 * SCALE + 1.2));
    placed.push(footprint(tower.x, tower.z, view, 1.3 * SCALE + 1.2, 1.3 * SCALE + 1.2));
    for (const side of [-1, 1]) {
      const tree = spot(-1.2, side * (pz.r - 2.3));
      planeTree(parts, rng, tree.x, y, tree.z, 1 + rng() * 0.2);
      const b = spot(0.8, side * (pz.r - 2.6));
      bench(parts, furniture, b.x, y + 0.12, b.z, view);
    }
    const f = spot(pz.r * 0.3, -1.8);
    fountain(parts, f.x, y, f.z);
  } else {
    if (pz.well) {
      const w = spot(-0.6, 1.2);
      well(parts, w.x, y, w.z, view + 0.4);
    }
    const tree = spot(-(pz.r - 1.6), -0.8);
    lemonTree(parts, rng, tree.x, y, tree.z);
    const b = spot(1.4, -1.8);
    bench(parts, furniture, b.x, y + 0.12, b.z, view);
    // A belvedere looks out over a parapet, with a second bench for the view.
    if (pz.belvedere) {
      const b2 = spot(1.6, 1.6);
      bench(parts, furniture, b2.x, y + 0.12, b2.z, view);
      for (let a = -1.1; a <= 1.1; a += 0.14) {
        const q = spot(Math.cos(a) * (pz.r - 0.3), Math.sin(a) * (pz.r - 0.3));
        parts.at(new THREE.Vector3(q.x, y, q.z), view - a, 1);
        parts.add('box', 0, 0.45, 0, 0.6, 0.9, 0.36, WALL_STONE);
      }
    }
  }
  for (const a of pz.church ? [0.7, -0.7, 2.4, -2.4] : [0.9, -2.3]) {
    const l = spot(Math.cos(a) * (pz.r - 0.9), Math.sin(a) * (pz.r - 0.9));
    lantern(furniture, l.x, y + 0.14, l.z, { toward: [pz.x, pz.z] });
  }
}

/**
 * Houses scattered beyond the lanes, each on its own terrace with its front downhill, so the
 * village frays out into the hillside instead of ending at a line.
 */
function outliers(parts, rng, village, lanes, piazzas, placed, SCALE, count) {
  for (let i = 0, n = 0; i < count * 40 && n < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = (0.3 + rng() * 0.85) * village.r;
    const u = village.u + Math.cos(a) * r * (village.up ?? 1);
    const v = village.v + Math.sin(a) * r;
    const x = toX(u, v);
    const z = toZ(u, v);
    if (!isWild(x, z, 1.5) || slopeAt(x, z) > 1.3) continue;
    const gx = groundAt(x + 1.5, z) - groundAt(x - 1.5, z);
    const gz = groundAt(x, z + 1.5) - groundAt(x, z - 1.5);
    const yaw = Math.atan2(-gx, -gz) + (rng() - 0.5) * 0.8;
    const wUnits = 1.9 + rng() * 1.3;
    const dUnits = 2.2 + rng() * 0.8;
    const foot = footprint(x, z, yaw, (wUnits * SCALE) / 2, (dUnits * SCALE) / 2);
    if (!siteFits(foot, null, lanes, piazzas, placed, groundAt(x, z), false, { slack: -1.6, clearance: 10, scale: SCALE })) continue;
    const front = corner(foot, 0, 1);
    const base = groundAt(front.x, front.z) - 0.1;
    let low = base;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [1, 0], [-1, 0]]) {
      const c = corner(foot, sx, sz);
      low = Math.min(low, groundAt(c.x, c.z));
    }
    const plinth = Math.max(0, base - low + 0.5);
    if (plinth > 6) continue;
    parts.at(new THREE.Vector3(x, base, z), yaw, SCALE);
    house(parts, rng, wUnits, dUnits, 1 + Math.floor(rng() * 2) + (rng() < 0.3 ? 1 : 0), { plinth: plinth / SCALE });
    placed.push(foot);
    n++;
  }
}

// What a terrace is planted with, and how likely: a kitchen garden, a patch of meadow, a few
// rows of vines, lemon trees.
const PLOTS = [['orto', 0.4], ['prato', 0.25], ['vigna', 0.2], ['limoni', 0.15]];
const PLOT_GROUND = { orto: [0x8a6a4c, 0x7e5f44], prato: [0x86b060, 0x7aa85a], vigna: [0x93a862, 0x8a9c5c], limoni: [0x7f9e58, 0x86a45e] };
const GREENS = [0x5f9a4c, 0x76a856, 0x4f8a48, 0x8ab85e];

/**
 * The hillside between the lanes, wherever no house, stair or square stands, is worked as it
 * is above every Ligurian harbour: narrow terraces held up by dry-stone walls, each with its
 * kitchen garden, its few vines or lemon trees or its patch of meadow. They are laid on a grid
 * along the shore, each cell raised to the next course above the ground it covers, so cells
 * at the same height run together into one shelf and a wall stands wherever the shelf steps
 * down. They are gardens, not ways: nobody walks over them.
 */
function orti(parts, rng, village, lanes, piazzas, placed) {
  const C = 1.25;
  const STEP = 1.8;
  const YAW = Math.PI / 4; // local x runs along the shore (v), local -z up the hill (u)
  const up = village.up ?? 1;
  const reach = village.r + 4;
  // How far (x, z) lies outside the paving of the nearest lane, and that lane's level there.
  const street = (x, z) => {
    let best = { d: Infinity, level: 0 };
    for (const lane of lanes) {
      const q = laneAt(lane, x, z);
      const d = q.d - lane.half - (lane.quay && q.side === lane.seaSide ? lane.quay : 0);
      if (d < best.d) best = { d, level: q.level };
    }
    return best;
  };
  const cells = new Map();
  for (let i = -Math.ceil((reach * up) / C); i <= Math.ceil((reach * up) / C); i++) {
    for (let j = -Math.ceil(reach / C); j <= Math.ceil(reach / C); j++) {
      const u = village.u + i * C;
      const v = village.v + j * C;
      if (Math.hypot((u - village.u) / up, v - village.v) > reach) continue;
      const x = toX(u, v);
      const z = toZ(u, v);
      const foot = footprint(x, z, YAW, C / 2, C / 2);
      if (placed.some((f) => Math.abs(f.x - x) < 9 && Math.abs(f.z - z) < 9 && overlap(foot, f, 0.05))) continue;
      let lo = Infinity;
      let hi = -Infinity;
      let lane = { d: Infinity };
      let free = true;
      for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = { x: toX(u + (a * C) / 2, v + (b * C) / 2), z: toZ(u + (a * C) / 2, v + (b * C) / 2) };
        const g = groundAt(p.x, p.z);
        const near = street(p.x, p.z);
        if (!inSquare(p.x, p.z, 3) || g < WATER_LEVEL + 1.2 || near.d < 0.3) free = false;
        else if (ZONES.some((zn) => Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r + 3)) free = false;
        else if (PATHS.some((path) => segmentDistance(p.x, p.z, path) < 2.2)) free = false;
        else if (piazzas.some((pz) => Math.hypot(p.x - pz.x, p.z - pz.z) < pz.r + 0.3)) free = false;
        else if (CLEARINGS.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r)) free = false;
        if (!free) break;
        if (near.d < lane.d) lane = near;
        lo = Math.min(lo, g);
        hi = Math.max(hi, g);
      }
      // Only the slopes in among the lanes: beyond, the hillside is the vineyards' and the wild's.
      if (!free || lane.d > 11) continue;
      let top = Math.ceil((hi + 0.15) / STEP) * STEP;
      // Just under a lane the garden comes up no higher than a parapet beside it.
      if (lane.d < 2.5 && top > lane.level + 0.5) top = Math.max(hi + 0.1, lane.level + 0.5);
      cells.set(`${i},${j}`, { i, j, x, z, top, lo });
    }
  }
  // A terrace is a shelf: a cell with no neighbour at its own height would be one step of a
  // stone staircase climbing the slope, and a run of them reads as a chimney.
  for (const [key, c] of [...cells]) {
    const level = (k) => cells.get(k)?.top;
    const shelf = [`${c.i + 1},${c.j}`, `${c.i - 1},${c.j}`, `${c.i},${c.j + 1}`, `${c.i},${c.j - 1}`].some((k) => Math.abs((level(k) ?? -1e3) - c.top) < 0.05);
    if (!shelf) cells.delete(key);
  }
  // A cell or two caught alone between the houses would stand up as a pillar: a garden
  // takes a few cells together or none.
  const seen = new Set();
  for (const start of [...cells.keys()]) {
    if (seen.has(start)) continue;
    const group = [start];
    seen.add(start);
    for (let k = 0; k < group.length; k++) {
      const { i, j } = cells.get(group[k]);
      for (const key of [`${i + 1},${j}`, `${i - 1},${j}`, `${i},${j + 1}`, `${i},${j - 1}`]) {
        if (cells.has(key) && !seen.has(key)) {
          seen.add(key);
          group.push(key);
        }
      }
    }
    if (group.length < 4) for (const key of group) cells.delete(key);
  }

  const plots = new Map();
  const plotOf = (i, j) => {
    const key = `${Math.floor(i / 3)},${Math.floor((j + (Math.floor(i / 3) % 2) * 2) / 4)}`;
    if (!plots.has(key)) {
      let r = rng();
      const kind = PLOTS.find(([, p]) => (r -= p) < 0)?.[0] ?? 'prato';
      plots.set(key, { kind, ground: pick(rng, PLOT_GROUND[kind]) });
    }
    return plots.get(key);
  };
  // Each edge of a cell: the neighbour across it, where the edge lies, and the strip along it.
  const EDGES = [
    [1, 0, 0, -C / 2, C, 0.24],
    [-1, 0, 0, C / 2, C, 0.24],
    [0, 1, C / 2, 0, 0.24, C],
    [0, -1, -C / 2, 0, 0.24, C],
  ];
  for (const c of cells.values()) {
    const { i, j, top } = c;
    const bottom = c.lo - 0.5;
    const plot = plotOf(i, j);
    parts.at(new THREE.Vector3(c.x, 0, c.z), YAW, 1);
    parts.add('drystone', 0, (top + bottom) / 2, 0, C + 0.02, top - bottom, C + 0.02, pick(rng, DRYSTONE));
    parts.add('box', 0, top + 0.03, 0, C + 0.02, 0.06, C + 0.02, plot.ground);
    occupy(c.x, c.z, YAW, C / 2, C / 2, top);
    // Where the shelf steps down, a coping of flat stones along the top of the wall, capers
    // and ivy spilling over it.
    for (const [di, dj, ex, ez, sx, sz] of EDGES) {
      const next = cells.get(`${i + di},${j + dj}`);
      if (next && next.top > top - 0.3) continue;
      parts.add('box', ex, top + 0.07, ez, sx, 0.1, sz, 0xd3c8b2);
      if (rng() < 0.22) {
        const along = (rng() - 0.5) * (C - 0.4);
        parts.add('leaf', ex + (sx > sz ? along : 0), top - 0.25, ez + (sx > sz ? 0 : along), 0.55, 0.7, 0.55, pick(rng, [0x4f8a52, 0x5f9a58, 0x46784c]));
      }
    }
    // What grows on the shelf.
    const y = top + 0.06;
    if (plot.kind === 'orto') {
      for (const rz of [-0.3, 0.3]) {
        if (rng() < 0.2) {
          // Tomatoes tied up to canes.
          for (const rx of [-0.4, 0, 0.4]) {
            parts.add('cyl', rx, y + 0.45, rz, 0.04, 0.9, 0.04, WOOD);
            parts.add('leaf', rx, y + 0.5, rz, 0.3, 0.7, 0.3, 0x5a9050);
            parts.add('ball', rx + 0.08, y + 0.45, rz + 0.08, 0.12, 0.12, 0.12, 0xd9483a);
          }
        } else {
          const green = pick(rng, GREENS);
          for (const rx of [-0.4, 0, 0.4]) parts.add('leaf', rx, y + 0.12, rz, 0.34, 0.26, 0.3, green);
        }
      }
    } else if (plot.kind === 'prato') {
      if (rng() < 0.35) parts.add('ball', (rng() - 0.5) * 0.8, y + 0.08, (rng() - 0.5) * 0.8, 0.22, 0.14, 0.22, pick(rng, [0xfbf6e4, 0xf6d24a, 0xa890d8]));
      if (rng() < 0.12) parts.add('leaf', (rng() - 0.5) * 0.5, y + 0.4, (rng() - 0.5) * 0.5, 0.9, 0.8, 0.9, pick(rng, [0x5a9050, 0x4f8456]));
    } else if (plot.kind === 'vigna') {
      parts.add('vine', 0, y + 0.55, 0, C, 0.95, 0.5, pick(rng, [0x6a9e5e, 0x66a070, 0x82b06a]));
      if ((i + j) % 2 === 0) parts.add('cyl', C / 2 - 0.05, y + 0.6, 0, 0.06, 1.2, 0.06, WOOD);
      if (rng() < 0.3) parts.add('ball', (rng() - 0.5) * 0.8, y + 0.4, 0.28, 0.14, 0.14, 0.14, 0x6d4a8f);
    } else if ((i * 7 + j * 3) % 5 === 0) {
      lemonTree(parts, rng, c.x, y - 0.2, c.z);
    } else if (rng() < 0.5) {
      parts.add('leaf', 0, y + 0.35, 0, 0.8, 0.7, 0.8, pick(rng, [0x357a44, 0x4f9a50]));
    }
  }
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
  const furniture = new THREE.Group();
  // The houses are drawn in their own units and set in the world at the avatar's scale: his
  // head fills a window, a door stands a head taller than him, a house is two or three of him
  // across, as a Ligurian house is to the people who live in it.
  const SCALE = 2.0;
  const { lanes, piazzas } = villagePlan();
  for (const village of VILLAGES) {
    const streets = lanes.filter((l) => l.village === village);
    const squares = piazzas.filter((p) => p.village === village);
    for (const lane of streets) paveLane(parts, rng, lane, squares);
    const covered = new Map();
    for (const lane of streets) covered.set(lane, houseRows(parts, rng, lane, streets, squares, placed, village, SCALE));
    for (const lane of streets) {
      laneEdges(parts, rng, lane, covered.get(lane), furniture);
      laneEnds(parts, rng, lane, streets, squares);
      if (lane.quay) quayWall(parts, rng, lane, furniture);
    }
    for (const pz of squares) buildPiazza(parts, rng, pz, furniture, SCALE, placed);
    outliers(parts, rng, village, streets, squares, placed, SCALE, village.r > 20 ? 70 : 6);
    // The hamlet on the headland keeps its hillside as it is.
    if (village.waterfront) orti(parts, rng, village, streets, squares, placed);
  }

  // Vineyards: rows of vines on posts, following the terraces.
  for (let v = SQUARE.v0; v < SQUARE.v1; v += 0.95) {
    for (let u = 40; u < SQUARE.u1; u += 1.6) {
      const x = toX(u, v);
      const z = toZ(u, v);
      // Vines grow wherever the mountain has been terraced for them.
      if (u < footU(v) + 1 || cultivated(u, v) < 0.6) continue;
      if (estateWeight(u, v) > 0.25 || bankAt(x, z) > 0.3) continue; // the estate and the bank plant their own rows
      if (slopeAt(x, z) > 0.3 || !isWild(x, z, -1)) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 3 * SCALE)) continue;
      parts.at(new THREE.Vector3(x, groundAt(x, z), z), Math.PI / 4);
      parts.add('vine', 0, 0.55, 0, 0.85, 0.95 + rng() * 0.3, 0.6, pick(rng, [0x6a9e5e, 0x66a070, 0x82b06a, 0x8ab464]));
      if (Math.round(v / 0.95) % 3 === 0) parts.add('cyl', 0.55, 0.6, 0, 0.06, 1.2, 0.06, WOOD);
      if (rng() < 0.2) parts.add('ball', 0.2, 0.45, 0.3, 0.14, 0.14, 0.14, 0x6d4a8f);
    }
  }

  parts.build(scene);
  scene.add(bake(furniture));
  buildSmoke(scene, rng, parts.chimneys, animated);
}

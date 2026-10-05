// Cinque Terre villages seen through Mœbius: pastel tower houses stacked on the terraces,
// with framed windows, shutters, balconies, laundry, slate roofs, roof terraces and domes.
// Every part is a unit shape instanced with its own matrix and colour: thousands of details,
// a handful of draw calls.
import * as THREE from 'three';
import { fbm, pick } from './noise.js';
import { PAL, paint } from './style.js';
import { footU, groundAt, isWild, slopeAt, toX, toZ, UP } from './terrain.js';

const SHAPES = {
  box: new THREE.BoxGeometry(1, 1, 1),
  pyramid: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  dome: new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  ball: new THREE.SphereGeometry(0.5, 8, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  // Half disc standing in the XY plane, flat side down (fanlights, arched openings).
  arch: new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2),
};
const FLAT = new Set(['pyramid', 'cone']);

const WALLS = [PAL.ochre, PAL.rose, PAL.coral, PAL.saffron, PAL.peach, 0xf2c79a, 0xe58f6b, PAL.pink, 0xf5e1b8, 0xf0a97a];
const TRIM = [PAL.ivory, PAL.cream, 0xf7e9cf];
const SHUTTER = [0x3f8f5a, 0x4a9a6a, 0x3f7f8f, 0x5f8f4a];
const GLASS = 0x3b3346;
const SLATE = 0x8a86a0;
const TILE = 0xc8643c;
const WOOD = 0x8a5a41;
const STONE = 0xd9cbb5;

/** Collects instanced parts, positioned in the local frame of the current building. */
class Parts {
  constructor() {
    this.lists = new Map(Object.keys(SHAPES).map((k) => [k, []]));
    this.frame = new THREE.Matrix4();
    this._local = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  at(position, yaw) {
    this.frame.compose(position, new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1));
  }

  add(shape, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
    this._q.setFromEuler(this._e.set(rx, ry, rz));
    this._local.compose(new THREE.Vector3(x, y, z), this._q, new THREE.Vector3(sx, sy, sz));
    this.lists.get(shape).push({ m: this.frame.clone().multiply(this._local), c: color });
  }

  /** Adds a part on a face: `face` 0 = front (+z), 1 = right (+x), 2 = left (-x), 3 = back (-z). */
  onFace(face, w, d, shape, across, y, out, sx, sy, sz, color) {
    const [x, z, ry] = [
      [across, d / 2 + out, 0],
      [w / 2 + out, -across, Math.PI / 2],
      [-w / 2 - out, across, -Math.PI / 2],
      [-across, -d / 2 - out, Math.PI],
    ][face];
    this.add(shape, x, y, z, sx, sy, sz, color, 0, ry);
  }

  build(scene) {
    const c = new THREE.Color();
    for (const [shape, items] of this.lists) {
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(SHAPES[shape], paint(0xffffff, { flat: FLAT.has(shape) }), items.length);
      items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, c.setHex(it.c));
      });
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    }
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
  if (rng() < 0.3) {
    parts.onFace(face, w, d, 'box', across, y - 0.6, 0.18, 0.56, 0.16, 0.2, TILE);
    for (let k = -1; k <= 1; k++) parts.onFace(face, w, d, 'ball', across + k * 0.17, y - 0.46, 0.2, 0.17, 0.17, 0.17, pick(rng, [PAL.pink, PAL.red, PAL.grassDeep, PAL.coral]));
  }
}

function house(parts, rng, w, d, floors) {
  const H = 1.2 + floors * 1.7;
  const wall = pick(rng, WALLS);
  parts.trim = pick(rng, TRIM);
  parts.shutter = pick(rng, SHUTTER);
  parts.add('box', 0, H / 2, 0, w, H, d, wall);
  parts.add('box', 0, 0.6, 0, w + 0.12, 1.2, d + 0.12, STONE);
  for (let f = 1; f < floors; f++) parts.add('box', 0, 1.2 + f * 1.7 - 0.1, 0, w + 0.1, 0.12, d + 0.1, parts.trim);
  parts.add('box', 0, H + 0.09, 0, w + 0.26, 0.18, d + 0.26, parts.trim);

  // Door with its step and fanlight.
  const doorX = (rng() - 0.5) * (w - 1.2);
  parts.onFace(0, w, d, 'box', doorX, 0.95, 0.03, 0.95, 1.65, 0.05, parts.trim);
  parts.onFace(0, w, d, 'box', doorX, 0.85, 0.05, 0.72, 1.45, 0.05, pick(rng, [WOOD, 0x3f7f8f, 0x6d4a6f]));
  parts.onFace(0, w, d, 'arch', doorX, 1.58, 0.04, 0.72, 0.72, 0.05, GLASS);
  parts.onFace(0, w, d, 'box', doorX, 0.08, 0.2, 1.1, 0.16, 0.42, STONE);

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
    for (const s of [-1, 1]) parts.add('ball', s * (bw / 2 - 0.25), y + 0.25, d / 2 + 0.45, 0.32, 0.32, 0.32, pick(rng, [PAL.grassDeep, PAL.pink, PAL.red]));
    if (rng() < 0.45) {
      parts.add('box', 0, y + 1.25, d / 2 + 0.7, bw, 0.02, 0.02, 0xd8d4e0);
      for (let k = 0; k < 3; k++) parts.add('box', -bw / 3 + (k * bw) / 3, y + 1.0, d / 2 + 0.7, 0.36, 0.48, 0.03, pick(rng, [PAL.ivory, PAL.blue, PAL.coral, PAL.saffron, PAL.teal]));
    }
  }

  // Roof: slate pyramid, roof terrace, or a Mœbius dome.
  const roof = rng();
  if (roof < 0.5) {
    const color = rng() < 0.6 ? SLATE : TILE;
    parts.add('pyramid', 0, H + 0.18 + 0.55, 0, w + 0.45, 1.1, d + 0.45, color);
    parts.add('box', w * 0.25, H + 0.9, -d * 0.2, 0.36, 1.2, 0.36, wall);
    parts.add('box', w * 0.25, H + 1.55, -d * 0.2, 0.52, 0.1, 0.52, parts.trim);
  } else if (roof < 0.78) {
    for (const [x, z, sx, sz] of [[0, d / 2, w, 0.12], [0, -d / 2, w, 0.12], [w / 2, 0, 0.12, d], [-w / 2, 0, 0.12, d]]) parts.add('box', x, H + 0.4, z, sx + 0.1, 0.45, sz + 0.1, parts.trim);
    if (rng() < 0.5) {
      parts.add('cyl', -w * 0.2, H + 1.2, 0, 0.06, 1.9, 0.06, 0x3b3346);
      parts.add('cone', -w * 0.2, H + 2.1, 0, 2.2, 0.55, 2.2, pick(rng, [PAL.coral, PAL.teal, PAL.saffron]));
    } else {
      parts.add('cyl', w * 0.2, H + 0.7, -d * 0.15, 0.9, 1.0, 0.9, PAL.ivory);
      parts.add('dome', w * 0.2, H + 1.2, -d * 0.15, 0.9, 0.5, 0.9, PAL.ivory);
    }
    for (let k = 0; k < 3; k++) parts.add('ball', (rng() - 0.5) * (w - 0.8), H + 0.45, (rng() - 0.5) * (d - 0.8), 0.5, 0.45, 0.5, pick(rng, [PAL.grassDeep, PAL.grass, PAL.pink]));
  } else {
    const r = Math.min(w, d) * 0.8;
    parts.add('cyl', 0, H + 0.4, 0, r, 0.5, r, parts.trim);
    parts.add('dome', 0, H + 0.62, 0, r, r * 1.2, r, pick(rng, [PAL.teal, PAL.ivory, PAL.coral, PAL.lilac]));
    parts.add('cyl', 0, H + 0.62 + r * 0.6 + 0.2, 0, 0.12, 0.4, 0.12, parts.trim);
    parts.add('cone', 0, H + 0.62 + r * 0.6 + 0.6, 0, 0.28, 0.6, 0.28, PAL.saffron);
    parts.add('ball', 0, H + 0.62 + r * 0.6 + 0.95, 0, 0.16, 0.16, 0.16, PAL.saffron);
  }

  // Antennas and dishes: the techno side of the valley.
  if (rng() < 0.22) {
    parts.add('cyl', -w * 0.3, H + 1.2, d * 0.25, 0.05, 2.2, 0.05, 0x3b3346);
    parts.add('dome', -w * 0.3, H + 1.9, d * 0.25, 0.9, 0.25, 0.9, PAL.ivory, -0.7, 0, 0.3);
    parts.add('ball', -w * 0.3, H + 2.35, d * 0.25, 0.12, 0.12, 0.12, PAL.red);
  }
  return H;
}

function campanile(parts, rng) {
  const color = pick(rng, [PAL.cream, PAL.peach, PAL.ochre]);
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
  if (rng() < 0.5) {
    parts.add('pyramid', 0, 15.4, 0, 2.6, 2.4, 2.6, SLATE);
  } else {
    // An onion dome: the Mœbius touch on a Ligurian bell tower.
    parts.add('cyl', 0, 14.6, 0, 1.9, 0.6, 1.9, trim);
    parts.add('ball', 0, 15.7, 0, 2.1, 2.5, 2.1, PAL.teal);
    parts.add('cone', 0, 17.4, 0, 0.7, 1.4, 0.7, PAL.teal);
  }
  parts.add('ball', 0, 18.3, 0, 0.3, 0.3, 0.3, PAL.saffron);
}

export function buildVillages(scene, rng) {
  const parts = new Parts();
  const placed = [];
  const yaw = Math.PI / 4;

  // Houses packed in rows along the terraces, as in Manarola: a main village around its
  // campanile at the foot of the mountain, and a hamlet clinging to the right-hand headland.
  const bell = { v: 12, u: footU(12) + 12 };
  const villages = [
    { v0: -14, v1: 36, u0: (v) => footU(v) + 2, u1: (v) => footU(v) + 28 },
    { v0: 72, v1: 96, u0: () => -62, u1: () => -28 },
  ];
  for (const village of villages) {
    for (let v = village.v0; v <= village.v1; v += 3.5) {
      for (let u = village.u0(v); u <= village.u1(v); u += 3.3) {
        const jv = v + (rng() - 0.5) * 0.4;
        const ju = u + (rng() - 0.5) * 0.3;
        const x = toX(ju, jv);
        const z = toZ(ju, jv);
        if (rng() < 0.08 || Math.hypot(ju - bell.u, jv - bell.v) < 3.5) continue;
        if (!isWild(x, z, -2) || slopeAt(x, z) > 1.7 || groundAt(x, z) < 1) continue;
        placed.push([x, z]);
        parts.at(new THREE.Vector3(x, groundAt(x, z) - 1.4, z), yaw);
        house(parts, rng, 2.8 + rng() * 0.6, 2.6 + rng() * 0.5, 2 + Math.floor(rng() * 3));
      }
    }
  }

  {
    const x = toX(bell.u, bell.v);
    const z = toZ(bell.u, bell.v);
    parts.at(new THREE.Vector3(x, groundAt(x, z) - 0.5, z), yaw);
    campanile(parts, rng);
    placed.push([x, z]);
  }

  // Vineyards: rows of vines on posts, following the terraces.
  for (let v = -110; v < 110; v += 0.95) {
    for (let u = 40; u < 150; u += 1.6) {
      const x = toX(u, v);
      const z = toZ(u, v);
      if (u < footU(v) + 1 || fbm(v * 0.03 + 5, u * 0.03, 2) < 0.36) continue;
      if (slopeAt(x, z) > 0.3 || !isWild(x, z, -1)) continue;
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 3)) continue;
      parts.at(new THREE.Vector3(x, groundAt(x, z), z), yaw);
      parts.add('ball', 0, 0.55, 0, 0.85, 0.95 + rng() * 0.3, 0.6, pick(rng, [PAL.grassDeep, 0x5f9c6a, PAL.grass, 0x7fae5a]));
      if (Math.round(v / 0.95) % 3 === 0) parts.add('cyl', 0.55, 0.6, 0, 0.06, 1.2, 0.06, WOOD);
      if (rng() < 0.2) parts.add('ball', 0.2, 0.45, 0.3, 0.14, 0.14, 0.14, 0x6d4a8f);
    }
  }

  parts.build(scene);
}

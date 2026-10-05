// The wine estate: a Florentine villa with its belvedere tower, loggia and garden terrace,
// standing among vineyards trained on posts and wires along irregular dry-stone terraces.
import * as THREE from 'three';
import { pick } from './noise.js';
import { paint, solid } from './style.js';
import { INK, at, bake, ball, box, cyl } from './kit.js';
import { cypress, lemonTree } from './nature.js';
import { UP, VILLA, estateWeight, groundAt, isWild, slopeAt, toX, toZ } from './terrain.js';

const STUCCO = 0xe9c98c;
const SERENA = 0xb3aa9c; // pietra serena, the grey stone of Florentine trim
const TILE = [0xb8623e, 0xc4704a, 0xa8563a];
const SHUTTER = 0x4d6a4c;
const GLASS = 0x33303f;
const GRAVEL = 0xdccba4;
const VINE = [0x5f8a45, 0x6c964c, 0x548040, 0x7a9c50, 0x8fa24e];

/** Hipped roof of terracotta tiles: four slopes meeting on a ridge (a point on a square plan). */
function hipRoof(w, d, h, color) {
  const r = Math.max(0, (w - d) / 2);
  const hw = w / 2;
  const hd = d / 2;
  const A = [-hw, 0, hd];
  const B = [hw, 0, hd];
  const C = [hw, 0, -hd];
  const D = [-hw, 0, -hd];
  const E = [-r, h, 0];
  const F = [r, h, 0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([A, B, F, A, F, E, B, C, F, C, D, E, C, E, F, D, A, E].flat(), 3));
  geo.computeVertexNormals();
  return solid(geo, paint(color, { flat: true }));
}

/** A window in a wall-local frame (x across, y up, z out): stone surround, sill, glass, shutters. */
function windowAt(wall, x, y, w = 0.7, h = 1.25, arched = false) {
  at(box(w + 0.3, h + 0.3, 0.1, SERENA), x, y, 0.02, wall);
  at(box(w + 0.5, 0.12, 0.22, SERENA), x, y - h / 2 - 0.16, 0.08, wall);
  at(box(w + 0.5, 0.14, 0.2, SERENA), x, y + h / 2 + 0.2, 0.07, wall);
  at(box(w, h, 0.1, GLASS), x, y, 0.05, wall);
  if (arched) {
    const fan = at(cyl(w / 2 + 0.15, w / 2 + 0.15, 0.1, SERENA, 10, undefined), x, y + h / 2 + 0.12, 0.02, wall);
    fan.rotation.x = Math.PI / 2;
    at(cyl(w / 2, w / 2, 0.12, GLASS, 10), x, y + h / 2 + 0.1, 0.04, wall).rotation.x = Math.PI / 2;
  } else {
    for (const s of [-1, 1]) at(box(w / 2, h, 0.06, SHUTTER), x + s * (w * 0.75 + 0.02), y, 0.06, wall);
  }
}

/** One arch of the loggia: a dark bay under a round stone arch. */
function archAt(wall, x, w, h) {
  at(box(w, h, 0.5, GLASS), x, h / 2, -0.2, wall);
  at(cyl(w / 2, w / 2, 0.5, GLASS, 12), x, h, -0.2, wall).rotation.x = Math.PI / 2;
  const arch = at(solid(new THREE.TorusGeometry(w / 2 + 0.08, 0.12, 4, 12, Math.PI), paint(SERENA)), x, h, 0.06, wall);
  arch.scale.z = 1.4;
}

function buildVilla(rng) {
  // Local frame: +z faces the sea, +x runs along the slope.
  const g = new THREE.Group();
  const W = 11;
  const D = 6.6;
  const FLOOR = 2.5;
  const H = FLOOR * 2 + 0.5;
  const Z0 = -2; // the house sits back, leaving a terrace in front

  // Gravel court and the garden terrace on its retaining wall.
  at(cyl(VILLA.r + 0.6, VILLA.r + 0.6, 0.12, GRAVEL, 28), 0, 0.02, 0, g);
  const house = at(new THREE.Group(), 0, 0.08, Z0, g);

  // Body: rusticated base, stucco walls, string course, deep eaves, hipped tile roof.
  at(box(W, H, D, STUCCO), 0, H / 2, 0, house);
  at(box(W + 0.16, 0.7, D + 0.16, SERENA), 0, 0.35, 0, house);
  at(box(W + 0.14, 0.16, D + 0.14, SERENA), 0, FLOOR + 0.3, 0, house);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // Quoins at the corners.
    for (let y = 0.9; y < H - 0.2; y += 0.55) at(box(0.34, 0.3, 0.34, SERENA), sx * (W / 2 - 0.1), y, sz * (D / 2 - 0.1), house);
  }
  at(box(W + 1.0, 0.18, D + 1.0, 0x8a6a52), 0, H + 0.09, 0, house);
  at(hipRoof(W + 1.3, D + 1.3, 1.5, TILE[0]), 0, H + 0.18, 0, house);
  // Tile courses: darker ridges along the slopes.
  at(box(W - D + 0.4, 0.14, 0.3, TILE[2]), 0, H + 1.7, 0, house);

  // Belvedere tower rising through the roof, open under its own little roof.
  const T = 3.2;
  const TH = H + 3.1;
  at(box(T, TH, T, STUCCO), 0, TH / 2, -0.4, house);
  at(box(T + 0.14, 0.16, T + 0.14, SERENA), 0, H + 1.5, -0.4, house);
  at(box(T + 0.8, 0.16, T + 0.8, 0x8a6a52), 0, TH + 0.08, -0.4, house);
  at(hipRoof(T + 1.0, T + 1.0, 1.0, TILE[1]), 0, TH + 0.16, -0.4, house);
  at(cyl(0.03, 0.03, 0.9, INK, 3), 0, TH + 1.5, -0.4, house);

  // Walls, each in its own frame with +z pointing out.
  const wall = (x, z, yaw) => {
    const w = at(new THREE.Group(), x, 0, z, house);
    w.rotation.y = yaw;
    return w;
  };
  const front = wall(0, D / 2, 0);
  const back = wall(0, -D / 2, Math.PI);
  const sides = [wall(W / 2, 0, Math.PI / 2), wall(-W / 2, 0, -Math.PI / 2)];

  // Front: a three-arched loggia between two windows, five tall windows on the piano nobile.
  for (const k of [-1, 0, 1]) archAt(front, k * 1.7, 1.25, 1.55);
  for (const k of [-1.5, -0.5, 0.5, 1.5]) at(cyl(0.11, 0.13, 1.55, SERENA, 8), k * 1.7, 0.78, 0.12, front);
  for (const x of [-4.2, 4.2]) windowAt(front, x, 1.45);
  for (const x of [-4.2, -2.1, 0, 2.1, 4.2]) windowAt(front, x, FLOOR + 1.55, 0.7, 1.4);
  for (const w of [...sides, back]) {
    for (const x of [-1.8, 0, 1.8]) {
      windowAt(w, x, 1.45);
      windowAt(w, x, FLOOR + 1.55, 0.7, 1.4);
    }
  }
  for (const x of [-3.9, 3.9]) for (const y of [1.45, FLOOR + 1.55]) windowAt(back, x, y);
  // Tower: an arched opening on every side.
  for (const [x, z, yaw] of [[0, T / 2 - 0.4, 0], [0, -T / 2 - 0.4, Math.PI], [T / 2, -0.4, Math.PI / 2], [-T / 2, -0.4, -Math.PI / 2]]) {
    const w = wall(x, z, yaw);
    windowAt(w, 0, H + 2.1, 0.8, 0.9, true);
  }
  // Chimneys.
  for (const x of [-3.6, 3.8]) {
    at(box(0.5, 1.5, 0.5, STUCCO), x, H + 1.2, -1.2, house);
    at(hipRoof(0.8, 0.8, 0.3, TILE[2]), x, H + 1.95, -1.2, house);
  }

  // Garden terrace toward the sea: balustrade, steps, lemon trees in terracotta pots.
  const edge = 6.4;
  for (let x = -7.5; x <= 7.5; x += 0.5) {
    if (Math.abs(x) < 1) continue;
    at(cyl(0.07, 0.1, 0.55, SERENA, 5), x, 0.4, edge, g);
  }
  for (const s of [-1, 1]) {
    at(box(6.6, 0.14, 0.3, SERENA), s * 4.25, 0.72, edge, g);
    at(box(6.6, 0.16, 0.34, SERENA), s * 4.25, 0.12, edge, g);
    for (const x of [1, 7.5]) {
      at(box(0.4, 0.95, 0.4, SERENA), s * x, 0.5, edge, g);
      at(ball(0.2, SERENA, {}, 6, 4), s * x, 1.12, edge, g);
    }
  }
  for (let k = 0; k < 4; k++) at(box(2.0, 0.18, 0.5, SERENA), 0, -0.1 - k * 0.2, edge + 0.3 + k * 0.5, g);
  for (const x of [-6, -3.2, 3.2, 6]) {
    at(cyl(0.42, 0.3, 0.6, 0xb8623e, 8), x, 0.4, 4.6, g);
    const tree = at(lemonTree(rng), x, 0.55, 4.6, g);
    tree.scale.setScalar(0.62);
  }
  // Clipped box parterres either side of the path to the loggia.
  for (const s of [-1, 1]) {
    for (const [x, z, w, d] of [[3.6, 2.6, 3.4, 0.4], [3.6, 0.9, 3.4, 0.4], [2.1, 1.75, 0.4, 1.3], [5.1, 1.75, 0.4, 1.3]]) at(box(w, 0.45, d, 0x3f6a42), s * x, 0.32, z + 0.6, g);
    at(ball(0.42, 0x4a7648, { flat: true }, 6, 4), s * 3.6, 0.55, 2.35, g);
  }
  // A small fountain on the axis.
  at(cyl(0.9, 1.0, 0.4, SERENA, 12), 0, 0.28, 4.4, g);
  at(cyl(0.75, 0.75, 0.05, 0x8fd0d8, 12, { glow: true }), 0, 0.47, 4.4, g);
  at(cyl(0.1, 0.14, 0.8, SERENA, 6), 0, 0.7, 4.4, g);
  at(cyl(0.34, 0.12, 0.14, SERENA, 8), 0, 1.15, 4.4, g);

  // Cypresses framing the house, and the cellar's barrels by the side door.
  for (const [x, z] of [[-7.2, -1], [7.2, -1], [-7.4, 2.2], [7.4, 2.2], [-6.2, -5.2], [6.2, -5.2], [0, -6.6]]) {
    const tree = at(cypress(rng), x, 0, z, g);
    tree.scale.setScalar(0.85 + rng() * 0.3);
  }
  for (const [x, z] of [[-6.3, -3.2], [-6.9, -4.1], [-5.9, -4.2]]) {
    const barrel = at(cyl(0.34, 0.34, 0.9, 0x8a5a3c, 8), x, 0.5, z, g);
    for (const y of [-0.28, 0.28]) at(cyl(0.36, 0.36, 0.06, INK, 8), 0, y, 0, barrel);
  }
  return g;
}

/** Vines trained along wires between chestnut posts, in rows that follow each terrace. */
function buildVineyard(scene, rng) {
  const yaw = Math.PI / 4; // rows run along the slope
  const vines = [];
  const posts = [];
  const wires = [];
  const grapes = [];
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const place = (list, x, y, z, sx, sy, sz, color) => list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)), c: color });
  for (let u = 44; u < 116; u += 1.7) {
    let run = 0;
    for (let v = -34; v < 44; v += 0.9) {
      const x = toX(u, v);
      const z = toZ(u, v);
      const ok = estateWeight(u, v) > 0.25 && slopeAt(x, z) < 0.3 && isWild(x, z, 0);
      if (!ok) {
        run = 0;
        continue;
      }
      const y = groundAt(x, z);
      // A post at each end of a row and every few vines; the wire runs between them.
      if (run % 4 === 0) place(posts, x, y + 0.65, z, 0.1, 1.3, 0.1, 0x7a5a44);
      place(wires, x, y + 1.15, z, 0.92, 0.03, 0.03, 0x4a4450);
      if (rng() > 0.06) {
        const tired = rng() < 0.12;
        place(vines, x, y + 0.72, z, 0.98, 0.78 + rng() * 0.22, 0.42, tired ? VINE[4] : pick(rng, VINE.slice(0, 4)));
        place(vines, x, y + 0.18, z, 0.08, 0.4, 0.08, 0x6a5444);
        if (rng() < 0.3) place(grapes, x + (rng() - 0.5) * 0.3, y + 0.5, z + 0.24, 0.16, 0.22, 0.14, 0x4a3468);
      }
      run++;
    }
  }
  const color = new THREE.Color();
  const instance = (geo, list, flat) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, paint(0xffffff, { flat }), list.length);
    list.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, color.setHex(it.c));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  };
  instance(new THREE.IcosahedronGeometry(0.62, 0), vines, true);
  instance(new THREE.BoxGeometry(1, 1, 1), [...posts, ...wires], false);
  instance(new THREE.IcosahedronGeometry(0.5, 0), grapes, true);
}

export function buildEstate(scene, rng) {
  const villa = at(buildVilla(rng), VILLA.x, VILLA.y, VILLA.z);
  villa.rotation.y = Math.PI / 4;
  scene.add(bake(villa));
  buildVineyard(scene, rng);
}

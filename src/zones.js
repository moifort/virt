// The work areas of the VIRT.
import * as THREE from 'three';
import { mulberry32, pick } from './noise.js';
import { PAL, WATER_LEVEL, paint, solid } from './style.js';
import { DARK_WOOD, INK, SCREEN, STONE, WARM_LIGHT, aerocar, at, ball, box, cone, cyl, lantern, live, plant, ring, screen } from './kit.js';
import { SUN_DIR, ZONES, groundAt } from './terrain.js';

/** Shelves of books along a wall. axis 'x' runs along x facing +z; axis 'z' runs along z facing +x. */
export function bookshelf(parent, books, rng, { axis, from, to, at: fixed, y0, rows = 5, rowH = 1.18 }) {
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

export function instanceBooks(parent, books) {
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

export function armchair(color) {
  const g = new THREE.Group();
  at(box(1.8, 0.7, 1.7, color), 0, 0.45, 0, g);
  const back = at(box(1.8, 1.9, 0.5, color), 0, 1.3, 0.8, g);
  back.rotation.x = 0.22; // reclined, La-Z-Boy style
  at(box(0.38, 0.95, 1.7, color), -0.95, 0.75, 0, g);
  at(box(0.38, 0.95, 1.7, color), 0.95, 0.75, 0, g);
  at(box(1.4, 0.32, 0.9, color), 0, 0.42, -1.25, g); // footrest out
  return g;
}

export function chair(color, back = 1.3) {
  const g = new THREE.Group();
  at(box(0.85, 0.12, 0.85, color), 0, 0.78, 0, g);
  at(box(0.85, back, 0.12, color), 0, 0.78 + back / 2, 0.38, g);
  at(cyl(0.07, 0.12, 0.75, INK, 6), 0, 0.38, 0, g);
  return g;
}

export function cat(animated) {
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
  return live(g);
}

export function butler(animated) {
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
  return live(g);
}

// ---------------------------------------------------------------- Work areas

export function buildLibrary(g, rng, animated) {
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
  ].map(([x, h, r, color]) => at(live(cone(r, h, color, 6, { glow: true })), x, F + 0.35 + h / 2, fz + 1.6, g));
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
  furnishLibrary(g, rng, animated);
}

export function buildMoot(g, rng, animated) {
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
  furnishMoot(g, rng);
}

export function buildPub(g, rng, animated) {
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
  furnishPub(g, rng);
}

export function buildPods(g, rng, animated) {
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
  furnishPods(g, rng);
}

export function buildTower(g, rng, H) {
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

export function turbine(rng, animated) {
  const g = new THREE.Group();
  const H = 9 + rng() * 4;
  at(cyl(0.16, 0.36, H, PAL.ivory, 8), 0, H / 2, 0, g);
  const nacelle = at(ball(0.5, PAL.ivory, {}, 10, 8), 0, H, 0, g);
  nacelle.scale.z = 1.6;
  const rotor = at(live(new THREE.Group()), 0, H, 0.75, g);
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
export function sunFlower(rng) {
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

export function buildAtelier(g, rng, animated) {
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
  const proto = at(live(new THREE.Group()), -1.2, 1.75, 4.5, g);
  at(ball(0.35, PAL.ivory, { flat: true }, 6, 4), 0, 0, 0, proto);
  at(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 24), paint(SCREEN, { glow: true })), 0, 0, 0, proto);
  animated.push((t) => proto.rotation.set(t * 0.7, t, 0));
  for (let i = 0; i < 4; i++) at(box(0.9, 0.9, 0.9, pick(rng, [PAL.wood, PAL.ochre])), 6.5 - (i % 2), 0.75 + Math.floor(i / 2) * 0.9, 5 - (i % 2) * 0.3, g).rotation.y = rng();
  for (let i = 0; i < 12; i++) at(sunFlower(rng), 9 + (i % 4) * 1.9, 0, -8 + Math.floor(i / 4) * 1.9, g);
  for (const [x, z] of [[-11, 6], [-12, -3], [12, 7]]) at(turbine(rng, animated), x, groundAt(g.position.x + x, g.position.z + z), z, g);
  furnishAtelier(g, rng, animated);
}

/** Small wooden fishing boat (gozzo). */
export function gozzo(rng, sail = false) {
  const g = new THREE.Group();
  const color = pick(rng, [PAL.blue, PAL.red, PAL.saffron, PAL.teal, PAL.coral, PAL.ivory]);
  const hull = at(solid(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), paint(color, { doubleSide: true })), 0, 0.35, 0, g);
  hull.scale.set(0.9, 0.7, 2.3);
  at(box(1.75, 0.08, 0.25, PAL.ivory), 0, 0.37, 0, g);
  at(box(1.5, 0.06, 3.6, PAL.wood), 0, 0.3, 0, g);
  at(box(1.5, 0.12, 0.3, PAL.wood), 0, 0.45, -0.6, g);
  if (sail) {
    at(cyl(0.05, 0.06, 3.4, PAL.wood, 5), 0, 2, 0.3, g);
    const canvas = solid(new THREE.ConeGeometry(1.1, 2.8, 3), paint(PAL.ivory));
    canvas.scale.z = 0.08;
    at(canvas, 0.55, 2.1, 0.3, g);
  }
  return g;
}

/** Tall striped lighthouse on an octagonal base, with a gallery and a glowing lantern room. */
export function lighthouse(parent, x, y, z) {
  const g = at(new THREE.Group(), x, y, z, parent);
  at(cyl(3.6, 4.0, 2.4, STONE, 8, { flat: true }), 0, 1.2, 0, g);
  at(cyl(3.8, 3.8, 0.2, PAL.cream, 8), 0, 2.5, 0, g);
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const r0 = 1.9 - i * 0.12;
    at(cyl(r0 - 0.12, r0, 2.4, i % 2 ? PAL.red : PAL.ivory, 14), 0, 3.8 + i * 2.4, 0, g);
  }
  for (let i = 0; i < 4; i++) at(box(0.4, 0.7, 0.1, 0x3b3346), 0, 4.5 + i * 3.3, 1.85 - i * 0.18, g);
  const top = 2.6 + stripes * 2.4;
  at(cyl(1.75, 1.75, 0.3, INK, 14), 0, top + 0.15, 0, g);
  at(ring(1.65, 0.06, INK, Math.PI * 2, 18), 0, top + 0.95, 0, g).rotation.x = Math.PI / 2;
  for (let k = 0; k < 12; k++) at(cyl(0.04, 0.04, 0.8, INK, 4), Math.cos((k / 12) * Math.PI * 2) * 1.65, top + 0.6, Math.sin((k / 12) * Math.PI * 2) * 1.65, g);
  at(cyl(1.05, 1.05, 1.6, PAL.saffron, 10, { glow: true }), 0, top + 1.1, 0, g);
  for (let k = 0; k < 6; k++) at(box(0.08, 1.6, 0.08, INK), Math.cos((k / 6) * Math.PI * 2) * 1.07, top + 1.1, Math.sin((k / 6) * Math.PI * 2) * 1.07, g);
  at(solid(new THREE.SphereGeometry(1.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint(PAL.red)), 0, top + 1.9, 0, g);
  at(cyl(0.06, 0.06, 1.2, INK, 4), 0, top + 3.4, 0, g);
  at(ball(0.22, PAL.saffron, { glow: true }, 6, 4), 0, top + 4.0, 0, g);
}

export function buildPort(g, rng, animated) {
  // Local +z points to the open sea, found by looking for the deepest water around the port.
  let best = { depth: Infinity, angle: 0 };
  for (let k = 0; k < 48; k++) {
    const angle = (k / 48) * Math.PI * 2;
    const depth = groundAt(g.position.x + Math.sin(angle) * 30, g.position.z + Math.cos(angle) * 30);
    if (depth < best.depth) best = { depth, angle };
  }
  g.rotation.y = best.angle;
  const surface = WATER_LEVEL;
  const Q = 17;

  // Quay wall with bollards and lamps.
  at(box(46, 4.8, 2.6, STONE, { flat: true }), 0, -2.4, Q, g);
  at(box(46, 0.25, 2.8, PAL.cream), 0, 0.1, Q, g);
  for (let x = -21; x <= 21; x += 4.2) at(cyl(0.22, 0.28, 0.65, INK, 6), x, 0.42, Q + 0.9, g);
  for (const x of [-18, -6, 6, 18]) lantern(g, x, 0.2, Q - 0.6);

  // A stone mole to the left, a long curved breakwater to the right ending at the lighthouse.
  const block = (x, z, size) => {
    const b = at(solid(new THREE.BoxGeometry(size, size, size), paint(pick(rng, [STONE, PAL.lilac, 0xd9cbb5]), { flat: true })), x, surface + 0.2, z, g);
    b.rotation.set(rng() * 0.5, rng() * 3, rng() * 0.5);
  };
  for (let z = Q + 2; z < Q + 22; z += 2.2) {
    block(-21, z, 3.2);
    block(-23, z + 1, 2.4);
  }
  at(box(3, 0.4, 20, STONE), -21, surface + 1.7, Q + 11, g);
  for (let t = 0; t <= 1; t += 0.035) {
    const x = 21 - Math.sin(t * 1.3) * 12;
    const z = Q + 2 + t * 34;
    block(x, z, 3.4);
    block(x + 2.2, z + 0.6, 2.6);
  }
  lighthouse(g, 21 - Math.sin(1.3) * 12, surface + 0.6, Q + 39);

  // Two wooden piers.
  for (const px of [-9, 5]) {
    for (let i = 0; i < 28; i++) at(box(2.6, 0.16, 0.56, PAL.wood), px, 0.05, Q + 1.6 + i * 0.62, g);
    for (let z = Q + 2; z < Q + 19; z += 2.8) for (const dx of [-1.2, 1.2]) at(cyl(0.13, 0.13, 3.6, DARK_WOOD, 6), px + dx, -1.7, z, g);
    lantern(g, px + 1.1, 0.13, Q + 18.6);
  }

  // Moored boats along the piers, bobbing.
  const moorings = [];
  for (const px of [-9, 5]) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) moorings.push([px + side * 2.6, Q + 4 + k * 5, (rng() - 0.5) * 0.2]);
  moorings.forEach(([x, z, yaw], i) => {
    const boat = at(live(gozzo(rng, i % 5 === 4)), x, surface, z, g);
    boat.rotation.y = yaw;
    animated.push((t) => {
      boat.position.y = surface + Math.sin(t * 1.3 + i) * 0.08;
      boat.rotation.z = Math.sin(t * 1.1 + i * 2) * 0.05;
    });
  });

  // A harbour crane.
  const crane = at(new THREE.Group(), 15, 0, Q - 2, g);
  at(cyl(0.35, 0.5, 9, PAL.saffron, 8), 0, 4.5, 0, crane);
  const boom = at(box(0.4, 0.4, 8, PAL.saffron), 0, 8.6, 3, crane);
  boom.rotation.x = -0.25;
  at(box(1.4, 1.2, 1.6, PAL.coral), 0, 9.2, -0.8, crane);
  at(cyl(0.02, 0.02, 5, INK, 3), 0, 7.6, 6.6, crane);
  at(box(0.5, 0.3, 0.3, INK), 0, 5.1, 6.6, crane);

  // Boats pulled up on the quay, crates and a café terrace.
  for (const [x, z, yaw] of [[-12, 9, 0.4], [-9.5, 7.5, 0.2], [-14.5, 10.5, 0.6]]) {
    const boat = at(gozzo(rng), x, 0.15, z, g);
    boat.rotation.set(0, yaw, 0.12);
  }
  for (let i = 0; i < 7; i++) at(box(0.9, 0.7, 0.9, pick(rng, [PAL.wood, PAL.ochre, PAL.teal])), 8 + (i % 3), 0.35 + Math.floor(i / 3) * 0.7, 12 + (i % 2) * 0.4, g).rotation.y = rng();
  for (const [x, z, color] of [[2, 6, PAL.coral], [6, 4, PAL.teal], [-3, 4, PAL.saffron], [-7, 2, PAL.pink]]) {
    at(cyl(0.7, 0.7, 0.08, PAL.ivory, 12), x, 1.05, z, g);
    at(cyl(0.07, 0.07, 3, INK, 6), x, 1.5, z, g);
    const parasol = at(cone(2, 0.8, color, 8), x, 3.2, z, g);
    parasol.rotation.y = rng();
    for (let k = 0; k < 2; k++) at(chair(PAL.ivory, 0.9), x + (k ? 1.2 : -1.2), 0, z, g).rotation.y = k ? -Math.PI / 2 : Math.PI / 2;
  }
  furnishPort(g, rng);
}

export function buildAgora(g, rng) {
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
  furnishAgora(g, rng);
}


// ---------------------------------------------------------------- Second pass: props and furnishings

function bookPile(parent, x, y, z, rng, n = 4) {
  for (let i = 0; i < n; i++) {
    const b = at(box(0.7 - i * 0.05, 0.16, 0.5, pick(rng, [PAL.red, PAL.teal, PAL.saffron, PAL.plum, PAL.blue])), x, y + 0.08 + i * 0.16, z, parent);
    b.rotation.y = (rng() - 0.5) * 0.6;
  }
}

function amphora(parent, x, y, z, color = 0xc8643c) {
  const body = at(ball(0.42, color, {}, 10, 8), x, y + 0.55, z, parent);
  body.scale.y = 1.35;
  at(cyl(0.14, 0.2, 0.4, color, 8), x, y + 1.2, z, parent);
  at(ring(0.17, 0.04, color, Math.PI * 2, 10), x, y + 1.4, z, parent).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) at(ring(0.18, 0.04, color, Math.PI, 8), x + s * 0.22, y + 1.05, z, parent).rotation.z = s * Math.PI / 2;
}

function lemonPot(parent, x, y, z, rng) {
  at(cyl(0.5, 0.38, 0.8, 0xc8643c, 10), x, y + 0.4, z, parent);
  at(ring(0.5, 0.05, PAL.cream, Math.PI * 2, 14), x, y + 0.8, z, parent).rotation.x = Math.PI / 2;
  at(cyl(0.07, 0.09, 1.1, DARK_WOOD, 5), x, y + 1.3, z, parent);
  at(ball(0.8, 0x5f9c6a, { flat: true }, 8, 6), x, y + 2.1, z, parent);
  for (let k = 0; k < 6; k++) {
    const a = rng() * Math.PI * 2;
    at(ball(0.11, PAL.saffron, {}, 5, 4), x + Math.cos(a) * 0.72, y + 2.0 + (rng() - 0.5) * 0.6, z + Math.sin(a) * 0.72, parent);
  }
}

function furnishLibrary(g, rng, animated) {
  const F = 0.4;
  // Globe on a stand.
  at(cyl(0.35, 0.45, 0.1, DARK_WOOD, 10), 5.4, F + 0.05, 2.6, g);
  at(cyl(0.05, 0.05, 1.1, DARK_WOOD, 6), 5.4, F + 0.6, 2.6, g);
  const meridian = at(ring(0.62, 0.04, PAL.saffron, Math.PI * 2, 18), 5.4, F + 1.5, 2.6, g);
  meridian.rotation.y = 0.6;
  at(ball(0.55, PAL.teal, {}, 14, 10), 5.4, F + 1.5, 2.6, g);
  for (let k = 0; k < 4; k++) at(ball(0.2, PAL.ochre, { flat: true }, 5, 4), 5.4 + Math.cos(k * 1.7) * 0.42, F + 1.5 + Math.sin(k * 2.3) * 0.3, 2.6 + Math.sin(k * 1.7) * 0.42, g);
  // Telescope aimed at the tall windows.
  for (let k = 0; k < 3; k++) {
    const leg = at(cyl(0.03, 0.04, 1.6, DARK_WOOD, 4), -5.4 + Math.cos(k * 2.1) * 0.3, F + 0.75, -3.2 + Math.sin(k * 2.1) * 0.3, g);
    leg.rotation.set(Math.sin(k * 2.1) * 0.3, 0, -Math.cos(k * 2.1) * 0.3);
  }
  const tube = at(cyl(0.12, 0.18, 1.6, PAL.saffron, 10), -5.6, F + 1.75, -3.0, g);
  tube.rotation.set(0.5, 0, 0.9);
  // Library ladder against the shelves.
  const ladder = at(new THREE.Group(), -4.6, F, -4.9, g);
  ladder.rotation.x = -0.18;
  for (const x of [-0.35, 0.35]) at(box(0.08, 5.4, 0.08, PAL.wood), x, 2.7, 0, ladder);
  for (let k = 0; k < 9; k++) at(box(0.7, 0.06, 0.08, PAL.wood), 0, 0.4 + k * 0.6, 0, ladder);
  // Piles of books, a reading lamp on the desk.
  bookPile(g, 3.2, F, 3.8, rng, 5);
  bookPile(g, -2.8, F, -4.3, rng, 3);
  bookPile(g, -5.6, F + 1.17, 3.4, rng, 2);
  at(cyl(0.15, 0.18, 0.06, PAL.saffron, 8), -3.4, F + 1.2, 3.4, g);
  at(cyl(0.03, 0.03, 0.5, PAL.saffron, 4), -3.4, F + 1.45, 3.4, g);
  at(cyl(0.12, 0.28, 0.2, 0x3f8f5a, 8, { glow: true }), -3.4, F + 1.72, 3.5, g);
  // The Incal: a luminous pyramid hovering over its pedestal.
  at(cyl(0.35, 0.45, 1.2, PAL.ivory, 8), -1.6, F + 0.6, 3.8, g);
  at(ring(0.38, 0.05, PAL.saffron, Math.PI * 2, 10), -1.6, F + 1.2, 3.8, g).rotation.x = Math.PI / 2;
  const incal = at(live(new THREE.Group()), -1.6, F + 1.9, 3.8, g);
  at(cone(0.34, 0.5, 0xfff6d8, 4, { glow: true, flat: true }), 0, 0.25, 0, incal);
  at(cone(0.34, 0.5, PAL.saffron, 4, { glow: true, flat: true }), 0, -0.25, 0, incal).rotation.x = Math.PI;
  animated.push((t) => {
    incal.rotation.y = t * 0.9;
    incal.position.y = F + 1.9 + Math.sin(t * 1.6) * 0.12;
  });
}

function furnishMoot(g, rng) {
  const F = 0.4;
  // Lanterns hanging from the pergola.
  for (let x = -7.5; x <= 7.5; x += 3) {
    at(cyl(0.015, 0.015, 1.3, INK, 3), x, F + 5.85, 0, g);
    at(cone(0.22, 0.2, INK, 6), x, F + 5.2, 0, g);
    at(ball(0.24, WARM_LIGHT, { glow: true }, 8, 6), x, F + 4.98, 0, g);
  }
  // Sideboard with amphorae and a feast.
  at(box(6, 1.0, 0.8, DARK_WOOD), 3, F + 0.5, -5.2, g);
  at(box(6.2, 0.1, 0.95, PAL.wood), 3, F + 1.05, -5.2, g);
  for (const x of [0.6, 5.4]) amphora(g, x, F + 1.1, -5.2, pick(rng, [0xc8643c, PAL.teal, PAL.ochre]));
  for (let k = 0; k < 4; k++) at(ball(0.18, pick(rng, [PAL.saffron, PAL.red, PAL.grass]), {}, 6, 5), 2 + k * 0.5, F + 1.25, -5.1, g);
  at(cyl(0.45, 0.45, 0.06, PAL.ivory, 12), 3.4, F + 1.12, -5.2, g);
  // Big jars and lemon trees at the corners.
  for (const [x, z] of [[-10.3, 5.6], [10.3, 5.6], [-10.3, -5.6], [10.3, -5.6]]) amphora(g, x, 0.35, z, pick(rng, [0xc8643c, PAL.ochre]));
  for (const [x, z] of [[-12, 7.5], [12, 7.5]]) lemonPot(g, x, 0, z, rng);
  // Mosaic: a border of coloured tiles around the table.
  for (let x = -9; x <= 9; x += 0.9) {
    for (const z of [-4.2, 4.2]) at(box(0.7, 0.03, 0.7, pick(rng, [PAL.teal, PAL.coral, PAL.saffron, PAL.ivory])), x, 0.39, z, g);
  }
}

function furnishPub(g, rng) {
  const F = 0.4;
  // Jukebox.
  at(box(1.2, 1.7, 0.8, PAL.coral), 6.4, F + 0.85, 2.4, g);
  at(cyl(0.6, 0.6, 0.8, PAL.coral, 12, {}), 6.4, F + 1.7, 2.4, g).rotation.x = Math.PI / 2;
  at(box(0.9, 0.8, 0.05, PAL.saffron, { glow: true }), 6.4, F + 1.05, 2.82, g);
  for (let k = 0; k < 3; k++) at(box(0.9, 0.05, 0.06, SCREEN, { glow: true }), 6.4, F + 0.4 + k * 0.12, 2.82, g);
  // Chalkboard menu on an easel at the entrance.
  const easel = at(new THREE.Group(), 6.2, F, 5.2, g);
  easel.rotation.y = -0.6;
  at(box(1.2, 1.5, 0.08, INK), 0, 1.0, 0, easel).rotation.x = -0.15;
  for (let k = 0; k < 4; k++) at(box(0.7 - (k % 2) * 0.2, 0.06, 0.02, PAL.ivory), -0.1, 1.45 - k * 0.25, 0.08 - k * 0.04, easel);
  for (const x of [-0.5, 0.5]) at(box(0.06, 1.6, 0.06, PAL.wood), x, 0.75, -0.2, easel).rotation.x = 0.25;
  // Dartboard on the bottle wall.
  const board = at(new THREE.Group(), 4.6, F + 2.6, -5.65, g);
  [[0.45, INK], [0.36, PAL.red], [0.26, PAL.cream], [0.16, PAL.grassDeep], [0.06, PAL.red]].forEach(([r, color], i) => {
    at(cyl(r, r, 0.04, color, 16), 0, 0, 0.02 * i, board).rotation.x = Math.PI / 2;
  });
  // Flowering barrels at the corners of the terrace.
  for (const [x, z] of [[-6.8, 5.4], [6.8, -5.4]]) {
    at(cyl(0.6, 0.55, 0.9, PAL.wood, 10), x, F + 0.45, z, g);
    for (const y of [0.2, 0.7]) at(ring(0.6, 0.04, INK, Math.PI * 2, 12), x, F + y, z, g).rotation.x = Math.PI / 2;
    for (let k = 0; k < 6; k++) at(ball(0.22, pick(rng, [PAL.pink, PAL.red, PAL.saffron, PAL.grassDeep]), {}, 5, 4), x + Math.cos(k) * 0.35, F + 1.05 + (k % 2) * 0.15, z + Math.sin(k) * 0.35, g);
  }
}

function furnishPods(g, rng) {
  [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([x, z], i) => {
    const pod = at(new THREE.Group(), x, 0, z, g);
    at(cyl(1.4, 1.4, 0.04, [PAL.coral, PAL.teal, PAL.saffron, PAL.lilac][(i + 1) % 4], 16), 0.2, 0.42, 0.2, pod);
    // Low shelf with a few books, a hanging lamp, an antenna on the shell.
    const shelf = at(new THREE.Group(), 1.4, 0.4, -1.2, pod);
    shelf.rotation.y = -Math.PI / 4;
    at(box(1.2, 0.8, 0.4, PAL.wood), 0, 0.4, 0, shelf);
    for (let k = 0; k < 5; k++) at(box(0.14, 0.4, 0.3, pick(rng, [PAL.red, PAL.teal, PAL.saffron, PAL.blue])), -0.4 + k * 0.18, 0.95, 0, shelf);
    at(cyl(0.01, 0.01, 0.9, INK, 3), -0.4, 3.0, -0.4, pod);
    at(cone(0.25, 0.25, PAL.ivory, 8), -0.4, 2.5, -0.4, pod);
    at(ball(0.13, WARM_LIGHT, { glow: true }, 6, 4), -0.4, 2.35, -0.4, pod);
    at(cyl(0.04, 0.04, 1.4, INK, 4), -1.5, 3.4, -1.5, pod);
    at(ball(0.12, PAL.red, { glow: true }, 4, 3), -1.5, 4.15, -1.5, pod);
  });
}

function furnishAtelier(g, rng, animated) {
  // The tower gets a balcony, portholes, pipes and a dish.
  const tower = new THREE.Vector3(-5, 0, -4);
  const H = 15;
  at(ring(2.6, 0.12, PAL.ivory, Math.PI * 2, 24), tower.x, H * 0.55, tower.z, g).rotation.x = Math.PI / 2;
  at(cyl(2.6, 2.6, 0.14, PAL.cream, 20), tower.x, H * 0.55 - 0.65, tower.z, g);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    at(cyl(0.04, 0.04, 0.6, PAL.ivory, 4), tower.x + Math.cos(a) * 2.6, H * 0.55 - 0.3, tower.z + Math.sin(a) * 2.6, g);
  }
  for (let k = 0; k < 6; k++) {
    const a = Math.PI * 0.1 + (k % 3) * 0.5;
    const y = 3 + Math.floor(k / 3) * 7;
    const r = 2.2 * (1.15 - (0.4 * y) / H) + 0.02;
    const port = at(cyl(0.32, 0.32, 0.1, 0x3b3346, 10), tower.x + Math.cos(a) * r, y, tower.z + Math.sin(a) * r, g);
    port.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2);
    port.lookAt(tower.x + Math.cos(a) * 10, y, tower.z + Math.sin(a) * 10);
    port.rotateX(Math.PI / 2);
  }
  at(cyl(0.18, 0.18, H, PAL.coral, 8), tower.x + 2.3, H / 2, tower.z + 0.6, g);
  for (const y of [2, 6, 10, 14]) at(ring(0.24, 0.05, INK, Math.PI * 2, 8), tower.x + 2.3, y, tower.z + 0.6, g).rotation.x = Math.PI / 2;
  const dish = at(solid(new THREE.SphereGeometry(1.1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.5), paint(PAL.ivory, { doubleSide: true })), tower.x + 2.4, H + 2.2, tower.z, g);
  dish.rotation.set(-0.9, 0, 0.5);
  // Landing pad with a parked aerotaxi.
  at(cyl(3.2, 3.4, 0.25, PAL.ivory, 24), 2, 0.12, 11, g);
  at(ring(2.5, 0.12, PAL.saffron, Math.PI * 2, 24), 2, 0.27, 11, g).rotation.x = Math.PI / 2;
  for (let k = 0; k < 4; k++) at(ball(0.12, SCREEN, { glow: true }, 4, 3), 2 + Math.cos(k * Math.PI / 2) * 3, 0.3, 11 + Math.sin(k * Math.PI / 2) * 3, g);
  const car = at(live(aerocar(PAL.teal)), 2, 1.1, 11, g);
  car.rotation.y = 0.7;
  animated.push((t) => (car.position.y = 1.1 + Math.sin(t * 2) * 0.06));
}

function furnishPort(g, rng) {
  // Fisherman's shed.
  const shed = at(new THREE.Group(), -11, 0, 3, g);
  at(box(3.2, 2.4, 2.6, PAL.sky), 0, 1.2, 0, shed);
  at(box(3.6, 0.15, 3.0, PAL.ivory), 0, 2.45, 0, shed);
  const roof = at(cone(2.4, 1.0, 0xc8643c, 4, { flat: true }), 0, 3.0, 0, shed);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.85);
  at(box(0.8, 1.5, 0.05, PAL.wood), 0.6, 0.75, 1.32, shed);
  at(box(0.6, 0.5, 0.05, 0x3b3346), -0.8, 1.4, 1.32, shed);
  // Nets drying on poles.
  for (const x of [0, 3.6]) at(cyl(0.06, 0.06, 2.4, PAL.wood, 4), x, 1.2, 10.8, g);
  for (let k = 0; k < 6; k++) at(box(3.6, 0.03, 0.03, 0x6d8f8a), 1.8, 0.9 + k * 0.25, 10.8, g);
  for (let k = 0; k < 9; k++) at(box(0.03, 1.4, 0.03, 0x6d8f8a), 0.2 + k * 0.4, 1.5, 10.8, g);
  // Buoys, rope coils, lobster pots, an anchor.
  for (let k = 0; k < 5; k++) {
    at(ball(0.24, k % 2 ? PAL.red : PAL.ivory, {}, 8, 6), 4.5 + k * 0.45, 0.3, 11.7 - (k % 2) * 0.4, g);
  }
  for (const [x, z] of [[-6, 11.4], [-5.2, 11.6]]) at(ring(0.35, 0.09, PAL.cream, Math.PI * 2, 12), x, 0.18, z, g).rotation.x = Math.PI / 2;
  for (const [x, z] of [[-2, 11.2], [-1.2, 11.5], [-1.6, 10.6]]) {
    at(cyl(0.4, 0.4, 0.55, 0x5a6a7a, 8), x, 0.28, z, g);
    at(ring(0.4, 0.03, PAL.saffron, Math.PI * 2, 10), x, 0.55, z, g).rotation.x = Math.PI / 2;
  }
  const anchor = at(new THREE.Group(), 8, 0.2, 12, g);
  anchor.rotation.set(-Math.PI / 2, 0, 0.4);
  at(cyl(0.08, 0.08, 1.6, INK, 6), 0, 0, 0, anchor);
  at(ring(0.55, 0.08, INK, Math.PI, 10), 0, -0.6, 0, anchor).rotation.z = Math.PI;
  at(ring(0.18, 0.05, INK, Math.PI * 2, 8), 0, 0.9, 0, anchor);
  // Mooring buoys out in the harbour.
  for (const [x, z] of [[-12, 20], [2, 27], [-6, 29]]) {
    at(ball(0.35, PAL.coral, {}, 8, 6), x, WATER_LEVEL + 0.1, z, g);
    at(cyl(0.04, 0.04, 0.5, INK, 4), x, WATER_LEVEL + 0.55, z, g);
  }
}

function furnishAgora(g, rng) {
  // Roots of the Mother Tree spreading over the ground.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const root = at(cyl(0.18, 0.5, 2.6, PAL.ivory, 6), Math.cos(a) * 1.6, 0.35, Math.sin(a) * 1.6, g);
    root.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
  }
  for (const y of [1.5, 3.5, 5.5]) at(ring(1.25 - y * 0.06, 0.08, PAL.saffron, Math.PI * 2, 14), 0, y, 0, g).rotation.x = Math.PI / 2;
  // Lanterns hanging from the branches.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5;
    const x = Math.cos(a) * 4.2;
    const z = -Math.sin(a) * 4.2;
    at(cyl(0.015, 0.015, 1.4, INK, 3), x, 9.2, z, g);
    at(ball(0.22, k % 2 ? WARM_LIGHT : PAL.pink, { glow: true }, 6, 5), x, 8.4, z, g);
  }
  // A fountain.
  const f = at(new THREE.Group(), -5, 0, -5, g);
  at(cyl(2, 2.1, 0.6, STONE, 18), 0, 0.3, 0, f);
  at(cyl(1.75, 1.75, 0.05, 0x9fe3d6, 18, { glow: true }), 0, 0.58, 0, f);
  at(cyl(0.25, 0.35, 1.6, STONE, 8), 0, 1.1, 0, f);
  at(cyl(0.8, 0.3, 0.3, STONE, 12), 0, 1.95, 0, f);
  at(ball(0.3, PAL.teal, {}, 8, 6), 0, 2.35, 0, f);
  for (let k = 0; k < 4; k++) {
    const jet = at(cyl(0.04, 0.02, 0.9, 0xbff0e8, 4, { glow: true }), Math.cos(k * Math.PI / 2) * 0.55, 1.6, Math.sin(k * Math.PI / 2) * 0.55, f);
    jet.rotation.set(Math.sin(k * Math.PI / 2) * 0.7, 0, -Math.cos(k * Math.PI / 2) * 0.7);
  }
}

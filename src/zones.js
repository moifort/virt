// The work areas of the VIRT.
import * as THREE from 'three';
import { mulberry32, pick } from './noise.js';
import { PAL, WATER_LEVEL, paint, solid } from './style.js';
import { DARK_WOOD, INK, SCREEN, STONE, WARM_LIGHT, at, bake, ball, box, cone, cyl, lamplight, lantern, live, plant, ring, screen, seat } from './kit.js';
import { ISLET, OBSERVATORY, SUN_DIR, ZONES, groundAt, laneAt, lanePoint, toX, toZ, villagePlan } from './terrain.js';
import { cypress, lemonTree } from './nature.js';

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
  seat(g, 0, 0.82, -0.05, Math.PI);
  return g;
}

export function chair(color, back = 1.3) {
  const g = new THREE.Group();
  at(box(0.85, 0.12, 0.85, color), 0, 0.78, 0, g);
  at(box(0.85, back, 0.12, color), 0, 0.78 + back / 2, 0.38, g);
  at(cyl(0.07, 0.12, 0.75, INK, 6), 0, 0.38, 0, g);
  seat(g, 0, 0.86, 0, Math.PI);
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
  lantern(g, W / 2 - 0.6, 0.35, D / 2 + 0.6, { toward: [0, D / 2 + 0.6] });
  lantern(g, -W / 2 + 0.6, 0.35, D / 2 + 0.6, { toward: [0, D / 2 + 0.6] });
  furnishMoot(g, rng);
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
  lantern(g, 0, 0, 0, { color: SCREEN });
  furnishPods(g, rng);
}

export function buildAtelier(g, rng, animated) {
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
  furnishAtelier(g, rng, animated);
}

/** A square of thatch `w` by `d` narrowing to `taper` of itself at the top: stack a few for a roof. */
function thatch(w, d, h, taper, color) {
  const mesh = solid(new THREE.CylinderGeometry(Math.SQRT1_2 * taper, Math.SQRT1_2, h, 4).rotateY(Math.PI / 4), paint(color, { flat: true }));
  mesh.scale.set(w, 1, d);
  return mesh;
}

/** A straw parasol on its pole, with a low table and two canvas deckchairs in its shade. */
function palapa(parent, rng, x, y, z) {
  const STRAW = [0xdcc078, 0xcfb068, 0xc2a05a];
  at(cyl(0.08, 0.1, 2.9, 0x9a7a5a, 6), x, y + 1.45, z, parent);
  at(cone(1.9, 0.8, STRAW[0], 9, { flat: true }), x, y + 3.0, z, parent);
  at(cone(1.3, 0.6, STRAW[1], 9, { flat: true }), x, y + 3.45, z, parent);
  at(cyl(1.92, 1.92, 0.12, STRAW[2], 9, { flat: true }), x, y + 2.6, z, parent);
  at(cyl(0.5, 0.5, 0.08, PAL.wood, 10), x + 0.1, y + 0.55, z + 0.9, parent);
  at(cyl(0.06, 0.1, 0.5, 0x9a7a5a, 5), x + 0.1, y + 0.27, z + 0.9, parent);
  at(cyl(0.1, 0.09, 0.26, pick(rng, [PAL.saffron, PAL.coral, 0x9fd8c8]), 6), x + 0.2, y + 0.72, z + 0.85, parent);
  const stripe = pick(rng, [PAL.coral, PAL.teal, PAL.saffron, PAL.blue]);
  for (const s of [-1, 1]) {
    const chair = at(new THREE.Group(), x + s * 1.2, y, z + 0.3, parent);
    chair.rotation.y = -s * 0.35;
    // Seat and back of striped canvas slung in a folding wooden frame.
    for (let k = 0; k < 4; k++) {
      at(box(0.2, 0.05, 1.0, k % 2 ? PAL.ivory : stripe), -0.3 + k * 0.2, 0.38, 0.45, chair).rotation.x = 0.12;
      at(box(0.2, 0.05, 1.1, k % 2 ? PAL.ivory : stripe), -0.3 + k * 0.2, 0.85, -0.42, chair).rotation.x = -1.0;
    }
    seat(chair, 0, 0.5, 0.3);
    for (const dx of [-0.42, 0.42]) {
      at(box(0.06, 0.06, 1.9, 0x9a7a5a), dx, 0.42, 0, chair).rotation.x = 0.3;
      at(box(0.06, 0.06, 1.5, 0x9a7a5a), dx, 0.5, -0.2, chair).rotation.x = -0.75;
    }
  }
}

/**
 * The bar on the sea front: a traditional beach bar — a plank shack under a thatched roof, its
 * counter open to the sea, straw parasols and deckchairs on a boardwalk, surfboards against the
 * wall, a hammock, and strings of little lamps for the evening.
 */
export function buildPub(g, rng, animated) {
  const W = 15;
  const D = 12;
  const F = 0.35;
  const DRIFTWOOD = 0x9a7a5a;
  const BAMBOO = 0xd8b06a;
  const STRAW = [0xdcc078, 0xcfb068, 0xc2a05a];
  const PLANKS = [0xdcc094, 0xd2b488, 0xe2c8a0];

  // The boardwalk, on short piles driven into the sand.
  for (let i = 0; i < 20; i++) at(box(W, F * 0.5, 0.56, PLANKS[i % 3]), 0, F * 0.75, -D / 2 + 0.3 + i * 0.6, g);
  for (const x of [-W / 2 + 0.5, -2.5, 2.5, W / 2 - 0.5]) for (const z of [-D / 2 + 0.5, 0, D / 2 - 0.5]) at(cyl(0.16, 0.18, 0.7, DARK_WOOD, 6), x, 0.2, z, g);

  // The shack: four corner posts, a back wall of boards painted in sea colours, low side walls.
  const SW = 8.4;
  const SD = 3.4;
  const sx = -1.2;
  const back = -D / 2 + 0.5;
  for (const dx of [-SW / 2, SW / 2]) for (const dz of [0, SD]) at(box(0.24, 3.1, 0.24, DRIFTWOOD), sx + dx, F + 1.55, back + dz, g);
  for (let k = 0; k < 12; k++) at(box(0.68, 2.7, 0.12, k % 2 ? 0x62bcb4 : PAL.ivory), sx - SW / 2 + 0.35 + k * 0.7, F + 1.35, back, g);
  for (const dx of [-SW / 2, SW / 2]) {
    for (let k = 0; k < 4; k++) at(box(0.12, 1.15, 0.68, k % 2 ? PAL.ivory : 0x62bcb4), sx + dx, F + 0.58, back + 0.45 + k * 0.7, g);
  }
  // The counter faces the sea: a front of split bamboo under a worn wooden top.
  const front = back + SD;
  at(box(SW, 1.15, 0.5, BAMBOO), sx, F + 0.58, front, g);
  for (let k = 0; k < 14; k++) at(box(0.06, 1.15, 0.52, 0xb8904a), sx - SW / 2 + 0.3 + k * 0.6, F + 0.58, front, g);
  at(box(SW + 0.5, 0.12, 1.0, 0xe8d2a0), sx, F + 1.22, front + 0.1, g);
  // On it: a bowl of lemons, glasses with their straws, a blender; coconuts at the end.
  at(cyl(0.34, 0.24, 0.16, PAL.ivory, 8), sx - 2.6, F + 1.36, front + 0.1, g);
  for (let k = 0; k < 5; k++) at(ball(0.11, 0xf2d24a, {}, 5, 4), sx - 2.6 + Math.cos(k * 1.3) * 0.16, F + 1.5 + (k % 2) * 0.08, front + 0.1 + Math.sin(k * 1.3) * 0.16, g);
  for (const [dx, color] of [[-0.9, PAL.coral], [0.2, 0x9fd8c8], [1.1, PAL.saffron], [2.4, PAL.pink]]) {
    at(cyl(0.1, 0.08, 0.3, color, 6), sx + dx, F + 1.43, front + 0.2, g);
    at(cyl(0.015, 0.015, 0.3, PAL.ivory, 3), sx + dx + 0.05, F + 1.65, front + 0.2, g).rotation.z = -0.3;
  }
  at(cyl(0.14, 0.18, 0.2, INK, 6), sx + 3.3, F + 1.38, front, g);
  at(cyl(0.16, 0.12, 0.4, 0xcfe8ec, 6), sx + 3.3, F + 1.68, front, g);
  for (const [dx, dz] of [[0, 0], [0.3, 0.12], [0.14, -0.2]]) at(ball(0.17, 0x7a5a44, { flat: true }, 5, 4), sx - 3.7 + dx, F + 1.44, front + dz, g);
  // Shelves of bottles against the back wall.
  const bottles = [];
  for (let row = 0; row < 2; row++) {
    at(box(SW - 1, 0.08, 0.4, PAL.wood), sx, F + 1.5 + row * 0.8, back + 0.3, g);
    for (let x = sx - SW / 2 + 0.8; x < sx + SW / 2 - 0.8; x += 0.3 + rng() * 0.15) bottles.push([x, F + 1.54 + row * 0.8, back + 0.3]);
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

  // The thatch: three shaggy layers, deep eaves all round, a fringe hanging from the lowest.
  const eave = F + 3.1;
  at(thatch(SW + 2.6, SD + 2.8, 0.7, 0.72, STRAW[0]), sx, eave + 0.35, back + SD / 2, g);
  at(thatch((SW + 2.6) * 0.74, (SD + 2.8) * 0.74, 0.7, 0.62, STRAW[1]), sx, eave + 0.95, back + SD / 2, g);
  at(thatch((SW + 2.6) * 0.48, (SD + 2.8) * 0.48, 0.7, 0.3, STRAW[2]), sx, eave + 1.55, back + SD / 2, g);
  at(box(SW + 2.7, 0.22, SD + 2.9, STRAW[2]), sx, eave - 0.08, back + SD / 2, g);

  // Bar stools along the counter.
  for (let i = 0; i < 5; i++) {
    const x = sx - 3 + i * 1.5;
    at(cyl(0.3, 0.3, 0.1, STRAW[1], 8), x, F + 0.95, front + 1.2, g);
    seat(g, x, F + 1.02, front + 1.2, Math.PI);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) at(cyl(0.035, 0.045, 0.9, DRIFTWOOD, 4), x + dx, F + 0.45, front + 1.2 + dz, g);
  }

  // Surfboards leaning against the side of the shack, and a lifebuoy on its corner post.
  [PAL.coral, 0x62bcb4, PAL.saffron].forEach((color, i) => {
    const board = at(ball(1, color, {}, 10, 6), sx + SW / 2 + 0.5 + i * 0.55, F + 1.5, back + 0.9 + i * 0.5, g);
    board.scale.set(0.3, 1.5, 0.06);
    board.rotation.set(0.12, 0.2, -0.14);
    const stripe = at(ball(1, PAL.ivory, {}, 8, 4), sx + SW / 2 + 0.5 + i * 0.55, F + 1.5, back + 0.96 + i * 0.5, g);
    stripe.scale.set(0.06, 1.4, 0.04);
    stripe.rotation.set(0.12, 0.2, -0.14);
  });
  at(ring(0.34, 0.1, PAL.ivory, Math.PI * 2, 10), sx - SW / 2, F + 2.0, front + 0.16, g);
  for (let k = 0; k < 4; k++) at(box(0.2, 0.22, 0.22, PAL.red), sx - SW / 2 + Math.cos(k * Math.PI * 0.5 + 0.8) * 0.34, F + 2.0 + Math.sin(k * Math.PI * 0.5 + 0.8) * 0.34, front + 0.16, g);

  // Straw parasols with their deckchairs, out on the boards toward the water.
  for (const [x, z] of [[-4.6, 2.6], [0.4, 3.6], [4.9, 2.2]]) palapa(g, rng, x, F, z);

  // A hammock slung between two posts.
  for (const z of [-0.6, 2.6]) at(cyl(0.1, 0.12, 2.4, DRIFTWOOD, 6), W / 2 - 0.9, F + 1.2, z, g);
  const hammock = at(ring(1.6, 0.34, PAL.ivory, Math.PI, 8), W / 2 - 0.9, F + 2.0, 1, g);
  hammock.rotation.set(Math.PI, Math.PI / 2, 0);
  hammock.scale.set(1, 0.42, 1.5);

  // Potted palms and an agave at the corners.
  for (const [x, z] of [[-W / 2 + 0.8, D / 2 - 0.8], [W / 2 - 0.8, D / 2 - 0.8], [-W / 2 + 0.8, -1.5]]) plant(g, x, F, z, rng);

  // Strings of little lamps from the eaves to two poles at the front of the boardwalk.
  const poles = [[-W / 2 + 0.4, D / 2 - 0.4], [W / 2 - 0.4, D / 2 - 0.4]];
  for (const [x, z] of poles) at(cyl(0.08, 0.11, 4.2, DRIFTWOOD, 6), x, F + 2.1, z, g);
  const bulbs = [PAL.saffron, PAL.pink, 0x9fe8d8, WARM_LIGHT];
  const corners = [[sx - SW / 2 - 1.2, front + 1.3], [sx + SW / 2 + 1.2, front + 1.3]];
  const strings = [[corners[0], corners[1], eave - 0.1, eave - 0.1], [corners[0], poles[0], eave - 0.1, F + 4.1], [corners[1], poles[1], eave - 0.1, F + 4.1], [poles[0], poles[1], F + 4.1, F + 4.1]];
  strings.forEach(([[ax, az], [bx, bz], ay, by], e) => {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.9);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      at(ball(0.14, bulbs[(i + e) % 4], { glow: true }, 6, 4), ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * 0.6, az + (bz - az) * t, g);
    }
  });
  for (const [x, z] of [[sx, front + 1.4], [-3.5, 3.5], [3.5, 3.5]]) lamplight(g, x, F + 3, z, 7);

  // The sign over the counter, hand-painted on a board.
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f3ead6';
  ctx.fillRect(0, 0, 64, 24);
  ctx.fillStyle = '#2f8a8a';
  ctx.fillRect(0, 0, 64, 3);
  ctx.fillRect(0, 21, 64, 3);
  ctx.fillStyle = '#c9443c';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BAGNO BOB', 32, 16);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  const sign = at(solid(new THREE.BoxGeometry(3, 1.1, 0.1), paint(0xffffff, { map: tex })), sx, eave - 0.75, front + 1.5, g);
  animated.push((t) => (sign.rotation.x = Math.sin(t * 0.8) * 0.05));
}

/** A sunflower, its head turned toward the sun. */
export function sunFlower(rng) {
  const g = new THREE.Group();
  const H = 1.5 + rng() * 0.9;
  at(cyl(0.05, 0.07, H, 0x5f8a45, 5), 0, H / 2, 0, g);
  for (const s of [-1, 1]) at(ball(0.22, 0x5f8a45, { flat: true }, 5, 3), s * 0.22, H * (0.45 + s * 0.12), 0, g).scale.set(1, 0.35, 0.7);
  const head = at(new THREE.Group(), 0, H, 0, g);
  const disc = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10);
  disc.rotateX(Math.PI / 2);
  head.add(solid(disc, paint(0xf0c93a, { flat: true })));
  at(ball(0.2, 0x6a4a30, {}, 8, 6), 0, 0, 0.04, head).scale.z = 0.4;
  head.lookAt(head.getWorldPosition(new THREE.Vector3()).add(SUN_DIR));
  return g;
}

/**
 * A gozzo, the little wooden boat of every Ligurian harbour: a round-bilged hull drawn out
 * long, a stem and stern post standing up at the ends, a white rubbing strake all round, a
 * planked deck with two thwarts, a pair of oars shipped along the gunwale, a rudder, a coil
 * of rope and a buoy. Some carry a lateen sail on a long yard.
 */
export function gozzo(rng, sail = false) {
  const g = new THREE.Group();
  const color = pick(rng, [PAL.blue, PAL.red, PAL.saffron, PAL.teal, PAL.coral, PAL.ivory, 0x2f6f8f, 0x4f9a50, 0xe8873a]);
  const trim = color === PAL.ivory ? PAL.blue : PAL.ivory;
  const hull = at(solid(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), paint(color, { doubleSide: true })), 0, 0.42, 0, g);
  hull.scale.set(0.9, 0.8, 2.3);
  // The strake at the gunwale and a darker boot-top at the waterline.
  const strake = at(ring(1, 0.06, trim, Math.PI * 2, 28), 0, 0.42, 0, g);
  strake.rotation.x = Math.PI / 2;
  strake.scale.set(0.92, 2.32, 1);
  const boot = at(ring(1, 0.04, 0x5a3a36, Math.PI * 2, 28), 0, 0.08, 0, g);
  boot.rotation.x = Math.PI / 2;
  boot.scale.set(0.83, 2.15, 1);
  // Stem and stern posts, the bow the higher.
  at(box(0.14, 0.55, 0.3, trim), 0, 0.6, 2.2, g).rotation.x = -0.35;
  at(box(0.14, 0.4, 0.24, trim), 0, 0.52, -2.2, g).rotation.x = 0.3;
  // Deck, thwarts, a rudder hung at the stern.
  at(box(1.5, 0.06, 3.7, 0xb98a5a), 0, 0.3, 0, g);
  for (const z of [-0.7, 0.6]) at(box(1.55, 0.1, 0.3, 0x9a6a48), 0, 0.44, z, g);
  at(box(0.06, 0.6, 0.3, DARK_WOOD), 0, 0.15, -2.3, g);
  // Oars shipped along the gunwale, a coil of rope in the bow, a buoy by the stern thwart.
  for (const sx of [-0.56, 0.56]) {
    at(cyl(0.03, 0.03, 2.9, 0xd9bb8a, 4), sx, 0.5, 0.3, g).rotation.x = Math.PI / 2;
    at(box(0.1, 0.03, 0.5, 0xd9bb8a), sx, 0.5, -1.4, g);
  }
  at(ring(0.17, 0.05, PAL.cream, Math.PI * 2, 10), 0.28, 0.36, 1.4, g).rotation.x = Math.PI / 2;
  at(ball(0.14, PAL.coral, {}, 6, 4), -0.42, 0.44, -1.1, g);
  if (sail) {
    at(cyl(0.05, 0.06, 3.4, PAL.wood, 5), 0, 2, 0.3, g);
    const yard = at(cyl(0.03, 0.04, 4.2, PAL.wood, 4), 0.1, 2.9, 0.8, g);
    yard.rotation.set(-0.95, 0, 0.05);
    const canvas = solid(new THREE.ConeGeometry(1.1, 2.8, 3), paint(PAL.ivory));
    canvas.scale.z = 0.08;
    at(canvas, 0.55, 2.1, 0.3, g);
  }
  return g;
}

/** A gull at rest on a post or a rail, wings folded, looking out to sea. */
export function perchedGull(parent, x, y, z, yaw = 0) {
  const g = at(new THREE.Group(), x, y, z, parent);
  g.rotation.y = yaw;
  at(ball(0.26, 0xf4f2ee, { flat: true }, 6, 4), 0, 0.3, 0, g).scale.set(0.7, 0.65, 1.3);
  at(box(0.42, 0.1, 0.56, 0xb9c0cc), 0, 0.42, -0.06, g);
  at(box(0.14, 0.05, 0.26, INK), 0, 0.32, -0.5, g);
  at(ball(0.15, 0xf4f2ee, { flat: true }, 5, 4), 0, 0.52, 0.3, g);
  at(cone(0.045, 0.2, PAL.saffron, 4), 0, 0.5, 0.48, g).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) at(cyl(0.02, 0.02, 0.2, PAL.saffron, 3), s * 0.07, 0.1, 0.05, g);
  return g;
}

/**
 * A little red seaplane of the Adriatic kind: a boat hull, one high wing on struts with the
 * engine in a pod above it, floats under the wing tips, the tricolour on its fin. Returns the
 * plane and its propeller.
 */
export function seaplane() {
  const g = new THREE.Group();
  const RED = 0xc9382e;
  const DEEP = 0x8f2a24;
  const hull = at(ball(1, RED, {}, 12, 8), 0, 0.55, 0, g);
  hull.scale.set(0.72, 0.62, 3.6);
  at(box(0.9, 0.12, 5.0, DEEP), 0, 0.16, 0.2, g);
  at(box(0.66, 0.28, 1.1, INK), 0, 1.04, 0.5, g);
  at(box(0.7, 0.4, 0.08, 0x9fd8e8), 0, 1.24, 1.1, g).rotation.x = -0.45;
  at(ball(0.2, PAL.skin, {}, 6, 4), 0, 1.28, 0.5, g);
  // The wing, carried above the hull, with a cream band at each tip.
  at(box(9.6, 0.16, 1.7, RED), 0, 2.35, 0.6, g);
  for (const s of [-1, 1]) {
    at(box(1.1, 0.17, 1.72, PAL.ivory), s * 3.9, 2.35, 0.6, g);
    at(cyl(0.85, 0.85, 0.16, RED, 10), s * 4.8, 2.35, 0.6, g).scale.z = 1;
    for (const z of [0.1, 1.1]) at(box(0.07, 1.5, 0.07, INK), s * 0.5, 1.6, z, g).rotation.z = s * 0.2;
    // Stabilising floats on their struts.
    const float = at(ball(1, RED, {}, 8, 6), s * 3.7, 0.3, 0.6, g);
    float.scale.set(0.24, 0.24, 1.0);
    for (const z of [0.2, 1.0]) at(box(0.06, 1.9, 0.06, INK), s * 3.7, 1.3, z, g);
  }
  // The engine pod above the wing, and its two-bladed propeller.
  at(cyl(0.36, 0.3, 1.6, 0x8a8a96, 8), 0, 2.95, 0.6, g).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) at(box(0.07, 0.6, 0.07, INK), s * 0.22, 2.62, 0.6, g);
  const prop = at(live(new THREE.Group()), 0, 2.95, 1.45, g);
  at(box(0.14, 2.0, 0.05, 0x5a4034), 0, 0, 0, prop);
  at(ball(0.14, 0xd8d4e0, {}, 6, 4), 0, 0, 0.02, prop);
  // Tailplane and fin, the fin striped green, white and red.
  at(box(2.8, 0.1, 0.9, RED), 0, 1.25, -3.1, g);
  at(box(0.1, 1.3, 1.0, RED), 0, 1.5, -3.2, g);
  [0x3f8a55, PAL.ivory, RED].forEach((color, i) => at(box(0.12, 0.8, 0.26, color), 0, 1.7, -3.52 + i * 0.26, g));
  return { plane: bake(g), prop };
}

/** A string of little coloured lamps sagging between two points, as hung for a village fête. */
export function festoon(parent, ax, ay, az, bx, by, bz, sag = 0.7) {
  const bulbs = [WARM_LIGHT, PAL.saffron, 0xffb8a8, 0x9fe8d8, WARM_LIGHT, PAL.pink];
  const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay, bz - az) / 0.85));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    at(ball(0.13, bulbs[i % bulbs.length], { glow: true }, 5, 4), ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * sag, az + (bz - az) * t, parent);
  }
  lamplight(parent, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, 5.5);
}

/**
 * Tall striped lighthouse on an octagonal base, with a gallery and a glowing lantern room. The
 * tower is drawn `size` times its model, so that its door and windows are the avatar's own;
 * the base stays the width of the rock it stands on. Returns the height of the base.
 */
export function lighthouse(parent, x, y, z, size = 1) {
  const root = at(new THREE.Group(), x, y, z, parent);
  const BASE = 3.2;
  at(cyl(4.3, 4.7, BASE, STONE, 8, { flat: true }), 0, BASE / 2, 0, root);
  at(cyl(4.5, 4.5, 0.2, PAL.cream, 8), 0, BASE + 0.1, 0, root);
  // The model stands its tower on a base 2.6 high: it is lifted onto the real one and scaled.
  const g = at(new THREE.Group(), 0, BASE + 0.2 - 2.6 * size, 0, root);
  g.scale.setScalar(size);
  at(box(0.95, 1.7, 0.1, DARK_WOOD), 0, 3.5, 1.86, g);
  at(box(1.15, 0.16, 0.14, PAL.cream), 0, 4.42, 1.86, g);
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const r0 = 1.9 - i * 0.12;
    at(cyl(r0 - 0.12, r0, 2.4, i % 2 ? PAL.red : PAL.ivory, 14), 0, 3.8 + i * 2.4, 0, g);
  }
  for (let i = 1; i < 4; i++) at(box(0.4, 0.7, 0.1, 0x3b3346), 0, 4.5 + i * 3.3, 1.85 - i * 0.18, g);
  const top = 2.6 + stripes * 2.4;
  at(cyl(1.75, 1.75, 0.3, INK, 14), 0, top + 0.15, 0, g);
  at(ring(1.65, 0.06, INK, Math.PI * 2, 18), 0, top + 0.95, 0, g).rotation.x = Math.PI / 2;
  for (let k = 0; k < 12; k++) at(cyl(0.04, 0.04, 0.8, INK, 4), Math.cos((k / 12) * Math.PI * 2) * 1.65, top + 0.6, Math.sin((k / 12) * Math.PI * 2) * 1.65, g);
  at(cyl(1.05, 1.05, 1.6, PAL.saffron, 10, { glow: true }), 0, top + 1.1, 0, g);
  // Where the beam that sweeps the sea at night comes from.
  at(new THREE.Object3D(), 0, top + 1.1, 0, g).userData.beacon = true;
  for (let k = 0; k < 6; k++) at(box(0.08, 1.6, 0.08, INK), Math.cos((k / 6) * Math.PI * 2) * 1.07, top + 1.1, Math.sin((k / 6) * Math.PI * 2) * 1.07, g);
  at(solid(new THREE.SphereGeometry(1.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint(PAL.red)), 0, top + 1.9, 0, g);
  at(cyl(0.06, 0.06, 1.2, INK, 4), 0, top + 3.4, 0, g);
  at(ball(0.22, PAL.saffron, { glow: true }, 6, 4), 0, top + 4.0, 0, g);
  perchedGull(g, 1.2, top + 1.0, 1.15, 0.8);
  return BASE;
}

/** A small fishmonger's stall: trestle table with ice and fish, striped awning, scales, sign. */
function fishStall(parent, rng, x, z, yaw) {
  const s = at(new THREE.Group(), x, 0.2, z, parent);
  s.rotation.y = yaw;
  const color = pick(rng, [PAL.red, PAL.teal, PAL.blue, PAL.coral]);
  for (const [dx, dz] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]]) at(box(0.12, 0.9, 0.12, PAL.wood), dx, 0.45, dz, s);
  at(box(2.9, 0.12, 1.4, PAL.wood), 0, 0.95, 0, s);
  at(box(2.7, 0.12, 1.2, 0xdff2f4), 0, 1.06, 0, s);
  // Fish laid out on the ice.
  for (let k = 0; k < 8; k++) {
    const fish = at(ball(0.13, pick(rng, [0xc8d4e0, 0xa8b8c8, PAL.coral, 0xd8c8a0]), {}, 6, 4), -1.1 + (k % 4) * 0.7, 1.18, -0.3 + Math.floor(k / 4) * 0.6, s);
    fish.scale.set(2.4, 0.6, 0.9);
    fish.rotation.y = (rng() - 0.5) * 0.6;
  }
  for (const dx of [-0.9, 0.9]) at(cyl(0.18, 0.16, 0.2, PAL.ivory, 8), dx, 1.2, 0.45, s);
  // Awning on two poles.
  for (const dx of [-1.4, 1.4]) at(cyl(0.05, 0.05, 2.6, INK, 4), dx, 1.3, -0.7, s);
  const awning = at(new THREE.Group(), 0, 2.55, -0.1, s);
  awning.rotation.x = -0.3;
  for (let k = 0; k < 6; k++) at(box(0.52, 0.05, 1.6, k % 2 ? PAL.ivory : color), -1.3 + k * 0.52, 0, 0, awning);
  // Sign, scales and a crate on the ground.
  at(box(1.2, 0.4, 0.06, INK), 0, 2.2, -0.72, s);
  at(box(0.8, 0.08, 0.03, PAL.saffron), 0, 2.2, -0.68, s);
  at(cyl(0.04, 0.04, 0.5, INK, 4), 1.2, 1.35, 0, s);
  at(cyl(0.2, 0.2, 0.04, 0xd8d4e0, 10), 1.2, 1.6, 0, s);
  at(box(0.9, 0.4, 0.6, PAL.blue), -0.6, 0.0, 1.1, s);
}

/** The bearing of the open sea from a point of the shore: toward the deepest water around it. */
function seaward(x, z) {
  let best = { depth: Infinity, angle: 0 };
  for (let k = 0; k < 48; k++) {
    const angle = (k / 48) * Math.PI * 2;
    const depth = groundAt(x + Math.sin(angle) * 30, z + Math.cos(angle) * 30);
    if (depth < best.depth) best = { depth, angle };
  }
  return best.angle;
}

/** Mussels crowding a pile where the tide washes it: blue-black shells, a pale barnacle or two. */
function mussels(parent, rng, x, z, radius = 0.17) {
  for (let k = 0; k < 9; k++) {
    const a = rng() * Math.PI * 2;
    const shell = at(ball(0.1 + rng() * 0.05, rng() < 0.12 ? 0xcfcabb : pick(rng, [0x23283c, 0x2f3550, 0x1b1f30, 0x343a5a]), { flat: true }, 5, 4), x + Math.cos(a) * radius, WATER_LEVEL - 0.25 + rng() * 0.85, z + Math.sin(a) * radius, parent);
    shell.scale.set(0.8, 1.5, 0.8);
  }
}

/**
 * The observatory on the summit, grown over the years into a little compound, nothing about it
 * symmetrical: the whitewashed round tower under its copper dome gone green, set to one side of
 * a flagged upper terrace behind a dry-stone parapet, its slit open to the sky with the
 * telescope looking out of it; the astronomers' house built on to the tower's side, two
 * storeys under a flat roof with a pergola over one end and a small second dome on a drum over
 * the other; and a lower terrace cut into the gentler slope a flight of steps down, with a
 * bench for the night, a pair of telescopes on the parapet, a cistern, a tool shed and a lemon
 * tree. The trail to the station leaves the lower terrace; a goat track leaves the upper one.
 */
export function buildObservatory(scene, rng) {
  const g = new THREE.Group();
  const y = groundAt(OBSERVATORY.x, OBSERVATORY.z);
  g.position.set(OBSERVATORY.x, y, OBSERVATORY.z);
  const R = OBSERVATORY.r;
  const L = OBSERVATORY.lower;
  const WHITE = 0xf3ebdd;
  const COPPER = 0x5f9a86;
  const DRY = 0xd6c8ad;
  const stairAngle = Math.atan2(L.dz, L.dx);
  const near = (a, b, tol) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < tol;
  /** A ring of dry-stone wall at `radius`, left open where `skip` says. */
  const parapet = (parent, radius, count, skip) => {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      if (skip(a)) continue;
      const wall = at(box((2 * Math.PI * radius) / count + 0.12, 0.7, 0.4, DRY), Math.cos(a) * (radius - 0.2), 0.7, Math.sin(a) * (radius - 0.2), parent);
      wall.rotation.y = Math.PI / 2 - a;
    }
  };

  // The upper terrace: flagstones, a parapet with a gap for the steps down and one for the
  // goat track, a cistern by the house and two cypresses at the back.
  at(cyl(R, R + 0.4, 0.5, STONE, 28, { flat: true }), 0, 0.15, 0, g);
  at(cyl(R + 0.5, R + 0.9, 0.7, 0xc9b99c, 28, { flat: true }), 0, -0.3, 0, g);
  parapet(g, R, 28, (a) => near(a, stairAngle, 0.2) || near(a, -Math.PI / 4, 0.14));
  at(cyl(1.3, 1.4, 1.3, 0xc9b99c, 12), 6.2, 0.65, 2.6, g);
  at(cyl(1.35, 1.35, 0.12, DARK_WOOD, 12), 6.2, 1.36, 2.6, g);
  for (const [x, z] of [[-6.2, -4.4], [-4.6, -5.8]]) at(cypress(rng), x, 0.3, z, g).scale.setScalar(0.9 + rng() * 0.2);

  // The tower, to one side, and its dome.
  const tower = at(new THREE.Group(), -2.6, 0, -1.8, g);
  at(cyl(3.6, 3.8, 6.4, WHITE, 18), 0, 3.5, 0, tower);
  at(cyl(4.0, 4.0, 0.3, 0xc9b99c, 18), 0, 0.55, 0, tower);
  at(cyl(3.9, 3.6, 0.3, WHITE, 18), 0, 6.8, 0, tower);
  at(ring(3.75, 0.12, COPPER, Math.PI * 2, 18), 0, 7.05, 0, tower).rotation.x = Math.PI / 2;
  const dome = at(ball(3.7, COPPER, { flat: true }, 18, 9), 0, 7.0, 0, tower);
  dome.scale.y = 0.9;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    at(box(0.12, 3.0, 0.12, 0x4d8070), Math.cos(a) * 2.5, 9.1, Math.sin(a) * 2.5, tower).rotation.set(-Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7);
  }
  // The slit, open, with the telescope tilted out of it toward the night sky.
  const slit = at(new THREE.Group(), 0, 7.0, 0, tower);
  slit.rotation.y = -0.6;
  at(box(1.0, 3.6, 1.3, INK), 0, 1.8, 2.8, slit).rotation.x = -0.4;
  const scope = at(new THREE.Group(), 0, 1.1, 1.2, slit);
  scope.rotation.x = -0.9;
  at(cyl(0.3, 0.38, 3.8, 0x8a8a96, 10), 0, 1.6, 0, scope);
  at(cyl(0.4, 0.4, 0.3, INK, 10), 0, 3.6, 0, scope);
  at(ring(0.34, 0.05, PAL.saffron, Math.PI * 2, 10), 0, 3.75, 0, scope);
  // A door at the foot of the tower, a band of windows, the lantern, a weathervane.
  at(box(1.1, 2.3, 0.2, DARK_WOOD), 0, 1.15, 3.7, tower);
  at(box(1.3, 0.2, 0.3, 0xc9b99c), 0, 2.35, 3.7, tower);
  for (let k = 0; k < 7; k++) {
    const a = 0.9 + (k / 7) * Math.PI * 1.5;
    at(box(0.6, 0.9, 0.1, 0x3b3346), Math.sin(a) * 3.7, 4.6, Math.cos(a) * 3.7, tower).rotation.y = a;
  }
  lantern(tower, 1.4, 0.5, 3.9, { toward: [2.8, 7.8] });
  at(cyl(0.04, 0.04, 1.2, INK, 5), 0, 10.8, 0, tower);
  at(box(0.7, 0.25, 0.03, PAL.red), 0.35, 11.2, 0, tower);

  // The astronomers' house, built on to the tower: whitewash and green shutters, a stone
  // string course, a flat roof with its parapet, the pergola over one end, the little dome on
  // its drum over the other, a chimney, and a stone stair up the back wall to the roof.
  const house = at(new THREE.Group(), 3.4, 0, -0.6, g);
  const W = 7.4;
  const D = 4.8;
  const H = 5.4;
  at(box(W, H, D, WHITE), 0, H / 2, 0, house);
  at(box(W + 0.14, 0.6, D + 0.14, 0xc9b99c), 0, 0.3, 0, house);
  at(box(W + 0.12, 0.14, D + 0.12, 0xe6dcc8), 0, 2.7, 0, house);
  at(box(W + 0.3, 0.2, D + 0.3, 0xe6dcc8), 0, H + 0.1, 0, house);
  for (const [x, z, sx, sz] of [[0, D / 2, W, 0.14], [0, -D / 2, W, 0.14], [W / 2, 0, 0.14, D], [-W / 2, 0, 0.14, D]]) at(box(sx + 0.1, 0.5, sz + 0.1, WHITE), x, H + 0.45, z, house);
  const window = (x, yy, z) => {
    at(box(0.8, 1.2, 0.08, 0xe6dcc8), x, yy, z, house);
    at(box(0.62, 1.05, 0.1, 0x3b3346), x, yy, z + Math.sign(z) * 0.02, house);
    for (const s of [-1, 1]) at(box(0.3, 1.05, 0.06, 0x4d7a62), x + s * 0.5, yy, z + Math.sign(z) * 0.04, house);
  };
  for (const x of [-2.4, 2.4]) window(x, 1.5, D / 2 + 0.02);
  for (const x of [-2.4, -0.8, 0.8, 2.4]) window(x, 4.1, D / 2 + 0.02);
  for (const x of [-2.4, -0.8, 0.8, 2.4]) for (const yy of [1.5, 4.1]) window(x, yy, -D / 2 - 0.02);
  at(box(1.2, 2.2, 0.1, 0xe6dcc8), 0, 1.1, D / 2 + 0.02, house);
  at(box(1.0, 2.1, 0.12, DARK_WOOD), 0, 1.05, D / 2 + 0.04, house);
  at(box(1.6, 0.14, 0.9, STONE), 0, 0.07, D / 2 + 0.5, house);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) at(cyl(0.08, 0.08, 2.2, DARK_WOOD, 5), -1.6 + sx * 1.5, H + 1.3, sz * 1.5, house);
  at(box(3.4, 0.08, 3.4, DARK_WOOD), -1.6, H + 2.4, 0, house);
  for (let k = 0; k < 6; k++) at(ball(0.5, 0x5f8e4c, { leaf: true }, 6, 4), -1.6 + (rng() - 0.5) * 2.8, H + 2.55, (rng() - 0.5) * 2.8, house).scale.set(1.8, 0.5, 1.8);
  at(cyl(1.5, 1.5, 1.4, WHITE, 14), 2.3, H + 0.9, 0, house);
  at(ring(1.55, 0.08, COPPER, Math.PI * 2, 14), 2.3, H + 1.65, 0, house).rotation.x = Math.PI / 2;
  at(ball(1.55, COPPER, { flat: true }, 14, 7), 2.3, H + 1.6, 0, house).scale.y = 0.85;
  at(box(0.5, 1.4, 0.7, INK), 2.3, H + 2.3, 0.3, house).rotation.x = -0.5;
  at(box(0.5, 1.2, 0.5, WHITE), -3.0, H + 0.8, -1.4, house);
  for (let k = 0; k < 12; k++) at(box(0.9, 0.3, 0.5, STONE), -W / 2 + 0.6 + k * 0.5, 0.15 + k * 0.45, -D / 2 - 0.5, house);

  // The steps down to the lower terrace.
  const steps = Math.ceil(L.drop / 0.32);
  for (let k = 0; k < steps; k++) {
    const d = R + 0.3 + k * 0.34;
    const step = at(box(2.4, 0.32, 0.4, STONE), Math.cos(stairAngle) * d, -0.16 - k * 0.32, Math.sin(stairAngle) * d, g);
    step.rotation.y = Math.PI / 2 - stairAngle;
  }

  // The lower terrace: flagstones, its own parapet with a gap toward the steps and one where
  // the trail leaves, the bench facing out over the bay, the telescopes, a lantern, the
  // cistern, the shed and a lemon tree.
  const lower = at(new THREE.Group(), L.dx, -L.drop, L.dz, g);
  at(cyl(L.r, L.r + 0.4, 0.5, STONE, 22, { flat: true }), 0, 0.15, 0, lower);
  at(cyl(L.r + 0.5, L.r + 1.0, 2.2, 0xc9b99c, 22, { flat: true }), 0, -1.05, 0, lower);
  parapet(lower, L.r, 22, (a) => near(a, stairAngle + Math.PI, 0.26) || near(a, Math.PI / 2, 0.2));
  const bench = at(new THREE.Group(), -1.6, 0.5, 2.6, lower);
  at(box(2.0, 0.14, 0.6, PAL.wood), 0, 0.5, 0, bench);
  at(box(2.0, 0.5, 0.1, PAL.wood), 0, 0.85, -0.28, bench);
  for (const dx of [-0.8, 0.8]) at(box(0.14, 0.5, 0.56, INK), dx, 0.25, 0, bench);
  for (const dx of [-0.5, 0.5]) seat(bench, dx, 0.57, 0, 0);
  for (const a of [0.1, 0.95]) {
    const stand = at(new THREE.Group(), Math.cos(a) * (L.r - 0.9), 0.5, Math.sin(a) * (L.r - 0.9), lower);
    at(cyl(0.05, 0.08, 1.2, INK, 6), 0, 0.6, 0, stand);
    const eye = at(cyl(0.1, 0.14, 0.7, 0x8a8a96, 8), 0, 1.3, 0, stand);
    eye.rotation.set(Math.PI / 2 - 0.35, 0, -a + Math.PI / 2);
  }
  lantern(lower, 2.6, 0.5, -3.2, { toward: [0, 0] });
  const shed = at(new THREE.Group(), -2.8, 0.5, -2.6, lower);
  shed.rotation.y = 0.3;
  at(box(2.6, 2.0, 2.2, 0xe4d9c2), 0, 1.0, 0, shed);
  at(box(0.8, 1.5, 0.1, DARK_WOOD), 0.4, 0.75, 1.12, shed);
  at(cone(2.1, 0.9, 0xbc6444, 4, { flat: true }), 0, 2.45, 0, shed).rotation.y = Math.PI / 4;
  at(lemonTree(rng), 3.2, 0.4, 1.6, lower).scale.setScalar(0.75);
  scene.add(bake(g));
}

/**
 * The lighthouse stands alone on its rock out in the bay, with a little harbour of its own in
 * the lee of the rock: a short jetty of sandstone blocks, black with mussels at the waterline,
 * steps cut up to the tower, a lantern, a bollard, and the keeper's boat riding at her
 * mooring. Over on the shore, the landing stage she puts out from.
 */
export function buildLighthouseWalk(scene, rng, animated) {
  const g = new THREE.Group();
  g.position.set(ISLET.x, 0, ISLET.z);
  // Local +z looks from the rock toward the island, up the bay.
  g.rotation.y = -Math.PI * 0.75;
  const sin = Math.sin(g.rotation.y);
  const cos = Math.cos(g.rotation.y);
  const ground = (x, z) => groundAt(g.position.x + x * cos + z * sin, g.position.z - x * sin + z * cos);
  const BLOCK = [0xcdc2ab, 0xbcb09c, 0xd8cdb7];
  const BOULDER = [0x8f8678, 0x9d9484, 0xa99d8e];
  const TIMBER = [PAL.wood, 0xa8764f, 0x9a6a48];

  const foot = ground(0, 0) - 0.4;
  const door = foot + lighthouse(g, 0, foot, 0, 1.7) + 0.2;
  // A flight of stone steps down the face of the base from the door, then steps cut in the
  // rock on down to the landing in its lee.
  for (let z = 4.85, y = door; z < 9; ) {
    const rock = ground(0, z);
    if (y > rock + 0.3) {
      at(box(1.7, y - rock + 0.5, 0.38, STONE), 0, (y + rock - 0.5) / 2, z, g);
      y -= 0.3;
      z += 0.36;
      continue;
    }
    if (rock < WATER_LEVEL + 0.4) break;
    at(box(1.7, 0.32, 0.72, STONE), 0, rock + 0.1, z, g);
    z += 0.7;
  }
  // The jetty: blocks laid out from the landing, a parapet on the open side, mussels where
  // the tide washes them, a lantern and a bollard at the head.
  const QUAY = WATER_LEVEL + 0.8;
  for (let i = 0; i < 5; i++) {
    const z = 9.1 + i * 2.3;
    const bottom = Math.min(ground(0, z), WATER_LEVEL) - 0.6;
    at(box(3.0, QUAY - bottom, 2.3, BLOCK[i % 3]), 0, (QUAY + bottom) / 2, z, g);
    at(box(0.5, 0.8, 2.3, BLOCK[(i + 1) % 3]), -1.25, QUAY + 0.4, z, g);
    mussels(g, rng, 1.52, z - 0.7 + rng() * 1.4, 0.12);
    if (rng() < 0.6) mussels(g, rng, -1.52, z - 0.7 + rng() * 1.4, 0.12);
  }
  at(box(3.1, 0.1, 11.6, 0xd3c7b0), 0, QUAY + 0.05, 13.7, g);
  lantern(g, -0.85, QUAY + 0.1, 18.6, { toward: [0.5, 18.6] });
  at(cyl(0.14, 0.18, 0.7, INK, 6), 0.9, QUAY + 0.35, 18.4, g);
  at(ball(0.18, INK, {}, 6, 4), 0.9, QUAY + 0.72, 18.4, g);
  perchedGull(g, 0.9, QUAY + 0.86, 18.4, 2.6);
  perchedGull(g, -1.25, QUAY + 0.8, 12.4, -1.2);
  at(ring(0.3, 0.07, PAL.cream, Math.PI * 2, 10), 0.6, QUAY + 0.14, 11.6, g).rotation.x = Math.PI / 2;
  at(cyl(0.36, 0.36, 0.5, 0x5a6a7a, 8), -0.5, QUAY + 0.35, 10.6, g);
  at(ring(0.36, 0.03, PAL.saffron, Math.PI * 2, 10), -0.5, QUAY + 0.6, 10.6, g).rotation.x = Math.PI / 2;
  // The keeper's boat alongside, riding the swell.
  const boat = at(live(gozzo(rng)), 2.9, WATER_LEVEL, 14.5, g);
  boat.rotation.y = 0.08;
  animated.push((t) => {
    boat.position.y = WATER_LEVEL + Math.sin(t * 1.2) * 0.08;
    boat.rotation.z = Math.sin(t * 0.9) * 0.05;
  });
  // Boulders fallen round the foot of the rock, where the swell breaks on them.
  for (let k = 0; k < 14; k++) {
    const a = rng() * Math.PI * 2;
    if (Math.cos(a) > 0.6) continue; // not across the landing
    const d = ISLET.r * 0.5 + rng() * 5;
    const rock = at(solid(new THREE.DodecahedronGeometry(0.6 + rng() * 0.9, 0), paint(pick(rng, BOULDER), { flat: true })), Math.sin(a) * d, WATER_LEVEL - 0.5 + rng() * 0.8, Math.cos(a) * d, g);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    rock.scale.y = 0.7;
  }
  scene.add(bake(g));

  // On the shore, the landing stage the boat puts out from: planks on piles black with
  // mussels, a lantern and a bollard at the end.
  const stage = new THREE.Group();
  stage.position.set(toX(4, -72), 0, toZ(4, -72));
  stage.rotation.y = seaward(stage.position.x, stage.position.z);
  const ssin = Math.sin(stage.rotation.y);
  const scos = Math.cos(stage.rotation.y);
  const sground = (x, z) => groundAt(stage.position.x + x * scos + z * ssin, stage.position.z - x * ssin + z * scos);
  let shore = 12;
  while (shore > -60 && sground(21, shore) < WATER_LEVEL + 0.9) shore -= 0.62;
  const DECK = WATER_LEVEL + 1.0;
  for (let z = shore; z < shore + 11; z += 0.62) {
    at(box(2.8, 0.14, 0.56, pick(rng, TIMBER)), 21, DECK, z + 0.31, stage);
    if (Math.round((z - shore) / 0.62) % 5 === 2 && sground(21, z) < WATER_LEVEL - 0.2) {
      for (const dx of [-1.3, 1.3]) {
        at(cyl(0.14, 0.16, 4.2, DARK_WOOD, 6), 21 + dx, DECK - 2.0, z, stage);
        mussels(stage, rng, 21 + dx, z);
      }
    }
  }
  lantern(stage, 22.2, DECK + 0.08, shore + 1.5, { toward: [21, shore + 1.5] });
  at(cyl(0.14, 0.18, 0.7, INK, 6), 19.9, DECK + 0.4, shore + 10.4, stage);
  perchedGull(stage, 19.9, DECK + 0.75, shore + 10.4, 0.4);
  scene.add(bake(stage));
}

export function buildPort(g, rng, animated) {
  // The harbour starts from the quay of the village's sea front: local +z points out to sea
  // across it, local x runs along it (toward the plain).
  const front = villagePlan().lanes.find((l) => l.quay);
  const along = lanePoint(front, laneAt(front, g.position.x, g.position.z).s);
  const sea = front.seaSide;
  g.rotation.y = Math.atan2(-along.tz * sea, along.tx * sea);
  const surface = WATER_LEVEL;
  // The edge of the quay, out from the axis of its lane, and the top of its paving.
  const Q = front.half + front.quay;
  const quayTop = groundAt(g.position.x, g.position.z) + 0.1;
  const TIMBER = [PAL.wood, 0xa8764f, 0x9a6a48];
  // The decks of the harbour ride just over the water, as low as a landing can be.
  const DECK = surface + 0.5;
  // Everything from the quay out is built on the low deck.
  const deck = at(new THREE.Group(), 0, DECK - 0.12, 0, g);
  // Stone steps down from the quay onto each pier.
  const steps = (x, width) => {
    const n = Math.ceil((quayTop - DECK - 0.2) / 0.3);
    for (let k = 0; k < n; k++) at(box(width, 0.3, 0.62, k % 2 ? 0xd8cdb7 : 0xcdc2ab), x, quayTop - 0.15 - k * 0.3, Q + 0.31 + k * 0.62, g);
  };

  // A straight wooden jetty at the plain end of the quay, the pontoon farthest from the mole.
  const plank = (x, z, yaw, width) => {
    at(box(width, 0.14, 0.56, pick(rng, TIMBER)), x, 0.05, z, deck).rotation.y = yaw;
  };
  const pile = (x, z) => at(cyl(0.14, 0.16, 4.2, DARK_WOOD, 6), x, -1.7, z, deck);
  const JETTY = 19;
  // A red seaplane moored at the head of it, nose out to sea, her tail just off the last
  // planks and a line from her bow to the end pile, her propeller idling.
  const { plane, prop } = seaplane();
  at(live(plane), JETTY, surface + 0.1, Q + 25, g);
  at(box(0.04, 0.04, 3.6, 0xe6dcc8), JETTY + 1.1, DECK - 0.1, Q + 22.6, g).rotation.x = 0.06;
  animated.push((t, dt) => {
    plane.position.y = surface + 0.1 + Math.sin(t * 1.0) * 0.07;
    plane.rotation.z = Math.sin(t * 0.8) * 0.03;
    prop.rotation.z += dt * 3;
  });
  for (let z = Q + 0.4; z < Q + 21; z += 0.62) plank(JETTY, z + 0.31, 0, 3);
  for (let z = Q + 1.2; z < Q + 21; z += 3) for (const dx of [-1.4, 1.4]) pile(JETTY + dx, z);
  lantern(deck, JETTY + 1, 0.13, Q + 20.4, { toward: [JETTY, Q + 20.4] });
  steps(JETTY, 3);
  // Two wooden piers.
  for (const px of [-8, 6]) {
    for (let i = 0; i < 30; i++) at(box(2.6, 0.16, 0.56, PAL.wood), px, 0.05, Q + 0.4 + i * 0.62, deck);
    for (let z = Q + 1; z < Q + 19; z += 2.8) for (const dx of [-1.2, 1.2]) at(cyl(0.13, 0.13, 3.6, DARK_WOOD, 6), px + dx, -1.7, z, deck);
    lantern(deck, px + 1.1, 0.13, Q + 18.6, { toward: [px, Q + 18.6] });
    steps(px, 2.6);
  }
  for (let z = Q + 2; z < Q + 19; z += 2.8) for (const px of [-8, 6]) for (const dx of [-1.2, 1.2]) mussels(deck, rng, px + dx, z, 0.14);

  // The sea bed under a point of the harbour, in the deck's own frame.
  const sin = Math.sin(g.rotation.y);
  const cos = Math.cos(g.rotation.y);
  const bedAt = (x, z) => groundAt(g.position.x + x * cos + z * sin, g.position.z - x * sin + z * cos) - (DECK - 0.12);
  const BOULDER = [0xcfc3b0, 0xb9ad9c, 0xa99d8e];
  const BLOCK = [0xcdc2ab, 0xbcb09c, 0xd8cdb7];
  const boulder = (x, y, z, r) => {
    const rock = at(solid(new THREE.IcosahedronGeometry(r, 0), paint(pick(rng, BOULDER), { flat: true })), x, y, z, deck);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    rock.scale.y = 0.7;
  };

  // A stone mole shelters the harbour, as at Manarola: big blocks of sandstone running out
  // from the hill end of the quay, across the water from the houses, and curving round in
  // front of the piers, a parapet on the weather side, boulders heaped at its foot, bollards
  // along its lee and a little green light at its head. Boats lie moored in its shelter.
  // Its root is set into the end of the quay, a few steps down from the paving.
  const mole = (t) => [-22 + 15 * (1 - Math.cos(t * Math.PI * 0.5)), Q - 2.6 + 38 * Math.sin(t * Math.PI * 0.5)];
  const out = -1; // the open sea lies to the left of the way along the mole
  steps(-22, 3.2);
  const SEGS = 22;
  const moorings = [];
  for (let i = 0; i < SEGS; i++) {
    const t = (i + 0.5) / SEGS;
    const [x, z] = mole(t);
    const [nx, nz] = mole(t + 0.01);
    const [ax, az] = mole(i / SEGS);
    const [bx, bz] = mole((i + 1) / SEGS);
    const yaw = Math.atan2(nx - x, nz - z);
    const len = Math.hypot(bx - ax, bz - az) + 0.2;
    const bottom = bedAt(x, z) - 0.5;
    const top = 0.45;
    at(box(3.8, top - bottom, len, BLOCK[i % 3]), x, (top + bottom) / 2, z, deck).rotation.y = yaw;
    at(box(3.9, 0.12, len, 0xa89c88), x, -0.52, z, deck).rotation.y = yaw;
    at(box(3.2, 0.08, len, i % 2 ? 0xdcd2bc : 0xd3c8b1), x, top + 0.04, z, deck).rotation.y = yaw;
    at(box(0.6, 0.9, len, BLOCK[(i + 1) % 3]), x + out * Math.cos(yaw) * 1.6, top + 0.45, z - out * Math.sin(yaw) * 1.6, deck).rotation.y = yaw;
    if (i % 4 === 2) {
      at(cyl(0.14, 0.18, 0.7, INK, 6), x - out * Math.cos(yaw) * 1.4, top + 0.35, z + out * Math.sin(yaw) * 1.4, deck);
      at(ball(0.18, INK, {}, 6, 4), x - out * Math.cos(yaw) * 1.4, top + 0.72, z + out * Math.sin(yaw) * 1.4, deck);
      if (rng() < 0.6) perchedGull(deck, x - out * Math.cos(yaw) * 1.4, top + 0.86, z + out * Math.sin(yaw) * 1.4, rng() * Math.PI * 2);
    }
    if (i % 7 === 1) perchedGull(deck, x + out * Math.cos(yaw) * 1.6, top + 0.9, z - out * Math.sin(yaw) * 1.6, yaw + Math.PI / 2 + (rng() - 0.5));
    if (i % 6 === 3) lantern(deck, x - out * Math.cos(yaw) * 0.6, top, z + out * Math.sin(yaw) * 0.6, { toward: [x + out * Math.cos(yaw), z - out * Math.sin(yaw)] });
    for (let k = 0; k < 2; k++) {
      const off = 2.5 + rng() * 1.6;
      const along = (rng() - 0.5) * len;
      boulder(x + out * Math.cos(yaw) * off + Math.sin(yaw) * along, -0.6 + rng() * 0.9, z - out * Math.sin(yaw) * off + Math.cos(yaw) * along, 0.6 + rng() * 0.7);
    }
    if (i === 5 || i === 11 || i === 16) moorings.push([x - out * Math.cos(yaw) * 3.1, z + out * Math.sin(yaw) * 3.1, yaw]);
  }
  // Along the mole: a bench with its back to the parapet, looking across the harbour at the
  // boats and the village, nets hung to dry between two poles, lobster
  // pots stacked against the parapet, and at its root a little shrine to the Madonna of the
  // sea, with flowers at her feet and a candle that burns all night.
  const alongMole = (t, side) => {
    const [x, z] = mole(t);
    const [nx, nz] = mole(t + 0.01);
    const yaw = Math.atan2(nx - x, nz - z);
    return { x: x + out * Math.cos(yaw) * side, z: z - out * Math.sin(yaw) * side, yaw };
  };
  const seatAt = alongMole(0.2, 0.75);
  const bench = at(new THREE.Group(), seatAt.x, 0.45, seatAt.z, deck);
  bench.rotation.y = seatAt.yaw - (out * Math.PI) / 2;
  at(box(2.0, 0.12, 0.5, PAL.wood), 0, 0.5, 0, bench);
  at(box(2.0, 0.45, 0.08, PAL.wood), 0, 0.85, -0.24, bench);
  for (const dx of [-0.8, 0.8]) at(box(0.12, 0.5, 0.48, INK), dx, 0.25, 0, bench);
  for (const dx of [-0.5, 0.5]) seat(bench, dx, 0.56, 0, 0);
  const netAt = alongMole(0.5, -0.4);
  const nets = at(new THREE.Group(), netAt.x, 0.45, netAt.z, deck);
  nets.rotation.y = netAt.yaw;
  for (const dz of [-1.8, 1.8]) at(cyl(0.06, 0.06, 2.4, PAL.wood, 4), 0, 1.2, dz, nets);
  for (let k = 0; k < 6; k++) at(box(0.03, 0.03, 3.6, 0x6d8f8a), 0, 0.9 + k * 0.25, 0, nets);
  for (let k = 0; k < 9; k++) at(box(0.03, 1.4, 0.03, 0x6d8f8a), 0, 1.5, -1.6 + k * 0.4, nets);
  for (const [dz, dy] of [[-0.9, 0.3], [-0.9, 0.9], [0.1, 0.3]]) at(ball(0.07, PAL.coral, {}, 5, 4), 0.05, 0.9 + dy, dz, nets);
  const potAt = alongMole(0.72, 0.9);
  for (const [dx, dz, dy] of [[0, 0, 0.28], [0.8, 0.1, 0.28], [0.4, 0.05, 0.84]]) {
    at(cyl(0.38, 0.38, 0.55, 0x5a6a7a, 8), potAt.x + dx, 0.45 + dy, potAt.z + dz, deck);
    at(ring(0.38, 0.03, PAL.saffron, Math.PI * 2, 10), potAt.x + dx, 0.45 + dy + 0.26, potAt.z + dz, deck).rotation.x = Math.PI / 2;
  }
  const shrineAt = alongMole(0.04, 1.3);
  const shrine = at(new THREE.Group(), shrineAt.x, 0.45, shrineAt.z, deck);
  shrine.rotation.y = shrineAt.yaw - (out * Math.PI) / 2;
  at(box(1.1, 1.7, 0.7, STONE), 0, 0.85, 0, shrine);
  at(box(1.3, 0.14, 0.9, 0xc9b99c), 0, 1.75, 0, shrine);
  at(box(1.3, 0.12, 0.9, 0xc9b99c), 0, 0.06, 0, shrine);
  at(box(0.6, 0.9, 0.1, INK), 0, 0.95, 0.33, shrine);
  at(cyl(0.3, 0.3, 0.1, INK, 12), 0, 1.4, 0.33, shrine).rotation.x = Math.PI / 2;
  at(cone(0.17, 0.5, 0x4a86c2, 8), 0, 0.82, 0.3, shrine);
  at(ball(0.09, PAL.skin, {}, 6, 4), 0, 1.12, 0.3, shrine);
  at(ball(0.13, 0x4a86c2, {}, 6, 4), 0, 1.16, 0.26, shrine).scale.z = 0.6;
  at(ball(0.08, WARM_LIGHT, { glow: true }, 5, 4), 0.2, 0.68, 0.38, shrine);
  lamplight(shrine, 0.2, 0.7, 0.4, 2.6);
  for (const [dx, c] of [[-0.35, PAL.pink], [0.4, PAL.red], [0.05, PAL.ivory]]) at(ball(0.1, c, {}, 5, 4), dx, 0.2, 0.52, shrine);
  at(ball(0.16, 0x5a9050, { leaf: true }, 5, 4), 0, 0.16, 0.5, shrine).scale.set(2.6, 0.6, 0.8);

  const [hx, hz] = mole(1);
  at(cyl(2.8, 3.0, 0.6, BLOCK[0], 10, { flat: true }), hx, 0.5, hz, deck);
  const light = at(new THREE.Group(), hx, 0.8, hz, deck);
  at(cyl(0.55, 0.78, 3.4, PAL.ivory, 10), 0, 1.7, 0, light);
  at(cyl(0.7, 0.7, 0.5, 0x3f8a55, 10), 0, 2.3, 0, light);
  at(cyl(0.46, 0.46, 0.6, 0x9ff0b0, 8, { glow: true }), 0, 3.7, 0, light);
  for (let k = 0; k < 4; k++) at(box(0.06, 0.6, 0.06, INK), Math.cos((k / 4) * Math.PI * 2 + 0.4) * 0.46, 3.7, Math.sin((k / 4) * Math.PI * 2 + 0.4) * 0.46, light);
  at(cone(0.62, 0.5, 0x3f8a55, 10), 0, 4.25, 0, light);
  lamplight(light, 0, 3.7, 0, 7);
  at(cyl(0.14, 0.18, 0.7, INK, 6), hx + 1.8, 1.15, hz, deck);

  // A slipway beside the jetty, where the boats are hauled up out of the water on rollers.
  const SLIP = 13;
  const lean = 0.2;
  const rampAt = (z) => quayTop - (DECK - 0.12) - Math.tan(lean) * (z - Q);
  const slip = at(box(4.6, 0.5, 10, 0xd3c7b0), SLIP, rampAt(Q + 5) - 0.25, Q + 5, deck);
  slip.rotation.x = lean;
  for (const sx of [-1, 1]) at(box(0.3, 0.7, 10, BLOCK[1]), SLIP + sx * 2.45, rampAt(Q + 5) - 0.1, Q + 5, deck).rotation.x = lean;
  for (const [dx, z] of [[-1.15, Q + 1.8], [1.15, Q + 3.1], [-0.2, Q + 6.6]]) {
    for (const dz of [-1.2, 1.2]) at(cyl(0.1, 0.1, 1.9, DARK_WOOD, 6), SLIP + dx, rampAt(z + dz) + 0.1, z + dz, deck).rotation.z = Math.PI / 2;
    const boat = at(gozzo(rng), SLIP + dx, rampAt(z) + 0.2, z, deck);
    boat.rotation.x = lean;
    boat.rotation.y = Math.PI;
  }

  // Moored boats along the piers and in the lee of the mole, bobbing.
  for (const px of [-8, 6]) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) moorings.push([px + side * 2.6, Q + 3 + k * 5, (rng() - 0.5) * 0.2]);
  moorings.forEach(([x, z, yaw], i) => {
    const boat = at(live(gozzo(rng, i % 5 === 4)), x, surface, z, g);
    boat.rotation.y = yaw;
    animated.push((t) => {
      boat.position.y = surface + Math.sin(t * 1.3 + i) * 0.08;
      boat.rotation.z = Math.sin(t * 1.1 + i * 2) * 0.05;
    });
  });

  // The quay itself: two fishmongers' stalls, the gear of the boats, the cats.
  const quay = at(new THREE.Group(), 0, quayTop - 0.1, Q - 1.1, g);
  for (const x of [-13, 10.5]) fishStall(quay, rng, x, 0, 0);
  furnishPort(quay, g, rng, Q);
  harbourCats(quay, deck, rng, animated, Q);
}

export function buildAgora(g, rng) {
  // The Mother Tree: a centuries-old holm oak shading the whole square.
  const BARK = 0x7d5a48;
  at(cyl(0.9, 1.6, 8, BARK, 10, { flat: true }), 0, 4, 0, g);
  [0x3f6540, 0x4c7448, 0x5a8050, 0x466c44, 0x548050, 0x3f6540].forEach((color, k) => {
    const yaw = at(new THREE.Group(), 0, 7.5, 0, g);
    yaw.rotation.y = (k / 6) * Math.PI * 2;
    const tilt = at(new THREE.Group(), 0, 0, 0, yaw);
    tilt.rotation.z = -0.8 - (k % 2) * 0.2;
    at(cyl(0.2, 0.42, 4.6, BARK, 6), 0, 2.3, 0, tilt);
    at(ball(2.1 + (k % 3) * 0.3, color, { flat: true, leaf: true }, 9, 6), 0, 5, 0, tilt);
  });
  at(ball(2.6, 0x5a8050, { flat: true, leaf: true }, 9, 6), 0, 11.5, 0, g);
  // Strings of little lamps fan out from the trunk to a ring of posts, for the evenings.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const b = ((k + 1) / 6) * Math.PI * 2;
    at(cyl(0.07, 0.1, 3.6, DARK_WOOD, 5), Math.cos(a) * 9.4, 1.8, Math.sin(a) * 9.4, g);
    festoon(g, Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1, Math.cos(a) * 9.4, 3.6, Math.sin(a) * 9.4, 0.9);
    festoon(g, Math.cos(a) * 9.4, 3.6, Math.sin(a) * 9.4, Math.cos(b) * 9.4, 3.6, Math.sin(b) * 9.4, 0.6);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const bench = at(new THREE.Group(), Math.cos(a) * 7, 0, Math.sin(a) * 7, g);
    bench.rotation.y = -a + Math.PI / 2;
    at(box(2.6, 0.18, 0.8, PAL.wood), 0, 0.7, 0, bench);
    for (const dx of [-0.6, 0.6]) seat(bench, dx, 0.8, 0, Math.PI);
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
    const s = at(solid(new THREE.DodecahedronGeometry(0.9 + rs() * 0.5, 0), paint(pick(rs, [0xcfc3b0, 0xb9ad9c, 0xd8cdb8]), { flat: true })), Math.cos(a) * 11.5, 0.6, Math.sin(a) * 11.5, g);
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

function amphora(parent, x, y, z, color = 0xc8643c) {
  const body = at(ball(0.42, color, {}, 10, 8), x, y + 0.55, z, parent);
  body.scale.y = 1.35;
  at(cyl(0.14, 0.2, 0.4, color, 8), x, y + 1.2, z, parent);
  at(ring(0.17, 0.04, color, Math.PI * 2, 10), x, y + 1.4, z, parent).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) at(ring(0.18, 0.04, color, Math.PI, 8), x + s * 0.22, y + 1.05, z, parent).rotation.z = s * Math.PI / 2;
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
  // A delivery three-wheeler parked on a cobbled yard, loaded with crates.
  at(cyl(3.2, 3.4, 0.2, 0xcfc3b0, 20, { flat: true }), 2, 0.1, 11, g);
  const ape = at(new THREE.Group(), 2, 0.2, 11, g);
  ape.rotation.y = 0.7;
  at(box(1.3, 1.1, 1.2, 0x6f9fb8), 0, 0.95, 1.0, ape);
  at(box(1.34, 0.45, 0.9, 0x33303f), 0, 1.2, 1.2, ape);
  at(box(1.3, 0.2, 0.5, 0x6f9fb8), 0, 0.5, 1.75, ape);
  at(box(1.5, 0.12, 2.0, 0x6f9fb8), 0, 0.55, -0.6, ape);
  for (const [x, z, w, d] of [[0.72, -0.6, 0.06, 2.0], [-0.72, -0.6, 0.06, 2.0], [0, -1.58, 1.5, 0.06]]) at(box(w, 0.4, d, 0x6f9fb8), x, 0.8, z, ape);
  for (const [x, z] of [[0.3, -0.3], [-0.35, -0.9]]) at(box(0.6, 0.45, 0.6, PAL.wood), x, 0.85, z, ape);
  at(cyl(0.26, 0.26, 0.16, INK, 10), 0, 0.26, 1.6, ape).rotation.z = Math.PI / 2;
  for (const x of [-0.72, 0.72]) at(cyl(0.26, 0.26, 0.16, INK, 10), x, 0.26, -1.0, ape).rotation.z = Math.PI / 2;
  at(ball(0.1, WARM_LIGHT, { glow: true }, 4, 3), 0, 0.8, 2.0, ape);
}

const CAT_COATS = [
  [0xd9853a, 0xefe8dc], // ginger and white
  [0x33303f, 0x33303f], // black
  [0xefe8dc, 0xefe8dc], // white
  [0x8a8478, 0x5f5a52], // grey tabby
  [0xefe8dc, 0xd9853a], // white with ginger patches
  [0x5f5a52, 0xefe8dc], // tuxedo
];

/** A harbour cat facing +z: `sit` upright, `sleep` curled in a loaf, or `walk` on four legs. */
export function harbourCat(rng, animated, pose = 'sit') {
  const g = live(new THREE.Group());
  const [fur, mark] = pick(rng, CAT_COATS);
  const head = new THREE.Group();
  at(ball(0.15, fur, {}, 8, 6), 0, 0, 0, head).scale.set(1.05, 0.9, 0.95);
  at(ball(0.07, mark, {}, 6, 4), 0, -0.04, 0.11, head);
  for (const s of [-1, 1]) {
    at(cone(0.055, 0.12, fur, 4), s * 0.085, 0.14, -0.01, head);
    at(box(0.03, 0.035, 0.02, 0x2b2533), s * 0.06, 0.02, 0.135, head);
  }
  const tail = new THREE.Group();
  const tip = at(cyl(0.03, 0.045, 0.5, fur, 5), 0, 0.25, 0, tail);
  at(ball(0.04, mark, {}, 5, 4), 0, 0.26, 0, tip);
  const legs = [];
  const phase = rng() * 10;
  if (pose === 'sit') {
    at(ball(0.2, fur, {}, 8, 6), 0, 0.2, -0.04, g).scale.set(0.9, 1.0, 1.05);
    at(ball(0.16, fur, {}, 8, 6), 0, 0.36, 0.04, g).scale.set(0.85, 1.1, 0.85);
    at(ball(0.09, mark, {}, 6, 4), 0, 0.32, 0.15, g);
    for (const s of [-1, 1]) at(cyl(0.04, 0.045, 0.3, fur, 5), s * 0.07, 0.15, 0.14, g);
    at(head, 0, 0.6, 0.1, g);
    at(tail, 0.12, 0.05, -0.18, g).rotation.set(0, 0, -1.45);
  } else if (pose === 'sleep') {
    at(ball(0.22, fur, {}, 8, 6), 0, 0.13, 0, g).scale.set(1.0, 0.6, 1.45);
    at(ball(0.12, mark, {}, 6, 4), 0.06, 0.2, -0.1, g).scale.set(1, 0.5, 1.2);
    at(head, 0.05, 0.16, 0.3, g).rotation.set(0.3, 0.5, 0);
    at(tail, -0.16, 0.05, -0.2, g).rotation.set(1.3, 0, 0.9);
  } else {
    at(ball(0.16, fur, {}, 8, 6), 0, 0.3, 0, g).scale.set(0.8, 0.8, 1.9);
    at(ball(0.1, mark, {}, 6, 4), 0, 0.24, 0.12, g).scale.set(0.8, 0.6, 1.4);
    for (const [x, z] of [[-0.07, 0.2], [0.07, 0.2], [-0.07, -0.2], [0.07, -0.2]]) {
      const hip = at(new THREE.Group(), x, 0.26, z, g);
      at(cyl(0.035, 0.04, 0.26, fur, 5), 0, -0.13, 0, hip);
      at(ball(0.045, mark, {}, 5, 4), 0, -0.25, 0.01, hip);
      legs.push(hip);
    }
    at(head, 0, 0.44, 0.36, g);
    at(tail, 0, 0.36, -0.3, g).rotation.x = -0.5;
  }
  animated.push((t) => {
    if (pose === 'sleep') {
      g.scale.y = 1 + Math.sin(t * 1.8 + phase) * 0.04; // breathing
      return;
    }
    tail.rotation[pose === 'sit' ? 'y' : 'z'] = Math.sin(t * 1.4 + phase) * 0.35;
    head.rotation.y = Math.sin(t * 0.5 + phase) * 0.6 * (pose === 'sit' ? 1 : 0.3);
    legs.forEach((leg, i) => (leg.rotation.x = Math.sin(t * 9 + (i % 3 ? Math.PI : 0)) * 0.6 * (g.userData.moving ? 1 : 0)));
  });
  return g;
}

/** The cats of the harbour: begging at the fish stalls, dozing in the sun, patrolling the planks. */
function harbourCats(quay, deck, rng, animated, Q) {
  const put = (parent, pose, x, y, z, yaw) => {
    const cat = at(harbourCat(rng, animated, pose), x, y, z, parent);
    cat.rotation.y = yaw;
    return cat;
  };
  // Waiting for scraps by the fishmongers.
  put(quay, 'sit', -11.4, 0.1, -0.2, Math.PI + 0.5);
  put(quay, 'sit', -8.8, 0.1, -0.4, Math.PI - 0.4);
  put(quay, 'sit', 8.4, 0.1, -0.3, Math.PI + 0.3);
  put(quay, 'sit', 12.6, 0.1, -0.1, Math.PI - 0.5);
  // Watching the water from the end of a pier, and from the jetty.
  put(deck, 'sit', -8.4, 0.13, Q + 18.4, 0.2);
  put(deck, 'sit', 19.6, 0.12, Q + 19.6, -0.3);
  // Asleep in the last of the sun.
  put(quay, 'sleep', 15.2, 0.1, 0.4, 0.8);
  put(quay, 'sleep', -4.8, 0.1, 0.5, 2.2);
  put(deck, 'sleep', 6.6, 0.13, Q + 9, -0.6);
  // On patrol: back and forth along the quay and a pier, pausing at each end.
  for (const [parent, ax, az, bx, bz, y, speed] of [[quay, -18, 0.3, 18, 0.3, 0.1, 1.1], [deck, 6.4, Q + 2, 6.4, Q + 17, 0.13, 0.9]]) {
    const cat = put(parent, 'walk', ax, y, az, 0);
    const length = Math.hypot(bx - ax, bz - az);
    const travel = length / speed;
    const rest = 4 + rng() * 5;
    const offset = rng() * 30;
    animated.push((t) => {
      const clock = (t + offset) % ((travel + rest) * 2);
      const back = clock >= travel + rest;
      const local = back ? clock - travel - rest : clock;
      const k = Math.min(1, local / travel);
      const p = back ? 1 - k : k;
      cat.position.set(ax + (bx - ax) * p, y, az + (bz - az) * p);
      cat.rotation.y = Math.atan2(bx - ax, bz - az) + (back ? Math.PI : 0);
      cat.userData.moving = k < 1;
    });
  }
}

function furnishPort(quay, g, rng, Q) {
  // Fishing gear set down along the quay: nets drying on poles, buoys, rope coils, lobster
  // pots, an anchor.
  for (const x of [-4, -0.4]) at(cyl(0.06, 0.06, 2.4, PAL.wood, 4), x, 1.2, -0.4, quay);
  for (let k = 0; k < 6; k++) at(box(3.6, 0.03, 0.03, 0x6d8f8a), -2.2, 0.9 + k * 0.25, -0.4, quay);
  for (let k = 0; k < 9; k++) at(box(0.03, 1.4, 0.03, 0x6d8f8a), -3.8 + k * 0.4, 1.5, -0.4, quay);
  for (let k = 0; k < 5; k++) {
    at(ball(0.24, k % 2 ? PAL.red : PAL.ivory, {}, 8, 6), 2.5 + k * 0.45, 0.3, 0.5 - (k % 2) * 0.4, quay);
  }
  for (const [x, z] of [[-7, 0.2], [-6.2, 0.4]]) at(ring(0.35, 0.09, PAL.cream, Math.PI * 2, 12), x, 0.18, z, quay).rotation.x = Math.PI / 2;
  for (const [x, z] of [[5, 0.0], [5.8, 0.3], [5.4, -0.6]]) {
    at(cyl(0.4, 0.4, 0.55, 0x5a6a7a, 8), x, 0.28, z, quay);
    at(ring(0.4, 0.03, PAL.saffron, Math.PI * 2, 10), x, 0.55, z, quay).rotation.x = Math.PI / 2;
  }
  const anchor = at(new THREE.Group(), 16, 0.2, 0.2, quay);
  anchor.rotation.set(-Math.PI / 2, 0, 0.4);
  at(cyl(0.08, 0.08, 1.6, INK, 6), 0, 0, 0, anchor);
  at(ring(0.55, 0.08, INK, Math.PI, 10), 0, -0.6, 0, anchor).rotation.z = Math.PI;
  at(ring(0.18, 0.05, INK, Math.PI * 2, 8), 0, 0.9, 0, anchor);
  // Mooring buoys out in the harbour.
  for (const [x, z] of [[-12, Q + 16], [2, Q + 23], [-6, Q + 25]]) {
    at(ball(0.35, PAL.coral, {}, 8, 6), x, WATER_LEVEL + 0.1, z, g);
    at(cyl(0.04, 0.04, 0.5, INK, 4), x, WATER_LEVEL + 0.55, z, g);
  }
}

function furnishAgora(g, rng) {
  // Roots of the Mother Tree spreading over the ground.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const root = at(cyl(0.18, 0.5, 2.6, 0x7d5a48, 6), Math.cos(a) * 1.6, 0.35, Math.sin(a) * 1.6, g);
    root.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
  }
  // Lanterns hanging from the branches.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5;
    const x = Math.cos(a) * 4.2;
    const z = -Math.sin(a) * 4.2;
    at(cyl(0.015, 0.015, 1.4, INK, 3), x, 9.2, z, g);
    at(ball(0.22, WARM_LIGHT, { glow: true }, 6, 5), x, 8.4, z, g);
  }
  // A fountain, between the tree and the ring of benches, in the gap between two of them.
  const f = at(new THREE.Group(), Math.cos((4 * Math.PI) / 3) * 4.8, 0, Math.sin((4 * Math.PI) / 3) * 4.8, g);
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

// The secret base hidden in the mountain, seen through the back cut of the diorama:
// a hangar, a control room, a lab, a crystal reactor, living quarters and a lift
// rising to a camouflaged hatch on the summit.
import * as THREE from 'three';
import { PAL, paint, solid } from './style.js';
import { INK, SCREEN, WARM_LIGHT, aerocar, at, bake, ball, box, cone, cyl, live, ring } from './kit.js';
import { SQUARE, groundAt, toX, toZ } from './terrain.js';

const WALL = 0xa8b4cc;
const FLOOR = 0x7a7090;
const PANEL = 0xd8d4e0;
const GLOW_TEAL = SCREEN;
const GLOW_GOLD = PAL.saffron;

/** Ground height along the back face at a given v. */
const backHeight = (v) => groundAt(toX(SQUARE.u1, v), toZ(SQUARE.u1, v));

/**
 * Rooms, in back-face coordinates: v0..v1 along the face (integers, to match the cut columns),
 * y0..y1 in height, `depth` into the mountain.
 */
export function planBase() {
  // Everything sits above the waterline, since the endless sea laps at the foot of the cut.
  const rooms = [
    { id: 'hangar', v0: -30, v1: -8, y0: 1, y1: 12, depth: 16 },
    { id: 'control', v0: -4, v1: 14, y0: 1, y1: 9, depth: 10 },
    { id: 'lab', v0: -4, v1: 14, y0: 12, y1: 18.5, depth: 9 },
    { id: 'reactor', v0: 18, v1: 30, y0: 1, y1: 18, depth: 12 },
    { id: 'quarters', v0: 34, v1: 46, y0: 1, y1: 8, depth: 8 },
    { id: 'corridor', v0: -8, v1: -4, y0: 1, y1: 4, depth: 5 },
    { id: 'corridor', v0: 14, v1: 18, y0: 1, y1: 4, depth: 5 },
    { id: 'corridor', v0: 30, v1: 34, y0: 1, y1: 4, depth: 5 },
    { id: 'lift', v0: -35, v1: -32, y0: 1, y1: 40, depth: 4 },
  ];
  // Keep every room safely under the mountain; the lift shaft climbs as high as it can.
  for (const r of rooms) {
    let ceiling = Infinity;
    for (let v = r.v0; v <= r.v1; v++) ceiling = Math.min(ceiling, backHeight(v));
    if (r.id === 'lift') r.y1 = ceiling - 2.5;
    r.y1 = Math.min(r.y1, ceiling - 2);
  }
  return rooms.filter((r) => r.y1 - r.y0 > 2.5);
}

/** A room's local frame: origin at the bottom centre of its opening, +z out of the mountain. */
function roomFrame(r) {
  const v = (r.v0 + r.v1) / 2;
  const g = new THREE.Group();
  g.position.set(toX(SQUARE.u1, v), r.y0, toZ(SQUARE.u1, v));
  g.rotation.y = (5 * Math.PI) / 4;
  return g;
}

function shell(g, w, h, depth, wall = WALL) {
  const inside = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), paint(wall, { backSide: true }));
  inside.position.set(0, h / 2, -depth / 2 + 0.02);
  inside.receiveShadow = true;
  g.add(inside);
  at(box(w - 0.1, 0.1, depth - 0.1, FLOOR), 0, 0.05, -depth / 2, g);
  // Light strips along the back wall and the ceiling edge.
  at(box(w - 0.6, 0.12, 0.08, GLOW_TEAL, { glow: true }), 0, h - 0.4, -depth + 0.1, g);
  for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 3) at(box(0.12, h - 1, 0.08, PANEL), x, h / 2, -depth + 0.1, g);
}

function hangar(g, w, h, depth, animated) {
  for (let x = -w / 2 + 2; x < w / 2; x += 3) at(box(0.5, 0.05, 0.5, GLOW_GOLD, { glow: true }), x, 0.12, -depth / 2, g);
  at(ring(3.2, 0.12, GLOW_GOLD, Math.PI * 2, 24, { glow: true }), 0, 0.12, -depth / 2, g).rotation.x = Math.PI / 2;
  const car = at(live(aerocar(PAL.coral)), 0, 1.4, -depth / 2, g);
  car.rotation.y = Math.PI / 2;
  animated.push((t) => (car.position.y = 1.4 + Math.sin(t * 1.7) * 0.08));
  // Gantry crane over the bay.
  for (const x of [-w / 2 + 1, w / 2 - 1]) at(box(0.4, h - 0.5, 0.4, PAL.saffron), x, (h - 0.5) / 2, -depth / 2, g);
  at(box(w - 2, 0.4, 0.5, PAL.saffron), 0, h - 0.7, -depth / 2, g);
  at(box(0.8, 0.6, 0.8, INK), 2, h - 1.2, -depth / 2, g);
  at(cyl(0.03, 0.03, 2.5, INK, 3), 2, h - 2.6, -depth / 2, g);
  for (let k = 0; k < 6; k++) at(box(1.1, 1.1, 1.1, k % 2 ? PAL.teal : PAL.ochre), -w / 2 + 1.5 + (k % 3) * 1.2, 0.6 + Math.floor(k / 3) * 1.1, -depth + 1.5, g);
  at(box(2.5, 1.6, 0.2, PAL.red), w / 2 - 2.5, h - 2.5, -depth + 0.15, g);
}

function control(g, w, h, depth, animated) {
  // A wall of screens.
  for (let k = 0; k < 4; k++) {
    at(box(3, 2, 0.1, GLOW_TEAL, { glow: true }), -w / 2 + 2.6 + k * 3.8, h - 2.2, -depth + 0.2, g);
    for (let b = 0; b < 3; b++) at(box(1.4 + (b % 2), 0.12, 0.05, 0x3f8f99), -w / 2 + 2.3 + k * 3.8, h - 1.7 - b * 0.4, -depth + 0.27, g);
  }
  // Consoles and chairs.
  for (let k = 0; k < 3; k++) {
    const x = -w / 2 + 3.5 + k * 5;
    at(box(3.2, 1, 1.2, PANEL), x, 0.5, -depth + 3, g);
    at(box(3, 0.08, 0.9, GLOW_GOLD, { glow: true }), x, 1.04, -depth + 3, g);
    at(cyl(0.4, 0.4, 0.12, PAL.red, 10), x, 0.8, -depth + 4.6, g);
    at(cyl(0.06, 0.1, 0.75, INK, 6), x, 0.38, -depth + 4.6, g);
  }
  // Holographic globe turning in the middle.
  at(cyl(0.8, 1, 0.6, PANEL, 12), w / 2 - 2.5, 0.3, -depth / 2, g);
  const holo = at(live(new THREE.Group()), w / 2 - 2.5, 2.2, -depth / 2, g);
  at(ball(1, GLOW_TEAL, { glow: true, flat: true }, 8, 6), 0, 0, 0, holo);
  at(ring(1.3, 0.04, GLOW_GOLD, Math.PI * 2, 20, { glow: true }), 0, 0, 0, holo).rotation.x = 1.2;
  animated.push((t) => (holo.rotation.y = t * 0.6));
}

function lab(g, w, h, depth, animated) {
  // Glass vats with specimens floating in green liquid.
  for (let k = 0; k < 4; k++) {
    const x = -w / 2 + 2.5 + k * 4;
    const z = -depth + 2.4;
    at(cyl(0.9, 0.9, 0.4, PANEL, 12), x, 0.2, z, g);
    at(cyl(0.8, 0.8, h - 2, 0x9ff0c8, 12, { glow: true }), x, (h - 2) / 2 + 0.4, z, g);
    at(cyl(0.9, 0.9, 0.4, PANEL, 12), x, h - 1.4, z, g);
    const spec = at(live(new THREE.Group()), x, h / 2, z, g);
    at(ball(0.35, PAL.plum, { flat: true }, 6, 4), 0, 0, 0.82, spec);
    animated.push((t) => (spec.position.y = h / 2 - 0.2 + Math.sin(t * 0.9 + k) * 0.25));
    for (const s of [-1, 1]) at(cyl(0.08, 0.08, 1.2, PAL.coral, 6), x + s * 0.5, h - 0.6, z, g);
  }
  at(box(w - 3, 0.9, 1.2, PANEL), 0, 0.45, -1.6, g);
  for (let k = 0; k < 6; k++) at(cyl(0.12, 0.15, 0.4, [PAL.pink, GLOW_TEAL, PAL.saffron][k % 3], 6, { glow: true }), -w / 2 + 3 + k * 2, 1.1, -1.6, g);
}

function reactor(g, w, h, depth, animated) {
  const cz = -depth / 2;
  at(cyl(3.2, 3.6, 0.8, PANEL, 16), 0, 0.4, cz, g);
  at(cyl(2.2, 2.2, 0.1, GLOW_GOLD, 16, { glow: true }), 0, 0.85, cz, g);
  at(cyl(3.2, 3.6, 0.8, PANEL, 16), 0, h - 0.4, cz, g);
  // The core: a giant Incal crystal levitating inside counter-rotating rings.
  const core = at(live(new THREE.Group()), 0, h / 2, cz, g);
  at(cone(1.2, 2, 0xfff6d8, 4, { glow: true, flat: true }), 0, 1, 0, core);
  at(cone(1.2, 2, GLOW_GOLD, 4, { glow: true, flat: true }), 0, -1, 0, core).rotation.x = Math.PI;
  const rings = [2.4, 2.9].map((r, i) => {
    const holder = at(live(new THREE.Group()), 0, h / 2, cz, g);
    at(ring(r, 0.12, i ? GLOW_TEAL : PAL.coral, Math.PI * 2, 32, { glow: true }), 0, 0, 0, holder);
    return holder;
  });
  animated.push((t) => {
    core.rotation.y = t * 0.8;
    core.position.y = h / 2 + Math.sin(t * 1.3) * 0.3;
    rings[0].rotation.set(t * 0.7, 0, t * 0.3);
    rings[1].rotation.set(-t * 0.5, t * 0.2, 0);
  });
  for (const x of [-w / 2 + 1, w / 2 - 1]) {
    at(cyl(0.3, 0.3, h, PAL.coral, 8), x, h / 2, -depth + 1, g);
    for (let y = 1; y < h; y += 2.5) at(ring(0.4, 0.07, INK, Math.PI * 2, 8), x, y, -depth + 1, g).rotation.x = Math.PI / 2;
  }
}

function quarters(g, w, h, depth) {
  at(box(3, 0.6, 2, PAL.wood), -w / 2 + 2, 0.4, -depth + 1.3, g);
  at(box(2.8, 0.25, 1.8, PAL.ivory), -w / 2 + 2, 0.82, -depth + 1.3, g);
  at(box(0.8, 0.3, 1.6, PAL.coral), -w / 2 + 1.0, 1.05, -depth + 1.3, g);
  at(cyl(1.4, 1.4, 0.04, PAL.saffron, 16), 0.5, 0.12, -depth / 2, g);
  at(box(2.4, h - 2, 0.6, PAL.wood), w / 2 - 1.6, (h - 2) / 2, -depth + 0.5, g);
  for (let k = 0; k < 8; k++) at(box(0.18, 0.6, 0.4, [PAL.red, PAL.teal, PAL.saffron, PAL.plum][k % 4]), w / 2 - 2.6 + k * 0.26, 1.5 + Math.floor(k / 4) * 1.2, -depth + 0.55, g);
  at(cyl(0.35, 0.28, 0.6, PAL.coral, 10), 2, 0.3, -1.2, g);
  at(ball(0.55, PAL.grassDeep, { flat: true }, 7, 5), 2, 1.0, -1.2, g);
  at(cyl(0.05, 0.05, 1.6, INK, 4), -0.5, 0.8, -depth + 1, g);
  at(cone(0.35, 0.35, WARM_LIGHT, 8, { glow: true }), -0.5, 1.7, -depth + 1, g);
}

function lift(g, w, h, depth, animated, rooms) {
  for (let y = 1; y < h; y += 1.5) at(box(w - 0.2, 0.08, 0.08, PAL.saffron), 0, y, -depth + 0.15, g);
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) at(box(0.12, h, 0.12, INK), x, h / 2, -depth / 2, g);
  const cabin = at(live(new THREE.Group()), 0, 0, -depth / 2, g);
  at(box(w - 0.6, 2.2, depth - 1, PAL.ivory), 0, 1.1, 0, cabin);
  at(box(w - 0.9, 1.2, 0.05, GLOW_TEAL, { glow: true }), 0, 1.3, (depth - 1) / 2 + 0.02, cabin);
  animated.push((t) => {
    const k = (Math.sin(t * 0.35) + 1) / 2;
    cabin.position.y = k * (h - 2.6);
  });
  return rooms;
}

export function buildBase(scene, rooms, animated) {
  const builders = { hangar, control, lab, reactor, quarters, lift };
  for (const r of rooms) {
    const g = roomFrame(r);
    const w = r.v1 - r.v0;
    const h = r.y1 - r.y0;
    shell(g, w, h, r.depth, r.id === 'corridor' ? 0x8a98b4 : WALL);
    builders[r.id]?.(g, w, h, r.depth, animated, rooms);
    scene.add(bake(g));
  }
  // The camouflaged hatch on the summit, above the lift.
  const shaft = rooms.find((r) => r.id === 'lift');
  if (shaft) {
    const v = (shaft.v0 + shaft.v1) / 2;
    const u = SQUARE.u1 - shaft.depth / 2;
    const x = toX(u, v);
    const z = toZ(u, v);
    const y = groundAt(x, z);
    const hatch = new THREE.Group();
    at(cyl(1.6, 1.8, 0.4, 0x8a9a7a, 10, { flat: true }), x, y + 0.1, z, hatch);
    at(cyl(1.2, 1.2, 0.1, INK, 10), x, y + 0.32, z, hatch);
    at(cyl(0.05, 0.05, 2.2, INK, 4), x + 1.2, y + 1.1, z, hatch);
    at(ball(0.12, PAL.red, { glow: true }, 4, 3), x + 1.2, y + 2.25, z, hatch);
    scene.add(bake(hatch));
  }
}

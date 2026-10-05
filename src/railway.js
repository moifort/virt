// An old Italian railway, as on the Cinque Terre line: the train bursts out of a tunnel whose
// masonry vault emerges from the mountain slope, crosses the hollow where the mountain meets the
// right-hand ridge on a stone viaduct with a great central arch, and dives into the ridge. A vintage three-car train in the old
// "castano e isabella" livery shuttles back and forth. The terrain itself is left untouched.
import * as THREE from 'three';
import { PAL } from './style.js';
import { INK, at, bake, ball, box, cyl, live, ring } from './kit.js';
import { groundAt, toX, toZ } from './terrain.js';

// The line runs straight across the angle between the mountain (A) and the ridge (B), in (u, v).
const A = { u: 108, v: 25 };
const B = { u: 35, v: 95 };
const LEVEL = 24;
const STONE = 0xe2cfae;
const CASTANO = 0x7a4a3a;
const ISABELLA = 0xe8d6a8;
const PIER_GAP = 8;
const VAULT = 2.6;

const start = new THREE.Vector3(toX(A.u, A.v), 0, toZ(A.u, A.v));
const end = new THREE.Vector3(toX(B.u, B.v), 0, toZ(B.u, B.v));
const LENGTH = start.distanceTo(end);
const dir = end.clone().sub(start).normalize();
const groundAlong = (s) => groundAt(start.x + dir.x * s, start.z + dir.z * s);
// Tunnel mouths: where the slope rises above the rails at each end of the crossing.
let MOUTH_A = 0;
while (MOUTH_A < LENGTH && groundAlong(MOUTH_A) > LEVEL + 0.3) MOUTH_A += 0.5;
let MOUTH_B = LENGTH;
while (MOUTH_B > MOUTH_A && groundAlong(MOUTH_B) > LEVEL + 0.3) MOUTH_B -= 0.5;
// The dark back of each mouth: past it the train is underground.
const DEPTH = 1.6;
const inTunnel = (s) => s < MOUTH_A - DEPTH || s > MOUTH_B + DEPTH;

/** Tunnel head at `x`, the hill on the `side` (-1 toward A, +1 toward B), its vault under a terraced mound. */
function buildTunnel(line, x, side) {
  // Headwall with a dark mouth, an ochre archivolt, a coping and two stout buttresses.
  for (const z of [-1, 1]) {
    at(box(1.2, 7.4, 2.4, STONE), x + side * 0.6, 2.7, z * 3.8, line);
    at(box(2.2, 3.2, 1.4, STONE), x - side * 0.3, 0.6, z * 4.6, line);
  }
  at(box(1.2, 2.6, 5.2, STONE), x + side * 0.6, 5.6, 0, line);
  at(box(DEPTH * 2, 6, 5.2, 0x2b2533), x + side * DEPTH, 1.4, 0, line);
  const arch = at(ring(VAULT, 0.4, PAL.ochre, Math.PI, 14), x - side * 0.05, 1.6, 0, line);
  arch.rotation.y = Math.PI / 2;
  at(box(1.6, 0.6, 10.4, PAL.ochre), x + side * 0.6, 7.2, 0, line);
  // The vault runs on into the hill under an earth mound, a stone-walled terrace like the slope's.
  const top = VAULT + 2.6;
  for (let s = x + side * 1.7; s > 0 && s < LENGTH && groundAlong(s) < LEVEL + top; s += side) {
    const bottom = Math.min(-1, groundAlong(s) - LEVEL - 0.5);
    at(box(1.02, top - 0.4 - bottom, 8.2, STONE), s, (top - 0.4 + bottom) / 2, 0, line);
    at(box(1.02, 0.4, 8.6, PAL.grass), s, top - 0.2, 0, line);
  }
}

function buildLine() {
  // Local frame: x runs along the line from A, z = 0 on the track centre line, y = 0 at rail level.
  const line = new THREE.Group();
  line.position.set(start.x, LEVEL, start.z);
  line.rotation.y = Math.atan2(-dir.z, dir.x);

  buildTunnel(line, MOUTH_A, -1);
  buildTunnel(line, MOUTH_B, 1);
  const open0 = Math.floor(MOUTH_A - DEPTH);
  const open1 = Math.ceil(MOUTH_B + DEPTH);
  for (let s = open0; s < open1; s += 1) {
    at(box(1.05, 0.25, 3.2, 0xb8a890), s + 0.5, -0.12, 0, line);
    at(box(0.3, 0.12, 2.6, 0x6a4a3a), s + 0.25, 0.05, 0, line);
    at(box(0.3, 0.12, 2.6, 0x6a4a3a), s + 0.75, 0.05, 0, line);
    for (const z of [-0.72, 0.72]) at(box(1.0, 0.1, 0.1, 0x5a5a6a), s + 0.5, 0.16, z, line);
    if (s % 7 === 0 && s > MOUTH_A + 1 && s < MOUTH_B - 1) {
      at(cyl(0.08, 0.1, 4.2, INK, 5), s + 0.5, 2.1, -1.9, line);
      at(box(0.08, 0.08, 2.0, INK), s + 0.5, 4.0, -0.9, line);
    }
  }
  at(box(MOUTH_B - MOUTH_A, 0.04, 0.04, INK), (MOUTH_A + MOUTH_B) / 2, 3.95, 0, line);
  return { line, open0: MOUTH_A, open1: MOUTH_B };
}

function buildViaduct(line, open0, open1) {
  const crown = -1.25;
  const below = (s) => groundAlong(s) < LEVEL - 1.2;
  // The deepest point gets a great double-width arch; ordinary spans march out from it.
  let deepest = open0;
  for (let s = open0; s < open1; s += 0.5) if (groundAlong(s) < groundAlong(deepest)) deepest = s;
  const piers = [deepest - PIER_GAP, deepest + PIER_GAP];
  while (below(piers[0] - PIER_GAP) && piers[0] - PIER_GAP > open0) piers.unshift(piers[0] - PIER_GAP);
  while (below(piers[piers.length - 1] + PIER_GAP) && piers[piers.length - 1] + PIER_GAP < open1) piers.push(piers[piers.length - 1] + PIER_GAP);
  const first = Math.max(open0, piers[0] - PIER_GAP / 2);
  const last = Math.min(open1, piers[piers.length - 1] + PIER_GAP / 2);

  // Deck and parapets along the whole viaduct.
  at(box(last - first, 1.0, 3.8, STONE), (first + last) / 2, -0.75, 0, line);
  for (const z of [-1.95, 1.95]) {
    at(box(last - first, 0.6, 0.25, STONE), (first + last) / 2, 0.3, z, line);
    for (let x = first + 1; x < last; x += 2) at(box(0.3, 0.8, 0.3, PAL.ochre), x, 0.4, z, line);
  }
  // Piers down to the ground, with a cutwater cap.
  for (const p of piers) {
    const h = LEVEL + crown - groundAlong(p) + 1;
    at(box(1.6, h, 3.4, STONE), p, crown - h / 2, 0, line);
    at(box(2.0, 0.4, 3.8, PAL.ochre), p, crown - h + 1.2, 0, line);
  }
  // Arches between piers, spandrels filled up to the deck; half arches at both abutments.
  const spans = [[first, piers[0]], ...piers.slice(1).map((p, i) => [piers[i], p]), [piers[piers.length - 1], last]];
  for (const [a, b] of spans) {
    const mid = (a + b) / 2;
    const R = (b - a) / 2 - 0.8;
    const bottom = Math.min(groundAlong(a), groundAlong(b), groundAlong(mid)) - LEVEL;
    for (let x = a; x < b; x += 0.5) {
      const dx = Math.abs(x + 0.25 - mid);
      const archTop = dx < R ? crown - R + Math.sqrt(R * R - dx * dx) : bottom;
      const h = crown - Math.max(archTop, bottom);
      if (h > 0.05) at(box(0.52, h, 3.4, STONE), x + 0.25, crown - h / 2, 0, line);
    }
    if (R > 1) {
      const arch = at(ring(R, 0.5, PAL.ochre, Math.PI, 16), mid, crown - R, 0, line);
      arch.scale.z = 3.4;
    }
  }
}

function buildTrain(line, animated) {
  const train = live(new THREE.Group());
  const cars = 3;
  const carLength = 6.4;
  const pitch = carLength + 0.4;
  const carGroups = [];
  for (let i = 0; i < cars; i++) {
    // Cars are laid out around the train's centre, so it can simply turn around.
    const offset = ((cars - 1) / 2 - i) * pitch;
    const car = at(new THREE.Group(), offset, 0, 0, train);
    carGroups.push({ car, offset });
    at(box(carLength, 1.2, 2.3, CASTANO), 0, 0.95, 0, car);
    at(box(carLength, 0.9, 2.3, ISABELLA), 0, 2.0, 0, car);
    at(box(carLength + 0.1, 0.12, 2.36, PAL.red), 0, 1.58, 0, car);
    const roof = at(cyl(1.25, 1.25, carLength, 0x8a8a96, 12), 0, 2.45, 0, car);
    roof.rotation.z = Math.PI / 2;
    roof.scale.z = 0.4;
    for (let w = 0; w < 6; w++) {
      for (const s of [-1, 1]) at(box(0.7, 0.55, 0.05, 0x3b4a5a), -carLength / 2 + 0.7 + w * 1.0, 2.05, s * 1.17, car);
    }
    for (const x of [-carLength / 2 + 1.1, carLength / 2 - 1.1]) {
      at(box(1.6, 0.4, 2.0, INK), x, 0.3, 0, car);
      for (const z of [-0.85, 0.85]) for (const dx of [-0.5, 0.5]) at(cyl(0.3, 0.3, 0.12, 0x3b3346, 10), x + dx, 0.3, z, car).rotation.x = Math.PI / 2;
    }
    if (i === 0) {
      at(box(0.12, 0.7, 1.8, 0x3b4a5a), carLength / 2 + 0.02, 2.0, 0, car);
      at(ball(0.18, PAL.saffron, { glow: true }, 6, 4), carLength / 2 + 0.05, 1.0, 0, car);
      for (const z of [-0.6, 0.6]) at(ball(0.1, 0xfff1b0, { glow: true }, 4, 3), carLength / 2 + 0.05, 2.6, z, car);
      // Pantograph reaching for the wire.
      at(box(0.06, 1.2, 0.06, INK), 0.5, 3.15, 0, car).rotation.z = 0.5;
      at(box(0.06, 1.0, 0.06, INK), 0.2, 3.6, 0, car).rotation.z = -0.6;
      at(box(0.1, 0.06, 1.2, INK), 0.45, 3.95, 0, car);
    }
    if (i === cars - 1) at(ball(0.16, PAL.red, { glow: true }, 4, 3), -carLength / 2 - 0.05, 1.0, 0, car);
  }
  line.add(train);

  // Shuttle from one tunnel to the other; cars vanish while they are underground.
  const half = (cars * pitch) / 2;
  const from = MOUTH_A - DEPTH - half - 2;
  const to = MOUTH_B + DEPTH + half + 2;
  animated.push((t) => {
    const span = to - from;
    const cycle = (t * 7) % (span * 2);
    const forward = cycle < span;
    train.position.x = from + (forward ? cycle : span * 2 - cycle);
    train.rotation.y = forward ? 0 : Math.PI;
    for (const { car, offset } of carGroups) {
      const x = train.position.x + (forward ? offset : -offset);
      car.visible = !inTunnel(x - carLength / 2) || !inTunnel(x + carLength / 2);
    }
  });
}

export function buildRailway(scene, animated) {
  const { line, open0, open1 } = buildLine();
  buildViaduct(line, open0, open1);
  scene.add(bake(line));
  buildTrain(line, animated);
}

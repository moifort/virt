// An old Italian railway, as on the Cinque Terre line: the train bursts out of a tunnel whose
// masonry vault emerges from the mountain slope, crosses the hollow where the mountain meets the
// right-hand ridge on a stone viaduct with a great central arch, and dives into the ridge. A vintage three-car train in the old
// "castano e isabella" livery shuttles back and forth, calling at the little station that stands
// on a shelf of the mountain just outside the first tunnel.
import * as THREE from 'three';
import { PAL, paint, solid } from './style.js';
import { INK, at, bake, ball, box, cone, cyl, lantern, live, ring } from './kit.js';
import { RAIL, STATION, groundAt, railPoint, toX, toZ } from './terrain.js';

// The line runs straight across the angle between the mountain (A) and the ridge (B), in (u, v).
const A = RAIL.a;
const B = RAIL.b;
const LEVEL = RAIL.level;
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
      // Catenary masts stand uphill of the track, except along the platform.
      const side = s > STATION.s0 - 1 && s < STATION.s1 + 1 ? 1 : -1;
      at(cyl(0.08, 0.1, 4.2, INK, 5), s + 0.5, 2.1, side * 1.9, line);
      at(box(0.08, 0.08, 2.0, INK), s + 0.5, 4.0, side * 0.9, line);
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
    // The platform replaces the uphill parapet along the station.
    const from = z < 0 ? Math.max(first, STATION.s1) : first;
    at(box(last - from, 0.6, 0.25, STONE), (from + last) / 2, 0.3, z, line);
    for (let x = from + 1; x < last; x += 2) at(box(0.3, 0.8, 0.3, PAL.ochre), x, 0.4, z, line);
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


/** Ground height in the line frame: `s` along the track, `l` across it. */
function groundBeside(s, l) {
  const p = railPoint(s, l);
  return groundAt(p.x, p.z);
}

/**
 * A small Ligurian station: a stone platform carried on a retaining wall, a two-storey passenger
 * building in faded red with stone trim and a tile roof, an iron awning, name boards and lamps.
 */
function buildStation(line) {
  const P0 = STATION.s0;
  const P1 = STATION.s1;
  const EDGE = -1.72; // platform edge, just clear of the cars
  const BACK = -5.2;
  const TOP = 0.55;
  const WALL = 0xd9785c;
  const TRIM = 0xefe4cf;
  const ROOF = 0xb8623e;
  const GLASS = 0x33303f;
  const IRON = 0x3a4a44;

  // Platform, slab by slab, each carried down to the ground on its stone wall.
  for (let s = P0; s < P1; s += 1) {
    const ground = Math.min(groundBeside(s + 0.5, EDGE), groundBeside(s + 0.5, BACK), LEVEL) - LEVEL - 0.6;
    at(box(1.02, TOP - 0.12 - ground, BACK - EDGE, STONE), s + 0.5, (TOP - 0.12 + ground) / 2, (EDGE + BACK) / 2, line);
    at(box(1.02, 0.12, EDGE - BACK + 0.12, 0xd8cdb8), s + 0.5, TOP - 0.06, (EDGE + BACK) / 2 + 0.03, line);
    if (Math.round(s - P0) % 6 === 3) at(box(0.7, TOP - ground, 0.5, 0xcbb694), s + 0.5, (TOP + ground) / 2 - 0.3, EDGE + 0.2, line);
  }
  at(box(P1 - P0, 0.02, 0.14, 0xf0c93a), (P0 + P1) / 2, TOP + 0.01, EDGE - 0.55, line);
  at(box(P1 - P0, 0.03, 0.2, TRIM), (P0 + P1) / 2, TOP + 0.01, EDGE - 0.06, line);

  // Passenger building, facing the track.
  const W = 12;
  const D = 5.2;
  const FLOOR = 2.6;
  const H = FLOOR * 2 + 0.4;
  const cx = P0 + 10.5;
  const house = at(new THREE.Group(), cx, TOP, BACK - D / 2, line);
  at(box(W, H, D, WALL), 0, H / 2, 0, house);
  at(box(W + 0.14, 0.6, D + 0.14, STONE), 0, 0.3, 0, house);
  at(box(W + 0.12, 0.16, D + 0.12, TRIM), 0, FLOOR + 0.25, 0, house);
  at(box(W + 0.8, 0.18, D + 0.8, TRIM), 0, H + 0.09, 0, house);
  for (const sx of [-1, 1]) at(box(0.4, H, 0.4, TRIM), sx * (W / 2 - 0.1), H / 2, D / 2 - 0.1, house);
  // Hipped tile roof.
  const hw = (W + 1.1) / 2;
  const hd = (D + 1.1) / 2;
  const r = (W - D) / 2;
  const roof = new THREE.BufferGeometry();
  const [a, b, c, d, e, f] = [[-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, 0, -hd], [-r, 1.4, 0], [r, 1.4, 0]];
  roof.setAttribute('position', new THREE.Float32BufferAttribute([a, b, f, a, f, e, b, c, f, c, d, e, c, e, f, d, a, e].flat(), 3));
  roof.computeVertexNormals();
  at(solid(roof, paint(ROOF, { flat: true })), 0, H + 0.18, 0, house);
  for (const x of [-3.4, 3.4]) at(box(0.5, 1.3, 0.5, WALL), x, H + 1.2, -0.6, house);

  // Track side: five round-headed doors below, five shuttered windows above, the clock and the name.
  const front = D / 2;
  for (let k = -2; k <= 2; k++) {
    const x = k * 2.2;
    at(box(1.25, 2.0, 0.08, TRIM), x, 1.0, front + 0.02, house);
    at(cyl(0.625, 0.625, 0.08, TRIM, 12), x, 2.0, front + 0.02, house).rotation.x = Math.PI / 2;
    at(box(0.95, 1.9, 0.1, k === 0 ? 0x5a4034 : GLASS), x, 0.95, front + 0.04, house);
    at(cyl(0.475, 0.475, 0.1, GLASS, 12), x, 1.9, front + 0.04, house).rotation.x = Math.PI / 2;
    at(box(1.0, 1.4, 0.08, TRIM), x, FLOOR + 1.5, front + 0.02, house);
    at(box(0.72, 1.15, 0.1, GLASS), x, FLOOR + 1.5, front + 0.04, house);
    for (const sx of [-1, 1]) at(box(0.36, 1.15, 0.06, 0x4d6a4c), x + sx * 0.56, FLOOR + 1.5, front + 0.07, house);
    at(box(1.2, 0.1, 0.2, TRIM), x, FLOOR + 0.85, front + 0.08, house);
  }
  for (const sx of [-1, 1]) {
    for (const [z, y] of [[-1.2, 1.3], [1.2, 1.3], [-1.2, FLOOR + 1.5], [1.2, FLOOR + 1.5]]) {
      at(box(0.08, 1.4, 1.0, TRIM), sx * (W / 2 + 0.02), y, z, house);
      at(box(0.1, 1.15, 0.72, GLASS), sx * (W / 2 + 0.04), y, z, house);
    }
  }
  // Name board in white on blue, as on every Italian platform, and the station clock.
  at(box(4.2, 0.6, 0.1, 0x2f4f9a), 0, H - 0.5, front + 0.06, house);
  at(box(3.2, 0.2, 0.12, TRIM), 0, H - 0.5, front + 0.07, house);
  const clock = at(cyl(0.42, 0.42, 0.14, TRIM, 14), 4.4, FLOOR + 0.25, front + 0.5, house);
  clock.rotation.z = Math.PI / 2;
  at(cyl(0.46, 0.46, 0.08, IRON, 14), 4.4, FLOOR + 0.25, front + 0.5, house).rotation.z = Math.PI / 2;
  at(box(0.08, 0.08, 0.5, IRON), 4.4, FLOOR + 0.25, front + 0.25, house);
  // Iron awning on brackets over the doors.
  const awning = at(box(W - 0.6, 0.1, 1.7, IRON), 0, FLOOR - 0.05, front + 0.85, house);
  awning.rotation.x = 0.12;
  at(box(W - 0.6, 0.22, 0.06, TRIM), 0, FLOOR - 0.27, front + 1.7, house);
  for (let x = -W / 2 + 0.6; x <= W / 2 - 0.5; x += 2.2) {
    const strut = at(box(0.07, 0.07, 1.5, IRON), x, FLOOR - 0.55, front + 0.65, house);
    strut.rotation.x = -0.6;
  }
  // A low annex for the goods office, and a water tank on the roof side.
  at(box(4.4, 2.8, 4.2, 0xe6b98a), W / 2 + 2.2, 1.4, -0.4, house);
  at(box(4.8, 0.2, 4.6, ROOF), W / 2 + 2.2, 2.9, -0.4, house);
  at(box(0.9, 1.7, 0.1, 0x5a4034), W / 2 + 2.2, 0.85, 1.72, house);
  at(box(0.8, 0.8, 0.1, GLASS), W / 2 + 3.6, 1.6, 1.72, house);

  // Platform furniture: benches, lamps, name boards on posts, flower tubs, a luggage barrow.
  for (const x of [cx - 4.4, cx + 4.4]) {
    at(box(1.7, 0.1, 0.5, 0x8a5a41), x, TOP + 0.5, BACK + 0.45, line);
    at(box(1.7, 0.5, 0.08, 0x8a5a41), x, TOP + 0.85, BACK + 0.2, line);
    for (const dx of [-0.7, 0.7]) at(box(0.08, 0.5, 0.45, IRON), x + dx, TOP + 0.25, BACK + 0.45, line);
  }
  for (const x of [P0 + 1.5, P1 - 8, P1 - 1.5]) lantern(line, x, TOP, BACK + 0.5);
  for (const x of [P0 + 3, P1 - 3.5]) {
    for (const dx of [-0.9, 0.9]) at(cyl(0.05, 0.05, 2.3, IRON, 5), x + dx, TOP + 1.15, BACK + 0.3, line);
    at(box(2.2, 0.6, 0.08, 0x2f4f9a), x, TOP + 2.2, BACK + 0.3, line);
    at(box(1.6, 0.18, 0.1, TRIM), x, TOP + 2.2, BACK + 0.32, line);
  }
  for (const x of [cx - 2.2, cx + 2.2, P1 - 6]) {
    at(cyl(0.38, 0.3, 0.5, 0xb8623e, 8), x, TOP + 0.25, BACK + 0.5, line);
    at(ball(0.42, 0x4c7448, { flat: true }, 6, 4), x, TOP + 0.75, BACK + 0.5, line);
    for (const [dx, dz] of [[0.2, 0.15], [-0.2, 0.1], [0, -0.2]]) at(ball(0.13, PAL.red, {}, 4, 3), x + dx, TOP + 1.05, BACK + 0.5 + dz, line);
  }
  const barrow = at(new THREE.Group(), P1 - 11, TOP, BACK + 1.2, line);
  at(box(1.5, 0.1, 0.8, 0x8a5a41), 0, 0.45, 0, barrow);
  for (const [x, c] of [[-0.35, 0x7a4a3a], [0.3, 0x4d6a4c]]) at(box(0.55, 0.4, 0.6, c), x, 0.7, 0, barrow);
  for (const z of [-0.42, 0.42]) at(cyl(0.22, 0.22, 0.06, IRON, 8), 0.35, 0.22, z, barrow).rotation.x = Math.PI / 2;
  // Railing along the open end of the platform, beyond the building.
  for (let x = cx + W / 2 + 4.6; x <= P1; x += 1.2) at(box(0.07, 0.9, 0.07, IRON), x, TOP + 0.45, BACK + 0.05, line);
  at(box(P1 - cx - W / 2 - 4.6, 0.07, 0.07, IRON), (P1 + cx + W / 2 + 4.6) / 2, TOP + 0.9, BACK + 0.05, line);
  // Two cypresses and a stone pine's worth of shade behind, in the yard.
  for (const [x, z] of [[P0 + 2.5, -8.5], [P0 + 3.5, -11]]) {
    at(cyl(0.1, 0.14, 0.7, 0x7d5a48, 5), x, TOP + 0.3, z, line);
    const body = at(ball(0.6, 0x2f5840, { flat: true }, 7, 6), x, TOP + 2.6, z, line);
    body.scale.y = 2.4;
    at(cone(0.4, 2.6, 0x2f5840, 7, { flat: true }), x, TOP + 5, z, line);
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

  // Shuttle from one tunnel to the other, calling at the station on the way; cars vanish while
  // they are underground.
  const half = (cars * pitch) / 2;
  const from = MOUTH_A - DEPTH - half - 2;
  const to = MOUTH_B + DEPTH + half + 2;
  const stop = (STATION.s0 + STATION.s1) / 2;
  const SPEED = 8;
  const ease = (k) => k * k * (3 - 2 * k);
  // One leg of the journey: [duration, position at start, position at end, heading forward?].
  const legs = [
    [((stop - from) / SPEED) * 1.5, from, stop, true],
    [7, stop, stop, true],
    [((to - stop) / SPEED) * 1.5, stop, to, true],
    [4, to, to, false],
    [((to - stop) / SPEED) * 1.5, to, stop, false],
    [7, stop, stop, false],
    [((stop - from) / SPEED) * 1.5, stop, from, false],
    [4, from, from, true],
  ];
  const total = legs.reduce((sum, leg) => sum + leg[0], 0);
  animated.push((t) => {
    let clock = t % total;
    let leg = legs[0];
    for (leg of legs) {
      if (clock < leg[0]) break;
      clock -= leg[0];
    }
    const [duration, x0, x1, forward] = leg;
    train.position.x = x0 + (x1 - x0) * ease(clock / duration);
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
  buildStation(line);
  scene.add(bake(line));
  buildTrain(line, animated);
}

// An old Italian railway across the mountain, as on the Cinque Terre line: stone arch viaducts
// over the ravines, tunnels through the ridges, catenary masts, and a vintage three-car train
// in the old "castano e isabella" livery shuttling back and forth.
import * as THREE from 'three';
import { PAL } from './style.js';
import { INK, at, bake, ball, box, cyl, live, ring } from './kit.js';
import { SQUARE, groundAt, toX, toZ } from './terrain.js';

const RAIL_U = 84;
const START_V = -24;
const END_V = SQUARE.v1;
const STONE = 0xe2cfae;
const CASTANO = 0x7a4a3a;
const ISABELLA = 0xe8d6a8;
const TUNNEL_CLEARANCE = 5;

const groundAlong = (v) => groundAt(toX(RAIL_U, v), toZ(RAIL_U, v));

export function buildRailway(scene, animated) {
  // Lay the line at a constant level, around the median of the ground it crosses.
  const profile = [];
  for (let v = START_V; v <= END_V; v++) profile.push(groundAlong(v));
  const level = [...profile].sort((a, b) => a - b)[Math.floor(profile.length * 0.55)] + 1;
  const inTunnel = (v) => groundAlong(v) > level + TUNNEL_CLEARANCE;

  // Local frame: x runs along the shore (v), z = 0 on the track centre line.
  const line = new THREE.Group();
  line.position.set(toX(RAIL_U, 0), level, toZ(RAIL_U, 0));
  line.rotation.y = Math.PI / 4;

  let previous = inTunnel(START_V);
  for (let v = START_V; v < END_V; v += 1) {
    const ground = groundAlong(v) - level;
    const tunnel = inTunnel(v);
    // Tunnel portals where the line enters or leaves a ridge.
    if (tunnel !== previous) {
      const x = tunnel ? v - 0.5 : v - 0.5;
      at(box(0.8, 5.4, 4.6, STONE), x, 2.2, 0, line);
      at(box(0.9, 4.2, 3.2, 0x2b2533), x + (tunnel ? 0.05 : -0.05), 1.6, 0, line);
      at(box(1.0, 0.6, 5.2, PAL.ochre), x, 5.1, 0, line);
    }
    previous = tunnel;
    if (tunnel) continue;
    // Track: ballast, sleepers and two rails.
    at(box(1.05, 0.25, 3.2, 0xb8a890), v + 0.5, -0.12, 0, line);
    at(box(0.3, 0.12, 2.6, 0x6a4a3a), v + 0.25, 0.05, 0, line);
    at(box(0.3, 0.12, 2.6, 0x6a4a3a), v + 0.75, 0.05, 0, line);
    for (const z of [-0.72, 0.72]) at(box(1.0, 0.1, 0.1, 0x5a5a6a), v + 0.5, 0.16, z, line);
    // Over the ravines: a stone viaduct with arches.
    if (ground < -1.2) {
      at(box(1.0, 0.9, 3.6, STONE), v + 0.5, -0.7, 0, line);
      if (v % 6 === 0) {
        const h = -ground + 0.5;
        at(box(1.4, h, 3.2, STONE), v + 0.5, -h / 2 - 0.6, 0, line);
        at(box(1.8, 0.5, 3.6, PAL.ochre), v + 0.5, -h - 0.4, 0, line);
        if (groundAlong(v + 6) - level < -1.2) {
          // The arch springs from pillar to pillar under the deck.
          const arch = at(ring(2.4, 0.5, STONE, Math.PI, 12), v + 3.5, -3.6, 0, line);
          arch.scale.z = 3;
        }
      }
    }
    // Catenary masts.
    if (v % 8 === 0) {
      at(cyl(0.08, 0.1, 4.2, INK, 5), v + 0.5, 2.1, -1.9, line);
      at(box(0.08, 0.08, 2.0, INK), v + 0.5, 4.0, -0.9, line);
    }
  }
  at(box(END_V - START_V, 0.04, 0.04, INK), (START_V + END_V) / 2, 3.95, 0, line);
  scene.add(bake(line));

  // The train.
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

  // Shuttle along the line: out through the island's edge and back. Cars vanish inside
  // tunnels and past the edge of the island.
  const half = (cars * pitch) / 2;
  const from = START_V - half;
  const to = END_V + half;
  animated.push((t) => {
    const span = to - from;
    const cycle = (t * 7) % (span * 2);
    const forward = cycle < span;
    train.position.x = from + (forward ? cycle : span * 2 - cycle);
    train.rotation.y = forward ? 0 : Math.PI;
    for (const { car, offset } of carGroups) {
      const x = train.position.x + (forward ? offset : -offset);
      car.visible = x > START_V + carLength / 2 && x < END_V - carLength / 2 && !inTunnel(x);
    }
  });
}

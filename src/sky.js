// High sky: zeppelins cruising far above the bay, hot-air balloons rising behind the mountain.
import * as THREE from 'three';
import { pick } from './noise.js';
import { PAL, paint, solid } from './style.js';
import { INK, at, ball, box, cyl, live, ring } from './kit.js';
import { toX, toZ } from './terrain.js';

const ZEPPELIN_ALT = 62;
const ZEPPELIN_RANGE = 260;

/** A rigid airship, nose toward +x: striped silver hull, cross tail, gondola and spinning propellers. */
function zeppelin(hullColor, trim) {
  const g = new THREE.Group();
  const L = 13;
  const R = 3.2;
  const section = (x) => R * Math.sqrt(1 - (x / L) ** 2);
  at(ball(1, hullColor, {}, 22, 12), 0, 0, 0, g).scale.set(L, R, R);
  // A coloured belly peeks out under the hull, as on the old liners of the sky.
  at(ball(1, trim, {}, 22, 12), 0, -0.55, 0, g).scale.set(L * 0.96, R * 0.86, R * 1.02);
  // Girder ribs, and broad trim bands at the nose and tail.
  for (let x = -L + 2.5; x < L - 1.5; x += 2.6) {
    const rib = at(ring(section(x), 0.1, 0x9a96a6, Math.PI * 2, 20), x, 0, 0, g);
    rib.rotation.y = Math.PI / 2;
  }
  for (const x of [-8.6, 8.4, 10.2]) {
    const band = at(ring(section(x), 0.3, trim, Math.PI * 2, 20), x, 0, 0, g);
    band.rotation.y = Math.PI / 2;
  }
  at(ball(0.5, trim, {}, 8, 6), L - 0.2, 0, 0, g);
  // Cross tail.
  for (const [y, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    at(box(3.4, y ? 2.4 : 0.16, z ? 2.4 : 0.16, trim), -L + 2.4, y * 1.7, z * 1.7, g);
  }
  // Gondola with lit windows, slung under the hull.
  at(box(4.2, 1.1, 1.3, PAL.cream), 1.5, -R - 0.55, 0, g);
  at(box(3.6, 0.3, 1.34, PAL.saffron, { glow: true }), 1.5, -R - 0.45, 0, g);
  at(box(4.4, 0.16, 1.5, trim), 1.5, -R - 1.15, 0, g);
  // Engine pods on outriggers; their propellers are animated.
  const props = [];
  for (const z of [-1, 1]) {
    at(box(0.12, 0.12, 1.2, INK), -3, -R + 0.2, z * (R - 0.3), g);
    const pod = at(cyl(0.35, 0.45, 1.6, PAL.ivory, 8), -3, -R + 0.2, z * (R + 0.4), g);
    pod.rotation.z = Math.PI / 2;
    const prop = at(new THREE.Group(), -3.9, -R + 0.2, z * (R + 0.4), g);
    at(box(0.06, 1.8, 0.2, INK), 0, 0, 0, prop);
    at(box(0.06, 0.2, 1.8, INK), 0, 0, 0, prop);
    props.push(prop);
  }
  return { g, props };
}

/** A hot-air balloon: faceted envelope in two-colour gores, skirt, ropes, wicker basket and burner. */
function balloon(rng) {
  const g = new THREE.Group();
  const [a, b] = pick(rng, [
    [PAL.saffron, PAL.red],
    [PAL.ivory, PAL.teal],
    [PAL.pink, PAL.lilac],
    [PAL.ochre, PAL.blue],
    [PAL.coral, PAL.cream],
  ]);
  const R = 4 + rng() * 1.6;
  const gores = 10;
  const envelope = at(new THREE.Group(), 0, 0, 0, g);
  envelope.scale.y = 1.18;
  for (let k = 0; k < gores; k++) {
    const geo = new THREE.SphereGeometry(R, 2, 9, (k / gores) * Math.PI * 2, (Math.PI * 2) / gores, 0, Math.PI * 0.8);
    envelope.add(solid(geo, paint(k % 2 ? a : b, { flat: true })));
  }
  const band = at(ring(R, 0.18, PAL.ivory, Math.PI * 2, gores * 2), 0, 0, 0, envelope);
  band.rotation.x = Math.PI / 2;
  // The envelope narrows into a skirt above the basket.
  const lip = Math.sin(Math.PI * 0.8) * R;
  const skirtTop = Math.cos(Math.PI * 0.8) * R * 1.18;
  at(cyl(lip, lip * 0.45, 1.4, b, gores, { flat: true }), 0, skirtTop - 0.7, 0, g);
  const basketY = skirtTop - 3.4;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const rope = at(cyl(0.04, 0.04, 2.1, INK, 3), x * 0.45, basketY + 1.6, z * 0.45, g);
    rope.rotation.set(z * 0.08, 0, -x * 0.08);
  }
  at(box(1.2, 0.9, 1.2, PAL.wood), 0, basketY, 0, g);
  at(box(1.3, 0.15, 1.3, 0x8a5a41), 0, basketY + 0.45, 0, g);
  at(ball(0.25, PAL.saffron, { glow: true }, 6, 4), 0, basketY + 1.1, 0, g);
  return g;
}

export function buildSky(scene, rng, animated) {
  // Zeppelins cruise high over the bay along the shore, slowly enough to be watched.
  [
    { u: -55, speed: 2.6, phase: 0.1, hull: 0xd8d4dc, trim: PAL.red },
    { u: 25, speed: -1.9, phase: 0.6, hull: PAL.cream, trim: PAL.teal },
  ].forEach(({ u, speed, phase, hull, trim }, i) => {
    const { g, props } = zeppelin(hull, trim);
    scene.add(live(g));
    const alt = ZEPPELIN_ALT + i * 10;
    animated.push((t, dt) => {
      const run = (t * speed + phase * ZEPPELIN_RANGE * 2) % (ZEPPELIN_RANGE * 2);
      const v = (run < 0 ? run + ZEPPELIN_RANGE * 2 : run) - ZEPPELIN_RANGE;
      g.position.set(toX(u, v), alt + Math.sin(t * 0.25 + i) * 0.8, toZ(u, v));
      // Nose along +v: the shore direction is (1, -1) / √2 in world x/z.
      g.rotation.set(0, speed > 0 ? Math.PI / 4 : (-3 * Math.PI) / 4, Math.sin(t * 0.3 + i) * 0.02);
      for (const p of props) p.rotation.x += dt * 9;
    });
  });

  // Hot-air balloons drifting up beyond the mountain, peeking over its crest.
  for (let i = 0; i < 6; i++) {
    const g = balloon(rng);
    scene.add(live(g));
    const home = { u: 118 + rng() * 22, v: -80 + i * 30 + (rng() - 0.5) * 16, y: 34 + rng() * 16 };
    const phase = rng() * 10;
    animated.push((t) => {
      const u = home.u + Math.sin(t * 0.04 + phase) * 4;
      const v = home.v + Math.sin(t * 0.03 + phase * 2) * 10;
      g.position.set(toX(u, v), home.y + Math.sin(t * 0.18 + phase) * 3, toZ(u, v));
      g.rotation.y = t * 0.05 + phase;
    });
  }
}

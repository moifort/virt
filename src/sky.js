// High sky: a flight of hot-air balloons like the dawn launches over Cappadocia — tall
// teardrop envelopes sewn in bright gores, drifting at every height behind the mountain and
// far out over the sea, their burners flaring now and then.
import * as THREE from 'three';
import { pick } from './noise.js';
import { PAL, paint, solid } from './style.js';
import { INK, at, ball, box, cone, cyl, live } from './kit.js';
import { toX, toZ } from './terrain.js';

const GORES = 16;
// The envelope in profile, from the crown down to the mouth: (radius, height) in units of its
// widest radius. A dome over a long taper, the natural shape of a balloon full of hot air.
const PROFILE = [
  [0, 1], [0.31, 0.95], [0.59, 0.81], [0.81, 0.59], [0.95, 0.31], [1, 0], [0.95, -0.31], [0.72, -0.78], [0.46, -1.2], [0.25, -1.55],
];
const BANDS = PROFILE.length - 1;

// Liveries: a few colours, and the way they run over the gores (g) and bands (b).
const COLOURS = [
  [0xd9584a, 0xf4c95a, 0xf5ecd8],
  [0x4a86c2, 0xf5ecd8, 0xe9866a],
  [0xd9584a, 0xee9a4a, 0xf4d264, 0x74b06a, 0x5a9ad0, 0x8f6ab8],
  [0x58b0a6, 0xf5ecd8, 0xf4c95a],
  [0x9a3a4c, 0xf3e4c0, 0xdcae52],
  [0xe8809c, 0xf7d8de, 0x8660a8],
  [0xee9a4a, 0xf5ecd8, 0x4a86c2, 0xd9584a],
];
const PATTERNS = [
  (g) => g,
  (g, b) => b,
  (g, b) => g + b,
  (g, b) => b + Math.abs((g % 4) - 2),
  (g, b) => Math.floor(g / 2) + Math.floor(b / 2),
  (g, b) => (b === 0 || b === 4 ? 1 : b > 6 ? 2 : 0),
  (g, b) => (g % 4 === 0 ? 1 : b < 2 ? 2 : 0),
];

/**
 * A hot-air balloon: faceted teardrop envelope patterned gore by gore, scoop, load ropes,
 * wicker basket and burner. Returns the group and `fire(on, dark, t)`, which lights the burner:
 * after dark the whole envelope glows from within like a paper lantern.
 */
function balloon(rng) {
  const g = new THREE.Group();
  const colours = pick(rng, COLOURS);
  const pattern = pick(rng, PATTERNS);
  const R = 4 + rng() * 1.8;

  // One list of triangles per colour of fabric.
  const panels = new Map();
  const point = (ring, gore) => {
    const [r, y] = PROFILE[ring];
    const a = (gore / GORES) * Math.PI * 2;
    return [Math.cos(a) * r * R, y * R, Math.sin(a) * r * R];
  };
  for (let b = 0; b < BANDS; b++) {
    for (let k = 0; k < GORES; k++) {
      const colour = colours[((pattern(k, b) % colours.length) + colours.length) % colours.length];
      if (!panels.has(colour)) panels.set(colour, []);
      const [A, B, C, D] = [point(b, k), point(b, k + 1), point(b + 1, k + 1), point(b + 1, k)];
      panels.get(colour).push(...A, ...B, ...C, ...A, ...C, ...D);
    }
  }
  const plain = at(new THREE.Group(), 0, 0, 0, g);
  const lit = at(new THREE.Group(), 0, 0, 0, g);
  lit.visible = false;
  for (const [colour, triangles] of panels) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
    geo.computeVertexNormals();
    plain.add(solid(geo, paint(colour, { flat: true })));
    lit.add(solid(geo, paint(colour, { flat: true, glow: true })));
  }

  // The scoop at the mouth, the load ropes down to the basket, the burner frame.
  const mouth = PROFILE[BANDS][1] * R;
  const lip = PROFILE[BANDS][0] * R;
  at(cyl(lip, lip * 0.8, 0.8, colours[0], GORES, { flat: true }), 0, mouth - 0.4, 0, g);
  const basketY = mouth - 3.3;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const rope = at(cyl(0.035, 0.035, 2.5, INK, 3), x * 0.62, basketY + 1.75, z * 0.62, g);
    rope.rotation.set(z * 0.14, 0, -x * 0.14);
    at(cyl(0.04, 0.04, 1.0, 0x8a8a96, 4), x * 0.42, basketY + 1.0, z * 0.42, g);
  }
  at(box(1.3, 1.0, 1.3, 0xb98a5a), 0, basketY, 0, g);
  at(box(1.42, 0.16, 1.42, 0x8a5a41), 0, basketY + 0.5, 0, g);
  at(box(1.34, 0.1, 1.34, 0x9a6c48), 0, basketY - 0.2, 0, g);
  at(box(0.5, 0.22, 0.5, 0x8a8a96), 0, basketY + 1.5, 0, g);
  // Passengers leaning on the rim, seen as heads.
  for (const [x, z, c] of [[-0.35, 0.3, 0x5a4034], [0.3, -0.25, 0xd8a24a], [0.25, 0.35, 0x3b3346]]) at(ball(0.17, c, {}, 5, 4), x, basketY + 0.75, z, g);
  const flame = at(cone(0.3, 1.5, PAL.saffron, 6, { glow: true }), 0, basketY + 2.3, 0, g);
  flame.visible = false;

  return {
    group: g,
    fire(on, dark, t) {
      flame.visible = on;
      flame.scale.set(1, 0.8 + 0.3 * Math.sin(t * 31), 1);
      lit.visible = on && dark;
      plain.visible = !lit.visible;
    },
  };
}

export function buildSky(scene, rng, animated) {
  // Most of the flight rises beyond the mountain and peeks over its crest; the rest hang far
  // out over the sea, small with distance.
  const flight = [];
  for (let i = 0; i < 9; i++) flight.push({ u: 116 + rng() * 40, v: -95 + i * 24 + (rng() - 0.5) * 16, y: 30 + rng() * 26, size: 0.8 + rng() * 0.35 });
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2;
    const d = 210 + rng() * 160;
    flight.push({ u: Math.cos(a) * d, v: Math.sin(a) * d, y: 26 + rng() * 40, size: 0.5 + rng() * 0.25 });
  }
  for (const home of flight) {
    const { group, fire } = balloon(rng);
    group.scale.setScalar(home.size);
    scene.add(live(group));
    const phase = rng() * 100;
    const every = 7 + rng() * 6;
    animated.push((t, dt, climate) => {
      const u = home.u + Math.sin(t * 0.04 + phase) * 4;
      const v = home.v + Math.sin(t * 0.03 + phase * 2) * 10;
      // They climb and sink slowly, each to its own rhythm.
      group.position.set(toX(u, v), home.y + Math.sin(t * 0.05 + phase) * 7 + Math.sin(t * 0.18 + phase) * 1.5, toZ(u, v));
      group.rotation.y = t * 0.05 + phase;
      // A long blast of the burner every few seconds; after dark it lights the envelope up.
      fire((t + phase) % every < 1.6, (climate?.night ?? 0) > 0.25, t);
    });
  }
}

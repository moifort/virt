// High sky: hot-air balloons rising behind the mountain.
import * as THREE from 'three';
import { pick } from './noise.js';
import { PAL, paint, solid } from './style.js';
import { INK, at, ball, box, cyl, live, ring } from './kit.js';
import { toX, toZ } from './terrain.js';

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

// Things that move: butterflies, airships, floating islands, boats.
import * as THREE from 'three';
import { pick } from './noise.js';
import { PAL, WATER_LEVEL, paint, solid } from './style.js';
import { at, ball, cone, cyl } from './kit.js';
import { tree } from './nature.js';
import { gozzo } from './zones.js';
import { footU, groundAt, isWild, randomSpot, toX, toZ } from './terrain.js';

export function buildLife(scene, rng, animated) {
  // Butterflies fluttering over the meadows.
  for (let i = 0; i < 36; i++) {
    const home = randomSpot(rng, new THREE.Vector3(), 90);
    if (!isWild(home.x, home.z)) continue;
    const b = new THREE.Group();
    const color = pick(rng, [PAL.saffron, PAL.pink, PAL.ivory, PAL.blue, PAL.coral]);
    const wings = [-1, 1].map((s) => {
      const pivot = at(new THREE.Group(), 0, 0, 0, b);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.26).translate(s * 0.16, 0, 0), paint(color, { doubleSide: true }));
      w.rotation.x = -Math.PI / 2;
      pivot.add(w);
      return pivot;
    });
    scene.add(b);
    const phase = rng() * 100;
    animated.push((t) => {
      const x = home.x + Math.sin(t * 0.31 + phase) * 4 + Math.sin(t * 0.73 + phase * 2) * 1.5;
      const z = home.z + Math.cos(t * 0.27 + phase) * 4;
      b.position.set(x, groundAt(x, z) + 1.2 + Math.sin(t * 2.3 + phase) * 0.4, z);
      b.rotation.y = t * 0.3 + phase;
      const flap = Math.sin(t * 18 + phase) * 0.9;
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
    });
  }

  // Jellyfish airships drifting overhead, dragging their shadows across the valley.
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const R = 2.4 + rng() * 1.2;
    at(solid(new THREE.SphereGeometry(R, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), paint(pick(rng, [PAL.rose, PAL.lilac, PAL.teal]))), 0, 0, 0, g);
    const belly = at(new THREE.Mesh(new THREE.CircleGeometry(Math.sin(Math.PI * 0.55) * R, 18), paint(PAL.plum)), 0, Math.cos(Math.PI * 0.55) * R, 0, g);
    belly.rotation.x = Math.PI / 2;
    at(ball(0.6, PAL.saffron, { glow: true }, 8, 6), 0, -R * 0.9, 0, g);
    const strands = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const pivot = at(new THREE.Group(), Math.cos(a) * R * 0.55, belly.position.y, Math.sin(a) * R * 0.55, g);
      at(cyl(0.08, 0.04, R * 1.6, PAL.ivory, 4), 0, -R * 0.8, 0, pivot);
      strands.push(pivot);
    }
    scene.add(g);
    const orbit = { r: 40 + rng() * 40, speed: 0.015 + rng() * 0.015, phase: rng() * 6, alt: 22 + rng() * 8 };
    animated.push((t) => {
      const a = t * orbit.speed + orbit.phase;
      const x = Math.cos(a) * orbit.r;
      const z = Math.sin(a) * orbit.r;
      g.position.set(x, Math.max(groundAt(x, z), WATER_LEVEL) + orbit.alt + Math.sin(t * 0.6 + orbit.phase) * 1.2, z);
      strands.forEach((p, k) => {
        p.rotation.x = Math.sin(t * 1.3 + k) * 0.25;
        p.rotation.z = Math.cos(t * 1.1 + k * 1.7) * 0.25;
      });
    });
  }

  // Floating islands above the mountain.
  for (let i = 0; i < 3; i++) {
    const v = -70 + i * 70;
    const u = footU(v) + 50 + rng() * 20;
    const g = new THREE.Group();
    const R = 2.5 + rng() * 2;
    at(cyl(R, R * 0.9, 1, PAL.grass, 9, { flat: true }), 0, 0, 0, g);
    at(cone(R * 0.9, R * 2, PAL.rose, 9, { flat: true }), 0, -0.5 - R, 0, g).rotation.x = Math.PI;
    at(tree(rng), 0, 0.5, 0, g);
    const x = toX(u, v);
    const z = toZ(u, v);
    const baseY = groundAt(x, z) + 16 + rng() * 6;
    scene.add(at(g, x, baseY, z));
    animated.push((t) => (g.position.y = baseY + Math.sin(t * 0.4 + i) * 0.8));
  }

  // Sailboats crossing the bay.
  for (let i = 0; i < 3; i++) {
    const boat = gozzo(rng, true);
    scene.add(boat);
    const u = -64 - i * 11;
    const speed = (0.012 + rng() * 0.01) * (i % 2 ? 1 : -1);
    const phase = rng() * 6;
    animated.push((t) => {
      const v = Math.sin(t * speed + phase) * 45;
      boat.position.set(toX(u, v), WATER_LEVEL + Math.sin(t * 1.2 + i) * 0.1, toZ(u, v));
      const heading = Math.cos(t * speed + phase) * speed > 0 ? (3 * Math.PI) / 4 : -Math.PI / 4;
      boat.rotation.set(0, heading, Math.sin(t * 0.9 + i) * 0.06);
    });
  }
}


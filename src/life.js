// Things that move: butterflies and boats.
import * as THREE from 'three';
import { pick } from './noise.js';
import { PAL, WATER_LEVEL, paint } from './style.js';
import { at } from './kit.js';
import { gozzo } from './zones.js';
import { groundAt, isWild, randomSpot, toX, toZ } from './terrain.js';

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

  // Sailboats crossing the bay.
  for (let i = 0; i < 3; i++) {
    const boat = gozzo(rng, true);
    scene.add(boat);
    const u = -64 - i * 11;
    const speed = (0.012 + rng() * 0.01) * (i % 2 ? 1 : -1);
    const phase = rng() * 6;
    animated.push((t) => {
      const v = -35 + Math.sin(t * speed + phase) * 65;
      boat.position.set(toX(u, v), WATER_LEVEL + Math.sin(t * 1.2 + i) * 0.1, toZ(u, v));
      const heading = Math.cos(t * speed + phase) * speed > 0 ? (3 * Math.PI) / 4 : -Math.PI / 4;
      boat.rotation.set(0, heading, Math.sin(t * 0.9 + i) * 0.06);
    });
  }
}


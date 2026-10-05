// Flora and minerals.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, pick } from './noise.js';
import { PAL, WATER_LEVEL, paint, solid } from './style.js';
import { INK, STONE, WARM_LIGHT, at, ball, cone, cyl, lantern } from './kit.js';
import { PATHS, footU, groundAt, isWild, randomSpot, scatterInstanced, slopeAt, toU, toV } from './terrain.js';

export function tree(rng) {
  const g = new THREE.Group();
  const kind = rng();
  if (kind < 0.4) {
    // Umbrella acacia: crooked trunk, flat layered crown.
    const H = 4 + rng() * 3;
    const trunk = at(cyl(0.18, 0.35, H, PAL.wood, 6), 0, H / 2, 0, g);
    trunk.rotation.z = (rng() - 0.5) * 0.3;
    const color = pick(rng, [PAL.grassDeep, PAL.teal, 0x7fb07a]);
    for (let k = 0; k < 2; k++) {
      const crown = at(ball(2.2 - k * 0.6 + rng() * 0.6, k ? PAL.grass : color, { flat: true }, 8, 5), 0, H + k * 0.55, 0, g);
      crown.scale.y = 0.35;
    }
  } else if (kind < 0.6) {
    const H = 2.5 + rng() * 2;
    at(cyl(0.15, 0.26, H, PAL.ivory, 6), 0, H / 2, 0, g);
    at(ball(1.3 + rng() * 0.6, pick(rng, [PAL.pink, PAL.teal, PAL.grass, PAL.saffron, PAL.lilac]), { flat: true }, 8, 6), 0, H + 0.8, 0, g);
  } else {
    const H = 5 + rng() * 3;
    at(cyl(0.12, 0.18, 1, PAL.wood, 5), 0, 0.5, 0, g);
    at(cone(0.9, H, pick(rng, [PAL.grassDeep, 0x3f8f7a]), 7, { flat: true }), 0, 0.8 + H / 2, 0, g);
  }
  g.rotation.y = rng() * Math.PI * 2;
  return g;
}

export function mushroom(rng) {
  const g = new THREE.Group();
  const H = 5 + rng() * 6;
  const R = 2.5 + rng() * 2.5;
  at(cyl(0.3 + H * 0.03, 0.55 + H * 0.06, H, PAL.ivory, 8), 0, H / 2, 0, g);
  const cap = at(solid(new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint(pick(rng, [PAL.rose, PAL.lilac, PAL.coral, PAL.teal]))), 0, H - 0.2, 0, g);
  cap.scale.y = 0.55;
  const gill = at(new THREE.Mesh(new THREE.CircleGeometry(R, 16), paint(PAL.plum)), 0, H - 0.2, 0, g);
  gill.rotation.x = Math.PI / 2;
  for (let k = 0; k < 4; k++) {
    const a = rng() * Math.PI * 2;
    const p = 0.4 + rng() * 0.6;
    at(ball(0.3, PAL.ivory, {}, 6, 4), Math.cos(a) * Math.sin(p) * R, H - 0.2 + Math.cos(p) * R * 0.55, Math.sin(a) * Math.sin(p) * R, g);
  }
  g.rotation.z = (rng() - 0.5) * 0.2;
  return g;
}

export function buildNature(scene, rng) {
  // Grass tufts swaying in the wind.
  const blades = [];
  for (let k = 0; k < 4; k++) {
    const b = new THREE.ConeGeometry(0.12, 0.9 + (k % 2) * 0.3, 3);
    b.translate(0, 0.45, 0);
    b.rotateZ((k - 1.5) * 0.25);
    b.rotateY((k / 4) * Math.PI);
    blades.push(b);
  }
  scatterInstanced(scene, rng, mergeGeometries(blades), paint(0xffffff, { sway: true }), 4500, (r, p, s, c) => {
    randomSpot(r, p);
    if (!isWild(p.x, p.z, -1.5) || slopeAt(p.x, p.z) > 0.5) return false;
    const lush = fbm(p.x * 0.05 + 3, p.z * 0.05 - 8, 3);
    if (lush < 0.5 && r() < 0.85) return false;
    s.setScalar(0.7 + r() * 0.8);
    c.setHex(lush > 0.55 ? pick(r, [PAL.grass, PAL.grassDeep, PAL.moss]) : pick(r, [0xc9cf86, PAL.ochre, PAL.grass]));
    return true;
  });

  // Wildflowers.
  const flowerGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.03, 0.03, 0.6, 3).translate(0, 0.3, 0).toNonIndexed(),
    new THREE.IcosahedronGeometry(0.17, 0).translate(0, 0.66, 0),
  ]);
  scatterInstanced(scene, rng, flowerGeo, paint(0xffffff, { sway: true }), 2200, (r, p, s, c) => {
    randomSpot(r, p);
    if (!isWild(p.x, p.z, -1) || slopeAt(p.x, p.z) > 0.4) return false;
    if (fbm(p.x * 0.06 - 4, p.z * 0.06 + 9, 2) < 0.5) return false;
    s.setScalar(0.8 + r() * 0.6);
    c.setHex(pick(r, [PAL.pink, PAL.saffron, PAL.ivory, PAL.lilac, PAL.coral, PAL.blue]));
    return true;
  });

  scatterInstanced(scene, rng, new THREE.IcosahedronGeometry(1, 0), paint(0xffffff, { flat: true }), 160, (r, p, s, c) => {
    randomSpot(r, p);
    if (!isWild(p.x, p.z) || slopeAt(p.x, p.z) > 0.4) return false;
    s.set(0.8 + r() * 0.9, 0.6 + r() * 0.6, 0.8 + r() * 0.9);
    p.y += s.y * 0.5;
    c.setHex(pick(r, [PAL.grassDeep, PAL.teal, PAL.moss, 0x5f9c86]));
    return true;
  });

  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(1, 0), paint(0xffffff, { flat: true }), 90, (r, p, s, c) => {
    randomSpot(r, p, 118);
    if (!isWild(p.x, p.z)) return false;
    s.set(0.6 + r() * 1.4, 0.5 + r() * 1.8, 0.6 + r() * 1.4);
    p.y += s.y * 0.3;
    c.setHex(pick(r, [PAL.lilac, PAL.rose, PAL.peach, STONE]));
    return true;
  });

  for (let i = 0, n = 0; i < 400 && n < 70; i++) {
    const p = randomSpot(rng, new THREE.Vector3(), 105);
    if (!isWild(p.x, p.z, 1.5) || slopeAt(p.x, p.z) > 0.35) continue;
    scene.add(at(tree(rng), p.x, p.y - 0.1, p.z));
    n++;
  }
  for (let i = 0, n = 0; i < 300 && n < 10; i++) {
    const p = randomSpot(rng, new THREE.Vector3(), 140);
    if (toU(p.x, p.z) < footU(toV(p.x, p.z)) + 30 || !isWild(p.x, p.z) || slopeAt(p.x, p.z) > 0.3) continue;
    scene.add(at(mushroom(rng), p.x, p.y - 0.2, p.z));
    n++;
  }

  // Lanterns along the footpaths.
  for (const [ax, az, bx, bz] of PATHS.slice(0, 6)) {
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let d = 15, side = 1; d < len - 14; d += 9, side = -side) {
      const x = ax + ((bx - ax) * d) / len + nx * 2.4 * side;
      const z = az + ((bz - az) * d) / len + nz * 2.4 * side;
      lantern(scene, x, groundAt(x, z), z);
    }
  }
}


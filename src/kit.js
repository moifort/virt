// Small building blocks shared by every asset.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pick } from './noise.js';
import { PAL, paint, solid } from './style.js';


export const box = (w, h, d, color, opts) => solid(new THREE.BoxGeometry(w, h, d), paint(color, opts));
export const cyl = (rt, rb, h, color, seg = 12, opts) => solid(new THREE.CylinderGeometry(rt, rb, h, seg), paint(color, opts));
export const ball = (r, color, opts, ws = 14, hs = 10) => solid(new THREE.SphereGeometry(r, ws, hs), paint(color, opts));
export const cone = (r, h, color, seg = 10, opts) => solid(new THREE.ConeGeometry(r, h, seg), paint(color, opts));
export const ring = (r, tube, color, arc = Math.PI * 2, seg = 16, opts) =>
  solid(new THREE.TorusGeometry(r, tube, 5, seg, arc), paint(color, opts));
export function at(obj, x, y, z, parent) {
  obj.position.set(x, y, z);
  parent?.add(obj);
  return obj;
}

/** Marks an object as animated so `bake` leaves it alone. */
export const live = (obj) => {
  obj.userData.dynamic = true;
  return obj;
};

/**
 * Merges every static mesh under `root` into one mesh per material: rich detail, few draw calls.
 * Animated subtrees (see `live`), instanced and textured meshes are kept as they are.
 */
export function bake(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const local = new THREE.Matrix4();
  const visit = (obj) => {
    if (obj.userData.dynamic) return;
    for (const child of [...obj.children]) visit(child);
    if (!obj.isMesh || obj.isInstancedMesh || obj.material.map || obj === root) return;
    const geo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    geo.applyMatrix4(local.multiplyMatrices(inverse, obj.matrixWorld));
    if (!buckets.has(obj.material)) buckets.set(obj.material, []);
    buckets.get(obj.material).push(geo);
    for (const child of [...obj.children]) obj.parent.attach(child);
    obj.removeFromParent();
  };
  visit(root);
  for (const [material, geos] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}

/**
 * Marks a source of light at a point of `parent`: after dark a warm pool spreads `reach` metres
 * around it on the ground and on whatever stands there (see `lampMap` in world.js).
 */
export function lamplight(parent, x, y, z, reach = 6.5) {
  const mark = at(new THREE.Object3D(), x, y, z, parent);
  mark.userData.lamp = reach;
  return mark;
}

export const INK = 0x2b2533;
export const STONE = 0xe8d9c0;
export const DARK_WOOD = 0x8a5a41;
export const WARM_LIGHT = 0xffe2a6;
export const SCREEN = 0x7fe3dc;

/** Floating holographic panel with a few UI bars, Bob-style. */
export function screen(w, h, parent, x, y, z, rotY, animated, rng) {
  const g = new THREE.Group();
  at(box(w, h, 0.06, SCREEN, { glow: true }), 0, 0, 0, g);
  const bars = Math.max(2, Math.round(h / 0.32));
  for (let i = 0; i < bars; i++) {
    const bw = w * (0.35 + rng() * 0.5);
    at(box(bw, 0.08, 0.04, i === 0 ? PAL.ivory : 0x3f8f99), -w / 2 + 0.15 + bw / 2, h / 2 - 0.25 - i * 0.28, 0.04, g);
  }
  g.rotation.y = rotY;
  at(live(g), x, y, z, parent);
  const phase = rng() * 6;
  animated.push((t) => (g.position.y = y + Math.sin(t * 1.4 + phase) * 0.06));
  return g;
}

export function plant(parent, x, y, z, rng) {
  at(cyl(0.35, 0.28, 0.6, PAL.coral, 10), x, y + 0.3, z, parent);
  const leaves = ball(0.55 + rng() * 0.2, pick(rng, [PAL.grassDeep, PAL.teal, PAL.moss]), { flat: true }, 7, 5);
  leaves.scale.y = 1.3;
  at(leaves, x, y + 1.1, z, parent);
}

/** Old Italian street lamp: fluted cast-iron post, scrolled bracket, four-sided glass lantern. */
export function lantern(parent, x, y, z, color = WARM_LIGHT) {
  const g = at(new THREE.Group(), x, y, z, parent);
  at(cyl(0.16, 0.24, 0.5, INK, 6), 0, 0.25, 0, g);
  at(cyl(0.06, 0.09, 2.7, INK, 6), 0, 1.6, 0, g);
  at(cyl(0.11, 0.11, 0.1, INK, 6), 0, 0.9, 0, g);
  at(box(0.6, 0.06, 0.06, INK), 0.3, 2.9, 0, g);
  const scroll = at(solid(new THREE.TorusGeometry(0.2, 0.035, 4, 8, Math.PI), paint(INK)), 0.3, 2.68, 0, g);
  scroll.rotation.z = Math.PI;
  at(cyl(0.2, 0.13, 0.42, color, 4, { glow: true }), 0.6, 2.55, 0, g).rotation.y = Math.PI / 4;
  at(cone(0.28, 0.2, INK, 4), 0.6, 2.86, 0, g).rotation.y = Math.PI / 4;
  at(cyl(0.14, 0.14, 0.05, INK, 4), 0.6, 2.32, 0, g).rotation.y = Math.PI / 4;
  lamplight(g, 0.6, 2.5, 0);
}


/** Incal-style aerotaxi: bulbous hull, glass canopy, side pods with glowing thrusters. */
export function aerocar(color = PAL.saffron) {
  const g = new THREE.Group();
  const hull = at(ball(1, color, {}, 14, 10), 0, 0, 0, g);
  hull.scale.set(1.05, 0.62, 2.1);
  at(ball(0.8, 0x9fe3e8, { glow: true }, 12, 8), 0, 0.42, 0.5, g).scale.set(0.9, 0.62, 1.1);
  at(ring(0.82, 0.06, INK, Math.PI * 2, 16), 0, 0.35, 0.5, g).rotation.x = Math.PI / 2;
  at(cone(0.35, 0.9, PAL.ivory, 10), 0, -0.05, 2.25, g).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const pod = at(cyl(0.32, 0.38, 1.9, PAL.ivory, 10), s * 1.15, -0.15, -0.4, g);
    pod.rotation.x = Math.PI / 2;
    at(cyl(0.26, 0.26, 0.1, PAL.coral, 10, { glow: true }), s * 1.15, -0.15, -1.38, g).rotation.x = Math.PI / 2;
    const fin = at(box(0.08, 0.7, 0.7, color), s * 1.15, 0.35, -0.9, g);
    fin.rotation.x = -0.4;
  }
  at(box(0.06, 0.9, 0.06, INK), 0.4, 0.95, -0.9, g);
  at(ball(0.07, PAL.red, { glow: true }, 4, 3), 0.4, 1.42, -0.9, g);
  at(cyl(0.7, 0.7, 0.05, SCREEN, 16, { glow: true }), 0, -0.6, 0, g);
  return g;
}

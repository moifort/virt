// Small building blocks shared by every asset.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pick } from './noise.js';
import { PAL, paint, solid } from './style.js';


export const box = (w, h, d, color, opts) => solid(new THREE.BoxGeometry(w, h, d), paint(color, opts));
export const cyl = (rt, rb, h, color, seg = 12, opts) => solid(new THREE.CylinderGeometry(rt, rb, h, seg), paint(color, opts));
export const ball = (r, color, opts, ws = 14, hs = 10) => solid(new THREE.SphereGeometry(r, ws, hs), paint(color, opts));
export const cone = (r, h, color, seg = 10, opts) => solid(new THREE.ConeGeometry(r, h, seg), paint(color, opts));
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

export function lantern(parent, x, y, z, color = WARM_LIGHT) {
  at(cyl(0.07, 0.09, 2.2, INK, 6), x, y + 1.1, z, parent);
  at(box(0.42, 0.5, 0.42, color, { glow: true }), x, y + 2.35, z, parent);
  at(cone(0.36, 0.3, INK, 4), x, y + 2.75, z, parent).rotation.y = Math.PI / 4;
}


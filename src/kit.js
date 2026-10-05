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

/** Mœbius street lamp: ringed post, curled crook, hanging glass orb. */
export function lantern(parent, x, y, z, color = WARM_LIGHT) {
  const g = at(new THREE.Group(), x, y, z, parent);
  at(cyl(0.2, 0.26, 0.3, INK, 6), 0, 0.15, 0, g);
  at(cyl(0.06, 0.09, 2.8, INK, 6), 0, 1.6, 0, g);
  for (const h of [0.7, 1.9]) at(cyl(0.12, 0.12, 0.08, PAL.saffron, 6), 0, h, 0, g);
  const crook = at(solid(new THREE.TorusGeometry(0.32, 0.05, 4, 10, Math.PI * 1.2), paint(INK)), 0.32, 3.0, 0, g);
  crook.rotation.z = -0.1;
  at(cyl(0.015, 0.015, 0.3, INK, 3), 0.64, 2.85, 0, g);
  at(cone(0.22, 0.18, INK, 6), 0.64, 2.66, 0, g);
  at(ball(0.2, color, { glow: true }, 8, 6), 0.64, 2.45, 0, g);
  at(ball(0.05, INK, {}, 4, 3), 0.64, 2.22, 0, g);
}


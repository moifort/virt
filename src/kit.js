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
 * Merges every static mesh under `root` into one mesh per kind of paint: rich detail, few draw
 * calls. Meshes painted alike but for their colour share a mesh, each keeping its colour in its
 * vertices. Animated subtrees (see `live`), instanced and textured meshes are kept as they are.
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
    const keep = ['position', 'normal', ...(obj.material.vertexColors ? ['color'] : [])];
    for (const name of Object.keys(geo.attributes)) if (!keep.includes(name)) geo.deleteAttribute(name);
    geo.applyMatrix4(local.multiplyMatrices(inverse, obj.matrixWorld));
    // A painted material gives way to its white, vertex-coloured twin.
    const painted = obj.material.userData.paint;
    let material = obj.material;
    if (painted && !painted.map && !obj.material.vertexColors) {
      material = paint(0xffffff, { ...painted.flags, vertexColors: true });
      const { r, g, b } = obj.material.color;
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3).map((_, i) => [r, g, b][i % 3]), 3));
    }
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material).push(geo);
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

/**
 * Marks a place to sit at a point of `parent`, at the height of the seat. Whoever sits there
 * faces the mark's own +z, turned by `yaw`.
 */
export function seat(parent, x, y, z, yaw = 0) {
  const mark = at(new THREE.Object3D(), x, y, z, parent);
  mark.rotation.y = yaw;
  mark.userData.seat = true;
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

/**
 * Old Italian street lamp: fluted cast-iron post, scrolled bracket, four-sided glass lantern.
 * `toward` is a point of `parent` ([x, z]) the bracket reaches out to, so that the lantern
 * hangs over the way it lights rather than over the verge.
 */
export function lantern(parent, x, y, z, { color = WARM_LIGHT, toward = null } = {}) {
  const g = at(new THREE.Group(), x, y, z, parent);
  if (toward) g.rotation.y = Math.atan2(-(toward[1] - z), toward[0] - x);
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


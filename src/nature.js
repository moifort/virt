// Flora and minerals in the spirit of Mœbius: bulb trees, umbrella pines, croziers, orb stalks,
// agaves, hoodoos, balanced rocks, crystal clusters and the bones of a giant.
// Each species is modelled in detail once, baked, then instanced across the bay.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, pick } from './noise.js';
import { PAL, WATER_LEVEL, paint, solid } from './style.js';
import { STONE, at, bake, ball, box, cone, cyl, lantern } from './kit.js';
import { PATHS, UP, coastU, footU, groundAt, isWild, randomSpot, scatterInstanced, slopeAt, toU, toV, toX, toZ } from './terrain.js';

const BONE = 0xefe4cf;
const PINE = 0x4f8f6a;
const CYPRESS = 0x3f7a66;

const torus = (r, tube, color, arc = Math.PI * 2, seg = 12, opts) =>
  solid(new THREE.TorusGeometry(r, tube, 5, seg, arc), paint(color, opts));

/** Where a point sits in the bay: up the mountain, along the shore, or on the plain. */
function region(x, z) {
  const u = toU(x, z);
  const v = toV(x, z);
  if (u > footU(v) + 1) return 'mountain';
  if (u < coastU(v) + 14) return 'shore';
  return 'plain';
}

// ---------------------------------------------------------------- Flora

/** Mœbius bulb tree: segmented pale trunk, puffy crown, seed pods hanging below. */
function bulbTree(rng) {
  const g = new THREE.Group();
  const H = 3.5 + rng() * 2.5;
  const bark = pick(rng, [PAL.ivory, 0xe8d6c0, PAL.peach]);
  const crownColor = pick(rng, [PAL.teal, PAL.pink, PAL.lilac, PAL.grass]);
  const podColor = pick(rng, [PAL.saffron, PAL.coral, PAL.ivory]);
  for (let i = 0; i < 3; i++) {
    const h = H / 3;
    const r = 0.34 - i * 0.07;
    at(cyl(r - 0.05, r, h, bark, 7), 0, i * h + h / 2, 0, g);
    at(cyl(r + 0.06, r + 0.06, 0.14, PAL.wood, 7), 0, i * h + 0.07, 0, g);
  }
  for (const s of [-1, 1]) {
    const branch = at(cyl(0.06, 0.1, 1.3, bark, 5), s * 0.45, H * 0.7, 0, g);
    branch.rotation.z = -s * 0.8;
    at(ball(0.35, crownColor, { flat: true }, 6, 4), s * 0.95, H * 0.7 + 0.5, 0, g);
  }
  const crown = at(ball(1.55, crownColor, { flat: true }, 9, 6), 0, H + 0.5, 0, g);
  crown.scale.y = 0.62;
  at(ball(0.95, PAL.ivory, { flat: true }, 8, 5), 0.3, H + 1.25, 0.2, g).scale.y = 0.7;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rng();
    const x = Math.cos(a) * 1.05;
    const z = Math.sin(a) * 1.05;
    at(cyl(0.025, 0.025, 0.55, PAL.wood, 3), x, H - 0.05, z, g);
    at(ball(0.2, podColor, {}, 6, 5), x, H - 0.45, z, g).scale.y = 1.3;
  }
  return g;
}

/** Mediterranean umbrella pine: tall crooked trunk, flat layered canopy. */
function umbrellaPine(rng) {
  const g = new THREE.Group();
  const H = 5.5 + rng() * 3;
  const lean = (rng() - 0.5) * 0.4;
  const low = at(cyl(0.22, 0.34, H * 0.6, PAL.wood, 6), Math.sin(lean) * H * 0.3, H * 0.3, 0, g);
  low.rotation.z = -lean;
  const topX = Math.sin(lean) * H * 0.6;
  const high = at(cyl(0.15, 0.22, H * 0.45, PAL.wood, 6), topX - Math.sin(lean) * H * 0.2, H * 0.6 + H * 0.2, 0, g);
  high.rotation.z = lean * 0.8;
  const cx = topX - Math.sin(lean) * H * 0.4;
  [[2.4, 0, PINE], [1.9, 0.38, 0x6fa87a], [1.4, 0.7, 0x86b886]].forEach(([r, dy, color], i) => {
    const disc = at(ball(r, color, { flat: true }, 10, 5), cx + (i - 1) * 0.3, H + dy, (i % 2) * 0.3, g);
    disc.scale.y = 0.3;
  });
  for (const s of [-1, 1]) {
    const arm = at(cyl(0.06, 0.1, 1.6, PAL.wood, 4), cx + s * 0.6, H - 0.5, 0, g);
    arm.rotation.z = -s * 1.0;
  }
  return g;
}

/** Cypress: a slim dark flame. */
function cypress(rng) {
  const g = new THREE.Group();
  const H = 5 + rng() * 3;
  at(cyl(0.12, 0.16, 0.8, PAL.wood, 5), 0, 0.4, 0, g);
  const body = at(ball(0.75, CYPRESS, { flat: true }, 7, 6), 0, H * 0.38, 0, g);
  body.scale.y = H / 3.2;
  at(cone(0.5, H * 0.45, CYPRESS, 7, { flat: true }), 0, H * 0.78, 0, g);
  at(ball(0.4, 0x5a9a7a, { flat: true }, 5, 4), 0.35, H * 0.5, 0.3, g).scale.y = 2;
  return g;
}

/** Lemon tree, Ligurian terraces style. */
function lemonTree(rng) {
  const g = new THREE.Group();
  at(cyl(0.12, 0.18, 1.4, PAL.wood, 5), 0, 0.7, 0, g);
  const crown = at(ball(1.15, 0x5f9c6a, { flat: true }, 8, 6), 0, 2, 0, g);
  crown.scale.y = 0.85;
  for (let k = 0; k < 9; k++) {
    const a = rng() * Math.PI * 2;
    const p = 0.6 + rng() * 1.6;
    at(ball(0.13, PAL.saffron, {}, 5, 4), Math.cos(a) * Math.sin(p) * 1.15, 2 + Math.cos(p) * 0.95, Math.sin(a) * Math.sin(p) * 1.15, g);
  }
  return g;
}

/** Agave rosette, sometimes with its tall flower spike. */
function agave(rng) {
  const g = new THREE.Group();
  const color = pick(rng, [0x7fa8a0, 0x8fb39a, 0x6f9fa8]);
  for (let k = 0; k < 10; k++) {
    const leaf = new THREE.Group();
    leaf.rotation.set(0, (k / 10) * Math.PI * 2 + rng() * 0.3, 0);
    const blade = solid(new THREE.ConeGeometry(0.16, 1.3 + rng() * 0.4, 4).translate(0, 0.7, 0), paint(color, { flat: true }));
    blade.rotation.z = 0.45 + (k % 3) * 0.25;
    leaf.add(blade);
    g.add(leaf);
  }
  if (rng() < 0.45) {
    at(cyl(0.05, 0.09, 3.6, 0x9a8a5a, 5), 0, 1.8, 0, g);
    for (let k = 0; k < 4; k++) {
      const y = 2.4 + k * 0.4;
      at(ball(0.16, PAL.saffron, { flat: true }, 5, 4), Math.cos(k * 2) * 0.3, y, Math.sin(k * 2) * 0.3, g);
    }
  }
  return g;
}

/** Prickly pear: stacked pads with pink fruits. */
function pricklyPear(rng) {
  const g = new THREE.Group();
  const pad = (x, y, z, tilt, size = 1) => {
    const p = at(ball(0.45 * size, 0x6fa88a, { flat: true }, 7, 5), x, y, z, g);
    p.scale.set(1, 1.25, 0.32);
    p.rotation.set(0, rng() * 3, tilt);
    if (rng() < 0.6) at(ball(0.09, PAL.pink, {}, 4, 3), x + 0.2, y + 0.55 * size, z, g);
  };
  pad(0, 0.5, 0, 0);
  pad(-0.35, 1.3, 0.05, 0.45, 0.85);
  pad(0.35, 1.25, -0.05, -0.4, 0.85);
  pad(0.1, 2.0, 0, 0.15, 0.7);
  return g;
}

/** Fern croziers: Mœbius spirals unfurling. */
function croziers(rng) {
  const g = new THREE.Group();
  const color = pick(rng, [0x6fb08f, PAL.grass, 0x7fae5a]);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rng();
    const h = 0.9 + rng() * 1.1;
    const stem = new THREE.Group();
    stem.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25);
    stem.rotation.set(Math.sin(a) * 0.25, a, -Math.cos(a) * 0.25);
    at(cyl(0.04, 0.06, h, color, 4), 0, h / 2, 0, stem);
    const curl = at(torus(0.22, 0.05, color, Math.PI * 1.6, 10), 0.22, h, 0, stem);
    curl.rotation.z = Math.PI;
    at(ball(0.07, color, {}, 4, 3), 0.22, h + 0.22, 0, stem);
    g.add(stem);
  }
  for (let k = 0; k < 5; k++) {
    const leaf = at(cone(0.12, 0.9, 0x5f9c6a, 3), 0, 0.3, 0, g);
    leaf.rotation.set(0.9, (k / 5) * Math.PI * 2, 0);
  }
  return g;
}

/** Orb stalks: thin stems topped with pastel spheres. */
function orbStalks(rng) {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 0.5;
    const h = 1.2 + rng() * 1.6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    at(cyl(0.035, 0.05, h, 0x8fae7a, 4), x, h / 2, z, g);
    at(ball(0.16 + rng() * 0.14, pick(rng, [PAL.lilac, PAL.pink, PAL.ivory, PAL.saffron, PAL.sky]), {}, 7, 5), x, h + 0.1, z, g);
    const ring = at(torus(0.09, 0.025, PAL.ivory, Math.PI * 2, 8), x, h * 0.6, z, g);
    ring.rotation.x = Math.PI / 2;
  }
  return g;
}

// ---------------------------------------------------------------- Minerals

/** Hoodoo: stacked strata topped by a darker cap stone. */
function hoodoo(rng) {
  const g = new THREE.Group();
  const layers = 3 + Math.floor(rng() * 3);
  let y = 0;
  for (let i = 0; i < layers; i++) {
    const h = 0.9 + rng() * 0.9;
    const r = 1.1 - i * 0.14 + (rng() - 0.5) * 0.25;
    at(cyl(r * 0.9, r, h, [PAL.rose, PAL.cream, PAL.ochre, PAL.peach][i % 4], 7, { flat: true }), 0, y + h / 2, 0, g).rotation.y = rng();
    y += h;
  }
  const cap = at(cyl(1.25, 0.9, 0.7, 0x9a7aa0, 7, { flat: true }), 0.15, y + 0.35, 0, g);
  cap.rotation.set(0.08, rng(), 0.05);
  return g;
}

function balancedRock(rng) {
  const g = new THREE.Group();
  at(cyl(0.35, 0.8, 2.4, PAL.peach, 6, { flat: true }), 0, 1.2, 0, g);
  const top = at(solid(new THREE.DodecahedronGeometry(1.5, 0), paint(pick(rng, [PAL.rose, PAL.lilac]), { flat: true })), 0.2, 3.3, 0, g);
  top.scale.set(1.2, 0.75, 1);
  top.rotation.set(0.2, rng() * 3, 0.15);
  return g;
}

/** Crystal cluster: hexagonal prisms with pointed tips, splayed outward. */
function crystals(rng) {
  const g = new THREE.Group();
  const color = pick(rng, [PAL.lilac, PAL.teal, PAL.pink, PAL.sky]);
  at(solid(new THREE.DodecahedronGeometry(0.8, 0), paint(0x9a8aa8, { flat: true })), 0, 0.2, 0, g).scale.y = 0.5;
  for (let k = 0; k < 7; k++) {
    const h = 0.8 + rng() * 2.2;
    const r = 0.16 + rng() * 0.18;
    const prism = new THREE.Group();
    const a = rng() * Math.PI * 2;
    const tilt = k === 0 ? 0 : 0.25 + rng() * 0.6;
    prism.rotation.set(Math.cos(a) * tilt, 0, Math.sin(a) * tilt);
    at(cyl(r, r, h, color, 6, { flat: true }), 0, h / 2, 0, prism);
    at(cone(r, r * 2.2, k % 3 ? color : PAL.ivory, 6, { flat: true }), 0, h + r * 1.1, 0, prism);
    g.add(prism);
  }
  return g;
}

/** Remains of a giant: spine, half-buried ribs and a skull. */
function giantBones() {
  const g = new THREE.Group();
  const ribs = 9;
  for (let i = 0; i < ribs; i++) {
    const x = i * 2.1;
    const R = 5.2 - Math.abs(i - 3) * 0.45;
    at(solid(new THREE.DodecahedronGeometry(0.75, 0), paint(BONE, { flat: true })), x, 0.4, 0, g);
    const rib = at(torus(R, 0.32, BONE, Math.PI * 0.82, 14), x, -1.2, 0, g);
    rib.rotation.set(0, Math.PI / 2, 0.28 * Math.PI);
  }
  const skull = at(ball(2.4, BONE, { flat: true }, 10, 8), -3.4, 1.2, 0, g);
  skull.scale.set(1.4, 0.9, 1);
  for (const z of [-0.9, 0.9]) at(ball(0.55, 0x3b3346, {}, 6, 5), -5.6, 1.6, z, g);
  const jaw = at(box(3, 0.6, 2.2, BONE), -5.2, -0.1, 0, g);
  jaw.rotation.z = 0.25;
  for (let k = 0; k < 5; k++) at(cone(0.16, 0.6, PAL.ivory, 4), -6.4 + k * 0.32, 0.35, (k % 2 ? -1 : 1) * 0.9, g).rotation.z = Math.PI;
  return g;
}

// ---------------------------------------------------------------- Kept from before

/** A standalone tree, used by the floating islands. */
export const tree = (rng) => bulbTree(rng);

export function mushroom(rng) {
  const g = new THREE.Group();
  const H = 5 + rng() * 6;
  const R = 2.5 + rng() * 2.5;
  at(cyl(0.3 + H * 0.03, 0.55 + H * 0.06, H, PAL.ivory, 8), 0, H / 2, 0, g);
  at(torus(0.45 + H * 0.04, 0.12, PAL.cream, Math.PI * 2, 12), 0, H * 0.7, 0, g).rotation.x = Math.PI / 2;
  const cap = at(solid(new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint(pick(rng, [PAL.rose, PAL.lilac, PAL.coral, PAL.teal]))), 0, H - 0.2, 0, g);
  cap.scale.y = 0.55;
  const gill = at(new THREE.Mesh(new THREE.CircleGeometry(R, 16), paint(PAL.plum)), 0, H - 0.2, 0, g);
  gill.rotation.x = Math.PI / 2;
  for (let k = 0; k < 7; k++) {
    const a = rng() * Math.PI * 2;
    const p = 0.3 + rng() * 0.9;
    at(ball(0.2 + rng() * 0.2, PAL.ivory, {}, 6, 4), Math.cos(a) * Math.sin(p) * R, H - 0.2 + Math.cos(p) * R * 0.55, Math.sin(a) * Math.sin(p) * R, g);
  }
  g.rotation.z = (rng() - 0.5) * 0.2;
  return g;
}

// ---------------------------------------------------------------- Beach

/** A few parasols and towels on the white sand. */
function buildBeach(scene, rng) {
  const g = new THREE.Group();
  for (let v = -14; v <= 48; v += 7 + rng() * 5) {
    const u = coastU(v) + 4 + rng() * 3;
    const x = toX(u, v);
    const z = toZ(u, v);
    const y = groundAt(x, z);
    if (y > WATER_LEVEL + 1.2 || y < WATER_LEVEL + 0.3) continue;
    const color = pick(rng, [PAL.coral, PAL.teal, PAL.saffron, PAL.pink, PAL.blue]);
    at(cyl(0.05, 0.05, 2.6, PAL.ivory, 4), x, y + 1.3, z, g).rotation.z = 0.12;
    at(cone(1.6, 0.6, color, 8), x + 0.15, y + 2.65, z, g);
    at(ball(0.12, PAL.ivory, {}, 4, 3), x + 0.15, y + 2.98, z, g);
    const towel = at(box(1.0, 0.04, 1.9, pick(rng, [PAL.ivory, PAL.saffron, PAL.coral, PAL.teal])), x + 1.3, y + 0.03, z + 0.4, g);
    towel.rotation.y = Math.PI / 4 + (rng() - 0.5) * 0.4;
    if (rng() < 0.4) at(ball(0.3, pick(rng, [PAL.red, PAL.saffron]), {}, 8, 6), x - 1.2, y + 0.3, z + 1.1, g);
  }
  scene.add(bake(g));
}

// ---------------------------------------------------------------- Planting

/** Bakes a species prototype into one geometry per material. */
function prototype(group) {
  const holder = new THREE.Group();
  holder.add(group);
  bake(holder);
  return holder.children.filter((c) => c.isMesh);
}

/** Instances a species across the bay: a few baked variants, many placements. */
function grow(scene, rng, build, { count, variants = 3, maxR = 112, margin = 0, maxSlope = 0.4, where = () => true, size = [0.8, 1.25], sink = 0.1 }) {
  const protos = Array.from({ length: variants }, () => prototype(build(rng)));
  const placements = protos.map(() => []);
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0, n = 0; i < count * 15 && n < count; i++) {
    randomSpot(rng, p, maxR);
    if (!isWild(p.x, p.z, margin) || slopeAt(p.x, p.z) > maxSlope || !where(p.x, p.z)) continue;
    q.setFromAxisAngle(UP, rng() * Math.PI * 2);
    s.setScalar(size[0] + rng() * (size[1] - size[0]));
    p.y -= sink;
    placements[Math.floor(rng() * variants)].push(new THREE.Matrix4().compose(p, q, s));
    n++;
  }
  protos.forEach((meshes, v) => {
    const list = placements[v];
    if (!list.length) return;
    for (const m of meshes) {
      const inst = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      list.forEach((matrix, i) => inst.setMatrixAt(i, matrix));
      inst.castShadow = inst.receiveShadow = true;
      scene.add(inst);
    }
  });
}

export function buildNature(scene, rng) {
  const on = (...regions) => (x, z) => regions.includes(region(x, z));
  buildBeach(scene, rng);

  // Ground cover: grass tufts swaying in the wind.
  const blades = [];
  for (let k = 0; k < 5; k++) {
    const b = new THREE.ConeGeometry(0.1, 0.8 + (k % 3) * 0.25, 3);
    b.translate(0, 0.45, 0);
    b.rotateZ((k - 2) * 0.22);
    b.rotateY((k / 5) * Math.PI);
    blades.push(b);
  }
  scatterInstanced(scene, rng, mergeGeometries(blades), paint(0xffffff, { sway: true }), 5000, (r, p, s, c) => {
    randomSpot(r, p, 125);
    if (!isWild(p.x, p.z, -1.5) || slopeAt(p.x, p.z) > 0.5) return false;
    if (p.y < WATER_LEVEL + 1.3) return false; // keep the beach clean
    const lush = fbm(p.x * 0.05 + 3, p.z * 0.05 - 8, 3);
    if (lush < 0.5 && r() < 0.85) return false;
    s.setScalar(0.7 + r() * 0.8);
    c.setHex(lush > 0.55 ? pick(r, [PAL.grass, PAL.grassDeep, PAL.moss]) : pick(r, [0xc9cf86, PAL.ochre, PAL.grass]));
    return true;
  });

  // Wildflowers: five petals around a heart.
  const petals = [new THREE.CylinderGeometry(0.025, 0.03, 0.6, 3).translate(0, 0.3, 0).toNonIndexed()];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    petals.push(new THREE.IcosahedronGeometry(0.09, 0).scale(1.4, 0.5, 1).translate(Math.cos(a) * 0.11, 0.64, Math.sin(a) * 0.11));
  }
  scatterInstanced(scene, rng, mergeGeometries(petals), paint(0xffffff, { sway: true }), 2600, (r, p, s, c) => {
    randomSpot(r, p, 125);
    if (!isWild(p.x, p.z, -1) || slopeAt(p.x, p.z) > 0.4) return false;
    if (p.y < WATER_LEVEL + 1.3) return false;
    if (fbm(p.x * 0.06 - 4, p.z * 0.06 + 9, 2) < 0.5) return false;
    s.setScalar(0.8 + r() * 0.7);
    c.setHex(pick(r, [PAL.pink, PAL.saffron, PAL.ivory, PAL.lilac, PAL.coral, PAL.blue]));
    return true;
  });

  // Pebbles: fine speckle on the sand.
  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(0.22, 0), paint(0xffffff, { flat: true }), 1400, (r, p, s, c) => {
    randomSpot(r, p, 125);
    if (!isWild(p.x, p.z, -2) || region(p.x, p.z) === 'mountain') return false;
    s.set(0.6 + r() * 1.2, 0.4 + r() * 0.6, 0.6 + r() * 1.2);
    c.setHex(pick(r, [STONE, PAL.lilac, PAL.peach, PAL.rose, 0xd8cdb8]));
    return true;
  });

  // Boulders.
  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(1, 0), paint(0xffffff, { flat: true }), 70, (r, p, s, c) => {
    randomSpot(r, p, 125);
    if (!isWild(p.x, p.z)) return false;
    s.set(0.6 + r() * 1.4, 0.5 + r() * 1.5, 0.6 + r() * 1.4);
    p.y += s.y * 0.3;
    c.setHex(pick(r, [PAL.lilac, PAL.rose, PAL.peach, STONE]));
    return true;
  });

  // Trees.
  grow(scene, rng, bulbTree, { count: 26, variants: 4, margin: 1.5, maxSlope: 0.35, where: on('plain') });
  grow(scene, rng, umbrellaPine, { count: 34, variants: 3, maxR: 135, margin: 1.5, maxSlope: 0.5, where: on('plain', 'mountain', 'shore') });
  grow(scene, rng, cypress, { count: 46, variants: 3, maxR: 135, margin: 1, maxSlope: 0.6, size: [0.8, 1.3] });
  grow(scene, rng, lemonTree, { count: 30, variants: 3, maxR: 135, maxSlope: 0.4, where: on('mountain') });

  // Shrubs and strange plants.
  grow(scene, rng, agave, { count: 70, variants: 3, maxR: 130, maxSlope: 0.7, where: on('shore', 'mountain'), size: [0.7, 1.2] });
  grow(scene, rng, pricklyPear, { count: 45, variants: 3, maxR: 130, maxSlope: 0.6, where: on('shore', 'plain') });
  grow(scene, rng, croziers, { count: 60, variants: 3, margin: -1, where: on('plain'), size: [0.8, 1.4] });
  grow(scene, rng, orbStalks, { count: 45, variants: 3, margin: -1, where: on('plain'), size: [0.8, 1.3] });

  // Minerals.
  grow(scene, rng, hoodoo, { count: 14, variants: 4, maxR: 125, margin: 2, maxSlope: 0.6, where: on('shore', 'plain'), size: [0.8, 1.4], sink: 0.3 });
  grow(scene, rng, balancedRock, { count: 8, variants: 2, maxR: 125, margin: 2, where: on('shore', 'plain'), size: [0.8, 1.2], sink: 0.3 });
  grow(scene, rng, crystals, { count: 30, variants: 4, maxR: 140, maxSlope: 1.4, where: on('mountain', 'shore'), size: [0.7, 1.4], sink: 0.2 });

  // Giant mushrooms up on the mountain.
  for (let i = 0, n = 0; i < 300 && n < 8; i++) {
    const p = randomSpot(rng, new THREE.Vector3(), 140);
    if (toU(p.x, p.z) < footU(toV(p.x, p.z)) + 30 || !isWild(p.x, p.z) || slopeAt(p.x, p.z) > 0.3) continue;
    scene.add(bake(at(mushroom(rng), p.x, p.y - 0.2, p.z)));
    n++;
  }

  // The bones of a giant, half buried on the right-hand headland.
  for (let i = 0; i < 400; i++) {
    const u = -34 + rng() * 30;
    const v = 62 + rng() * 18;
    const x = toX(u, v);
    const z = toZ(u, v);
    if (!isWild(x, z, 6) || slopeAt(x, z) > 0.3 || groundAt(x, z) < WATER_LEVEL + 1) continue;
    const bones = at(giantBones(), x, groundAt(x, z), z);
    bones.rotation.y = rng() * Math.PI;
    scene.add(bake(bones));
    break;
  }

  // Lanterns along the footpaths, baked together.
  const lamps = new THREE.Group();
  for (const [ax, az, bx, bz] of PATHS.slice(0, 6)) {
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let d = 15, side = 1; d < len - 14; d += 9, side = -side) {
      const x = ax + ((bx - ax) * d) / len + nx * 2.4 * side;
      const z = az + ((bz - az) * d) / len + nz * 2.4 * side;
      lantern(lamps, x, groundAt(x, z), z);
    }
  }
  scene.add(bake(lamps));
}

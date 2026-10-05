// Mediterranean flora and rock, as on the Ligurian coast: stone pines, cypresses, olive and
// lemon trees, holm oaks, maquis shrubs, broom, agaves and prickly pears among limestone boulders.
// Each species is modelled in detail once, baked, then instanced across the bay.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, pick } from './noise.js';
import { PAL, WATER_LEVEL, paint, solid } from './style.js';
import { at, bake, ball, box, cone, cyl, lantern } from './kit.js';
import { PATHS, UP, coastU, footU, groundAt, isWild, randomSpot, scatterInstanced, slopeAt, toU, toV, toX, toZ } from './terrain.js';

const BARK = 0x7d5a48;
const OLIVE_BARK = 0x76695a;
const PINE = [0x3f6a42, 0x4f7c4a, 0x5f8a52];
const CYPRESS = 0x2f5840;
const OLIVE = [0x8a9f78, 0x7a906c, 0x9fb08a];
const OAK = [0x3f6540, 0x4c7448, 0x5a8050];
const ROCK = [0xcfc3b0, 0xb9ad9c, 0xa99d8e, 0xd8cdb8];

/** Where a point sits in the bay: up the mountain, along the shore, or on the plain. */
function region(x, z) {
  const u = toU(x, z);
  const v = toV(x, z);
  if (u > footU(v) + 1) return 'mountain';
  if (u < coastU(v) + 14) return 'shore';
  return 'plain';
}

// ---------------------------------------------------------------- Flora

/** A lumpy mass of foliage: a few flattened faceted balls around a centre. */
function foliage(g, rng, x, y, z, r, colors, lumps = 4, squash = 0.7) {
  at(ball(r, colors[0], { flat: true }, 7, 5), x, y, z, g).scale.y = squash;
  for (let k = 0; k < lumps; k++) {
    const a = (k / lumps) * Math.PI * 2 + rng();
    const d = r * (0.45 + rng() * 0.3);
    const lump = at(ball(r * (0.5 + rng() * 0.25), colors[1 + (k % (colors.length - 1))], { flat: true }, 6, 4), x + Math.cos(a) * d, y + (rng() - 0.3) * r * 0.5, z + Math.sin(a) * d, g);
    lump.scale.y = squash;
  }
}

/** Stone pine (pino domestico): tall bare leaning trunk, forked boughs, flat umbrella canopy. */
function stonePine(rng) {
  const g = new THREE.Group();
  const H = 6 + rng() * 3.5;
  const lean = (rng() - 0.5) * 0.35;
  const low = at(cyl(0.2, 0.32, H * 0.62, BARK, 6), Math.sin(lean) * H * 0.31, H * 0.31, 0, g);
  low.rotation.z = -lean;
  const tx = Math.sin(lean) * H * 0.62;
  // Boughs fanning out under the canopy.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rng();
    const bough = new THREE.Group();
    bough.position.set(tx, H * 0.6, 0);
    bough.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    at(cyl(0.07, 0.14, H * 0.42, BARK, 4), 0, H * 0.21, 0, bough);
    g.add(bough);
  }
  const R = 2.3 + rng() * 0.8;
  [[R, 0, PINE[0]], [R * 0.78, 0.36, PINE[1]], [R * 0.5, 0.66, PINE[2]]].forEach(([r, dy, color], i) => {
    const disc = at(ball(r, color, { flat: true }, 10, 5), tx + (i - 1) * 0.25, H + dy, (i % 2) * 0.3, g);
    disc.scale.y = 0.28;
  });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rng();
    at(ball(R * 0.42, PINE[k % 2], { flat: true }, 6, 4), tx + Math.cos(a) * R * 0.72, H - 0.05, Math.sin(a) * R * 0.72, g).scale.y = 0.4;
  }
  return g;
}

/** Italian cypress: a slim dark spindle. */
function cypress(rng) {
  const g = new THREE.Group();
  const H = 5.5 + rng() * 3.5;
  at(cyl(0.1, 0.15, 0.7, BARK, 5), 0, 0.35, 0, g);
  const body = at(ball(0.62, CYPRESS, { flat: true }, 7, 6), 0, H * 0.4, 0, g);
  body.scale.y = H / 2.9;
  at(cone(0.42, H * 0.42, CYPRESS, 7, { flat: true }), 0, H * 0.8, 0, g);
  at(ball(0.34, 0x3d6a4a, { flat: true }, 5, 4), 0.3, H * 0.45, 0.25, g).scale.y = 2.2;
  return g;
}

/** Old olive tree: short gnarled forked trunk, airy silver-green crown. */
function oliveTree(rng) {
  const g = new THREE.Group();
  const H = 1.5 + rng() * 0.7;
  const trunk = at(cyl(0.2, 0.36, H, OLIVE_BARK, 6, { flat: true }), 0, H / 2, 0, g);
  trunk.rotation.z = (rng() - 0.5) * 0.3;
  at(ball(0.34, OLIVE_BARK, { flat: true }, 5, 4), 0.05, 0.25, 0.05, g);
  for (const s of [-1, 1]) {
    const limb = at(cyl(0.1, 0.18, 1.5, OLIVE_BARK, 5, { flat: true }), s * 0.42, H + 0.5, s * 0.1, g);
    limb.rotation.z = -s * (0.55 + rng() * 0.3);
    foliage(g, rng, s * 0.95, H + 1.25 + rng() * 0.3, s * 0.2, 1.0 + rng() * 0.25, OLIVE, 4, 0.72);
  }
  foliage(g, rng, 0, H + 1.6, -0.2, 1.05, OLIVE, 3, 0.7);
  return g;
}

/** Lemon tree of the Ligurian terraces. */
function lemonTree(rng) {
  const g = new THREE.Group();
  at(cyl(0.11, 0.16, 1.3, BARK, 5), 0, 0.65, 0, g);
  const crown = at(ball(1.1, 0x3f7645, { flat: true }, 8, 6), 0, 1.95, 0, g);
  crown.scale.y = 0.85;
  at(ball(0.7, 0x4f8650, { flat: true }, 6, 4), 0.45, 2.35, 0.3, g);
  for (let k = 0; k < 9; k++) {
    const a = rng() * Math.PI * 2;
    const p = 0.6 + rng() * 1.6;
    at(ball(0.12, 0xf2d24a, {}, 5, 4), Math.cos(a) * Math.sin(p) * 1.1, 1.95 + Math.cos(p) * 0.9, Math.sin(a) * Math.sin(p) * 1.1, g);
  }
  return g;
}

/** Holm oak: stout trunk under a dense, dark, rounded crown. */
function holmOak(rng) {
  const g = new THREE.Group();
  const H = 2.2 + rng() * 1.2;
  at(cyl(0.24, 0.38, H, BARK, 6), 0, H / 2, 0, g).rotation.z = (rng() - 0.5) * 0.15;
  for (const s of [-1, 1]) at(cyl(0.1, 0.18, 1.6, BARK, 5), s * 0.5, H + 0.4, 0, g).rotation.z = -s * 0.7;
  foliage(g, rng, 0, H + 1.7, 0, 2.1 + rng() * 0.5, OAK, 5, 0.78);
  return g;
}

/** Maquis: lentisk and myrtle growing as low dense cushions. */
function maquis(rng) {
  const g = new THREE.Group();
  const colors = pick(rng, [[0x4a6c44, 0x587a4c, 0x3f6040], [0x62804e, 0x70905a, 0x56744a], [0x6f8a66, 0x7d9870, 0x61805c]]);
  foliage(g, rng, 0, 0.45, 0, 0.8 + rng() * 0.4, colors, 4, 0.7);
  return g;
}

/** Broom in flower: green switches dusted with yellow. */
function broom(rng) {
  const g = new THREE.Group();
  at(ball(0.7, 0x6f8a4a, { flat: true }, 6, 4), 0, 0.5, 0, g).scale.y = 0.85;
  for (let k = 0; k < 7; k++) {
    const a = rng() * Math.PI * 2;
    const p = rng() * 1.2;
    at(ball(0.22 + rng() * 0.1, 0xf0c93a, { flat: true }, 5, 3), Math.cos(a) * Math.sin(p) * 0.65, 0.55 + Math.cos(p) * 0.6, Math.sin(a) * Math.sin(p) * 0.65, g);
  }
  return g;
}

/** Agave rosette, sometimes with its tall flower spike. */
function agave(rng) {
  const g = new THREE.Group();
  const color = pick(rng, [0x7a9c90, 0x86a68c, 0x6c9498]);
  for (let k = 0; k < 10; k++) {
    const leaf = new THREE.Group();
    leaf.rotation.set(0, (k / 10) * Math.PI * 2 + rng() * 0.3, 0);
    const blade = solid(new THREE.ConeGeometry(0.16, 1.3 + rng() * 0.4, 4).translate(0, 0.7, 0), paint(color, { flat: true }));
    blade.rotation.z = 0.45 + (k % 3) * 0.25;
    leaf.add(blade);
    g.add(leaf);
  }
  if (rng() < 0.35) {
    at(cyl(0.05, 0.09, 3.6, 0x9a8a5a, 5), 0, 1.8, 0, g);
    for (let k = 0; k < 4; k++) {
      const y = 2.4 + k * 0.4;
      at(ball(0.16, 0xd8c860, { flat: true }, 5, 4), Math.cos(k * 2) * 0.3, y, Math.sin(k * 2) * 0.3, g);
    }
  }
  return g;
}

/** Prickly pear: stacked pads with red fruits. */
function pricklyPear(rng) {
  const g = new THREE.Group();
  const pad = (x, y, z, tilt, size = 1) => {
    const p = at(ball(0.45 * size, 0x6a9a70, { flat: true }, 7, 5), x, y, z, g);
    p.scale.set(1, 1.25, 0.32);
    p.rotation.set(0, rng() * 3, tilt);
    if (rng() < 0.6) at(ball(0.09, 0xc9443c, {}, 4, 3), x + 0.2, y + 0.55 * size, z, g);
  };
  pad(0, 0.5, 0, 0);
  pad(-0.35, 1.3, 0.05, 0.45, 0.85);
  pad(0.35, 1.25, -0.05, -0.4, 0.85);
  pad(0.1, 2.0, 0, 0.15, 0.7);
  return g;
}

// ---------------------------------------------------------------- Rock

/** A limestone outcrop: a few angular blocks leaning on each other. */
function outcrop(rng) {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const r = 0.7 + rng() * 0.9;
    const rock = at(solid(new THREE.DodecahedronGeometry(r, 0), paint(pick(rng, ROCK), { flat: true })), (rng() - 0.5) * 1.8, r * 0.35, (rng() - 0.5) * 1.8, g);
    rock.scale.set(1 + rng() * 0.5, 0.6 + rng() * 0.5, 1 + rng() * 0.3);
    rock.rotation.set(rng() * 0.4, rng() * 3, rng() * 0.4);
  }
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
    // Summer: green where it stays damp, straw-coloured everywhere else.
    c.setHex(lush > 0.55 ? pick(r, [PAL.grass, PAL.grassDeep, PAL.moss]) : pick(r, [0xc9c07a, 0xd8c880, PAL.grass]));
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
    // Poppies, broom, daisies and wild lavender.
    c.setHex(pick(r, [PAL.red, PAL.red, PAL.saffron, PAL.ivory, 0x9a86c8]));
    return true;
  });

  // Pebbles: fine speckle on the sand.
  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(0.22, 0), paint(0xffffff, { flat: true }), 1400, (r, p, s, c) => {
    randomSpot(r, p, 125);
    if (!isWild(p.x, p.z, -2) || region(p.x, p.z) === 'mountain') return false;
    s.set(0.6 + r() * 1.2, 0.4 + r() * 0.6, 0.6 + r() * 1.2);
    c.setHex(pick(r, ROCK));
    return true;
  });

  // Boulders.
  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(1, 0), paint(0xffffff, { flat: true }), 70, (r, p, s, c) => {
    randomSpot(r, p, 125);
    if (!isWild(p.x, p.z)) return false;
    s.set(0.6 + r() * 1.4, 0.5 + r() * 1.5, 0.6 + r() * 1.4);
    p.y += s.y * 0.3;
    c.setHex(pick(r, ROCK));
    return true;
  });

  // Trees.
  grow(scene, rng, stonePine, { count: 46, variants: 4, maxR: 135, margin: 1.5, maxSlope: 0.5 });
  grow(scene, rng, cypress, { count: 54, variants: 3, maxR: 135, margin: 1, maxSlope: 0.6, size: [0.8, 1.3] });
  grow(scene, rng, oliveTree, { count: 70, variants: 4, maxR: 135, margin: 1, maxSlope: 0.35, where: on('plain', 'mountain') });
  grow(scene, rng, holmOak, { count: 30, variants: 3, margin: 1.5, maxSlope: 0.4, where: on('plain', 'shore') });
  grow(scene, rng, lemonTree, { count: 34, variants: 3, maxR: 135, maxSlope: 0.4, where: on('mountain', 'plain') });

  // Shrubs: the maquis clings even to the steep slopes.
  grow(scene, rng, maquis, { count: 260, variants: 5, maxR: 140, margin: -1, maxSlope: 1.4, size: [0.7, 1.5] });
  grow(scene, rng, broom, { count: 70, variants: 3, maxR: 140, maxSlope: 1.0, where: on('mountain', 'shore'), size: [0.8, 1.3] });
  grow(scene, rng, agave, { count: 60, variants: 3, maxR: 130, maxSlope: 0.7, where: on('shore', 'mountain'), size: [0.7, 1.2] });
  grow(scene, rng, pricklyPear, { count: 45, variants: 3, maxR: 130, maxSlope: 0.6, where: on('shore', 'plain') });

  // Limestone outcrops.
  grow(scene, rng, outcrop, { count: 34, variants: 4, maxR: 135, margin: 1, maxSlope: 1.2, size: [0.7, 1.5], sink: 0.25 });

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

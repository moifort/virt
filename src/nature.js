// Mediterranean flora and rock, as on the Ligurian coast: stone pines, cypresses, olive and
// lemon trees, holm oaks, almond trees, palms on the front, maquis, broom, oleander and
// lavender, agaves and prickly pears among limestone boulders, and maples lining the walks from
// the agora. In autumn every broadleaf tree blazes red, an Indian summer, and lets its leaves
// fly; the pines, the cypresses and the palms stay green. Trees gather in groves and
// leave meadows open between them. Each species is modelled in detail once, baked, then
// instanced across the bay.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, mulberry32, pick } from './noise.js';
import { GLOBALS, PAL, WATER_LEVEL, paint, solid } from './style.js';
import { at, bake, ball, box, cone, cyl, lantern } from './kit.js';
import { PATHS, SPUR_END, UP, ZONES, anywhere, coastU, cultivated, footU, groundAt, isWild, occupy, railPoint, scatterInstanced, segmentDistance, slopeAt, toU, toV, toX, toZ, villagePlan } from './terrain.js';

const BARK = 0x7d5a48;
const DARK_BARK = 0x5e463c;
const OLIVE_BARK = 0x76695a;
// Foliage is always three tones, from the depths between the boughs to the sunlit tips.
const PINE = [0x2f7046, 0x48904c, 0x74b452];
const CYPRESS = [0x245a40, 0x327048, 0x44864e];
const OLIVE = [0x7a9c74, 0x93b482, 0xb2cc96];
const OAK = [0x2c6a44, 0x43884a, 0x6aa84e];
const LEMON = [0x357a44, 0x4f9a50, 0x7cb856];
const ORCHARD = [0x4a9250, 0x62aa56, 0x86c260];
const PALM = [0x357e48, 0x4f9a54, 0x78b85c];
const ROCK = [0xcfc3b0, 0xb9ad9c, 0xa99d8e, 0xd8cdb8];
const LEAF = { leaf: true };
// Broadleaf crowns, which turn red in autumn and stand bare in winter (see `uLeaves`).
const TURNING = { turning: true };
const MAPLE_BARK = 0x5e4e48;
const MAPLE_LEAF = [0x3f7a48, 0x58964e, 0x7cb45a];

/** Where a point sits in the bay: up the mountain, along the shore, or on the plain. */
function region(x, z) {
  const u = toU(x, z);
  const v = toV(x, z);
  if (u > footU(v) + 1) return 'mountain';
  if (u < coastU(v) + 14) return 'shore';
  return 'plain';
}

/** Woodland gathers in patches: above about a half the trees close into a grove. */
const wood = (x, z) => fbm(x * 0.035 + 12, z * 0.035 - 7, 2);
const worked = (x, z) => cultivated(toU(x, z), toV(x, z));

// ---------------------------------------------------------------- Flora

/**
 * A lumpy mass of foliage: flattened faceted balls around a centre, the high ones in the
 * lightest tone and the low ones in the darkest.
 */
function foliage(g, rng, x, y, z, r, colors, lumps = 4, squash = 0.7, kind = LEAF) {
  at(ball(r, colors[1], kind, 10, 7), x, y, z, g).scale.y = squash;
  for (let k = 0; k < lumps; k++) {
    const a = (k / lumps) * Math.PI * 2 + rng();
    const d = r * (0.45 + rng() * 0.35);
    const dy = (rng() - 0.35) * r * 0.6;
    const tone = dy > r * 0.12 ? colors[2] : dy < -r * 0.06 ? colors[0] : colors[1];
    at(ball(r * (0.45 + rng() * 0.3), tone, kind, 9, 6), x + Math.cos(a) * d, y + dy, z + Math.sin(a) * d, g).scale.y = squash;
  }
}

/** Stone pine (pino domestico): tall bare leaning trunk, forked boughs, flat umbrella canopy. */
function stonePine(rng) {
  const g = new THREE.Group();
  const H = 6 + rng() * 3.5;
  const lean = (rng() - 0.5) * 0.35;
  const low = at(cyl(0.2, 0.32, H * 0.62, BARK, 6), Math.sin(lean) * H * 0.31, H * 0.31, 0, g);
  low.rotation.z = -lean;
  at(cyl(0.34, 0.44, 0.5, DARK_BARK, 6, { flat: true }), 0, 0.2, 0, g);
  const tx = Math.sin(lean) * H * 0.62;
  // Boughs fanning out under the canopy.
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rng();
    const bough = new THREE.Group();
    bough.position.set(tx, H * 0.6, 0);
    bough.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    at(cyl(0.07, 0.14, H * 0.42, BARK, 4), 0, H * 0.21, 0, bough);
    g.add(bough);
  }
  // The umbrella: a dark underside, a wide middle, bright cushions of needles on top.
  const R = 2.3 + rng() * 0.8;
  at(ball(R, PINE[0], LEAF, 10, 5), tx, H - 0.08, 0, g).scale.y = 0.24;
  at(ball(R * 0.86, PINE[1], LEAF, 10, 5), tx + 0.1, H + 0.3, 0.15, g).scale.y = 0.3;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + rng();
    const d = R * (0.5 + rng() * 0.3);
    at(ball(R * (0.3 + rng() * 0.14), PINE[k % 3 === 0 ? 1 : 2], LEAF, 6, 4), tx + Math.cos(a) * d, H + 0.42 + rng() * 0.25, Math.sin(a) * d, g).scale.y = 0.42;
  }
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rng();
    at(ball(R * 0.4, PINE[k % 2], LEAF, 6, 4), tx + Math.cos(a) * R * 0.78, H - 0.05, Math.sin(a) * R * 0.78, g).scale.y = 0.4;
  }
  return g;
}

/** Italian cypress: a slim dark spindle, never quite regular. */
export function cypress(rng) {
  const g = new THREE.Group();
  const H = 5.5 + rng() * 3.5;
  at(cyl(0.1, 0.15, 0.7, BARK, 5), 0, 0.35, 0, g);
  const body = at(ball(0.62, CYPRESS[0], LEAF, 7, 6), 0, H * 0.4, 0, g);
  body.scale.y = H / 2.9;
  at(cone(0.42, H * 0.42, CYPRESS[1], 7, LEAF), 0, H * 0.8, 0, g);
  for (let k = 0; k < 3; k++) {
    const a = rng() * Math.PI * 2;
    at(ball(0.3 + rng() * 0.08, CYPRESS[1 + (k % 2)], LEAF, 5, 4), Math.cos(a) * 0.32, H * (0.25 + k * 0.2), Math.sin(a) * 0.32, g).scale.y = 2.0 + rng();
  }
  return g;
}

/** Old olive tree: short gnarled forked trunk, airy silver-green crown. */
export function oliveTree(rng) {
  const g = new THREE.Group();
  const H = 1.5 + rng() * 0.7;
  const trunk = at(cyl(0.2, 0.36, H, OLIVE_BARK, 6, { flat: true }), 0, H / 2, 0, g);
  trunk.rotation.z = (rng() - 0.5) * 0.3;
  at(ball(0.34, OLIVE_BARK, { flat: true }, 5, 4), 0.05, 0.25, 0.05, g);
  at(ball(0.24, OLIVE_BARK, { flat: true }, 5, 4), -0.12, H * 0.6, 0.1, g);
  for (const s of [-1, 1]) {
    const limb = at(cyl(0.1, 0.18, 1.5, OLIVE_BARK, 5, { flat: true }), s * 0.42, H + 0.5, s * 0.1, g);
    limb.rotation.z = -s * (0.55 + rng() * 0.3);
    foliage(g, rng, s * 0.95, H + 1.25 + rng() * 0.3, s * 0.2, 1.0 + rng() * 0.25, OLIVE, 5, 0.72, TURNING);
  }
  foliage(g, rng, 0, H + 1.6, -0.2, 1.05, OLIVE, 4, 0.7, TURNING);
  return g;
}

/** Lemon tree of the Ligurian terraces. */
export function lemonTree(rng) {
  const g = new THREE.Group();
  at(cyl(0.11, 0.16, 1.3, BARK, 5), 0, 0.65, 0, g);
  // Three twigs, for the winter, when the crown is gone.
  for (let k = 0; k < 3; k++) at(cyl(0.03, 0.06, 1.0, BARK, 4), Math.cos(k * 2.1) * 0.3, 1.6, Math.sin(k * 2.1) * 0.3, g).rotation.set(Math.sin(k * 2.1) * 0.6, 0, -Math.cos(k * 2.1) * 0.6);
  foliage(g, rng, 0, 1.95, 0, 1.1, LEMON, 5, 0.85, TURNING);
  for (let k = 0; k < 9; k++) {
    const a = rng() * Math.PI * 2;
    const p = 0.6 + rng() * 1.6;
    at(ball(0.13, 0xf2d24a, {}, 5, 4), Math.cos(a) * Math.sin(p) * 1.2, 1.95 + Math.cos(p) * 0.95, Math.sin(a) * Math.sin(p) * 1.2, g);
  }
  return g;
}

/** Holm oak: stout trunk under a dense, dark, rounded crown heaped up in billows. */
function holmOak(rng) {
  const g = new THREE.Group();
  const H = 2.2 + rng() * 1.2;
  at(cyl(0.24, 0.38, H, BARK, 6), 0, H / 2, 0, g).rotation.z = (rng() - 0.5) * 0.15;
  at(cyl(0.4, 0.52, 0.4, DARK_BARK, 6, { flat: true }), 0, 0.15, 0, g);
  for (const s of [-1, 1]) at(cyl(0.1, 0.18, 1.6, BARK, 5), s * 0.5, H + 0.4, 0, g).rotation.z = -s * 0.7;
  const R = 2.0 + rng() * 0.5;
  foliage(g, rng, 0, H + 1.6, 0, R, OAK, 6, 0.78, TURNING);
  foliage(g, rng, (rng() - 0.5) * 0.8, H + 2.5, (rng() - 0.5) * 0.8, R * 0.62, [OAK[1], OAK[2], OAK[2]], 3, 0.75, TURNING);
  return g;
}

/** Almond tree of the old orchards: a low spreading crown on a few black boughs. */
function almondTree(rng) {
  const g = new THREE.Group();
  const H = 1.3 + rng() * 0.5;
  at(cyl(0.13, 0.22, H, DARK_BARK, 5, { flat: true }), 0, H / 2, 0, g).rotation.z = (rng() - 0.5) * 0.2;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rng();
    const reach = 0.9 + rng() * 0.4;
    const limb = new THREE.Group();
    limb.position.set(0, H - 0.1, 0);
    limb.rotation.set(Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75);
    at(cyl(0.05, 0.1, reach * 1.7, DARK_BARK, 4), 0, reach * 0.85, 0, limb);
    g.add(limb);
    foliage(g, rng, Math.cos(a) * reach, H + 0.9 + rng() * 0.3, Math.sin(a) * reach, 0.75 + rng() * 0.2, ORCHARD, 3, 0.8, TURNING);
  }
  foliage(g, rng, 0, H + 1.5, 0, 0.9, ORCHARD, 4, 0.8, TURNING);
  return g;
}

/**
 * Montpellier maple (acero minore), wild on the Ligurian hills: a short trunk that splits low
 * into a few long limbs reaching out and up, and over them a crown far wider than it is tall,
 * a heaped cloud with its edges drooping.
 */
function mapleTree(rng) {
  const g = new THREE.Group();
  const H = 1.3 + rng() * 0.4;
  at(cyl(0.2, 0.3, H, MAPLE_BARK, 6, { flat: true }), 0, H / 2, 0, g).rotation.z = (rng() - 0.5) * 0.15;
  at(cyl(0.34, 0.42, 0.35, MAPLE_BARK, 6, { flat: true }), 0, 0.12, 0, g);
  const limbs = 4 + Math.floor(rng() * 2);
  const tips = [];
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * Math.PI * 2 + rng() * 0.6;
    const tilt = 0.75 + rng() * 0.3;
    const reach = 2.0 + rng() * 0.7;
    const limb = new THREE.Group();
    limb.position.set(0, H - 0.15, 0);
    limb.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
    at(cyl(0.06, 0.13, reach, MAPLE_BARK, 5, { flat: true }), 0, reach / 2, 0, limb);
    // A twig forking off near the end, out over the edge of the crown.
    at(cyl(0.03, 0.06, reach * 0.55, MAPLE_BARK, 4), 0.2, reach * 0.95, 0, limb).rotation.z = -0.7;
    g.add(limb);
    tips.push([Math.cos(a) * Math.sin(tilt) * reach, H + Math.cos(tilt) * reach, Math.sin(a) * Math.sin(tilt) * reach]);
  }
  // The cloud of leaves: a broad heap over the middle, a puff over each limb's
  // end hanging a little lower, so the crown droops at its edges.
  foliage(g, rng, 0, H + 2.1, 0, 1.7, MAPLE_LEAF, 6, 0.6, TURNING);
  for (const [x, y, z] of tips) foliage(g, rng, x * 1.05, y + 0.15, z * 1.05, 1.05 + rng() * 0.3, MAPLE_LEAF, 3, 0.62, TURNING);
  for (let k = 0; k < 4; k++) {
    const a = rng() * Math.PI * 2;
    const d = 1.0 + rng() * 0.8;
    foliage(g, rng, Math.cos(a) * d, H + 2.5 + rng() * 0.4, Math.sin(a) * d, 0.9 + rng() * 0.25, MAPLE_LEAF, 2, 0.65, TURNING);
  }
  return g;
}

/**
 * Each broadleaf species' crown, in its own metres: how far out from the trunk the leaves
 * hang, how high its lowest and highest leaves are, and how many leaves fall from it and lie
 * under it at the height of the autumn.
 */
const CROWNS = {
  mapleTree: { reach: 3.2, low: 2.4, high: 3.8, falling: 140, lying: 360 },
  holmOak: { reach: 2.2, low: 3.2, high: 5.0, falling: 45, lying: 110 },
  oliveTree: { reach: 1.4, low: 2.4, high: 3.4, falling: 25, lying: 60 },
  almondTree: { reach: 1.4, low: 1.9, high: 2.9, falling: 25, lying: 60 },
  lemonTree: { reach: 1.1, low: 1.5, high: 2.6, falling: 15, lying: 40 },
};

/**
 * The fallen leaves of every broadleaf tree on the island, all in one instanced mesh: leaves
 * that let go of each crown and fall or fly off, and leaves that lie in a red ring on the
 * ground under it. What shows of each, and when, is the shader's (see `LEAFFALL` in style.js).
 */
function fallenLeaves(scene, rng) {
  // Every broadleaf tree once: a species is drawn as one mesh per paint, all at the same spots.
  const trees = new Map();
  const m = new THREE.Matrix4();
  const at3 = new THREE.Vector3();
  for (const obj of scene.children) {
    const crown = obj.isInstancedMesh && CROWNS[obj.userData.plant];
    if (!crown) continue;
    for (let i = 0; i < obj.count; i++) {
      obj.getMatrixAt(i, m);
      at3.setFromMatrixPosition(m);
      trees.set(`${at3.x.toFixed(2)},${at3.z.toFixed(2)}`, { x: at3.x, y: at3.y, z: at3.z, s: m.getMaxScaleOnAxis(), crown });
    }
  }
  let total = 0;
  for (const { crown } of trees.values()) total += crown.falling + crown.lying;
  const leaf = new THREE.PlaneGeometry(0.4, 0.32);
  const mesh = new THREE.InstancedMesh(leaf, paint(0xffffff, { leaffall: true, doubleSide: true }), total);
  const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const turn = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const data = new THREE.Color();
  let n = 0;
  for (const { x, y, z, s, crown } of trees.values()) {
    for (let k = 0; k < crown.falling; k++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * crown.reach * s;
      p.set(x + Math.cos(a) * d, y + (crown.low + rng() * (crown.high - crown.low)) * s, z + Math.sin(a) * d);
      const drop = Math.max(1, p.y - groundAt(p.x, p.z));
      mesh.setMatrixAt(n, m.compose(p, turn.identity(), one));
      // Raw numbers, not a colour: set in the working space so they reach the shader unchanged.
      mesh.setColorAt(n++, data.setRGB(drop / 20, rng(), 0));
    }
    for (let k = 0; k < crown.lying; k++) {
      // Thickest under the crown, thinning out beyond, a few blown further.
      const a = rng() * Math.PI * 2;
      const d = (0.3 + Math.sqrt(rng()) * crown.reach * 1.1 + (rng() < 0.2 ? rng() * 2.5 : 0)) * s;
      p.set(x + Math.cos(a) * d, 0, z + Math.sin(a) * d);
      p.y = groundAt(p.x, p.z) + 0.04;
      if (p.y < WATER_LEVEL + 0.1) continue;
      turn.setFromAxisAngle(UP, rng() * Math.PI).multiply(flat);
      mesh.setMatrixAt(n, m.compose(p, turn, one));
      mesh.setColorAt(n++, data.setRGB(0, rng(), 1));
    }
  }
  mesh.count = n;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
}

/** The trees grown before the maples, which these keep clear of. */
const TREES = new Set(['stonePine', 'holmOak', 'cypress', 'oliveTree', 'lemonTree', 'almondTree', 'palm']);

/**
 * Maples along the walks out of the agora: one every dozen metres or so on either side, set
 * back from the path wherever the ground is free and no other tree stands; and a few groves in
 * the meadows. They are planted last, from their own seed, so the rest of the island grows as
 * it always has.
 */
function plantMaples(scene, animated) {
  const rng = mulberry32(20261007);
  const standing = [];
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  for (const obj of scene.children) {
    if (!obj.isInstancedMesh || !TREES.has(obj.userData.plant)) continue;
    for (let i = 0; i < obj.count; i++) {
      obj.getMatrixAt(i, m);
      v.setFromMatrixPosition(m);
      standing.push([v.x, v.z]);
    }
  }
  const trees = [];
  const free = (x, z) => standing.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 3.4) && trees.every((t) => Math.hypot(x - t.x, z - t.z) > 8);
  for (const [ax, az, bx, bz] of PATHS.slice(0, 5)) {
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let d = 14 + rng() * 3; d < len - 12; d += 12 + rng() * 3) {
      for (const side of [-1, 1]) {
        const off = side * (5.4 + rng() * 0.8);
        const x = ax + ((bx - ax) * d) / len + nx * off;
        const z = az + ((bz - az) * d) / len + nz * off;
        const slope = slopeAt(x, z);
        if (!isWild(x, z) || slope > 0.45 || !free(x, z)) continue;
        trees.push({ x, z, y: groundAt(x, z), slope, s: 1.4 + rng() * 0.3, yaw: rng() * Math.PI * 2, variant: Math.floor(rng() * 3) });
      }
    }
  }
  // And a few groves out in the meadows of the plain.
  const p = new THREE.Vector3();
  for (let i = 0, grove = 0; i < 6000 && grove < 26; i++) {
    anywhere(rng, p);
    if (region(p.x, p.z) !== 'plain' || fbm(p.x * 0.03 + 50, p.z * 0.03 - 20, 2) < 0.56) continue;
    const slope = slopeAt(p.x, p.z);
    if (!isWild(p.x, p.z, 1) || slope > 0.4 || !free(p.x, p.z)) continue;
    trees.push({ x: p.x, z: p.z, y: p.y, slope, s: 1.3 + rng() * 0.4, yaw: rng() * Math.PI * 2, variant: Math.floor(rng() * 3) });
    grove++;
  }
  const placements = [[], [], []];
  const q = new THREE.Quaternion();
  for (const t of trees) {
    q.setFromAxisAngle(UP, t.yaw);
    placements[t.variant].push(new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.y - 0.1 - t.slope * 0.7, t.z), q, new THREE.Vector3(t.s, t.s, t.s)));
  }
  instance(scene, mapleTree, placements.map(() => prototype(mapleTree(rng))), placements);
  fallenLeaves(scene, rng);
  // A crown the shader has emptied for the winter must not go on shading the ground.
  const crowns = scene.children.filter((obj) => obj.isInstancedMesh && 'TURNING' in obj.material.defines);
  animated.push(() => {
    const full = GLOBALS.uLeaves.value.w > 0.4;
    for (const crown of crowns) crown.castShadow = full;
  });
}

/** Date palm of the Riviera sea fronts: a rough leaning stem and a fountain of arching fronds. */
function palm(rng) {
  const g = new THREE.Group();
  const H = 4 + rng() * 2.5;
  const lean = (rng() - 0.5) * 0.3;
  const rings = 7;
  for (let k = 0; k < rings; k++) {
    const t = k / rings;
    at(cyl(0.2 - t * 0.03, 0.26 - t * 0.03, H / rings + 0.06, k % 2 ? BARK : 0x8d6a55, 6, { flat: true }), Math.sin(lean) * H * t * t, (H * (k + 0.5)) / rings, 0, g);
  }
  const tx = Math.sin(lean) * H;
  at(ball(0.42, 0x8d6a55, { flat: true }, 6, 4), tx, H, 0, g);
  // Each frond rises from the crown, arches out and droops at its tip.
  for (let k = 0; k < 11; k++) {
    const frond = new THREE.Group();
    frond.position.set(tx, H + 0.1, 0);
    frond.rotation.y = (k / 11) * Math.PI * 2 + rng() * 0.3;
    const rise = 0.25 + (k % 3) * 0.3;
    const inner = solid(new THREE.ConeGeometry(0.34, 1.9, 4).translate(0, 0.95, 0), paint(PALM[k % 3], LEAF));
    inner.scale.z = 0.3;
    inner.rotation.z = -(Math.PI / 2 - rise);
    frond.add(inner);
    const outer = solid(new THREE.ConeGeometry(0.3, 1.7, 4).translate(0, 0.85, 0), paint(PALM[(k + 1) % 3], LEAF));
    outer.scale.z = 0.3;
    outer.position.set(Math.cos(rise) * 1.5, Math.sin(rise) * 1.5, 0);
    outer.rotation.z = -(Math.PI / 2 + 0.35 + rng() * 0.3);
    frond.add(outer);
    g.add(frond);
  }
  for (let k = 0; k < 3; k++) at(ball(0.16, 0xd98a3a, {}, 4, 3), tx + Math.cos(k * 2.1) * 0.4, H - 0.25, Math.sin(k * 2.1) * 0.4, g);
  return g;
}

/** Maquis: lentisk and myrtle growing as low dense cushions. */
function maquis(rng) {
  const g = new THREE.Group();
  const colors = pick(rng, [[0x47694a, 0x587c50, 0x6c9058], [0x587a52, 0x6b8e5a, 0x83a468], [0x65836a, 0x7a9876, 0x92ac86]]);
  foliage(g, rng, 0, 0.45, 0, 0.8 + rng() * 0.4, colors, 5, 0.7);
  return g;
}

/** Broom in flower: green switches dusted with yellow. */
function broom(rng) {
  const g = new THREE.Group();
  at(ball(0.7, 0x6f8e52, LEAF, 6, 4), 0, 0.5, 0, g).scale.y = 0.85;
  for (let k = 0; k < 8; k++) {
    const a = rng() * Math.PI * 2;
    const p = rng() * 1.2;
    at(ball(0.2 + rng() * 0.1, k % 3 ? 0xf0c93a : 0xf7de6a, { flat: true }, 5, 3), Math.cos(a) * Math.sin(p) * 0.65, 0.55 + Math.cos(p) * 0.6, Math.sin(a) * Math.sin(p) * 0.65, g);
  }
  return g;
}

/** Oleander: the tall flowering hedge of every Italian roadside, in pink, white or red. */
function oleander(rng) {
  const g = new THREE.Group();
  foliage(g, rng, 0, 0.9, 0, 1.0 + rng() * 0.3, [0x3f7050, 0x4f845a, 0x66986a], 4, 0.95);
  const flower = pick(rng, [[0xf08aa8, 0xf7b0c4], [0xf7efe6, 0xffffff], [0xe2586a, 0xf08a8a], [0xf08aa8, 0xf7efe6]]);
  for (let k = 0; k < 11; k++) {
    const a = rng() * Math.PI * 2;
    const p = rng() * 1.4;
    at(ball(0.17 + rng() * 0.08, flower[k % 2], { flat: true }, 5, 3), Math.cos(a) * Math.sin(p) * 1.05, 0.95 + Math.cos(p) * 0.95, Math.sin(a) * Math.sin(p) * 1.05, g);
  }
  return g;
}

/** Lavender: a grey-green cushion bristling with violet spikes. */
function lavender(rng) {
  const g = new THREE.Group();
  at(ball(0.42, 0x8a9e86, LEAF, 6, 4), 0, 0.22, 0, g).scale.y = 0.7;
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + rng();
    const d = rng() * 0.34;
    const spike = at(cone(0.07, 0.5 + rng() * 0.2, k % 3 ? 0x8f78c8 : 0xa890d8, 4, { flat: true }), Math.cos(a) * d, 0.62, Math.sin(a) * d, g);
    spike.rotation.set(Math.sin(a) * d * 0.9, 0, -Math.cos(a) * d * 0.9);
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

/** A limestone outcrop: a few angular blocks leaning on each other, a tuft of grass in a crack. */
function outcrop(rng) {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const r = 0.6 + rng() * 1.0;
    const rock = at(solid(new THREE.DodecahedronGeometry(r, 0), paint(pick(rng, ROCK), { flat: true })), (rng() - 0.5) * 2.0, r * 0.35, (rng() - 0.5) * 2.0, g);
    rock.scale.set(1 + rng() * 0.5, 0.6 + rng() * 0.6, 1 + rng() * 0.3);
    rock.rotation.set(rng() * 0.4, rng() * 3, rng() * 0.4);
  }
  at(ball(0.4, 0x6f9658, LEAF, 5, 3), (rng() - 0.5) * 1.2, 0.5, (rng() - 0.5) * 1.2, g).scale.y = 0.6;
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
    occupy(x + 0.6, z + 0.2, 0, 2.1, 2.1);
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
function grow(scene, rng, build, { count, variants = 3, margin = 0, maxSlope = 0.4, where = () => true, size = [0.8, 1.25], sink = 0.1, sample = anywhere }) {
  const protos = Array.from({ length: variants }, () => prototype(build(rng)));
  const placements = protos.map(() => []);
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0, n = 0; i < count * 20 && n < count; i++) {
    sample(rng, p);
    const slope = slopeAt(p.x, p.z);
    if (!isWild(p.x, p.z, margin) || slope > maxSlope || !where(p.x, p.z)) continue;
    q.setFromAxisAngle(UP, rng() * Math.PI * 2);
    s.setScalar(size[0] + rng() * (size[1] - size[0]));
    // On a slope the foot of the plant is buried on the uphill side.
    p.y -= sink + slope * 0.7;
    placements[Math.floor(rng() * variants)].push(new THREE.Matrix4().compose(p, q, s));
    n++;
  }
  instance(scene, build, protos, placements);
}

/** Instances baked variants of a species, one list of placements for each variant. */
function instance(scene, build, protos, placements) {
  protos.forEach((meshes, v) => {
    const list = placements[v];
    if (!list.length) return;
    for (const m of meshes) {
      const inst = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      list.forEach((matrix, i) => inst.setMatrixAt(i, matrix));
      inst.castShadow = inst.receiveShadow = true;
      inst.userData.plant = build.name;
      scene.add(inst);
    }
  });
}

export function buildNature(scene, rng, animated) {
  const on = (...regions) => (x, z) => regions.includes(region(x, z));
  buildBeach(scene, rng);

  // Ground cover: grass tufts bowing as the wind runs through them.
  const blades = [];
  for (let k = 0; k < 5; k++) {
    const b = new THREE.ConeGeometry(0.1, 0.8 + (k % 3) * 0.25, 3);
    b.translate(0, 0.45, 0);
    b.rotateZ((k - 2) * 0.22);
    b.rotateY((k / 5) * Math.PI);
    blades.push(b);
  }
  // Blades, petals and pebbles are too fine for the shadow map to hold their shadows: they
  // cast none, which spares drawing them all again from the sun.
  scatterInstanced(scene, rng, mergeGeometries(blades), paint(0xffffff, { sway: true }), 11000, (r, p, s, c) => {
    anywhere(r, p);
    if (!isWild(p.x, p.z, -1.5) || slopeAt(p.x, p.z) > 0.8) return false;
    if (p.y < WATER_LEVEL + 1.3) return false; // keep the beach clean
    const lush = fbm(p.x * 0.05 + 3, p.z * 0.05 - 8, 3);
    if (lush < 0.5 && r() < 0.8) return false;
    s.setScalar(0.7 + r() * 0.8);
    // Green where it stays damp, straw-coloured where the sun dries it.
    c.setHex(lush > 0.55 ? pick(r, [PAL.grass, PAL.grassDeep, PAL.moss, 0x98cc6c]) : pick(r, [0xb4c486, 0xc4cc94, PAL.grass]));
    return true;
  }).castShadow = false;

  // Wildflowers: five petals around a heart.
  const petals = [new THREE.CylinderGeometry(0.025, 0.03, 0.6, 3).translate(0, 0.3, 0).toNonIndexed()];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    petals.push(new THREE.IcosahedronGeometry(0.09, 0).scale(1.4, 0.5, 1).translate(Math.cos(a) * 0.11, 0.64, Math.sin(a) * 0.11));
  }
  scatterInstanced(scene, rng, mergeGeometries(petals), paint(0xffffff, { sway: true }), 5200, (r, p, s, c) => {
    anywhere(r, p);
    if (!isWild(p.x, p.z, -1) || slopeAt(p.x, p.z) > 0.6) return false;
    if (p.y < WATER_LEVEL + 1.3) return false;
    // Each drift of flowers is mostly one kind: poppies, buttercups, daisies or wild lavender.
    const drift = fbm(p.x * 0.06 - 4, p.z * 0.06 + 9, 2);
    if (drift < 0.5) return false;
    s.setScalar(0.8 + r() * 0.7);
    const kinds = [PAL.red, PAL.saffron, PAL.ivory, 0x9a86c8, 0xf2a6c1];
    c.setHex(r() < 0.7 ? kinds[Math.floor(fbm(p.x * 0.03 + 20, p.z * 0.03, 2) * 9.99) % kinds.length] : pick(r, kinds));
    return true;
  }).castShadow = false;

  // Pebbles: fine speckle on the sand.
  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(0.22, 0), paint(0xffffff, { flat: true }), 2000, (r, p, s, c) => {
    anywhere(r, p);
    if (!isWild(p.x, p.z, -2) || region(p.x, p.z) === 'mountain') return false;
    s.set(0.6 + r() * 1.2, 0.4 + r() * 0.6, 0.6 + r() * 1.2);
    c.setHex(pick(r, ROCK));
    return true;
  }).castShadow = false;

  // Boulders, thickest on the wild flanks where they have rolled down from the crags.
  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(1, 0), paint(0xffffff, { flat: true }), 240, (r, p, s, c) => {
    anywhere(r, p);
    if (!isWild(p.x, p.z)) return false;
    if (region(p.x, p.z) !== 'mountain' ? r() < 0.6 : worked(p.x, p.z) > 0.5) return false;
    s.set(0.6 + r() * 1.4, 0.5 + r() * 1.5, 0.6 + r() * 1.4);
    p.y += s.y * 0.3;
    c.setHex(pick(r, ROCK));
    // No tree grows out of the middle of a boulder.
    occupy(p.x, p.z, 0, Math.max(s.x, s.z), Math.max(s.x, s.z));
    return true;
  });

  // Rocks standing in the shallows, with the swell breaking white around them.
  const quays = villagePlan().lanes.filter((lane) => lane.quay).flatMap((lane) => lane.segs.map(({ a, b }) => [a.x, a.z, b.x, b.z]));
  scatterInstanced(scene, rng, new THREE.DodecahedronGeometry(1, 0), paint(0xffffff, { flat: true }), 170, (r, p, s, c) => {
    anywhere(r, p);
    const u = toU(p.x, p.z);
    const v = toV(p.x, p.z);
    // In the shallows off the rocky shores and the coves; the bay beach and the harbour stay
    // clear, and so does the basin off the village quay, where the boats are moored.
    if (p.y > WATER_LEVEL - 0.3 || p.y < WATER_LEVEL - 2.6 || (v > -32 && v < 52 && u < 0)) return false;
    if (ZONES.some((zn) => Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r + (zn.id === 'port' ? 10 : 3))) return false;
    if (quays.some((seg) => segmentDistance(p.x, p.z, seg) < 32)) return false;
    s.set(0.5 + r() * 1.3, 0.6 + r() * 1.1, 0.5 + r() * 1.3);
    p.y = WATER_LEVEL - 0.3;
    c.setHex(pick(r, [0x8f8678, 0x9d9484, 0x7f7a70]));
    return true;
  });

  // Trees. On the wild flanks pines and oaks close into groves; olive, lemon and almond keep
  // to the worked land; cypresses stand about the plain; palms line the sea front.
  const tame = (x, z) => region(x, z) !== 'mountain' || worked(x, z) > 0.4;
  grow(scene, rng, stonePine, { count: 130, variants: 4, margin: 1.5, maxSlope: 0.75, where: (x, z) => region(x, z) !== 'mountain' || wood(x, z) > 0.44 });
  grow(scene, rng, holmOak, { count: 190, variants: 4, margin: 1.5, maxSlope: 0.75, where: (x, z) => wood(x, z) > (region(x, z) === 'mountain' ? 0.5 : 0.56) });
  grow(scene, rng, cypress, { count: 70, variants: 3, margin: 1, maxSlope: 0.6, where: tame, size: [0.8, 1.3] });
  grow(scene, rng, oliveTree, { count: 110, variants: 4, margin: 1, maxSlope: 0.4, where: (x, z) => region(x, z) !== 'shore' && tame(x, z) });
  grow(scene, rng, lemonTree, { count: 40, variants: 3, maxSlope: 0.4, where: (x, z) => region(x, z) !== 'shore' && tame(x, z) });
  grow(scene, rng, almondTree, { count: 64, variants: 4, margin: 1, maxSlope: 0.45, where: (x, z) => region(x, z) !== 'shore' && tame(x, z), size: [0.9, 1.35] });
  grow(scene, rng, palm, { count: 14, variants: 3, margin: 1.5, maxSlope: 0.3, where: (x, z) => region(x, z) === 'shore' && groundAt(x, z) < 1.5 && toV(x, z) < 60 && toU(x, z) > -60, size: [0.85, 1.2] });

  // The spur the railway tunnels into, a wild knoll beside the station: a grove of pines and
  // oaks closes over the tunnel, maquis and broom down its flanks.
  const onSpur = (rng, p) => {
    const spot = railPoint(SPUR_END - 5 - rng() * 22, -12 + rng() * 36);
    p.set(spot.x, groundAt(spot.x, spot.z), spot.z);
    return p;
  };
  grow(scene, rng, stonePine, { count: 14, variants: 3, margin: 1.5, maxSlope: 0.8, sample: onSpur });
  grow(scene, rng, holmOak, { count: 12, variants: 3, margin: 1.5, maxSlope: 0.8, sample: onSpur });
  grow(scene, rng, maquis, { count: 40, variants: 4, margin: -1, maxSlope: 1.4, size: [0.7, 1.5], sample: onSpur });
  grow(scene, rng, broom, { count: 16, variants: 3, maxSlope: 1.1, size: [0.8, 1.3], sample: onSpur });

  // Shrubs: the maquis clings even to the steep slopes.
  grow(scene, rng, maquis, { count: 650, variants: 6, margin: -1, maxSlope: 1.4, size: [0.7, 1.5] });
  grow(scene, rng, broom, { count: 170, variants: 3, maxSlope: 1.1, where: on('mountain', 'shore'), size: [0.8, 1.3] });
  grow(scene, rng, oleander, { count: 60, variants: 4, margin: 0.5, maxSlope: 0.4, where: on('plain', 'shore'), size: [0.8, 1.25] });
  grow(scene, rng, lavender, { count: 330, variants: 3, maxSlope: 0.7, where: (x, z) => fbm(x * 0.07 + 30, z * 0.07 - 11, 2) > 0.56, size: [0.8, 1.4], sink: 0.02 });
  grow(scene, rng, agave, { count: 90, variants: 3, maxSlope: 0.8, where: on('shore', 'mountain'), size: [0.7, 1.2] });
  grow(scene, rng, pricklyPear, { count: 60, variants: 3, maxSlope: 0.7, where: on('shore', 'plain') });

  // Limestone outcrops on the wild ground.
  grow(scene, rng, outcrop, { count: 100, variants: 4, margin: 1, maxSlope: 1.3, where: (x, z) => worked(x, z) < 0.5, size: [0.7, 1.6], sink: 0.25 });

  // Lanterns along the footpaths, baked together.
  const lamps = new THREE.Group();
  for (const [ax, az, bx, bz] of PATHS.slice(0, 6)) {
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let d = 15, side = 1; d < len - 14; d += 9, side = -side) {
      const x = ax + ((bx - ax) * d) / len + nx * 2.4 * side;
      const z = az + ((bz - az) * d) / len + nz * 2.4 * side;
      lantern(lamps, x, groundAt(x, z), z, { toward: [x - nx * 2.4 * side, z - nz * 2.4 * side] });
    }
  }
  scene.add(bake(lamps));

  plantMaples(scene, animated);
}

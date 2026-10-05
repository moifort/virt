// Terrain: coastal frame, work areas, heightfield, water.
import * as THREE from 'three';
import { fbm, hash, smoothstep } from './noise.js';
import { GLOBALS, PATH_COUNT, WATER_LEVEL, paint } from './style.js';

export { WATER_LEVEL };
// The map is an island of its own in an endless sea, laid out along its bay (u from the open
// sea toward the mountain, v along the shore). The square is only the bounds of what can be
// walked and planted: the land falls into the water well inside it on every side.
export const SQUARE = { u0: -100, u1: 250, v0: -145, v1: 148 };
const SEA_FLOOR = -14;
// The sun is low over the sea, a little to the left: it lights the slopes that face the bay.
export const SUN_DIR = new THREE.Vector3(-0.5, 0.36, 1).normalize();

export const WORLD_SIZE = 570;
export const SEGMENTS = 570;
export const CELL = WORLD_SIZE / SEGMENTS;
export const HALF = WORLD_SIZE / 2;
export const UP = new THREE.Vector3(0, 1, 0);

// Coastal frame: u climbs from the sea toward the mountain (away from the default camera),
// v runs along the shore (left to right on screen).
export const toX = (u, v) => (-u + v) / Math.SQRT2;
export const toZ = (u, v) => (-u - v) / Math.SQRT2;
export const toU = (x, z) => (-x - z) / Math.SQRT2;
export const toV = (x, z) => (x - z) / Math.SQRT2;
// To the right a headland reaches far out to sea; to the left the land falls back and the sea opens.
export const headland = (v) => smoothstep(52, 96, v + (fbm(v * 0.05, 9.4, 2) - 0.5) * 16);
export const openSea = (v) => smoothstep(-35, -105, v);
// Past the harbour the water runs all the way up the left side.
const farLeft = (v) => smoothstep(-74, -94, v);
// Pass `u` to make the left shore wander instead of running in a straight line.
const wander = (u) => (u === undefined ? 0 : (fbm(u * 0.035, 4.2, 3) - 0.5) * 30);
export const coastU = (v, u) => -40 + (fbm(v * 0.02, 3.1, 3) - 0.5) * 20 - headland(v) * 58 + openSea(v) * 95 + farLeft(v + wander(u)) * 260;
export const footU = (v, u) => 50 + (fbm(v * 0.025, 7.7, 3) - 0.5) * 18 + openSea(v) * 70 + farLeft(v + wander(u)) * 260;
// A white sand beach along the middle of the bay.
const beachBand = (v) => smoothstep(-30, -18, v) * smoothstep(64, 50, v);

export const placeZone = (id, name, hint, u, v, r) => ({ id, name, hint, u, v, r, x: toX(u, v), z: toZ(u, v) });
export const ZONES = [
  placeZone('agora', 'Agora', "l'Arbre-Mère", 0, 0, 12),
  placeZone('library', 'La Bibliothèque', 'bureau de Bob', 34, -34, 13),
  placeZone('moot', 'Salle du Moot', 'réunions', 30, 36, 15),
  placeZone('pub', 'Le Pub', 'après le travail', -22, -40, 12),
  placeZone('pods', 'Bulles focus', 'concentration', 2, 52, 13),
  placeZone('atelier', "L'Atelier", 'prototypes', 8, -54, 12),
  // The harbour lies at the foot of the main village, as in the Cinque Terre.
  placeZone('port', 'Le Port', 'pause au bord de l\'eau', 57, -82, 16),
];
export const zone = (id) => ZONES.find((z) => z.id === id);

// The villages, in (u, v), all of a size: the main one climbing from its harbour up the
// left-hand slopes, a hamlet on the right headland, and a third high on the mountain behind,
// looking out over the sea. `bell` gives a village its campanile.
export const VILLAGES = [
  { u: footU(-56) + 6, v: -56, r: 17, bell: true },
  { u: -46, v: 84, r: 10 },
  { u: 150, v: -24, r: 17, bell: true },
];
const hub = { x: toX(VILLAGES[0].u, VILLAGES[0].v), z: toZ(VILLAGES[0].u, VILLAGES[0].v) };

// Footpaths: from the agora to each work area, then the lane from the library to the harbour
// and the village street that comes down to it from the bell tower.
export const PATHS = [
  ...ZONES.slice(1, -1).map((z) => [0, 0, z.x, z.z]),
  [zone('library').x, zone('library').z, zone('port').x, zone('port').z],
  [hub.x, hub.z, zone('port').x, zone('port').z],
];

// The wine estate on the mountain side, left of the railway: a Florentine villa on its own
// level ground, among vineyards planted on irregular terraces.
export const ESTATE = { u: 80, v: 5, r: 27 };
export const VILLA = { u: 82, v: 9, r: 9, y: 12, x: toX(82, 9), z: toZ(82, 9) };
export const estateWeight = (u, v) => smoothstep(ESTATE.r + 8, ESTATE.r - 4, Math.hypot(u - ESTATE.u, v - ESTATE.v));
/** Built sites kept clear of wild growth ({ x, z, r }); builders add their own. */
export const CLEARINGS = [{ x: VILLA.x, z: VILLA.z, r: VILLA.r + 3 }];

// The railway crosses the angle between the mountain (a) and the right-hand ridge (b) at a
// constant level. Its station stands on a shelf cut into the mountain by the first tunnel:
// `s` runs along the line from a, `l` across it (negative uphill).
export const RAIL = { a: { u: 108, v: 25 }, b: { u: 35, v: 95 }, level: 24 };
export const STATION = { s0: 14, s1: 39, yard: { s0: 14, s1: 33, l0: -13, l1: -3.5 } };
const railStart = { x: toX(RAIL.a.u, RAIL.a.v), z: toZ(RAIL.a.u, RAIL.a.v) };
const railEnd = { x: toX(RAIL.b.u, RAIL.b.v), z: toZ(RAIL.b.u, RAIL.b.v) };
const railLength = Math.hypot(railEnd.x - railStart.x, railEnd.z - railStart.z);
const railDir = { x: (railEnd.x - railStart.x) / railLength, z: (railEnd.z - railStart.z) / railLength };
const RAIL_LINE = [railStart.x, railStart.z, railEnd.x, railEnd.z];
/** World position of a point given along (s) and across (l) the line. */
export const railPoint = (s, l = 0) => ({ x: railStart.x + railDir.x * s - railDir.z * l, z: railStart.z + railDir.z * s + railDir.x * l });
function stationYard(x, z) {
  const s = (x - railStart.x) * railDir.x + (z - railStart.z) * railDir.z;
  const l = -(x - railStart.x) * railDir.z + (z - railStart.z) * railDir.x;
  const y = STATION.yard;
  return smoothstep(y.s0 - 2.5, y.s0, s) * smoothstep(y.s1 + 2.5, y.s1, s) * smoothstep(y.l0 - 2.5, y.l0, l) * smoothstep(y.l1 + 2, y.l1, l);
}
for (const s of [18, 25, 32]) CLEARINGS.push({ ...railPoint(s, -8), r: 8 });

/**
 * The estate is a patchwork of plots with wandering outlines. Each plot sets its terraces at
 * its own level, so the shelves never line up from one plot to the next.
 */
function plotShift(u, v) {
  const wu = u + (fbm(u * 0.07 + 2, v * 0.07, 2) - 0.5) * 16;
  const wv = v + (fbm(u * 0.07 - 5, v * 0.07 + 8, 2) - 0.5) * 16;
  const row = Math.floor(wu / 9);
  const col = Math.floor((wv + hash(row, 7) * 14) / (10 + hash(row, 3) * 8));
  return hash(row * 31 + col, col * 17 - row);
}

// ---------------------------------------------------------------- Ground

/**
 * How much of a mountainside is worked (1) rather than left wild (0): terraced for the vines
 * around the villages and the estate and in patches across the lower flanks, never near the top.
 */
export function cultivated(u, v) {
  const foot = footU(v, u);
  const heart = smoothstep(-22, -12, v) * smoothstep(48, 38, v) * smoothstep(foot + 40, foot + 30, u);
  const patches = smoothstep(0.47, 0.55, fbm(v * 0.03 + 5, u * 0.03, 2)) * smoothstep(foot - 2, foot + 6, u) * smoothstep(foot + 78, foot + 52, u);
  let worked = Math.max(heart, patches, estateWeight(u, v));
  for (const village of VILLAGES) worked = Math.max(worked, smoothstep(village.r + 12, village.r + 2, Math.hypot(u - village.u, v - village.v)));
  return worked;
}

// A small island stands off the back of the mountain: sheer rock all round, pines on top.
const ISLET = { u: 224, v: -114, r: 12 };
// The pebble cove beside the harbour, along the left shore: where it lies along u, and the
// line of its water's edge.
export const COVE = { u0: 76, u1: 104 };
const coveShore = (u) => -85 - wander(u);
const inCove = (u) => smoothstep(COVE.u0 - 4, COVE.u0 + 3, u) * smoothstep(COVE.u1 + 4, COVE.u1 - 3, u);
/** A point of the cove's water line, `inland` metres up the beach (negative: out in the water). */
export const coveAt = (u, inland = 0) => ({ x: toX(u, coveShore(u) + inland), z: toZ(u, coveShore(u) + inland) });

/** The lie of the land before the stream has cut its bed into it. */
function landAt(x, z) {
  const u = toU(x, z);
  const v = toV(x, z);
  let h = 0.7 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 2.2;
  // The mountain rises behind the bay, as steep as the Ligurian coast. Behind its first crest
  // it carries on and climbs to its true summit.
  const foot = footU(v, u);
  const massif = 38 * smoothstep(1, 0, Math.hypot((u - 172) / 52, (v + 5) / 85) + (fbm(x * 0.012 + 4, z * 0.012 - 6, 2) - 0.5) * 0.4) ** 1.3;
  const back = smoothstep(foot, foot + 80, u) * (40 + (fbm(x * 0.015, z * 0.015, 3) - 0.5) * 20) + Math.max(0, u - foot) * 0.05 + massif * smoothstep(foot, foot + 50, u);
  // Side ridges run down from the mountain and plunge into the sea, closing the bay.
  const ridge = headland(v) * (13 + smoothstep(-110, 70, u) * 30 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 10);
  const mountain = Math.max(back, ridge);
  const estate = estateWeight(u, v);
  const worked = cultivated(u, v);
  // Its flanks are no smooth ramp: spurs and gullies run down them, outcrops of bare rock break
  // through, buttresses stand out near the top, and the ground is rough underfoot. The estate
  // and the railway were surveyed on a quieter slope.
  const lift = smoothstep(0, 10, mountain);
  const calm = Math.max(estate, smoothstep(30, 8, segmentDistance(x, z, RAIL_LINE)));
  const spurs = (fbm(v * 0.045 + fbm(u * 0.02, v * 0.02, 2) * 1.5, u * 0.012 + 3.3, 3) - 0.5) * 2;
  const crag = fbm(x * 0.06 + 40, z * 0.06 - 12, 3);
  let relief = spurs * (1.5 + mountain * 0.14);
  relief += smoothstep(0.57, 0.61, crag) * (1.5 + 2.4 * smoothstep(0.61, 0.74, crag)) * (1 - worked);
  relief += smoothstep(0.52, 0.57, fbm(x * 0.028 + 9, z * 0.028 + 2, 2)) * smoothstep(16, 28, mountain) * 4.5 * (1 - worked);
  relief += (fbm(x * 0.16, z * 0.16, 2) - 0.5) * 1.3 * (1 - worked);
  h += mountain + relief * lift * (1 - calm);
  // The sea: sheer cliffs under the headlands, softer coves in the bay.
  const coast = coastU(v, u);
  const sheer = (4 + fbm(v * 0.04 + 11, 2.3, 2) * 14) * (1 - headland(v) * 0.75);
  h -= smoothstep(coast + 2, coast - sheer, u) * (9 + headland(v) * 20);
  // On its far sides, behind and to the right, the mountain falls straight into the water.
  const farShore = 214 + (fbm(v * 0.03 + 2, 6.1, 3) - 0.5) * 24;
  const rightShore = 128 + (fbm(u * 0.03 - 4, 1.7, 3) - 0.5) * 18;
  const steep = 12 + fbm(x * 0.04 + 15, z * 0.04, 2) * 16;
  h += (-9.5 - h) * Math.max(smoothstep(farShore - steep, farShore + 2, u), smoothstep(rightShore - steep, rightShore + 2, v));
  // Terraces: shelves and short dry-stone walls where the land is worked, and on the plain.
  // The shelves follow the lie of the land rather than level lines. The wild slopes keep their
  // fall, only eased here and there into natural benches.
  const step = 2.4;
  const shift = estate > 0 ? plotShift(u, v) * step * estate : 0;
  const wander = (fbm(x * 0.035 + 7, z * 0.035 + 1, 2) - 0.5) * 5 * lift * (1 - estate);
  const level = h + shift + wander;
  const shelf = Math.floor(level / step) * step;
  const terraced = shelf + smoothstep(0.72, 1, (level - shelf) / step) * step - shift - wander;
  const benches = smoothstep(0.45, 0.7, fbm(x * 0.02 - 3, z * 0.02 + 8, 2)) * 0.45;
  h += (terraced - h) * Math.max(worked, smoothstep(3, 0.5, mountain), benches);
  // The beach: a smooth gentle slope down into turquoise shallows, no terraces.
  const beach = beachBand(v) * smoothstep(coast + 14, coast + 8, u) * smoothstep(coast - 5, coast + 1, u);
  h += (WATER_LEVEL + 0.25 + Math.max(0, u - coast) * 0.08 - h) * beach;
  // The cove beside the harbour: a shingle beach shelving very gently, so the water stays
  // shallow and turquoise a long way out.
  const inland = v - coveShore(u);
  const shingle = inCove(u) * smoothstep(-24, -16, inland) * smoothstep(13, 7, inland);
  h += (WATER_LEVEL + (inland > 0 ? 0.3 + inland * 0.1 : -0.12 + inland * 0.13) - h) * shingle;
  // Work areas sit on level pads.
  for (const zn of ZONES) h += (0 - h) * smoothstep(zn.r + 7, zn.r + 1, Math.hypot(x - zn.x, z - zn.z));
  h += (VILLA.y - h) * smoothstep(VILLA.r + 4, VILLA.r + 0.5, Math.hypot(x - VILLA.x, z - VILLA.z));
  h += (RAIL.level - 0.05 - h) * stationYard(x, z);
  // The islet off the back of the mountain.
  const off = Math.hypot(u - ISLET.u, v - ISLET.v) / ISLET.r + (fbm(x * 0.09 + 2, z * 0.09, 2) - 0.5) * 0.5;
  if (off < 1.4) h = Math.max(h, -9.5 + smoothstep(1.4, 1, off) * 7 + smoothstep(1, 0.86, off) * (13 + fbm(x * 0.1, z * 0.1 + 3, 2) * 7) + smoothstep(0.86, 0, off) * 7);
  // Whatever happens, the land has sunk under the sea before the bounds of the map.
  const brink = Math.min(u - SQUARE.u0, SQUARE.u1 - u, v - SQUARE.v0, SQUARE.v1 - v) + (fbm(x * 0.05 + 8, z * 0.05, 2) - 0.5) * 8;
  return h + (-12 - h) * smoothstep(11, 2, brink);
}

// A stream rises high on the left flank of the mountain, plunges over a rock step beside the
// upper village, runs down a ravine and goes over the sea cliff into the water. Its course in
// (u, v); `plunge` is how far along it the great fall is, and how high.
const COURSE = [[178, -40], [168, -50], [160, -60], [150, -72], [142, -84], [136, -94], [131, -103], [126, -114]];
const PLUNGE = { at: 0.2, drop: 13 };

/**
 * The bed of the stream, a point every metre or so: { x, z, y, run, pool }. It keeps just under
 * the lie of the land and never climbs, so it tumbles wherever the slope is steep.
 */
export const STREAM = (() => {
  const bed = [];
  let length = 0;
  for (let i = 1; i < COURSE.length; i++) length += Math.hypot(COURSE[i][0] - COURSE[i - 1][0], COURSE[i][1] - COURSE[i - 1][1]);
  let run = 0;
  let level = Infinity;
  let plunged = false;
  for (let i = 1; i < COURSE.length; i++) {
    const [u0, v0] = COURSE[i - 1];
    const [u1, v1] = COURSE[i];
    const span = Math.hypot(u1 - u0, v1 - v0);
    for (let d = 0; d < span; d += 1) {
      const u = u0 + ((u1 - u0) * d) / span;
      const v = v0 + ((v1 - v0) * d) / span + Math.sin((run + d) * 0.35) * 1.2;
      const x = toX(u, v);
      const z = toZ(u, v);
      level = Math.min(level - 0.06, landAt(x, z) - 0.9);
      const pool = !plunged && (run + d) / length > PLUNGE.at;
      if (pool) {
        level -= PLUNGE.drop;
        plunged = true;
      }
      if (level < WATER_LEVEL) return bed;
      bed.push({ x, z, y: level, pool });
    }
    run += span;
  }
  return bed;
})();
const streamBounds = STREAM.reduce((b, p) => ({ x0: Math.min(b.x0, p.x - 9), x1: Math.max(b.x1, p.x + 9), z0: Math.min(b.z0, p.z - 9), z1: Math.max(b.z1, p.z + 9) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });

export function heightAt(x, z) {
  const h = landAt(x, z);
  if (x < streamBounds.x0 || x > streamBounds.x1 || z < streamBounds.z0 || z > streamBounds.z1) return h;
  // The stream has cut its bed: level with the water where it runs, banks easing back to the
  // lie of the land, wider around the pool under the great fall.
  let nearest = Infinity;
  let bed = null;
  for (const p of STREAM) {
    const d = Math.hypot(x - p.x, z - p.z) - (p.pool ? 3 : 0);
    if (d < nearest) [nearest, bed] = [d, p];
  }
  return nearest > 7 ? h : bed.y + (h - bed.y) * smoothstep(1, 7, nearest);
}
for (const p of STREAM) CLEARINGS.push({ x: p.x, z: p.z, r: p.pool ? 6 : 3 });

// The heightfield everything else reads: the land inside the bounds, open sea beyond them.
export const GRID = new Float32Array((SEGMENTS + 1) ** 2);
for (let iz = 0; iz <= SEGMENTS; iz++) {
  for (let ix = 0; ix <= SEGMENTS; ix++) {
    const x = ix * CELL - HALF;
    const z = iz * CELL - HALF;
    GRID[iz * (SEGMENTS + 1) + ix] = inSquare(x, z, -1.5) ? Math.max(SEA_FLOOR, heightAt(x, z)) : SEA_FLOOR;
  }
}

/** The corners of the map, in world (x, z): the horizon lies beyond them all. */
export const LAND_ENDS = [[SQUARE.u0, SQUARE.v0], [SQUARE.u0, SQUARE.v1], [SQUARE.u1, SQUARE.v1], [SQUARE.u1, SQUARE.v0]].map(([u, v]) => [toX(u, v), toZ(u, v)]);

/** Ground height matching the rendered triangles exactly. */
export function groundAt(x, z) {
  const u = Math.min(SEGMENTS - 1e-6, Math.max(0, (x + HALF) / CELL));
  const v = Math.min(SEGMENTS - 1e-6, Math.max(0, (z + HALF) / CELL));
  const ix = Math.floor(u);
  const iz = Math.floor(v);
  const fu = u - ix;
  const fv = v - iz;
  const row = SEGMENTS + 1;
  const a = GRID[iz * row + ix];
  const b = GRID[(iz + 1) * row + ix];
  const c = GRID[(iz + 1) * row + ix + 1];
  const d = GRID[iz * row + ix + 1];
  if (fu + fv <= 1) return a + (d - a) * fu + (b - a) * fv;
  return c + (b - c) * (1 - fu) + (d - c) * (1 - fv);
}

export function segmentDistance(x, z, [ax, az, bx, bz]) {
  const px = x - ax;
  const pz = z - az;
  const dx = bx - ax;
  const dz = bz - az;
  const h = Math.min(1, Math.max(0, (px * dx + pz * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - dx * h, pz - dz * h);
}

/** True where nature may grow: off the work pads, off the paths, above water. */
/** True inside the diorama square, at least `margin` from its edges. */
export function inSquare(x, z, margin = 0) {
  const u = toU(x, z);
  const v = toV(x, z);
  return u > SQUARE.u0 + margin && u < SQUARE.u1 - margin && v > SQUARE.v0 + margin && v < SQUARE.v1 - margin;
}

export function isWild(x, z, margin = 0) {
  if (!inSquare(x, z, 2)) return false;
  if (groundAt(x, z) < WATER_LEVEL + 0.4) return false;
  for (const zn of ZONES) if (Math.hypot(x - zn.x, z - zn.z) < zn.r + 3 + margin) return false;
  for (const p of PATHS) if (segmentDistance(x, z, p) < 2.6 + margin) return false;
  for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return false;
  return true;
}

export function slopeAt(x, z) {
  return (Math.abs(groundAt(x + 1, z) - groundAt(x - 1, z)) + Math.abs(groundAt(x, z + 1) - groundAt(x, z - 1))) / 4;
}

/** The ground of the island: a grid laid out in (u, v), out to where it is all under the sea. */
export function buildTerrain() {
  const { u0, v0 } = SQUARE;
  const nu = SQUARE.u1 - u0;
  const nv = SQUARE.v1 - v0;
  const geo = new THREE.PlaneGeometry(1, 1, nv, nu);
  const pos = geo.attributes.position;
  const worked = new Float32Array(pos.count);
  for (let iu = 0; iu <= nu; iu++) {
    for (let iv = 0; iv <= nv; iv++) {
      const i = iu * (nv + 1) + iv;
      const x = toX(u0 + iu, v0 + iv);
      const z = toZ(u0 + iu, v0 + iv);
      pos.setXYZ(i, x, groundAt(x, z), z);
      worked[i] = cultivated(u0 + iu, v0 + iv);
    }
  }
  // Tells the built terrace walls from the living rock.
  geo.setAttribute('aTerrace', new THREE.BufferAttribute(worked, 1));
  // Make sure the triangles face up.
  const index = geo.index.array;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  a.fromBufferAttribute(pos, index[0]);
  b.fromBufferAttribute(pos, index[1]);
  c.fromBufferAttribute(pos, index[2]);
  if (b.sub(a).cross(c.sub(a)).y < 0) {
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, paint(0xffffff, { terrain: true }));
  mesh.receiveShadow = true;
  return mesh;
}
/**
 * The sea has no edge: it runs on past the diorama on every side, out to a horizon that the
 * view sets for itself (see `uHorizon`).
 */
export function buildWater() {
  const reach = 2400;
  const surface = new THREE.PlaneGeometry(reach * 2, reach * 2).rotateX(-Math.PI / 2).translate(0, WATER_LEVEL, 0);
  const mesh = new THREE.Mesh(surface, paint(0xffffff, { water: true }));
  mesh.receiveShadow = true;
  return mesh;
}

export function scatterInstanced(scene, rng, geo, mat, count, place) {
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  let n = 0;
  for (let i = 0; i < count * 5 && n < count; i++) {
    if (!place(rng, p, s, c)) continue;
    q.setFromAxisAngle(UP, rng() * Math.PI * 2);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/** A random point of the map, anywhere within its bounds, on the ground or the sea bed. */
export function anywhere(rng, p) {
  const u = SQUARE.u0 + rng() * (SQUARE.u1 - SQUARE.u0);
  const v = SQUARE.v0 + rng() * (SQUARE.v1 - SQUARE.v0);
  p.set(toX(u, v), 0, toZ(u, v));
  p.y = groundAt(p.x, p.z);
  return p;
}

/** A random point within `maxR` of the agora. */
export function randomSpot(rng, p, maxR = 110) {
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * maxR;
  p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  p.y = groundAt(p.x, p.z);
  return p;
}


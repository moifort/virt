// Terrain: coastal frame, work areas, heightfield, water.
import * as THREE from 'three';
import { fbm, hash, smoothstep } from './noise.js';
import { WATER_LEVEL, paint } from './style.js';

export { WATER_LEVEL };
// The map is a game tile laid out along its bay (u from the open sea toward the mountain, v
// along the shore). In front and to the left the sea runs on to the horizon; behind the
// mountains and on the right the tile is cut clean through, land and sea alike, and its
// section shows down to a base.
export const SQUARE = { u0: -100, u1: 205, v0: -145, v1: 112 };
const SEA_FLOOR = -14;
const BASE_Y = -16;
// The sun is low over the sea, a little to the left: it lights the slopes that face the bay.
export const SUN_DIR = new THREE.Vector3(-0.5, 0.36, 1).normalize();

export const WORLD_SIZE = 500;
export const SEGMENTS = 500;
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
export const openSea = (v) => smoothstep(-49, -119, v);
// Past the harbour the water runs all the way up the left side.
const farLeft = (v) => smoothstep(-88, -108, v);
// Pass `u` to make the left shore wander instead of running in a straight line.
const wander = (u) => (u === undefined ? 0 : (fbm(u * 0.035, 4.2, 3) - 0.5) * 30);
export const coastU = (v, u) => -40 + (fbm(v * 0.02, 3.1, 3) - 0.5) * 20 - headland(v) * 58 + openSea(v) * 95 + farLeft(v + wander(u)) * 260;
export const footU = (v, u) => 50 + (fbm(v * 0.025, 7.7, 3) - 0.5) * 18 + openSea(v) * 70 + farLeft(v + wander(u)) * 260;
// The far shores of the island, where the mountain comes down to the sea: the water's edge on
// the left (a v for each u), behind (a u for each v) and on the right (a v for each u).
const leftShore = (u) => -99 - wander(u);
const farShore = (v) => 238 + (fbm(v * 0.03 + 2, 6.1, 3) - 0.5) * 22;
const rightShore = (u) => 128 + (fbm(u * 0.03 - 4, 1.7, 3) - 0.5) * 18;
// Where along the left shore the main village comes down to the water.
const HARBOUR_U = 68;
// A white sand beach along the middle of the bay.
const beachBand = (v) => smoothstep(-30, -18, v) * smoothstep(64, 50, v);

// ---------------------------------------------------------------- Built ground

// The ground under the buildings, marked by whoever builds them, a cell to a metre: 2 under
// the walls, 1 in a band around them. Nothing wild grows on it, and no tree right against a wall.
const BUILT = new Uint8Array(SEGMENTS * SEGMENTS);
const BUILT_BAND = 1.5;
// The cells inside the walls of a house, with the height of its top: nobody walks through
// them, though a lane may run over a house built in under it.
const SOLID = new Float32Array(SEGMENTS * SEGMENTS).fill(-Infinity);
/**
 * Marks as built the rectangle centred on (x, z), turned by `yaw`, reaching `hw` either side
 * along its local x and `hd` along its local z. A walled one gives the height of its `top`:
 * below that it cannot be walked into.
 */
export function occupy(x, z, yaw, hw, hd, top = -Infinity) {
  const ax = Math.cos(yaw);
  const az = -Math.sin(yaw);
  const reach = Math.hypot(hw, hd) + BUILT_BAND;
  const lo = (c) => Math.max(0, Math.floor((c - reach + HALF) / CELL));
  const hi = (c) => Math.min(SEGMENTS - 1, Math.floor((c + reach + HALF) / CELL));
  for (let iz = lo(z); iz <= hi(z); iz++) {
    for (let ix = lo(x); ix <= hi(x); ix++) {
      const px = (ix + 0.5) * CELL - HALF - x;
      const pz = (iz + 0.5) * CELL - HALF - z;
      const out = Math.max(Math.abs(px * ax + pz * az) - hw, Math.abs(-px * az + pz * ax) - hd);
      const i = iz * SEGMENTS + ix;
      if (out < CELL / 2) BUILT[i] = 2;
      else if (out < BUILT_BAND) BUILT[i] = Math.max(BUILT[i], 1);
      if (out < -0.15) SOLID[i] = Math.max(SOLID[i], top);
    }
  }
}
/** How built the ground is at (x, z): 0 free, 1 beside a building, 2 under one. */
function builtAt(x, z) {
  const ix = Math.floor((x + HALF) / CELL);
  const iz = Math.floor((z + HALF) / CELL);
  return ix < 0 || iz < 0 || ix >= SEGMENTS || iz >= SEGMENTS ? 0 : BUILT[iz * SEGMENTS + ix];
}
/** True inside the walls of a house, unless the ground there stands over its top. */
export function isSolid(x, z) {
  const ix = Math.floor((x + HALF) / CELL);
  const iz = Math.floor((z + HALF) / CELL);
  return ix >= 0 && iz >= 0 && ix < SEGMENTS && iz < SEGMENTS && SOLID[iz * SEGMENTS + ix] > groundAt(x, z) + 0.3;
}

export const placeZone = (id, name, hint, u, v, r) => ({ id, name, hint, u, v, r, x: toX(u, v), z: toZ(u, v) });
export const ZONES = [
  placeZone('agora', 'Agora', "l'Arbre-Mère", 0, 0, 12),
  placeZone('library', 'La Bibliothèque', 'bureau de Bob', 34, -34, 13),
  placeZone('moot', 'Salle du Moot', 'réunions', 30, 36, 15),
  placeZone('pub', 'Le Pub', 'après le travail', -22, -40, 12),
  placeZone('pods', 'Bulles focus', 'concentration', 2, 52, 13),
  placeZone('atelier', "L'Atelier", 'prototypes', 8, -54, 12),
  // The harbour has no ground of its own: it starts from the quay of the main village's sea
  // front (see `VILLAGES`) and runs out over the sea.
  placeZone('port', 'Le Port', 'pause au bord de l\'eau', HARBOUR_U, leftShore(HARBOUR_U) + 7, 1),
];
export const zone = (id) => ZONES.find((z) => z.id === id);

// The villages, in (u, v): the main one, on a little quay along its harbour, climbing from
// there far up the left-hand slopes (`up` stretches it uphill), and a hamlet on the right
// headland. Each is laid out as the real ones grew: lanes (`lanes`, [u, v] points, so many
// metres wide) that follow the contours of the hill, stairs (`stair`) that climb between them,
// and a square or two (`piazzas`) where they meet, one with the church. The sea front is a
// `quay`: a stone edge with the water lapping at it. The houses are built along the lanes and
// scattered beyond them (village.js); the ground is cut level under them (`villagePlan`,
// `landAt`).
const shore = leftShore(HARBOUR_U);
const sh = (u, dv) => [u, shore + dv];
export const VILLAGES = [
  {
    u: HARBOUR_U + 12,
    v: shore + 42,
    r: 34,
    up: 1.3,
    waterfront: true,
    lanes: [
      // The sea front, along the quay, the harbour in the middle of it: a stone edge a little
      // above the water, held level the whole way along.
      { name: 'marina', width: 3.6, quay: 2.2, level: WATER_LEVEL + 2.0, points: [sh(48, 9), sh(60, 9.5), sh(68, 9), sh(78, 9.5), sh(90, 8.5)] },
      // Three lanes along the contours, each a storey or two above the last.
      { name: 'bassa', width: 3.4, points: [sh(82, 20.5), sh(75, 23.5), sh(70, 25.5), sh(64, 28.5), sh(63, 33.5), sh(62.5, 38.5), sh(61, 43.5), sh(60.5, 48), sh(60, 52), sh(59, 58)] },
      { name: 'mezzo', width: 3.2, points: [sh(95, 17), sh(90, 21), sh(87, 24.5), sh(84, 27), sh(79, 31.5), sh(76.5, 36), sh(73, 41), sh(72, 46), sh(72, 53), sh(71, 58), sh(71, 64), sh(72.5, 70), sh(75, 76)] },
      { name: 'alta', width: 3.0, points: [sh(99, 21), sh(97.5, 24.5), sh(95.5, 27), sh(93, 29.5), sh(89.5, 32.5), sh(88, 37), sh(86.5, 39.5), sh(83.5, 43.5), sh(83, 47.5), sh(82, 52), sh(81.5, 58), sh(82, 64), sh(83, 70), sh(86, 75), sh(89, 78)] },
      // The fourth lane leaves the church square along the brow of the hill.
      { name: 'cima', width: 3.0, points: [sh(96, 51), sh(93, 56), sh(92, 62), sh(94, 68), sh(99, 73), sh(104, 77)] },
      // Stairs, slanting across the slope from one lane up to the next, about as steep as they
      // are long (a lane stands a dozen metres over the last, so a straight flight would be a
      // ladder), and one climbing in zigzags from the top lane to the church, on a terrace cut
      // into the brow of the hill.
      { stair: true, width: 2.0, points: [sh(78, 9.5), sh(82, 20.5)] },
      { stair: true, width: 2.0, points: [sh(67.7, 26.7), sh(84, 27)] },
      { stair: true, width: 2.0, points: [sh(62.9, 34.5), sh(79, 30.4)] },
      { stair: true, width: 2.0, points: [sh(61, 43.5), sh(72, 49)] },
      // The well square stands right under the top lane: its stair doubles back on itself.
      { stair: true, width: 2.0, points: [sh(84.6, 34.7), sh(88.9, 27.9), sh(91.1, 31.1)] },
      { stair: true, width: 2.0, points: [sh(71, 57.9), sh(83, 47.5)] },
      { stair: true, width: 2.2, points: [sh(99, 21), sh(102, 24), sh(103, 30), sh(101, 38.5)] },
      { stair: true, width: 2.0, points: [sh(60, 56), sh(71, 60)] },
      { stair: true, width: 2.0, points: [sh(71, 63.2), sh(84, 71.7)] },
      { stair: true, width: 2.0, points: [sh(81.7, 60), sh(95.1, 52.5)] },
      { stair: true, width: 2.0, points: [sh(74, 73), sh(86, 75)] },
      // From the belvedere's edge, a dogleg up to the end of the brow lane.
      { stair: true, width: 2.0, points: [sh(92.6, 81.2), sh(98.5, 82), sh(104, 77)] },
    ],
    piazzas: [
      { u: 100, v: shore + 44.5, r: 7, level: 38, church: true },
      { u: 80.2, v: shore + 34.7, r: 4, well: true },
      { u: 89.5, v: shore + 79, r: 4, belvedere: true },
    ],
  },
  {
    u: -46,
    v: 84,
    r: 14,
    lanes: [
      { width: 2.8, points: [[-58, 82], [-50, 83], [-42, 83.5], [-34, 83]] },
      { width: 2.6, points: [[-54, 92], [-46, 92], [-38, 91.5]] },
      // One way up through the hamlet, in two flights: a stair is measured from the way it
      // leaves to the way it reaches, so a single flight through the lower lane would ramp
      // straight past that lane's level.
      { stair: true, width: 2.0, points: [[-44, 83.5], [-38, 92]] },
      { stair: true, width: 2.0, points: [[-52, 72.5], [-44, 83.5]] },
    ],
    // The stair comes down below the houses to a little lookout over the cliff.
    piazzas: [{ u: -54, v: 70.5, r: 3.5, belvedere: true }],
  },
];

/**
 * The streets of the villages, measured on the ground: each lane as world points with the
 * level of its paving at every vertex, each square with its level. A lane that follows the
 * contours keeps a smoothed reading of the natural ground; a stair ramps evenly from the lane
 * it leaves to the one it reaches; a square lies at the mean level of its ground, and so does
 * any lane that crosses it. A quay knows which of its sides the sea is on. The ground is then
 * cut level to them (see `landAt`), and the houses are built along them.
 */
let plan = null; // measured on first use; `false` while measuring, so the ground is read as it lies
export function villagePlan() {
  if (plan) return plan;
  if (plan === false) return null;
  plan = false;
  const natural = (x, z) => {
    let sum = 0;
    for (const [dx, dz] of [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) sum += landAt(x + dx, z + dz);
    return sum / 5;
  };
  const lanes = [];
  const piazzas = [];
  for (const village of VILLAGES) {
    const squares = (village.piazzas ?? []).map((pz) => ({ ...pz, village, x: toX(pz.u, pz.v), z: toZ(pz.u, pz.v) }));
    for (const pz of squares) {
      if (pz.level !== undefined) continue;
      let sum = 0;
      for (let k = 0; k < 8; k++) sum += natural(pz.x + Math.cos((k * Math.PI) / 4) * pz.r * 0.6, pz.z + Math.sin((k * Math.PI) / 4) * pz.r * 0.6);
      pz.level = sum / 8;
    }
    const measured = [];
    const streets = (village.lanes ?? []).slice().sort((a, b) => (a.stair ? 1 : 0) - (b.stair ? 1 : 0));
    for (const street of streets) {
      const pts = street.points.map(([u, v]) => ({ x: toX(u, v), z: toZ(u, v) }));
      // A stair climbs from the edge of the lane or the square it leaves to the edge of the one
      // it reaches, not from their middles: a vertex is set where it crosses each edge, holding
      // the level of the landing there, and it runs level from it to its end.
      if (street.stair) {
        for (const end of [0, 1]) {
          const i = end ? pts.length - 1 : 0;
          const a = pts[i];
          const b = pts[end ? i - 1 : 1];
          const square = squares.find((pz) => Math.hypot(a.x - pz.x, a.z - pz.z) < pz.r + 0.5);
          let q = null;
          if (square) {
            q = crossing(a, b, square, square.r + 0.5);
            if (q) q.landing = square.level;
          } else {
            const on = measured.find((o) => !o.stair && laneAt(o, a.x, a.z).d < o.half);
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            for (let t = 0.1; on && t < len - 0.5; t += 0.1) {
              const c = { x: a.x + ((b.x - a.x) * t) / len, z: a.z + ((b.z - a.z) * t) / len };
              const n = laneAt(on, c.x, c.z);
              if (n.d >= on.half + 0.15) {
                q = { ...c, landing: n.level, on };
                break;
              }
            }
          }
          if (q) pts.splice(end ? i : 1, 0, q);
        }
      }
      const segs = [];
      let length = 0;
      for (let i = 1; i < pts.length; i++) {
        const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        segs.push({ a: pts[i - 1], b: pts[i], len, s0: length });
        length += len;
      }
      const xs = pts.map((p) => p.x);
      const zs = pts.map((p) => p.z);
      const lane = { ...street, village, half: street.width / 2, pts, segs, length, levels: pts.map((p) => street.level ?? natural(p.x, p.z)), box: { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) } };
      if (!lane.stair && street.level === undefined) {
        for (let pass = 0; pass < 2; pass++) {
          const l = lane.levels;
          lane.levels = l.map((v, i) => (i === 0 || i === l.length - 1 ? v : l[i - 1] * 0.25 + v * 0.5 + l[i + 1] * 0.25));
        }
      }
      // Where a lane starts or ends on another, or on a square, it takes that level.
      const snap = (p) => {
        for (const pz of squares) if (Math.hypot(p.x - pz.x, p.z - pz.z) < pz.r + 1.5) return pz.level;
        let best = null;
        let nearest = 4;
        for (const other of measured) {
          const q = laneAt(other, p.x, p.z);
          if (q.d < nearest) {
            nearest = q.d;
            best = q.level;
          }
        }
        return best;
      };
      if (street.level === undefined) {
        for (const end of [0, pts.length - 1]) {
          const level = snap(pts[end]);
          if (level !== null) lane.levels[end] = level;
        }
      }
      pts.forEach((p, i) => {
        for (const pz of squares) if (Math.hypot(p.x - pz.x, p.z - pz.z) < pz.r + 2) lane.levels[i] = pz.level;
      });
      if (lane.stair) {
        // The flight runs evenly between its landings. Beyond them, out to its ends, it lies on
        // the paving of the lane it leaves or reaches, following that lane's own fall: were it
        // held level at the landing, it would stand a step up or down from the lane at its end.
        const n = pts.length - 1;
        const a = n > 1 && pts[1].landing !== undefined ? 1 : 0;
        const b = n - 1 > a && pts[n - 1].landing !== undefined ? n - 1 : n;
        const at = (i) => (i === 0 ? 0 : segs[i - 1].s0 + segs[i - 1].len);
        const l0 = pts[a].landing ?? lane.levels[a];
        const l1 = pts[b].landing ?? lane.levels[b];
        const beyond = (p, landing, level) => (landing.on ? laneAt(landing.on, p.x, p.z).level : level);
        lane.levels = pts.map((p, i) => {
          if (i < a) return beyond(p, pts[a], l0);
          if (i > b) return beyond(p, pts[b], l1);
          return l0 + ((l1 - l0) * (at(i) - at(a))) / (at(b) - at(a));
        });
      }
      if (lane.quay) {
        // The sea lies on the side where the ground falls away.
        const mid = lanePoint(lane, length / 2);
        const fall = (side) => landAt(mid.x - mid.tz * side * 9, mid.z + mid.tx * side * 9);
        lane.seaSide = fall(1) < fall(-1) ? 1 : -1;
      }
      measured.push(lane);
    }
    lanes.push(...measured);
    piazzas.push(...squares);
  }
  plan = { lanes, piazzas };
  return plan;
}

/** Where the segment from `a`, inside the circle of radius `r` round `c`, leaves it toward `b`; null if `a` is outside or `b` inside. */
function crossing(a, b, c, r) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const fx = a.x - c.x;
  const fz = a.z - c.z;
  const A = dx * dx + dz * dz;
  const B = 2 * (fx * dx + fz * dz);
  const C = fx * fx + fz * fz - r * r;
  if (C >= 0 || Math.hypot(b.x - c.x, b.z - c.z) <= r) return null;
  const t = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  return { x: a.x + dx * t, z: a.z + dz * t };
}

/** The nearest point of a lane to (x, z): its distance, how far along the lane it lies, and the level of the paving there. */
export function laneAt(lane, x, z) {
  const best = { d: Infinity, s: 0, level: 0, side: 1 };
  const { box } = lane;
  if (x < box.x0 - 9 || x > box.x1 + 9 || z < box.z0 - 9 || z > box.z1 + 9) return best;
  lane.segs.forEach(({ a, b, len, s0 }, i) => {
    const t = Math.min(1, Math.max(0, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / (len * len)));
    const dx = x - a.x - (b.x - a.x) * t;
    const dz = z - a.z - (b.z - a.z) * t;
    const d = Math.hypot(dx, dz);
    if (d < best.d) {
      best.d = d;
      best.s = s0 + t * len;
      best.level = lane.levels[i] + (lane.levels[i + 1] - lane.levels[i]) * t;
      // Which side of the lane the point lies on, as `lanePoint` numbers them.
      best.side = -dx * (b.z - a.z) + dz * (b.x - a.x) >= 0 ? 1 : -1;
    }
  });
  return best;
}

/** A point of a lane, `s` metres along it: where it is, which way it runs, and the level of its paving. */
export function lanePoint(lane, s) {
  let i = lane.segs.findIndex((g) => s <= g.s0 + g.len);
  if (i < 0) i = lane.segs.length - 1;
  const { a, b, len, s0 } = lane.segs[i];
  const t = Math.min(1, Math.max(0, (s - s0) / len));
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len, level: lane.levels[i] + (lane.levels[i + 1] - lane.levels[i]) * t };
}

// Out in the bay, well off the shore, a rock stands alone in the sea: the lighthouse islet,
// steep-sided, its top a few metres above the waves, with a ledge in its lee for the landing.
export const ISLET = { u: -76, v: -110, r: 12, x: toX(-76, -110), z: toZ(-76, -110) };

/**
 * The main village climbs a steep hillside, as at Manarola: from the hollow of its harbour the
 * ground rises fast toward the mountain, whose flank takes over behind the last houses. On
 * the plain side it dies away to nothing, and it comes down to the shore in a steep bank
 * (`inland` is the distance from the water's edge there).
 */
function villageClimb(u, v, x, z, inland) {
  const port = zone('port');
  const band = smoothstep(0, 38, inland) * smoothstep(-6, -30, v);
  const up = smoothstep(50, 104, u + (fbm(x * 0.02 + 5, z * 0.02 - 3, 2) - 0.5) * 12);
  const hollow = smoothstep(6, 40, Math.hypot(u - port.u, v - port.v));
  return 28 * up * band * hollow * smoothstep(215, 150, u);
}

// The observatory stands on the summit, on a round terrace cut level into the crest.
export const OBSERVATORY = { u: 166, v: 94, r: 8.5, x: toX(166, 94), z: toZ(166, 94) };
// A lower terrace a flight of steps down from the upper one, on the gentler side of the summit.
OBSERVATORY.lower = { dx: -13.4, dz: 13.4, r: 5.5, drop: 4.2 };

// Footpaths: from the agora to each work area, then the road from the library that comes into
// the main village at the near end of its sea front.
const GATE = (([u, v]) => ({ x: toX(u, v), z: toZ(u, v) }))(VILLAGES[0].lanes[0].points[0]);
export const PATHS = [...ZONES.slice(1, -1).map((z) => [0, 0, z.x, z.z]), [zone('library').x, zone('library').z, GATE.x, GATE.z]];

// The wine estate on the mountain side, left of the railway: vineyards planted on irregular
// terraces, right up to the edge of the village.
export const ESTATE = { u: 84, v: 12, r: 30 };
export const estateWeight = (u, v) => smoothstep(ESTATE.r + 8, ESTATE.r - 4, Math.hypot(u - ESTATE.u, v - ESTATE.v));
/** Built sites kept clear of wild growth ({ x, z, r }); builders add their own. */
export const CLEARINGS = [{ x: OBSERVATORY.x, z: OBSERVATORY.z, r: OBSERVATORY.r + 4 }, { x: OBSERVATORY.x + OBSERVATORY.lower.dx, z: OBSERVATORY.z + OBSERVATORY.lower.dz, r: OBSERVATORY.lower.r + 3 }, { x: ISLET.x, z: ISLET.z, r: 8 }];

// The railway crosses the angle between the mountain (a) and the right-hand ridge (b) at a
// constant level, high enough that its station stands out on the flank, a little way from the
// first tunnel, on a shelf banked up against the slope:
// `s` runs along the line from a, `l` across it (negative uphill).
export const RAIL = { a: { u: 129, v: 25 }, b: { u: 45, v: 106 }, level: 56 };
// The yard runs deep enough behind the line for a passenger building at the avatar's scale.
export const STATION = { s0: 24, s1: 49, yard: { s0: 24, s1: 43, l0: -15.5, l1: -3.5 } };
const railStart = { x: toX(RAIL.a.u, RAIL.a.v), z: toZ(RAIL.a.u, RAIL.a.v) };
const railEnd = { x: toX(RAIL.b.u, RAIL.b.v), z: toZ(RAIL.b.u, RAIL.b.v) };
const railLength = Math.hypot(railEnd.x - railStart.x, railEnd.z - railStart.z);
const railDir = { x: (railEnd.x - railStart.x) / railLength, z: (railEnd.z - railStart.z) / railLength };
const RAIL_LINE = [railStart.x, railStart.z, railEnd.x, railEnd.z];
/** World position of a point given along (s) and across (l) the line. */
export const railPoint = (s, l = 0) => ({ x: railStart.x + railDir.x * s - railDir.z * l, z: railStart.z + railDir.z * s + railDir.x * l });
/** A point given along (s) and across (l) the line. */
const railCoords = (x, z) => ({ s: (x - railStart.x) * railDir.x + (z - railStart.z) * railDir.z, l: -(x - railStart.x) * railDir.z + (z - railStart.z) * railDir.x });
/** How much a point lies within an area of the station given along and across the line. */
function stationArea(x, z, y) {
  const { s, l } = railCoords(x, z);
  return smoothstep(y.s0 - 2.5, y.s0, s) * smoothstep(y.s1 + 2.5, y.s1, s) * smoothstep(y.l0 - 2.5, y.l0, l) * smoothstep(y.l1 + 2, y.l1, l);
}
// Before the station the line runs in a short rock cutting, and then into a spur of the
// mountain thrown across it, so that the train has a hill to go into: the first tunnel's mouth
// is where the cutting ends and the spur begins, a few metres short of the platform.
// The spur's flanks fall gently enough for grass and scrub to hold, except the face the train
// goes into, which stands up steeply behind the headwall.
export const SPUR_END = STATION.s0 - 10;
export const CUTTING = { s0: SPUR_END, s1: STATION.s0 + 2, l0: -3.6, l1: 3.2 };
export function spurAt(x, z) {
  const { s, l } = railCoords(x, z);
  // Away from the line, on the village side, the front of the spur falls away slowly instead
  // of dropping into the hollow: a long bank the vines are terraced on (see `cultivated`).
  const gentle = l > 0 ? smoothstep(5, 14, l) * 30 : 0;
  return smoothstep(SPUR_END - 1 + gentle, SPUR_END - 7, s) * smoothstep(SPUR_END - 38, SPUR_END - 22, s) * smoothstep(l > 0 ? 38 : 27, 8, Math.abs(l));
}
/** The bank below the railway cutting, on the village side: terraced and planted with vines. */
export function bankAt(x, z) {
  const { s, l } = railCoords(x, z);
  return smoothstep(SPUR_END - 10, SPUR_END - 4, s) * smoothstep(SPUR_END + 32, SPUR_END + 24, s) * smoothstep(4, 9, l) * smoothstep(40, 32, l);
}
for (const s of [4, 11, 18]) CLEARINGS.push({ ...railPoint(STATION.s0 + s, -8), r: 8 });
// Nothing grows against the tunnel's headwall and its mound, nor in the cutting before the
// station; the rest of the spur is wild, and a grove stands over the tunnel (see nature.js).
for (const [s, r] of [[SPUR_END - 2, 7], [SPUR_END + 10, 6]]) CLEARINGS.push({ ...railPoint(s, 0), r });

// A single-file trail leaves the observatory's lower terrace by the gap in its parapet and
// winds down the mountainside in two long S-bends to the back of the station: a bare metre of
// packed earth, wide enough for one walker.
const TRAIL = (() => {
  const from = { x: OBSERVATORY.x + OBSERVATORY.lower.dx, z: OBSERVATORY.z + OBSERVATORY.lower.dz + OBSERVATORY.lower.r + 1.5 };
  const to = railPoint(STATION.s0 + 12, -15.5);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  const nx = -dz / len;
  const nz = dx / len;
  const points = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const swing = Math.sin(t * Math.PI * 2) * len * 0.2 * Math.sin(t * Math.PI) ** 0.3;
    points.push([from.x + dx * t + nx * swing, from.z + dz * t + nz * swing]);
  }
  return points;
})();
/** The trail as segments [x0, z0, x1, z1]. */
export const TRAILS = TRAIL.slice(1).map(([x, z], i) => [...TRAIL[i], x, z]);

// A goat track, half the width of the trail: it leaves the upper terrace of the observatory by
// a gap on its right, picks its way down the summit cone in short zigzags, then wanders left
// across the whole face of the mountain above the railway and gives out in the grass over the
// tunnel. Between its marks it is pushed a little off the straight line, as a path worn by
// feet always is.
const TRACK = (() => {
  const marks = [[167.5, 104], [163, 108], [159, 103], [155, 107], [151, 101], [147, 105], [143, 100], [138, 92], [134, 80], [131, 68], [129, 56], [127, 44], [125, 34]];
  const points = [];
  marks.forEach(([u, v], i) => {
    if (i === 0) return points.push([toX(u, v), toZ(u, v)]);
    const [pu, pv] = marks[i - 1];
    const du = u - pu;
    const dv = v - pv;
    const len = Math.hypot(du, dv);
    for (let k = 1; k <= 3; k++) {
      const t = k / 3;
      const wobble = k < 3 ? (hash(i * 7 + k, 13) - 0.5) * 2.4 : 0;
      points.push([toX(pu + du * t - (dv / len) * wobble, pv + dv * t + (du / len) * wobble), toZ(pu + du * t - (dv / len) * wobble, pv + dv * t + (du / len) * wobble)]);
    }
  });
  return points;
})();
/** The goat track as segments [x0, z0, x1, z1]. */
export const TRACKS = TRACK.slice(1).map(([x, z], i) => [...TRACK[i], x, z]);

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
  let worked = Math.max(heart, patches, estateWeight(u, v), bankAt(toX(u, v), toZ(u, v)));
  for (const village of VILLAGES) worked = Math.max(worked, smoothstep(village.r + 12, village.r + 2, Math.hypot((u - village.u) / (village.up ?? 1), v - village.v)));
  return worked;
}



/** The lie of the land. */
function landAt(x, z) {
  const u = toU(x, z);
  const v = toV(x, z);
  let h = 0.7 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 2.2;
  // One mountain stands behind the bay, as steep as the Ligurian coast. Its summit is over on
  // the right, above the station, and from there one long even flank runs down leftward all
  // the way to the sea, while its back falls to the far shore.
  const foot = footU(v, u);
  const flank = smoothstep(-124, 112, v + (fbm(u * 0.02 + 3, 1.7, 2) - 0.5) * 20) ** 0.7;
  const across = smoothstep(foot - 10, foot + 95, u) * smoothstep(240, 185, u);
  const back = 78 * flank * across + (fbm(x * 0.015, z * 0.015, 3) - 0.5) * 12 * smoothstep(0, 20, 78 * flank * across) + Math.max(0, u - foot) * 0.05;
  // On the right a tall ridge comes down from the summit and plunges into the sea, closing the bay.
  const ridge = headland(v) * (22 + smoothstep(-110, 70, u) * 48 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 10);
  // On its far sides — to the left, behind and to the right — the mountain comes down to the
  // sea in long slopes rather than cliffs: `inland` is how far a point lies from those shores.
  const inland = Math.min(v - leftShore(u), farShore(v) - u, (rightShore(u) - v) * 3);
  const ease = smoothstep(-4, 64, inland + (fbm(x * 0.02 + 9, z * 0.02, 2) - 0.5) * 18);
  const mountain = Math.max(back, ridge) * ease + villageClimb(u, v, x, z, inland);
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
  // Past the water's edge of those far shores the bed shelves away very gently, so the sea
  // stays shallow and turquoise a long way out. (They are only shores landward of the bay.)
  const bay = coast - farLeft(v + wander(u)) * 260;
  const shore = smoothstep(bay - 8, bay + 40, u);
  h += (Math.max(-9.5, WATER_LEVEL - 0.1 + inland * 0.14) - h) * smoothstep(4, -4, inland) * shore;
  // Terraces: shelves and short dry-stone walls where the land is worked, and on the plain.
  // The shelves follow the lie of the land rather than level lines. The wild slopes keep their
  // fall, only eased here and there into natural benches.
  const step = 2.4;
  const shift = estate > 0 ? plotShift(u, v) * step * estate : 0;
  const drift = (fbm(x * 0.035 + 7, z * 0.035 + 1, 2) - 0.5) * 5 * lift * (1 - estate);
  const level = h + shift + drift;
  const shelf = Math.floor(level / step) * step;
  const terraced = shelf + smoothstep(0.72, 1, (level - shelf) / step) * step - shift - drift;
  const benches = smoothstep(0.45, 0.7, fbm(x * 0.02 - 3, z * 0.02 + 8, 2)) * 0.45;
  h += (terraced - h) * Math.max(worked, smoothstep(3, 0.5, mountain), benches);
  // The beach: a smooth gentle slope down into turquoise shallows, no terraces.
  const beach = beachBand(v) * smoothstep(coast + 14, coast + 8, u) * smoothstep(coast - 5, coast + 1, u);
  h += (WATER_LEVEL + 0.25 + Math.max(0, u - coast) * 0.08 - h) * beach;
  // Along those shores lie beaches of white sand, one cove after another, except under the
  // main village, whose houses stand with their feet in the water.
  const strand = shore * smoothstep(0.4, 0.48, fbm(u * 0.022 + 31, v * 0.022 - 17, 2)) * smoothstep(44, 62, Math.hypot(u - VILLAGES[0].u, v - VILLAGES[0].v + 14));
  h += (WATER_LEVEL + 0.3 + inland * 0.1 - h) * strand * smoothstep(-1, 1, inland) * smoothstep(16, 9, inland);
  // The lighthouse islet rises out of the sea bed, its lee ledge level just above the water.
  const rock = Math.hypot(u - ISLET.u, v - ISLET.v) + (fbm(x * 0.08 + 3, z * 0.08 - 6, 2) - 0.5) * 4;
  const isletTop = 4.2 + (fbm(x * 0.15, z * 0.15 + 8, 2) - 0.5) * 1.6;
  h += (isletTop - h) * smoothstep(ISLET.r, ISLET.r * 0.45, rock);
  h += (WATER_LEVEL + 0.7 - h) * smoothstep(5, 2.5, Math.hypot(u - ISLET.u - 7, v - ISLET.v));
  // The village streets are cut level into the hillside: each lane a shelf along the contours,
  // each stair an even ramp, with a short shoulder up or down to the natural ground on either
  // side; the squares are levelled whole. Off the quay the bed is dug out so the water laps
  // at its wall.
  // Where two cuts overlap, the one the point lies most squarely in wins: a stair leaving a
  // square keeps its treads instead of being levelled away by the square's skirt, and the
  // square itself stays level wall to wall.
  const streets = villagePlan();
  if (streets) {
    const cuts = [];
    for (const pz of streets.piazzas) {
      const w = smoothstep(pz.r + 3, pz.r + 0.5, Math.hypot(x - pz.x, z - pz.z));
      if (w > 0) cuts.push([pz.level, w, w > 0.999 ? 2 : w]);
    }
    let dredge = Infinity;
    for (const lane of streets.lanes) {
      const near = laneAt(lane, x, z);
      const sea = lane.quay && near.side === lane.seaSide;
      const flat = lane.half + (sea ? lane.quay : 0);
      if (near.d < flat + 1.5) {
        // A lane keeps its own paving where a stair arrives on it or leaves it.
        const w = smoothstep(flat + 1.5, flat + 0.4, near.d);
        cuts.push([near.level, w, w > 0.999 && !lane.stair && near.d < flat ? 1.5 : w]);
      }
      // The water laps at the face of the quay wall (half a metre out from its edge): the bed is dug out right from its foot.
      if (sea && near.d > flat - 0.1 && near.d < flat + 9) dredge = Math.min(dredge, near.level + (WATER_LEVEL - 1.6 - near.level) * smoothstep(flat - 0.1, flat + 0.6, near.d));
    }
    cuts.sort((a, b) => a[2] - b[2]);
    for (const [level, w] of cuts) h += (level - h) * w;
    h = Math.min(h, dredge);
  }
  // Work areas sit on level pads.
  for (const zn of ZONES) if (zn.id !== 'port') h += (0 - h) * smoothstep(zn.r + 7, zn.r + 1, Math.hypot(x - zn.x, z - zn.z));
  const summit = summitLevel();
  if (summit > -Infinity) {
    h += (summit - h) * smoothstep(OBSERVATORY.r + 6, OBSERVATORY.r + 1, Math.hypot(x - OBSERVATORY.x, z - OBSERVATORY.z));
    const low = OBSERVATORY.lower;
    h += (summit - low.drop - h) * smoothstep(low.r + 4, low.r + 0.8, Math.hypot(x - OBSERVATORY.x - low.dx, z - OBSERVATORY.z - low.dz));
  }
  h += (RAIL.level - 0.05 - h) * stationArea(x, z, STATION.yard);
  h -= Math.max(0, h - (RAIL.level - 0.3)) * stationArea(x, z, CUTTING);
  h += Math.max(0, RAIL.level + 9 + (fbm(x * 0.05 + 4, z * 0.05 - 9, 2) - 0.5) * 4 - h) * spurAt(x, z);
  // On the open sides the land has sunk under the sea before the bounds of the map.
  const brink = Math.min(u - SQUARE.u0, v - SQUARE.v0) + (fbm(x * 0.05 + 8, z * 0.05, 2) - 0.5) * 8;
  return h + (-12 - h) * smoothstep(11, 2, brink);
}

/** The mountain as it stands, uncut: the land with the brow of rock round the second tunnel on it. */
export function rockAt(x, z) {
  let h = landAt(x, z);
  const brow = browAt(x, z);
  if (brow) h += Math.max(0, brow.top - h) * brow.w;
  return h;
}

export function heightAt(x, z) {
  const h = rockAt(x, z);
  return h - Math.max(0, h - (RAIL.level - 0.3)) * boreAt(x, z);
}

// The level of the observatory terrace: the lie of the crest where it stands, measured once.
let summit;
function summitLevel() {
  if (summit === undefined) {
    summit = -Infinity;
    summit = landAt(OBSERVATORY.x, OBSERVATORY.z) + 0.3;
  }
  return summit;
}

// The tunnels: the hill closes over the line where the ground rises above the rails, on either
// side of the station. From each mouth the line is bored `BORE` metres on into the hill, so the
// rails can be seen running into the dark; railway.js lines the bore and roofs it over, and
// nothing of the cut shows from above.
export const BORE = 5;
const railGround = (s) => {
  const p = railPoint(s, 0);
  return landAt(p.x, p.z);
};
export const RAIL_MOUTHS = (() => {
  let a = STATION.s0;
  while (a > -60 && railGround(a - 0.5) < RAIL.level + 0.3) a -= 0.5;
  let b = railLength;
  while (b > a && railGround(b) > RAIL.level + 0.3) b -= 0.5;
  return { a, b };
})();
// The second tunnel goes into the ridge where its flank falls steeply across the line, so the
// hill closes over the rails on the uphill side only. There the portal is cut square into a
// brow of rock: the cliff stands round its headwall and climbs on over it to the ridge, so the
// rails run under the mountain and into the dark; in front, a spur of rock falls from under
// its foot to the last pier of the viaduct, carrying the end of the deck. The heightfield
// cannot overhang, so the bore is a cut in it (`boreAt`) and the rock over the bore is a
// separate piece of ground laid over the cut (`buildPortalRock`).
// `half` the width of the headwall, `top` its height over the rails, `back` how far the bore
// runs in from the mouth.
export const PORTAL = { half: 5.5, top: 7.6, back: 6 };
// Nothing grows out of the headwall; the brow behind it is left to the maquis.
CLEARINGS.push({ ...railPoint(RAIL_MOUTHS.b + 2, 0), r: 7 });
function browAt(x, z) {
  const { s, l } = railCoords(x, z);
  const P = RAIL_MOUTHS.b;
  if (s < P - 24 || s > P + 34 || l < -20 || l > 18) return null;
  const n = fbm(x * 0.09 + 2, z * 0.09 - 7, 2) - 0.5;
  const m = (fbm(x * 0.04 - 5, z * 0.04 + 11, 2) - 0.5) * 2;
  const W = PORTAL.half;
  // The ridge the brow climbs to, rounding off toward the sea instead of standing up as a wall.
  const ridge = RAIL.level + 12.5 + (s - P) * 0.3 + n * 3 + (fbm(x * 0.3 - 1, z * 0.3 + 4, 2) - 0.5) * 4 - Math.max(0, l - W - 2.5) * (3.0 + m);
  // The spur under the headwall: a crest just under the deck, falling off to either side and,
  // toward the viaduct, down the hollow to the foot of its last pier.
  const foot = RAIL.level - 1.3 - Math.max(0, Math.abs(l) - 1.2) * 2.5 + n * 0.8 - Math.max(0, P - 1.5 - s) * 1.6;
  // Over the headwall the rock stands on its cornice as a wall up to the ridge; beside it
  // the cliff runs on in the line of the face, raggedly, wrapping round the jambs.
  const outer = smoothstep(W + 0.4, W + 1.4, Math.abs(l));
  const over = Math.min(ridge, RAIL.level + PORTAL.top - 0.2 + Math.max(0, s - P - 1.0) * (6 + n * 2));
  const inner = foot + (over - foot) * smoothstep(P + 0.6, P + 1.2, s);
  const face = P - 1.4 + n * 2.4 + m * 1.4;
  const cliff = foot + (ridge - foot) * smoothstep(face, face + 0.8, s);
  const w = smoothstep(P + 32, P + 16, s) * (l > 0 ? smoothstep(W + 8 + m * 2, W + 4.5 + m * 1.5, l) : smoothstep(W + 12, W + 6, -l));
  return { top: inner + (cliff - inner) * outer, w };
}
function boreAt(x, z) {
  const { s, l } = railCoords(x, z);
  const { a, b } = RAIL_MOUTHS;
  const first = smoothstep(a + 1.5, a + 0.5, s) * smoothstep(a - BORE - 1, a - BORE, s);
  // The second bore is cut from the face to a little past the dark back wall of the bore
  // (railway.js), so that the floor of the cut rises again only where that wall hides it.
  const second = smoothstep(b - 0.2, b + 0.6, s) * smoothstep(b + PORTAL.back + 2.5, b + PORTAL.back + 1.5, s);
  return Math.max(first * smoothstep(3.9, 3.1, Math.abs(l)), second * smoothstep(PORTAL.half - 0.3, PORTAL.half - 1.1, Math.abs(l)));
}
// The heightfield everything else reads: the land inside the bounds, open sea beyond them.
export const GRID = new Float32Array((SEGMENTS + 1) ** 2);
for (let iz = 0; iz <= SEGMENTS; iz++) {
  for (let ix = 0; ix <= SEGMENTS; ix++) {
    const x = ix * CELL - HALF;
    const z = iz * CELL - HALF;
    GRID[iz * (SEGMENTS + 1) + ix] = inSquare(x, z, -1.5) ? Math.max(SEA_FLOOR, heightAt(x, z)) : SEA_FLOOR;
  }
}
shelveShores();
// The ground as the shader reads it: the mountain as it stands, uncut by the bores, which are
// roofed over (the first by its mound, the second by `buildPortalRock`), so the rock laid over
// them is painted as the cliff it continues and not as a thing standing in a trench.
export const SKIN = GRID.slice();
for (let iz = 0; iz <= SEGMENTS; iz++) {
  for (let ix = 0; ix <= SEGMENTS; ix++) {
    const x = ix * CELL - HALF;
    const z = iz * CELL - HALF;
    if (inSquare(x, z, -1.5) && boreAt(x, z) > 0) SKIN[iz * (SEGMENTS + 1) + ix] = Math.max(SEA_FLOOR, rockAt(x, z));
  }
}

// The railway, wherever it runs at or within a tree's height over the ground: nothing grows
// up through the line or the deck of the viaduct.
for (let s = CUTTING.s0 - 4; s < railLength; s += 2) {
  const p = railPoint(s, 0);
  const ground = groundAt(p.x, p.z);
  if (ground > RAIL.level - 13 && ground < RAIL.level + 2) occupy(p.x, p.z, Math.atan2(-railDir.z, railDir.x), 1.2, 3.5);
}

/**
 * Off every shore the sea bed shelves away gently, so the water stays turquoise a long way out
 * along the beach and around the harbour, and only darkens to blue in the offing. Under the
 * cliffs of the headlands the bottom drops away at once and the sea is deep at their feet.
 */
function shelveShores() {
  const row = SEGMENTS + 1;
  // How far each cell of the sea lies from the nearest land, by a two-pass chamfer sweep.
  const away = new Float32Array(GRID.length);
  for (let i = 0; i < GRID.length; i++) away[i] = GRID[i] > WATER_LEVEL ? 0 : 1e4;
  const sweep = (iz, ix, dz, dx) => {
    const i = iz * row + ix;
    const near = (jz, jx, cost) => {
      if (jz >= 0 && jz < row && jx >= 0 && jx < row) away[i] = Math.min(away[i], away[jz * row + jx] + cost);
    };
    near(iz, ix - dx, CELL);
    near(iz - dz, ix, CELL);
    near(iz - dz, ix - dx, CELL * Math.SQRT2);
    near(iz - dz, ix + dx, CELL * Math.SQRT2);
  };
  for (let iz = 0; iz < row; iz++) for (let ix = 0; ix < row; ix++) sweep(iz, ix, 1, 1);
  for (let iz = row - 1; iz >= 0; iz--) for (let ix = row - 1; ix >= 0; ix--) sweep(iz, ix, -1, -1);
  for (let iz = 0; iz < row; iz++) {
    for (let ix = 0; ix < row; ix++) {
      const i = iz * row + ix;
      if (away[i] === 0) continue;
      const x = ix * CELL - HALF;
      const z = iz * CELL - HALF;
      if (!inSquare(x, z, -1.5)) continue;
      // How far out the shelf runs is no plain function of the distance from the shore: seen
      // from the air, the edge of the sand meanders, tongues of shallows reach out and fingers
      // of deep water come in, and the whole thing wanders over a few hundred metres.
      const wander = (fbm(x * 0.011 + 23, z * 0.011 - 11, 3) - 0.5) * 95 + (fbm(x * 0.045 - 8, z * 0.045 + 4, 2) - 0.5) * 20;
      const reach = Math.max(away[i] * 0.35, away[i] + wander);
      let fall = 0.06 + headland(toV(x, z)) * 0.5;
      // The harbour lies in the shallowest water of all, and the lighthouse rock stands on a
      // shoal of its own, pale water all round it.
      fall *= 1 - 0.4 * smoothstep(90, 30, Math.hypot(x - zone('port').x, z - zone('port').z));
      fall *= 1 - 0.5 * smoothstep(40, 12, Math.hypot(x - ISLET.x, z - ISLET.z));
      const depth = reach * fall;
      // Sand banks lie across the shelf, the water palest over them.
      const bank = smoothstep(0.57, 0.68, fbm(x * 0.035 + 41, z * 0.035 - 2, 2)) * 1.4 * smoothstep(0.8, 2.5, depth) * smoothstep(12, 2, depth);
      // Toward the open edges of the map the bed dives to the deep, so the water darkens
      // before the grid ends instead of stepping down at its last cell; the dive begins a
      // long way out and wanders, so that no straight line shows where it starts.
      const brink = Math.min(toU(x, z) - SQUARE.u0, toV(x, z) - SQUARE.v0) + (fbm(x * 0.03 + 5, z * 0.03 + 9, 2) - 0.5) * 30;
      GRID[i] = Math.max(GRID[i], WATER_LEVEL - 0.5 - depth + bank - 10 * smoothstep(44, 4, brink));
    }
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


/** True inside the bounds of the map, at least `margin` from its edges. */
export function inSquare(x, z, margin = 0) {
  const u = toU(x, z);
  const v = toV(x, z);
  return u > SQUARE.u0 + margin && u < SQUARE.u1 - margin && v > SQUARE.v0 + margin && v < SQUARE.v1 - margin;
}

/** True where things may grow or be built: off the work pads, the paths and the clearings, above `floor`. */
export function isWild(x, z, margin = 0, floor = WATER_LEVEL + 0.4) {
  if (!inSquare(x, z, 2)) return false;
  if (groundAt(x, z) < floor) return false;
  for (const zn of ZONES) if (Math.hypot(x - zn.x, z - zn.z) < zn.r + 3 + margin) return false;
  for (const p of PATHS) if (segmentDistance(x, z, p) < 2.6 + margin) return false;
  for (const t of TRAILS) if (segmentDistance(x, z, t) < 1.1 + Math.max(0, margin)) return false;
  for (const t of TRACKS) if (segmentDistance(x, z, t) < 0.6 + Math.max(0, margin)) return false;
  for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return false;
  const built = builtAt(x, z);
  if (built === 2 || (built === 1 && margin >= 0)) return false;
  const streets = villagePlan();
  if (streets) {
    for (const lane of streets.lanes) if (laneAt(lane, x, z).d < lane.half + (lane.quay ?? 0) + 0.8 + Math.max(0, margin)) return false;
    for (const pz of streets.piazzas) if (Math.hypot(x - pz.x, z - pz.z) < pz.r + 1 + Math.max(0, margin)) return false;
  }
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
  const village = new Float32Array(pos.count);
  const main = VILLAGES[0];
  for (let iu = 0; iu <= nu; iu++) {
    for (let iv = 0; iv <= nv; iv++) {
      const i = iu * (nv + 1) + iv;
      const x = toX(u0 + iu, v0 + iv);
      const z = toZ(u0 + iu, v0 + iv);
      pos.setXYZ(i, x, groundAt(x, z), z);
      worked[i] = cultivated(u0 + iu, v0 + iv);
      village[i] = smoothstep(main.r + 6, main.r + 2, Math.hypot((u0 + iu - main.u) / main.up, v0 + iv - main.v));
    }
  }
  // Tells the built terrace walls from the living rock, and the walls of the village streets.
  geo.setAttribute('aTerrace', new THREE.BufferAttribute(worked, 1));
  geo.setAttribute('aVillage', new THREE.BufferAttribute(village, 1));
  const group = new THREE.Group();
  group.add(groundMesh(geo), buildPortalRock());
  return group;
}

/** A piece of ground drawn as the terrain, its triangles turned to face up. */
function groundMesh(geo) {
  const pos = geo.attributes.position;
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
 * The mountain over the second tunnel. The heightfield cannot overhang, so its bore is a cut
 * open to the sky; this piece of ground, the rock as it stands uncut (`rockAt`), is laid over
 * the cut from the top of the headwall to past the back of the bore. Its edges are sunk a
 * little under the ground round it, so that no seam opens, and it is drawn with the terrain's
 * shader, which reads the uncut ground (`SKIN`) and so paints it as the cliff it continues.
 */
function buildPortalRock() {
  const { half: W, top: TOP, back: BACK } = PORTAL;
  const STEP = 0.5;
  const across = Math.round((2 * W + 3) / STEP) + 1;
  const along = Math.round((BACK + 3) / STEP) + 1;
  const geo = new THREE.PlaneGeometry(1, 1, across - 1, along - 1);
  const pos = geo.attributes.position;
  for (let r = 0; r < along; r++) {
    for (let j = 0; j < across; j++) {
      const p = railPoint(RAIL_MOUTHS.b + 1.0 + r * STEP, -W - 1.5 + j * STEP);
      // The front row rests in the top of the headwall; the rock climbs from there.
      let y = r === 0 ? RAIL.level + TOP - 0.2 : rockAt(p.x, p.z);
      if (r === along - 1 || j === 0 || j === across - 1) y -= 0.3;
      pos.setXYZ(r * across + j, p.x, y, p.z);
    }
  }
  geo.setAttribute('aTerrace', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  geo.setAttribute('aVillage', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  return groundMesh(geo);
}
const FAR = 2400;
// The two cut edges of the tile, each as a run of points from the far-off open sea to the back
// corner: the back edge (u = u1) and the right edge (v = v1).
const CUTS = [
  { from: SQUARE.v0, to: SQUARE.v1, at: (s) => ({ x: toX(SQUARE.u1, s), z: toZ(SQUARE.u1, s) }) },
  { from: SQUARE.u0, to: SQUARE.u1, at: (s) => ({ x: toX(s, SQUARE.v1), z: toZ(s, SQUARE.v1) }) },
];
const wall = (out, p0, p1, lo0, lo1, hi0, hi1) => out.push(p0.x, lo0, p0.z, p1.x, lo1, p1.z, p1.x, hi1, p1.z, p0.x, lo0, p0.z, p1.x, hi1, p1.z, p0.x, hi0, p0.z);
function walls(data, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** The cut faces of the tile: the earth in section, from the base up to the ground. */
export function buildSides() {
  const earth = [];
  for (const cut of CUTS) {
    wall(earth, cut.at(-FAR), cut.at(cut.from), BASE_Y, BASE_Y, SEA_FLOOR, SEA_FLOOR);
    for (let s = cut.from; s < cut.to; s++) {
      const p0 = cut.at(s);
      const p1 = cut.at(s + 1);
      wall(earth, p0, p1, BASE_Y, BASE_Y, groundAt(p0.x, p0.z), groundAt(p1.x, p1.z));
    }
  }
  return walls(earth, paint(0xffffff, { terrain: true, doubleSide: true }));
}

/**
 * The sea. In front and to the left it has no edge: it runs out to a horizon that the view sets
 * for itself (see `uHorizon`). Behind and on the right it is cut with the tile, and shows in
 * section there, paler near the surface and deep blue below.
 */
export function buildWater() {
  const group = new THREE.Group();
  const corners = [[-FAR, -FAR], [-FAR, SQUARE.v1], [SQUARE.u1, SQUARE.v1], [SQUARE.u1, -FAR]].map(([u, v]) => [toX(u, v), WATER_LEVEL, toZ(u, v)]);
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap((i) => corners[i]), 3));
  surface.computeVertexNormals();
  const top = new THREE.Mesh(surface, paint(0xffffff, { water: true, doubleSide: true }));
  top.receiveShadow = true;
  group.add(top);

  const shallow = [];
  const deep = [];
  const band = 1.4;
  const section = (p0, p1, bed0, bed1) => {
    if (bed0 >= WATER_LEVEL && bed1 >= WATER_LEVEL) return;
    const [b0, b1] = [Math.min(bed0, WATER_LEVEL), Math.min(bed1, WATER_LEVEL)];
    const [m0, m1] = [Math.max(b0, WATER_LEVEL - band), Math.max(b1, WATER_LEVEL - band)];
    wall(deep, p0, p1, b0, b1, m0, m1);
    wall(shallow, p0, p1, m0, m1, WATER_LEVEL, WATER_LEVEL);
  };
  for (const cut of CUTS) {
    section(cut.at(-FAR), cut.at(cut.from), SEA_FLOOR, SEA_FLOOR);
    for (let s = cut.from; s < cut.to; s++) {
      const p0 = cut.at(s);
      const p1 = cut.at(s + 1);
      section(p0, p1, groundAt(p0.x, p0.z), groundAt(p1.x, p1.z));
    }
  }
  group.add(walls(shallow, paint(0x6cc0d6, { doubleSide: true })), walls(deep, paint(0x2f7cc0, { doubleSide: true })));
  return group;
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
  // Scattered over the island at random: the world lint (test/) checks where they landed.
  mesh.userData.scatter = true;
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


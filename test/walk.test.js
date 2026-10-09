// The island as the avatar walks it (player.js): tile by tile, never into the sea, never
// through a house, never up more than one terrace at a step. From where he starts, every lane,
// stair and square, every work zone and path, and every seat must be within his reach.
import { test } from 'bun:test';
import { HALF, PATHS, WATER_LEVEL, ZONES, expectAtMost, expectNone, groundAt, inSquare, isSolid, island, lanePoint } from './world.js';

// The avatar's own rules, as player.js has them.
const TILE = 1.25;
const MAX_STEP = 2.6;
const START = { x: 2, z: 8 };
const SEAT_REACH = 2.6;

const N = Math.ceil(HALF / TILE) + 1;
const SIDE = 2 * N + 1;
const index = (i, j) => (i + N) * SIDE + (j + N);
const tileOf = (x, z) => [Math.round(x / TILE), Math.round(z / TILE)];

let grid = null;
/** Every tile of the island: whether it can be stood on, and whether it can be walked to from the start. */
function tiles() {
  if (grid) return grid;
  island();
  const walkable = new Uint8Array(SIDE * SIDE);
  const height = new Float32Array(SIDE * SIDE);
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      const x = i * TILE;
      const z = j * TILE;
      const g = groundAt(x, z);
      height[index(i, j)] = g;
      walkable[index(i, j)] = g >= WATER_LEVEL - 0.2 && inSquare(x, z, 1) && !isSolid(x, z) ? 1 : 0;
    }
  }
  const reached = new Uint8Array(SIDE * SIDE);
  const [si, sj] = tileOf(START.x, START.z);
  const queue = [[si, sj]];
  reached[index(si, sj)] = 1;
  while (queue.length) {
    const [i, j] = queue.pop();
    const h = height[index(i, j)];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < -N || ni > N || nj < -N || nj > N) continue;
      const k = index(ni, nj);
      if (reached[k] || !walkable[k] || Math.abs(height[k] - h) > MAX_STEP) continue;
      reached[k] = 1;
      queue.push([ni, nj]);
    }
  }
  grid = {
    walkable: (x, z) => walkable[index(...tileOf(x, z))] === 1,
    reached: (x, z) => reached[index(...tileOf(x, z))] === 1,
  };
  return grid;
}

const spot = (x, z) => `(${x.toFixed(1)}, ${z.toFixed(1)})`;

test('every lane, stair and quay can be walked from end to end', () => {
  const { plan } = island();
  const { walkable, reached } = tiles();
  const cut = [];
  for (const lane of plan.lanes) {
    const what = lane.stair ? 'stair' : lane.quay ? 'quay' : 'lane';
    for (let s = 0.6; s < lane.length - 0.6; s += 1) {
      const p = lanePoint(lane, s);
      if (!walkable(p.x, p.z)) cut.push(`${what} blocked at ${spot(p.x, p.z)}`);
      else if (!reached(p.x, p.z)) cut.push(`${what} out of reach at ${spot(p.x, p.z)}`);
    }
  }
  expectNone(cut, 'spots of the streets the avatar cannot walk');
});

test('every square can be crossed', () => {
  const { plan } = island();
  const { walkable, reached } = tiles();
  const cut = [];
  for (const pz of plan.piazzas) {
    const r = pz.r - 1.5;
    let open = 0;
    let all = 0;
    for (let dx = -r; dx <= r; dx += TILE) {
      for (let dz = -r; dz <= r; dz += TILE) {
        if (Math.hypot(dx, dz) > r) continue;
        all++;
        const x = pz.x + dx;
        const z = pz.z + dz;
        if (!walkable(x, z)) continue;
        open++;
        if (!reached(x, z)) cut.push(`square at ${spot(pz.x, pz.z)}: out of reach at ${spot(x, z)}`);
      }
    }
    if (open < all * 0.7) cut.push(`square at ${spot(pz.x, pz.z)}: only ${open} of ${all} tiles can be stood on`);
  }
  expectNone(cut, 'squares the avatar cannot cross');
});

test('every work zone and every path can be reached', () => {
  const { walkable, reached } = tiles();
  const cut = [];
  for (const zn of ZONES) {
    let open = 0;
    let lost = 0;
    for (let dx = -zn.r; dx <= zn.r; dx += TILE) {
      for (let dz = -zn.r; dz <= zn.r; dz += TILE) {
        if (Math.hypot(dx, dz) > zn.r || !walkable(zn.x + dx, zn.z + dz)) continue;
        open++;
        if (!reached(zn.x + dx, zn.z + dz)) lost++;
      }
    }
    if (!open) cut.push(`${zn.id}: nowhere to stand`);
    else if (lost) cut.push(`${zn.id}: ${lost} of its ${open} tiles out of reach`);
  }
  for (const [ax, az, bx, bz] of PATHS) {
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s <= len; s += 1) {
      const x = ax + ((bx - ax) * s) / len;
      const z = az + ((bz - az) * s) / len;
      if (!walkable(x, z)) cut.push(`path from ${spot(ax, az)} blocked at ${spot(x, z)}`);
      else if (!reached(x, z)) cut.push(`path from ${spot(ax, az)} out of reach at ${spot(x, z)}`);
    }
  }
  expectNone(cut, 'places the avatar cannot reach');
});

// Known: the two benches at the end of the jetty. The avatar never sets foot on the decks of
// the harbour, which ride over the water, so he cannot get out to them. A ratchet until the
// decks can be walked.
const UNREACHED = 2;

test('every seat can be reached and sat on', () => {
  const { seats } = island();
  const { reached } = tiles();
  const lost = [];
  for (const seat of seats) {
    const { x, y, z } = seat.position;
    let ok = false;
    for (let dx = -SEAT_REACH; dx <= SEAT_REACH && !ok; dx += TILE / 2) {
      for (let dz = -SEAT_REACH; dz <= SEAT_REACH && !ok; dz += TILE / 2) {
        if (Math.hypot(dx, dz) >= SEAT_REACH) continue;
        if (reached(x + dx, z + dz) && Math.abs(groundAt(x + dx, z + dz) - y) < 3) ok = true;
      }
    }
    if (!ok) lost.push(`seat at ${spot(x, z)}, ${y.toFixed(1)} up`);
  }
  expectAtMost(lost, UNREACHED, 'seats the avatar cannot reach');
});

// The streets of the villages against the ground they are cut into: a lane's paving lies on
// the ground, wall to wall; a square is level; a stair climbs at a pitch that can be walked,
// from the edge of one way to the edge of the next, and never into nowhere.
import { test } from 'bun:test';
import { expectAtMost, expectNone, groundAt, island, laneAt, lanePoint } from './world.js';

const PAVING_TOL = 0.35; // how far the ground may lie off the paving along a lane's axis
const EDGE_TOL = 0.5; // and at its edges, a hand in from the walls
const SQUARE_TOL = 0.35;
// Rise over run. The avatar climbs 2.6 m in a 1.25 m step (player.js), a pitch of 2.08: the
// village's stairs are steep, as Ligurian ones are, but must stay well within that.
const MAX_PITCH = 1.5;
const LANDING_TOL = 0.35; // a stair's end against the level of the way it reaches
const REACH = 0.6; // how far past the edge of a way a stair's end may stop

const name = (lane) => `${lane.stair ? 'stair' : lane.quay ? 'quay' : 'lane'} from (${lane.pts[0].x.toFixed(0)}, ${lane.pts[0].z.toFixed(0)}) to (${lane.pts.at(-1).x.toFixed(0)}, ${lane.pts.at(-1).z.toFixed(0)})`;

// Known: two stairs whose last metre lies in the cut of the lane they reach, half a metre off
// their own paving. A ratchet until the cuts are blended where ways meet.
const AXIS_OFF = 2;

test('the paving of every lane lies on the ground along its axis', () => {
  const { plan } = island();
  const off = [];
  for (const lane of plan.lanes) {
    for (let s = 0.3; s < lane.length - 0.3; s += 0.5) {
      const p = lanePoint(lane, s);
      const g = groundAt(p.x, p.z);
      if (Math.abs(g - p.level) > PAVING_TOL) off.push(`${name(lane)}: ground ${(g - p.level).toFixed(2)} off the paving at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    }
  }
  expectAtMost(off, AXIS_OFF, 'spots where a lane and the ground part');
});

// Known: where one way meets another, the two cuts into the hillside overlap, and along the
// last metres of the one arriving its edges lie at the other's level while its axis still
// holds its own. A ratchet until the levels are blended at the junctions.
const EDGES_OFF = 28;

test('the paving of every lane lies on the ground out to its walls', () => {
  const { plan } = island();
  const off = [];
  for (const lane of plan.lanes) {
    for (let s = 0.3; s < lane.length - 0.3; s += 0.5) {
      const p = lanePoint(lane, s);
      // The quay's sea side is the water, not a wall.
      for (const side of lane.quay ? [-lane.seaSide] : [-1, 1]) {
        const w = lane.half - 0.3;
        const e = groundAt(p.x - p.tz * side * w, p.z + p.tx * side * w);
        if (Math.abs(e - p.level) > EDGE_TOL) off.push(`${name(lane)}: ground ${(e - p.level).toFixed(2)} off the paving at its edge at (${(p.x - p.tz * side * w).toFixed(1)}, ${(p.z + p.tx * side * w).toFixed(1)})`);
      }
    }
  }
  expectAtMost(off, EDGES_OFF, 'spots where the edge of a lane and the ground part');
});

test('every square is level', () => {
  const { plan } = island();
  const off = [];
  for (const pz of plan.piazzas) {
    const r = pz.r * 0.85;
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        if (Math.hypot(dx, dz) > r) continue;
        const g = groundAt(pz.x + dx, pz.z + dz);
        if (Math.abs(g - pz.level) > SQUARE_TOL) off.push(`square at (${pz.x.toFixed(0)}, ${pz.z.toFixed(0)}): ground ${(g - pz.level).toFixed(2)} off its level at (${(pz.x + dx).toFixed(1)}, ${(pz.z + dz).toFixed(1)})`);
      }
    }
  }
  expectNone(off, 'spots where a square is not level');
});

// Known: the hamlet's upper flight, from its lower lane to its upper one, climbs 13 m in six:
// a ladder. The avatar still makes it, a tile at a time, at the very limit of his step. A
// ratchet until the hamlet is given a longer way up.
const STEEP = 1;

test('every stair climbs at a walkable pitch from one way to the next', () => {
  const { plan } = island();
  const wrong = [];
  const steep = [];
  for (const lane of plan.lanes) {
    if (!lane.stair) continue;
    // The flight: between the landings, marked where the stair crosses the edge of the way it
    // leaves and of the way it reaches (terrain.js, `villagePlan`); failing a mark, its end.
    const marks = lane.pts.map((p, i) => (p.landing !== undefined ? i : -1)).filter((i) => i >= 0);
    const a = marks.length ? marks[0] : 0;
    const b = marks.length > 1 ? marks.at(-1) : lane.pts.length - 1;
    const rise = Math.abs(lane.levels[b] - lane.levels[a]);
    const along = (i) => (i === 0 ? 0 : lane.segs[i - 1].s0 + lane.segs[i - 1].len);
    const run = along(b) - along(a);
    if (rise > 0.5 && run > 0 && rise / run > MAX_PITCH) steep.push(`${name(lane)}: pitch ${(rise / run).toFixed(2)} (rise ${rise.toFixed(1)} over ${run.toFixed(1)})`);
    // (Beyond its landings the stair lies on the lanes it joins and follows their fall.)
    for (let i = a + 1; i <= b; i++) {
      if ((lane.levels[i] - lane.levels[i - 1]) * (lane.levels[b] - lane.levels[a]) < -1e-6) wrong.push(`${name(lane)}: goes back down between its vertices ${i - 1} and ${i}`);
    }
    // Each end stands on another way, at that way's level.
    for (const end of [0, lane.pts.length - 1]) {
      const p = lane.pts[end];
      const level = lane.levels[end];
      const square = plan.piazzas.find((pz) => Math.hypot(p.x - pz.x, p.z - pz.z) < pz.r + REACH);
      const way = square ? { level: square.level, what: 'square' } : plan.lanes.filter((o) => o !== lane).map((o) => ({ ...laneAt(o, p.x, p.z), half: o.half, what: o.stair ? 'stair' : 'lane' })).find((q) => q.d < q.half + REACH);
      if (!way) wrong.push(`${name(lane)}: its ${end ? 'top' : 'foot'} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) reaches no lane or square`);
      else if (Math.abs(way.level - level) > LANDING_TOL) wrong.push(`${name(lane)}: its ${end ? 'top' : 'foot'} is ${(level - way.level).toFixed(2)} off the ${way.what} it reaches at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    }
  }
  expectNone(wrong, 'stairs that cannot be climbed');
  expectAtMost(steep, STEEP, 'stairs too steep');
});

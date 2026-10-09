// The ways stay open and the scattered things keep off the built ones: no wall across a lane
// or the foot of a stair, no tree or rock on a lane, in a square or inside a boat.
import { test } from 'bun:test';
import { Buckets, expectAtMost, expectNone, island, laneAt, overlapXZ } from './world.js';

const CLEAR_FROM = 0.5; // above the paving: a tread or a flag is lower
const CLEAR_TO = 2.2; // the height of a door
// The middle of a way must stay clear; along its edges stand its walls, and the benches and
// pots at the doors (at the village's scale, a metre deep). A lane keeps a clear way 2 m
// narrower than itself, a stair at least 0.9 m (village.js, `inWay`).
const clearHalf = (lane) => Math.max(0.45, lane.half - 1.0);
const STRUCTURAL = new Set(['box', 'drystone', 'cyl', 'pyramid', 'gable', 'cone', 'arch']);

const name = (lane) => `${lane.stair ? 'stair' : lane.quay ? 'quay' : 'lane'} from (${lane.pts[0].x.toFixed(0)}, ${lane.pts[0].z.toFixed(0)}) to (${lane.pts.at(-1).x.toFixed(0)}, ${lane.pts.at(-1).z.toFixed(0)})`;

// Known: where a stair lands on a lane beside the well square, the paving of the one is laid
// on the ground cut for the other, half a metre up; and a pot at a door on the church lane.
// A ratchet until the cuts are blended where ways meet (see test/ground, EDGES_OFF).
const ACROSS = 2;

test('no part of a village stands across a lane or a stair', () => {
  const { parts, plan } = island();
  const across = [];
  const THREE_HALF = Math.max(...plan.lanes.map((l) => l.half));
  const buckets = new Buckets(parts.filter((p) => STRUCTURAL.has(p.kind)), 3);
  for (const lane of plan.lanes) {
    const box = { min: { x: lane.box.x0 - THREE_HALF, z: lane.box.z0 - THREE_HALF }, max: { x: lane.box.x1 + THREE_HALF, z: lane.box.z1 + THREE_HALF } };
    for (const part of buckets.near(box)) {
      const cx = (part.box.min.x + part.box.max.x) / 2;
      const cz = (part.box.min.z + part.box.max.z) / 2;
      const q = laneAt(lane, cx, cz);
      if (q.d >= clearHalf(lane) || q.s < 0.3 || q.s > lane.length - 0.3) continue;
      if (part.box.min.y < q.level + CLEAR_TO && part.box.max.y > q.level + CLEAR_FROM) across.push(`${part.label} stands across the ${name(lane)}, ${(part.box.max.y - q.level).toFixed(1)} over its paving`);
    }
  }
  expectAtMost(across, ACROSS, 'parts standing across a way');
});

// What is too small to be seen inside something else: a pebble in a standing stone.
const NOTICED = 0.8;

test('nothing scattered lands on a way, in a square or inside something built', () => {
  const { scatter, props, plan } = island();
  const buckets = new Buckets(props);
  const wrong = [];
  for (const s of scatter) {
    const point = { min: { x: s.x, z: s.z }, max: { x: s.x, z: s.z } };
    if (s.height >= NOTICED) for (const prop of buckets.near(point)) {
      if (overlapXZ(prop.box, point, 0.3) && prop.box.min.y - 0.3 < s.y && prop.box.max.y > s.y + 0.3) {
        wrong.push(`${s.label} inside ${prop.label}`);
        break;
      }
    }
    for (const lane of plan.lanes) {
      if (laneAt(lane, s.x, s.z).d < lane.half + 0.3) {
        wrong.push(`${s.label} on a ${lane.stair ? 'stair' : 'lane'}`);
        break;
      }
    }
    for (const pz of plan.piazzas) {
      if (Math.hypot(s.x - pz.x, s.z - pz.z) < pz.r + 0.3) {
        wrong.push(`${s.label} in the square at (${pz.x.toFixed(0)}, ${pz.z.toFixed(0)})`);
        break;
      }
    }
  }
  expectNone(wrong, 'scattered things where they should not be');
});

// Everything built stands on something: on the ground, in the water, or on or against
// another thing. A stall half over the water, a cat sitting on air, a tread hanging over a drop
// or a wall buried whole in the hill all show up here.
import { test } from 'bun:test';
import { Buckets, WATER_LEVEL, at, expectNone, groundAt, groundUnder, island, overlapXZ } from './world.js';

const TOL = 0.35; // how far a thing's bottom may hang over what it stands on
const WATER_TOL = 0.6; // things afloat ride a little high
const SHARE = 0.5; // the share of a footprint the ground must reach for it to count as standing on it
const BURIED = 0.5; // a thing whose top is this far under the lowest ground under it is never seen

/** The kinds of village part that hang in the air by nature: lit bulbs and rain running off a roof. */
const AIRBORNE = new Set(['lamp', 'flow']);

/**
 * Whether `thing` stands on the ground, in the water, on or against one of `others`, or hangs
 * from one: a window box on a wall, laundry on its line, a cat on a pier.
 */
function supported(thing, others) {
  const { box } = thing;
  if (box.min.y <= WATER_LEVEL + WATER_TOL) return true;
  const ground = groundUnder(box, groundAt);
  if (ground.filter((g) => g >= box.min.y - TOL).length >= ground.length * SHARE) return true;
  for (const other of others) {
    if (other === thing || !overlapXZ(other.box, box, 0.25)) continue;
    if (other.box.min.y <= box.min.y + TOL && other.box.max.y >= box.min.y - TOL) return true; // stands on it, or in it
    if (Math.abs(other.box.min.y - box.max.y) <= TOL) return true; // hangs from it
  }
  return false;
}

function buried(thing) {
  const { box } = thing;
  if (box.min.y <= WATER_LEVEL) return false;
  return box.max.y < Math.min(...groundUnder(box, groundAt)) - BURIED;
}

test('everything in the work zones stands on something', () => {
  const { props } = island();
  const buckets = new Buckets(props);
  const floating = props.filter((p) => !supported(p, buckets.near(p.box, 0.25))).map((p) => p.label);
  expectNone(floating, 'things floating in the work zones');
});

test('every part of the villages stands on something', () => {
  const { parts } = island();
  const solid = parts.filter((p) => !AIRBORNE.has(p.kind));
  const buckets = new Buckets(solid, 3);
  const floating = solid.filter((p) => !supported(p, buckets.near(p.box, 0.25))).map((p) => p.label);
  expectNone(floating, 'village parts floating in the air');
});

// (The village's parts are not looked at: a house going on down a slope has whole walls in
// the hill by design.)
test('nothing in the work zones is buried whole in the ground', () => {
  const { props } = island();
  expectNone(props.filter(buried).map((p) => p.label), 'things buried out of sight');
});

test('every seat stands at sitting height over the ground', () => {
  const { seats } = island();
  const odd = [];
  for (const seat of seats) {
    const floor = Math.max(groundAt(seat.position.x, seat.position.z), WATER_LEVEL);
    const h = seat.position.y - floor;
    if (h < -0.1 || h > 1.6) odd.push(`seat at (${seat.position.x.toFixed(1)}, ${seat.position.z.toFixed(1)}) is ${h.toFixed(2)} over the ground`);
  }
  expectNone(odd, 'seats at an odd height');
});

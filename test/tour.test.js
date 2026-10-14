// The weekly tours look at the island, not past it: every stop of every sector lies on the
// map, over land or the shallows beside it. A stop out at sea or off the edge photographs
// nothing but sky.
import { test } from 'bun:test';
import { SECTORS, stops } from '../src/tour.js';
import { HALF, WATER_LEVEL, expectNone, groundAt } from './world.js';

const EDGE = 8; // the margin a stop keeps from the map's edge, in metres
const DEPTH = 4; // the shallows: how far under the surface a stop's ground may lie

test('every tour stop is on the map, over land or the shallows', () => {
  const off = [];
  for (const sector of SECTORS) {
    for (const stop of stops(sector)) {
      const ground = groundAt(stop.x, stop.z);
      if (Math.abs(stop.x) > HALF - EDGE || Math.abs(stop.z) > HALF - EDGE) off.push(`${sector}/${stop.name} at (${stop.x}, ${stop.z}) is off the map`);
      else if (ground < WATER_LEVEL - DEPTH) off.push(`${sector}/${stop.name} at (${stop.x}, ${stop.z}) is over ${(WATER_LEVEL - ground).toFixed(1)} m of water`);
    }
  }
  expectNone(off, 'tour stops looking at nothing');
});

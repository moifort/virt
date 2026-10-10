// Every way leads somewhere: the trail down from the observatory ends at a door of the station,
// not against a blank wall.
import { expect, test } from 'bun:test';
import { TRAILS } from '../src/terrain.js';
import { stationDoors } from '../src/railway.js';

const REACH = 2.5; // how far from a door a way may give out, in metres

test("the observatory trail ends at the station's back door", () => {
  const [, , x, z] = TRAILS.at(-1);
  const doors = stationDoors();
  const nearest = doors.reduce((a, d) => (Math.hypot(d.x - x, d.z - z) < Math.hypot(a.x - x, a.z - z) ? d : a));
  expect(Math.hypot(nearest.x - x, nearest.z - z)).toBeLessThan(REACH);
  expect(nearest.face).toBe('back');
});

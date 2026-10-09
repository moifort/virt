// What the island costs to draw, held under a ceiling: the weekly reviews make the map richer,
// and this keeps them from making it slow. Measured on 2026-10-09: 3.15 M triangles, 588
// meshes, 98.6 k instances; the ceilings leave about 15 % for what is still to come. Raise them
// only on purpose, after measuring the frame rate in Safari (?bench, see src/bench.js).
import { expect, test } from 'bun:test';
import { totals } from '../tour/budget.js';

const CEILING = { triangles: 3_600_000, meshes: 680, instances: 115_000 };

test('the island stays within its drawing budget', () => {
  const now = totals();
  for (const [what, most] of Object.entries(CEILING)) {
    if (now[what] > most) throw new Error(`${now[what]} ${what}, over the ceiling of ${most}: instance what repeats, or measure the frame rate before raising it`);
  }
  expect(now.triangles).toBeGreaterThan(0);
});

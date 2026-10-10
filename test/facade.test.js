// A stair laid against a wall keeps off its windows: no tread across one, and nobody climbing
// it passes in front of one.
import { expect, test } from 'bun:test';
import { HEADROOM, astronomersHouse } from '../src/zones.js';

test("the stair up the astronomers' house crosses none of its windows", () => {
  const { treads, back, window } = astronomersHouse();
  const crossed = [];
  for (const w of back) {
    for (const t of treads) {
      const across = Math.abs(t.x - w.x) < (t.w + window.w) / 2;
      const level = w.y + window.h / 2 > t.y - t.h / 2 && w.y - window.h / 2 < t.y + t.h / 2 + HEADROOM;
      if (across && level) {
        crossed.push(`window at x ${w.x}, ${w.y} m up, behind the tread at x ${t.x.toFixed(1)}, ${t.y.toFixed(2)} m up`);
        break;
      }
    }
  }
  expect(crossed).toEqual([]);
  // The back wall keeps windows of its own, above and below the stair.
  expect(back.length).toBeGreaterThanOrEqual(3);
});

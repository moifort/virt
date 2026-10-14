// What lies flat on the ground is painted to be seen against it: a towel the colour of the
// sand is only its own shadow.
import { expect, test } from 'bun:test';
import { TOWELS } from '../src/nature.js';
import { PAL } from '../src/style.js';

const APART = 0.25; // the least distance between two colours, in RGB units of 0..1 per channel

const rgb = (hex) => [16, 8, 0].map((shift) => ((hex >> shift) & 255) / 255);
const distance = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

test('no beach towel is the colour of the sand', () => {
  const faint = TOWELS.filter((c) => [PAL.sand, PAL.sandDeep].some((sand) => distance(c, sand) < APART)).map((c) => `#${c.toString(16)}`);
  expect(faint).toEqual([]);
});

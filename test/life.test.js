// The living things keep to where they could be: a sheep grazes round the boulders of its
// pasture, it does not stand on one or walk through it.
import { test } from 'bun:test';
import { expectNone, island } from './world.js';

const SECONDS = 120; // two minutes of the flock wandering, long enough for each to move on
const DT = 0.1;
const BOULDER = 0.8; // the height a scattered stone has to be for a sheep to walk round it
const BODY = 0.35; // half the sheep's width

test('no sheep stands in a boulder while the flock wanders', () => {
  const { scene, world, scatter } = island();
  const flock = [];
  scene.traverse((obj) => obj.userData.sheep && flock.push(obj));
  if (!flock.length) throw new Error('no sheep found');
  const stones = scatter.filter((s) => s.kind === 'dodecahedron' && s.height >= BOULDER);
  const near = stones.filter((s) => flock.some((g) => Math.hypot(s.x - g.position.x, s.z - g.position.z) < 30));
  const wrong = new Map();
  for (let t = 0; t < SECONDS; t += DT) {
    if (t > 0) world.update(t, DT, undefined);
    flock.forEach((g, i) => {
      if (wrong.has(i)) return;
      for (const s of near) {
        if (Math.hypot(s.x - g.position.x, s.z - g.position.z) < s.reach * 0.8 + BODY) {
          wrong.set(i, `sheep #${i} in ${s.label} after ${t.toFixed(0)} s`);
          break;
        }
      }
    });
  }
  expectNone([...wrong.values()], 'sheep in a boulder');
});

// The meshes themselves: nothing is drawn from a number that is not a number. One NaN vertex
// voids the bounding sphere of a whole baked mesh and the renderer culls it away entirely.
import { test } from 'bun:test';
import { expectNone, island } from './world.js';

test('every vertex and every instance is a finite number', () => {
  const { scene } = island();
  const bad = [];
  const m = new Float32Array(16);
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const pos = obj.geometry.attributes.position;
    if (!pos || pos.count === 0) {
      bad.push(`${obj.type} without a vertex`);
      return;
    }
    for (let i = 0; i < pos.array.length; i++) {
      if (!Number.isFinite(pos.array[i])) {
        bad.push(`${obj.type} (${obj.material.type}) has a vertex that is not a number`);
        break;
      }
    }
    if (obj.isInstancedMesh) {
      for (let i = 0; i < obj.count; i++) {
        m.set(obj.instanceMatrix.array.subarray(i * 16, i * 16 + 16));
        if (m.some((v) => !Number.isFinite(v))) {
          bad.push(`instanced ${obj.userData.part ?? obj.geometry.type} #${i} has a matrix that is not a number`);
          break;
        }
      }
    }
  });
  expectNone(bad, 'broken meshes');
});

// The wine estate: vineyards trained on posts and wires along irregular dry-stone terraces, on
// the mountain side left of the railway, right up to the last houses of the village.
import * as THREE from 'three';
import { pick } from './noise.js';
import { paint } from './style.js';
import { UP, estateWeight, groundAt, isWild, slopeAt, toX, toZ } from './terrain.js';

const VINE = [0x5f8a45, 0x6c964c, 0x548040, 0x7a9c50, 0x8fa24e];

/** Vines trained along wires between chestnut posts, in rows that follow each terrace. */
function buildVineyard(scene, rng) {
  const yaw = Math.PI / 4; // rows run along the slope
  const vines = [];
  const posts = [];
  const wires = [];
  const grapes = [];
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const place = (list, x, y, z, sx, sy, sz, color) => list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)), c: color });
  for (let u = 40; u < 120; u += 1.7) {
    let run = 0;
    for (let v = -40; v < 48; v += 0.9) {
      const x = toX(u, v);
      const z = toZ(u, v);
      const ok = estateWeight(u, v) > 0.25 && slopeAt(x, z) < 0.3 && isWild(x, z, 0);
      if (!ok) {
        run = 0;
        continue;
      }
      const y = groundAt(x, z);
      // A post at each end of a row and every few vines; the wire runs between them.
      if (run % 4 === 0) place(posts, x, y + 0.65, z, 0.1, 1.3, 0.1, 0x7a5a44);
      place(wires, x, y + 1.15, z, 0.92, 0.03, 0.03, 0x4a4450);
      if (rng() > 0.06) {
        const tired = rng() < 0.12;
        place(vines, x, y + 0.72, z, 0.98, 0.78 + rng() * 0.22, 0.42, tired ? VINE[4] : pick(rng, VINE.slice(0, 4)));
        place(posts, x, y + 0.18, z, 0.08, 0.4, 0.08, 0x6a5444);
        if (rng() < 0.3) place(grapes, x + (rng() - 0.5) * 0.3, y + 0.5, z + 0.24, 0.16, 0.22, 0.14, 0x4a3468);
      }
      run++;
    }
  }
  const color = new THREE.Color();
  const instance = (geo, list, look) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, paint(0xffffff, look), list.length);
    list.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, color.setHex(it.c));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  };
  instance(new THREE.IcosahedronGeometry(0.62, 1), vines, { leaf: true, deciduous: true });
  instance(new THREE.BoxGeometry(1, 1, 1), [...posts, ...wires], {});
  instance(new THREE.IcosahedronGeometry(0.5, 0), grapes, { flat: true });
}

export function buildEstate(scene, rng) {
  buildVineyard(scene, rng);
}

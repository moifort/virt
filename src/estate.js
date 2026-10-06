// The wine estate: vineyards trained on posts and wires along irregular dry-stone terraces, on
// the mountain side left of the railway, right up to the last houses of the village; and the
// steep bank under the railway by the first tunnel, terraced narrow and planted the same way.
import * as THREE from 'three';
import { pick } from './noise.js';
import { paint } from './style.js';
import { SPUR_END, UP, bankAt, estateWeight, groundAt, isWild, railPoint, slopeAt, toX, toZ } from './terrain.js';

const VINE = [0x5f8a45, 0x6c964c, 0x548040, 0x7a9c50, 0x8fa24e];

/**
 * Vines trained along wires between chestnut posts, in rows that follow each terrace.
 * @param {number} yaw the way the rows run
 * @param {{x: number, z: number}[][]} rows the points of each row, in order along it
 * @param {(p: {x: number, z: number}) => boolean} ok whether a vine may stand at a point
 */
function buildVineyard(scene, rng, yaw, rows, ok) {
  const vines = [];
  const posts = [];
  const wires = [];
  const grapes = [];
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const place = (list, x, y, z, sx, sy, sz, color) => list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)), c: color });
  for (const row of rows) {
    let run = 0;
    for (const p of row) {
      if (!ok(p)) {
        run = 0;
        continue;
      }
      const { x, z } = p;
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
  // The estate: rows running along the slope.
  const estateRows = [];
  for (let u = 40; u < 120; u += 1.7) {
    const row = [];
    for (let v = -40; v < 48; v += 0.9) row.push({ x: toX(u, v), z: toZ(u, v), u, v });
    estateRows.push(row);
  }
  buildVineyard(scene, rng, Math.PI / 4, estateRows, (p) => estateWeight(p.u, p.v) > 0.25 && slopeAt(p.x, p.z) < 0.3 && isWild(p.x, p.z, 0));
  // The bank under the railway: rows along the line, one to each narrow terrace, and the
  // vines climb slopes the estate would not plant, as on the Cinque Terre.
  const a = railPoint(0, 0);
  const b = railPoint(1, 0);
  const bankRows = [];
  for (let l = 5; l < 40; l += 1.8) {
    const row = [];
    for (let s = SPUR_END - 10; s < SPUR_END + 32; s += 0.9) row.push(railPoint(s, l));
    bankRows.push(row);
  }
  buildVineyard(scene, rng, Math.atan2(-(b.z - a.z), b.x - a.x), bankRows, (p) => bankAt(p.x, p.z) > 0.5 && slopeAt(p.x, p.z) < 1.3 && isWild(p.x, p.z, 0));
}

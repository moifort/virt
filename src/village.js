// Cinque Terre villages: pastel tower houses stacked on the terraces.
import * as THREE from 'three';
import { fbm, pick } from './noise.js';
import { PAL, paint } from './style.js';
import { at, box, cone } from './kit.js';
import { footU, groundAt, isWild, slopeAt, toX, toZ, UP } from './terrain.js';


/** Tall narrow pastel houses stacked on the terraces, drawn with a handful of instanced meshes. */
export function buildVillages(scene, rng) {
  const walls = [];
  const roofs = [];
  const windows = [];
  const shutters = [];
  const placed = [];
  const facing = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 4);
  const house = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);

  const addOpenings = (w, d, floors, base) => {
    for (let f = 0; f < floors; f++) {
      const y = base + 1.3 + f * 1.7;
      // Sea-facing front (+z) and both sides (±x).
      const faces = [
        { n: Math.max(1, Math.floor(w / 1.5)), span: w, place: (o) => [o, y, d / 2 + 0.04], rot: 0 },
        { n: Math.max(1, Math.floor(d / 1.6)), span: d, place: (o) => [w / 2 + 0.04, y, -o], rot: Math.PI / 2 },
        { n: Math.max(1, Math.floor(d / 1.6)), span: d, place: (o) => [-w / 2 - 0.04, y, o], rot: -Math.PI / 2 },
      ];
      for (const face of faces) {
        for (let k = 0; k < face.n; k++) {
          if (rng() < 0.12) continue;
          const o = -face.span / 2 + (face.span * (k + 0.5)) / face.n;
          const q = new THREE.Quaternion().setFromAxisAngle(UP, face.rot);
          const [x, yy, z] = face.place(o);
          windows.push(house.clone().multiply(local.compose(new THREE.Vector3(x, yy, z), q, new THREE.Vector3(0.42, 0.7, 0.06))));
          for (const s of [-1, 1]) {
            const off = new THREE.Vector3(s * 0.33, 0, 0).applyQuaternion(q);
            shutters.push(house.clone().multiply(local.compose(new THREE.Vector3(x + off.x, yy, z + off.z), q, new THREE.Vector3(0.22, 0.72, 0.08))));
          }
        }
      }
    }
  };

  const villages = [
    { v: -56, spread: 30, u: (v) => footU(v) + 2 + rng() * 32, n: 22 },
    { v: -4, spread: 30, u: (v) => footU(v) + 2 + rng() * 32, n: 22 },
    { v: 50, spread: 28, u: (v) => footU(v) + 2 + rng() * 32, n: 20 },
    { v: -84, spread: 22, u: () => -75 + rng() * 55, n: 18 },
    { v: 84, spread: 22, u: () => -75 + rng() * 55, n: 18 },
  ];
  for (const village of villages) {
    for (let tries = 0, n = 0; tries < 500 && n < village.n; tries++) {
      const v = village.v + (rng() - 0.5) * village.spread;
      const u = village.u(v);
      const x = toX(u, v);
      const z = toZ(u, v);
      if (!isWild(x, z, -1) || slopeAt(x, z) > 1.1) continue;
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 3.6)) continue;
      placed.push([x, z]);
      const w = 2.6 + rng() * 1.4;
      const d = 2.6 + rng() * 1.2;
      const floors = 2 + Math.floor(rng() * 3);
      const base = groundAt(x, z) - 1.2;
      const H = 1.4 + floors * 1.7;
      house.compose(new THREE.Vector3(x, base, z), facing, one);
      walls.push({ m: house.clone().multiply(local.compose(new THREE.Vector3(0, H / 2, 0), new THREE.Quaternion(), new THREE.Vector3(w, H, d))), c: pick(rng, [PAL.ochre, PAL.rose, PAL.coral, PAL.saffron, PAL.peach, 0xf2c79a, 0xe58f6b, PAL.pink, 0xf5e1b8]) });
      const slate = rng() < 0.65;
      roofs.push({ m: house.clone().multiply(local.compose(new THREE.Vector3(0, H + 0.45, 0), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 4), new THREE.Vector3(w * 1.5, 0.9, d * 1.5))), c: slate ? 0x8a86a0 : 0xc8643c });
      addOpenings(w, d, floors, 0);
      n++;
    }
  }

  const instanced = (geo, items, colorOf) => {
    const mesh = new THREE.InstancedMesh(geo, paint(0xffffff), items.length);
    const c = new THREE.Color();
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m ?? it);
      mesh.setColorAt(i, c.setHex(colorOf(it)));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  };
  instanced(new THREE.BoxGeometry(1, 1, 1), walls, (it) => it.c);
  instanced(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), roofs, (it) => it.c);
  instanced(new THREE.BoxGeometry(1, 1, 1), windows, () => 0x3b3346);
  instanced(new THREE.BoxGeometry(1, 1, 1), shutters, () => pick(rng, [0x3f8f5a, 0x4a9a6a, 0x3f7f8f]));

  // A campanile in each village.
  for (const v of [-56, -4, 50]) {
    const u = footU(v) + 6;
    const x = toX(u, v);
    const z = toZ(u, v);
    if (!isWild(x, z, -2)) continue;
    const g = at(new THREE.Group(), x, groundAt(x, z) - 0.5, z);
    g.rotation.y = Math.PI / 4;
    at(box(2.4, 13, 2.4, pick(rng, [PAL.cream, PAL.peach, PAL.ochre])), 0, 6.5, 0, g);
    for (const r of [0, Math.PI / 2]) {
      const arch = at(box(0.9, 1.6, 2.5, 0x3b3346), 0, 11.3, 0, g);
      arch.rotation.y = r;
    }
    at(cone(1.95, 2.6, 0x8a86a0, 4), 0, 14.3, 0, g).rotation.y = Math.PI / 4;
    at(box(0.9, 0.9, 0.1, PAL.ivory), 0, 9.5, 1.23, g);
    scene.add(g);
  }

  // Vineyards: rows of vines following the terraces.
  const vines = new THREE.IcosahedronGeometry(0.5, 0);
  const rows = [];
  for (let v = -110; v < 110; v += 1.1) {
    for (let u = 40; u < 140; u += 1.7) {
      const x = toX(u, v);
      const z = toZ(u, v);
      if (u < footU(v) + 1 || fbm(v * 0.03 + 5, u * 0.03, 2) < 0.48) continue;
      if (slopeAt(x, z) > 0.3 || !isWild(x, z, -1)) continue;
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 3)) continue;
      rows.push([x, groundAt(x, z), z]);
    }
  }
  const vm = new THREE.InstancedMesh(vines, paint(0xffffff, { flat: true, sway: true }), rows.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  rows.forEach(([x, y, z], i) => {
    m.compose(new THREE.Vector3(x, y + 0.45, z), new THREE.Quaternion().setFromAxisAngle(UP, rng() * 6), new THREE.Vector3(0.9, 1.1 + rng() * 0.4, 0.9));
    vm.setMatrixAt(i, m);
    vm.setColorAt(i, c.setHex(pick(rng, [PAL.grassDeep, 0x5f9c6a, PAL.grass, 0x7fae5a])));
  });
  vm.castShadow = vm.receiveShadow = true;
  scene.add(vm);
}


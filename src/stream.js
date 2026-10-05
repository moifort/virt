// The mountain stream: white water running down its bed from the spring to the sea, the pool
// under the great fall, and the spray wherever it drops.
import * as THREE from 'three';
import { WATER_LEVEL, paint } from './style.js';
import { STREAM, groundAt } from './terrain.js';

/**
 * A ribbon of running water through `points` ({ x, y, z, run }), where `run` is the distance the
 * water has come; `width(i)` is its width at each point.
 */
function ribbon(points, width) {
  const position = [];
  const uv = [];
  const index = [];
  points.forEach((p, i) => {
    // Across the stream: level, and square to the way it is going.
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const ax = (-(b.z - a.z) / length) * width(i) * 0.5;
    const az = ((b.x - a.x) / length) * width(i) * 0.5;
    position.push(p.x - ax, p.y, p.z - az, p.x + ax, p.y, p.z + az);
    uv.push(0, p.run, 1, p.run);
    if (i) index.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, paint(0xffffff, { cascade: true, doubleSide: true }));
  mesh.receiveShadow = true;
  return mesh;
}

export function buildStream(scene, rng, animated) {
  if (STREAM.length < 2) return;
  // The water lies just over its bed, and runs on past the last of it down to the sea.
  const course = [];
  let run = 0;
  STREAM.forEach((p, i) => {
    const y = groundAt(p.x, p.z) + 0.22;
    if (i) run += Math.hypot(p.x - STREAM[i - 1].x, y - course[i - 1].y, p.z - STREAM[i - 1].z);
    course.push({ x: p.x, y, z: p.z, run, pool: p.pool });
  });
  const last = course[course.length - 1];
  const before = course[course.length - 2];
  const out = new THREE.Vector3(last.x - before.x, 0, last.z - before.z).normalize();
  for (let k = 1; k <= 8 && course[course.length - 1].y > WATER_LEVEL; k++) {
    const y = Math.max(WATER_LEVEL, groundAt(last.x + out.x * k, last.z + out.z * k) + 0.22, last.y - k * k * 0.35);
    course.push({ x: last.x + out.x * k, y, z: last.z + out.z * k, run: last.run + k * 1.5 });
  }
  // It widens as the brooks join it, and spreads white where it tumbles.
  const steep = (i) => Math.abs(course[Math.min(course.length - 1, i + 1)].y - course[Math.max(0, i - 1)].y);
  scene.add(ribbon(course, (i) => 1.1 + (i / course.length) * 1.5 + Math.min(1.6, steep(i) * 0.25)));

  // The pool under the great fall: ripples spreading from where the water strikes.
  const pool = course.find((p) => p.pool);
  const drops = [];
  if (pool) {
    const rim = [];
    const SPOKES = 14;
    const position = [pool.x, pool.y + 0.06, pool.z];
    const uv = [0.5, 0];
    for (let k = 0; k <= SPOKES; k++) {
      const a = (k / SPOKES) * Math.PI * 2;
      position.push(pool.x + Math.cos(a) * 3.6, pool.y + 0.06, pool.z + Math.sin(a) * 3.6);
      uv.push(k / SPOKES, 9);
      if (k) rim.push(0, k + 1, k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(rim);
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, paint(0xffffff, { cascade: true, doubleSide: true })));
    drops.push(pool);
  }
  // Spray boils white at the foot of every drop, and where the stream meets the sea.
  for (let i = 2; i < course.length - 2; i += 3) if (course[i - 2].y - course[i].y > 2.2 && !course[i].pool) drops.push(course[i]);
  drops.push(course[course.length - 1]);

  const PUFFS = 7;
  const spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), paint(0xf6fbff, { flat: true }), drops.length * PUFFS);
  spray.frustumCulled = false;
  scene.add(spray);
  const seeds = Array.from({ length: drops.length * PUFFS }, () => ({ a: rng() * Math.PI * 2, r: rng() * 1.6, phase: rng() }));
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  animated.push((t) => {
    seeds.forEach((seed, i) => {
      const at = drops[Math.floor(i / PUFFS)];
      const life = (t * 0.8 + seed.phase) % 1;
      const spread = seed.r * (0.5 + life * 0.7);
      p.set(at.x + Math.cos(seed.a) * spread, at.y + 0.1 + Math.sin(life * Math.PI) * 0.7, at.z + Math.sin(seed.a) * spread);
      s.setScalar(0.3 + Math.sin(life * Math.PI) * 0.7);
      spray.setMatrixAt(i, m.compose(p, q, s));
    });
    spray.instanceMatrix.needsUpdate = true;
  });
}

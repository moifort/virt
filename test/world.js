// The island as built, read once for every test: where each thing stands, its bounds, and the
// plan of the villages. The tests are a world lint, the checks a level designer runs on a map
// before shipping it: nothing floats, nothing is buried, every way leads somewhere, every
// seat can be reached.
import * as THREE from 'three';
import { createWorld } from '../src/world.js';
import { villagePlan } from '../src/terrain.js';

export { CELL, HALF, PATHS, SEGMENTS, WATER_LEVEL, ZONES, groundAt, inSquare, isSolid, laneAt, lanePoint, toU, toV } from '../src/terrain.js';

/** A work zone's group holding many separate things, not one thing: flattened into them. */
const CONTAINER = 14;

let built = null;

/**
 * Builds the island once and keeps it. Returns the scene, the `props` of the work zones (each
 * object a builder placed, with its world bounds), the `parts` of the villages (every
 * instanced box, roof, post and tread), the `scatter` of nature (every instance set down at
 * random), the `seats`, and the `plan` of lanes, stairs and squares.
 */
export function island() {
  if (built) return built;
  const scene = new THREE.Scene();
  const props = [];
  const world = createWorld(scene, {
    inspect(zone, group) {
      group.updateMatrixWorld(true);
      for (const obj of flatten(group)) {
        if (obj.userData.aloft) continue; // hangs in the air by nature
        const box = new THREE.Box3().setFromObject(obj, true);
        if (box.isEmpty()) continue;
        props.push({ zone, box, label: describe(zone, obj, box) });
      }
    },
  });
  scene.updateMatrixWorld(true);

  const parts = [];
  const scatter = [];
  const m = new THREE.Matrix4();
  const box = new THREE.Box3();
  scene.traverse((obj) => {
    if (!obj.isInstancedMesh) return;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const kind = obj.userData.part;
    for (let i = 0; i < obj.count; i++) {
      obj.getMatrixAt(i, m);
      m.premultiply(obj.matrixWorld);
      if (kind) {
        box.copy(obj.geometry.boundingBox).applyMatrix4(m);
        const b = box.clone();
        const size = b.getSize(new THREE.Vector3());
        parts.push({ kind, box: b, label: `${kind} ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} ${at(b)}` });
      } else if (obj.userData.scatter) {
        const p = new THREE.Vector3().setFromMatrixPosition(m);
        const what = obj.geometry.type.replace('Geometry', '').toLowerCase();
        const height = (obj.geometry.boundingBox.max.y - obj.geometry.boundingBox.min.y) * new THREE.Vector3().setFromMatrixScale(m).y;
        scatter.push({ x: p.x, y: p.y, z: p.z, height, label: `scattered ${what} #${i} (${height.toFixed(1)} tall) at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})` });
      }
    }
  });

  built = { scene, world, props, parts, scatter, seats: world.seats, plan: villagePlan() };
  return built;
}

/** The things a zone's group holds, each its own: a group the size of a quay is opened up. */
function* flatten(group) {
  for (const child of group.children) {
    if (!child.isMesh && child.children.length && spans(child) > CONTAINER) yield* flatten(child);
    else yield child;
  }
}

function spans(obj) {
  const box = new THREE.Box3().setFromObject(obj, true);
  return box.isEmpty() ? 0 : Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
}

function describe(zone, obj, box) {
  const size = box.getSize(new THREE.Vector3());
  const what = obj.name || (obj.isMesh ? obj.geometry.type.replace('Geometry', '').toLowerCase() : obj.type.toLowerCase());
  return `${zone}: ${what} ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} ${at(box)}`;
}

/** Where a box stands, for a message: its centre on the ground and its bottom. */
export function at(box) {
  const c = box.getCenter(new THREE.Vector3());
  return `at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}), bottom ${box.min.y.toFixed(2)}`;
}

/**
 * A ratchet on a check the island does not pass yet: fails when the violations outnumber
 * the `known` ones, so the count can only go down. When it does go down, say so, so that the
 * figure in the test is lowered to match.
 */
export function expectAtMost(violations, known, what, limit = Number(process.env.LINT_LIMIT) || 30) {
  if (violations.length > known) {
    const shown = violations.slice(0, limit).map((v) => `  - ${v}`);
    if (violations.length > limit) shown.push(`  … and ${violations.length - limit} more`);
    throw new Error(`${violations.length} ${what}, ${known} known:\n${shown.join('\n')}`);
  }
  if (violations.length < known) console.log(`${what}: ${violations.length} left of ${known} known, lower the figure in the test`);
}

/** Fails the test with every violation listed, the first `limit` in full. */
export function expectNone(violations, what, limit = Number(process.env.LINT_LIMIT) || 30) {
  if (!violations.length) return;
  const shown = violations.slice(0, limit).map((v) => `  - ${v}`);
  if (violations.length > limit) shown.push(`  … and ${violations.length - limit} more`);
  throw new Error(`${violations.length} ${what}:\n${shown.join('\n')}`);
}

/** Samples of the ground under a box's footprint, `step` apart at most, its edges included. */
export function groundUnder(box, groundAt, step = 0.5) {
  const nx = Math.max(2, Math.ceil((box.max.x - box.min.x) / step) + 1);
  const nz = Math.max(2, Math.ceil((box.max.z - box.min.z) / step) + 1);
  const samples = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      samples.push(groundAt(box.min.x + ((box.max.x - box.min.x) * i) / (nx - 1), box.min.z + ((box.max.z - box.min.z) * j) / (nz - 1)));
    }
  }
  return samples;
}

/** Whether two boxes overlap on the ground, each grown by `slack`. */
export function overlapXZ(a, b, slack = 0) {
  return a.min.x - slack <= b.max.x && a.max.x + slack >= b.min.x && a.min.z - slack <= b.max.z && a.max.z + slack >= b.min.z;
}

/** Boxes bucketed on the ground, so that each one's neighbours are found without a sweep of them all. */
export class Buckets {
  constructor(items, cell = 4) {
    this.cell = cell;
    this.map = new Map();
    items.forEach((item, i) => {
      const { box } = item;
      for (let ix = Math.floor(box.min.x / cell); ix <= Math.floor(box.max.x / cell); ix++) {
        for (let iz = Math.floor(box.min.z / cell); iz <= Math.floor(box.max.z / cell); iz++) {
          const key = ix * 100003 + iz;
          if (!this.map.has(key)) this.map.set(key, []);
          this.map.get(key).push(i);
        }
      }
    });
    this.items = items;
  }

  /** Every item whose cells the box (grown by `slack`) touches, each once. */
  near(box, slack = 0) {
    const seen = new Set();
    const out = [];
    const { cell } = this;
    for (let ix = Math.floor((box.min.x - slack) / cell); ix <= Math.floor((box.max.x + slack) / cell); ix++) {
      for (let iz = Math.floor((box.min.z - slack) / cell); iz <= Math.floor((box.max.z + slack) / cell); iz++) {
        for (const i of this.map.get(ix * 100003 + iz) ?? []) {
          if (seen.has(i)) continue;
          seen.add(i);
          out.push(this.items[i]);
        }
      }
    }
    return out;
  }
}

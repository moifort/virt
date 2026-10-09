// The rules a harbour was found to break, one test each, so that none of it comes back:
// things through one another (a boat hauled up over a bollard), a stall turned to the sea,
// a flight of steps hollow underneath, a street lamp on the planks of a pier.
import { test } from 'bun:test';
import * as THREE from 'three';
import { Buckets, expectAtMost, expectNone, groundAt, island, laneAt } from './world.js';

const AIRBORNE = new Set(['lamp', 'flow', 'leaf', 'vine', 'ball']);
// The most a piece of furniture holds, in cubic metres of its own box: a boat, a stall.
const FURNITURE = 14;
const name = (p) => p.label;

test('nothing solid stands through something else', () => {
  const { props, parts } = island();
  const solids = [...props.filter((p) => p.name !== 'plank' && p.name !== 'step'), ...parts.filter((p) => !AIRBORNE.has(p.kind))];
  const buckets = new Buckets(solids, 3);
  const inverse = new THREE.Matrix4();
  const c = new THREE.Vector3();
  const through = [];
  // A piece of furniture made of several parts (a boat, a stall, a cat, a bench) against
  // everything smaller: no such thing may have its middle inside the furniture's own box,
  // turned as it is turned and taken in a hand all round. (A street lamp's box is mostly the
  // air under its bracket; a tree or a building is made of parts set into one another.)
  const volume = (box) => (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z);
  for (const a of props) {
    if (!a.group || a.local.isEmpty() || a.name === 'street lamp' || volume(a.local) > FURNITURE) continue;
    inverse.copy(a.matrix).invert();
    const inner = a.local.clone().expandByScalar(-0.15);
    if (inner.isEmpty()) continue;
    for (const b of buckets.near(a.box)) {
      if (b === a || volume(b.box) >= volume(a.box)) continue;
      // Ground, paving and walls under a thing are what it stands on.
      if (b.box.max.y < a.box.min.y + 0.15) continue;
      b.box.getCenter(c).applyMatrix4(inverse);
      if (inner.containsPoint(c)) through.push(`${b.label} stands through ${a.label}`);
    }
  }
  expectNone(through, 'things standing through one another');
});

test('every stall faces the street, not the sea', () => {
  const { props, plan } = island();
  const quays = plan.lanes.filter((l) => l.quay);
  const wrong = [];
  for (const p of props) {
    if (p.front !== 'street') continue;
    const front = new THREE.Vector3(0, 0, 1).transformDirection(p.matrix);
    const c = p.box.getCenter(new THREE.Vector3());
    const quay = quays.find((l) => laneAt(l, c.x, c.z).d < l.half + l.quay + 3);
    if (!quay) continue;
    // The sea side of the quay, at the point of its axis nearest the stall.
    const s = laneAt(quay, c.x, c.z).s;
    const seg = quay.segs.find((g) => s <= g.s0 + g.len) ?? quay.segs.at(-1);
    const tx = (seg.b.x - seg.a.x) / seg.len;
    const tz = (seg.b.z - seg.a.z) / seg.len;
    const seaward = { x: -tz * quay.seaSide, z: tx * quay.seaSide };
    if (front.x * seaward.x + front.z * seaward.z > -0.5) wrong.push(`${p.label} faces the sea`);
  }
  expectNone(wrong, 'stalls turned the wrong way');
});

test('every step is solid down to what carries it', () => {
  const { props } = island();
  const buckets = new Buckets(props.filter((p) => p.name !== 'step'));
  const hollow = [];
  for (const step of props) {
    if (step.name !== 'step') continue;
    const bottom = step.box.min.y;
    const ground = groundAt((step.box.min.x + step.box.max.x) / 2, (step.box.min.z + step.box.max.z) / 2);
    if (ground >= bottom - 0.12) continue;
    const carried = buckets.near(step.box).some((o) => o.box.max.y >= bottom - 0.12 && o.box.max.y <= bottom + 0.3 && o.box.min.x < step.box.max.x && o.box.max.x > step.box.min.x && o.box.min.z < step.box.max.z && o.box.max.z > step.box.min.z);
    if (!carried) hollow.push(`${step.label}: nothing under it`);
  }
  expectNone(hollow, 'steps hollow underneath');
});

test('no street lamp stands on the planks of a pier', () => {
  const { props } = island();
  const planks = new Buckets(props.filter((p) => p.name === 'plank'));
  const wrong = [];
  for (const lamp of props) {
    if (lamp.name !== 'street lamp') continue;
    if (planks.near(lamp.box).some((p) => Math.abs(p.box.max.y - lamp.box.min.y) < 0.2 && p.box.min.x < lamp.box.max.x && p.box.max.x > lamp.box.min.x && p.box.min.z < lamp.box.max.z && p.box.max.z > lamp.box.min.z)) wrong.push(`${lamp.label} stands on planks`);
  }
  expectNone(wrong, 'street lamps on a pier');
});

// Things that move: butterflies over the meadows, gulls over the bay, sailboats crossing it,
// whales and dolphins passing now and then far out,
// fishing boats that light their lamps at dusk, and fireflies on summer nights.
import * as THREE from 'three';
import { hash, pick } from './noise.js';
import { PAL, WATER_LEVEL, paint, solid } from './style.js';
import { INK, WARM_LIGHT, at, ball, cyl, lamplight, live } from './kit.js';
import { gozzo } from './zones.js';
import { UP, VILLAGES, coastU, groundAt, isWild, randomSpot, toX, toZ } from './terrain.js';

/** A herring gull on the wing: white, with grey wings tipped in black. */
function gull() {
  const g = new THREE.Group();
  const body = at(ball(0.3, 0xf4f2ee, { flat: true }, 6, 4), 0, 0, 0, g);
  body.scale.set(0.7, 0.6, 1.6);
  at(ball(0.16, 0xf4f2ee, { flat: true }, 5, 4), 0, 0.08, 0.5, g);
  at(solid(new THREE.ConeGeometry(0.05, 0.22, 4), paint(PAL.saffron)), 0, 0.06, 0.72, g).rotation.x = Math.PI / 2;
  const wings = [-1, 1].map((s) => {
    const shoulder = at(new THREE.Group(), s * 0.12, 0.06, 0.05, g);
    shoulder.add(solid(new THREE.BoxGeometry(0.85, 0.04, 0.42).translate(s * 0.42, 0, 0), paint(0xb9c0cc, { flat: true })));
    const hand = at(new THREE.Group(), s * 0.85, 0, 0, shoulder);
    hand.add(solid(new THREE.BoxGeometry(0.7, 0.04, 0.3).translate(s * 0.35, 0, -0.05), paint(0x9aa2b0, { flat: true })));
    hand.add(solid(new THREE.BoxGeometry(0.2, 0.04, 0.2).translate(s * 0.78, 0, -0.08), paint(INK, { flat: true })));
    return { shoulder, hand, s };
  });
  return { group: g, wings };
}

// Stretches of deep open water where the big animals show themselves, in (u, v).
const OFFING = [[-84, -30], [-88, 20], [-80, 62], [-70, -70], [10, -128], [60, -132], [-90, -5]];
const offing = (k) => OFFING[Math.floor(hash(k, 77) * OFFING.length)];

/**
 * A whale, built behind a pivot at its head so that pitching the body nose-down lifts the tail
 * clear of the water. Returns the parts the choreography moves.
 */
function whale(scale) {
  const SKIN = 0x46536a;
  const g = live(new THREE.Group());
  g.scale.setScalar(scale);
  const body = at(new THREE.Group(), 0, 0, 0, g);
  at(ball(1, SKIN, {}, 12, 8), 0, -0.5, -4.2, body).scale.set(1.7, 1.15, 6.2);
  at(ball(1, 0x596780, {}, 8, 6), 0, 0.05, -1.6, body).scale.set(1.2, 0.6, 2.6);
  at(solid(new THREE.ConeGeometry(0.4, 0.7, 4), paint(SKIN, { flat: true })), 0, 0.75, -6.8, body).rotation.x = -0.5;
  // The tail stock and the flukes, on a joint that swings them up as the whale sounds.
  const tail = at(new THREE.Group(), 0, -0.4, -9.8, body);
  at(ball(1, SKIN, {}, 6, 5), 0, 0, -0.9, tail).scale.set(0.45, 0.4, 1.3);
  for (const s of [-1, 1]) {
    const fluke = at(ball(1, SKIN, {}, 6, 4), s * 1.0, 0, -2.1, tail);
    fluke.scale.set(1.2, 0.14, 0.62);
    fluke.rotation.y = s * 0.5;
  }
  return { g, body, tail };
}

/**
 * Whales: now and then a mother surfaces far out with her calf at her side. They show their
 * long backs, blow a few times, then she arches, lifts her flukes high and sounds, and the
 * little one follows her down. Then the sea is empty again for a good while.
 */
function buildWhales(scene, animated) {
  const BLOW = 6;
  const EVERY = 95;
  const SHOW = 28;
  // One visit: rises, rolls at the surface, blows at `blows`, arches from `dive` on and lifts
  // the flukes, then slides under from `sink`, flukes last.
  const visit = (age, { body, tail }, lift, dive, sink, t) => {
    const up = Math.min(1, age / 2.5) * (1 - Math.max(0, (age - dive - 2.5) / 4));
    const arch = Math.min(1, Math.max(0, (age - dive) / 3.5));
    const under = Math.min(1, Math.max(0, (age - sink) / 3.5));
    body.position.y = -2.4 + up * (2.3 + lift) + Math.sin(t * 1.1 + dive) * 0.12 - under * 8;
    // Pitching about the head: the nose goes under and the tail stock comes up out of the
    // water, the flukes swinging on up until they stand clear.
    body.rotation.x = arch * 0.32;
    tail.rotation.x = arch * 1.0;
  };
  const mother = whale(1);
  const calf = whale(0.5);
  at(calf.g, 3.6, 0, -2.5, mother.g);
  const spout = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0), paint(0xf4f9ff, { flat: true }), BLOW * 2);
  spout.frustumCulled = false;
  spout.castShadow = false;
  scene.add(mother.g, spout);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  // A column of mist thrown up from the blowhole, drifting and thinning: `at` is the blowhole
  // in the frame of the pair, `size` the animal's.
  const blow = (k, age, blows, origin, size, heading, g) => {
    let scale = 0.001;
    for (const blown of blows) {
      const life = (age - blown - k * 0.09) / 2.6;
      if (life < 0 || life > 1) continue;
      const rise = Math.sqrt(life) * (3.2 + (k % 3) * 0.7) * size;
      p.set(Math.sin(k * 2.4) * life * 0.9 * size, 0.5 * size + rise, Math.cos(k * 2.4) * life * 0.9 * size).add(origin).applyAxisAngle(UP, heading).add(g.position);
      scale = (0.5 + life * 1.1) * Math.sin(Math.min(1, (1 - life) * 2.4) * Math.PI * 0.5) * size;
    }
    spout.setMatrixAt(k, m.compose(p, q, s.setScalar(scale)));
  };
  const motherBlowhole = new THREE.Vector3(0, 0, -1.0);
  const calfBlowhole = new THREE.Vector3(3.6, 0, -2.5 - 0.5);
  animated.push((t) => {
    const clock = t + 55;
    const turn = Math.floor(clock / EVERY);
    const age = clock % EVERY;
    mother.g.visible = spout.visible = age < SHOW;
    if (!mother.g.visible) return;
    // Each visit somewhere else, on a new heading.
    const [u, v] = offing(turn * 2);
    const heading = hash(turn, 5) * Math.PI * 2;
    const swum = age * 1.1 - 12;
    mother.g.position.set(toX(u, v) + Math.sin(heading) * swum, WATER_LEVEL, toZ(u, v) + Math.cos(heading) * swum);
    mother.g.rotation.y = heading;
    visit(age, mother, 0, 19.5, 23.5, t);
    // The calf comes up a moment after her, blows oftener and shallower, and sounds after her.
    visit(Math.max(0, age - 1.2), calf, 0.5, 20.8, 24.5, t + 2);
    for (let k = 0; k < BLOW; k++) blow(k, age, [3, 9.5, 16], motherBlowhole, 1, heading, mother.g);
    for (let k = 0; k < BLOW; k++) blow(BLOW + k, age - 1.2, [4.5, 8.5, 12.5, 17], calfBlowhole, 0.5, heading, mother.g);
    spout.instanceMatrix.needsUpdate = true;
  });
}

/**
 * Dolphins: from time to time a school crosses the bay, leaping one after another in long
 * low arcs, and is gone.
 */
function buildDolphins(scene, animated) {
  const POD = 6;
  const pod = [];
  for (let i = 0; i < POD; i++) {
    const g = live(new THREE.Group());
    at(ball(1, 0x6f7f94, {}, 8, 6), 0, 0, 0, g).scale.set(0.34, 0.36, 1.3);
    at(ball(1, 0xdfe6ee, {}, 6, 4), 0, -0.14, 0.15, g).scale.set(0.26, 0.24, 0.95);
    at(solid(new THREE.ConeGeometry(0.1, 0.5, 4), paint(0x6f7f94, { flat: true })), 0, 0.02, 1.4, g).rotation.x = Math.PI / 2;
    at(solid(new THREE.ConeGeometry(0.16, 0.42, 4), paint(0x5d6c80, { flat: true })), 0, 0.42, -0.1, g).rotation.x = -0.5;
    for (const s of [-1, 1]) at(ball(1, 0x5d6c80, {}, 5, 4), s * 0.24, 0, -1.35, g).scale.set(0.3, 0.06, 0.2);
    scene.add(g);
    pod.push({ g, side: (i % 3) - 1 + (i % 2) * 0.4, back: Math.floor(i / 3) * 2.6 + (i % 2) * 1.1, phase: i * 1.9 });
  }
  const EVERY = 64;
  const SHOW = 30;
  const SPEED = 5.5;
  animated.push((t) => {
    const clock = t + 20;
    const pass = Math.floor(clock / EVERY);
    const age = clock % EVERY;
    const out = age < SHOW;
    // Each pass starts from another stretch of water and runs along the shore one way or the other.
    const [u, v] = offing(pass * 3 + 1);
    const heading = (hash(pass, 31) < 0.5 ? 0.75 : 1.75) * Math.PI + (hash(pass, 9) - 0.5) * 0.7;
    const [dx, dz] = [Math.sin(heading), Math.cos(heading)];
    for (const { g, side, back, phase } of pod) {
      g.visible = out;
      if (!out) continue;
      const along = (age - SHOW / 2) * SPEED - back;
      const arc = t * 2.3 + phase;
      g.position.set(toX(u, v) + dx * along + dz * side * 1.6, WATER_LEVEL - 0.35 + Math.sin(arc) * 1.25, toZ(u, v) + dz * along - dx * side * 1.6);
      // Nose up on the way out of the water, down on the way back in.
      g.rotation.set(-Math.cos(arc) * 0.7, heading, 0, 'YXZ');
    }
  });
}

export function buildLife(scene, rng, animated) {
  // Butterflies fluttering over the meadows, by day.
  for (let i = 0; i < 36; i++) {
    const home = randomSpot(rng, new THREE.Vector3(), 90);
    if (!isWild(home.x, home.z)) continue;
    const b = new THREE.Group();
    const color = pick(rng, [PAL.saffron, PAL.pink, PAL.ivory, PAL.blue, PAL.coral]);
    const wings = [-1, 1].map((s) => {
      const pivot = at(new THREE.Group(), 0, 0, 0, b);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.26).translate(s * 0.16, 0, 0), paint(color, { doubleSide: true }));
      w.rotation.x = -Math.PI / 2;
      pivot.add(w);
      return pivot;
    });
    scene.add(b);
    const phase = rng() * 100;
    animated.push((t, dt, climate) => {
      b.visible = !climate || (climate.night < 0.5 && climate.now.rain < 0.1 && climate.now.snow < 0.1);
      if (!b.visible) return;
      const x = home.x + Math.sin(t * 0.31 + phase) * 4 + Math.sin(t * 0.73 + phase * 2) * 1.5;
      const z = home.z + Math.cos(t * 0.27 + phase) * 4;
      b.position.set(x, groundAt(x, z) + 1.2 + Math.sin(t * 2.3 + phase) * 0.4, z);
      b.rotation.y = t * 0.3 + phase;
      const flap = Math.sin(t * 18 + phase) * 0.9;
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
    });
  }

  // Gulls wheeling over the bay and the harbour: long glides, a few lazy beats, their shadows
  // sliding over the water. They roost at night.
  for (let i = 0; i < 8; i++) {
    const { group, wings } = gull();
    scene.add(live(group));
    const centre = { u: -52 + rng() * 40, v: -80 + rng() * 120 };
    const radius = 12 + rng() * 16;
    const height = 9 + rng() * 12;
    const speed = (0.16 + rng() * 0.1) * (i % 2 ? 1 : -1);
    const phase = rng() * 100;
    animated.push((t, dt, climate) => {
      group.visible = !climate || climate.night < 0.6;
      if (!group.visible) return;
      const a = t * speed + phase;
      const u = centre.u + Math.cos(a) * radius + Math.sin(t * 0.05 + phase) * 8;
      const v = centre.v + Math.sin(a) * radius * 1.3;
      group.position.set(toX(u, v), height + Math.sin(t * 0.3 + phase) * 2, toZ(u, v));
      // Heading along the circle, banking into the turn.
      const du = -Math.sin(a) * radius * speed;
      const dv = Math.cos(a) * radius * 1.3 * speed;
      group.rotation.set(0, Math.atan2(toX(du, dv), toZ(du, dv)), -Math.sign(speed) * 0.35, 'YXZ');
      // Mostly gliding: a burst of wingbeats now and then.
      const beating = Math.sin(t * 0.4 + phase) > 0.55 ? 1 : 0.12;
      const beat = Math.sin(t * 9 + phase) * 0.55 * beating;
      for (const { shoulder, hand, s } of wings) {
        shoulder.rotation.z = s * (0.12 + beat);
        hand.rotation.z = s * (-0.2 + beat * 0.6);
      }
    });
  }

  // Sailboats crossing the bay.
  for (let i = 0; i < 3; i++) {
    const boat = gozzo(rng, true);
    scene.add(boat);
    const u = -64 - i * 11;
    const speed = (0.012 + rng() * 0.01) * (i % 2 ? 1 : -1);
    const phase = rng() * 6;
    animated.push((t) => {
      const v = -35 + Math.sin(t * speed + phase) * 65;
      boat.position.set(toX(u, v), WATER_LEVEL + Math.sin(t * 1.2 + i) * 0.1, toZ(u, v));
      const heading = Math.cos(t * speed + phase) * speed > 0 ? (3 * Math.PI) / 4 : -Math.PI / 4;
      boat.rotation.set(0, heading, Math.sin(t * 0.9 + i) * 0.06);
    });
  }

  // The lampare: fishing boats anchored off the shore, each with a lamp hung over the stern
  // to draw the fish at night. From the land they are a string of lights on the dark water.
  for (let i = 0; i < 7; i++) {
    const v = -24 + i * 13 + (rng() - 0.5) * 6;
    const u = coastU(v) - 17 - rng() * 14;
    const x = toX(u, v);
    const z = toZ(u, v);
    if (groundAt(x, z) > WATER_LEVEL - 1.5) continue;
    const boat = live(gozzo(rng));
    at(cyl(0.04, 0.05, 1.5, INK, 4), 0, 1.0, -1.7, boat);
    at(cyl(0.03, 0.03, 0.7, INK, 4), 0, 1.7, -2.0, boat).rotation.x = Math.PI / 2;
    at(ball(0.2, WARM_LIGHT, { glow: true }, 6, 4), 0, 1.5, -2.3, boat);
    boat.position.set(x, WATER_LEVEL, z);
    boat.rotation.y = rng() * Math.PI * 2;
    scene.add(boat);
    lamplight(scene, x, WATER_LEVEL + 1.5, z, 7.5);
    animated.push((t) => {
      boat.position.y = WATER_LEVEL + Math.sin(t * 1.1 + i * 1.7) * 0.09;
      boat.rotation.z = Math.sin(t * 0.9 + i) * 0.05;
    });
  }

  buildWhales(scene, animated);
  buildDolphins(scene, animated);

  // Swallows: a flock wheeling over the roofs of the main village, tightest toward evening.
  const FLOCK = 16;
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, -0.42, 0, -0.16, 0, 0, -0.04, 0, 0, 0.18, 0, 0, -0.04, 0.42, 0, -0.16], 3));
  wing.computeVertexNormals();
  const swallows = new THREE.InstancedMesh(wing, paint(0x2b2f45, { doubleSide: true }), FLOCK);
  swallows.frustumCulled = false;
  scene.add(swallows);
  const roost = { x: toX(VILLAGES[0].u, VILLAGES[0].v), z: toZ(VILLAGES[0].u, VILLAGES[0].v) };
  const roostY = groundAt(roost.x, roost.z) + 14;
  const dart = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1), e: new THREE.Euler() };
  animated.push((t, dt, climate) => {
    swallows.visible = !climate || (climate.night < 0.7 && climate.now.rain < 0.3);
    if (!swallows.visible) return;
    for (let i = 0; i < FLOCK; i++) {
      // One long figure of eight for the flock, each bird a little behind and beside the last.
      const a = t * 0.5 - i * 0.11 + Math.sin(t * 0.13 + i) * 0.3;
      const x = roost.x + Math.sin(a) * 16 + Math.sin(i * 2.4) * 1.8;
      const z = roost.z + Math.sin(a * 2) * 9 + Math.cos(i * 1.7) * 1.8;
      dart.p.set(x, roostY + Math.sin(a * 1.3 + i) * 3 + (i % 4) * 0.6, z);
      dart.q.setFromEuler(dart.e.set(0, Math.atan2(Math.cos(a) * 16, Math.cos(a * 2) * 18), Math.sin(t * 14 + i) * 0.5, 'YXZ'));
      swallows.setMatrixAt(i, dart.m.compose(dart.p, dart.q, dart.s));
    }
    swallows.instanceMatrix.needsUpdate = true;
  });

  // Fireflies: on warm nights they drift and wink over the grass at the edge of the groves.
  const FLIES = 90;
  const homes = [];
  for (let i = 0; i < FLIES * 6 && homes.length < FLIES; i++) {
    const p = randomSpot(rng, new THREE.Vector3(), 105);
    if (isWild(p.x, p.z, 1) && p.y < 20) homes.push({ p, phase: rng() * 100, rate: 0.5 + rng() * 0.8 });
  }
  const flies = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.15, 0), paint(0xe4f27a, { glow: true }), homes.length);
  flies.frustumCulled = false;
  flies.castShadow = false;
  scene.add(flies);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let out = 0;
  animated.push((t, dt, climate) => {
    const warm = climate ? Math.max(climate.season.summer, climate.season.spring * 0.6) : 0;
    const wanted = climate && climate.night > 0.6 && climate.now.rain < 0.1 && climate.now.snow < 0.1 ? warm : 0;
    out += (wanted - out) * Math.min(1, dt * 0.5);
    flies.visible = out > 0.02;
    if (!flies.visible) return;
    homes.forEach((home, i) => {
      const a = t * 0.2 * home.rate + home.phase;
      const x = home.p.x + Math.sin(a) * 2.2 + Math.sin(a * 2.7) * 0.8;
      const z = home.p.z + Math.cos(a * 0.8) * 2.2;
      p.set(x, groundAt(x, z) + 0.9 + Math.sin(a * 1.9) * 0.5, z);
      // Each one glows for a moment, then goes dark.
      const wink = Math.max(0, Math.sin(t * home.rate * 1.6 + home.phase));
      s.setScalar(wink > 0.35 && i / homes.length < out ? 1 : 0.001);
      flies.setMatrixAt(i, m.compose(p, q, s));
    });
    flies.instanceMatrix.needsUpdate = true;
  });
}

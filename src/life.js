// Things that move: butterflies over the meadows, gulls over the bay, sailboats crossing it,
// fishing boats that light their lamps at dusk, and fireflies on summer nights.
import * as THREE from 'three';
import { pick } from './noise.js';
import { PAL, WATER_LEVEL, paint, solid } from './style.js';
import { INK, WARM_LIGHT, at, ball, cyl, lamplight, live } from './kit.js';
import { gozzo } from './zones.js';
import { coastU, groundAt, isWild, randomSpot, toX, toZ } from './terrain.js';

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

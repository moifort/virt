// The avatar, Gather-style: a chibi John Difool (red quiff, ochre coat, teal shirt) who moves
// tile by tile on a grid aligned with the shore, in four directions relative to the camera,
// with a little bounce on every step. Deepo the concrete seagull flutters around him.
import * as THREE from 'three';
import { PAL, paint, solid } from './style.js';
import { WATER_LEVEL, groundAt, inSquare } from './world.js';

const TILE = 1.25;
const WALK_SPEED = 5.5;
const RUN_SPEED = 10;
const MAX_STEP = 2.6; // one terrace: climbed with a hop
const HOP = 0.55;
const PUFFS = 14;

// Grid axes in world space: u climbs toward the mountain, v runs along the shore.
const AXIS_U = new THREE.Vector3(-1, 0, -1).normalize();
const AXIS_V = new THREE.Vector3(1, 0, -1).normalize();
const DIRECTIONS = [AXIS_U, AXIS_V, AXIS_U.clone().negate(), AXIS_V.clone().negate()];

const lerpAngle = (a, b, k) => {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * k;
};
const damp = THREE.MathUtils.damp;

function part(geo, color, x, y, z, parent, opts) {
  const mesh = solid(geo, paint(color, opts));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function pivot(x, y, z, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const SHOE = 0x4a3346;
const TROUSERS = 0x3b3346;
const COAT = 0xd9b25a;
const HAIR = 0xd8642e;

/** Snaps a world position to the centre of its grid tile. */
function snapToTile(p) {
  const u = Math.round(p.dot(AXIS_U) / TILE) * TILE;
  const v = Math.round(p.dot(AXIS_V) / TILE) * TILE;
  return new THREE.Vector3().addScaledVector(AXIS_U, u).addScaledVector(AXIS_V, v);
}

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.position = this.root.position;
    this.fx = new THREE.Group(); // world-space effects: dust, Deepo
    this.facing = 0;
    this.heading = Math.atan2(DIRECTIONS[0].x, DIRECTIONS[0].z);
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.step = null; // { duration, elapsed, rise, run }
    this.steps = 0;
    this.hop = 0;
    this.blink = 0;
    this.placed = false;

    this.body = pivot(0, 0, 0, this.root);

    // Short legs and big shoes.
    this.legs = [-0.17, 0.17].map((x) => {
      const hip = pivot(x, 0.42, 0, this.body);
      part(new THREE.CylinderGeometry(0.12, 0.11, 0.28, 8), TROUSERS, 0, -0.14, 0, hip);
      part(new THREE.BoxGeometry(0.24, 0.16, 0.34), SHOE, 0, -0.32, 0.05, hip);
      return hip;
    });

    // Compact body: ochre coat over a teal shirt.
    this.torso = pivot(0, 0.4, 0, this.body);
    part(new THREE.CylinderGeometry(0.38, 0.46, 0.78, 12), COAT, 0, 0.38, 0, this.torso);
    part(new THREE.BoxGeometry(0.3, 0.62, 0.1), PAL.teal, 0, 0.44, 0.38, this.torso);
    part(new THREE.CylinderGeometry(0.44, 0.46, 0.09, 12), 0x8a6a3a, 0, 0.1, 0, this.torso);
    part(new THREE.BoxGeometry(0.14, 0.12, 0.06), PAL.saffron, 0, 0.1, 0.45, this.torso);
    for (const x of [-0.2, 0.2]) part(new THREE.BoxGeometry(0.16, 0.28, 0.3), COAT, x, 0.8, -0.04, this.torso).rotation.z = x > 0 ? -0.3 : 0.3;

    // Little arms.
    this.arms = [-1, 1].map((s) => {
      const shoulder = pivot(s * 0.42, 0.68, 0, this.torso);
      shoulder.rotation.z = s * 0.18;
      part(new THREE.CylinderGeometry(0.1, 0.11, 0.42, 6), COAT, 0, -0.2, 0, shoulder);
      part(new THREE.SphereGeometry(0.1, 8, 6), PAL.skin, 0, -0.44, 0, shoulder);
      return shoulder;
    });

    // Big round head with large dot eyes: the Gather silhouette.
    this.head = pivot(0, 1.0, 0, this.torso);
    part(new THREE.SphereGeometry(0.56, 18, 14), PAL.skin, 0, 0.5, 0, this.head);
    const hair = part(new THREE.SphereGeometry(0.58, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), HAIR, 0, 0.53, -0.04, this.head);
    hair.rotation.x = -0.35;
    part(new THREE.BoxGeometry(0.86, 0.5, 0.3), HAIR, 0, 0.36, -0.36, this.head);
    for (const x of [-0.52, 0.52]) part(new THREE.BoxGeometry(0.1, 0.36, 0.22), HAIR, x, 0.38, 0.06, this.head);
    this.quiff = pivot(0, 1.0, 0.2, this.head);
    part(new THREE.ConeGeometry(0.26, 0.7, 6), HAIR, 0, 0.12, 0.14, this.quiff, { flat: true }).rotation.x = 0.95;
    this.eyes = [-0.19, 0.19].map((x) => part(new THREE.BoxGeometry(0.11, 0.17, 0.05), PAL.ink, x, 0.5, 0.53, this.head));
    for (const x of [-0.33, 0.33]) part(new THREE.SphereGeometry(0.07, 6, 4), 0xf2a6a6, x, 0.36, 0.47, this.head).scale.z = 0.4;
    part(new THREE.BoxGeometry(0.14, 0.04, 0.04), 0x9a4a4a, 0, 0.28, 0.54, this.head);

    this.buildPuffs();
    this.buildDeepo();
  }

  buildPuffs() {
    const geo = new THREE.IcosahedronGeometry(0.2, 0);
    this.puffs = Array.from({ length: PUFFS }, () => {
      const mesh = new THREE.Mesh(geo, paint(PAL.cream, { flat: true }));
      mesh.visible = false;
      this.fx.add(mesh);
      return { mesh, life: 0, vel: new THREE.Vector3() };
    });
    this.nextPuff = 0;
  }

  puff(count, spread) {
    for (let i = 0; i < count; i++) {
      const p = this.puffs[this.nextPuff];
      this.nextPuff = (this.nextPuff + 1) % PUFFS;
      const a = Math.random() * Math.PI * 2;
      p.life = 1;
      p.mesh.visible = true;
      p.mesh.position.set(this.position.x + Math.cos(a) * 0.3, this.position.y + 0.12, this.position.z + Math.sin(a) * 0.3);
      p.vel.set(Math.cos(a) * spread, 0.7 + Math.random() * 0.5, Math.sin(a) * spread);
    }
  }

  /** Deepo, the concrete seagull: a grey stone gull with heavy wingbeats. */
  buildDeepo() {
    const concrete = 0xa9a6b4;
    this.deepo = new THREE.Group();
    const body = part(new THREE.SphereGeometry(0.32, 8, 6), concrete, 0, 0, 0, this.deepo, { flat: true });
    body.scale.set(0.8, 0.75, 1.5);
    part(new THREE.SphereGeometry(0.2, 8, 6), PAL.ivory, 0, 0.22, 0.42, this.deepo, { flat: true });
    part(new THREE.ConeGeometry(0.07, 0.32, 4), PAL.saffron, 0, 0.2, 0.7, this.deepo).rotation.x = Math.PI / 2;
    for (const x of [-0.11, 0.11]) part(new THREE.BoxGeometry(0.05, 0.05, 0.05), PAL.ink, x, 0.28, 0.55, this.deepo);
    part(new THREE.ConeGeometry(0.16, 0.4, 4), 0x7f7c8c, 0, 0.02, -0.6, this.deepo, { flat: true }).rotation.x = -Math.PI / 2;
    this.wings = [-1, 1].map((s) => {
      const shoulder = pivot(s * 0.2, 0.12, 0.05, this.deepo);
      part(new THREE.BoxGeometry(0.7, 0.05, 0.42).translate(s * 0.35, 0, 0), concrete, 0, 0, 0, shoulder, { flat: true });
      const elbow = pivot(s * 0.7, 0, 0, shoulder);
      part(new THREE.BoxGeometry(0.6, 0.05, 0.32).translate(s * 0.3, 0, -0.04), 0x5f5c6c, 0, 0, 0, elbow, { flat: true });
      return { shoulder, elbow };
    });
    this.fx.add(this.deepo);
    this.deepoTarget = new THREE.Vector3();
    this.deepoAhead = new THREE.Vector3();
  }

  /** Picks the grid direction closest to the camera-relative input, or -1 if no key is held. */
  wantedDirection(input, camYaw) {
    if (!input.forward && !input.right) return -1;
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const want = new THREE.Vector3(fx * input.forward - fz * input.right, 0, fz * input.forward + fx * input.right);
    let best = 0;
    let bestDot = -Infinity;
    DIRECTIONS.forEach((d, i) => {
      // Prefer the current facing on exact ties (diagonals), so the avatar doesn't zig-zag.
      const dot = d.dot(want) + (i === this.facing ? 1e-3 : 0);
      if (dot > bestDot) [best, bestDot] = [i, dot];
    });
    return best;
  }

  walkable(target, from) {
    const ground = groundAt(target.x, target.z);
    if (ground < WATER_LEVEL - 0.2) return false;
    if (!inSquare(target.x, target.z, 1)) return false;
    return Math.abs(ground - groundAt(from.x, from.z)) <= MAX_STEP;
  }

  update(dt, t, input, camYaw) {
    if (!this.placed) {
      this.position.copy(snapToTile(this.position));
      this.position.y = groundAt(this.position.x, this.position.z);
      this.placed = true;
    }

    // Tile-by-tile movement: start a step whenever a key is held and no step is running.
    if (!this.step) {
      const dir = this.wantedDirection(input, camYaw);
      if (dir >= 0) {
        this.facing = dir;
        const target = this.position.clone().addScaledVector(DIRECTIONS[dir], TILE);
        if (this.walkable(target, this.position)) {
          this.from.copy(this.position);
          this.to.copy(target);
          const rise = groundAt(target.x, target.z) - groundAt(this.from.x, this.from.z);
          const speed = input.run ? RUN_SPEED : WALK_SPEED;
          this.step = { duration: (TILE / speed) * (Math.abs(rise) > 1 ? 1.6 : 1), elapsed: 0, rise, run: input.run };
          this.steps++;
          if (input.run || Math.abs(rise) > 1) this.puff(2, 0.5);
        }
      }
    }

    let progress = 0;
    if (this.step) {
      this.step.elapsed += dt;
      progress = Math.min(1, this.step.elapsed / this.step.duration);
      this.position.lerpVectors(this.from, this.to, progress);
      const start = groundAt(this.from.x, this.from.z);
      const end = groundAt(this.to.x, this.to.z);
      // Terraces are climbed (or jumped down) with a little hop arcing over the ledge.
      const ledge = Math.abs(this.step.rise) > 1;
      const arc = ledge ? Math.sin(progress * Math.PI) * (HOP + Math.max(0, this.step.rise) * 0.5) : 0;
      const ground = ledge ? start + (end - start) * progress : groundAt(this.position.x, this.position.z);
      this.position.y = ground + arc;
      if (progress >= 1) {
        this.position.copy(this.to);
        this.position.y = end;
        this.step = null;
      }
    }

    // A little hop on the spot with Space.
    if (input.jump && this.hop <= 0 && !this.step) this.hop = 1;

    this.animate(dt, t, progress);
  }

  animate(dt, t, progress) {
    const dir = DIRECTIONS[this.facing];
    this.heading = lerpAngle(this.heading, Math.atan2(dir.x, dir.z), 1 - Math.exp(-dt * 25));
    this.root.rotation.y = this.heading;

    const moving = this.step ? 1 : 0;
    const side = this.steps % 2 ? 1 : -1;
    const swing = Math.sin(progress * Math.PI) * moving;

    // Gather-like step: one leg forward per tile, arms in opposition, a bounce on each tile.
    this.legs[0].rotation.x = damp(this.legs[0].rotation.x, -swing * 0.7 * side, 30, dt);
    this.legs[1].rotation.x = damp(this.legs[1].rotation.x, swing * 0.7 * side, 30, dt);
    this.arms[0].rotation.x = damp(this.arms[0].rotation.x, swing * 0.6 * side, 30, dt);
    this.arms[1].rotation.x = damp(this.arms[1].rotation.x, -swing * 0.6 * side, 30, dt);
    this.torso.rotation.z = swing * 0.06 * side;
    this.torso.rotation.x = damp(this.torso.rotation.x, moving * (this.step?.run ? 0.14 : 0.05), 12, dt);

    let lift = swing * 0.16;
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt * 2.6);
      const h = Math.sin((1 - this.hop) * Math.PI);
      lift += h * 0.8;
      this.arms[0].rotation.z = -0.18 - h * 1.2;
      this.arms[1].rotation.z = 0.18 + h * 1.2;
    } else {
      this.arms[0].rotation.z = damp(this.arms[0].rotation.z, -0.18, 12, dt);
      this.arms[1].rotation.z = damp(this.arms[1].rotation.z, 0.18, 12, dt);
    }
    const idle = 1 - moving;
    this.body.position.y = lift;
    this.body.scale.y = 1 + Math.sin(t * 2.4) * 0.025 * idle - swing * 0.04;

    // Idle: the head bobs and looks around; eyes blink every few seconds.
    this.head.rotation.y = damp(this.head.rotation.y, idle * Math.sin(t * 0.5) * 0.35, 4, dt);
    this.head.rotation.z = Math.sin(t * 1.2) * 0.03 * idle;
    this.quiff.rotation.x = Math.sin(progress * Math.PI * 2) * 0.12 * moving + Math.sin(t * 2) * 0.03;
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 2.5 + Math.random() * 2.5;
    for (const eye of this.eyes) eye.scale.y = this.blink < 0 ? 0.15 : 1;

    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt * 1.8;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 3);
      p.mesh.scale.setScalar(Math.max(0.001, Math.sin(Math.max(0, p.life) * Math.PI) * 1.2));
      if (p.life <= 0) p.mesh.visible = false;
    }

    // Deepo flutters around his shoulder, flapping hard like a bird made of concrete.
    const orbit = (k, out) => {
      const a = (t + k) * 0.9;
      return out.set(
        this.position.x + Math.cos(a) * 2.4,
        this.position.y + 3.2 + Math.sin((t + k) * 2.1) * 0.3,
        this.position.z + Math.sin(a) * 2.4,
      );
    };
    this.deepo.position.lerp(orbit(0, this.deepoTarget), 1 - Math.exp(-dt * 4));
    this.deepo.lookAt(orbit(0.3, this.deepoAhead));
    this.deepo.rotateZ(-0.3);
    const beat = Math.sin(t * 13);
    this.wings.forEach(({ shoulder, elbow }, i) => {
      const s = i === 0 ? -1 : 1;
      shoulder.rotation.z = s * beat * 0.7;
      elbow.rotation.z = s * beat * 0.4;
    });
  }
}

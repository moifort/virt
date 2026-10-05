// The hero, after John Difool from Mœbius and Jodorowsky's L'Incal: red quiff,
// long trench coat, and Deepo the concrete seagull fluttering around him.
import * as THREE from 'three';
import { PAL, paint, solid } from './style.js';
import { WATER_LEVEL, WORLD_RADIUS, groundAt } from './world.js';

const GRAVITY = 30;
const JUMP_SPEED = 10;
const WALK_SPEED = 7;
const RUN_SPEED = 13;
const SWIM_DEPTH = 0.9;
const MAX_STEP = 1.1;
const PUFFS = 14;

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

const BOOT = 0x4a3346;
const CLOTH = 0x3b3346;
const COAT = 0xd9b25a;
const HAIR = 0xd8642e;

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.position = this.root.position;
    this.fx = new THREE.Group(); // world-space effects: dust, Deepo
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.heading = 0;
    this.stride = 0;
    this.squash = 0;
    this.lastStep = 0;

    this.body = pivot(0, 0, 0, this.root);

    // Legs: trousers and boots, pivoting at the hip.
    this.legs = [-0.19, 0.19].map((x) => {
      const hip = pivot(x, 0.78, 0, this.body);
      part(new THREE.CylinderGeometry(0.12, 0.11, 0.5, 6), CLOTH, 0, -0.25, 0, hip);
      part(new THREE.BoxGeometry(0.24, 0.24, 0.36), BOOT, 0, -0.62, 0.05, hip);
      return hip;
    });

    // Torso pivots at the waist so it can lean into a run.
    this.torso = pivot(0, 0.8, 0, this.body);
    part(new THREE.CylinderGeometry(0.4, 0.5, 1.1, 12), COAT, 0, 0.48, 0, this.torso);
    part(new THREE.BoxGeometry(0.34, 0.95, 0.1), PAL.teal, 0, 0.55, 0.42, this.torso);
    part(new THREE.BoxGeometry(0.1, 0.12, 0.06), PAL.ink, 0, 0.88, 0.48, this.torso);
    part(new THREE.CylinderGeometry(0.48, 0.5, 0.1, 12), 0x8a6a3a, 0, 0.12, 0, this.torso);
    part(new THREE.BoxGeometry(0.16, 0.14, 0.06), PAL.saffron, 0, 0.12, 0.5, this.torso);
    for (const x of [-0.24, 0.24]) {
      const lapel = part(new THREE.BoxGeometry(0.2, 0.55, 0.06), COAT, x, 0.72, 0.43, this.torso);
      lapel.rotation.z = x > 0 ? -0.25 : 0.25;
    }
    // High collar, turned up.
    for (const x of [-0.22, 0.22]) {
      const collar = part(new THREE.BoxGeometry(0.16, 0.36, 0.4), COAT, x, 1.13, -0.02, this.torso);
      collar.rotation.z = x > 0 ? -0.3 : 0.3;
    }
    // Coat skirt: front panels and a back flap that swings with the stride.
    for (const x of [-0.22, 0.22]) part(new THREE.BoxGeometry(0.4, 0.75, 0.08), COAT, x, -0.3, 0.38, this.torso);
    this.coatTail = pivot(0, 0.05, -0.36, this.torso);
    part(new THREE.BoxGeometry(0.92, 0.85, 0.08).translate(0, -0.42, 0), COAT, 0, 0, 0, this.coatTail);
    part(new THREE.BoxGeometry(0.04, 0.6, 0.09).translate(0, -0.5, 0), 0x8a6a3a, 0, 0, 0, this.coatTail);

    // Arms swing from the shoulders.
    this.arms = [-1, 1].map((s) => {
      const shoulder = pivot(s * 0.42, 0.95, 0, this.torso);
      shoulder.rotation.z = s * 0.25;
      part(new THREE.CylinderGeometry(0.12, 0.14, 0.62, 6), COAT, 0, -0.3, 0, shoulder);
      part(new THREE.SphereGeometry(0.1, 6, 4), PAL.skin, 0, -0.66, 0, shoulder);
      return shoulder;
    });

    // Head, face and hat.
    this.head = pivot(0, 1.28, 0, this.torso);
    part(new THREE.SphereGeometry(0.34, 14, 10), PAL.skin, 0, 0.2, 0, this.head);
    const hair = part(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), HAIR, 0, 0.24, -0.05, this.head);
    hair.rotation.x = -0.45;
    part(new THREE.BoxGeometry(0.5, 0.42, 0.18), HAIR, 0, 0.12, -0.26, this.head); // hair down the nape
    for (const x of [-0.31, 0.31]) part(new THREE.BoxGeometry(0.07, 0.24, 0.12), HAIR, x, 0.12, 0.08, this.head);
    this.quiff = pivot(0, 0.5, 0.12, this.head);
    const quiff = part(new THREE.ConeGeometry(0.2, 0.55, 6), HAIR, 0, 0.12, 0.08, this.quiff, { flat: true });
    quiff.rotation.x = 0.9;
    for (const x of [-0.12, 0.12]) part(new THREE.BoxGeometry(0.07, 0.1, 0.04), PAL.ink, x, 0.22, 0.31, this.head);
    part(new THREE.BoxGeometry(0.08, 0.06, 0.08), 0xe8a98a, 0, 0.14, 0.34, this.head);

    this.buildPuffs();
    this.buildDeepo();
  }

  buildPuffs() {
    const geo = new THREE.IcosahedronGeometry(0.22, 0);
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
      p.mesh.position.set(this.position.x + Math.cos(a) * 0.3, this.position.y + 0.15, this.position.z + Math.sin(a) * 0.3);
      p.vel.set(Math.cos(a) * spread, 0.8 + Math.random() * 0.6, Math.sin(a) * spread);
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

  update(dt, t, input, camYaw) {
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    let wx = fx * input.forward - fz * input.right;
    let wz = fz * input.forward + fx * input.right;
    const len = Math.hypot(wx, wz);
    if (len > 1) {
      wx /= len;
      wz /= len;
    }

    const swimming = groundAt(this.position.x, this.position.z) < WATER_LEVEL - SWIM_DEPTH;
    const speed = (input.run ? RUN_SPEED : WALK_SPEED) * (swimming ? 0.5 : 1);
    const grip = 1 - Math.exp(-dt * (this.onGround ? 12 : 3));
    this.velocity.x += (wx * speed - this.velocity.x) * grip;
    this.velocity.z += (wz * speed - this.velocity.z) * grip;
    if (input.jump && this.onGround) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
      this.puff(4, 1.2);
    }
    this.velocity.y -= GRAVITY * dt;

    // Cliffs block the way unless you jump up the ledge.
    const nx = this.position.x + this.velocity.x * dt;
    const nz = this.position.z + this.velocity.z * dt;
    const ahead = Math.max(groundAt(nx, nz), WATER_LEVEL - SWIM_DEPTH);
    if (ahead - this.position.y > MAX_STEP || Math.hypot(nx, nz) > WORLD_RADIUS) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    } else {
      this.position.x = nx;
      this.position.z = nz;
    }
    const fallSpeed = this.velocity.y;
    this.position.y += this.velocity.y * dt;

    const floor = Math.max(groundAt(this.position.x, this.position.z), WATER_LEVEL - SWIM_DEPTH);
    // Stick to gentle downhill slopes instead of hopping off every shelf edge.
    const snap = this.onGround && this.velocity.y <= 0 && this.position.y - floor < 0.8;
    if (this.position.y <= floor || snap) {
      if (!this.onGround && fallSpeed < -7) {
        this.squash = Math.min(1, -fallSpeed / 18);
        this.puff(6, 2);
      }
      this.position.y = floor;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this.animate(dt, t, swimming);
  }

  animate(dt, t, swimming) {
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    if (hs > 0.5) this.heading = lerpAngle(this.heading, Math.atan2(this.velocity.x, this.velocity.z), 1 - Math.exp(-dt * 12));
    this.root.rotation.y = this.heading;

    const walk = Math.min(hs / WALK_SPEED, 1.4);
    const run = THREE.MathUtils.clamp((hs - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
    const air = this.onGround ? 0 : 1;
    this.stride += hs * dt * 1.15;
    const s = Math.sin(this.stride);

    // Legs and arms in opposition; tucked legs and raised arms in the air.
    const legSwing = s * (0.6 + run * 0.35) * walk * (1 - air);
    this.legs[0].rotation.x = damp(this.legs[0].rotation.x, legSwing - air * 0.7, 20, dt);
    this.legs[1].rotation.x = damp(this.legs[1].rotation.x, -legSwing + air * 0.4, 20, dt);
    const armSwing = s * (0.5 + run * 0.4) * walk * (1 - air);
    this.arms[0].rotation.x = damp(this.arms[0].rotation.x, -armSwing - run * 0.3, 20, dt);
    this.arms[1].rotation.x = damp(this.arms[1].rotation.x, armSwing - run * 0.3, 20, dt);
    this.arms[0].rotation.z = damp(this.arms[0].rotation.z, -0.25 - air * 0.9, 12, dt);
    this.arms[1].rotation.z = damp(this.arms[1].rotation.z, 0.25 + air * 0.9, 12, dt);

    // Lean into the run, twist with the stride, breathe when idle.
    this.torso.rotation.x = damp(this.torso.rotation.x, walk * 0.08 + run * 0.18, 8, dt);
    this.torso.rotation.y = s * 0.1 * walk;
    const idle = 1 - Math.min(walk, 1);
    const breath = Math.sin(t * 2.2) * 0.02 * idle;
    this.squash = damp(this.squash, 0, 9, dt);
    this.body.scale.set(1 + this.squash * 0.18, 1 - this.squash * 0.25 + breath, 1 + this.squash * 0.18);
    this.body.position.y = Math.abs(s) * (0.08 + run * 0.06) * walk * (1 - air) - (swimming ? 0.5 : 0);

    // Idle: the head wanders, looking around the valley.
    const look = idle * (Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.91) * 0.15);
    this.head.rotation.y = damp(this.head.rotation.y, look, 3, dt);
    this.head.rotation.x = damp(this.head.rotation.x, -run * 0.12, 6, dt);
    this.quiff.rotation.x = damp(this.quiff.rotation.x, -run * 0.35 + air * 0.3, 10, dt) + Math.abs(s) * 0.08 * walk;

    // Coat tail swings behind with the stride and flies up on a run.
    const lift = Math.min(hs / RUN_SPEED, 1);
    this.coatTail.rotation.x = damp(this.coatTail.rotation.x, 0.08 + lift * 0.55 + air * 0.4, 8, dt) + Math.sin(t * 9) * 0.04 * lift;
    this.coatTail.rotation.z = s * 0.08 * walk;

    // Dust kicked up by running feet.
    const step = Math.floor(this.stride / Math.PI);
    if (step !== this.lastStep) {
      this.lastStep = step;
      if (run > 0.4 && this.onGround && !swimming) this.puff(2, 0.6);
    }
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt * 1.6;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 3);
      p.mesh.scale.setScalar(Math.max(0.001, Math.sin(Math.max(0, p.life) * Math.PI) * 1.4));
      if (p.life <= 0) p.mesh.visible = false;
    }

    // Deepo flutters around his shoulder, flapping hard like a bird made of concrete.
    const orbit = (k, out) => {
      const a = (t + k) * 0.9;
      return out.set(
        this.position.x + Math.cos(a) * 2.6,
        this.position.y + 3.6 + Math.sin((t + k) * 2.1) * 0.35,
        this.position.z + Math.sin(a) * 2.6,
      );
    };
    this.deepo.position.lerp(orbit(0, this.deepoTarget), 1 - Math.exp(-dt * 4));
    this.deepo.lookAt(orbit(0.3, this.deepoAhead));
    this.deepo.rotateZ(-0.3);
    const beat = Math.sin(t * 13);
    this.wings.forEach(({ shoulder, elbow }, i) => {
      const side = i === 0 ? -1 : 1;
      shoulder.rotation.z = side * beat * 0.7;
      elbow.rotation.z = side * beat * 0.4;
    });
  }
}

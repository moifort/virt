// The wanderer, after Mœbius' Arzak: a lone traveller with a tall pointed hat,
// a billowing cape and a white pterodactyl gliding overhead.
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

const BOOT = 0x5b3f4e;
const CLOTH = 0x6d5a8f;

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.position = this.root.position;
    this.fx = new THREE.Group(); // world-space effects: dust, pterodactyl
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
    part(new THREE.ConeGeometry(0.68, 1.35, 12), PAL.cream, 0, 0.42, 0, this.torso);
    part(new THREE.CylinderGeometry(0.54, 0.59, 0.12, 12), PAL.ochre, 0, 0.12, 0, this.torso);
    part(new THREE.CylinderGeometry(0.33, 0.38, 0.1, 12), PAL.teal, 0, 0.66, 0, this.torso);
    part(new THREE.CylinderGeometry(0.4, 0.42, 0.1, 12), BOOT, 0, -0.1, 0, this.torso);
    part(new THREE.BoxGeometry(0.22, 0.2, 0.12), PAL.wood, 0.28, -0.12, 0.33, this.torso);

    // Billowing cape: a chain of panels hanging from the shoulders.
    part(new THREE.CylinderGeometry(0.36, 0.5, 0.18, 12), PAL.red, 0, 1.0, 0, this.torso);
    this.cape = [];
    let anchor = pivot(0, 1.0, -0.3, this.torso);
    for (let i = 0; i < 4; i++) {
      const w = 0.95 + i * 0.12;
      const panel = new THREE.BoxGeometry(w, 0.42, 0.05).translate(0, -0.21, 0);
      part(panel, i === 3 ? 0xa8343a : PAL.red, 0, 0, 0, anchor);
      this.cape.push(anchor);
      anchor = pivot(0, -0.42, 0, anchor);
    }

    // Arms swing from the shoulders.
    this.arms = [-1, 1].map((s) => {
      const shoulder = pivot(s * 0.42, 0.95, 0, this.torso);
      shoulder.rotation.z = s * 0.25;
      part(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 6), PAL.cream, 0, -0.3, 0, shoulder);
      part(new THREE.SphereGeometry(0.1, 6, 4), PAL.skin, 0, -0.66, 0, shoulder);
      return shoulder;
    });

    // Head, face and hat.
    this.head = pivot(0, 1.28, 0, this.torso);
    part(new THREE.SphereGeometry(0.34, 14, 10), PAL.skin, 0, 0.2, 0, this.head);
    const hair = part(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x4a3a52, 0, 0.22, -0.05, this.head);
    hair.rotation.x = -0.5;
    for (const x of [-0.12, 0.12]) part(new THREE.BoxGeometry(0.07, 0.1, 0.04), PAL.ink, x, 0.22, 0.31, this.head);
    part(new THREE.BoxGeometry(0.08, 0.06, 0.08), 0xe8a98a, 0, 0.14, 0.34, this.head);
    this.hat = pivot(0, 0.42, -0.02, this.head);
    this.hat.rotation.x = -0.12;
    part(new THREE.CylinderGeometry(0.56, 0.6, 0.06, 18), PAL.ivory, 0, 0, 0, this.hat);
    part(new THREE.ConeGeometry(0.36, 1.6, 14), PAL.ivory, 0, 0.82, 0, this.hat);
    part(new THREE.CylinderGeometry(0.33, 0.35, 0.12, 14), PAL.teal, 0, 0.12, 0, this.hat);
    part(new THREE.SphereGeometry(0.08, 6, 4), PAL.coral, 0, 1.64, 0, this.hat);

    this.buildPuffs();
    this.buildPterodactyl();
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

  buildPterodactyl() {
    const bone = PAL.ivory;
    this.ptero = new THREE.Group();
    const body = part(new THREE.SphereGeometry(0.5, 10, 8), bone, 0, 0, 0, this.ptero);
    body.scale.set(0.6, 0.5, 1.6);
    const head = pivot(0, 0.15, 0.85, this.ptero);
    part(new THREE.SphereGeometry(0.22, 8, 6), bone, 0, 0, 0, head);
    part(new THREE.ConeGeometry(0.13, 1.1, 6), bone, 0, -0.02, 0.6, head).rotation.x = Math.PI / 2;
    part(new THREE.ConeGeometry(0.1, 0.9, 4), PAL.coral, 0, 0.12, -0.45, head).rotation.x = -Math.PI / 2 - 0.3;
    for (const x of [-0.13, 0.13]) part(new THREE.BoxGeometry(0.05, 0.06, 0.06), PAL.ink, x, 0.06, 0.12, head);
    part(new THREE.ConeGeometry(0.1, 1.1, 4), bone, 0, 0, -1.2, this.ptero).rotation.x = -Math.PI / 2;
    this.wings = [-1, 1].map((s) => {
      const shoulder = pivot(s * 0.25, 0.05, 0.15, this.ptero);
      part(new THREE.BoxGeometry(1.7, 0.06, 1.6).translate(s * 0.85, 0, -0.35), bone, 0, 0, 0, shoulder);
      const elbow = pivot(s * 1.7, 0, 0, shoulder);
      const tip = new THREE.ConeGeometry(0.8, 2.6, 3).rotateZ((-s * Math.PI) / 2).translate(s * 1.3, 0, -0.3);
      const outer = part(tip, bone, 0, 0, 0, elbow);
      outer.scale.y = 0.12;
      return { shoulder, elbow };
    });
    this.ptero.scale.setScalar(1.3);
    this.fx.add(this.ptero);
    this.pteroTarget = new THREE.Vector3();
    this.pteroAhead = new THREE.Vector3();
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
    this.hat.rotation.z = Math.sin(t * 1.7) * 0.03 + s * 0.04 * walk;

    // Cape: hangs at rest, billows behind at speed, ripples always.
    const lift = Math.min(hs / RUN_SPEED, 1);
    this.cape.forEach((seg, i) => {
      const wave = Math.sin(t * 7 - i * 0.9) * (0.06 + 0.12 * lift);
      const target = (i === 0 ? 0.12 : 0.04) + lift * (0.35 + i * 0.12) + air * 0.35 + wave;
      seg.rotation.x = damp(seg.rotation.x, target, 7, dt);
      seg.rotation.z = Math.sin(t * 2.3 - i * 0.7) * 0.04 * (1 + lift);
    });

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

    // The white pterodactyl circles overhead, gliding with a few lazy wingbeats.
    const orbit = (k) => {
      const a = (t + k) * 0.32;
      return this.pteroTarget.set(
        this.position.x + Math.cos(a) * 10,
        this.position.y + 9 + Math.sin((t + k) * 0.7) * 1.2,
        this.position.z + Math.sin(a) * 10,
      );
    };
    const goal = orbit(0).clone();
    this.ptero.position.lerp(goal, 1 - Math.exp(-dt * 2));
    this.ptero.lookAt(this.pteroAhead.copy(orbit(0.6)));
    this.ptero.rotateZ(-0.35); // banking into the turn
    const flapping = Math.sin(t * 0.45) > 0.2;
    const beat = flapping ? Math.sin(t * 5) : Math.sin(t * 1.2) * 0.15;
    this.wings.forEach(({ shoulder, elbow }, i) => {
      const side = i === 0 ? -1 : 1;
      shoulder.rotation.z = side * (beat * 0.55 + 0.05);
      elbow.rotation.z = side * beat * 0.35;
    });
  }
}

// The wanderer: red cloak, wide hat, scarf in the wind.
import * as THREE from 'three';
import { PAL, inked, toon } from './style.js';
import { WATER_LEVEL, WORLD_RADIUS, groundAt } from './world.js';

const GRAVITY = 30;
const JUMP_SPEED = 11;
const WALK_SPEED = 8;
const RUN_SPEED = 17;
const SWIM_DEPTH = 0.9;

const lerpAngle = (a, b, k) => {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * k;
};

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.position = this.root.position;
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.heading = 0;
    this.stride = 0;

    const cloak = inked(new THREE.ConeGeometry(0.85, 2.0, 12), toon(PAL.red), 0.05);
    cloak.position.y = 1.15;
    const head = inked(new THREE.SphereGeometry(0.36, 14, 10), toon(PAL.skin), 0.04);
    head.position.y = 2.3;
    const brim = inked(new THREE.CylinderGeometry(1.05, 1.1, 0.07, 20), toon(PAL.ivory), 0.04);
    brim.position.y = 2.55;
    const crown = inked(new THREE.ConeGeometry(0.42, 0.75, 12), toon(PAL.ivory), 0.04);
    crown.position.y = 2.9;

    this.scarf = new THREE.Group();
    this.scarf.position.set(0, 2.05, -0.25);
    const band = inked(new THREE.BoxGeometry(0.28, 0.05, 1.8), toon(PAL.saffron), 0.03);
    band.position.z = -0.9;
    this.scarf.add(band);

    this.body = new THREE.Group();
    this.body.add(cloak, head, brim, crown, this.scarf);
    this.legs = [-0.25, 0.25].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.6, 0);
      const leg = inked(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6), toon(PAL.plum), 0.04);
      leg.position.y = -0.3;
      pivot.add(leg);
      return pivot;
    });
    this.root.add(this.body, ...this.legs);
  }

  update(dt, t, input, camYaw) {
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    let wx = fx * input.forward + -fz * input.right;
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
    }
    this.velocity.y -= GRAVITY * dt;
    this.position.addScaledVector(this.velocity, dt);

    const r = Math.hypot(this.position.x, this.position.z);
    if (r > WORLD_RADIUS) {
      this.position.x *= WORLD_RADIUS / r;
      this.position.z *= WORLD_RADIUS / r;
    }

    const floor = Math.max(groundAt(this.position.x, this.position.z), WATER_LEVEL - SWIM_DEPTH);
    // Stick to gentle downhill slopes instead of hopping off every shelf edge.
    const snap = this.onGround && this.velocity.y <= 0 && this.position.y - floor < 0.8;
    if (this.position.y <= floor || snap) {
      this.position.y = floor;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this.animate(dt, t);
  }

  animate(dt, t) {
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    if (hs > 0.5) this.heading = lerpAngle(this.heading, Math.atan2(this.velocity.x, this.velocity.z), 1 - Math.exp(-dt * 10));
    this.root.rotation.y = this.heading;

    this.stride += hs * dt * 0.9;
    const swing = Math.min(hs / WALK_SPEED, 1.4) * (this.onGround ? 1 : 0.2);
    this.legs[0].rotation.x = Math.sin(this.stride) * 0.7 * swing;
    this.legs[1].rotation.x = -Math.sin(this.stride) * 0.7 * swing;
    this.body.position.y = Math.abs(Math.sin(this.stride)) * 0.12 * swing;

    const lift = Math.min(hs / RUN_SPEED, 1);
    this.scarf.rotation.x = -1.2 + lift * 1.3 + Math.sin(t * 9) * 0.12 * (0.3 + lift);
    this.scarf.rotation.z = Math.sin(t * 5) * 0.12 * lift;
  }
}

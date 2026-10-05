// The avatar, Gather-style: a chibi seaplane pilot after Porco Rosso (a pig's snout and ears,
// moustache, round dark glasses, trench coat and felt hat) who moves tile by tile on a grid
// aligned with the screen, so each arrow walks straight along its own axis, with a little
// bounce on every step. A seagull flutters around him.
import * as THREE from 'three';
import { PAL, paint, solid } from './style.js';
import { WATER_LEVEL, groundAt, inSquare } from './world.js';

const TILE = 1.25;
const WALK_SPEED = 5.5;
const RUN_SPEED = 10;
const MAX_STEP = 2.6; // one terrace: climbed with a hop
const HOP = 0.55;
const PUFFS = 14;

// Grid axes in world space. The camera rests on quarter turns around the island, so these are
// always the vertical and horizontal axes of the screen.
const AXIS_U = new THREE.Vector3(0, 0, -1);
const AXIS_V = new THREE.Vector3(1, 0, 0);
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

const SHOE = 0x5a4034;
const TROUSERS = 0x4a4658;
const COAT = 0xcfb387;
const COAT_SHADE = 0xb89a6c;
const BELT = 0x7a5a44;
const SKIN = 0xeab99a;
const SNOUT = 0xdfa286;
const MOUSTACHE = 0x4a3a34;
const HAT = 0xbfa678;

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
    this.fx = new THREE.Group(); // world-space effects: dust, the gull
    this.facing = 0;
    this.heading = Math.atan2(DIRECTIONS[0].x, DIRECTIONS[0].z);
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.step = null; // { duration, elapsed, rise, run }
    this.steps = 0;
    this.hop = 0;
    this.blink = 0;
    this.placed = false;
    this.seat = null; // the seat he is sitting on, if any
    this.perch = new THREE.Vector3();

    this.body = pivot(0, 0, 0, this.root);

    // Short legs and big shoes.
    this.legs = [-0.17, 0.17].map((x) => {
      const hip = pivot(x, 0.42, 0, this.body);
      part(new THREE.CylinderGeometry(0.12, 0.11, 0.28, 8), TROUSERS, 0, -0.14, 0, hip);
      part(new THREE.BoxGeometry(0.24, 0.16, 0.34), SHOE, 0, -0.32, 0.05, hip);
      return hip;
    });

    // Compact body: a belted trench coat with its collar up, over a white shirt and a red tie.
    this.torso = pivot(0, 0.4, 0, this.body);
    part(new THREE.CylinderGeometry(0.38, 0.5, 0.95, 12), COAT, 0, 0.3, 0, this.torso);
    part(new THREE.BoxGeometry(0.26, 0.34, 0.1), PAL.ivory, 0, 0.6, 0.36, this.torso);
    part(new THREE.BoxGeometry(0.08, 0.3, 0.05), PAL.red, 0, 0.58, 0.42, this.torso);
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.14, 0.36, 0.06), COAT_SHADE, s * 0.17, 0.6, 0.4, this.torso).rotation.z = s * 0.3;
    part(new THREE.CylinderGeometry(0.455, 0.47, 0.09, 12), BELT, 0, 0.26, 0, this.torso);
    part(new THREE.BoxGeometry(0.14, 0.12, 0.06), PAL.saffron, 0, 0.26, 0.46, this.torso);
    for (const x of [-0.2, 0.2]) part(new THREE.BoxGeometry(0.16, 0.28, 0.3), COAT, x, 0.8, -0.04, this.torso).rotation.z = x > 0 ? -0.3 : 0.3;

    // Little arms.
    this.arms = [-1, 1].map((s) => {
      const shoulder = pivot(s * 0.42, 0.68, 0, this.torso);
      shoulder.rotation.z = s * 0.18;
      part(new THREE.CylinderGeometry(0.1, 0.11, 0.42, 6), COAT, 0, -0.2, 0, shoulder);
      part(new THREE.CylinderGeometry(0.115, 0.115, 0.07, 6), COAT_SHADE, 0, -0.36, 0, shoulder);
      part(new THREE.SphereGeometry(0.1, 8, 6), SKIN, 0, -0.44, 0, shoulder);
      return shoulder;
    });

    // Big round head, Gather-sized: a pig's snout and ears, a pilot's moustache, round dark
    // glasses that catch the light.
    this.head = pivot(0, 1.0, 0, this.torso);
    part(new THREE.SphereGeometry(0.56, 18, 14), SKIN, 0, 0.5, 0, this.head);
    part(new THREE.CylinderGeometry(0.2, 0.23, 0.2, 10), SNOUT, 0, 0.4, 0.55, this.head).rotation.x = Math.PI / 2;
    for (const x of [-0.08, 0.08]) part(new THREE.BoxGeometry(0.06, 0.09, 0.03), 0x9a5a52, x, 0.41, 0.655, this.head);
    for (const s of [-1, 1]) {
      part(new THREE.BoxGeometry(0.22, 0.08, 0.06), MOUSTACHE, s * 0.16, 0.25, 0.56, this.head).rotation.z = -s * 0.45;
      const ear = part(new THREE.ConeGeometry(0.15, 0.32, 4), SKIN, s * 0.52, 0.72, -0.04, this.head, { flat: true });
      ear.rotation.z = -s * 1.0;
      part(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10), PAL.ink, s * 0.21, 0.61, 0.5, this.head).rotation.x = Math.PI / 2;
      part(new THREE.SphereGeometry(0.07, 6, 4), 0xf2a6a6, s * 0.38, 0.4, 0.42, this.head).scale.z = 0.4;
    }
    part(new THREE.BoxGeometry(0.16, 0.04, 0.04), PAL.ink, 0, 0.63, 0.52, this.head);
    this.eyes = [-0.17, 0.25].map((x) => part(new THREE.BoxGeometry(0.05, 0.07, 0.03), PAL.ivory, x, 0.66, 0.535, this.head));
    // A soft felt hat with a dark band, worn a little forward.
    this.hat = pivot(0, 0.94, 0.02, this.head);
    this.hat.rotation.x = 0.08;
    part(new THREE.CylinderGeometry(0.66, 0.68, 0.06, 14), HAT, 0, 0, 0, this.hat);
    part(new THREE.CylinderGeometry(0.4, 0.46, 0.36, 12), HAT, 0, 0.2, 0, this.hat);
    part(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 12), BELT, 0, 0.08, 0, this.hat);

    this.buildPuffs();
    this.buildGull();
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

  /** The gull that keeps him company: white, grey-winged, never far from his shoulder. */
  buildGull() {
    const plumage = 0xf1efea;
    this.gull = new THREE.Group();
    const body = part(new THREE.SphereGeometry(0.32, 8, 6), plumage, 0, 0, 0, this.gull, { flat: true });
    body.scale.set(0.8, 0.75, 1.5);
    part(new THREE.SphereGeometry(0.2, 8, 6), PAL.ivory, 0, 0.22, 0.42, this.gull, { flat: true });
    part(new THREE.ConeGeometry(0.07, 0.32, 4), PAL.saffron, 0, 0.2, 0.7, this.gull).rotation.x = Math.PI / 2;
    for (const x of [-0.11, 0.11]) part(new THREE.BoxGeometry(0.05, 0.05, 0.05), PAL.ink, x, 0.28, 0.55, this.gull);
    part(new THREE.ConeGeometry(0.16, 0.4, 4), 0xd8dae0, 0, 0.02, -0.6, this.gull, { flat: true }).rotation.x = -Math.PI / 2;
    this.wings = [-1, 1].map((s) => {
      const shoulder = pivot(s * 0.2, 0.12, 0.05, this.gull);
      part(new THREE.BoxGeometry(0.7, 0.05, 0.42).translate(s * 0.35, 0, 0), plumage, 0, 0, 0, shoulder, { flat: true });
      const elbow = pivot(s * 0.7, 0, 0, shoulder);
      part(new THREE.BoxGeometry(0.6, 0.05, 0.32).translate(s * 0.3, 0, -0.04), 0x8f97a6, 0, 0, 0, elbow, { flat: true });
      return { shoulder, elbow };
    });
    this.fx.add(this.gull);
    this.gullTarget = new THREE.Vector3();
    this.gullAhead = new THREE.Vector3();
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

  /** Sits down on a seat of the world ({ position, yaw }): hips on it, facing the way it faces. */
  sit(seat) {
    this.seat = seat;
    this.step = null;
    this.perch = seat.position.clone();
    this.perch.y -= 0.42;
  }

  /** Gets up, back onto the nearest tile. */
  stand() {
    this.seat = null;
    this.position.copy(snapToTile(this.position));
    this.position.y = groundAt(this.position.x, this.position.z);
    this.hop = 1;
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

    // Seated: he stays put until a direction or a hop gets him up again.
    if (this.seat) {
      if (this.wantedDirection(input, camYaw) < 0 && !input.jump) {
        this.position.lerp(this.perch, 1 - Math.exp(-dt * 12));
        this.animate(dt, t, 0);
        return;
      }
      this.stand();
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
    this.heading = lerpAngle(this.heading, this.seat ? this.seat.yaw : Math.atan2(dir.x, dir.z), 1 - Math.exp(-dt * (this.seat ? 10 : 25)));
    this.root.rotation.y = this.heading;

    const moving = this.step ? 1 : 0;
    const side = this.steps % 2 ? 1 : -1;
    const swing = Math.sin(progress * Math.PI) * moving;

    // Gather-like step: one leg forward per tile, arms in opposition, a bounce on each tile.
    // Seated, both legs come forward and the hands rest on the knees.
    const sat = this.seat ? 1 : 0;
    this.legs[0].rotation.x = damp(this.legs[0].rotation.x, sat ? -1.45 : -swing * 0.7 * side, sat ? 12 : 30, dt);
    this.legs[1].rotation.x = damp(this.legs[1].rotation.x, sat ? -1.45 : swing * 0.7 * side, sat ? 12 : 30, dt);
    this.arms[0].rotation.x = damp(this.arms[0].rotation.x, sat ? -0.5 : swing * 0.6 * side, sat ? 12 : 30, dt);
    this.arms[1].rotation.x = damp(this.arms[1].rotation.x, sat ? -0.5 : -swing * 0.6 * side, sat ? 12 : 30, dt);
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
    this.hat.rotation.x = 0.08 + Math.sin(progress * Math.PI * 2) * 0.06 * moving + Math.sin(t * 2) * 0.015;
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

    // The gull flutters around his shoulder.
    const orbit = (k, out) => {
      const a = (t + k) * 0.9;
      return out.set(
        this.position.x + Math.cos(a) * 2.4,
        this.position.y + 3.2 + Math.sin((t + k) * 2.1) * 0.3,
        this.position.z + Math.sin(a) * 2.4,
      );
    };
    this.gull.position.lerp(orbit(0, this.gullTarget), 1 - Math.exp(-dt * 4));
    this.gull.lookAt(orbit(0.3, this.gullAhead));
    this.gull.rotateZ(-0.3);
    const beat = Math.sin(t * 13);
    this.wings.forEach(({ shoulder, elbow }, i) => {
      const s = i === 0 ? -1 : 1;
      shoulder.rotation.z = s * beat * 0.7;
      elbow.rotation.z = s * beat * 0.4;
    });
  }
}

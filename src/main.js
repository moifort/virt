import * as THREE from 'three';
import { PixelCamera, PixelRenderer } from './pixel.js';
import { Player } from './player.js';
import { GLOBALS } from './style.js';
import { SUN_DIR, createWorld, groundAt } from './world.js';

const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- Renderer, scene, light

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);
const pixels = new PixelRenderer(renderer, 2);
const view = new PixelCamera();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 1, 2);

// Perpetual late afternoon, as in Bob's VR: warm sun, lavender shade.
const SKY_TOP = new THREE.Color(0x8fd3e0);
const SKY_HORIZON = new THREE.Color(0xf8d3a8);
GLOBALS.uSunTint.value.set(0xfff0d6);
GLOBALS.uShadowTint.value.set(0xb4a6dc);
GLOBALS.uGlow.value = 0.7;
scene.fog.color.copy(SKY_HORIZON);

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);

const world = createWorld(scene);
const player = new Player();
player.position.set(2, groundAt(2, 20), 20);
scene.add(player.root, player.fx);

function resize() {
  pixels.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- Input
// KeyboardEvent.code is layout-independent: WASD on QWERTY is ZQSD on AZERTY.

const keys = new Set();
// Keys pressed since the last frame: a quick tap still moves one tile, as in Gather.
const tapped = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  tapped.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  // A / E on AZERTY (KeyQ / KeyE codes) turn the view by an eighth of a turn.
  if (e.code === 'KeyQ') yawTarget += Math.PI / 4;
  if (e.code === 'KeyE') yawTarget -= Math.PI / 4;
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let yawTarget = view.yaw;
let dragging = false;
renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yawTarget -= e.movementX * 0.006;
  view.pitch = clamp(view.pitch + e.movementY * 0.004, 0.35, 1.2);
});
addEventListener('wheel', (e) => (view.viewHeight = clamp(view.viewHeight * (1 + Math.sign(e.deltaY) * 0.1), 24, 140)), {
  passive: true,
});

/** @param {boolean} consume forget taps once the avatar is free to take them */
function readInput(consume) {
  const k = (code) => (keys.has(code) || tapped.has(code) ? 1 : 0);
  const input = {
    forward: k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown'),
    right: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'),
    run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: k('Space') > 0,
  };
  if (consume) tapped.clear();
  return input;
}

// ---------------------------------------------------------------- Loop

const clock = new THREE.Clock();
const focus = new THREE.Vector3();
let t = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  view.yaw += (yawTarget - view.yaw) * (1 - Math.exp(-dt * 8));
  player.update(dt, t, readInput(!player.step), view.yaw);
  world.update(t, dt);

  GLOBALS.uTime.value = t;
  GLOBALS.uCloud.value.set(t * 0.035, t * 0.012);

  focus.copy(player.position).y += 1.4;
  view.update(focus, pixels.lowRes, pixels.offset);
  scene.fog.near = view.distance + 40;
  scene.fog.far = view.distance + 200;

  sun.target.position.copy(player.position);
  sun.position.copy(player.position).addScaledVector(SUN_DIR, 120);

  pixels.render(scene, view.camera, { skyTop: SKY_TOP, skyHorizon: SKY_HORIZON, texelWorld: view.texelWorld });
});

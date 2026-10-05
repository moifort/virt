import * as THREE from 'three';
import { PixelCamera, PixelRenderer } from './pixel.js';
import { Player } from './player.js';
import { GLOBALS } from './style.js';
import { Climate } from './climate.js';
import { CORNERS, WATER_LEVEL, createWorld, groundAt } from './world.js';

const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- Renderer, scene, light

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);
const pixels = new PixelRenderer(renderer, 2);
const view = new PixelCamera();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 1, 2);

// Hour, season and weather are the real ones where the player is: see climate.js.
const climate = new Climate();

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

// For looking around while building the map: `?at=x,z` drops the avatar there, `?zoom=` sets the
// height of the view, `?yaw=` its corner in quarter turns; `virt` in the console holds the rest.
const params = new URLSearchParams(location.search);
if (params.has('at')) {
  const [x, z] = params.get('at').split(',').map(Number);
  player.position.set(x, groundAt(x, z), z);
}
if (params.has('zoom')) view.viewHeight = Number(params.get('zoom'));
if (params.has('yaw')) view.yaw = (Number(params.get('yaw')) * Math.PI) / 2;
globalThis.virt = { climate, player, view, scene };

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
  if (!e.repeat) climate.key(e.code, true);
  // A / E on AZERTY (KeyQ / KeyE codes) turn the view to the next isometric corner.
  if (e.code === 'KeyQ') yawTarget = snapYaw(yawTarget) + Math.PI / 2;
  if (e.code === 'KeyE') yawTarget = snapYaw(yawTarget) - Math.PI / 2;
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  climate.key(e.code, false);
});
addEventListener('blur', () => keys.clear());

// Isometric-style view: the pitch is fixed and the yaw rests on one of the four corners of the
// diorama. Dragging turns the island; on release it settles on the nearest corner.
const snapYaw = (yaw) => Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
let yawTarget = view.yaw;
let dragging = false;
renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => {
  if (dragging) yawTarget = snapYaw(yawTarget);
  dragging = false;
});
addEventListener('pointermove', (e) => {
  if (dragging) yawTarget -= e.movementX * 0.006;
});
addEventListener('wheel', (e) => (view.viewHeight = clamp(view.viewHeight * (1 + Math.sign(e.deltaY) * 0.1), 24, 220)), {
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
const ahead = new THREE.Vector2();
let t = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  view.yaw += (yawTarget - view.yaw) * (1 - Math.exp(-dt * 8));
  player.update(dt, t, readInput(!player.step), snapYaw(view.yaw));
  climate.update(dt);
  world.update(t, dt, climate);

  GLOBALS.uTime.value = t;
  GLOBALS.uCloud.value.set(t * 0.035, t * 0.012);

  focus.copy(player.position).y += 1.4;
  view.update(focus, pixels.lowRes, pixels.offset);
  scene.fog.color.copy(climate.skyHorizon);
  scene.fog.near = view.distance + 60 - 240 * (1 - climate.visibility);
  scene.fog.far = view.distance + 520 * climate.visibility;

  sun.target.position.copy(player.position);
  sun.position.copy(player.position).addScaledVector(climate.lightDir, 120);

  // The sea runs out to a horizon a little way behind the far corner of the diorama, so the
  // mountain stands against the sky; the sky is painted from that line up.
  ahead.set(view.forward.x, view.forward.z).normalize();
  const offing = Math.max(...CORNERS.map(([x, z]) => x * ahead.x + z * ahead.y)) + 30;
  GLOBALS.uHorizon.value.set(ahead.x, ahead.y, offing);
  const horizon = focus.set(ahead.x * offing, WATER_LEVEL, ahead.y * offing).project(view.camera).y * 0.5 + 0.5;

  // How far the wind pushes the rain sideways on screen.
  const weather = climate.screen;
  weather.horizon = horizon;
  weather.slant = (climate.wind.x * view.right.x + climate.wind.y * view.right.z) * weather.wind;
  pixels.render(scene, view.camera, { skyTop: climate.skyTop, skyHorizon: climate.skyHorizon, texelWorld: view.texelWorld, time: t, weather });
});

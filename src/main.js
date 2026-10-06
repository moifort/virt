import * as THREE from 'three';
import { PixelCamera, PixelRenderer } from './pixel.js';
import { Player } from './player.js';
import { GLOBALS, PAL, paint } from './style.js';
import { Climate } from './climate.js';
import { LAND_ENDS, WATER_LEVEL, createWorld, groundAt } from './world.js';

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

// Sitting down: the seat within reach, and the marker that points it out.
let seatAtHand = null;
const seatMark = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4).rotateX(Math.PI), paint(PAL.saffron, { glow: true, flat: true }));
seatMark.visible = false;
scene.add(seatMark);

// For looking around while building the map: `?at=x,z` drops the avatar there, `?zoom=` sets the
// height of the view, `?yaw=` its corner in quarter turns; `virt` in the console holds the rest.
const params = new URLSearchParams(location.search);
if (params.has('at')) {
  const [x, z] = params.get('at').split(',').map(Number);
  player.position.set(x, groundAt(x, z), z);
}
if (params.has('zoom')) view.viewHeight = Number(params.get('zoom'));
if (params.has('yaw')) view.yaw = (Number(params.get('yaw')) * Math.PI) / 2;
globalThis.virt = { climate, player, view, scene, sun, renderer, pixels };

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
  // F or Enter: sit down on the seat at hand, or get up.
  if ((e.code === 'KeyF' || e.code === 'Enter') && !e.repeat) {
    if (player.seat) player.stand();
    else if (seatAtHand) player.sit(seatAtHand);
  }
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  climate.key(e.code, false);
});
addEventListener('blur', () => keys.clear());

// Isometric-style view: the pitch is fixed and the yaw rests on one of the four corners of the
// island (A and E turn it to the next). Dragging with the mouse slides the view over the map to
// look around; as soon as the avatar walks again, the view comes back to him.
const snapYaw = (yaw) => Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
let yawTarget = view.yaw;
let dragging = false;
const pan = new THREE.Vector3();
renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  // The map follows the hand: a screen pixel is so many metres across, and more than that
  // along the ground up the screen, which the view looks at aslant.
  const metres = view.viewHeight / innerHeight;
  pan.addScaledVector(view.right, -e.movementX * metres);
  pan.x += (view.forward.x / Math.hypot(view.forward.x, view.forward.z)) * ((e.movementY * metres) / Math.sin(view.pitch));
  pan.z += (view.forward.z / Math.hypot(view.forward.x, view.forward.z)) * ((e.movementY * metres) / Math.sin(view.pitch));
  pan.y = 0;
  pan.clampLength(0, 320);
});
addEventListener('wheel', (e) => (view.viewHeight = clamp(view.viewHeight * (1 + Math.sign(e.deltaY) * 0.1), 24, 260)), {
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
const sunSpot = new THREE.Vector3();
const moonSpot = new THREE.Vector3();
// The axes of the shadow map in the world: across the light, as three.js lays the map out.
const sunRight = new THREE.Vector3();
const sunUp = new THREE.Vector3();
let t = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  view.yaw += (yawTarget - view.yaw) * (1 - Math.exp(-dt * 8));
  player.update(dt, t, readInput(!player.step), snapYaw(view.yaw));
  climate.update(dt);
  world.update(t, dt, climate);

  // The nearest seat within reach, if he is standing still: a little marker bobs over it.
  seatAtHand = null;
  if (!player.seat && !player.step) {
    let nearest = 2.6;
    for (const seat of world.seats) {
      const d = Math.hypot(seat.position.x - player.position.x, seat.position.z - player.position.z);
      if (d < nearest && Math.abs(seat.position.y - player.position.y) < 3) [nearest, seatAtHand] = [d, seat];
    }
  }
  seatMark.visible = seatAtHand !== null;
  if (seatAtHand) seatMark.position.copy(seatAtHand.position).setY(seatAtHand.position.y + 1.9 + Math.sin(t * 4) * 0.12);

  GLOBALS.uTime.value = t;
  GLOBALS.uCloud.value.set(t * 0.035, t * 0.012);

  // Seen from far off the pixels are drawn finer, so the picture stays readable instead of
  // breaking up into grain: two screen pixels to an art pixel up close, down to one far out.
  const grain = view.viewHeight > 190 ? 1 : view.viewHeight > 120 ? 1.5 : 2;
  if (grain !== pixels.pixelSize) {
    pixels.pixelSize = grain;
    resize();
  }

  if (player.step) pan.multiplyScalar(Math.exp(-dt * 6));
  focus.copy(player.position).add(pan).y += 1.4;
  view.update(focus, pixels.lowRes, pixels.offset);
  scene.fog.color.copy(climate.skyHorizon);
  scene.fog.near = view.distance + 60 - 240 * (1 - climate.visibility);
  scene.fog.far = view.distance + 520 * climate.visibility;

  // Shadows are cast over whatever the view takes in, wider as it draws back.
  const reach = Math.max(60, view.viewHeight * 0.62);
  if (reach !== sun.shadow.camera.right) {
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, far: 260 + reach });
    sun.shadow.camera.updateProjectionMatrix();
  }
  // The shadow camera follows the view, but only by whole texels of its map, measured across
  // the light: otherwise every slide of the view resamples the map on a shifted grid and the
  // edges of the shadows crawl over the ground.
  sunRight.set(0, 1, 0).cross(climate.lightDir).normalize();
  sunUp.crossVectors(climate.lightDir, sunRight);
  const shadowTexel = (2 * reach) / sun.shadow.mapSize.x;
  const snap = (axis) => {
    const along = sun.target.position.dot(axis);
    sun.target.position.addScaledVector(axis, Math.round(along / shadowTexel) * shadowTexel - along);
  };
  sun.target.position.copy(player.position).add(pan);
  snap(sunRight);
  snap(sunUp);
  sun.position.copy(sun.target.position).addScaledVector(climate.lightDir, 120 + reach * 0.5);
  // The road the low sun, or the moon, lays on the sea runs through the middle of the view.
  const level = Math.hypot(climate.lightDir.x, climate.lightDir.z) || 1;
  const across = { x: -climate.lightDir.z / level, z: climate.lightDir.x / level };
  GLOBALS.uSunPath.value.set(across.x, across.z, player.position.x * across.x + player.position.z * across.z, Math.max(climate.lowSun, climate.night * 0.5));

  // The sea runs out to a horizon a little way behind the last of the land, so the
  // mountain stands against the sky; the sky is painted from that line up.
  ahead.set(view.forward.x, view.forward.z).normalize();
  const offing = Math.max(...LAND_ENDS.map(([x, z]) => x * ahead.x + z * ahead.y)) + 30;
  GLOBALS.uHorizon.value.set(ahead.x, ahead.y, offing);
  focus.set(ahead.x * offing, WATER_LEVEL, ahead.y * offing);
  const weather = climate.screen;
  // The last of the sea before that line is drawn without an outline, so no seam shows.
  weather.offing = focus.clone().sub(view.camera.position).dot(view.forward) - view.camera.near - 16;
  weather.horizon = focus.project(view.camera).y * 0.5 + 0.5;
  // Where the sun and the moon stand in the painted sky: across the screen by their bearing
  // from the way the view looks, above the horizon by their height. The moon is opposite the sun.
  for (const [body, sign, spot] of [['sun', 1, sunSpot], ['moon', -1, moonSpot]]) {
    const bearing = Math.atan2((climate.sunDir.x * view.right.x + climate.sunDir.z * view.right.z) * sign, (climate.sunDir.x * ahead.x + climate.sunDir.z * ahead.y) * sign);
    weather[body] = spot.set(0.5 + bearing / 1.7, Math.asin(clamp(climate.sunDir.y * sign, -1, 1)) / 1.15, Math.abs(bearing) < 1.4 ? 1 : 0);
  }
  // How far the wind pushes the rain sideways on screen.
  weather.slant = (climate.wind.x * view.right.x + climate.wind.y * view.right.z) * weather.wind;
  pixels.render(scene, view.camera, { skyTop: climate.skyTop, skyHorizon: climate.skyHorizon, texelWorld: view.texelWorld, time: t, weather });
});

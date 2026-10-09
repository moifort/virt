import * as THREE from 'three';
import { PixelCamera, PixelRenderer } from './pixel.js';
import { Player } from './player.js';
import { GLOBALS, PAL, paint } from './style.js';
import { Climate } from './climate.js';
import { dayNightSwitch } from './daynight.js';
import { seasonSwitch } from './season.js';
import { weatherSwitch } from './weather.js';
import { LAND_ENDS, SQUARE, WATER_LEVEL, createWorld, groundAt, toX, toZ } from './world.js';
import OPENING from '../assets/loading/opening.json' with { type: 'json' };

const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- Renderer, scene, light

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.shadowMap.enabled = true;
// The shadow map covers the whole island, so drawing it is a third of a frame. It is
// redrawn every other frame: the sun hardly moves in between, and whatever walks, sails or
// grazes is never more than a pixel behind its shadow.
renderer.shadowMap.autoUpdate = false;
document.body.prepend(renderer.domElement);
const pixels = new PixelRenderer(renderer, 2);
const view = new PixelCamera();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 1, 2);

// Hour, season and weather are the real ones where the player is: see climate.js.
const climate = new Climate();
const dayNight = dayNightSwitch(climate);
const seasons = seasonSwitch(climate);
const skies = weatherSwitch(climate);

// The sun casts its shadows over the whole island at once, from a camera fixed in the world:
// if it followed the view, the mountain would leave its frame as the view slid away and the
// long shadows it throws across the valley would come and go with every move of the map.
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.08;
scene.add(sun, sun.target);

const world = createWorld(scene);
const player = new Player();
// He starts on the Agora, in front of the Arbre-Mère, clear of the groves around the square.
player.position.set(2, groundAt(2, 8), 8);
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
// The map opens on the shot blurred behind the loading screen (see shoot.js): the same
// view, at the same hour and in the same weather, which then run on to the player's own. A view
// or a moment asked for in the address bar takes its place.
const opensOnShot = !['at', 'zoom', 'yaw', 'hour', 'day', 'weather', 'bench', 'tour'].some((name) => params.has(name));
// The sunrise the map opens with, once the loading screen has gone: how many hours it runs
// through from the shot's moment, and how long it takes.
const SUNRISE = { hours: 2.75, seconds: 11 };
if (opensOnShot) {
  const { yaw, pitch, viewHeight } = OPENING.view;
  Object.assign(view, { yaw, pitch, viewHeight });
  climate.preview(OPENING.moment);
}
// The corners of the island's tile, at sea level and over the summit, for measuring how deep
// into the view it runs.
const ISLAND_CORNERS = [[SQUARE.u0, SQUARE.v0], [SQUARE.u0, SQUARE.v1], [SQUARE.u1, SQUARE.v0], [SQUARE.u1, SQUARE.v1]].flatMap(([u, v]) => [0, 120].map((y) => [toX(u, v), y, toZ(u, v)]));
globalThis.virt = { climate, player, view, scene, sun, renderer, pixels, world };
// `virt.shoot()` takes the view on screen as the loading screen's shot: see shoot.js.
virt.shoot = () => import('./shoot.js').then((m) => m.shoot(virt));

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
  // Any step he is asked to take brings the view back to him, wherever it was looking.
  if (e.code.startsWith('Arrow') || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) homing = true;
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

// The view, as on a map: dragging slides it over the island to look around, and as soon as the
// avatar walks again it comes back to him. Dragging with the right button, or with Ctrl, Cmd
// or Alt held, turns the view around the point it looks at and tilts it, from low over the sea
// to nearly straight down. A and E turn it to the next corner of the island, where the walk
// lines up with the screen again.
const snapYaw = (yaw) => Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
const PITCH = { min: 0.3, max: 1.5 };
let yawTarget = view.yaw;
let pitchTarget = view.pitch;
let dragging = null; // 'pan' | 'orbit'
let homing = false; // the view is on its way back to the avatar
const pan = opensOnShot ? new THREE.Vector3(OPENING.view.pan[0], 0, OPENING.view.pan[1]) : new THREE.Vector3();
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = e.button === 2 || e.ctrlKey || e.metaKey || e.altKey ? 'orbit' : 'pan';
  homing = false;
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerup', () => (dragging = null));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  if (dragging === 'orbit') {
    yawTarget += e.movementX * 0.006;
    pitchTarget = clamp(pitchTarget + e.movementY * 0.005, PITCH.min, PITCH.max);
    return;
  }
  // The map follows the hand: a screen pixel is so many metres across, and more than that
  // along the ground up the screen, which the view looks at aslant.
  const metres = view.viewHeight / innerHeight;
  pan.addScaledVector(view.right, -e.movementX * metres);
  pan.x += (view.forward.x / Math.hypot(view.forward.x, view.forward.z)) * ((e.movementY * metres) / Math.sin(view.pitch));
  pan.z += (view.forward.z / Math.hypot(view.forward.x, view.forward.z)) * ((e.movementY * metres) / Math.sin(view.pitch));
  pan.y = 0;
  pan.clampLength(0, 320);
});
// The wheel zooms the map, and so does a pinch on the trackpad (a wheel with Ctrl held), which
// would otherwise blow up the whole page.
addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const step = e.ctrlKey ? clamp(e.deltaY * 0.01, -0.1, 0.1) : Math.sign(e.deltaY) * 0.1;
    view.viewHeight = clamp(view.viewHeight * (1 + step), 24, 260);
  },
  { passive: false },
);
// Nor do the browser's own zoom keys or Safari's pinch gesture enlarge the page: the picture is
// pixel art drawn for the window as it is. Cmd/Ctrl 0 still puts a page zoomed earlier back.
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract'].includes(e.code)) e.preventDefault();
});
for (const gesture of ['gesturestart', 'gesturechange']) addEventListener(gesture, (e) => e.preventDefault());

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
let t = 0;
let frames = 0;
// A pixel-art picture gains nothing past sixty frames a second: on a faster screen the frames
// in between are skipped, which halves the work of the graphics card and spares the battery.
const FRAME = 1 / 60;
let owed = 0;

// The island as a box, from the base of the tile up over the summit and the tallest tower.
const ISLAND = LAND_ENDS.flatMap(([x, z]) => [new THREE.Vector3(x, -16, z), new THREE.Vector3(x, 110, z)]);
// The shadow map is the same size whichever way the light comes from: a ball around the island.
// Were it fitted to the island as the light sees it, its texels would stretch and shrink as
// the sun goes round, and every shadow edge would crawl with them.
const islandMid = new THREE.Box3().setFromPoints(ISLAND).getCenter(new THREE.Vector3());
const islandReach = Math.max(...ISLAND.map((corner) => corner.distanceTo(islandMid))) + 4;
{
  const cam = sun.shadow.camera;
  Object.assign(cam, { left: -islandReach, right: islandReach, top: islandReach, bottom: -islandReach, near: 1, far: 2 * islandReach + 20 });
  cam.updateProjectionMatrix();
}
// The axes of the shadow map in the world: across the light, as three.js lays the map out.
const sunRight = new THREE.Vector3();
const sunUp = new THREE.Vector3();
const SHADOW_TEXEL = (2 * islandReach) / sun.shadow.mapSize.x;
/** Frames the shadow camera on the whole island, whichever way the light comes from. */
function frameShadows() {
  const dir = climate.lightDir;
  sunRight.set(0, 1, 0).cross(dir).normalize();
  sunUp.crossVectors(dir, sunRight);
  // The target is the middle of the island, held to whole texels of the map across the light
  // so that a slow drift of the sun never makes the shadow edges crawl.
  const snap = (axis) => Math.round(islandMid.dot(axis) / SHADOW_TEXEL) * SHADOW_TEXEL;
  sun.target.position.copy(dir).multiplyScalar(islandMid.dot(dir)).addScaledVector(sunRight, snap(sunRight)).addScaledVector(sunUp, snap(sunUp));
  sun.position.copy(sun.target.position).addScaledVector(dir, islandReach + 10);
}

function frame() {
  owed += clock.getDelta();
  // A 120 Hz screen calls every 8.3 ms, give or take a little: two calls must always make a
  // frame, or now and then three go by and the picture stutters.
  if (owed < FRAME * 0.75) return;
  const dt = Math.min(owed, 0.05);
  owed = 0;
  t += dt;

  view.yaw += (yawTarget - view.yaw) * (1 - Math.exp(-dt * 8));
  view.pitch += (pitchTarget - view.pitch) * (1 - Math.exp(-dt * 8));
  player.update(dt, t, readInput(!player.step), snapYaw(view.yaw));
  climate.update(dt);
  dayNight.update();
  seasons.update();
  skies.update();
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

  // Seen from far off the pixels are drawn finer, so the picture stays readable instead of
  // breaking up into grain: two screen pixels to an art pixel up close, down to one far out.
  const grain = view.viewHeight > 190 ? 1 : view.viewHeight > 120 ? 1.5 : 2;
  if (grain !== pixels.pixelSize) {
    pixels.pixelSize = grain;
    resize();
  }

  if (player.step || homing) pan.multiplyScalar(Math.exp(-dt * 6));
  if (homing && pan.lengthSq() < 0.01) {
    pan.set(0, 0, 0);
    homing = false;
  }
  focus.copy(player.position).add(pan).y += 1.4;
  view.update(focus, pixels.lowRes, pixels.offset);
  // The houses of the villages open a window on him wherever they hide him from the eye.
  GLOBALS.uCut.value.set(player.position.x, player.position.y + 0.9, player.position.z, 1.7);
  GLOBALS.uCutAxis.value.copy(view.forward).negate();
  // The haze closes in on the far sea; in clear weather it only just touches the back of the
  // island, however low the view is tilted (then the island runs far back into the depth). A
  // mist or a rain draws it in over everything.
  let back = 0;
  for (const [x, y, z] of ISLAND_CORNERS) back = Math.max(back, (x - view.camera.position.x) * view.forward.x + (y - view.camera.position.y) * view.forward.y + (z - view.camera.position.z) * view.forward.z);
  const clear = Math.max(view.distance + 60, back - 60);
  const thick = (1 - climate.visibility) / 0.75;
  scene.fog.color.copy(climate.skyHorizon);
  scene.fog.near = clear + (view.distance - 120 - clear) * thick;
  scene.fog.far = scene.fog.near + 460 - 210 * thick;

  frameShadows();
  renderer.shadowMap.needsUpdate = frames++ % 2 === 0;
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
  // The sky itself is a backdrop: it must not slide when the map is dragged under the view,
  // so its clouds and stars hang from the horizon as it stands with the view on the avatar.
  weather.skyline = weather.horizon + pan.dot(view._up) / view.viewHeight;
  // Where the sun and the moon stand in the painted sky: across the screen by their bearing
  // from the way the view looks, above the horizon by their height. The moon is opposite the sun.
  for (const [body, sign, spot] of [['sun', 1, sunSpot], ['moon', -1, moonSpot]]) {
    const bearing = Math.atan2((climate.sunDir.x * view.right.x + climate.sunDir.z * view.right.z) * sign, (climate.sunDir.x * ahead.x + climate.sunDir.z * ahead.y) * sign);
    weather[body] = spot.set(0.5 + bearing / 1.7, Math.asin(clamp(climate.sunDir.y * sign, -1, 1)) / 1.15, Math.abs(bearing) < 1.4 ? 1 : 0);
  }
  // How far the wind pushes the rain sideways on screen.
  weather.slant = (climate.wind.x * view.right.x + climate.wind.y * view.right.z) * weather.wind;
  pixels.render(scene, view.camera, { skyTop: climate.skyTop, skyHorizon: climate.skyHorizon, texelWorld: view.texelWorld, time: t, weather });
  // The first frame compiles every shader; once the second is drawn the map runs, and the
  // blurred shot of the loading screen (index.html) comes into focus on it as it fades away.
  // The shot is taken before dawn: once it has gone, the sun comes up over the island in a few
  // seconds and the morning light finds it out, roof by roof; then the hours and the weather
  // run on to the player's own.
  if (frames === 2) {
    const loading = document.getElementById('loading');
    loading?.classList.add('is-done');
    setTimeout(() => loading?.remove(), 2400);
    if (opensOnShot) {
      setTimeout(() => climate.travel(OPENING.moment.hour + SUNRISE.hours, SUNRISE.seconds), 1400);
      setTimeout(() => climate.rejoin(), 1400 + SUNRISE.seconds * 1000 + 200);
    }
  }
}
// `virt.frame()` runs one frame by hand, for timing it while the page is hidden.
virt.frame = frame;
// `virt.aim({ x, z, yaw, pitch, zoom })` points the view at a spot of the map, the avatar left
// where he stands; with `carry`, the avatar is taken there, and the houses that hide the spot
// open their round window on it (see tour.js, which hides him).
virt.aim = ({ x, z, yaw = view.yaw, pitch = view.pitch, zoom = view.viewHeight, carry = false }) => {
  if (carry) player.position.set(x, groundAt(x, z), z);
  pan.set(x - player.position.x, 0, z - player.position.z);
  homing = false;
  yawTarget = view.yaw = yaw;
  pitchTarget = view.pitch = clamp(pitch, PITCH.min, PITCH.max);
  view.viewHeight = zoom;
};
renderer.setAnimationLoop(frame);
// `?bench=label` measures a few seconds of the game and posts the figures to the dev server: see bench.js.
if (params.has('bench')) import('./bench.js').then((m) => m.bench(virt, params));
// `?tour=village` takes a picture of every corner of the village and its harbour: see tour.js.
if (params.has('tour')) import('./tour.js').then((m) => m.tour(virt, params));

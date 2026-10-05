import * as THREE from 'three';
import { smoothstep } from './noise.js';
import { Player } from './player.js';
import { SEED_COUNT, WATER_LEVEL, createWorld, groundAt } from './world.js';

const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- Renderer, scene, light

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 90, 470);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 2500);

const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.1);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 320 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(hemi, sun, sun.target);

const world = createWorld(scene);
const player = new Player();
player.position.set(0, groundAt(0, 34), 34);
scene.add(player.root);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- Input
// KeyboardEvent.code is layout-independent: WASD on QWERTY is ZQSD on AZERTY.

const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const view = { yaw: 0, pitch: 0.3, dist: 13 };
let dragging = false;
renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  view.yaw -= e.movementX * 0.005;
  view.pitch = clamp(view.pitch + e.movementY * 0.004, -0.1, 1.25);
});
addEventListener('wheel', (e) => (view.dist = clamp(view.dist * (1 + Math.sign(e.deltaY) * 0.1), 5, 45)), {
  passive: true,
});

function readInput() {
  const k = (code) => (keys.has(code) ? 1 : 0);
  return {
    forward: k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown'),
    right: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'),
    run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: keys.has('Space'),
  };
}

// ---------------------------------------------------------------- Day cycle: noon to violet dusk and back

const DAY = { top: 0x78c8c6, horizon: 0xf7e4b6, sun: 0xfff3da, ground: 0xd9a98c };
const DUSK = { top: 0x5a4b98, horizon: 0xf28e78, sun: 0xffad7a, ground: 0x8a5f8f };
const tint = (key, k, out) => out.setHex(DAY[key]).lerp(new THREE.Color(DUSK[key]), k);
const sunDir = new THREE.Vector3();
const DAY_LENGTH = 150;

function updateSky(t) {
  const phase = (t / DAY_LENGTH) * Math.PI * 2 + 2.2;
  const elev = 0.08 + 0.85 * (0.5 + 0.5 * Math.sin(phase));
  const az = phase * 0.5 + 0.8;
  sunDir.set(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az));
  const dusk = 1 - smoothstep(0.1, 0.75, elev);
  const u = world.sky.uniforms;
  tint('top', dusk, u.uTop.value);
  tint('horizon', dusk, u.uHorizon.value);
  tint('sun', dusk, u.uSun.value);
  u.uSunDir.value.copy(sunDir);
  scene.fog.color.copy(u.uHorizon.value);
  sun.color.copy(u.uSun.value);
  sun.intensity = 1.5 + 1.2 * (1 - dusk);
  hemi.color.copy(u.uHorizon.value);
  tint('ground', dusk, hemi.groundColor);
}

// ---------------------------------------------------------------- Camera

const camTarget = new THREE.Vector3();
const camWanted = new THREE.Vector3();

function updateCamera(dt, snap = false) {
  camTarget.copy(player.position).y += 2.2;
  const cp = Math.cos(view.pitch);
  camWanted
    .set(Math.sin(view.yaw) * cp, Math.sin(view.pitch), Math.cos(view.yaw) * cp)
    .multiplyScalar(view.dist)
    .add(camTarget);
  const floor = Math.max(groundAt(camWanted.x, camWanted.z), WATER_LEVEL) + 1.2;
  camWanted.y = Math.max(camWanted.y, floor);
  if (snap) camera.position.copy(camWanted);
  else camera.position.lerp(camWanted, 1 - Math.exp(-dt * 8));
  camera.lookAt(camTarget);
}

// ---------------------------------------------------------------- HUD

const $ = (id) => document.getElementById(id);
const hud = { count: $('count'), arrow: $('arrow'), dist: $('dist'), toast: $('toast'), compass: $('compass') };
$('total').textContent = SEED_COUNT;
let toastTimer = 0;
function toast(text, seconds = 4) {
  hud.toast.textContent = text;
  hud.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hud.toast.classList.remove('show'), seconds * 1000);
}

function updateCompass() {
  let best = null;
  let bestD = Infinity;
  for (const s of world.seeds) {
    if (s.collected) continue;
    const d = Math.hypot(s.position.x - player.position.x, s.position.z - player.position.z);
    if (d < bestD) [best, bestD] = [s, d];
  }
  hud.compass.classList.toggle('hidden', !best);
  if (!best) return;
  // Project the seed direction into the camera's ground frame: up on screen = straight ahead.
  const dx = best.position.x - player.position.x;
  const dz = best.position.z - player.position.z;
  const ahead = -Math.sin(view.yaw) * dx - Math.cos(view.yaw) * dz;
  const side = Math.cos(view.yaw) * dx - Math.sin(view.yaw) * dz;
  hud.arrow.style.transform = `rotate(${Math.atan2(side, ahead)}rad)`;
  hud.dist.textContent = `${Math.round(bestD)} m`;
}

// ---------------------------------------------------------------- Loop

const clock = new THREE.Clock();
let t = 0;
updateSky(0);
updateCamera(0, true);
toast("Trouve les graines de lumière pour réveiller l'Arbre-Mère.", 6);

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  updateSky(t);
  player.update(dt, t, readInput(), view.yaw);
  updateCamera(dt);
  world.update(t, dt, { sunDir });

  const gathered = world.collectNear(player.position);
  if (gathered) {
    hud.count.textContent = gathered;
    toast(
      gathered === SEED_COUNT
        ? "L'Arbre-Mère a refleuri. Le désert respire."
        : `Graine ${gathered}/${SEED_COUNT} — une branche de l'Arbre-Mère reverdit.`,
    );
  }
  updateCompass();

  sun.target.position.copy(player.position);
  sun.position.copy(player.position).addScaledVector(sunDir, 150);
  renderer.render(scene, camera);
});

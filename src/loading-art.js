// Development only, and unused for now: the loading screen shows the opening shot instead (see
// shoot.js). `import('./src/loading-art.js').then((m) => m.draw(virt))` in the console draws the
// pictures of a lighthouse loading screen with the game itself, so that the lighthouse there is
// the one out in the bay, and posts them to the dev server, which writes them to
// assets/loading/ (see serve.py):
//  - map.jpg, the view the avatar arrives on, by day;
//  - lighthouse.png, the lighthouse on its rock at night, lifted out of the sea;
//  - beam.jpg, the beam going round, a sheet of frames on black, laid over the rest by adding light;
//  - lighthouse.json, how they fit together.
// Run it again whenever the lighthouse or the arrival changes.
import * as THREE from 'three';
import { PixelCamera } from './pixel.js';
import { GLOBALS, WATER_LEVEL, paint } from './style.js';
import { ISLET } from './terrain.js';

const TEXEL = 0.22; // metres to an art pixel
const W = 520; // a frame of the beam, in art pixels
const H = 300;
const FRAMES = 36;
const COLUMNS = 6;
// The cut round the rock: the ground is kept within this many metres of its middle, above the sea.
const ROCK = 20;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const post = async (name, blob) => {
  const response = await fetch(`/assets/loading/${name}`, { method: 'POST', body: blob });
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
};
const canvas2d = (width, height) => {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
};
const blobOf = (c, type, quality) => new Promise((resolve) => c.toBlob(resolve, type, quality));

export async function draw(virt) {
  const { renderer, pixels, scene, climate, frame } = virt;
  renderer.setAnimationLoop(null);
  // Frames run by hand, far enough apart that each one is drawn.
  const run = async (n) => {
    for (let i = 0; i < n; i++) {
      await sleep(20);
      frame();
    }
  };

  // The arrival, at the end of the morning in clear weather, as a 1920 × 1080 window shows it.
  pixels.setSize(1920, 1080);
  climate.preview({ hour: 11, weather: 'clear' });
  await run(40);
  await sleep(20);
  frame();
  const arrival = renderer.domElement.toDataURL('image/jpeg', 0.85);
  await post('map.jpg', await (await fetch(arrival)).blob());

  // The lighthouse after dark, its lamp lit.
  climate.preview({ hour: 21.5 });
  await run(40);

  let tower = null;
  let beam = null;
  const ground = [];
  for (const child of scene.children) {
    child.traverse((obj) => {
      if (obj.userData.beacon) tower = child;
      if (obj.isMesh && obj.material.blending === THREE.AdditiveBlending) beam = child;
      if (obj.isMesh && obj.material.defines && 'TERRAIN' in obj.material.defines && !ground.includes(child)) ground.push(child);
    });
  }
  const beacon = new THREE.Vector3();
  tower.traverse((obj) => obj.userData.beacon && obj.getWorldPosition(beacon));
  for (const child of scene.children) child.visible = child.isLight || child === tower || child === beam || ground.includes(child);

  // Only the rock is kept of the ground, and nothing of anything below the sea.
  renderer.localClippingEnabled = true;
  const sea = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_LEVEL);
  const box = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -(ISLET.x - ROCK)),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), ISLET.x + ROCK),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -(ISLET.z - ROCK)),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), ISLET.z + ROCK),
  ];
  for (const child of ground)
    child.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material.clippingPlanes = [sea, ...box];
      obj.material.needsUpdate = true;
    });
  const cone = beam.getObjectByProperty('isMesh', true);
  cone.material.clippingPlanes = [sea];
  cone.material.needsUpdate = true;
  cone.material.opacity = 0.26;
  // No pool of light on the water, which is not drawn.
  GLOBALS.uBeam.value.w = 0;
  scene.fog.near = 1e5;
  scene.fog.far = 1e5 + 1;

  // Seen as on arrival, the lantern a third of the way down the frame.
  pixels.pixelSize = 1;
  pixels.setSize(W - 2, H - 2);
  const view = new PixelCamera();
  Object.assign(view, { yaw: virt.view.yaw, pitch: virt.view.pitch, lift: 0, viewHeight: H * TEXEL });
  view.update(beacon.clone().addScaledVector(new THREE.Vector3(0, 1, 0), -H * TEXEL * 0.16), pixels.lowRes, new THREE.Vector2());

  // A wall behind it all, black or white, so the beam has something to fall on and the
  // lighthouse can be told from what is behind it. It is painted like the rest, since the
  // picture is drawn into the colour and the normals at once.
  const black = paint(0x000000, { unlit: true });
  const white = paint(0xffffff, { unlit: true });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), black);
  backdrop.quaternion.copy(view.camera.quaternion);
  backdrop.position.copy(beacon).addScaledVector(view.forward, 160);
  scene.add(backdrop);

  const gl = renderer.getContext();
  const weather = { ...climate.screen, rain: 0, snow: 0, leaves: 0, petals: 0, flash: 0, slant: 0, offing: 1e6, sun: new THREE.Vector3(), moon: new THREE.Vector3() };
  const shot = () => {
    pixels.render(scene, view.camera, { skyTop: new THREE.Color(0), skyHorizon: new THREE.Color(0), texelWorld: view.texelWorld, time: 0, weather });
    const rgba = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    // Rows come from the bottom up.
    const flipped = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) flipped.set(rgba.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return flipped;
  };

  // The lighthouse: whatever stays the same over black and over white.
  beam.visible = false;
  const dark = shot();
  backdrop.material = white;
  const light = shot();
  backdrop.material = black;
  const tower2d = new ImageData(W, H);
  let [x0, y0, x1, y1] = [W, H, 0, 0];
  for (let i = 0; i < W * H; i++) {
    const p = i * 4;
    const same = Math.abs(dark[p] - light[p]) + Math.abs(dark[p + 1] - light[p + 1]) + Math.abs(dark[p + 2] - light[p + 2]) < 24;
    if (!same) continue;
    tower2d.data.set([dark[p], dark[p + 1], dark[p + 2], 255], p);
    const x = i % W;
    const y = Math.floor(i / W);
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  const cut = canvas2d(x1 - x0 + 1, y1 - y0 + 1);
  cut.getContext('2d').putImageData(tower2d, -x0, -y0);
  await post('lighthouse.png', await blobOf(cut, 'image/png'));

  // The beam: each frame less the same frame without it, so only its light is left.
  beam.visible = true;
  const sheet = canvas2d(W * COLUMNS, H * Math.ceil(FRAMES / COLUMNS));
  const ink = sheet.getContext('2d');
  ink.fillStyle = '#000';
  ink.fillRect(0, 0, sheet.width, sheet.height);
  for (let f = 0; f < FRAMES; f++) {
    beam.rotation.y = (-f / FRAMES) * Math.PI * 2;
    const lit = shot();
    const glow = new ImageData(W, H);
    for (let p = 0; p < lit.length; p += 4) glow.data.set([lit[p] - dark[p], lit[p + 1] - dark[p + 1], lit[p + 2] - dark[p + 2], 255], p);
    ink.putImageData(glow, (f % COLUMNS) * W, Math.floor(f / COLUMNS) * H);
  }
  await post('beam.jpg', await blobOf(sheet, 'image/jpeg', 0.9));

  const lantern = beacon.clone().project(view.camera);
  const layout = {
    frame: [W, H],
    frames: FRAMES,
    columns: COLUMNS,
    lighthouse: [x0, y0, x1 - x0 + 1, y1 - y0 + 1],
    lantern: [Math.round((lantern.x * 0.5 + 0.5) * W), Math.round((0.5 - lantern.y * 0.5) * H)],
  };
  await post('lighthouse.json', new Blob([JSON.stringify(layout, null, 2)]));
  console.log('loading art', layout);
  return layout;
}

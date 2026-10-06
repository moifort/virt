// The VIRT: a Bob-style virtual workplace set on an island of the Ligurian coast, painted the way a
// Ghibli background is.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { GLOBALS, PATH_COUNT, TRACK_COUNT, TRAIL_COUNT, WATER_LEVEL, paint } from './style.js';
import { buildLife } from './life.js';
import { buildNature } from './nature.js';
import { GRID, HALF, PATHS, SEGMENTS, TRACKS, TRAILS, WORLD_SIZE, ZONES, buildSides, buildTerrain, buildWater, segmentDistance } from './terrain.js';
import { buildEstate } from './estate.js';
import { at, bake, live } from './kit.js';
import { buildRailway } from './railway.js';
import { buildVillages } from './village.js';
import { buildAgora, buildAtelier, buildLibrary, buildLighthouseWalk, buildMoot, buildObservatory, buildPods, buildPort, buildPub } from './zones.js';

export { LAND_ENDS, SUN_DIR, WATER_LEVEL, ZONES, groundAt, inSquare } from './terrain.js';

// ---------------------------------------------------------------- World

/**
 * The beam of the lighthouse as a thing seen: a cone of warm light from the lantern, brightest
 * at its root and thinning away, long enough to come down to the sea far out. Returns the pivot
 * that turns it and the material that dims it.
 */
function lightCone(scene, lamp) {
  const LENGTH = 160;
  const REACH = 120; // where the axis of the cone meets the water
  const geo = new THREE.ConeGeometry(9, LENGTH, 18, 1, true);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    // From the tip (y = +LENGTH / 2) to the base: warm and bright, then dim.
    const k = 0.5 + pos.getY(i) / LENGTH;
    colors.set([0.12 + 0.88 * k, 0.1 + 0.82 * k, 0.06 + 0.64 * k], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = paint(0xffffff, { unlit: true, volume: true, vertexColors: true, doubleSide: true });
  material.transparent = true;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  material.opacity = 0;
  const cone = new THREE.Mesh(geo, material);
  cone.castShadow = cone.receiveShadow = false;
  cone.frustumCulled = false;
  // Drawn after the sea, which is translucent too and would otherwise paint over it.
  cone.renderOrder = 10;
  // Tip at the lantern, base far out along +x, then leaned down toward the water; the pivot turns it.
  cone.rotation.z = Math.PI / 2;
  cone.position.x = LENGTH / 2;
  const lean = at(new THREE.Group(), 0, 0, 0);
  lean.rotation.z = -Math.atan2(lamp.y - WATER_LEVEL, REACH);
  lean.add(cone);
  const pivot = live(new THREE.Group());
  pivot.position.copy(lamp);
  pivot.add(lean);
  scene.add(pivot);
  return { pivot, material };
}

export function createWorld(scene) {
  const rng = mulberry32(20261005);
  const animated = [];
  PATHS.forEach((p, i) => GLOBALS.uPaths.value[i].set(...p));
  for (let i = PATHS.length; i < PATH_COUNT; i++) GLOBALS.uPaths.value[i].set(1e4, 1e4, 1e4, 1e4);
  TRAILS.forEach((t, i) => GLOBALS.uTrails.value[i].set(...t));
  for (let i = TRAILS.length; i < TRAIL_COUNT; i++) GLOBALS.uTrails.value[i].set(1e4, 1e4, 1e4, 1e4);
  TRACKS.forEach((t, i) => GLOBALS.uTracks.value[i].set(...t));
  for (let i = TRACKS.length; i < TRACK_COUNT; i++) GLOBALS.uTracks.value[i].set(1e4, 1e4, 1e4, 1e4);
  GLOBALS.uWayMap.value = wayMap();

  const halfs = new Uint16Array(GRID.length);
  for (let i = 0; i < GRID.length; i++) halfs[i] = THREE.DataUtils.toHalfFloat(GRID[i]);
  const heightTex = new THREE.DataTexture(halfs, SEGMENTS + 1, SEGMENTS + 1, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;
  GLOBALS.uHeight.value = heightTex;
  GLOBALS.uHeightMap.value.set(HALF, WORLD_SIZE, SEGMENTS + 1);

  scene.add(buildTerrain(), buildSides(), buildWater());
  const builders = {
    agora: buildAgora,
    library: buildLibrary,
    moot: buildMoot,
    pub: buildPub,
    pods: buildPods,
    atelier: buildAtelier,
    port: buildPort,
  };
  for (const zn of ZONES) {
    const g = new THREE.Group();
    g.position.set(zn.x, 0, zn.z);
    scene.add(g);
    builders[zn.id](g, rng, animated);
    bake(g);
  }
  buildLighthouseWalk(scene, rng, animated);
  buildObservatory(scene, rng);
  buildVillages(scene, rng, animated);
  buildEstate(scene, rng);
  buildNature(scene, rng);
  buildLife(scene, rng, animated);
  buildRailway(scene, animated);
  GLOBALS.uLampMap.value = lampMap(scene);
  // The lighthouse turns its beam once every quarter of a minute, as long as the lamps are lit:
  // a long cone of light from the lantern room, leaning down to the sea, and the pool it lays
  // on the water out where it comes down (see `uBeam` in style.js).
  scene.updateMatrixWorld(true);
  let beacon = null;
  scene.traverse((obj) => {
    if (obj.userData.beacon) beacon = obj.getWorldPosition(new THREE.Vector3());
  });
  const beam = beacon ? lightCone(scene, beacon) : null;
  animated.push((t) => {
    const lit = GLOBALS.uLamps.value.x;
    GLOBALS.uBeam.value.set(beacon?.x ?? 0, beacon?.z ?? 0, t * 0.42, lit);
    if (beam) {
      beam.pivot.rotation.y = -t * 0.42;
      beam.material.opacity = 0.26 * lit;
      beam.pivot.visible = lit > 0.01;
    }
  });

  // Every chair, bench and step that can be sat on: where, and which way it faces.
  const seats = [];
  scene.traverse((obj) => {
    if (!obj.userData.seat) return;
    const facing = obj.getWorldDirection(new THREE.Vector3());
    seats.push({ position: obj.getWorldPosition(new THREE.Vector3()), yaw: Math.atan2(facing.x, facing.z) });
  });

  return {
    seats,
    /** @param {import('./climate.js').Climate} climate the sky of the moment, for whatever lives by it */
    update(t, dt, climate) {
      for (const fn of animated) fn(t, dt, climate);
    },
  };
}

/**
 * Where the ways run: a channel each for the footpaths, the trails and the goat tracks, set
 * wherever one passes within reach. Away from them, which is most of the island, the ground
 * shader is spared measuring its distance to every one of them.
 */
function wayMap() {
  const SIZE = 1024;
  const texel = WORLD_SIZE / SIZE;
  const data = new Uint8Array(SIZE * SIZE * 4);
  // The widest each kind is ever painted (see terrainColor), a whole texel to spare.
  [[PATHS, 1.9], [TRAILS, 0.75], [TRACKS, 0.4]].forEach(([segments, width], channel) => {
    const reach = width + texel;
    for (const s of segments) {
      const [ax, az, bx, bz] = s;
      const lo = (a, b) => Math.max(0, Math.floor((Math.min(a, b) - reach + HALF) / texel));
      const hi = (a, b) => Math.min(SIZE - 1, Math.ceil((Math.max(a, b) + reach + HALF) / texel));
      for (let iz = lo(az, bz); iz <= hi(az, bz); iz++) {
        for (let ix = lo(ax, bx); ix <= hi(ax, bx); ix++) {
          if (segmentDistance((ix + 0.5) * texel - HALF, (iz + 0.5) * texel - HALF, s) < reach) data[(iz * SIZE + ix) * 4 + channel] = 255;
        }
      }
    }
  });
  const map = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  map.minFilter = map.magFilter = THREE.NearestFilter;
  map.needsUpdate = true;
  return map;
}

/**
 * Where lamplight falls: every light marked with `lamplight` spreads a soft pool around itself,
 * drawn into a map laid over the world like the heightmap. Materials read it after dark.
 */
function lampMap(scene) {
  const SIZE = 512;
  const data = new Uint8Array(SIZE * SIZE);
  const toTexel = SIZE / WORLD_SIZE;
  const p = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    const reach = obj.userData.lamp;
    if (!reach) return;
    obj.getWorldPosition(p);
    const cx = (p.x + HALF) * toTexel;
    const cz = (p.z + HALF) * toTexel;
    const r = reach * toTexel;
    for (let iz = Math.max(0, Math.floor(cz - r)); iz <= Math.min(SIZE - 1, Math.ceil(cz + r)); iz++) {
      for (let ix = Math.max(0, Math.floor(cx - r)); ix <= Math.min(SIZE - 1, Math.ceil(cx + r)); ix++) {
        const d = Math.hypot(ix + 0.5 - cx, iz + 0.5 - cz) / r;
        if (d >= 1) continue;
        // Where pools overlap the brighter one wins, with a little of the other added.
        const light = 255 * (1 - d) ** 1.5;
        const lit = data[iz * SIZE + ix];
        data[iz * SIZE + ix] = Math.min(255, Math.max(lit, light) + Math.min(lit, light) * 0.3);
      }
    }
  });
  const map = new THREE.DataTexture(data, SIZE, SIZE, THREE.RedFormat);
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}


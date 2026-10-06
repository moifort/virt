// The VIRT: a Bob-style virtual workplace set on an island of the Ligurian coast, painted the way a
// Ghibli background is.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { GLOBALS, PATH_COUNT, TRAIL_COUNT } from './style.js';
import { buildLife } from './life.js';
import { buildNature } from './nature.js';
import { GRID, HALF, PATHS, SEGMENTS, TRAILS, WORLD_SIZE, ZONES, buildSides, buildTerrain, buildWater } from './terrain.js';
import { buildEstate } from './estate.js';
import { bake } from './kit.js';
import { buildRailway } from './railway.js';
import { buildVillages } from './village.js';
import { buildAgora, buildAtelier, buildLibrary, buildLighthouseWalk, buildMoot, buildObservatory, buildPods, buildPort, buildPub } from './zones.js';

export { LAND_ENDS, SUN_DIR, WATER_LEVEL, ZONES, groundAt, inSquare } from './terrain.js';

// ---------------------------------------------------------------- World

export function createWorld(scene) {
  const rng = mulberry32(20261005);
  const animated = [];
  PATHS.forEach((p, i) => GLOBALS.uPaths.value[i].set(...p));
  for (let i = PATHS.length; i < PATH_COUNT; i++) GLOBALS.uPaths.value[i].set(1e4, 1e4, 1e4, 1e4);
  TRAILS.forEach((t, i) => GLOBALS.uTrails.value[i].set(...t));
  for (let i = TRAILS.length; i < TRAIL_COUNT; i++) GLOBALS.uTrails.value[i].set(1e4, 1e4, 1e4, 1e4);

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
  // The lighthouse turns its beam once every quarter of a minute, as long as the lamps are lit.
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (!obj.userData.beacon) return;
    const lamp = obj.getWorldPosition(new THREE.Vector3());
    GLOBALS.uBeam.value.set(lamp.x, lamp.z, 0, 0);
  });
  animated.push((t) => GLOBALS.uBeam.value.setZ(t * 0.42).setW(GLOBALS.uLamps.value.x));

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


// The VIRT: a Bob-style virtual workplace set in a bay of the Ligurian coast, painted the way a
// Ghibli background is.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { GLOBALS, PATH_COUNT } from './style.js';
import { buildLife } from './life.js';
import { buildNature } from './nature.js';
import { GRID, HALF, PATHS, SEGMENTS, WORLD_SIZE, ZONES, buildSides, buildTerrain, buildWater } from './terrain.js';
import { buildBase, planBase } from './base.js';
import { buildEstate } from './estate.js';
import { bake } from './kit.js';
import { buildRailway } from './railway.js';
import { buildSky } from './sky.js';
import { buildVillages } from './village.js';
import { buildAgora, buildAtelier, buildLibrary, buildMoot, buildPods, buildPort, buildPub } from './zones.js';

export { CORNERS, SUN_DIR, WATER_LEVEL, ZONES, groundAt, inSquare } from './terrain.js';

// ---------------------------------------------------------------- World

export function createWorld(scene) {
  const rng = mulberry32(20261005);
  const animated = [];
  PATHS.forEach((p, i) => GLOBALS.uPaths.value[i].set(...p));
  for (let i = PATHS.length; i < PATH_COUNT; i++) GLOBALS.uPaths.value[i].set(1e4, 1e4, 1e4, 1e4);

  const halfs = new Uint16Array(GRID.length);
  for (let i = 0; i < GRID.length; i++) halfs[i] = THREE.DataUtils.toHalfFloat(GRID[i]);
  const heightTex = new THREE.DataTexture(halfs, SEGMENTS + 1, SEGMENTS + 1, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;
  GLOBALS.uHeight.value = heightTex;
  GLOBALS.uHeightMap.value.set(HALF, WORLD_SIZE, SEGMENTS + 1);

  const rooms = planBase();
  scene.add(buildTerrain(), buildSides(rooms), buildWater());
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
  buildVillages(scene, rng);
  buildEstate(scene, rng);
  buildNature(scene, rng);
  buildLife(scene, rng, animated);
  buildBase(scene, rooms, animated);
  buildRailway(scene, animated);
  buildSky(scene, rng, animated);
  GLOBALS.uLampMap.value = lampMap(scene);

  return {
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
        if (d < 1) data[iz * SIZE + ix] = Math.min(255, data[iz * SIZE + ix] + 255 * (1 - d) ** 1.5);
      }
    }
  });
  const map = new THREE.DataTexture(data, SIZE, SIZE, THREE.RedFormat);
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}


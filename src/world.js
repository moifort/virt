// The VIRT: a Bob-style virtual workplace set in a Mœbius techno-ecological bay.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { GLOBALS, PATH_COUNT } from './style.js';
import { buildLife } from './life.js';
import { buildNature } from './nature.js';
import { GRID, HALF, PATHS, SEGMENTS, WORLD_SIZE, ZONES, buildSides, buildTerrain, buildWater } from './terrain.js';
import { buildBase, planBase } from './base.js';
import { bake } from './kit.js';
import { buildVillages } from './village.js';
import { buildAgora, buildAtelier, buildLibrary, buildMoot, buildPods, buildPort, buildPub } from './zones.js';

export { SUN_DIR, WATER_LEVEL, ZONES, groundAt, inSquare } from './terrain.js';

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
  buildNature(scene, rng);
  buildLife(scene, rng, animated);
  buildBase(scene, rooms, animated);

  return {
    update(t, dt) {
      for (const fn of animated) fn(t, dt);
    },
  };
}


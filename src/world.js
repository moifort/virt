// The VIRT: a Bob-style virtual workplace set on an island of the Ligurian coast, painted the way a
// Ghibli background is.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { GLOBALS, PATH_COUNT, TRACK_COUNT, TRAIL_COUNT, paint } from './style.js';
import { buildLife } from './life.js';
import { buildNature } from './nature.js';
import { HALF, PATHS, SEGMENTS, TRACKS, TRAILS, SKIN, WORLD_SIZE, ZONES, buildSides, buildTerrain, buildWater, segmentDistance } from './terrain.js';
import { buildEstate } from './estate.js';
import { bake, live } from './kit.js';
import { buildRailway } from './railway.js';
import { buildVillages } from './village.js';
import { buildAgora, buildAtelier, buildLibrary, buildLighthouseWalk, buildMoot, buildObservatory, buildPods, buildPort, buildPub } from './zones.js';

export { LAND_ENDS, SQUARE, SUN_DIR, WATER_LEVEL, ZONES, groundAt, inSquare, isSolid, toX, toZ } from './terrain.js';

// ---------------------------------------------------------------- World

/**
 * The beam of the lighthouse as a thing seen: a shaft of warm light from the lantern, levelled
 * on the horizon as a real one is, never dipping to the sea. It is brightest at the lantern and
 * thins away over the water until it is lost in the distance. Returns the pivot that turns it
 * and the material that dims it.
 */
function lightCone(scene, lamp) {
  const LENGTH = 460;
  const material = paint(0xffffff, { unlit: true, volume: true, vertexColors: true, doubleSide: true });
  material.transparent = true;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  // It fades out of itself; the haze would only add its own colour to it.
  material.fog = false;
  material.opacity = 0;
  const pivot = live(new THREE.Group());
  pivot.position.copy(lamp);
  // A wide pale shaft and a narrow bright core inside it.
  for (const [radius, glow, fade] of [[9, 0.6, 1.4], [2.4, 1, 2.2]]) {
    const geo = new THREE.ConeGeometry(radius, LENGTH, 18, 12, true);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // From the tip (y = +LENGTH / 2) to the far end: warm and bright, then lost in the dark.
      const k = (0.5 + pos.getY(i) / LENGTH) ** fade * glow;
      colors.set([k, 0.92 * k, 0.72 * k], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const cone = new THREE.Mesh(geo, material);
    cone.castShadow = cone.receiveShadow = false;
    cone.frustumCulled = false;
    // Drawn after the sea, which is translucent too and would otherwise paint over it.
    cone.renderOrder = 10;
    // Tip at the lantern, the shaft laid level along +x; the pivot turns it.
    cone.rotation.z = Math.PI / 2;
    cone.position.x = LENGTH / 2;
    pivot.add(cone);
  }
  scene.add(pivot);
  return { pivot, material };
}

/**
 * Builds the island into `scene`. `inspect(id, group)`, if given, sees each work zone's group
 * as built, every object still its own, before it is baked into a few meshes: the world lint
 * (test/) reads where everything stands from it.
 */
export function createWorld(scene, { inspect = null } = {}) {
  const rng = mulberry32(20261005);
  const animated = [];
  PATHS.forEach((p, i) => GLOBALS.uPaths.value[i].set(...p));
  for (let i = PATHS.length; i < PATH_COUNT; i++) GLOBALS.uPaths.value[i].set(1e4, 1e4, 1e4, 1e4);
  TRAILS.forEach((t, i) => GLOBALS.uTrails.value[i].set(...t));
  for (let i = TRAILS.length; i < TRAIL_COUNT; i++) GLOBALS.uTrails.value[i].set(1e4, 1e4, 1e4, 1e4);
  TRACKS.forEach((t, i) => GLOBALS.uTracks.value[i].set(...t));
  for (let i = TRACKS.length; i < TRACK_COUNT; i++) GLOBALS.uTracks.value[i].set(1e4, 1e4, 1e4, 1e4);
  GLOBALS.uWayMap.value = wayMap();

  const halfs = new Uint16Array(SKIN.length);
  for (let i = 0; i < SKIN.length; i++) halfs[i] = THREE.DataUtils.toHalfFloat(SKIN[i]);
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
    inspect?.(zn.id, g);
    bake(g);
  }
  buildLighthouseWalk(scene, rng, animated);
  buildObservatory(scene, rng);
  buildVillages(scene, rng, animated);
  buildEstate(scene, rng);
  buildNature(scene, rng, animated);
  buildLife(scene, rng, animated);
  buildRailway(scene, animated);
  GLOBALS.uLampMap.value = lampMap(scene);
  // The lighthouse turns its beam once every quarter of a minute, as long as the lamps are lit:
  // a long shaft of light from the lantern room, level with the horizon.
  scene.updateMatrixWorld(true);
  let beacon = null;
  scene.traverse((obj) => {
    if (obj.userData.beacon) beacon = obj.getWorldPosition(new THREE.Vector3());
  });
  const beam = beacon ? lightCone(scene, beacon) : null;
  animated.push((t) => {
    const lit = GLOBALS.uLamps.value.x;
    if (beam) {
      beam.pivot.rotation.y = -t * 0.42;
      beam.material.opacity = 0.34 * lit;
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


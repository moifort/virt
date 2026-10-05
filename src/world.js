// Procedural techno-ecological desert: terraced mesas, garden towers, wind and sun harvesters.
import * as THREE from 'three';
import { fbm, mulberry32, pick, smoothstep } from './noise.js';
import { PAL, inked, outlineMat, smoothed, toon } from './style.js';

export const WORLD_SIZE = 640;
export const WORLD_RADIUS = 270;
export const WATER_LEVEL = -3;
export const SEED_COUNT = 6;

const SEGMENTS = 220;
const CELL = WORLD_SIZE / SEGMENTS;
const HALF = WORLD_SIZE / 2;
const WIND_ANGLE = 0.6;
const UP = new THREE.Vector3(0, 1, 0);

function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.006, z * 0.006, 5) - 0.45) * 44;
  h += smoothstep(0.56, 0.62, fbm(x * 0.0045 + 31.7, z * 0.0045 - 12.3, 3)) * 24;
  // Terraced strata: flat shelves broken by short cliffs.
  const step = 6;
  const shelf = Math.floor(h / step) * step;
  h = shelf + smoothstep(0.65, 1, (h - shelf) / step) * step;
  h = 2 + (h - 2) * smoothstep(16, 70, r); // gentle clearing around the Mother Tree
  h += smoothstep(240, 310, r) * 80; // mountain ring framing the world
  return h;
}

// Heights sampled once on the mesh grid, so gameplay follows the rendered surface exactly.
const GRID = new Float32Array((SEGMENTS + 1) ** 2);
for (let iz = 0; iz <= SEGMENTS; iz++) {
  for (let ix = 0; ix <= SEGMENTS; ix++) {
    GRID[iz * (SEGMENTS + 1) + ix] = heightAt(ix * CELL - HALF, iz * CELL - HALF);
  }
}

/** Ground height matching PlaneGeometry's triangulation. */
export function groundAt(x, z) {
  const u = Math.min(SEGMENTS - 1e-6, Math.max(0, (x + HALF) / CELL));
  const v = Math.min(SEGMENTS - 1e-6, Math.max(0, (z + HALF) / CELL));
  const ix = Math.floor(u);
  const iz = Math.floor(v);
  const fu = u - ix;
  const fv = v - iz;
  const row = SEGMENTS + 1;
  const a = GRID[iz * row + ix];
  const b = GRID[(iz + 1) * row + ix];
  const c = GRID[(iz + 1) * row + ix + 1];
  const d = GRID[iz * row + ix + 1];
  if (fu + fv <= 1) return a + (d - a) * fu + (b - a) * fv;
  return c + (b - c) * (1 - fu) + (d - c) * (1 - fv);
}

function findSpot(rng, minR, maxR, { minH = WATER_LEVEL + 1.5, maxSlope = 0.5, mask } = {}) {
  for (let i = 0; i < 80; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(minR * minR + rng() * (maxR * maxR - minR * minR));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = groundAt(x, z);
    if (y < minH) continue;
    if (mask && !mask(x, z)) continue;
    const slope =
      Math.abs(groundAt(x + 1.5, z) - groundAt(x - 1.5, z)) + Math.abs(groundAt(x, z + 1.5) - groundAt(x, z - 1.5));
    if (slope / 3 > maxSlope) continue;
    return new THREE.Vector3(x, y - 0.2, z);
  }
  return null;
}

// ---------------------------------------------------------------- Landscape

function buildTerrain() {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const strata = [PAL.peach, PAL.rose, PAL.ochre, PAL.lilac].map((c) => new THREE.Color(c));
  const sand = new THREE.Color(PAL.sand);
  const dune = new THREE.Color(PAL.peach);
  const moss = new THREE.Color(PAL.moss);
  const wet = new THREE.Color(PAL.wetSand);
  const snow = new THREE.Color(PAL.ivory);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < WATER_LEVEL + 0.6) c.copy(wet);
    else if (nor.getY(i) < 0.78) c.copy(strata[((Math.floor(y / 6) % 4) + 4) % 4]); // one tone per terrace
    else if (y > 45) c.copy(snow);
    else if (y > 3 && fbm(x * 0.02 + 7, z * 0.02 + 3, 3) > 0.56) c.copy(moss);
    else c.copy(fbm(x * 0.025, z * 0.025, 2) > 0.52 ? dune : sand);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildWater() {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    toon(PAL.water, { transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.receiveShadow = true;
  return water;
}

function buildSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSun: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHorizon, uSun, uSunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          // Posterized bands rather than a smooth gradient: printed-comic sky.
          float band = floor(pow(clamp(d.y, 0.0, 1.0), 0.5) * 7.0) / 7.0;
          vec3 col = mix(uHorizon, uTop, band);
          float s = dot(d, normalize(uSunDir));
          col = mix(col, mix(col, uSun, 0.45), step(0.992, s));
          col = mix(col, uSun, step(0.9975, s));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.renderOrder = -1;
  dome.frustumCulled = false;

  // A huge ringed planet hanging over the horizon, lit by the same sun.
  const planet = inked(new THREE.SphereGeometry(110, 32, 20), toon(PAL.lilac, { fog: false }), 1.5, {
    fog: false,
    shadows: false,
  });
  planet.position.set(-420, 250, -560);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(150, 205, 72),
    toon(PAL.peach, { fog: false, side: THREE.DoubleSide }),
  );
  ring.rotation.set(1.25, 0.35, 0);
  planet.add(ring);
  const moon = inked(new THREE.SphereGeometry(26, 20, 12), toon(PAL.ivory, { fog: false }), 0.6, {
    fog: false,
    shadows: false,
  });
  moon.position.set(400, 190, -480);

  const group = new THREE.Group();
  group.add(dome, planet, moon);
  return { group, uniforms };
}

// ---------------------------------------------------------------- Props

function makeTower(rng) {
  const g = new THREE.Group();
  const H = 26 + rng() * 20;
  const R = 3 + rng() * 1.4;
  const shaft = inked(new THREE.CylinderGeometry(R * 0.75, R * 1.2, H, 20), toon(PAL.ivory), 0.2);
  shaft.position.y = H / 2;
  g.add(shaft);
  for (let k = 1; k <= 3; k++) {
    const r = R * (1.2 - (0.45 * k) / 4) + 0.15;
    const band = inked(new THREE.TorusGeometry(r, 0.35, 8, 28), toon(k % 2 ? PAL.coral : PAL.teal), 0.1);
    band.rotation.x = Math.PI / 2;
    band.position.y = (H * k) / 4;
    g.add(band);
  }
  const deck = inked(new THREE.CylinderGeometry(R * 2.3, R * 0.8, 2.4, 24), toon(PAL.ivory), 0.2);
  deck.position.y = H + 0.2;
  const dome = inked(
    new THREE.SphereGeometry(R * 1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    toon(PAL.teal),
    0.15,
  );
  dome.position.y = H + 1.4;
  const mast = inked(new THREE.CylinderGeometry(0.12, 0.2, 7, 6), toon(PAL.ivory), 0.06);
  mast.position.y = H + 1.4 + R * 1.3 + 3.5;
  const pennant = inked(new THREE.ConeGeometry(0.5, 3, 3), toon(PAL.red), 0.06);
  pennant.rotation.z = -Math.PI / 2;
  pennant.position.set(1.5, 2.8, 0);
  mast.add(pennant);
  g.add(deck, dome, mast);
  // Hanging gardens on the rim.
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const h = 3 + rng() * 1.5;
    const tree = inked(new THREE.ConeGeometry(0.9, h, 7), toon(pick(rng, [PAL.moss, PAL.teal])), 0.08);
    tree.position.set(Math.cos(a) * R * 1.85, H + 1.4 + h / 2, Math.sin(a) * R * 1.85);
    g.add(tree);
  }
  return g;
}

function makeTurbine(rng) {
  const g = new THREE.Group();
  const H = 14 + rng() * 8;
  const pole = inked(new THREE.CylinderGeometry(0.22, 0.5, H, 8), toon(PAL.ivory), 0.07);
  pole.position.y = H / 2;
  const nacelle = inked(new THREE.SphereGeometry(0.7, 12, 8), toon(PAL.ivory), 0.06);
  nacelle.scale.z = 1.6;
  nacelle.position.y = H;
  const rotor = new THREE.Group();
  rotor.position.set(0, H, 1.1);
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.ConeGeometry(0.6, 6.5, 4);
    geo.translate(0, 3.25, 0);
    geo.scale(1, 1, 0.25);
    const blade = inked(geo, toon(PAL.coral), 0.06);
    blade.rotation.z = (k / 3) * Math.PI * 2;
    rotor.add(blade);
  }
  g.add(pole, nacelle, rotor);
  g.rotation.y = WIND_ANGLE;
  const speed = 0.8 + rng() * 1.2;
  return { group: g, update: (t, dt) => (rotor.rotation.z += speed * dt) };
}

function makeSunFlower(rng) {
  const g = new THREE.Group();
  const H = 3 + rng() * 3;
  const stalk = inked(new THREE.CylinderGeometry(0.1, 0.18, H, 6), toon(PAL.moss), 0.05);
  stalk.position.y = H / 2;
  const head = new THREE.Group();
  head.position.y = H;
  const discGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.15, 14);
  discGeo.rotateX(Math.PI / 2);
  const disc = inked(discGeo, toon(PAL.saffron), 0.06);
  const heart = inked(new THREE.SphereGeometry(0.4, 10, 8), toon(PAL.coral), 0.05);
  heart.position.z = 0.15;
  head.add(disc, heart);
  g.add(stalk, head);
  const target = new THREE.Vector3();
  // Photovoltaic petals track the sun.
  return {
    group: g,
    update: (t, dt, { sunDir }) => {
      head.getWorldPosition(target).add(sunDir);
      head.lookAt(target);
    },
  };
}

function makeMushroom(rng) {
  const g = new THREE.Group();
  const H = 4 + rng() * 8;
  const R = 2.5 + rng() * 3.5;
  const stem = inked(new THREE.CylinderGeometry(0.35 + H * 0.03, 0.6 + H * 0.06, H, 8), toon(PAL.ivory), 0.08);
  stem.position.y = H / 2;
  const cap = inked(
    new THREE.SphereGeometry(R, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    toon(pick(rng, [PAL.rose, PAL.lilac, PAL.coral, PAL.teal])),
    0.12,
  );
  cap.scale.y = 0.55;
  cap.position.y = H - 0.2;
  const gill = new THREE.Mesh(new THREE.CircleGeometry(R, 18), toon(PAL.plum));
  gill.rotation.x = Math.PI / 2;
  gill.position.y = H - 0.2;
  g.add(stem, cap, gill);
  g.rotation.z = (rng() - 0.5) * 0.25;
  return g;
}

function makeStone(rng) {
  const s = inked(
    new THREE.DodecahedronGeometry(1.5 + rng() * 2, 0),
    toon(pick(rng, [PAL.lilac, PAL.rose, PAL.peach])),
    0.12,
  );
  s.scale.set(1, 1.2 + rng() * 2, 1);
  s.rotation.set(rng() * 0.3, rng() * 6, rng() * 0.3);
  return s;
}

function makeArch(rng) {
  const R = 8 + rng() * 8;
  const arch = inked(
    new THREE.TorusGeometry(R, R * 0.2, 10, 28, Math.PI),
    toon(pick(rng, [PAL.rose, PAL.ochre])),
    0.25,
  );
  arch.rotation.y = rng() * Math.PI;
  return arch;
}

function makeFloater(rng) {
  const g = new THREE.Group();
  const R = 3 + rng() * 4;
  const top = inked(new THREE.CylinderGeometry(R, R * 0.9, 1.2, 9), toon(PAL.moss), 0.12);
  const root = inked(new THREE.ConeGeometry(R * 0.9, R * 2.2, 9), toon(PAL.rose), 0.12);
  root.rotation.x = Math.PI;
  root.position.y = -0.6 - R * 1.1;
  const shroom = makeMushroom(rng);
  shroom.scale.setScalar(0.45);
  shroom.position.y = 0.6;
  g.add(top, root, shroom);
  const base = g.position.clone();
  const phase = rng() * 10;
  return {
    group: g,
    update: (t) => {
      g.position.y = base.y + Math.sin(t * 0.4 + phase) * 1.5;
      g.rotation.y = t * 0.05 + phase;
    },
    base,
  };
}

function makeJelly(rng) {
  const g = new THREE.Group();
  const R = 3 + rng() * 2.5;
  const color = pick(rng, [PAL.rose, PAL.lilac, PAL.teal]);
  const bell = inked(new THREE.SphereGeometry(R, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), toon(color), 0.15);
  const rim = Math.sin(Math.PI * 0.55) * R;
  const belly = new THREE.Mesh(new THREE.CircleGeometry(rim, 20), toon(PAL.plum));
  belly.rotation.x = Math.PI / 2;
  belly.position.y = Math.cos(Math.PI * 0.55) * R;
  const pod = inked(new THREE.SphereGeometry(0.8, 12, 8), toon(PAL.saffron), 0.06);
  pod.position.y = -R * 0.9;
  g.add(bell, belly, pod);
  const tentacles = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const len = R * 1.4 + rng() * R;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * R * 0.6, belly.position.y, Math.sin(a) * R * 0.6);
    const strand = inked(new THREE.CylinderGeometry(0.12, 0.05, len, 5), toon(PAL.ivory), 0.05);
    strand.position.y = -len / 2;
    pivot.add(strand);
    g.add(pivot);
    tentacles.push(pivot);
  }
  const orbit = { cx: (rng() - 0.5) * 300, cz: (rng() - 0.5) * 300, r: 30 + rng() * 60, speed: 0.02 + rng() * 0.04 };
  const altitude = 28 + rng() * 25;
  const phase = rng() * 10;
  return {
    group: g,
    update: (t) => {
      const a = t * orbit.speed + phase;
      const x = orbit.cx + Math.cos(a) * orbit.r;
      const z = orbit.cz + Math.sin(a) * orbit.r;
      g.position.set(x, Math.max(groundAt(x, z), WATER_LEVEL) + altitude + Math.sin(t * 0.8 + phase) * 2, z);
      tentacles.forEach((p, i) => {
        p.rotation.x = Math.sin(t * 1.3 + i) * 0.25;
        p.rotation.z = Math.cos(t * 1.1 + i * 1.7) * 0.25;
      });
    },
  };
}

function buildShrubs(rng) {
  const geo = new THREE.ConeGeometry(0.55, 1.6, 6);
  geo.translate(0, 0.8, 0);
  const count = 1600;
  const mesh = new THREE.InstancedMesh(geo, toon(0xffffff), count);
  const hull = new THREE.InstancedMesh(smoothed(geo), outlineMat(0.05), count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  // Clumps, not an even sprinkle.
  const mask = (x, z) => fbm(x * 0.03 + 91, z * 0.03 - 17, 2) > 0.5;
  let n = 0;
  for (let tries = 0; n < count && tries < count * 3; tries++) {
    const p = findSpot(rng, 8, 255, { maxSlope: 0.35, mask });
    if (!p) continue;
    s.setScalar(0.6 + rng() * 1.4);
    s.y *= 0.8 + rng() * 0.8;
    q.setFromAxisAngle(UP, rng() * 6);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    hull.setMatrixAt(n, m);
    mesh.setColorAt(n, c.setHex(pick(rng, [PAL.moss, PAL.moss, PAL.teal, PAL.saffron])));
    n++;
  }
  mesh.count = hull.count = n;
  mesh.castShadow = mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh, hull);
  return g;
}

// ---------------------------------------------------------------- Quest: seeds and the Mother Tree

function buildMotherTree() {
  const g = new THREE.Group();
  const trunk = inked(new THREE.CylinderGeometry(0.9, 1.7, 9, 10), toon(PAL.ivory), 0.12);
  trunk.position.y = 4.5;
  g.add(trunk);
  const crowns = [];
  const crownColors = [PAL.moss, PAL.teal, PAL.saffron, PAL.coral, PAL.moss, PAL.lilac];
  for (let k = 0; k < SEED_COUNT; k++) {
    const yaw = new THREE.Group();
    yaw.position.y = 8.5;
    yaw.rotation.y = (k / SEED_COUNT) * Math.PI * 2;
    const tilt = new THREE.Group();
    tilt.rotation.z = -0.75 - (k % 2) * 0.2;
    const branch = inked(new THREE.CylinderGeometry(0.22, 0.5, 6, 6), toon(PAL.ivory), 0.07);
    branch.position.y = 3;
    const crown = inked(new THREE.SphereGeometry(2.4, 16, 12), toon(crownColors[k]), 0.1);
    crown.position.y = 6.4;
    crown.scale.setScalar(0.001);
    tilt.add(branch, crown);
    yaw.add(tilt);
    g.add(yaw);
    crowns.push(crown);
  }
  // Ring of standing stones around the clearing.
  const rng = mulberry32(7);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const [x, z] = [Math.cos(a) * 24, Math.sin(a) * 24];
    const stone = makeStone(rng);
    stone.scale.multiplyScalar(0.6);
    stone.position.set(x, groundAt(x, z) - 0.3, z);
    g.add(stone);
  }
  return { group: g, crowns };
}

function makeSeed() {
  const g = new THREE.Group();
  const coreGeo = new THREE.IcosahedronGeometry(0.7, 0);
  const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: PAL.saffron }));
  core.add(new THREE.Mesh(smoothed(coreGeo), outlineMat(0.08)));
  core.position.y = 1.6;
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.08, 6, 32),
    new THREE.MeshBasicMaterial({ color: PAL.ivory }),
  );
  halo.position.y = 1.6;
  // Light beam visible across the whole map, the only "UI" in the world.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 90, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: PAL.saffron, transparent: true, opacity: 0.35, depthWrite: false, fog: false }),
  );
  beam.position.y = 46;
  g.add(core, halo, beam);
  return { group: g, core, halo };
}

// ---------------------------------------------------------------- World

export function createWorld(scene) {
  const rng = mulberry32(20261005);
  const sky = buildSky();
  scene.add(sky.group, buildTerrain(), buildWater());

  const animated = [];
  const place = (obj, spot) => {
    obj.position.copy(spot);
    scene.add(obj);
    return obj;
  };

  const tree = buildMotherTree();
  tree.group.position.y = groundAt(0, 0) - 0.3;
  scene.add(tree.group);

  // One garden tower per sector, each guarding a seed.
  const seeds = [];
  for (let k = 0; k < SEED_COUNT; k++) {
    const a0 = (k / SEED_COUNT) * Math.PI * 2;
    let spot = null;
    for (let i = 0; i < 60 && !spot; i++) {
      const a = a0 + (rng() - 0.5) * 0.7;
      const r = 80 + rng() * 140;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (groundAt(x, z) > WATER_LEVEL + 2) spot = new THREE.Vector3(x, groundAt(x, z) - 0.5, z);
    }
    if (!spot) continue;
    place(makeTower(rng), spot);
    const toCenter = spot.clone().setY(0).normalize().multiplyScalar(-11);
    const sx = spot.x + toCenter.x;
    const sz = spot.z + toCenter.z;
    const seed = makeSeed();
    seed.group.position.set(sx, Math.max(groundAt(sx, sz), WATER_LEVEL), sz);
    scene.add(seed.group);
    seeds.push({ ...seed, collected: false, position: seed.group.position });
  }

  for (let i = 0; i < 14; i++) {
    const spot = findSpot(rng, 40, 250, { minH: 6, maxSlope: 0.6 });
    if (!spot) continue;
    const t = makeTurbine(rng);
    place(t.group, spot);
    animated.push(t.update);
  }
  for (let i = 0; i < 45; i++) {
    const spot = findSpot(rng, 20, 240, { maxSlope: 0.4 });
    if (!spot) continue;
    const f = makeSunFlower(rng);
    place(f.group, spot);
    animated.push(f.update);
  }
  for (let i = 0; i < 50; i++) {
    const spot = findSpot(rng, 22, 250, { maxSlope: 0.5 });
    if (spot) place(makeMushroom(rng), spot);
  }
  for (let i = 0; i < 60; i++) {
    const spot = findSpot(rng, 20, 260, { minH: WATER_LEVEL - 2, maxSlope: 1.2 });
    if (spot) place(makeStone(rng), spot);
  }
  for (let i = 0; i < 5; i++) {
    const spot = findSpot(rng, 40, 230, { maxSlope: 0.6 });
    if (spot) place(makeArch(rng), spot.setY(spot.y - 1));
  }
  for (let i = 0; i < 7; i++) {
    const spot = findSpot(rng, 30, 230, { minH: -100, maxSlope: 100 });
    if (!spot) continue;
    const f = makeFloater(rng);
    f.base.set(spot.x, Math.max(spot.y, WATER_LEVEL) + 22 + rng() * 20, spot.z);
    place(f.group, f.base);
    animated.push(f.update);
  }
  for (let i = 0; i < 8; i++) {
    const j = makeJelly(rng);
    scene.add(j.group);
    animated.push(j.update);
  }
  scene.add(buildShrubs(rng));

  let grown = 0;
  return {
    sky,
    seeds,
    update(t, dt, ctx) {
      for (const fn of animated) fn(t, dt, ctx);
      for (const s of seeds) {
        if (s.collected) continue;
        s.core.rotation.y = t * 1.5;
        s.core.position.y = 1.6 + Math.sin(t * 2) * 0.25;
        s.halo.rotation.set(Math.PI / 2 + Math.sin(t) * 0.4, t, 0);
      }
      tree.crowns.forEach((crown, i) => {
        const target = i < grown ? 1 : 0.001;
        crown.scale.setScalar(THREE.MathUtils.damp(crown.scale.x, target, 2.5, dt));
      });
    },
    /** Returns the number of seeds gathered so far if one was just picked up, otherwise 0. */
    collectNear(pos) {
      for (const s of seeds) {
        if (s.collected || s.position.distanceTo(pos) > 2.8) continue;
        s.collected = true;
        s.group.visible = false;
        return ++grown;
      }
      return 0;
    },
  };
}

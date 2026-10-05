// Visual language: the natural colours of the Ligurian coast, rendered as 3D pixel art.
// Every world material goes through `paint()`: two-tone cel lighting with hue-shifted shadows,
// drifting cloud shadows, and a second render target output carrying view-space normals.
import * as THREE from 'three';

export const PAL = {
  ink: 0x2a1f3d,
  sand: 0xf4dfb4,
  sandDeep: 0xecd09a,
  peach: 0xf1b98f,
  rose: 0xdc9a9a,
  ochre: 0xe2b25c,
  lilac: 0xb7a0cf,
  cream: 0xf7ecd4,
  wetSand: 0xc9b48e,
  grass: 0x93b56a,
  grassDeep: 0x648f52,
  moss: 0x7fa562,
  teal: 0x4fb0a8,
  ivory: 0xf3ead6,
  coral: 0xe9765c,
  saffron: 0xf6c54f,
  red: 0xc9443c,
  skin: 0xf1c9a3,
  water: 0x5fc8c8,
  waterLight: 0x9fe3d6,
  plum: 0x7d5c9e,
  sky: 0x8fd3e0,
  pink: 0xf2a6c1,
  blue: 0x6f8fd6,
  wood: 0xb07a55,
};

export const WATER_LEVEL = -1.6;
export const PATH_COUNT = 8;

/** Uniforms shared by every painted material, updated once per frame. */
export const GLOBALS = {
  uTime: { value: 0 },
  uSunTint: { value: new THREE.Color(1, 1, 1) },
  uShadowTint: { value: new THREE.Color(0.6, 0.55, 0.85) },
  uGlow: { value: 0 },
  uNight: { value: 0 },
  // Cloud shadows: the share of the ground left in the sun.
  uCloudGap: { value: 0.72 },
  // Seasons: (autumn, winter, spring, snow cover), each 0 to 1.
  uSeason: { value: new THREE.Vector4() },
  uCloud: { value: new THREE.Vector2() },
  uPaths: { value: Array.from({ length: PATH_COUNT }, () => new THREE.Vector4()) },
  // Terrain heightmap, so water knows its depth: (half size, size, texels per side).
  uHeight: { value: null },
  uHeightMap: { value: new THREE.Vector3(1, 2, 2) },
};

// Hex (sRGB) → linear GLSL literal.
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

// Binary light ramp: a face is either in the sun or in the shade.
const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([0, 255]), 2, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const VERTEX_HEAD = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
`;

const VERTEX_SWAY = /* glsl */ `
#include <begin_vertex>
#if defined(SWAY) && defined(USE_INSTANCING)
  vec3 pxRoot = (modelMatrix * instanceMatrix[3]).xyz;
  float pxBend = max(position.y, 0.0);
  transformed.x += sin(uTime * 2.1 + pxRoot.x * 0.35 + pxRoot.z * 0.2) * 0.18 * pxBend;
  transformed.z += cos(uTime * 1.7 + pxRoot.x * 0.15 + pxRoot.z * 0.3) * 0.12 * pxBend;
#endif
`;

const VERTEX_WORLD = /* glsl */ `
#include <worldpos_vertex>
vec4 pxW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  pxW = instanceMatrix * pxW;
#endif
vWorld = (modelMatrix * pxW).xyz;
`;

const FRAGMENT_HEAD = /* glsl */ `
#include <common>
layout(location = 1) out highp vec4 gNormal;
uniform float uTime;
uniform vec3 uSunTint;
uniform vec3 uShadowTint;
uniform float uGlow;
uniform float uNight;
uniform float uCloudGap;
uniform vec4 uSeason;
uniform vec2 uCloud;
uniform vec4 uPaths[${PATH_COUNT}];
varying vec3 vWorld;

float pxHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float pxNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pxHash(i), pxHash(i + vec2(1, 0)), u.x), mix(pxHash(i + vec2(0, 1)), pxHash(i + vec2(1, 1)), u.x), u.y);
}
float pxFbm(vec2 p) {
  return pxNoise(p) * 0.6 + pxNoise(p * 2.03 + 17.0) * 0.3 + pxNoise(p * 4.1 - 9.0) * 0.1;
}

#ifdef TERRAIN
// Dry-stone terrace walls and cliffs: weathered Ligurian sandstone, grey to warm ochre.
const vec3 STRATA[6] = vec3[6](${[0xcdbb9c, 0xb8a88e, 0xd9c9a8, 0xc2ad8a, 0xa99c88, 0xcfb692].map(lin).join(', ')});

float pxSegment(vec2 p, vec4 s) {
  vec2 pa = p - s.xy;
  vec2 ba = s.zw - s.xy;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 terrainColor(vec3 w, vec3 n) {
  // Cliffs and walls: irregular courses of stone, broken up so they never read as stripes.
  float wobble = (pxNoise(w.xz * 0.22) - 0.5) * 1.1;
  float course = floor((w.y + wobble) / 0.55);
  int band = int(mod(course + floor(pxHash(vec2(course, floor((w.x + w.z) * 0.45 + course * 0.5))) * 3.0), 6.0));
  vec3 cliff = STRATA[band];

  // Flats: meadows and sand in organic patches, with a fine speckle.
  float patchN = pxFbm(w.xz * 0.045);
  float speck = pxHash(floor(w.xz * 3.0));
  // Higher up the mountain, the shelves are cultivated: greener.
  float green = patchN > mix(0.5, 0.3, smoothstep(4.0, 14.0, w.y)) ? 1.0 : 0.0;
  vec3 flat_ = green > 0.5
    ? (pxNoise(w.xz * 0.35) > 0.55 ? ${lin(PAL.grassDeep)} : ${lin(PAL.grass)})
    : (pxNoise(w.xz * 0.3) > 0.62 ? ${lin(PAL.sandDeep)} : ${lin(PAL.sand)});
  // Away from the shore the bare patches are sun-dried grass and earth, not sand.
  if (green < 0.5 && w.y > 3.0) flat_ = pxNoise(w.xz * 0.3) > 0.62 ? ${lin(0xc2ac72)} : ${lin(0xd2be82)};
  if (speck > 0.93) flat_ *= green > 0.5 ? 0.88 : 1.06;

  // Footpaths between the work areas.
  float path = 1e3;
  for (int i = 0; i < ${PATH_COUNT}; i++) path = min(path, pxSegment(w.xz, uPaths[i]));
  float edge = 1.5 + (pxNoise(w.xz * 1.2) - 0.5) * 0.7;
  if (path < edge) flat_ = path < edge - 0.45 ? ${lin(PAL.cream)} : ${lin(PAL.sandDeep)};

  // The true facet normal, not the smoothed one: terrace walls stay crisp courses of stone.
  float slope = 1.0 - min(n.y, abs(normalize(cross(dFdx(w), dFdy(w))).y));
  vec3 col = slope > 0.42 + (pxNoise(w.xz * 0.8) - 0.5) * 0.12 ? cliff : flat_;
  // White sand just above the waterline, wet sand at the water's edge.
  if (w.y < ${(WATER_LEVEL + 1.2).toFixed(2)} && slope < 0.3) col = speck > 0.9 ? ${lin(0xeee2c8)} : ${lin(0xfbf5e6)};
  if (w.y < ${(WATER_LEVEL + 0.35).toFixed(2)}) col = ${lin(0xe6d8b8)};
  return col;
}
#endif

#ifdef WATER
uniform sampler2D uHeight;
uniform vec3 uHeightMap;
vec3 waterColor(vec3 w) {
  vec2 uv = ((w.xz + uHeightMap.x) / uHeightMap.y * (uHeightMap.z - 1.0) + 0.5) / uHeightMap.z;
  float depth = ${WATER_LEVEL.toFixed(2)} - texture2D(uHeight, uv).r;
  // Mediterranean ramp: turquoise shallows to deep blue.
  vec3 col = depth < 1.0 ? ${lin(0xa6ecdc)}
    : depth < 2.6 ? ${lin(PAL.water)}
    : depth < 5.0 ? ${lin(0x3fa3c4)}
    : ${lin(0x2f78b3)};
  float ripple = pxNoise(w.xz * vec2(0.22, 0.5) + vec2(uTime * 0.25, uTime * 0.1));
  // The low sun lays a golden glitter on the swell.
  if (ripple > 0.68) col = mix(col, vec3(1.0, 0.78, 0.55), 0.3);
  // Foam lapping on the shore.
  float lap = 0.35 + 0.25 * sin(uTime * 1.3 + pxNoise(w.xz * 0.25) * 6.0);
  if (depth < lap) col = ${lin(0xf7fbf2)};
  float sparkle = pxHash(floor(w.xz * 2.0) + floor(uTime * 3.0) * vec2(7.0, 3.0));
  if (sparkle > 0.99) col = vec3(1.0, 0.93, 0.78);
  return col;
}
#endif
`;

const FRAGMENT_SHADE = /* glsl */ `
vec3 pxAlb = diffuseColor.rgb;
#ifdef TERRAIN
  pxAlb = terrainColor(vWorld, normalize(inverseTransformDirection(normal, viewMatrix)));
#endif
#ifdef WATER
  pxAlb = waterColor(vWorld);
#endif

#ifndef WATER
  // Vegetation turns with the seasons: patches of gold and russet in autumn, dull and bare in
  // winter, fresh in spring.
  if (pxAlb.g > pxAlb.r * 1.08 && pxAlb.g > pxAlb.b * 1.15) {
    float pxPatch = pxHash(floor(vWorld.xz / 2.5));
    float pxLum = dot(pxAlb, vec3(0.3, 0.6, 0.1));
    vec3 pxFall = (pxPatch < 0.14 ? vec3(1.9, 0.75, 0.2) : pxPatch < 0.3 ? vec3(2.0, 1.25, 0.25) : vec3(1.3, 1.05, 0.5)) * pxLum;
    // Most of the maquis is evergreen: only some plants turn.
    pxAlb = mix(pxAlb, pxFall, uSeason.x * 0.85 * step(pxPatch, 0.42));
    pxAlb = mix(pxAlb, vec3(pxLum) * vec3(1.05, 0.98, 0.8), uSeason.y * (0.35 + 0.4 * step(0.5, pxPatch)));
    pxAlb = mix(pxAlb, pxAlb * vec3(0.92, 1.14, 0.8) + vec3(0.0, 0.02, 0.0), uSeason.z);
  }
  // Snow settles on whatever faces the sky, from the peaks down as it deepens.
  if (uSeason.w > 0.001) {
    float pxSnowLine = mix(48.0, -6.0, uSeason.w) + (pxNoise(vWorld.xz * 0.3) - 0.5) * 5.0;
    if (inverseTransformDirection(normal, viewMatrix).y > 0.55 && vWorld.y > pxSnowLine) pxAlb = vec3(0.86, 0.9, 0.97);
  }
#endif

float pxLit = 0.0;
float pxNdl = 0.0;
#if NUM_DIR_LIGHTS > 0
  pxNdl = dot(normal, directionalLights[0].direction);
  pxLit = step(0.5, dot(reflectedLight.directDiffuse / max(diffuseColor.rgb, vec3(0.002)), vec3(0.3333)) * PI);
#endif
// Cloud shadows drifting over the land.
pxLit *= step(pxFbm(vWorld.xz * 0.04 + uCloud), uCloudGap);

vec3 pxCol;
if (pxLit > 0.5) {
  pxCol = pxAlb * uSunTint;
  if (pxNdl > 0.88) pxCol = pxCol * 1.07 + vec3(0.025, 0.018, 0.0);
} else {
  pxCol = pxAlb * uShadowTint;
  if (pxNdl < -0.3) pxCol *= 0.84;
}
#ifdef GLOW
  pxCol = mix(pxCol, pxAlb * 1.5 + 0.06, uGlow);
#endif
// After dark, lamps come on behind a good half of the window panes.
if (uNight > 0.0 && max(max(abs(pxAlb.r - 0.040), abs(pxAlb.g - 0.032)), abs(pxAlb.b - 0.056)) < 0.009) {
  if (pxHash(floor(vWorld.xz * 0.9) + floor(vWorld.y * 0.7) * 13.0) > 0.45) pxCol = mix(pxCol, vec3(1.0, 0.72, 0.32), uNight);
}
outgoingLight = pxCol;
gNormal = vec4(normal * 0.5 + 0.5, 1.0);
#include <opaque_fragment>
`;

const cache = new Map();

/**
 * @param {number} color sRGB hex
 * @param {{terrain?: boolean, water?: boolean, sway?: boolean, glow?: boolean, flat?: boolean, doubleSide?: boolean, backSide?: boolean, map?: THREE.Texture}} [opts]
 */
export function paint(color, opts = {}) {
  const { map, ...flags } = opts;
  const key = `${color}|${JSON.stringify(flags)}|${map?.uuid ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap,
    map: map ?? null,
    side: opts.doubleSide ? THREE.DoubleSide : opts.backSide ? THREE.BackSide : THREE.FrontSide,
  });
  if (opts.flat) mat.flatShading = true;
  mat.defines = {};
  if (opts.terrain) mat.defines.TERRAIN = '';
  if (opts.water) mat.defines.WATER = '';
  if (opts.sway) mat.defines.SWAY = '';
  if (opts.glow) mat.defines.GLOW = '';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, GLOBALS);
    shader.vertexShader = VERTEX_HEAD + shader.vertexShader
      .replace('#include <begin_vertex>', VERTEX_SWAY)
      .replace('#include <worldpos_vertex>', VERTEX_WORLD);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAGMENT_HEAD)
      .replace('#include <opaque_fragment>', FRAGMENT_SHADE);
  };
  cache.set(key, mat);
  return mat;
}

/** A mesh that casts and receives shadows. */
export function solid(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

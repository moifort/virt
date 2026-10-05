// Visual language: Mœbius palette rendered as 3D pixel art.
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
  grass: 0x9fd09a,
  grassDeep: 0x6fb08f,
  moss: 0x93c9a0,
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
// Dry-stone terrace walls: warm, muted, a touch of Mœbius rose and lilac.
const vec3 STRATA[6] = vec3[6](${[0xe8cfa6, 0xdcb9a6, 0xf0dfbd, 0xdcc394, 0xcbbccf, 0xe2ad92].map(lin).join(', ')});

float pxSegment(vec2 p, vec4 s) {
  vec2 pa = p - s.xy;
  vec2 ba = s.zw - s.xy;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 terrainColor(vec3 w, vec3 n) {
  // Cliffs: wavy sedimentary strata, the signature of Mœbius deserts.
  float wobble = (pxNoise(w.xz * 0.22) - 0.5) * 1.1;
  int band = int(mod(floor((w.y + wobble) / 1.1), 6.0));
  vec3 cliff = STRATA[band];

  // Flats: meadows and sand in organic patches, with a fine speckle.
  float patchN = pxFbm(w.xz * 0.045);
  float speck = pxHash(floor(w.xz * 3.0));
  // Higher up the mountain, the shelves are cultivated: greener.
  float green = patchN > mix(0.5, 0.3, smoothstep(4.0, 14.0, w.y)) ? 1.0 : 0.0;
  vec3 flat_ = green > 0.5
    ? (pxNoise(w.xz * 0.35) > 0.55 ? ${lin(PAL.grassDeep)} : ${lin(PAL.grass)})
    : (pxNoise(w.xz * 0.3) > 0.62 ? ${lin(PAL.sandDeep)} : ${lin(PAL.sand)});
  if (speck > 0.93) flat_ *= green > 0.5 ? 0.88 : 1.06;

  // Footpaths between the work areas.
  float path = 1e3;
  for (int i = 0; i < ${PATH_COUNT}; i++) path = min(path, pxSegment(w.xz, uPaths[i]));
  float edge = 1.5 + (pxNoise(w.xz * 1.2) - 0.5) * 0.7;
  if (path < edge) flat_ = path < edge - 0.45 ? ${lin(PAL.cream)} : ${lin(PAL.sandDeep)};

  float slope = 1.0 - n.y;
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

float pxLit = 0.0;
float pxNdl = 0.0;
#if NUM_DIR_LIGHTS > 0
  pxNdl = dot(normal, directionalLights[0].direction);
  pxLit = step(0.5, dot(reflectedLight.directDiffuse / max(diffuseColor.rgb, vec3(0.002)), vec3(0.3333)) * PI);
#endif
// Cloud shadows drifting over the land.
pxLit *= step(pxFbm(vWorld.xz * 0.04 + uCloud), 0.72);

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

// Visual language: the Ligurian coast painted the way a Ghibli background is — layered greens,
// warm light, cool coloured shadows, weather that leaves its mark — rendered as 3D pixel art.
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
  grass: 0x8cc558,
  grassDeep: 0x559c4e,
  moss: 0x74ae58,
  teal: 0x4fb0a8,
  ivory: 0xf3ead6,
  coral: 0xe9765c,
  saffron: 0xf6c54f,
  red: 0xc9443c,
  skin: 0xf1c9a3,
  water: 0x5fd0cc,
  waterLight: 0x9fe3d6,
  plum: 0x7d5c9e,
  sky: 0x8fd3e0,
  pink: 0xf2a6c1,
  blue: 0x6f8fd6,
  wood: 0xb07a55,
};

export const WATER_LEVEL = -1.6;
export const PATH_COUNT = 16;
// Single-file trails, a bare metre wide.
export const TRAIL_COUNT = 24;

const blank = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
blank.needsUpdate = true;

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
  uTrails: { value: Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector4()) },
  // Terrain heightmap, so water knows its depth: (half size, size, texels per side).
  uHeight: { value: null },
  uHeightMap: { value: new THREE.Vector3(1, 2, 2) },
  // Rain on the ground: (wet surfaces, puddle level, rain falling now, run-off in the gutters).
  uWet: { value: new THREE.Vector4() },
  // Wind: its direction on the ground (x, z) and its strength.
  uWind: { value: new THREE.Vector3(0.7, 0.7, 0.3) },
  // The sky as water, puddles and window panes mirror it.
  uSkyTint: { value: new THREE.Color(0.6, 0.8, 0.95) },
  // After dark: (street lamps on, share of the windows lit).
  uLamps: { value: new THREE.Vector2() },
  // Pools of lamplight over the map, laid out like the heightmap.
  uLampMap: { value: blank },
  // The beam of the lighthouse: where it stands (x, z), where it points, how bright it is.
  uBeam: { value: new THREE.Vector4() },
  // Where the endless sea meets the sky: the direction the view looks in on the ground (x, z)
  // and how far along it the horizon lies; and the haze the far water pales into.
  uHorizon: { value: new THREE.Vector3(0, -1, 1e4) },
  uHaze: { value: new THREE.Color(0.8, 0.9, 0.95) },
  // The road of light on the sea: the level direction square to the light (x, z), where the
  // road lies along it, and how bright it is.
  uSunPath: { value: new THREE.Vector4(1, 0, 0, 0) },
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
uniform vec3 uWind;
varying vec3 vWorld;
varying float vGust;
#if defined(FLOW) || defined(CASCADE)
  varying vec2 pxUv;
#endif
#ifdef TERRAIN
  attribute float aTerrace;
  varying float vTerrace;
#endif
float pxVHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float pxVNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pxVHash(i), pxVHash(i + vec2(1, 0)), u.x), mix(pxVHash(i + vec2(0, 1)), pxVHash(i + vec2(1, 1)), u.x), u.y);
}
`;

// Grass bows and tree crowns lean as gusts roll across the bay, all in the same direction.
const VERTEX_SWAY = /* glsl */ `
#include <begin_vertex>
vGust = 0.0;
#if (defined(SWAY) || defined(LEAF)) && defined(USE_INSTANCING)
  vec3 pxRoot = (modelMatrix * instanceMatrix[3]).xyz;
  vec3 pxBlow = vec3(uWind.x, 0.0, uWind.y);
  vGust = smoothstep(0.42, 0.78, pxVNoise((pxRoot.xz - uWind.xy * uTime * 5.0) * 0.055)) * uWind.z;
  // The wind in the frame of the instance, so every plant leans the same way whatever its turn.
  vec3 pxLean = vec3(dot(instanceMatrix[0].xyz, pxBlow), 0.0, dot(instanceMatrix[2].xyz, pxBlow)) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
  #ifdef SWAY
    float pxBend = max(position.y, 0.0);
    transformed.x += sin(uTime * 2.1 + pxRoot.x * 0.35 + pxRoot.z * 0.2) * 0.1 * pxBend;
    transformed.z += cos(uTime * 1.7 + pxRoot.x * 0.15 + pxRoot.z * 0.3) * 0.07 * pxBend;
    transformed += pxLean * vGust * 0.55 * pxBend;
  #else
    float pxBend = max(position.y - 0.8, 0.0);
    float pxRustle = sin(uTime * 1.6 + pxRoot.x * 0.7 + position.y * 1.3) * 0.012 + sin(uTime * 2.7 + pxRoot.z * 0.9 + position.x * 2.1) * 0.008;
    transformed += pxLean * (vGust * 0.035 + pxRustle * (0.6 + uWind.z)) * pxBend;
  #endif
#endif
`;

const VERTEX_WORLD = /* glsl */ `
#include <worldpos_vertex>
vec4 pxW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  pxW = instanceMatrix * pxW;
#endif
vWorld = (modelMatrix * pxW).xyz;
#if defined(FLOW) || defined(CASCADE)
  pxUv = uv;
#endif
#ifdef TERRAIN
  vTerrace = aTerrace;
#endif
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
uniform vec4 uTrails[${TRAIL_COUNT}];
uniform vec4 uWet;
uniform vec3 uWind;
uniform vec3 uSkyTint;
uniform vec2 uLamps;
uniform sampler2D uLampMap;
uniform vec4 uBeam;
uniform vec3 uHeightMap;
varying vec3 vWorld;
varying float vGust;
#if defined(FLOW) || defined(CASCADE)
  varying vec2 pxUv;
#endif

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

// Rain on standing water: now and then a drop lands in a cell, and its ring widens and fades.
float pxRings(vec2 p, float share) {
  vec2 cell = floor(p);
  if (pxHash(cell + 41.0) > share) return 0.0;
  float seed = pxHash(cell);
  float life = fract(uTime * (0.9 + seed * 0.8) + seed * 9.0);
  vec2 centre = cell + 0.3 + 0.4 * vec2(pxHash(cell + 3.1), pxHash(cell + 7.7));
  float r = length(p - centre);
  return life < 0.75 && abs(r - life * 0.5) < 0.1 ? 1.0 - life : 0.0;
}

#if defined(TERRAIN) || defined(WATER)
uniform sampler2D uHeight;
float pxGroundAt(vec2 xz) {
  return texture2D(uHeight, ((xz + uHeightMap.x) / uHeightMap.y * (uHeightMap.z - 1.0) + 0.5) / uHeightMap.z).r;
}
#endif

#ifdef TERRAIN
varying float vTerrace;
// Dry-stone terrace walls and cliffs: weathered Ligurian sandstone, grey to warm ochre.
const vec3 STRATA[6] = vec3[6](${[0xcdbb9c, 0xb8a88e, 0xd9c9a8, 0xc2ad8a, 0xa99c88, 0xcfb692].map(lin).join(', ')});
// 1 inside a puddle.
float pxPool = 0.0;

float pxSegment(vec2 p, vec4 s) {
  vec2 pa = p - s.xy;
  vec2 ba = s.zw - s.xy;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 terrainColor(vec3 w, vec3 n) {
  // One art pixel of ground, and what it happens to be.
  vec2 grain = floor(w.xz * 4.3);
  float fine = pxHash(grain);
  float kind = pxHash(grain + 19.0);
  // The true facet normal, not the smoothed one: terrace walls stay crisp courses of stone.
  float slope = 1.0 - min(n.y, abs(normalize(cross(dFdx(w), dFdy(w))).y));

  // Rock. Terrace walls are laid dry in level courses of small stones, broken up so they never
  // read as stripes. The living rock of the mountain is another thing: thick tilted beds that
  // hardly differ, greyer, stained warm and cool in great patches, split by cracks.
  float wobble = (pxNoise(w.xz * 0.22) - 0.5) * 1.1;
  float bedding = mix(wobble * 5.0 + w.x * 0.3 + w.z * 0.12, wobble, vTerrace);
  float course = floor((w.y + bedding) / mix(2.8, 0.55, vTerrace));
  int band = int(mod(course + floor(pxHash(vec2(course, floor((w.x + w.z) * 0.45 + course * 0.5))) * 3.0), 6.0));
  vec3 cliff = STRATA[band];
  if (vTerrace < 0.5) {
    vec2 face = vec2(w.x * 0.7 + w.z * 0.37, w.y);
    cliff = mix(cliff, ${lin(0xb9b2a6)}, 0.62);
    float stain = pxFbm(face * 0.06 + 7.0);
    cliff *= stain > 0.6 ? vec3(1.07, 1.0, 0.9) : stain < 0.38 ? vec3(0.9, 0.93, 0.98) : vec3(1.0);
    if (pxNoise(vec2(face.x * 1.4 + wobble * 2.0, w.y * 0.2)) > 0.74) cliff *= 0.82;
    // Wherever the face eases, scrub takes hold on it in clumps.
    if (slope < 0.8 && pxFbm(face * vec2(0.17, 0.26) + 13.0) > 0.57) cliff = fine > 0.6 ? ${lin(0x7aa05c)} : fine > 0.25 ? ${lin(0x55865a)} : ${lin(0x8fb468)};
  }
  if (fine > 0.9) cliff *= 0.88;
  // Every rock face is alive: grass and moss spill over its top, ivy hangs down it in places,
  // tufts cling to its ledges, and its foot stays damp. The height of the ground just uphill
  // tells how much of the face is left above.
  vec2 uphill = -normalize(n.xz + vec2(1e-4));
  float above = pxGroundAt(w.xz + uphill * 0.9) - w.y;
  float below = w.y - pxGroundAt(w.xz - uphill * 0.9);
  float creep = pxNoise(w.xz * 0.45 + 3.0);
  float ivy = smoothstep(0.56, 0.8, pxNoise(w.xz * 0.13 + 50.0));
  // Where the tile is cut the ground shows in section instead: turf, a band of brown earth
  // under it, then the bedrock.
  float buried = pxGroundAt(w.xz) - w.y;
  if (abs(n.y) < 0.02) cliff = buried < 0.4 ? ${lin(0x7aa05c)} : buried < 1.5 + creep ? (fine > 0.8 ? ${lin(0x7a5e46)} : ${lin(0x94745a)}) : cliff * 0.94;
  else if (above < 0.45 + creep * 0.55 + ivy * 1.5) cliff = fine > 0.55 ? ${lin(0x7aa05c)} : kind > 0.8 ? ${lin(0x9cbc68)} : ${lin(0x55865a)};
  else if (below < 0.25 + creep * 0.3) cliff *= vec3(0.84, 0.9, 0.82);
  // Where the sea washes the rock it is dark and weedy.
  if (w.y < ${(WATER_LEVEL + 0.7).toFixed(2)} + creep * 0.5) cliff = fine > 0.7 ? ${lin(0x5c7a5c)} : ${lin(0x7a7468)};

  // Flats: meadows in layered greens, with bare earth and sand showing through in patches.
  float patchN = pxFbm(w.xz * 0.045);
  float tuft = pxNoise(w.xz * 0.6);
  // Higher up the mountain, the shelves are cultivated: greener.
  bool green = patchN > mix(0.42, 0.28, smoothstep(4.0, 14.0, w.y));
  vec3 flat_;
  if (green) {
    flat_ = tuft > 0.64 ? ${lin(PAL.grassDeep)} : tuft < 0.3 ? ${lin(0xaed862)} : ${lin(PAL.grass)};
    // Blades catching the light, clover in the hollows.
    if (fine > 0.9) flat_ = ${lin(0xcbe474)};
    else if (fine < 0.09) flat_ = ${lin(0x3f8c56)};
    // Flowers come in drifts: daisies, buttercups, poppies and wild lavender.
    float bloom = (1.0 - uSeason.y) * (1.0 - uSeason.x * 0.8) * (0.55 + uSeason.z * 0.45);
    if (pxNoise(w.xz * 0.11 + 40.0) > 1.0 - bloom * 0.42 && fine > 0.82 && fine <= 0.9) {
      flat_ = kind < 0.4 ? ${lin(0xfbf6e4)} : kind < 0.68 ? ${lin(0xf6d24a)} : kind < 0.86 ? ${lin(0xe0564a)} : ${lin(0xa890d8)};
    }
  } else {
    flat_ = pxNoise(w.xz * 0.3) > 0.62 ? ${lin(PAL.sandDeep)} : ${lin(PAL.sand)};
    // Away from the shore the bare patches are sun-dried grass and earth, not sand.
    if (w.y > 3.0) flat_ = pxNoise(w.xz * 0.3) > 0.62 ? ${lin(0xc2ac72)} : ${lin(0xd2be82)};
    if (fine > 0.93) flat_ *= 1.07;
    else if (fine < 0.06) flat_ = ${lin(0x9db868)};
  }

  // Footpaths between the work areas: trodden earth with pebbles, grass creeping in.
  float path = 1e3;
  for (int i = 0; i < ${PATH_COUNT}; i++) path = min(path, pxSegment(w.xz, uPaths[i]));
  float edge = 1.5 + (pxNoise(w.xz * 1.2) - 0.5) * 0.7;
  bool track = path < edge;
  if (track) {
    flat_ = path < edge - 0.45 ? ${lin(PAL.cream)} : ${lin(PAL.sandDeep)};
    if (fine > 0.9) flat_ = ${lin(0xd8c8a4)};
    else if (fine < 0.05 && path > edge - 0.9) flat_ = ${lin(PAL.grass)};
  }
  // A single-file trail: a bare metre of packed earth and loose stones, worn by walkers, that
  // keeps its line even across the rock.
  float trail = 1e3;
  for (int i = 0; i < ${TRAIL_COUNT}; i++) trail = min(trail, pxSegment(w.xz, uTrails[i]));
  bool onTrail = trail < 0.55 + (pxNoise(w.xz * 1.7) - 0.5) * 0.3;
  if (onTrail) {
    flat_ = fine > 0.8 ? ${lin(0xc4ae86)} : ${lin(0xd6c29a)};
    if (fine < 0.09) flat_ = STRATA[band] * 0.92;
    track = true;
  }

  // As the ground steepens, stones show through the turf before the rock takes over.
  if (!track && fine < smoothstep(0.16, 0.42, slope) * 0.6) flat_ = STRATA[band] * (kind > 0.5 ? 1.0 : 0.88);
  vec3 col = !onTrail && slope > 0.42 + (pxNoise(w.xz * 0.8) - 0.5) * 0.12 ? cliff : flat_;
  // White sand just above the waterline, combed by the tide; wet sand at the water's edge.
  if (w.y < ${(WATER_LEVEL + 1.2).toFixed(2)} && slope < 0.3) {
    col = fine > 0.9 ? ${lin(0xeee2c8)} : ${lin(0xfbf5e6)};
    if (sin(w.y * 16.0 + pxNoise(w.xz * 0.4) * 5.0) > 0.92) col = ${lin(0xf0e4c8)};
    if (kind > 0.985) col = ${lin(0xd8a890)};
  }
  if (w.y < ${(WATER_LEVEL + 0.4).toFixed(2)}) col = ${lin(0xdccba6)};

  // Rain gathers in the hollows of level ground, on the trodden paths first.
  if (uWet.y > 0.01 && slope < 0.05 && w.y > ${(WATER_LEVEL + 1.3).toFixed(2)}) {
    float hollow = pxFbm(w.xz * 0.21 + 21.0) + (track ? 0.04 : 0.0);
    float brim = 1.08 - uWet.y * 0.4;
    if (hollow > brim) {
      pxPool = 1.0;
      col = mix(col * 0.5, uSkyTint, 0.6);
      if (pxRings(w.xz * 0.75, uWet.z * 0.7) > 0.25) col = mix(col, vec3(1.0), 0.45);
    } else if (hollow > brim - 0.03) {
      col *= 0.7;
    }
  }
  return col;
}
#endif

#ifdef WATER
uniform vec3 uHorizon;
uniform vec3 uHaze;
uniform vec4 uSunPath;
vec3 waterColor(vec3 w) {
  float depth = ${WATER_LEVEL.toFixed(2)} - pxGroundAt(w.xz);
  vec2 grain = floor(w.xz * 4.3);
  float fine = pxHash(grain);
  // Mediterranean ramp, clear to the bottom: pale turquoise over the sand, then deep blue.
  // The bands fray into each other pixel by pixel.
  float d = depth + (fine - 0.5) * min(depth, 1.6) * 0.5;
  vec3 col = d < 0.9 ? ${lin(0xb6f4e2)}
    : d < 2.0 ? ${lin(0x84e4d2)}
    : d < 3.6 ? ${lin(PAL.water)}
    : d < 5.6 ? ${lin(0x46b2d6)}
    : d < 7.4 ? ${lin(0x3896d2)}
    : ${lin(0x2f82ca)};
  // The sea bed shows through, as it does from the air: broad dark meadows of posidonia with
  // ragged edges over the middle depths, pools of bare sand inside them paler than the rest,
  // and the brightest water of all over the sand banks.
  if (depth > 0.7 && depth < 8.0) {
    float meadow = pxFbm(w.xz * 0.028 + 31.0) * 0.8 + pxFbm(w.xz * 0.11 - 17.0) * 0.2 + (pxNoise(w.xz * 0.6) - 0.5) * 0.08;
    float hold = smoothstep(0.7, 2.2, depth) * smoothstep(8.0, 5.0, depth);
    if (meadow > 0.56) col = mix(col, ${lin(0x1e5f6a)}, (0.3 + 0.35 * smoothstep(0.56, 0.66, meadow)) * hold);
    else if (meadow < 0.4 && depth < 3.6) col = mix(col, ${lin(0xbdf6e6)}, 0.35);
  }
  // A net of light dances on the sand in the shallows.
  if (depth < 2.4 && uNight < 0.5) {
    vec2 q = w.xz * 0.8;
    float net = abs(pxNoise(q + vec2(uTime * 0.22, uTime * 0.13)) - pxNoise(q * 1.4 - vec2(uTime * 0.17, -uTime * 0.2) + 7.0));
    if (net < 0.03) col = mix(col, ${lin(0xe8fff4)}, 0.55);
  }
  // Under a grey sky the sea greys with it.
  float overcast = 1.0 - smoothstep(0.3, 0.72, uCloudGap);
  col = mix(col, uSkyTint * 0.8, 0.12 + overcast * 0.3);

  // The swell: long broken crests running in to the shore.
  float shoreward = -(w.x + w.z) * 0.7071;
  float along = (w.x - w.z) * 0.7071;
  float crest = sin(shoreward * 0.5 + pxNoise(vec2(along * 0.06, shoreward * 0.04)) * 7.0 + uTime * 0.55);
  float broken = pxNoise(vec2(along * 0.25 + uTime * 0.08, shoreward * 0.6));
  if (depth > 1.4 && crest > 0.955 && broken > 0.46) col = mix(col, ${lin(0xcdf2ee)}, 0.3 + uWind.z * 0.25);
  // Glitter: short dashes of light gathered in shoals where the sun strikes, gold when it is
  // low, silver under the moon.
  float dash = pxHash(floor(vec2(along * 1.1, shoreward * 4.3)) + floor(uTime * 2.5) * vec2(7.0, 3.0));
  float shoal = smoothstep(0.52, 0.8, pxNoise(w.xz * 0.045 + uTime * 0.02)) * (1.0 - overcast);
  // Under a low sun, or the moon, the light lays a shimmering road across the water.
  float aside = dot(w.xz, uSunPath.xy) - uSunPath.z;
  float road = uSunPath.w * exp(-aside * aside / 500.0) * (1.0 - overcast);
  col = mix(col, mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.72, 0.42), 1.0 - uNight), road * 0.22);
  if (dash > 0.998 - shoal * 0.035 - road * 0.22) col = mix(vec3(1.0, 0.98, 0.92), vec3(1.0, 0.8, 0.5), uGlow * (1.0 - uNight));
  // Rain dimples the whole surface.
  if (uWet.z > 0.02 && pxRings(w.xz * 0.95, uWet.z * 0.3) > 0.3) col = mix(col, vec3(0.9, 0.95, 1.0), 0.4);

  // Foam: a bright lip lapping on the shore, and the lace the last wave left behind it.
  float swash = pxNoise(vec2(along * 0.2, uTime * 0.1));
  float lap = 0.32 + 0.24 * sin(uTime * 1.2 + swash * 6.0);
  if (depth < lap) col = ${lin(0xf7fbf2)};
  else if (depth < lap + 0.75 && pxNoise(w.xz * 1.5 + vec2(0.0, uTime * 0.15)) > 0.62 + (depth - lap) * 0.3) col = mix(col, ${lin(0xf7fbf2)}, 0.7);
  return col;
}
#endif
`;

const FRAGMENT_SHADE = /* glsl */ `
vec3 pxBase = diffuseColor.rgb;
vec3 pxAlb = pxBase;
vec3 pxUp = normalize(inverseTransformDirection(normal, viewMatrix));
// One art pixel of surface.
float pxBit = pxHash(floor(vWorld.xz * 4.3) + floor(vWorld.y * 4.3) * 7.0);
// Window panes are told by their colour.
bool pxGlass = max(max(abs(pxBase.r - 0.040), abs(pxBase.g - 0.032)), abs(pxBase.b - 0.056)) < 0.009;
#ifdef TERRAIN
  pxAlb = terrainColor(vWorld, pxUp);
#endif
#ifdef WATER
  // The sea ends at the horizon; past it there is only sky.
  float pxOffing = dot(vWorld.xz, uHorizon.xy) - uHorizon.z;
  if (pxOffing > 0.0) discard;
  pxAlb = waterColor(vWorld);
#endif

#ifdef ROOF
  // Courses of tiles down the slope: some bleached by the sun, some dark with lichen.
  float pxRow = floor(vWorld.y * 1.94);
  float pxTile = pxHash(vec2(pxRow, floor(vWorld.x * 2.1) + floor(vWorld.z * 2.1) * 5.0));
  if (mod(pxRow, 2.0) < 0.5) pxAlb *= 0.9;
  if (pxTile > 0.86) pxAlb = pxAlb * 1.13 + 0.01;
  else if (pxTile < 0.1) pxAlb *= vec3(0.8, 0.86, 0.78);
#endif
#ifdef WALL
  // Old plaster: rain streaks down the facades, paler patches where it was mended.
  if (abs(pxUp.y) < 0.4 && !pxGlass) {
    float pxAcross = vWorld.x * 2.9 - vWorld.z * 0.9;
    if (pxNoise(vec2(pxAcross, vWorld.y * 0.3)) > 0.68) pxAlb *= 0.93;
    if (pxNoise(vec2(pxAcross * 0.3, vWorld.y * 0.9) + 11.0) > 0.7) pxAlb = pxAlb * 1.05 + 0.008;
  }
#endif

#ifndef WATER
  // Vegetation turns with the seasons: patches of gold and russet in autumn, dull and bare in
  // winter, fresh in spring.
  bool pxGreen = pxAlb.g > pxAlb.r * 1.08 && pxAlb.g > pxAlb.b * 1.15;
  #ifdef LEAF
    pxGreen = true;
  #endif
  if (pxGreen) {
    float pxPatch = pxHash(floor(vWorld.xz / 2.5));
    float pxLum = dot(pxAlb, vec3(0.3, 0.6, 0.1));
    vec3 pxFall = (pxPatch < 0.14 ? vec3(1.9, 0.75, 0.2) : pxPatch < 0.3 ? vec3(2.0, 1.25, 0.25) : vec3(1.3, 1.05, 0.5)) * pxLum;
    // This is an evergreen coast: pines, oaks, olives and most of the maquis keep their green
    // all year and only warm a little. The grass yellows in patches. Vines and orchards are
    // the ones that blaze in autumn and stand bare and brown in winter.
    float pxTurns = step(pxPatch, 0.42) * 0.6;
    float pxFades = 0.3 + 0.3 * step(0.5, pxPatch);
    #ifdef LEAF
      pxTurns = step(pxPatch, 0.2) * 0.35;
      pxFades = 0.12;
    #endif
    #if defined(BLOSSOM) || defined(DECIDUOUS)
      pxTurns = 1.0;
      pxFades = 0.75;
    #endif
    pxAlb = mix(pxAlb, pxFall, uSeason.x * 0.85 * pxTurns);
    pxAlb = mix(pxAlb, vec3(pxLum) * vec3(1.05, 0.98, 0.8), uSeason.y * pxFades);
    pxAlb = mix(pxAlb, pxAlb * vec3(0.92, 1.14, 0.8) + vec3(0.0, 0.02, 0.0), uSeason.z);
  }
  #ifdef LEAF
    // Foliage is painted in clumps: sunlit tips, a middle green, cool depths between the boughs.
    float pxClump = pxNoise(vWorld.xz * 1.7 + vWorld.y * 1.2 + 5.0);
    if (pxClump > 0.6 || pxBit > 0.9) pxAlb = pxAlb * vec3(1.24, 1.18, 0.82) + vec3(0.014, 0.022, 0.0);
    else if (pxClump < 0.36 || pxBit < 0.08) pxAlb *= vec3(0.7, 0.82, 0.94);
    // A gust turns the leaves over, pale side up.
    pxAlb *= 1.0 + 0.14 * vGust;
  #endif
  #ifdef BLOSSOM
    // Orchard trees: a cloud of blossom in spring, bare boughs in the dead of winter.
    if (pxBit > 1.0 - uSeason.y * 0.72) discard;
    if (pxBit > 0.22) pxAlb = mix(pxAlb, pxBit > 0.6 ? vec3(0.98, 0.9, 0.9) : vec3(0.95, 0.62, 0.7), uSeason.z);
  #endif
  #ifdef SWAY
    // Wind running through the grass shows as a paler wave.
    pxAlb *= 1.0 + 0.22 * vGust;
  #endif
  // Rain darkens and deepens every colour, most where the water sits.
  if (uWet.x > 0.001) {
    float pxSoak = uWet.x * (0.1 + 0.14 * max(pxUp.y, 0.0));
    pxAlb = mix(vec3(dot(pxAlb, vec3(0.3, 0.6, 0.1))), pxAlb, 1.0 + pxSoak * 0.8) * (1.0 - pxSoak);
  }
  // Snow settles first on roofs, wall tops and boughs, then closes over the open ground; the
  // heights whiten long before the shore.
  if (uSeason.w > 0.001 && pxUp.y > 0.45) {
    float pxHold = pxNoise(vWorld.xz * 0.9) * 0.34 + pxNoise(vWorld.xz * 0.12 + 8.0) * 0.26 + (1.0 - pxUp.y) * 0.4;
    #ifdef TERRAIN
      pxHold += 0.28 - clamp(vWorld.y / 36.0, 0.0, 0.36) + pxPool * 0.2;
    #endif
    float pxDepth = uSeason.w * 1.3 - pxHold;
    if (pxDepth > 0.0) pxAlb = pxDepth < 0.05 && pxBit > 0.5 ? mix(pxAlb, vec3(0.86, 0.9, 0.97), 0.5) : pxBit > 0.94 ? vec3(0.98, 0.99, 1.0) : vec3(0.86, 0.9, 0.97);
  }
#endif

#ifdef CASCADE
  // Falling water: white threads sliding down over blue, each lane at its own pace. The mesh
  // gives the distance fallen in its texture coordinate.
  float pxLane = pxHash(vec2(floor(pxUv.x * 7.0), 3.0));
  float pxFall = fract(pxUv.y * (0.22 + pxLane * 0.1) - uTime * (0.7 + pxLane * 0.5) + pxLane * 5.0);
  pxAlb = pxFall < 0.4 ? vec3(0.97, 0.99, 1.0) : pxFall < 0.72 ? vec3(0.74, 0.9, 0.96) : vec3(0.45, 0.74, 0.88);
#endif

float pxLit = 0.0;
float pxNdl = 0.0;
#if NUM_DIR_LIGHTS > 0
  pxNdl = dot(normal, directionalLights[0].direction);
  pxLit = step(0.5, dot(reflectedLight.directDiffuse / max(diffuseColor.rgb, vec3(0.002)), vec3(0.3333)) * PI);
#endif
#ifdef LEAF
  // On foliage the edge of the light is ragged, leaf by leaf, never a clean curve.
  if (pxNdl < 0.36 && pxBit < (0.36 - pxNdl) * 1.5) pxLit = 0.0;
#endif
// The shadows of the clouds, when there are clouds: broad and slow, so they read as weather
// passing over and never as the shadows of things shifting.
pxLit *= step(pxFbm(vWorld.xz * 0.012 + uCloud), uCloudGap);

vec3 pxCol;
if (pxLit > 0.5) {
  pxCol = pxAlb * uSunTint;
  if (pxNdl > 0.88) pxCol = pxCol * 1.07 + vec3(0.025, 0.018, 0.0);
} else {
  pxCol = pxAlb * uShadowTint;
  if (pxNdl < -0.3) pxCol *= 0.84;
  #ifdef WATER
    // A cloud's shadow only deepens the sea a little.
    pxCol = pxAlb * mix(uShadowTint, uSunTint, 0.5);
  #endif
}
#ifdef GLOW
  pxCol = mix(pxCol, pxAlb * 1.5 + 0.06, uGlow);
#endif
#ifdef WATER
  // Far out the water pales into the haze until nothing tells it from the sky.
  pxCol = mix(pxCol, uHaze, smoothstep(-190.0, -12.0, pxOffing));
#endif
#ifndef WATER
  // Rain bounces off everything that faces the sky.
  if (uWet.z > 0.02 && pxUp.y > 0.5 && pxHash(floor(vWorld.xz * 4.3) + floor(uTime * 9.0) * vec2(3.0, 7.0)) > 1.0 - uWet.z * 0.009) pxCol = mix(pxCol, vec3(0.82, 0.88, 0.96), 0.38);
#endif
if (pxGlass) {
  // By day a pane mirrors the sky. After dark the lamps come on behind the windows one house
  // at a time, most of them warm, a few with the cold flicker of a television.
  float pxPane = pxHash(floor(vWorld.xz * 0.9) + floor(vWorld.y * 0.7) * 13.0);
  pxCol = mix(pxCol, uSkyTint * (pxLit > 0.5 ? 0.75 : 0.45), 0.4 * (1.0 - uNight));
  if (pxPane < uLamps.y) pxCol = pxPane < 0.035 ? vec3(0.55, 0.72, 0.95) * (0.85 + 0.15 * sin(uTime * 9.0 + pxPane * 90.0)) : pxPane < 0.25 ? vec3(1.0, 0.82, 0.45) : vec3(1.0, 0.7, 0.32);
}
// Lamplight pools on whatever stands near a lantern, in two soft steps.
float pxLamp = texture2D(uLampMap, (vWorld.xz + uHeightMap.x) / uHeightMap.y).r * uLamps.x;
// Each flame breathes a little, on its own.
pxLamp *= 0.93 + 0.07 * sin(uTime * 5.0 + pxHash(floor(vWorld.xz / 7.0)) * 40.0);
if (pxLamp > 0.12) pxCol += (pxAlb * 0.75 + 0.03) * vec3(1.0, 0.72, 0.36) * (pxLamp > 0.5 ? 0.85 : pxLamp > 0.27 ? 0.5 : 0.22);
// The lighthouse sweeps its beam round over the sea and the shore: a bright core in a paler wedge.
if (uBeam.w > 0.01 && vWorld.y < 6.0) {
  vec2 pxTo = vWorld.xz - uBeam.xy;
  vec2 pxAim = vec2(cos(uBeam.z), sin(uBeam.z));
  float pxOut = dot(pxTo, pxAim);
  float pxOff = abs(pxTo.x * pxAim.y - pxTo.y * pxAim.x);
  if (pxOut > 4.0 && pxOut < 170.0 && pxOff < 1.5 + pxOut * 0.06) pxCol += (pxAlb * 0.5 + 0.02) * vec3(1.0, 0.92, 0.7) * uBeam.w * (pxOff < 0.6 + pxOut * 0.025 ? 0.9 : 0.4) * (1.0 - pxOut / 170.0);
}
#ifdef FLOW
  // Rain water: gutters pour while it rains and drip long afterwards; when it freezes the
  // spouts grow icicles instead. The instance colour says how much water each one carries.
  float pxSeed = pxHash(floor(vWorld.xz * 3.0));
  float pxDrop = fract(vWorld.y * 0.45 + uTime * (1.6 + pxSeed * 0.5) + pxSeed * 7.0);
  bool pxIce = uSeason.w > 0.25 && pxUv.y > 0.9 + 0.06 * pxSeed;
  if (!pxIce && pxDrop > uWet.w * pxBase.r) discard;
  pxCol = pxIce ? vec3(0.8, 0.9, 1.0) * (0.5 + 0.5 * uSunTint) : mix(uSkyTint, vec3(1.0), 0.55) * (0.45 + 0.55 * uSunTint);
#endif
outgoingLight = pxCol;
gNormal = vec4(normal * 0.5 + 0.5, 1.0);
#include <opaque_fragment>
`;

const cache = new Map();
const FLAGS = { terrain: 'TERRAIN', water: 'WATER', sway: 'SWAY', glow: 'GLOW', leaf: 'LEAF', blossom: 'BLOSSOM', deciduous: 'DECIDUOUS', roof: 'ROOF', wall: 'WALL', flow: 'FLOW', cascade: 'CASCADE' };

/**
 * @param {number} color sRGB hex
 * @param {{terrain?: boolean, water?: boolean, sway?: boolean, glow?: boolean, leaf?: boolean, blossom?: boolean, deciduous?: boolean, roof?: boolean, wall?: boolean, flow?: boolean, cascade?: boolean, flat?: boolean, doubleSide?: boolean, backSide?: boolean, map?: THREE.Texture}} [opts]
 *   `leaf` is foliage (painted in clumps, rustling, evergreen unless `deciduous`), `blossom` an
 *   orchard crown that flowers and
 *   sheds, `roof` tiles, `wall` aged plaster, `flow` rain water running off a roof, `cascade` a
 *   stream or a waterfall.
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
  for (const [flag, define] of Object.entries(FLAGS)) if (opts[flag]) mat.defines[define] = '';
  if (opts.blossom) mat.defines.LEAF = '';
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

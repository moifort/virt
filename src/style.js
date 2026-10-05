// Visual language: flat pastel tones + ink outlines, in the spirit of Mœbius.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAL = {
  ink: 0x2a1f3d,
  sand: 0xf4dfb4,
  peach: 0xf1b98f,
  rose: 0xdc9a9a,
  ochre: 0xe2b25c,
  lilac: 0xb7a0cf,
  wetSand: 0xc9b48e,
  moss: 0x93c9a0,
  teal: 0x5cb5ad,
  ivory: 0xf3ead6,
  coral: 0xe9765c,
  saffron: 0xf6c54f,
  red: 0xc9443c,
  skin: 0xf1c9a3,
  water: 0x74d4cf,
  plum: 0x7d5c9e,
};

// Three hard light steps instead of a smooth ramp: the "aplat" look.
export const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const toonCache = new Map();
export function toon(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!toonCache.has(key)) toonCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap, ...opts }));
  return toonCache.get(key);
}

// Inverted-hull outline: back faces pushed along the normal, drawn in flat ink.
const outlineCache = new Map();
export function outlineMat(thickness = 0.1, fog = true) {
  const key = `${thickness}|${fog}`;
  if (!outlineCache.has(key)) {
    const mat = new THREE.MeshBasicMaterial({ color: PAL.ink, side: THREE.BackSide, fog });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = position + normal * ${thickness.toFixed(4)};`,
      );
    };
    mat.customProgramCacheKey = () => `outline-${key}`;
    outlineCache.set(key, mat);
  }
  return outlineCache.get(key);
}

// Hard edges split vertices; merging them gives continuous normals so the hull stays closed.
const smoothCache = new WeakMap();
export function smoothed(geometry) {
  if (!smoothCache.has(geometry)) {
    const geo = geometry.clone();
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    const merged = mergeVertices(geo);
    merged.computeVertexNormals();
    smoothCache.set(geometry, merged);
  }
  return smoothCache.get(geometry);
}

export function inked(geometry, material, thickness = 0.1, { fog = true, shadows = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.add(new THREE.Mesh(smoothed(geometry), outlineMat(thickness, fog)));
  return mesh;
}

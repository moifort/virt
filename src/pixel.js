// 3D pixel-art pipeline, after t3ssel8r:
//  1. render the scene at low resolution into two targets (color + view-space normals),
//  2. composite at that resolution: dark outlines on depth breaks, light rims on convex creases,
//     ordered dithering onto a reduced palette,
//  3. upscale with nearest sampling, shifting by the camera's sub-texel snap error for smooth motion.
import * as THREE from 'three';

const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uDepthRange;
uniform float uDepthThreshold;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uInk;
varying vec2 vUv;

float depthAt(vec2 o) { return texture2D(tDepth, vUv + o / uRes).r * uDepthRange; }
vec3 normalAt(vec2 o) { return texture2D(tNormal, vUv + o / uRes).rgb * 2.0 - 1.0; }

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return float(m[i.y * 4 + i.x]) / 16.0 - 0.5;
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  float raw = texture2D(tDepth, vUv).r;
  float d = raw * uDepthRange;

  if (raw >= 0.99999) {
    col = mix(uSkyHorizon, uSkyTop, smoothstep(0.2, 1.0, vUv.y));
  } else {
    vec3 n = normalAt(vec2(0.0));
    vec2 taps[4] = vec2[4](vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1));

    // Silhouettes: only the nearer pixel of a depth break draws the line.
    float depthEdge = 0.0;
    float creases = 0.0;
    for (int i = 0; i < 4; i++) {
      float nd = depthAt(taps[i]);
      depthEdge = max(depthEdge, nd - d);
      // Convex creases: shallower pixel, normals diverging toward the bias direction.
      vec3 nn = normalAt(taps[i]);
      float towardBias = smoothstep(-0.01, 0.01, dot(n - nn, vec3(1.0, 1.0, 1.0)));
      float shallower = clamp(sign((nd - d) * 0.25 + 0.0025), 0.0, 1.0);
      creases += (1.0 - dot(n, nn)) * towardBias * shallower;
    }

    if (depthEdge > uDepthThreshold) {
      col = mix(col * 0.38, uInk, 0.3);
    } else if (creases > 0.12) {
      col = col * 1.32 + vec3(0.035, 0.028, 0.012);
    }
  }

  // Ordered dithering onto 24 levels per channel: gradients become pixel-art ramps.
  vec3 s = toSRGB(col);
  s = floor(s * 23.0 + 0.5 + bayer4(gl_FragCoord.xy) * 0.9) / 23.0;
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

const UPSCALE_FRAGMENT = /* glsl */ `
uniform sampler2D tImage;
uniform vec2 uRes;
uniform float uScale;
uniform vec2 uOffset;
void main() {
  vec2 texel = gl_FragCoord.xy / uScale - uOffset;
  vec2 uv = (floor(texel) + 0.5) / uRes;
  gl_FragColor = texture2D(tImage, clamp(uv, 0.5 / uRes, 1.0 - 0.5 / uRes));
}`;

function fullscreen(material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return scene;
}

export class PixelRenderer {
  /** @param {number} pixelSize CSS pixels per art pixel */
  constructor(renderer, pixelSize = 3) {
    this.renderer = renderer;
    this.pixelSize = pixelSize;
    this.lowRes = new THREE.Vector2(1, 1);
    this.offset = new THREE.Vector2();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.gbuffer = new THREE.WebGLRenderTarget(1, 1, { ...nearest, count: 2, type: THREE.HalfFloatType });
    this.gbuffer.depthTexture = new THREE.DepthTexture(1, 1);
    this.image = new THREE.WebGLRenderTarget(1, 1, nearest);

    this.composite = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.gbuffer.textures[0] },
        tNormal: { value: this.gbuffer.textures[1] },
        tDepth: { value: this.gbuffer.depthTexture },
        uRes: { value: this.lowRes },
        uDepthRange: { value: 1 },
        uDepthThreshold: { value: 1 },
        uSkyTop: { value: new THREE.Color() },
        uSkyHorizon: { value: new THREE.Color() },
        uInk: { value: new THREE.Color(0x2a1f3d) },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.upscale = new THREE.ShaderMaterial({
      uniforms: {
        tImage: { value: this.image.texture },
        uRes: { value: this.lowRes },
        uScale: { value: 1 },
        uOffset: { value: this.offset },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: UPSCALE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.compositeScene = fullscreen(this.composite);
    this.upscaleScene = fullscreen(this.upscale);
  }

  setSize(width, height) {
    const dpr = Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height);
    const scale = this.pixelSize * dpr;
    this.lowRes.set(Math.ceil((width * dpr) / scale), Math.ceil((height * dpr) / scale));
    this.gbuffer.setSize(this.lowRes.x, this.lowRes.y);
    this.image.setSize(this.lowRes.x, this.lowRes.y);
    this.upscale.uniforms.uScale.value = scale;
  }

  render(scene, camera, { skyTop, skyHorizon, texelWorld }) {
    const r = this.renderer;
    const u = this.composite.uniforms;
    u.uDepthRange.value = camera.far - camera.near;
    u.uDepthThreshold.value = texelWorld * 4;
    u.uSkyTop.value.copy(skyTop);
    u.uSkyHorizon.value.copy(skyHorizon);

    r.setRenderTarget(this.gbuffer);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, camera);
    r.setRenderTarget(this.image);
    r.render(this.compositeScene, this.quadCamera);
    r.setRenderTarget(null);
    r.render(this.upscaleScene, this.quadCamera);
  }
}

/** Isometric orthographic camera locked to the texel grid; the snap error is handed to the upscaler. */
export class PixelCamera {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
    // Isometric: looking down a corner of the grid, 35.26° below the horizon.
    this.yaw = 0;
    this.pitch = Math.atan(Math.SQRT1_2);
    this.viewHeight = 60;
    this.distance = 220;
    this.texelWorld = 0.1;
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
  }

  update(target, lowRes, offsetOut) {
    const cam = this.camera;
    cam.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    this._right.set(e[0], e[1], e[2]);
    this._up.set(e[4], e[5], e[6]);
    this._fwd.set(-e[8], -e[9], -e[10]);

    const texel = this.viewHeight / lowRes.y;
    this.texelWorld = texel;
    cam.position.copy(target).addScaledVector(this._fwd, -this.distance);
    const r = cam.position.dot(this._right);
    const u = cam.position.dot(this._up);
    const dr = Math.round(r / texel) * texel - r;
    const du = Math.round(u / texel) * texel - u;
    cam.position.addScaledVector(this._right, dr).addScaledVector(this._up, du);
    offsetOut.set(dr / texel, du / texel);

    const halfW = (texel * lowRes.x) / 2;
    const halfH = (texel * lowRes.y) / 2;
    Object.assign(cam, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    cam.near = 1;
    cam.far = this.distance * 2 + 200;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
}

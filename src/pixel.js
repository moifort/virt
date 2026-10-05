// 3D pixel-art pipeline, after t3ssel8r:
//  1. render the scene at low resolution into two targets (color + view-space normals),
//  2. composite at that resolution: the painted sky, dark outlines on depth breaks, light rims
//     on convex creases, the weather falling across the picture, ordered dithering onto a
//     reduced palette,
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
uniform float uTime;
uniform float uCloud;
uniform float uRain;
uniform float uSnow;
uniform float uNight;
uniform vec3 uCloudTint;
uniform vec3 uCloudLight;
uniform float uSlant;
uniform float uWind;
uniform vec2 uLitter;
uniform float uHorizonY;
uniform float uOffing;
uniform float uLine;
uniform float uLowSun;
uniform vec3 uSun;
uniform vec3 uMoon;
varying vec2 vUv;

float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}
float cloudMass(vec2 p) {
  return noise2(p) * 0.55 + noise2(p * 2.07 + 3.7) * 0.3 + noise2(p * 4.3 - 1.9) * 0.15;
}

// A bank of cumulus heaped up from a level base, lit from the upper left. Returns 0 outside
// the cloud, else its tone: 1 the shaded underside and hollows, 2 the body, 3 the sunlit crowns.
float cumulus(vec2 sp, float base, float scale, float drift, float cover) {
  float rise = (sp.y - base - (noise2(vec2(sp.x * 0.04 + drift * 9.0, base)) - 0.5) * 7.0) * scale;
  if (rise < 0.0) return 0.0;
  vec2 p = vec2(sp.x * scale + drift, sp.y * scale * 1.6);
  float brim = 0.59 - cover * 0.3 + rise * 0.3;
  if (cloudMass(p) < brim) return 0.0;
  if (cloudMass(p + vec2(-0.07, 0.11)) < brim + 0.035) return 3.0;
  return rise < 0.09 || cloudMass(p * 2.6 + 9.0) > 0.57 + rise * 0.4 ? 1.0 : 2.0;
}

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
  vec2 fp = gl_FragCoord.xy;

  if (raw >= 0.99999) {
    // The sky is painted from the sea horizon up, wherever that falls on the screen: the
    // colour of the horizon, a band of rose at the ends of the day, then the deep of the sky.
    float alt = vUv.y - uHorizonY;
    vec3 band = mix(uSkyHorizon, uSkyTop, 0.42) + uLowSun * vec3(0.16, -0.01, 0.07);
    col = alt < 0.22 ? mix(uSkyHorizon, band, clamp(alt / 0.22, 0.0, 1.0)) : mix(band, uSkyTop, smoothstep(0.22, 0.85, alt));
    vec2 sp = floor(vec2(vUv.x, alt) * uRes);
    vec2 sky = vec2(vUv.x * uRes.x / uRes.y, alt);
    // Stars come out with the night: many faint ones, a few bright ones that twinkle.
    float star = hash2(sp);
    if (star > 0.9955 && alt > 0.08) col += uNight * (star > 0.9992 ? 1.0 : 0.3 + 0.25 * sin(uTime * 2.0 + star * 600.0)) * vec3(0.9, 0.9, 0.8);
    // The moon keeps watch, round and creamy, with its seas in grey.
    float moonD = length(sky - vec2(uMoon.x * uRes.x / uRes.y, uMoon.y));
    if (uMoon.z > 0.5) {
      if (moonD < 0.03) col = mix(col, noise2((sky - uMoon.xy) * 150.0 + 3.0) > 0.62 ? vec3(0.78, 0.8, 0.82) : vec3(1.0, 0.97, 0.86), uNight);
      else if (moonD < 0.075) col += uNight * vec3(0.05, 0.06, 0.09);
    }
    // The sun, when it stands low ahead: a wide glow spreading from it, its disc gold then
    // red as it meets the sea.
    float sunD = length(sky - vec2(uSun.x * uRes.x / uRes.y, uSun.y));
    float glare = uSun.z * uLowSun * smoothstep(0.75, 0.0, sunD);
    col += glare * glare * vec3(0.6, 0.3, 0.08) + uSun.z * uLowSun * smoothstep(0.2, 0.0, sunD) * vec3(0.35, 0.25, 0.1);
    vec3 disc = mix(vec3(1.0, 0.98, 0.86), vec3(1.0, 0.56, 0.26), uLowSun * smoothstep(0.16, 0.0, uSun.y));
    if (uSun.z > 0.5 && sunD < 0.042) col = disc;
    else if (uSun.z > 0.5 && sunD < 0.052) col = mix(col, disc, 0.55);

    // Mares' tails very high up, the first clouds to catch the colours of dawn and dusk.
    float wisp = noise2(vec2(sky.x * 2.2 + uTime * 0.004, alt * 26.0)) * 0.6 + noise2(vec2(sky.x * 6.0 - uTime * 0.006, alt * 60.0 + 4.0)) * 0.4;
    vec3 lit = uCloudLight * (1.0 - 0.4 * uNight) + glare * vec3(0.3, 0.12, 0.0);
    if (alt > 0.3 && wisp > 0.7 - 0.12 * uCloud - 0.1 * smoothstep(0.3, 0.6, alt)) col = mix(col, mix(lit, vec3(1.0, 0.6, 0.55), uLowSun * 0.6), 0.5);

    // Fair-weather cumulus in three banks, the far ones small and pale on the horizon.
    float breeze = uTime * (0.4 + uWind);
    float far = cumulus(sp, uRes.y * 0.012, 0.017, breeze * 0.0035, uCloud - 0.1);
    float mid = cumulus(sp, uRes.y * 0.06, 0.0085, 7.0 + breeze * 0.006, uCloud + 0.04);
    float high = cumulus(sp, uRes.y * 0.34, 0.019, 3.0 + breeze * 0.011, uCloud - 0.22);
    float tone = mid > 0.0 ? mid : high > 0.0 ? high : far;
    if (tone > 0.0) {
      // By day the crowns are white and the hollows blue; at the ends of the day the light
      // comes from below: gold bellies, rose bodies, crowns already in the evening.
      vec3 shade = mix(uSkyTop, lit, 0.5) * 0.92;
      vec3 crown = mix(lit * 1.04, mix(lit, vec3(1.0, 0.82, 0.8), 0.5), uLowSun);
      vec3 belly = mix(shade, mix(vec3(1.0, 0.6, 0.32), uSkyTop, 0.25), uLowSun * 0.8);
      vec3 cloud = tone > 2.5 ? crown : tone > 1.5 ? mix(shade, lit, 0.72) : belly;
      // Under a closed sky the heaps flatten into grey.
      cloud = mix(cloud, uCloudTint * (0.86 + 0.07 * tone), smoothstep(0.45, 0.95, uCloud) * 0.85);
      col = mid > 0.0 || high > 0.0 ? cloud : mix(col, cloud, 0.7);
    }
    // Long flat sheets drawing over as the weather closes in.
    float sheet = noise2(vec2(sp.x * 0.012 + uTime * 0.012, sp.y * 0.05)) * 0.65 + noise2(vec2(sp.x * 0.03 - uTime * 0.02, sp.y * 0.11)) * 0.35;
    float gap = mix(1.05, 0.3, smoothstep(0.35, 1.0, uCloud)) + (1.0 - alt) * 0.1;
    if (sheet > gap) col = mix(col, uCloudTint, 0.6);
    if (sheet > gap + 0.07) col = mix(col, uCloudTint * 1.1, 0.6);
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

    // The line is a deeper shade of the colour it borders rather than flat ink. The far sea
    // gets none: it melts into the sky without a seam.
    if (d > uOffing) {
    } else if (depthEdge > uDepthThreshold) {
      col = mix(col * uLine, uInk, 0.18);
    } else if (creases > 0.12) {
      col = col * 1.3 + vec3(0.035, 0.028, 0.012);
    }
  }

  // Weather falls across the whole picture, pixel by pixel, and never hides it. As in the
  // gentlest pixel-art games, the mood comes from the light, the wet ground and the ripples;
  // the rain itself is a light shower: a few short pale threads slanted by the wind, in two
  // sheets, each drop on its own.
  if (uRain > 0.01) {
    for (int layer = 0; layer < 2; layer++) {
      float fl = float(layer);
      float column = floor(fp.x + fp.y * uSlant * (0.5 - 0.15 * fl));
      float h = hash1(column * (1.0 + fl * 0.37) + fl * 71.0);
      float period = 70.0 + 90.0 * h;
      float travel = fp.y + uTime * (150.0 + 80.0 * h - 50.0 * fl) + h * 500.0;
      float drop = hash2(vec2(column, floor(travel / period) + fl * 13.0));
      if (drop < uRain * (0.17 + 0.1 * fl) && mod(travel, period) < 4.0 + 2.0 * h - 1.0 * fl) col = mix(col, vec3(0.78, 0.84, 0.95), 0.2 - 0.08 * fl);
    }
  }
  // Snow: single flakes wandering down, most of them one pixel, a rare one a little nearer.
  if (uSnow > 0.01) {
    for (int layer = 0; layer < 3; layer++) {
      float fl = float(layer);
      float size = 11.0 + 6.0 * fl;
      vec2 q = fp + vec2(sin(uTime * (0.5 + 0.2 * fl) + fp.y * 0.03 + fl * 2.0) * (2.0 + fl) - uTime * uSlant * 14.0, uTime * (8.0 + 6.0 * fl));
      vec2 cell = floor(q / size);
      if (hash2(cell + 31.0 * fl) < uSnow * (0.34 - 0.12 * fl)) {
        vec2 flake = vec2(hash2(cell * 1.7 + fl), hash2(cell * 2.3 + 5.0)) * (size - 3.0) + 1.5;
        vec2 away = abs(q - cell * size - flake);
        if (max(away.x, away.y) < 0.6 + 0.5 * step(1.5, fl)) col = mix(col, vec3(0.95, 0.97, 1.0), 0.55 + 0.12 * fl);
      }
    }
  }
  // Now and then a leaf lets go in autumn, a petal in spring, and flutters across on the wind.
  float litter = max(uLitter.x, uLitter.y);
  if (litter > 0.02) {
    for (int layer = 0; layer < 2; layer++) {
      float fl = float(layer);
      vec2 q = fp + vec2(-uTime * (8.0 + uSlant * 30.0 + fl * 6.0), uTime * (12.0 + 5.0 * fl));
      q.x += sin(q.y * 0.07 + fl * 3.0) * 7.0;
      vec2 cell = floor(q / 46.0);
      if (hash2(cell + 57.0 * fl + 3.0) < litter * (0.1 + uWind * 0.25)) {
        vec2 away = abs(q - cell * 46.0 - vec2(hash2(cell * 1.3 + fl), hash2(cell * 2.9 + 1.0)) * 42.0 - 2.0);
        if (away.x < 1.1 && away.y < 0.6) {
          float tint = hash2(cell + 9.0);
          vec3 leaf = uLitter.x > uLitter.y
            ? (tint < 0.4 ? vec3(0.8, 0.3, 0.08) : tint < 0.75 ? vec3(0.9, 0.55, 0.1) : vec3(0.55, 0.14, 0.08))
            : (tint < 0.5 ? vec3(1.0, 0.62, 0.72) : vec3(1.0, 0.9, 0.92));
          col = mix(col, leaf, 0.9);
        }
      }
    }
  }

  // The grade of a Ghibli background in poster colour: pigments a little richer than life,
  // and the darks lifted toward the colour of the air so nothing ever goes to black.
  col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.14);
  col = mix(col, mix(vec3(1.0, 0.96, 0.88), vec3(0.4, 0.48, 0.78), uNight), 0.04);
  // The corners fall off a touch, so the eye rests on the middle of the picture.
  col *= 1.0 - 0.1 * smoothstep(0.42, 0.82, length(vUv - 0.5));

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
        uTime: { value: 0 },
        uCloud: { value: 0 },
        uRain: { value: 0 },
        uSnow: { value: 0 },
        uNight: { value: 0 },
        uCloudTint: { value: new THREE.Color() },
        uCloudLight: { value: new THREE.Color(1, 1, 1) },
        uSlant: { value: 0 },
        uWind: { value: 0.3 },
        uLitter: { value: new THREE.Vector2() },
        uHorizonY: { value: 0.5 },
        uOffing: { value: 1e6 },
        uLine: { value: 0.42 },
        uLowSun: { value: 0 },
        uSun: { value: new THREE.Vector3() },
        uMoon: { value: new THREE.Vector3() },
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

  /**
   * @param {{skyTop: THREE.Color, skyHorizon: THREE.Color, texelWorld: number, time?: number, weather?: object}} frame
   *   `weather` is `Climate.screen`, plus what depends on the view: `slant`, how far the wind
   *   pushes the rain sideways; `horizon`, the height of the sea horizon on the screen (0 at the
   *   bottom, 1 at the top) and `offing`, the depth beyond which the sea is drawn without a
   *   line; `sun` and `moon`, where each stands in the sky as (x across the screen, height
   *   above the horizon in screens, 1 if it is ahead of the view).
   */
  render(scene, camera, { skyTop, skyHorizon, texelWorld, time = 0, weather }) {
    const r = this.renderer;
    const u = this.composite.uniforms;
    u.uDepthRange.value = camera.far - camera.near;
    u.uDepthThreshold.value = texelWorld * 4;
    // Outlines soften as the view draws back, where a full-strength line would be all there is.
    u.uLine.value = 0.42 + 0.3 * THREE.MathUtils.smoothstep(texelWorld, 0.16, 0.42);
    u.uSkyTop.value.copy(skyTop);
    u.uSkyHorizon.value.copy(skyHorizon);
    u.uTime.value = time;
    if (weather) {
      u.uCloud.value = weather.cloud;
      u.uRain.value = weather.rain;
      u.uSnow.value = weather.snow;
      u.uNight.value = weather.night;
      u.uCloudTint.value.copy(weather.cloudTint);
      u.uCloudLight.value.copy(weather.cloudLight);
      u.uSlant.value = weather.slant ?? 0;
      u.uWind.value = weather.wind;
      u.uLitter.value.set(weather.leaves, weather.petals);
      u.uHorizonY.value = weather.horizon ?? 0.5;
      u.uOffing.value = weather.offing ?? 1e6;
      u.uLowSun.value = weather.lowSun;
      if (weather.sun) u.uSun.value.copy(weather.sun);
      if (weather.moon) u.uMoon.value.copy(weather.moon);
    }

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
    // Looking down a corner of the diorama from fairly low, so the mountains stand up against
    // the sky; the frame is lifted so the avatar sits in its lower part.
    this.yaw = 0;
    this.pitch = 0.44;
    this.lift = 0.14;
    this.viewHeight = 80;
    this.distance = 220;
    this.texelWorld = 0.1;
    // The axes of the screen in the world.
    this.right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this.forward = new THREE.Vector3();
  }

  update(target, lowRes, offsetOut) {
    const cam = this.camera;
    cam.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    this.right.set(e[0], e[1], e[2]);
    this._up.set(e[4], e[5], e[6]);
    this.forward.set(-e[8], -e[9], -e[10]);

    const texel = this.viewHeight / lowRes.y;
    this.texelWorld = texel;
    cam.position.copy(target).addScaledVector(this.forward, -this.distance).addScaledVector(this._up, this.viewHeight * this.lift);
    const r = cam.position.dot(this.right);
    const u = cam.position.dot(this._up);
    const dr = Math.round(r / texel) * texel - r;
    const du = Math.round(u / texel) * texel - u;
    cam.position.addScaledVector(this.right, dr).addScaledVector(this._up, du);
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

// The sky over the bay follows the real one over the player: the sun and moon stand where they
// do at the player's position and local time, the season is today's, and clouds, rain, snow and
// mist are the current weather there. Without a position, the local clock still drives the day
// and the weather stays fair.
import * as THREE from 'three';
import { GLOBALS } from './style.js';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_REFRESH = 15 * 60 * 1000;
const DEG = Math.PI / 180;
const DAY = 86_400_000;

// The compass of the diorama: the sun sets over the sea, a little to the left of the bay.
const WEST = new THREE.Vector3(-0.5, 0, 1).normalize();
const NORTH = new THREE.Vector3(-1, 0, -0.5).normalize();

// Light through the day, keyed on the sine of the sun's elevation. Around the horizon the lit
// and shaded tints meet, so the hand-over between sun and moon passes unnoticed.
const KEYS = [
  { e: -0.3, sun: 0x6470b0, shade: 0x343a62, top: 0x0f1430, horizon: 0x27315c, glow: 1, night: 1 },
  { e: -0.1, sun: 0x6c78b8, shade: 0x3c426c, top: 0x1c2350, horizon: 0x4a4a82, glow: 1, night: 1 },
  { e: -0.02, sun: 0x7a74a4, shade: 0x7a74a4, top: 0x3a4590, horizon: 0xe08a72, glow: 0.95, night: 0.5 },
  { e: 0.1, sun: 0xffb890, shade: 0x7c78a8, top: 0x5a6ab8, horizon: 0xffa274, glow: 0.9, night: 0.1 },
  { e: 0.28, sun: 0xffd9a6, shade: 0x8a8ab4, top: 0x6f7fc4, horizon: 0xffb680, glow: 0.6, night: 0 },
  { e: 0.55, sun: 0xfff4e0, shade: 0xa6a8d0, top: 0x5aa0de, horizon: 0xcfe6f2, glow: 0, night: 0 },
  { e: 1, sun: 0xffffff, shade: 0xb0b4d8, top: 0x4f9ae0, horizon: 0xc8e4f4, glow: 0, night: 0 },
];
for (const key of KEYS) for (const name of ['sun', 'shade', 'top', 'horizon']) key[name] = new THREE.Color(key[name]);

const OVERCAST_DAY = new THREE.Color(0x9aa3b2);
const OVERCAST_NIGHT = new THREE.Color(0x1c2030);
const WEATHERS = ['real', 'clear', 'cloudy', 'rain', 'snow', 'mist'];
const PRESETS = {
  clear: { cloud: 0.1, rain: 0, snow: 0, mist: 0 },
  cloudy: { cloud: 0.85, rain: 0, snow: 0, mist: 0.1 },
  rain: { cloud: 1, rain: 0.8, snow: 0, mist: 0.3 },
  snow: { cloud: 1, rain: 0, snow: 0.8, mist: 0.3 },
  mist: { cloud: 0.6, rain: 0, snow: 0, mist: 1 },
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Where the sun stands: east, north and up components for a date and a place on Earth. */
function sunAt(date, lat, lon) {
  const dayOfYear = (date - Date.UTC(date.getUTCFullYear(), 0, 0)) / DAY;
  const declination = -23.44 * DEG * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365.24);
  const solarHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + lon / 15;
  const hourAngle = (solarHours - 12) * 15 * DEG;
  const phi = lat * DEG;
  return {
    east: -Math.cos(declination) * Math.sin(hourAngle),
    north: Math.sin(declination) * Math.cos(phi) - Math.cos(declination) * Math.sin(phi) * Math.cos(hourAngle),
    up: Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle),
    dayOfYear,
  };
}

export class Climate {
  constructor() {
    // Until the player shares a position: the latitude of the Cinque Terre, and the longitude
    // implied by the local clock, so that day and night still match the player's.
    const standardOffset = new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset();
    this.place = { lat: 44.13, lon: -standardOffset / 4, known: false };
    this.offset = 0; // preview: milliseconds added to the real time
    this.lapse = false;
    this.override = 0; // index in WEATHERS
    this.real = { ...PRESETS.clear, temperature: 18 };
    this.now = { ...PRESETS.clear };
    this.snowLying = 0;

    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.skyTop = new THREE.Color();
    this.skyHorizon = new THREE.Color();
    this.cloudTint = new THREE.Color();
    this.visibility = 1;
    this.night = 0;
    this._sun = new THREE.Color();
    this._shade = new THREE.Color();

    this.locate();
  }

  /** Asks the browser for the player's position, then keeps the weather there up to date. */
  locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // A tenth of a degree is plenty for the sky, and it is all that leaves the browser.
        this.place = { lat: Math.round(coords.latitude * 10) / 10, lon: Math.round(coords.longitude * 10) / 10, known: true };
        this.fetchWeather();
        setInterval(() => this.fetchWeather(), WEATHER_REFRESH);
      },
      () => {},
      { maximumAge: 3_600_000, timeout: 15_000 },
    );
  }

  async fetchWeather() {
    try {
      const query = `latitude=${this.place.lat}&longitude=${this.place.lon}&current=temperature_2m,cloud_cover,rain,showers,snowfall,weather_code`;
      const response = await fetch(`${WEATHER_URL}?${query}`);
      if (!response.ok) return;
      const { current } = await response.json();
      const fog = current.weather_code === 45 || current.weather_code === 48;
      this.real = {
        cloud: clamp01(current.cloud_cover / 100),
        rain: clamp01((current.rain + current.showers) / 2.5),
        snow: clamp01(current.snowfall / 1.5),
        mist: fog ? 1 : clamp01((current.rain + current.showers) / 6),
        temperature: current.temperature_2m,
      };
    } catch {
      // Offline: keep the last known sky.
    }
  }

  /** Preview keys: hold T to let time fly, Y skips a season, M cycles the weather, R is reality. */
  key(code, down) {
    if (code === 'KeyT') this.lapse = down;
    if (!down) return;
    if (code === 'KeyY') this.offset += 91.3 * DAY;
    if (code === 'KeyM') this.override = (this.override + 1) % WEATHERS.length;
    if (code === 'KeyR') {
      this.offset = 0;
      this.override = 0;
    }
  }

  update(dt) {
    if (this.lapse) this.offset += dt * 3_600_000 * 1.5;
    const date = new Date(Date.now() + this.offset);
    const sun = sunAt(date, this.place.lat, this.place.lon);

    // Weather eases toward its target, so a change rolls in rather than snapping.
    const target = this.override ? PRESETS[WEATHERS[this.override]] : this.real;
    const ease = 1 - Math.exp(-dt * 0.6);
    for (const name of ['cloud', 'rain', 'snow', 'mist']) this.now[name] += (target[name] - this.now[name]) * ease;
    const { cloud, rain, snow, mist } = this.now;

    // Light: the sun by day, the moon opposite it by night, never quite on the horizon.
    const byDay = sun.up > -0.02;
    const sign = byDay ? 1 : -1;
    this.lightDir.set(0, 0, 0).addScaledVector(WEST, -sun.east * sign).addScaledVector(NORTH, sun.north * sign);
    this.lightDir.y = Math.max(0.22, sun.up * sign);
    this.lightDir.normalize();

    let i = 1;
    while (i < KEYS.length - 1 && KEYS[i].e < sun.up) i++;
    const a = KEYS[i - 1];
    const b = KEYS[i];
    const k = clamp01((sun.up - a.e) / (b.e - a.e));
    this.night = a.night + (b.night - a.night) * k;
    this._sun.lerpColors(a.sun, b.sun, k);
    this._shade.lerpColors(a.shade, b.shade, k);
    this.skyTop.lerpColors(a.top, b.top, k);
    this.skyHorizon.lerpColors(a.horizon, b.horizon, k);

    // Under cloud the light flattens and greys; rain and mist close the distance in.
    const grey = this.cloudTint.lerpColors(OVERCAST_DAY, OVERCAST_NIGHT, this.night);
    const overcast = clamp01(cloud * 0.75 + rain * 0.2);
    this._sun.lerp(this._shade, overcast * 0.7).multiplyScalar(1 - overcast * 0.12);
    this.skyTop.lerp(grey, overcast * 0.8);
    this.skyHorizon.lerp(grey, overcast * 0.65);
    this.visibility = 1 - 0.75 * clamp01(mist * 0.8 + rain * 0.25 + snow * 0.3);

    // Seasons, by the calendar and the hemisphere: 0 at the summer solstice.
    const year = ((sun.dayOfYear - 172) / 365.24 + (this.place.lat < 0 ? 0.5 : 0) + 1) % 1;
    const autumn = clamp01(Math.sin(year * 2 * Math.PI) * 1.4 - 0.2);
    const winter = clamp01(-Math.cos(year * 2 * Math.PI) * 1.4 - 0.2);
    const spring = clamp01(-Math.sin(year * 2 * Math.PI) * 1.4 - 0.2);
    // Snow settles while it falls and melts afterwards; in a cold winter it lingers on the peaks.
    this.snowLying = clamp01(this.snowLying + (snow > 0.05 ? snow * 0.06 : -0.02) * dt);
    const cold = this.override ? winter : winter * clamp01((6 - this.real.temperature) / 6);
    const snowCover = Math.max(cold * 0.3, this.snowLying);

    GLOBALS.uSunTint.value.copy(this._sun);
    GLOBALS.uShadowTint.value.copy(this._shade);
    GLOBALS.uGlow.value = Math.max(a.glow + (b.glow - a.glow) * k, overcast * 0.5);
    GLOBALS.uNight.value = this.night;
    GLOBALS.uCloudGap.value = 0.76 - cloud * 0.48;
    GLOBALS.uSeason.value.set(autumn, winter, spring, snowCover);
  }

  /** Values for the sky and the screen-space weather of the composite pass. */
  get screen() {
    return { cloud: this.now.cloud, rain: this.now.rain, snow: this.now.snow, night: this.night, cloudTint: this.cloudTint };
  }
}

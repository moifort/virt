// The sky over the bay follows the real one over the player: the sun and moon stand where they
// do at the player's position and local time, the season is today's, and clouds, rain, snow,
// mist and wind are the current weather there. Without a position, the local clock still drives
// the day and the weather stays fair.
import * as THREE from 'three';
import { GLOBALS } from './style.js';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_REFRESH = 15 * 60 * 1000;
const DEG = Math.PI / 180;
const DAY = 86_400_000;

// The compass of the diorama: the sun sets over the sea, a little to the left of the bay.
const WEST = new THREE.Vector3(-0.5, 0, 1).normalize();
const NORTH = new THREE.Vector3(-1, 0, -0.5).normalize();
const WEST_2D = new THREE.Vector2(WEST.x, WEST.z);
const NORTH_2D = new THREE.Vector2(NORTH.x, NORTH.z);

// Light through the day, keyed on the sine of the sun's elevation. Around the horizon the lit
// and shaded tints meet, so the hand-over between sun and moon passes unnoticed. Nights stay
// gentle: a clear blue moonlight you can read the land by, never black.
const KEYS = [
  { e: -0.3, sun: 0x7f8fd0, shade: 0x414a80, top: 0x141a40, horizon: 0x33407a, glow: 1, night: 1 },
  { e: -0.1, sun: 0x8590cc, shade: 0x4a5088, top: 0x222a60, horizon: 0x5a5a98, glow: 1, night: 1 },
  { e: -0.02, sun: 0x9c8cb4, shade: 0x8a80b0, top: 0x4450a0, horizon: 0xf09a7a, glow: 0.95, night: 0.5 },
  { e: 0.1, sun: 0xffbc92, shade: 0x948cba, top: 0x6274c4, horizon: 0xffb080, glow: 0.9, night: 0.1 },
  { e: 0.28, sun: 0xffe2b8, shade: 0x9090bc, top: 0x5a86d8, horizon: 0xffcc98, glow: 0.6, night: 0 },
  { e: 0.55, sun: 0xfffbf2, shade: 0xaeb4da, top: 0x4f9fea, horizon: 0xc6e8fa, glow: 0, night: 0 },
  { e: 1, sun: 0xffffff, shade: 0xb8bfe0, top: 0x3f95ea, horizon: 0xbfe6fa, glow: 0, night: 0 },
];
for (const key of KEYS) for (const name of ['sun', 'shade', 'top', 'horizon']) key[name] = new THREE.Color(key[name]);

const OVERCAST_DAY = new THREE.Color(0x9aa3b2);
const OVERCAST_NIGHT = new THREE.Color(0x242a40);
const OVERCAST_LIGHT = new THREE.Color(0xd2d6e0);
const DAWN_ROSE = new THREE.Color(0xffc0b4);
const WEATHERS = ['real', 'clear', 'wind', 'cloudy', 'rain', 'storm', 'snow', 'mist'];
const PRESETS = {
  clear: { cloud: 0.12, rain: 0, snow: 0, mist: 0, wind: 0.3 },
  wind: { cloud: 0.35, rain: 0, snow: 0, mist: 0, wind: 1 },
  cloudy: { cloud: 0.85, rain: 0, snow: 0, mist: 0.1, wind: 0.5 },
  rain: { cloud: 1, rain: 0.8, snow: 0, mist: 0.3, wind: 0.7 },
  storm: { cloud: 1, rain: 1, snow: 0, mist: 0.2, wind: 1 },
  snow: { cloud: 1, rain: 0, snow: 0.8, mist: 0.3, wind: 0.25 },
  mist: { cloud: 0.6, rain: 0, snow: 0, mist: 1, wind: 0.1 },
};
const ELEMENTS = ['cloud', 'rain', 'snow', 'mist', 'wind'];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Where the cherry trees stand in their year, from the turn of the year (0 at the summer
 * solstice, 0.75 at the spring equinox): (blossom, petals falling, petals lying, leaves).
 * They come into flower at the end of February and are at their fullest around the equinox,
 * a few petals drifting down already; through April the blossom snows down and carpets the
 * ground while the leaves come out; the leaves turn in autumn and are down by mid-December.
 */
function sakura(year) {
  const blossom = smooth(0.67, 0.72, year) * (1 - smooth(0.79, 0.85, year));
  const falling = Math.max(0.35 * smooth(0.7, 0.74, year), smooth(0.76, 0.8, year)) * (1 - smooth(0.84, 0.87, year));
  const lying = smooth(0.73, 0.8, year) * (1 - smooth(0.86, 0.9, year));
  const leaves = year > 0.6 ? smooth(0.78, 0.84, year) : 1 - smooth(0.35, 0.42, year);
  return [blossom, falling, lying, leaves];
}

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
    solarHours: ((solarHours % 24) + 24) % 24,
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
    this.trip = null; // a quick passage of time under way: see `travel`
    this.override = 0; // index in WEATHERS
    this.real = { ...PRESETS.clear, temperature: 18, windFrom: 225 };
    this.now = { ...PRESETS.clear };
    this.snowLying = 0;
    this.wetness = 0;
    this.puddles = 0;
    this.runoff = 0;

    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.skyTop = new THREE.Color();
    this.skyHorizon = new THREE.Color();
    this.cloudTint = new THREE.Color();
    this.cloudLight = new THREE.Color();
    this.visibility = 1;
    this.night = 0;
    this.daylight = 1;
    this.season = { autumn: 0, winter: 0, spring: 0, summer: 1 };
    this.year = 0; // turn of the year, 0 at the summer solstice (see update)
    this.calendar = null; // a passage of days under way (see travelDays)
    this.wind = new THREE.Vector2(0.7, 0.7);
    this._sun = new THREE.Color();
    this._shade = new THREE.Color();
    this._soft = new THREE.Color();
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.lowSun = 0;
    // The storm: how hard it blows and pours; the lightning, as a flash that lights the whole
    // picture for an instant and the fork that made it.
    this.storm = 0;
    this.flash = 0;
    this.nextBolt = 2;
    this.reflash = 0;
    this.bolt = { x: 0.5, seed: 0, reach: 0.3 };

    this.previewFromUrl();
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
      const query = `latitude=${this.place.lat}&longitude=${this.place.lon}&current=temperature_2m,cloud_cover,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m`;
      const response = await fetch(`${WEATHER_URL}?${query}`);
      if (!response.ok) return;
      const { current } = await response.json();
      const fog = current.weather_code === 45 || current.weather_code === 48;
      this.real = {
        cloud: clamp01(current.cloud_cover / 100),
        rain: clamp01((current.rain + current.showers) / 2.5),
        snow: clamp01(current.snowfall / 1.5),
        mist: fog ? 1 : clamp01((current.rain + current.showers) / 6),
        // A fresh breeze of 40 km/h already bends everything.
        wind: clamp01(0.08 + (current.wind_speed_10m ?? 8) / 40),
        windFrom: current.wind_direction_10m ?? 225,
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
      this.trip = null;
      this.calendar = null;
    }
  }

  /** The weather asked for: one of `WEATHERS`, 'real' when the sky follows the forecast. */
  get weather() {
    return WEATHERS[this.override];
  }

  /** Asks for a weather by name; it rolls in over a few seconds. 'real' hands the sky back to the forecast. */
  setWeather(name) {
    this.override = Math.max(0, WEATHERS.indexOf(name));
  }

  /**
   * Jumps to a chosen moment instead of the real one: `hour` of the solar day (0–24), `day` of
   * the year (1–365), `weather` by name. The weather is set at once, as if it had lasted a while.
   * The same can be asked in the address bar: `?hour=21&day=172&weather=rain`.
   * `weather` may also be a sky as `now` holds it, which then rolls back to the real one.
   */
  preview({ hour, day, weather } = {}) {
    const now = new Date(Date.now() + this.offset);
    const current = sunAt(now, this.place.lat, this.place.lon);
    if (Number.isFinite(day)) this.offset += (day - Math.floor(current.dayOfYear)) * DAY;
    if (Number.isFinite(hour)) this.offset += (hour - current.solarHours) * 3_600_000;
    if (weather !== undefined) {
      if (typeof weather === 'string') this.override = Math.max(0, WEATHERS.indexOf(weather));
      const target = typeof weather === 'object' ? weather : this.override ? PRESETS[WEATHERS[this.override]] : this.real;
      for (const name of ELEMENTS) this.now[name] = target[name];
      this.wetness = this.puddles = this.runoff = target.rain > 0.05 ? 1 : 0;
      this.snowLying = target.snow > 0.05 ? 0.85 : 0;
    }
  }

  /**
   * Lets the hours run by quickly, always forward, until the solar clock reads `hour`: the sky
   * goes through the sunset on its way to the night and through the dawn on its way back.
   */
  travel(hour, seconds = 3) {
    this.settle();
    const now = sunAt(new Date(Date.now() + this.offset), this.place.lat, this.place.lon);
    const ahead = (((hour - now.solarHours) % 24) + 24) % 24;
    this.trip = { from: this.offset, to: this.offset + ahead * 3_600_000, time: 0, seconds };
  }

  /**
   * Lets the calendar run forward through `days` whole days over `seconds`, the hour of day
   * kept: the leaves turn and the snow comes rather than snapping, and the sun stays put.
   */
  travelDays(days, seconds = 2.5) {
    this.settle();
    this.calendar = { from: this.offset, days, time: 0, seconds };
  }

  /**
   * Brings a previewed moment back to the player's own, as the map opens on the shot of the
   * loading screen: the calendar runs to today the shortest way round the year, the hour kept,
   * then the hours run forward to now, through the dusk or the dawn on the way. The weather
   * rolls back to the real one meanwhile.
   */
  rejoin() {
    this.settle();
    this.override = 0;
    // The hours only ever run forward: they start up to a day short of now.
    const short = -((DAY - (((this.offset % DAY) + DAY) % DAY)) % DAY);
    let days = Math.round((short - this.offset) / DAY);
    days -= Math.round(days / 365) * 365;
    const hours = { hours: -short / 3_600_000, seconds: 2 + (-short / 3_600_000) * 0.25 };
    if (days) this.calendar = { from: this.offset, days, time: 0, seconds: 3, then: hours };
    else this.homeward(hours);
  }

  /** The last leg of `rejoin`: the hours up to now, after which the clock is the real one again. */
  homeward({ hours, seconds }) {
    if (hours > 0) this.trip = { from: this.offset, to: this.offset + hours * 3_600_000, time: 0, seconds, home: true };
    else this.offset = 0;
  }

  /** Ends any passage of time under way at once, so two of them never fight over the clock. */
  settle() {
    if (this.trip) this.offset = this.trip.to;
    if (this.calendar) this.offset = this.calendar.from + Math.round(this.calendar.days) * DAY;
    // Cut short on its way back to today, the clock is today's at once.
    if (this.trip?.home || this.calendar?.then) this.offset = 0;
    this.trip = this.calendar = null;
  }

  /** Whether it is night now, or will be at the end of the passage of time under way. */
  get nightAhead() {
    if (!this.trip) return this.night > 0.5;
    const end = sunAt(new Date(Date.now() + this.trip.to), this.place.lat, this.place.lon);
    return end.up < -0.02;
  }

  previewFromUrl() {
    const params = new URLSearchParams(location.search);
    const number = (name) => (params.has(name) ? Number(params.get(name)) : undefined);
    if (['hour', 'day', 'weather'].some((name) => params.has(name))) this.preview({ hour: number('hour'), day: number('day'), weather: params.get('weather') ?? undefined });
  }

  update(dt) {
    if (this.lapse) this.offset += dt * 3_600_000 * 1.5;
    if (this.trip) {
      const trip = this.trip;
      trip.time = Math.min(trip.seconds, trip.time + dt);
      this.offset = trip.from + (trip.to - trip.from) * smooth(0, trip.seconds, trip.time);
      if (trip.time >= trip.seconds) {
        this.trip = null;
        // Back from a year away at most: the same day and hour, the clock simply the real one.
        if (trip.home) this.offset = 0;
      }
    }
    if (this.calendar) {
      const calendar = this.calendar;
      calendar.time = Math.min(calendar.seconds, calendar.time + dt);
      this.offset = calendar.from + Math.round(calendar.days * smooth(0, calendar.seconds, calendar.time)) * DAY;
      if (calendar.time >= calendar.seconds) {
        this.calendar = null;
        if (calendar.then) this.homeward(calendar.then);
      }
    }
    const date = new Date(Date.now() + this.offset);
    const sun = sunAt(date, this.place.lat, this.place.lon);

    // Weather eases toward its target, so a change rolls in rather than snapping.
    const target = this.override ? PRESETS[WEATHERS[this.override]] : this.real;
    const ease = 1 - Math.exp(-dt * 0.6);
    for (const name of ELEMENTS) this.now[name] += (target[name] - this.now[name]) * ease;
    const { cloud, rain, snow, mist, wind } = this.now;

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
    this.daylight = smooth(-0.02, 0.2, sun.up);
    this._sun.lerpColors(a.sun, b.sun, k);
    this._shade.lerpColors(a.shade, b.shade, k);
    this.skyTop.lerpColors(a.top, b.top, k);
    this.skyHorizon.lerpColors(a.horizon, b.horizon, k);
    // Where the sun really stands, below the horizon included, and how much of a sunrise or a
    // sunset this is: nothing at noon or in the night, everything as it touches the sea. Dawn
    // is the cooler of the two, rose where the evening is amber.
    this.sunDir.set(0, 0, 0).addScaledVector(WEST, -sun.east).addScaledVector(NORTH, sun.north).setY(sun.up).normalize();
    this.lowSun = smooth(0.42, 0.06, sun.up) * smooth(-0.14, -0.01, sun.up);
    if (sun.solarHours < 12) this.skyHorizon.lerp(DAWN_ROSE, 0.45 * this.lowSun);
    // Clouds take the colour of the light: white at noon, peach and rose at the ends of the day.
    this.cloudLight.copy(this._sun).lerp(this.skyHorizon, 0.25 + 0.3 * this.night);

    // Under cloud the light flattens and greys; rain and mist close the distance in, but only
    // a real mist hides the far shore.
    const grey = this.cloudTint.lerpColors(OVERCAST_DAY, OVERCAST_NIGHT, this.night);
    const overcast = clamp01(cloud * 0.75 + rain * 0.2);
    // No sun to speak of then: the light comes from the whole sky, even and soft, and shadows
    // all but vanish.
    this._soft.copy(OVERCAST_LIGHT).multiplyScalar(0.5 + 0.5 * this.daylight).lerp(this._sun, this.night).multiplyScalar(1 - rain * 0.14);
    this._sun.lerp(this._soft, overcast * 0.85);
    this._shade.lerp(this._soft, overcast * 0.6);
    this.skyTop.lerp(grey, overcast * 0.8);
    this.skyHorizon.lerp(grey, overcast * 0.65);
    this.visibility = 1 - 0.75 * clamp01(mist * 0.8 + rain * 0.12 + snow * 0.16);

    // Seasons, by the calendar and the hemisphere: 0 at the summer solstice.
    const year = ((sun.dayOfYear - 172) / 365.24 + (this.place.lat < 0 ? 0.5 : 0) + 1) % 1;
    this.year = year;
    const autumn = clamp01(Math.sin(year * 2 * Math.PI) * 1.4 - 0.2);
    const winter = clamp01(-Math.cos(year * 2 * Math.PI) * 1.4 - 0.2);
    const spring = clamp01(-Math.sin(year * 2 * Math.PI) * 1.4 - 0.2);
    this.season = { autumn, winter, spring, summer: clamp01(Math.cos(year * 2 * Math.PI) * 1.4 - 0.2) };
    // Snow settles while it falls and melts afterwards; in a cold winter it lingers on the peaks.
    this.snowLying = clamp01(this.snowLying + (snow > 0.05 ? snow * 0.06 : -0.02) * dt);
    const cold = this.override ? winter : winter * clamp01((6 - this.real.temperature) / 6);
    const snowCover = Math.max(cold * 0.3, this.snowLying);

    // Rain soaks surfaces within seconds and fills the hollows in a minute; when it stops the
    // gutters go on dripping, then the stone dries, and the puddles are the last to go. Snow
    // melting off the roofs drips too.
    const raining = rain > 0.05;
    this.wetness = clamp01(this.wetness + (raining ? rain * 0.25 : -0.012) * dt);
    this.puddles = clamp01(this.puddles + (raining ? rain * 0.035 : -0.004) * dt);
    const thaw = snow < 0.05 ? this.snowLying * this.daylight * 0.22 : 0;
    this.runoff += (Math.max(rain, this.wetness * 0.16, thaw) - this.runoff) * (1 - Math.exp(-dt * 0.5));

    // The wind blows where the real one does, and wanders a little around that.
    const drift = Math.sin(performance.now() * 0.00007) * 0.5;
    const from = ((this.override ? 225 : this.real.windFrom) * DEG) + drift;
    this.wind.set(0, 0).addScaledVector(NORTH_2D, -Math.cos(from)).addScaledVector(WEST_2D, Math.sin(from)).normalize();

    // A storm is heavy rain in a strong wind. Every few seconds a bolt comes down: the picture
    // flares, flickers once more, and the dark comes back.
    this.storm = clamp01((rain - 0.6) * 2.5) * clamp01((wind - 0.7) * 3.3);
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.reflash > 0) {
      this.reflash -= dt;
      if (this.reflash <= 0) this.flash = 0.8;
    }
    if (this.storm > 0.3) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 2.5 + Math.random() * 6;
        this.flash = 1;
        this.reflash = 0.14 + Math.random() * 0.1;
        this.bolt = { x: 0.1 + Math.random() * 0.8, seed: Math.random() * 100, reach: 0.12 + Math.random() * 0.4 };
      }
    } else this.nextBolt = 2;

    // Lamps: the street lanterns come on at dusk; windows light up one after the other through
    // the evening, and all but a few night owls are dark again in the small hours.
    const hour = sun.solarHours;
    const awake = hour > 12 ? 1 - 0.8 * smooth(21.5, 24, hour) : 0.2 - 0.12 * smooth(0, 3, hour) + 0.3 * smooth(4.5, 6.5, hour);
    const dusk = smooth(0.12, -0.08, sun.up);

    GLOBALS.uSunTint.value.copy(this._sun);
    GLOBALS.uShadowTint.value.copy(this._shade);
    GLOBALS.uGlow.value = Math.max(a.glow + (b.glow - a.glow) * k, overcast * 0.5);
    GLOBALS.uNight.value = this.night;
    // No cloud shadows cross the ground: drifting patches read as the shadows of things moving.
    // A grey sky flattens the light instead (above) and greys the sea.
    GLOBALS.uOvercast.value = smooth(0.5, 1.2, cloud);
    GLOBALS.uStorm.value = this.storm;
    GLOBALS.uSeason.value.set(autumn, winter, spring, snowCover);
    GLOBALS.uSakura.value.set(...sakura(year));
    GLOBALS.uWet.value.set(this.wetness, this.puddles, rain, this.runoff);
    GLOBALS.uWind.value.set(this.wind.x, this.wind.y, wind);
    GLOBALS.uSkyTint.value.copy(this.skyHorizon).lerp(this.skyTop, 0.45);
    GLOBALS.uHaze.value.copy(this.skyHorizon);
    GLOBALS.uLamps.value.set(dusk, dusk * 0.62 * awake);
  }

  /** Values for the sky and the screen-space weather of the composite pass. */
  get screen() {
    return {
      cloud: this.now.cloud,
      rain: this.now.rain,
      snow: this.now.snow,
      wind: this.now.wind,
      night: this.night,
      lowSun: this.lowSun * (1 - this.now.cloud * 0.7),
      storm: this.storm,
      flash: this.flash,
      bolt: this.bolt,
      cloudTint: this.cloudTint,
      cloudLight: this.cloudLight,
      // Leaves fall in autumn and petals in spring, on fair days only.
      leaves: this.season.autumn * (1 - this.now.rain) * this.daylight,
      petals: this.season.spring * (1 - this.now.rain) * this.daylight,
    };
  }
}

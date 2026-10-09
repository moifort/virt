// Development only: `?tour=village` walks the camera round the main village and its harbour,
// stop after stop, and posts a picture of each to the dev server, which writes them to
// tour/shots/<tour>/ (see serve.py) with a manifest of where each was taken. The pictures are
// then looked over for whatever is wrong (tour/README.md): things in the air, things through
// one another, stairs that lead nowhere, a stall turned the wrong way.
//
// Every stop is drawn the same way each time, so that a picture can be taken again after a
// fix and compared: a clear October morning, the avatar out of the picture, the hour stopped.
//  - `&stop=port` takes only the stops whose name holds that text;
//  - `&yaws=0,2` the corners the view looks from, in quarter turns (all four by default);
//  - `&zoom=34` the height of the view in metres; `&pitch=0.6` its tilt;
//  - `&hour=21&day=15&weather=rain` another moment than the October morning;
//  - `&frames=6&every=400` a short sequence at each stop, for what moves;
//  - `&limit=5` only so many stops, spread over the tour;
//  - `&out=name` the folder under tour/shots/ (the tour's name by default).
// The tours: `village` (the harbour and the whole village, as first written), or one sector
// of the island (`SECTORS`): port, lower-village, upper-village, hamlet, agora, railway, mountain,
// shore.
// `?tour=spots&spots=-97,-12;-106,-19` looks closely at a few points of the map (x, z), for a
// fix: the lint (test/) gives the points of whatever it finds.
import { ISLET, OBSERVATORY, PATHS, RAIL_MOUTHS, STATION, TRACKS, TRAILS, VILLAGES, ZONES, coastU, lanePoint, railPoint, toX, toZ, villagePlan } from './terrain.js';

const WIDTH = 1600; // the picture as drawn, in screen pixels: two to an art pixel
const HEIGHT = 1000;
const LANE_STEP = 18; // a stop every so many metres along a lane

const busyWait = (ms) => {
  const until = performance.now() + ms;
  while (performance.now() < until);
};
const round = (x) => Math.round(x * 10) / 10;

/**
 * The parts of the island a tour can cover, one at a time: a weekly review takes one of them
 * in turn (tour/plan.js), so that no run has to look at the whole map.
 */
export const SECTORS = ['port', 'lower-village', 'upper-village', 'hamlet', 'agora', 'railway', 'mountain', 'shore'];

/** Where the camera stops on a tour: a name, a point to look at, and how close. */
export function stops(tour, params = new URLSearchParams()) {
  if (tour === 'spots') {
    return (params.get('spots') || '').split(';').filter(Boolean).map((spot, i) => {
      const [x, z] = spot.split(',').map(Number);
      return { name: `spot-${i}-${Math.round(x)}_${Math.round(z)}`, x, z, zoom: 18 };
    });
  }
  // The whole village and its harbour, as the first tour was.
  if (tour === 'village') return [...stops('port'), ...stops('lower-village'), ...stops('upper-village')];
  const { lanes, piazzas } = villagePlan();
  const list = [];
  const add = (name, x, z, zoom = 34) => list.push({ name, x: round(x), z: round(z), zoom });
  const along = (prefix, lane, step = LANE_STEP) => {
    if (lane.stair || lane.length < step) {
      const p = lanePoint(lane, lane.length / 2);
      return add(prefix, p.x, p.z, 30);
    }
    for (let s = step / 2; s < lane.length; s += step) {
      const p = lanePoint(lane, s);
      add(`${prefix}-${Math.round(s)}`, p.x, p.z);
    }
  };
  // Every `step` metres along a list of segments [ax, az, bx, bz].
  const segments = (prefix, list, step, zoom) => {
    let carry = 0;
    list.forEach(([ax, az, bx, bz], i) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = carry; d < len; d += step) add(`${prefix}-${i}-${Math.round(d)}`, ax + ((bx - ax) * d) / len, az + ((bz - az) * d) / len, zoom);
      carry = (carry - len) % step;
      if (carry < 0) carry += step;
    });
  };
  const main = VILLAGES[0];
  const hamlet = VILLAGES[1];
  const ofMain = lanes.filter((l) => l.village === main);
  // The village falls in two along its lanes: the sea front and the two lower lanes, with the
  // stairs between them; the top lane, the brow and the church above.
  const HIGH = new Set(['alta', 'cima']);
  const topOfLow = Math.max(...ofMain.filter((l) => !l.stair && !HIGH.has(l.name)).flatMap((l) => l.levels));
  const high = (lane) => (lane.stair ? Math.max(...lane.levels) > topOfLow + 1 : HIGH.has(lane.name));

  if (tour === 'port') {
    const port = ZONES.find((zn) => zn.id === 'port');
    const quay = ofMain.find((l) => l.quay);
    add('port-wide', port.x, port.z, 60);
    for (let s = 4; s < quay.length; s += 9) {
      const p = lanePoint(quay, s);
      add(`port-quay-${Math.round(s)}`, p.x, p.z, 30);
    }
    // Out over the water, where the piers and the jetty run (the quay's sea side, 15 m out).
    for (let s = 8; s < quay.length; s += 12) {
      const p = lanePoint(quay, s);
      add(`port-piers-${Math.round(s)}`, p.x - p.tz * quay.seaSide * 15, p.z + p.tx * quay.seaSide * 15);
    }
  } else if (tour === 'lower-village' || tour === 'upper-village') {
    const upper = tour === 'upper-village';
    piazzas.filter((pz) => pz.village === main && (pz.level > topOfLow + 1) === upper).forEach((pz, i) => add(`square-${i}`, pz.x, pz.z, 30));
    ofMain.filter((l) => !l.quay && high(l) === upper).forEach((lane, i) => along(`${lane.stair ? 'stair' : lane.name ?? 'lane'}-${i}`, lane));
  } else if (tour === 'hamlet') {
    add('hamlet-wide', toX(hamlet.u, hamlet.v), toZ(hamlet.u, hamlet.v), 50);
    piazzas.filter((pz) => pz.village === hamlet).forEach((pz, i) => add(`square-${i}`, pz.x, pz.z, 26));
    lanes.filter((l) => l.village === hamlet).forEach((lane, i) => along(`${lane.stair ? 'stair' : 'lane'}-${i}`, lane, 10));
  } else if (tour === 'agora') {
    for (const zn of ZONES) if (zn.id !== 'port') add(zn.id, zn.x, zn.z, 30);
    segments('path', PATHS, 24, 34);
  } else if (tour === 'railway') {
    const { a, b } = RAIL_MOUTHS;
    for (let s = a; s <= b; s += 16) {
      const p = railPoint(s, 0);
      add(`rail-${Math.round(s)}`, p.x, p.z, 40);
    }
    const station = railPoint((STATION.s0 + STATION.s1) / 2, -8);
    add('station', station.x, station.z, 30);
  } else if (tour === 'mountain') {
    add('observatory', OBSERVATORY.x, OBSERVATORY.z, 34);
    add('observatory-lower', OBSERVATORY.x + OBSERVATORY.lower.dx, OBSERVATORY.z + OBSERVATORY.lower.dz, 26);
    add('pasture', toX(145, 100), toZ(145, 100), 26);
    segments('trail', TRAILS, 22, 34);
    segments('track', TRACKS, 26, 30);
  } else if (tour === 'shore') {
    add('lighthouse', ISLET.x, ISLET.z, 40);
    // Along the shore of the bay, every 20 m, a few metres in from the water's edge.
    for (let v = -110; v <= 100; v += 20) add(`shore-${v}`, toX(coastU(v, 0) + 4, v), toZ(coastU(v, 0) + 4, v), 34);
  }
  return list;
}

export async function tour(virt, params) {
  const { renderer, pixels, player, climate, frame } = virt;
  const name = params.get('tour') || 'village';
  // The folder the pictures go to: the tour's name, or `&out=` to keep runs apart.
  const folder = params.get('out') || name;
  const only = params.get('stop');
  const yaws = (params.get('yaws') || '0,1,2,3').split(',').map(Number);
  const zoomOverride = params.has('zoom') ? Number(params.get('zoom')) : null;
  const pitch = Number(params.get('pitch') || 0.55);
  let list = stops(name, params).filter((s) => !only || only.split(',').some((o) => s.name.includes(o)));
  // `&limit=5` keeps that many stops, spread evenly over the tour.
  const limit = Number(params.get('limit') || 0);
  if (limit && list.length > limit) list = Array.from({ length: limit }, (_, i) => list[Math.floor(((i + 0.5) * list.length) / limit)]);

  // The same moment for every picture: a clear mid-October morning, unless the tour asks for
  // another (`&hour=21&day=15&weather=rain`). (The clock runs on, but a tour lasts minutes.)
  const number = (name, fallback) => (params.has(name) ? Number(params.get(name)) : fallback);
  climate.preview({ hour: number('hour', 10.5), day: number('day', 288), weather: params.get('weather') ?? 'clear' });
  // `&frames=6&every=400` takes each picture several times, so many milliseconds of the
  // world's own time apart: how the wind moves the trees, the leaves fall, the sea runs.
  const frames = Math.max(1, number('frames', 1));
  const every = number('every', 400);
  player.root.visible = false;
  player.fx.visible = false;
  renderer.setAnimationLoop(null);
  pixels.setSize(WIDTH, HEIGHT);
  const draw = (n) => {
    for (let i = 0; i < n; i++) {
      busyWait(17);
      frame();
    }
  };
  draw(4); // shaders compiled, shadows drawn

  const manifest = [];
  for (const stop of list) {
    for (const yaw of yaws) {
      // The avatar, hidden, is taken to the spot: the houses in front of it open on it.
      virt.aim({ x: stop.x, z: stop.z, yaw: (yaw * Math.PI) / 2, pitch, zoom: zoomOverride ?? stop.zoom, carry: true });
      draw(3);
      for (let f = 0; f < frames; f++) {
        // The world runs on between two frames of a sequence, a frame drawn every 17 ms.
        if (f) draw(Math.max(1, Math.round(every / 17)));
        const file = frames > 1 ? `${stop.name}-y${yaw}-f${f}.png` : `${stop.name}-y${yaw}.png`;
        const picture = document.createElement('canvas');
        const { x, y } = pixels.lowRes;
        picture.width = (x - 2) * 2;
        picture.height = (y - 2) * 2;
        const ink = picture.getContext('2d');
        ink.imageSmoothingEnabled = false;
        ink.drawImage(renderer.domElement, 1, 1, x - 2, y - 2, 0, 0, picture.width, picture.height);
        // Encoded at once: a hidden browser pane holds back timers and callbacks (toBlob,
        // setTimeout) for as long as it stays hidden, and a scheduled tour runs hidden.
        const blob = await (await fetch(picture.toDataURL('image/png'))).blob();
        await fetch(`/tour/${folder}/${file}`, { method: 'POST', body: blob });
        manifest.push({ file, ...stop, yaw, pitch, zoom: zoomOverride ?? stop.zoom, frame: f, at: f * every });
      }
    }
  }
  await fetch(`/tour/${folder}/manifest.json`, { method: 'POST', body: `${JSON.stringify(manifest, null, 2)}\n` });
  document.title = `tour ${name} done: ${manifest.length} shots`;
  pixels.setSize(innerWidth, innerHeight);
  renderer.setAnimationLoop(frame);
  return manifest;
}

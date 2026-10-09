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
//  - `&zoom=34` the height of the view in metres; `&pitch=0.6` its tilt.
// `?tour=spots&spots=-97,-12;-106,-19` looks closely at a few points of the map (x, z), for a
// fix: the lint (test/) gives the points of whatever it finds.
import { VILLAGES, ZONES, lanePoint, villagePlan } from './terrain.js';

const WIDTH = 1600; // the picture as drawn, in screen pixels: two to an art pixel
const HEIGHT = 1000;
const LANE_STEP = 18; // a stop every so many metres along a lane

const busyWait = (ms) => {
  const until = performance.now() + ms;
  while (performance.now() < until);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (x) => Math.round(x * 10) / 10;

/** Where the camera stops on a tour: a name, a point to look at, and how close. */
export function stops(tour, params = new URLSearchParams()) {
  if (tour === 'spots') {
    return (params.get('spots') || '').split(';').filter(Boolean).map((spot, i) => {
      const [x, z] = spot.split(',').map(Number);
      return { name: `spot-${i}-${Math.round(x)}_${Math.round(z)}`, x, z, zoom: 18 };
    });
  }
  const { lanes, piazzas } = villagePlan();
  const village = VILLAGES[0];
  const list = [];
  const add = (name, x, z, zoom) => list.push({ name, x: round(x), z: round(z), zoom });
  if (tour === 'village' || tour === 'port') {
    const port = ZONES.find((zn) => zn.id === 'port');
    // The harbour from its quay out to the ends of the piers, then close up on each part.
    const quay = lanes.find((l) => l.quay && l.village === village);
    add('port-wide', port.x, port.z, 60);
    for (let s = 4; s < quay.length; s += 9) {
      const p = lanePoint(quay, s);
      add(`port-quay-${Math.round(s)}`, p.x, p.z, 30);
    }
    // Out over the water, where the piers and the jetty run (the quay's sea side, 15 m out).
    for (let s = 8; s < quay.length; s += 12) {
      const p = lanePoint(quay, s);
      add(`port-piers-${Math.round(s)}`, p.x - p.tz * quay.seaSide * 15, p.z + p.tx * quay.seaSide * 15, 34);
    }
  }
  if (tour === 'village') {
    piazzas.filter((pz) => pz.village === village).forEach((pz, i) => add(`square-${i}`, pz.x, pz.z, 30));
    lanes
      .filter((l) => l.village === village && !l.quay)
      .forEach((lane, i) => {
        const kind = lane.stair ? 'stair' : 'lane';
        if (lane.stair || lane.length < LANE_STEP) {
          const p = lanePoint(lane, lane.length / 2);
          add(`${kind}-${i}`, p.x, p.z, 30);
          return;
        }
        for (let s = LANE_STEP / 2; s < lane.length; s += LANE_STEP) {
          const p = lanePoint(lane, s);
          add(`${kind}-${i}-${Math.round(s)}`, p.x, p.z, 34);
        }
      });
  }
  return list;
}

export async function tour(virt, params) {
  const { renderer, pixels, player, climate, frame } = virt;
  const name = params.get('tour') || 'village';
  const only = params.get('stop');
  const yaws = (params.get('yaws') || '0,1,2,3').split(',').map(Number);
  const zoomOverride = params.has('zoom') ? Number(params.get('zoom')) : null;
  const pitch = Number(params.get('pitch') || 0.55);
  const list = stops(name, params).filter((s) => !only || only.split(',').some((o) => s.name.includes(o)));

  // The same moment for every picture: a clear mid-October morning. (The clock runs on, but
  // a tour lasts minutes, not hours.)
  climate.preview({ hour: 10.5, day: 288, weather: 'clear' });
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
      const file = `${stop.name}-y${yaw}.png`;
      const picture = document.createElement('canvas');
      const { x, y } = pixels.lowRes;
      picture.width = (x - 2) * 2;
      picture.height = (y - 2) * 2;
      const ink = picture.getContext('2d');
      ink.imageSmoothingEnabled = false;
      ink.drawImage(renderer.domElement, 1, 1, x - 2, y - 2, 0, 0, picture.width, picture.height);
      const blob = await new Promise((resolve) => picture.toBlob(resolve, 'image/png'));
      await fetch(`/tour/${name}/${file}`, { method: 'POST', body: blob });
      manifest.push({ file, ...stop, yaw, pitch, zoom: zoomOverride ?? stop.zoom });
      await sleep(0);
    }
  }
  await fetch(`/tour/${name}/manifest.json`, { method: 'POST', body: `${JSON.stringify(manifest, null, 2)}\n` });
  document.title = `tour ${name} done: ${manifest.length} shots`;
  pixels.setSize(innerWidth, innerHeight);
  renderer.setAnimationLoop(frame);
  return manifest;
}

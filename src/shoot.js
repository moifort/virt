// Development only: `virt.shoot()` in the console takes the view on screen as the shot of the
// loading screen (index.html), and posts it to the dev server, which writes it to
// assets/loading/ (see serve.py):
//  - opening.jpg, the picture, wider than any window so that it only ever needs cropping at the
//    sides to fill one, as the map itself does: index.html shows it blurred;
//  - opening.json, the view, the hour and the weather it was taken at, on which the map then
//    opens (see main.js) before running on to the player's own.
// Frame the view, set the hour and the weather, and shoot again whenever the island changes.
const WIDTH = 2400; // the picture as drawn, in screen pixels, then halved for the page
const HEIGHT = 1000;
const DAY = 86_400_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const post = async (name, blob) => {
  const response = await fetch(`/assets/loading/${name}`, { method: 'POST', body: blob });
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
};
const round = (x, digits = 3) => Math.round(x * 10 ** digits) / 10 ** digits;

export async function shoot(virt) {
  const { renderer, pixels, view, player, climate, frame } = virt;

  // Where the view looks, less the avatar: the slide of the map, as main.js keeps it.
  const pan = view.camera.position.clone().addScaledVector(view.forward, view.distance).addScaledVector(view._up, -view.viewHeight * view.lift).sub(player.position);
  // The moment on screen, in the terms of `Climate.preview`: the solar hour and the day of the year.
  const date = new Date(Date.now() + climate.offset);
  const solar = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + climate.place.lon / 15;
  const opening = {
    view: { yaw: round(view.yaw), pitch: round(view.pitch), viewHeight: round(view.viewHeight, 1), pan: [round(pan.x, 2), round(pan.z, 2)] },
    moment: {
      hour: round(((solar % 24) + 24) % 24, 2),
      day: Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 0)) / DAY),
      weather: Object.fromEntries(Object.entries(climate.now).map(([name, value]) => [name, round(value)])),
    },
  };

  // A few frames drawn by hand at the size of the picture, the last one read straight back.
  renderer.setAnimationLoop(null);
  pixels.setSize(WIDTH, HEIGHT);
  for (let i = 0; i < 6; i++) {
    await sleep(20);
    frame();
  }
  await sleep(20);
  frame();
  const picture = document.createElement('canvas');
  picture.width = WIDTH / 2;
  picture.height = HEIGHT / 2;
  const ink = picture.getContext('2d');
  ink.imageSmoothingQuality = 'high';
  // The canvas has a texel of margin all round, for the sub-texel slide of the view.
  const { x, y } = pixels.lowRes;
  ink.drawImage(renderer.domElement, 1, 1, x - 2, y - 2, 0, 0, picture.width, picture.height);
  pixels.setSize(innerWidth, innerHeight);
  renderer.setAnimationLoop(frame);

  await post('opening.jpg', await new Promise((resolve) => picture.toBlob(resolve, 'image/jpeg', 0.8)));
  await post('opening.json', new Blob([`${JSON.stringify(opening, null, 2)}\n`]));
  console.log('opening shot', opening);
  return opening;
}

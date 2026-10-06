// Development only: `?bench=label` measures the game as it runs in whatever browser opened the
// page, then posts the figures to the dev server (serve.py appends them to a log), so a browser
// that cannot be driven from the terminal can still be measured. For each view height in
// `&zooms=80,150,260` (and once more walking, if `&walk`):
//  A. a few seconds of the real loop: the cadence of requestAnimationFrame, the CPU time of
//     each frame drawn and the time between two frames drawn;
//  B. frames run by hand with the GPU drained after each (a one-pixel readPixels), which is the
//     true cost of a frame, CPU and GPU together.
// `&close` leaves a blank page at the end, so a tab forgotten open does not slow the next run.

const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};
const stats = (values) => ({
  n: values.length,
  med: values.length ? +quantile(values, 0.5).toFixed(2) : null,
  p90: values.length ? +quantile(values, 0.9).toFixed(2) : null,
  max: values.length ? +Math.max(...values).toFixed(2) : null,
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const busyWait = (ms) => {
  const until = performance.now() + ms;
  while (performance.now() < until);
};

export async function bench(virt, params) {
  const { renderer, frame } = virt;
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const label = params.get('bench');
  // `&seconds=20` watches the loop for longer: the frame rate is also given second by second,
  // which shows a machine that slows down under a sustained load.
  const LOOP_SECONDS = Number(params.get('seconds') || 3);
  const zooms = (params.get('zooms') || '80').split(',').map(Number);
  // `&clouds=0,0.75` forces the cloud cover of the composite pass, to weigh the weather alone.
  const clouds = params.has('clouds') ? params.get('clouds').split(',').map(Number) : [null];
  const runs = clouds.flatMap((cloud) => zooms.map((zoom) => ({ zoom, cloud, walk: false })));
  if (params.has('walk')) runs.push({ zoom: zooms[0], cloud: clouds[0], walk: true });
  let forcedCloud = null;
  const pixelsRender = virt.pixels.render.bind(virt.pixels);
  virt.pixels.render = (scene, camera, frameInfo) => {
    if (forcedCloud !== null && frameInfo.weather) frameInfo.weather.cloud = forcedCloud;
    pixelsRender(scene, camera, frameInfo);
  };

  // The draw calls and triangles of the scene pass (the composite pass would overwrite them).
  let draw = null;
  const render = renderer.render.bind(renderer);
  renderer.render = (scene, camera) => {
    render(scene, camera);
    if (scene === virt.scene) draw = { ...renderer.info.render };
  };

  const machine = {
    ua: navigator.userAgent,
    gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    dpr: devicePixelRatio,
    screen: [screen.width, screen.height],
    window: [innerWidth, innerHeight],
  };
  const pre = document.body.appendChild(document.createElement('pre'));
  Object.assign(pre.style, { position: 'fixed', left: '8px', bottom: '8px', zIndex: 20, margin: 0, padding: '6px', background: '#f7ecd4', color: '#2b2533', font: '11px monospace', whiteSpace: 'pre-wrap', maxWidth: '60vw' });

  await sleep(3000); // shaders compiled, textures uploaded, GPU clock awake
  const reports = [];
  for (const run of runs) {
    virt.view.viewHeight = run.zoom;
    forcedCloud = run.cloud;
    const key = (type) => dispatchEvent(new KeyboardEvent(type, { code: 'ArrowUp', bubbles: true }));
    if (run.walk) key('keydown');
    await sleep(1500);
    const c = virt.climate;
    const report = {
      label,
      ...run,
      ...machine,
      lowRes: [virt.pixels.lowRes.x, virt.pixels.lowRes.y],
      pixelSize: virt.pixels.pixelSize,
      hidden: document.hidden,
      weather: { cloud: c.screen.cloud, rain: c.screen.rain, snow: c.screen.snow, night: c.screen.night, wind: c.screen.wind },
    };

    // A. The loop as it runs.
    const ticks = [];
    const cpu = [];
    const drawn = [];
    let lastTick = performance.now();
    let lastDrawn = lastTick;
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      ticks.push(now - lastTick);
      lastTick = now;
      const before = renderer.info.render.frame;
      frame();
      if (renderer.info.render.frame !== before) {
        cpu.push(performance.now() - now);
        drawn.push(now - lastDrawn);
        lastDrawn = now;
      }
    });
    await sleep(LOOP_SECONDS * 1000);
    const perSecond = [];
    let clockMs = 0;
    for (const interval of drawn) {
      clockMs += interval;
      perSecond[Math.floor(clockMs / 1000)] = (perSecond[Math.floor(clockMs / 1000)] || 0) + 1;
    }
    report.loop = { rafInterval: stats(ticks), frameInterval: stats(drawn), frameCpu: stats(cpu), fps: +(drawn.length / LOOP_SECONDS).toFixed(1), fpsPerSecond: perSecond.slice(0, LOOP_SECONDS) };
    report.draw = draw;
    report.visibility = document.visibilityState;

    // B. Frames by hand, the GPU drained after each.
    renderer.setAnimationLoop(null);
    const pixel = new Uint8Array(4);
    const synced = [];
    for (let i = 0; i < 60; i++) {
      busyWait(17);
      const t0 = performance.now();
      frame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      synced.push(performance.now() - t0);
      if (i % 10 === 9) await sleep(0); // let the browser breathe, as it would between frames
    }
    report.synced = stats(synced);
    renderer.setAnimationLoop(frame);
    if (run.walk) key('keyup');

    reports.push(report);
    pre.textContent = reports.map((r) => `zoom ${r.zoom}${r.cloud !== null ? ` clouds ${r.cloud}` : ''}${r.walk ? ' walking' : ''}: ${r.loop.fps} fps, frame ${r.synced.med} ms (p90 ${r.synced.p90}, max ${r.synced.max}), cpu ${r.loop.frameCpu.med} ms`).join('\n');
    await fetch('/bench', { method: 'POST', body: JSON.stringify(report) }).catch(() => {});
  }
  document.title = `bench ${label} done`;
  if (params.has('close')) location.replace('about:blank');
  return reports;
}

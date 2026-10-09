// Which review runs this week: the kind of review and the part of the island, both turning
// with the ISO week number, so that every kind meets every sector in turn (3 kinds, 8
// sectors: all 24 pairs in 24 weeks) and no single run has to look at the whole map.
//
//   bun tour/plan.js               this week's review, as JSON
//   bun tour/plan.js 2026-10-19    the review of the week holding that date
//
// Each run lists the tour URLs to open (the dev server on port 8742, see src/tour.js); the
// pictures land in tour/shots/<out>/. The procedure is in tour/routines/README.md.
import { SECTORS } from '../src/tour.js';

const KINDS = ['defects', 'details', 'macro'];
// The macro review looks at one living system at a time, turning more slowly.
const THEMES = ['nature', 'wind-and-foliage', 'seasons', 'light', 'weather'];

/** The ISO 8601 week number of a date. */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
}

export function plan(date = new Date()) {
  const week = isoWeek(date);
  // Counted from a fixed week, so that the turn does not restart each January.
  const n = date.getFullYear() * 53 + week;
  const kind = KINDS[n % KINDS.length];
  const sector = SECTORS[n % SECTORS.length];
  const base = `http://localhost:8742/?tour=${sector}`;
  const runs = [];
  const run = (label, query, out = `${sector}-${label}`) => runs.push({ label, out, url: `${base}&out=${out}${query}` });
  let theme = null;
  if (kind === 'defects') run('defects', '&yaws=0,2');
  if (kind === 'details') run('details', '&yaws=0,1&zoom=26');
  if (kind === 'macro') {
    theme = THEMES[Math.floor(n / KINDS.length) % THEMES.length];
    // A few stops only, each seen several times over: about forty pictures in all.
    if (theme === 'nature') run('nature', '&yaws=0,2&limit=10&zoom=40');
    if (theme === 'wind-and-foliage') {
      run('calm', '&yaws=0&limit=5&frames=4&every=500&weather=clear');
      run('windy', '&yaws=0&limit=5&frames=4&every=500&weather=wind');
    }
    if (theme === 'seasons') for (const [label, day] of [['spring', 105], ['summer', 196], ['autumn', 288], ['winter', 15]]) run(label, `&yaws=0&limit=8&day=${day}`);
    if (theme === 'light') for (const [label, hour] of [['dawn', 6.8], ['noon', 13], ['sunset', 18.6], ['night', 22.5]]) run(label, `&yaws=0&limit=8&hour=${hour}`);
    if (theme === 'weather') for (const weather of ['cloudy', 'rain', 'snow', 'mist']) run(weather, `&yaws=0&limit=8&weather=${weather}`);
  }
  return { week, kind, theme, sector, routine: `tour/routines/${kind}.md`, runs };
}

if (import.meta.main) {
  const date = process.argv[2] ? new Date(process.argv[2]) : new Date();
  console.log(JSON.stringify(plan(date), null, 2));
}

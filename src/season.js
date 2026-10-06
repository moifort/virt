// A little button beside the day / night switch that turns the season: a tree that blossoms,
// greens, blazes and stands bare under the snow. The calendar runs forward through the days to
// the heart of the next season, the hour of day kept, so the leaves turn rather than snap. It
// shows the season the sky is in, so it follows the real date too, and the Y and R preview keys.

/** The seasons in the order of the year, with the turn of the year at the heart of each. */
const SEASONS = [
  { name: 'spring', label: 'Printemps', to: 'au printemps', year: 0.75 },
  { name: 'summer', label: 'Été', to: "à l'été", year: 0 },
  { name: 'autumn', label: 'Automne', to: "à l'automne", year: 0.25 },
  { name: 'winter', label: 'Hiver', to: "à l'hiver", year: 0.5 },
];

/** @param {import('./climate.js').Climate} climate */
export function seasonSwitch(climate) {
  const button = document.createElement('button');
  button.className = 'season';
  button.type = 'button';
  button.innerHTML = `
    <span class="season-sky"></span>
    <span class="season-ground"></span>
    <span class="season-tree">
      <i class="trunk"></i>
      <i class="branches"></i>
      <i class="crown"></i>
      <i class="bloom"></i>
      <i class="snowcap"></i>
    </span>`;
  document.body.append(button);

  /** The season the sky is in: the strongest of the four. */
  const current = () => SEASONS.reduce((best, season) => (climate.season[season.name] > climate.season[best.name] ? season : best));
  let shown = null;
  let pending = null; // the season on its way, while the calendar runs
  const show = (season) => {
    if (season === shown) return;
    if (shown) button.classList.remove(`is-${shown.name}`);
    shown = season;
    button.classList.add(`is-${season.name}`);
    const next = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length];
    const text = `${season.label} — passer ${next.to}`;
    button.setAttribute('aria-label', text);
    button.title = text;
  };
  button.addEventListener('click', () => {
    const from = pending ?? shown;
    pending = SEASONS[(SEASONS.indexOf(from) + 1) % SEASONS.length];
    // Forward through the year to the heart of the next season, from wherever the date stands.
    const turn = (pending.year - climate.year + 1) % 1 || 1;
    climate.travelDays(Math.round(turn * 365.24));
    show(pending);
    // Space and Enter belong to the avatar, not to the button.
    button.blur();
  });
  show(current());

  return {
    /** Keeps the tree in step with the season. */
    update() {
      if (!climate.calendar) pending = null;
      show(pending ?? current());
    },
  };
}

// A little button that shows the season as a tree, blossoming, green, blazing or bare under
// the snow, and spreads a fan of the four seasons to choose from. The calendar runs forward
// through the days to the heart of the season chosen, the hour of day kept, so the leaves turn
// rather than snap. It follows the real date too, and the Y and R preview keys.
import { fan } from './fan.js';

/** The seasons in the order of the year, with the turn of the year at the heart of each. */
const SEASONS = [
  { name: 'spring', label: 'Printemps', year: 0.75 },
  { name: 'summer', label: 'Été', year: 0 },
  { name: 'autumn', label: 'Automne', year: 0.25 },
  { name: 'winter', label: 'Hiver', year: 0.5 },
];

/** The pixel picture of a tree in a season, drawn in CSS (see index.html). */
const icon = (name) => `
  <span class="season-pic is-${name}">
    <span class="season-sky"></span>
    <span class="season-ground"></span>
    <span class="season-tree">
      <i class="trunk"></i>
      <i class="branches"></i>
      <i class="crown"></i>
      <i class="bloom"></i>
      <i class="snowcap"></i>
    </span>
  </span>`;

/** @param {import('./climate.js').Climate} climate */
export function seasonSwitch(climate) {
  const button = document.createElement('button');
  button.className = 'season';
  button.type = 'button';
  button.innerHTML = icon('summer');
  document.body.append(button);

  let pending = null; // the season on its way, while the calendar runs
  const hand = fan(button, SEASONS, {
    render: (season) => icon(season.name),
    pick: (season) => {
      pending = season;
      // Forward through the year to the heart of the season chosen, from wherever the date stands.
      const turn = (season.year - climate.year + 1) % 1 || 1;
      climate.travelDays(Math.round(turn * 365.24));
    },
  });

  /** The season the sky is in: the strongest of the four. */
  const current = () => SEASONS.reduce((best, season) => (climate.season[season.name] > climate.season[best.name] ? season : best));
  let shown = null;
  const show = (season) => {
    if (season === shown) return;
    shown = season;
    button.firstElementChild.className = `season-pic is-${season.name}`;
    button.title = `${season.label} — choisir la saison`;
    button.setAttribute('aria-label', button.title);
    hand.check(season.name);
  };
  show(current());

  let night = null;
  return {
    /** Keeps the tree in step with the season, and the sky behind it with the hour. */
    update() {
      if (climate.nightAhead !== night) {
        night = climate.nightAhead;
        button.classList.toggle('is-night', night);
        hand.mark('is-night', night);
      }
      if (!climate.calendar) pending = null;
      show(pending ?? current());
    },
  };
}

// A little button that shows the weather over the island and, when pressed, spreads a fan of
// skies to choose from: the real one, sun, wind, rain, storm, snow. The chosen weather rolls in
// over a few seconds (see Climate.setWeather); the R key, or the first chip, hands the sky back
// to the forecast.
import { fan } from './fan.js';

const CHOICES = [
  { name: 'real', label: 'Météo réelle' },
  { name: 'clear', label: 'Soleil' },
  { name: 'wind', label: 'Vent' },
  { name: 'rain', label: 'Pluie' },
  { name: 'storm', label: 'Tempête' },
  { name: 'snow', label: 'Neige' },
];

/** The pixel picture of a sky, drawn in CSS (see index.html). */
const icon = (name) => `<span class="sky sky-${name}"><i class="sun"></i><i class="moon"></i><i class="cloud"></i><i class="drops"></i><i class="bolt"></i><i class="gusts"></i></span>`;

/** The chip that best shows the real weather, when the sky follows the forecast. */
function realLook(climate) {
  const { rain, snow, wind, cloud } = climate.now;
  if (snow > 0.2) return 'snow';
  if (rain > 0.5 && wind > 0.8) return 'storm';
  if (rain > 0.15) return 'rain';
  if (wind > 0.75) return 'wind';
  return cloud > 0.6 ? 'cloudy' : 'clear';
}

/** @param {import('./climate.js').Climate} climate */
export function weatherSwitch(climate) {
  const button = document.createElement('button');
  button.className = 'weather';
  button.type = 'button';
  button.innerHTML = `${icon('clear')}<i class="live"></i>`;
  document.body.append(button);
  const hand = fan(button, CHOICES, {
    render: (choice) => (choice.name === 'real' ? `${icon('clear')}<i class="live"></i>` : icon(choice.name)),
    pick: (choice) => climate.setWeather(choice.name),
  });

  let shown = null;
  let chosen = null;
  let night = null;
  return {
    /** Keeps the picture on the button in step with the sky, and the chosen chip marked. */
    update() {
      // After dark the pictures show the moon and a night sky, as the day / night switch does.
      if (climate.nightAhead !== night) {
        night = climate.nightAhead;
        button.classList.toggle('is-night', night);
        hand.mark('is-night', night);
      }
      const weather = climate.weather;
      const look = weather === 'real' ? realLook(climate) : weather;
      if (look !== shown) {
        shown = look;
        button.firstElementChild.className = `sky sky-${look}`;
      }
      if (weather !== chosen) {
        chosen = weather;
        button.classList.toggle('is-real', weather === 'real');
        const label = CHOICES.find((choice) => choice.name === weather)?.label ?? weather;
        button.title = `${label} — choisir le temps`;
        button.setAttribute('aria-label', button.title);
        hand.check(weather);
      }
    },
  };
}

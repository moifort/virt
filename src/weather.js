// A little button in the top right corner that shows the weather over the island and, when
// pressed, unfolds a row of skies to choose from: the real one, sun, wind, rain, storm, snow.
// The chosen weather rolls in over a few seconds (see Climate.setWeather); the R key, or the
// first chip, hands the sky back to the forecast.

const CHOICES = [
  { name: 'real', label: 'Météo réelle' },
  { name: 'clear', label: 'Soleil' },
  { name: 'wind', label: 'Vent' },
  { name: 'rain', label: 'Pluie' },
  { name: 'storm', label: 'Tempête' },
  { name: 'snow', label: 'Neige' },
];

/** The pixel picture of a sky, drawn in CSS (see index.html). */
const icon = (name) => `<span class="sky sky-${name}"><i class="sun"></i><i class="cloud"></i><i class="drops"></i><i class="bolt"></i><i class="gusts"></i></span>`;

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
  button.setAttribute('aria-haspopup', 'true');
  button.innerHTML = `${icon('clear')}<i class="live"></i>`;
  const tray = document.createElement('div');
  tray.className = 'weather-tray';
  tray.setAttribute('role', 'menu');
  for (const choice of CHOICES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'weather-chip';
    chip.dataset.weather = choice.name;
    chip.title = choice.label;
    chip.setAttribute('aria-label', choice.label);
    chip.setAttribute('role', 'menuitemradio');
    chip.innerHTML = icon(choice.name);
    chip.addEventListener('click', () => {
      climate.setWeather(choice.name);
      open(false);
      chip.blur();
    });
    tray.append(chip);
  }
  document.body.append(button, tray);

  let isOpen = false;
  const open = (state) => {
    isOpen = state;
    tray.classList.toggle('is-open', isOpen);
    button.setAttribute('aria-expanded', String(isOpen));
  };
  button.addEventListener('click', () => {
    open(!isOpen);
    // Space and Enter belong to the avatar, not to the button.
    button.blur();
  });
  // A press anywhere else folds the tray away.
  addEventListener('pointerdown', (e) => {
    if (isOpen && !tray.contains(e.target) && !button.contains(e.target)) open(false);
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') open(false);
  });

  let shown = null;
  let chosen = null;
  return {
    /** Keeps the picture on the button in step with the sky, and the chosen chip marked. */
    update() {
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
        button.title = weather === 'real' ? 'Météo réelle — choisir le temps' : `${label} — choisir le temps`;
        button.setAttribute('aria-label', button.title);
        for (const chip of tray.children) chip.setAttribute('aria-checked', String(chip.dataset.weather === weather));
      }
    },
  };
}

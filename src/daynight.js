// A little switch at the top of the screen that turns the day into the night and back: the
// hours run by quickly, through the sunset or the dawn, rather than jumping. It shows what the
// sky is doing, so it follows the real hour too, and the T and R preview keys.

const DAY_HOUR = 11;
const NIGHT_HOUR = 22;

/** @param {import('./climate.js').Climate} climate */
export function dayNightSwitch(climate) {
  const button = document.createElement('button');
  button.className = 'daynight';
  button.type = 'button';
  button.innerHTML = `
    <span class="daynight-sky">
      <i class="star" style="left: 9px; top: 6px"></i>
      <i class="star" style="left: 19px; top: 15px; animation-delay: -0.7s"></i>
      <i class="star" style="left: 27px; top: 5px; animation-delay: -1.3s"></i>
      <i class="cloud" style="left: 30px; top: 7px"></i>
      <i class="cloud" style="left: 40px; top: 16px; animation-delay: -2s"></i>
    </span>
    <span class="daynight-knob"><i class="sun"></i><i class="moon"></i></span>`;
  document.body.append(button);

  let night = null;
  const show = (isNight) => {
    if (isNight === night) return;
    night = isNight;
    button.classList.toggle('is-night', night);
    button.setAttribute('aria-label', night ? 'Passer au jour' : 'Passer à la nuit');
    button.title = night ? 'Passer au jour' : 'Passer à la nuit';
  };
  button.addEventListener('click', () => {
    climate.travel(night ? DAY_HOUR : NIGHT_HOUR);
    show(climate.nightAhead);
    // Space and Enter belong to the avatar, not to the button.
    button.blur();
  });
  show(climate.nightAhead);

  return {
    /** Keeps the switch in step with the sky. */
    update() {
      show(climate.nightAhead);
    },
  };
}

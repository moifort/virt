// A fan of choices unfolding from a button, as a hand of cards spread: the chips fly out one
// after another along an arc above it and fold back the same way. Used by the weather and the
// season switches (weather.js, season.js).

/**
 * @param {HTMLButtonElement} button the button the fan opens from
 * @param {{name: string, label: string}[]} choices
 * @param {{render: (choice) => string, pick: (choice) => void}} handlers
 *   `render` gives the inner HTML of a chip, `pick` is called with the chip chosen.
 */
export function fan(button, choices, { render, pick }) {
  const tray = document.createElement('div');
  tray.className = 'fan';
  tray.setAttribute('role', 'menu');
  const n = choices.length;
  // Along an arc from left to up-right, wider for a longer hand.
  const radius = n <= 4 ? 76 : 100;
  const [from, to] = n <= 4 ? [150, 75] : [165, 60];
  const chips = choices.map((choice, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'fan-chip';
    chip.dataset.choice = choice.name;
    chip.title = choice.label;
    chip.setAttribute('aria-label', choice.label);
    chip.setAttribute('role', 'menuitemradio');
    const angle = ((from + ((to - from) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
    chip.style.setProperty('--i', i);
    chip.style.setProperty('--dx', `${(Math.cos(angle) * radius).toFixed(1)}px`);
    chip.style.setProperty('--dy', `${(-Math.sin(angle) * radius).toFixed(1)}px`);
    chip.innerHTML = render(choice);
    chip.addEventListener('click', () => {
      pick(choice);
      open(false);
      chip.blur();
    });
    tray.append(chip);
    return chip;
  });
  document.body.append(tray);

  let isOpen = false;
  const open = (state) => {
    isOpen = state;
    if (isOpen) {
      // The hand spreads from the middle of the button, wherever it stands.
      const rect = button.getBoundingClientRect();
      tray.style.left = `${rect.left + rect.width / 2}px`;
      tray.style.top = `${rect.top + rect.height / 2}px`;
    }
    tray.classList.toggle('is-open', isOpen);
    button.setAttribute('aria-expanded', String(isOpen));
  };
  button.setAttribute('aria-haspopup', 'true');
  button.addEventListener('click', () => {
    open(!isOpen);
    // Space and Enter belong to the avatar, not to the button.
    button.blur();
  });
  // A press anywhere else, or Escape, folds the hand away.
  addEventListener('pointerdown', (e) => {
    if (isOpen && !tray.contains(e.target) && !button.contains(e.target)) open(false);
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') open(false);
  });

  return {
    /** Marks the chip that stands for the current choice. */
    check(name) {
      for (const chip of chips) chip.setAttribute('aria-checked', String(chip.dataset.choice === name));
    },
  };
}

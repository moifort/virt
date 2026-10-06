// A fan of choices unfolding from a button, as a stack of the Dock does: the chips rise one
// after another in a single column that leans away as it climbs, and fold back the same way.
// Used by the weather and the season switches (weather.js, season.js).

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
  // Up from the button, one chip's height apart, bending to the left a little more each step.
  const STEP = 40;
  const chips = choices.map((choice, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'fan-chip';
    chip.dataset.choice = choice.name;
    chip.title = choice.label;
    chip.setAttribute('aria-label', choice.label);
    chip.setAttribute('role', 'menuitemradio');
    chip.style.setProperty('--i', i);
    chip.style.setProperty('--dx', `${(-2.2 * i * i).toFixed(1)}px`);
    chip.style.setProperty('--dy', `${-(STEP + 8 + i * STEP)}px`);
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
    /** Sets or clears a class on the whole hand: `is-night`, for the pictures to follow the sky. */
    mark(className, state) {
      tray.classList.toggle(className, state);
    },
  };
}

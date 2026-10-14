// On a touch screen there are no arrow keys: a pad in the bottom left corner walks the avatar,
// Gather-style, one tile per tap or on and on while the thumb rests on it, and from one way to
// the next as the thumb slides, without lifting. A round button beside it sits him down on the
// seat at hand, gets him up, or makes him hop. The map itself is handled with the fingers (see
// main.js): one slides it, two pinch to zoom, twist to turn and move up or down to tilt.

const WAYS = [
  { name: 'up', code: 'ArrowUp', label: 'Monter' },
  { name: 'right', code: 'ArrowRight', label: 'Aller à droite' },
  { name: 'down', code: 'ArrowDown', label: 'Descendre' },
  { name: 'left', code: 'ArrowLeft', label: 'Aller à gauche' },
];
// The thumb has to leave the middle of the pad before it asks for a way.
const HUB = 14;

/**
 * Lays the pad out, on a touch screen only; returns null elsewhere.
 * @param {{ press: (code: string) => void, release: (code: string) => void, act: () => void }} handlers
 *   `press` and `release` take the key codes of the arrows, as the keyboard sends them; `act`
 *   is the round button.
 */
export function touchPad({ press, release, act }) {
  if (!matchMedia('(pointer: coarse)').matches) return null;

  const pad = document.createElement('div');
  pad.className = 'pad';
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Marcher');
  const arms = WAYS.map((way) => {
    const arm = document.createElement('i');
    arm.className = `pad-${way.name}`;
    arm.setAttribute('aria-label', way.label);
    pad.append(arm);
    return arm;
  });
  const hub = document.createElement('i');
  hub.className = 'pad-hub';
  pad.append(hub);

  const button = document.createElement('button');
  button.className = 'act';
  button.type = 'button';
  button.title = 'Sauter';
  button.setAttribute('aria-label', button.title);
  button.innerHTML = '<i class="chair"></i><i class="leap"></i>';
  document.body.append(pad, button);

  // One thumb at a time: the way it asks for, from where it rests on the pad.
  let thumb = null;
  let way = -1;
  const ask = (index) => {
    if (index === way) return;
    if (way >= 0) {
      release(WAYS[way].code);
      arms[way].classList.remove('is-down');
    }
    way = index;
    if (way >= 0) {
      press(WAYS[way].code);
      arms[way].classList.add('is-down');
    }
  };
  const wayAt = (e) => {
    const rect = pad.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) < HUB) return -1;
    // Round the bearing to a quarter turn: up, right, down, left.
    return (Math.round(Math.atan2(x, -y) / (Math.PI / 2)) + 4) % 4;
  };
  pad.addEventListener('pointerdown', (e) => {
    if (thumb !== null) return;
    thumb = e.pointerId;
    pad.setPointerCapture(thumb);
    ask(wayAt(e));
    e.preventDefault();
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === thumb) ask(wayAt(e));
  });
  const lift = (e) => {
    if (e.pointerId !== thumb) return;
    thumb = null;
    ask(-1);
  };
  pad.addEventListener('pointerup', lift);
  pad.addEventListener('pointercancel', lift);
  // The page must not take the thumb for a long press.
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    act();
  });
  button.addEventListener('contextmenu', (e) => e.preventDefault());

  let shown = null;
  return {
    /** Shows on the button what it does: sit down by a seat, get up from one, else hop. */
    update(seatAtHand, seated) {
      const state = seated ? 'stand' : seatAtHand ? 'sit' : 'hop';
      if (state === shown) return;
      shown = state;
      button.classList.toggle('is-seat', state !== 'hop');
      button.title = state === 'stand' ? 'Se lever' : state === 'sit' ? "S'asseoir" : 'Sauter';
      button.setAttribute('aria-label', button.title);
    },
  };
}

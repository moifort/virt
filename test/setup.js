// The world is built headless, under bun, with no browser: the one thing it asks of the DOM
// is a 2D canvas for the pub's painted sign (zones.js). A canvas that takes every call and
// draws nothing stands in for it.
// Every village part remembers which function laid it, for the lint's messages.
globalThis.TRACE_PARTS = true;
const noop = () => {};
const ctx = new Proxy({}, { get: () => noop, set: () => true });
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
};

// smoke.js — runs the REAL main.js under a stubbed DOM + canvas, then drives a
// full Level 1 solve with synthetic key events. Verifies the browser glue
// (rendering, input, HUD, overlay, localStorage) runs without errors.
// Run with:  node smoke.js
'use strict';

// ---- minimal browser environment --------------------------------------
const noop = () => {};
const ctx = new Proxy({}, {
  get: (t, p) => (p in t ? t[p] : noop),   // any unknown method is a no-op
  set: (t, p, v) => { t[p] = v; return true; },
});

function makeEl() {
  return {
    classList: { add: noop, remove: noop, toggle: noop },
    style: {}, _children: [],
    textContent: '', innerHTML: '', title: '', disabled: false,
    width: 0, height: 0,
    getContext: () => ctx,
    addEventListener: noop,
    appendChild(c) { this._children.push(c); },
  };
}

const els = {};
const getEl = (id) => (els[id] || (els[id] = makeEl()));

const keyHandlers = [];
global.window = global;                       // main.js reads bare window/document
global.self = global;
global.document = {
  getElementById: getEl,
  createElement: makeEl,
};
global.performance = { now: () => Date.now() };
const rafQueue = [];
global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
global.addEventListener = (type, fn) => { if (type === 'keydown') keyHandlers.push(fn); };
const storage = {};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
};

// ---- load engine + data, then the real main.js ------------------------
global.EchoEngine = require('./engine.js');
global.LEVELS = require('./levels.js');
require('./main.js');                          // IIFE runs immediately

let failures = 0;
const check = (name, cond) => {
  if (cond) console.log('  ✓ ' + name);
  else { failures++; console.log('  ✗ ' + name); }
};

const runFrames = (n) => {
  for (let i = 0; i < n; i++) {
    const cb = rafQueue.shift();
    if (cb) cb(performance.now());            // each frame re-queues the next
  }
};
const press = (key) => {
  const ev = { key, code: key === ' ' ? 'Space' : '', preventDefault: noop };
  for (const h of keyHandlers) h(ev);
};

console.log('\n[smoke] real main.js under stubbed DOM');
check('boot rendered Level 1 into HUD', els.levelName.textContent === 'First Light');
runFrames(3);                                  // draw a few animation frames
check('render loop runs without throwing', rafQueue.length > 0);
check('move counter starts at 0', els.moveCount.textContent === 0 || els.moveCount.textContent === '0' || els.moveCount.textContent === 0);

// Solve L1: walk under the mirror at (4,3), face it, rotate, walk to exit.
press('d');         // (3,5) -> (4,5)
press('w');         // (4,5) -> (4,4)
press('w');         // blocked by mirror, now FACING up
press(' ');         // rotate mirror (4,3): '\' -> '/', beam now hits crystal
check('one rotation was counted', els.moveCount.textContent === 1);
check('crystal now reads 1/1', els.crystalDots.innerHTML.indexOf('on') !== -1);
runFrames(2);
press('s');         // (4,4) -> (4,5)
press('d');         // (4,5) -> (5,5)
press('d');         // (5,5) -> (6,5) == exit, gate open -> WIN
check('win overlay shown', els.overlayTitle.textContent === 'Room Cleared');
check('progress saved to localStorage', storage['echoGrid.unlocked'] === '1');

// Advance to the next room.
press('n');
check('N advances to Level 2', els.levelName.textContent === 'Twin Echo');
runFrames(2);

// Restart resets the move counter.
press('d'); press(' ');   // make a move on L2 (may or may not rotate)
press('r');               // restart
check('restart resets move counter to 0', els.moveCount.textContent === 0);

console.log('\n' + (failures === 0 ? 'Smoke test passed.' : failures + ' smoke check(s) failed.'));
process.exit(failures === 0 ? 0 : 1);

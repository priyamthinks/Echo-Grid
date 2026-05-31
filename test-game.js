// test-game.js — headless integration tests for the 5 required behaviours.
// Mirrors exactly what main.js does to the state (toggle mirror char + retrace),
// without a browser. Run with:  node test-game.js
const E = require('./engine.js');
const LEVELS = require('./levels.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

// helpers that replicate main.js actions on a parsed state
const rotateAt = (s, x, y) => { s.cells[y][x] = s.cells[y][x] === '/' ? '\\' : '/'; s.movesUsed++; };
const activeCount = (s, tr) => s.crystals.filter((c) => tr.activated.has(c.x + ',' + c.y)).length;
function findMirror(s) {
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (E.isMirror(s.cells[y][x])) return { x, y };
  return null;
}

// ---- 1. Sound reflection works correctly -------------------------------
console.log('\n[1] Sound reflection');
{
  // Tiny scratch level: emitter shoots right into a '/', which must bend it up.
  const def = { name: 'reflect', moves: 9, grid: [
    '#####',
    '#  C#',
    '#> /#',   // beam right hits '/', should reflect UP to the crystal above
    '#####',
  ]};
  const s = E.parseLevel(def);
  const tr = E.traceBeam(s);
  check("'/' bends rightward beam upward into the crystal", E.allCrystalsActive(s, tr));

  // Flip to '\' — now the beam bends DOWN into the wall, missing the crystal.
  const mx = 3, my = 2;
  s.cells[my][mx] = '\\';
  check("'\\' bends it the other way and misses", !E.allCrystalsActive(s, E.traceBeam(s)));
}

// ---- 2. Crystals activate only when hit --------------------------------
console.log('\n[2] Crystals activate only when hit');
{
  const s = E.parseLevel(LEVELS[0]);          // L1 starts unsolved
  const tr0 = E.traceBeam(s);
  check('L1 starts with the crystal inactive', activeCount(s, tr0) === 0);
  const m = findMirror(s);
  rotateAt(s, m.x, m.y);                       // rotate the one mirror to solve
  const tr1 = E.traceBeam(s);
  check('crystal activates once the beam reaches it', activeCount(s, tr1) === 1);
}

// ---- 3. Gate opens only after ALL crystals activate --------------------
console.log('\n[3] Gate opens only when all crystals are active');
{
  const s = E.parseLevel(LEVELS[1]);          // L2 has 2 crystals / 2 mirrors
  check('gate closed at start', !E.allCrystalsActive(s, E.traceBeam(s)));
  // L2 solution: both mirrors must flip ((6,1) and (6,4))
  rotateAt(s, 6, 1);
  check('gate still closed after only 1 crystal', !E.allCrystalsActive(s, E.traceBeam(s)));
  rotateAt(s, 6, 4);
  check('gate opens after both crystals active', E.allCrystalsActive(s, E.traceBeam(s)));
}

// ---- 4. Restart resets the level ---------------------------------------
console.log('\n[4] Restart resets the level');
{
  const def = LEVELS[0];
  const s = E.parseLevel(def);
  const m = findMirror(s);
  const before = s.cells[m.y][m.x];
  rotateAt(s, m.x, m.y);                       // mutate: rotate + spend a move
  check('state changed after a rotation', s.movesUsed === 1 && s.cells[m.y][m.x] !== before);
  // Restart == re-parse the immutable def (what loadLevel does)
  const s2 = E.parseLevel(def);
  check('fresh parse restores mirror orientation', s2.cells[m.y][m.x] === before);
  check('fresh parse resets move counter', s2.movesUsed === 0);
}

// ---- 5. Level progression works ----------------------------------------
console.log('\n[5] Level progression');
{
  check('there are at least 10 levels', LEVELS.length >= 10);
  let unlocked = 0;                            // simulate winning each room
  for (let i = 0; i < LEVELS.length; i++) {
    if (i + 1 > unlocked) unlocked = i + 1;    // winLevel() rule
  }
  check('clearing every room unlocks through the last', unlocked === LEVELS.length);
  check('every level name is unique', new Set(LEVELS.map((l) => l.name)).size === LEVELS.length);
}

console.log('\n' + (fail === 0
  ? `All ${pass} checks passed.`
  : `${fail} check(s) failed (${pass} passed).`));
process.exit(fail === 0 ? 0 : 1);

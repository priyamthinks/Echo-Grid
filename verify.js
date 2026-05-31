// verify.js — headless validation of every level using the real engine.
// Run with:  node verify.js
//
// For each level it checks:
//   1. Grid is well-formed (rows equal length, portals paired, has emitter/
//      player/exit).
//   2. At least one combination of mirror orientations activates all crystals.
//   3. The level is NOT already solved at its starting orientations.
//   4. A solving combination exists whose changed mirrors are all reachable by
//      the player AND needs no more rotations than the move budget.
//   5. The exit tile is reachable from the player start.
const E = require('./engine.js');
const LEVELS = require('./levels.js');

const DIR_LIST = Object.values(E.DIRS);

// BFS over walkable tiles (' ' and exit 'G') from the player start.
function reachableSet(state) {
  const seen = new Set();
  const start = state.player;
  if (!start) return seen;
  const key = (x, y) => x + ',' + y;
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return false;
    const ch = state.cells[y][x];
    return ch === ' ' || ch === 'G';
  };
  const q = [start];
  seen.add(key(start.x, start.y));
  while (q.length) {
    const p = q.shift();
    for (const d of DIR_LIST) {
      const nx = p.x + d.x, ny = p.y + d.y;
      if (walkable(nx, ny) && !seen.has(key(nx, ny))) {
        seen.add(key(nx, ny));
        q.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}

// A mirror is "accessible" if an orthogonal neighbour is reachable floor.
function mirrorAccessible(state, reach, mx, my) {
  for (const d of DIR_LIST) {
    if (reach.has((mx + d.x) + ',' + (my + d.y))) return true;
  }
  return false;
}

function listMirrors(state) {
  const out = [];
  for (let y = 0; y < state.rows; y++)
    for (let x = 0; x < state.cols; x++)
      if (E.isMirror(state.cells[y][x])) out.push({ x, y, init: state.cells[y][x] });
  return out;
}

let failures = 0;
const summary = [];

LEVELS.forEach((def, i) => {
  const label = `L${i + 1} "${def.name}"`;
  const problems = [];

  // 1. structural checks
  const widths = new Set(def.grid.map((r) => r.length));
  if (widths.size !== 1) problems.push(`uneven row widths: ${[...widths].join(',')}`);

  const state = E.parseLevel(def);
  if (!state.emitter) problems.push('no emitter');
  if (!state.player) problems.push('no player start');
  if (!state.exit) problems.push('no exit');
  if (state.crystals.length === 0) problems.push('no crystals');
  for (const id of Object.keys(state.portals)) {
    if (state.portals[id].length !== 2)
      problems.push(`portal '${id}' has ${state.portals[id].length} cells (need 2)`);
  }

  const reach = reachableSet(state);
  if (state.exit && !reach.has(state.exit.x + ',' + state.exit.y))
    problems.push('exit not reachable from player start');

  // 2-4. brute force every mirror orientation combination
  const mirrors = listMirrors(state);
  const m = mirrors.length;
  let solvedAtStart = false;
  let bestRotations = Infinity;
  let anySolution = false;

  for (let mask = 0; mask < (1 << m); mask++) {
    for (let b = 0; b < m; b++)
      state.cells[mirrors[b].y][mirrors[b].x] = (mask >> b) & 1 ? '\\' : '/';
    const trace = E.traceBeam(state);
    if (!E.allCrystalsActive(state, trace)) continue;
    anySolution = true;

    // rotations needed = mirrors whose orientation differs from initial
    let rotations = 0;
    let allReachable = true;
    for (let b = 0; b < m; b++) {
      const want = (mask >> b) & 1 ? '\\' : '/';
      if (want !== mirrors[b].init) {
        rotations++;
        if (!mirrorAccessible(state, reach, mirrors[b].x, mirrors[b].y)) allReachable = false;
      }
    }
    if (rotations === 0) solvedAtStart = true;
    if (allReachable) bestRotations = Math.min(bestRotations, rotations);
  }
  // restore initial orientations
  for (const mi of mirrors) state.cells[mi.y][mi.x] = mi.init;

  if (!anySolution) problems.push('no mirror combination activates all crystals');
  if (solvedAtStart) problems.push('already solved at starting orientations (trivial)');
  if (anySolution && bestRotations === Infinity)
    problems.push('solving mirrors are not reachable by the player');
  if (bestRotations !== Infinity && bestRotations > state.limit)
    problems.push(`needs ${bestRotations} rotations but budget is ${state.limit}`);

  if (problems.length) {
    failures++;
    console.log(`✗ ${label}`);
    for (const p of problems) console.log(`    - ${p}`);
  } else {
    console.log(`✓ ${label}  (min ${bestRotations} rotations / budget ${state.limit}, ` +
      `${state.crystals.length} crystals, ${m} mirrors)`);
  }
  summary.push({ label, ok: problems.length === 0 });
});

console.log('\n' + (failures === 0
  ? `All ${LEVELS.length} levels valid.`
  : `${failures} level(s) failed validation.`));
process.exit(failures === 0 ? 0 : 1);

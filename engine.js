// engine.js — pure simulation logic for Echo Grid (no DOM).
// Shared by the browser game (main.js) and the Node verifier (verify.js).
// This keeps game RULES separate from rendering/input, so levels can be
// tested headlessly.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.EchoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Unit travel vectors for the four cardinal directions.
  const DIRS = {
    up:    { x: 0, y: -1 },
    down:  { x: 0, y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  // Mirror reflection tables: incoming travel direction -> outgoing direction.
  //   '/'  acts like a forward slash, '\' like a back slash.
  const REFLECT = {
    '/':  { up: 'right', right: 'up', down: 'left', left: 'down' },
    '\\': { up: 'left', left: 'up', down: 'right', right: 'down' },
  };

  // Emitter glyphs encode the starting beam direction.
  const EMITTER_DIRS = { '>': 'right', '<': 'left', '^': 'up', 'v': 'down' };

  const isMirror = (ch) => ch === '/' || ch === '\\';
  const isPortal = (ch) => ch >= '1' && ch <= '9';

  // Parse a level definition (ASCII `grid` + metadata) into a mutable state.
  // Emitter / player / exit glyphs are lifted out into fields; the rest of the
  // tiles stay in `cells` (mirrors mutate there when rotated).
  function parseLevel(def) {
    const rawRows = def.grid;
    const rows = rawRows.length;
    let cols = 0;
    for (const r of rawRows) cols = Math.max(cols, r.length);

    const cells = [];
    let emitter = null, player = null, exit = null;
    const portals = {};   // id -> [{x,y}, {x,y}]
    const crystals = [];  // [{x,y}]

    for (let y = 0; y < rows; y++) {
      const row = [];
      const line = rawRows[y];
      for (let x = 0; x < cols; x++) {
        let ch = line[x] || ' ';
        if (ch === '.') ch = ' ';
        if (EMITTER_DIRS[ch]) {
          emitter = { x, y, dir: EMITTER_DIRS[ch] };
          ch = ' ';
        } else if (ch === '@') {
          player = { x, y };
          ch = ' ';
        } else if (ch === 'G') {
          exit = { x, y };           // kept in cells so it can be drawn/walked
        } else if (isPortal(ch)) {
          (portals[ch] || (portals[ch] = [])).push({ x, y });
        } else if (ch === 'C') {
          crystals.push({ x, y });
        }
        row.push(ch);
      }
      cells.push(row);
    }

    return {
      def, rows, cols, cells,
      emitter, player, exit, portals, crystals,
      movesUsed: 0,
      limit: def.moves != null ? def.moves : 99,
    };
  }

  // Trace the beam from the emitter.
  // Returns { segments, activated }:
  //   segments  — array of polylines (arrays of {x,y} grid coords). A portal
  //               jump ends one segment and starts another (visual break).
  //   activated — Set of "x,y" keys for crystals the beam passed through.
  function traceBeam(state) {
    const { cells, emitter, rows, cols } = state;
    const activated = new Set();
    const segments = [];
    if (!emitter) return { segments, activated };

    let dir = emitter.dir;
    let pos = { x: emitter.x, y: emitter.y };
    let seg = [{ x: pos.x, y: pos.y }];
    const visited = new Set();              // (cell,dir) states, for loop guard
    const maxSteps = rows * cols * 8 + 64;
    let steps = 0;

    while (steps++ < maxSteps) {
      const key = pos.x + ',' + pos.y + ',' + dir;
      if (visited.has(key)) break;          // repeating state -> stop
      visited.add(key);

      const d = DIRS[dir];
      const nx = pos.x + d.x, ny = pos.y + d.y;

      // Leaving the grid: extend half a cell to the edge and stop.
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
        seg.push({ x: pos.x + d.x * 0.5, y: pos.y + d.y * 0.5 });
        break;
      }
      const ch = cells[ny][nx];

      // Wall: stop at the shared edge between the two cells.
      if (ch === '#') {
        seg.push({ x: pos.x + d.x * 0.5, y: pos.y + d.y * 0.5 });
        break;
      }

      seg.push({ x: nx, y: ny });           // beam enters the next cell

      if (ch === 'A') break;                // absorber destroys the beam
      if (ch === 'C') {                     // crystal: activate, pass through
        activated.add(nx + ',' + ny);
        pos = { x: nx, y: ny };
        continue;
      }
      if (isMirror(ch)) {                    // reflect and continue
        dir = REFLECT[ch][dir];
        pos = { x: nx, y: ny };
        continue;
      }
      if (isPortal(ch)) {
        const pair = state.portals[ch];
        let other = null;
        if (pair && pair.length === 2) {
          other = (pair[0].x === nx && pair[0].y === ny) ? pair[1] : pair[0];
        }
        if (other) {                         // teleport: break + re-emit
          segments.push(seg);
          seg = [{ x: other.x, y: other.y }];
          pos = { x: other.x, y: other.y };
          continue;
        }
        // unpaired portal behaves like empty space (falls through)
      }
      pos = { x: nx, y: ny };               // empty / exit: pass straight through
    }

    segments.push(seg);
    return { segments, activated };
  }

  function crystalsStatus(state, trace) {
    return state.crystals.map((c) => ({
      x: c.x, y: c.y, active: trace.activated.has(c.x + ',' + c.y),
    }));
  }

  function allCrystalsActive(state, trace) {
    return state.crystals.every((c) => trace.activated.has(c.x + ',' + c.y));
  }

  return {
    DIRS, REFLECT, EMITTER_DIRS,
    isMirror, isPortal, parseLevel, traceBeam,
    crystalsStatus, allCrystalsActive,
  };
});

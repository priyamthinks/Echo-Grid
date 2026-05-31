// main.js — browser glue for Echo Grid: state, input, rendering, persistence.
// Pure rules live in engine.js; level data in levels.js. This file only deals
// with the canvas, the DOM HUD, animation, and localStorage progress.
(function () {
  'use strict';

  const E = window.EchoEngine;
  const LEVELS = window.LEVELS;

  const CELL = 48;                 // pixel size of one grid tile
  const REVEAL_MS = 420;           // beam "travel" reveal duration after a change
  const STORE_KEY = 'echoGrid.unlocked';

  const COLORS = {
    bg: '#070a12',
    grid: 'rgba(80, 120, 180, 0.10)',
    wall: '#141d31',
    wallEdge: '#26365a',
    beam: '#7df9ff',
    crystalOff: '#37506f',
    crystalOn: '#5effc8',
    absorber: '#ff6a86',
    player: '#ffce6b',
    exitClosed: '#ff6a86',
    exitOpen: '#5effc8',
    portal: ['#ff8ad8', '#8affd8', '#ffd86b', '#b79bff', '#7df9ff'],
  };

  // ---- DOM handles -------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const el = (id) => document.getElementById(id);
  const ui = {
    levelNum: el('levelNum'), levelName: el('levelName'),
    moveCount: el('moveCount'), moveLimit: el('moveLimit'),
    crystalCount: el('crystalCount'), crystalDots: el('crystalDots'),
    restartBtn: el('restartBtn'), nextBtn: el('nextBtn'),
    levelSelect: el('levelSelect'),
    overlay: el('overlay'), overlayTitle: el('overlayTitle'),
    overlayBody: el('overlayBody'), overlayNext: el('overlayNext'),
    overlayRestart: el('overlayRestart'),
  };

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let G = null;                    // active game state (see loadLevel)
  let unlocked = loadUnlocked();   // highest reachable level index (0-based)

  // ---- persistence -------------------------------------------------------
  function loadUnlocked() {
    try {
      const v = parseInt(localStorage.getItem(STORE_KEY) || '0', 10);
      return Number.isFinite(v) ? Math.max(0, Math.min(LEVELS.length - 1, v)) : 0;
    } catch (e) { return 0; }
  }
  function saveUnlocked() {
    try { localStorage.setItem(STORE_KEY, String(unlocked)); } catch (e) { /* ignore */ }
  }

  // ---- level lifecycle ---------------------------------------------------
  function loadLevel(index) {
    index = Math.max(0, Math.min(LEVELS.length - 1, index));
    const def = LEVELS[index];
    const state = E.parseLevel(def);
    G = {
      index, def, state,
      facing: state.emitter ? state.emitter.dir : 'right',
      won: false,
      overlayType: null,
      trace: null,
      allActive: false,
      beamStart: performance.now(),
      flashAt: 0,                  // timestamp of last crystal-activation flash
    };
    retrace();
    resizeCanvas();
    hideOverlay();
    ui.nextBtn.disabled = true;
    updateHUD();
    buildLevelSelect();
  }

  function retrace() {
    const prevActive = G.allActive;
    G.trace = E.traceBeam(G.state);
    G.allActive = E.allCrystalsActive(G.state, G.trace);
    G.beamStart = performance.now();
    if (G.allActive && !prevActive) G.flashAt = performance.now();
  }

  function resizeCanvas() {
    const w = G.state.cols * CELL, h = G.state.rows * CELL;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- player actions ----------------------------------------------------
  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < G.state.cols && y < G.state.rows;
  }
  function walkable(x, y) {
    if (!inBounds(x, y)) return false;
    const ch = G.state.cells[y][x];
    return ch === ' ' || ch === 'G';   // floor or exit gate
  }

  function move(dir) {
    if (!G || G.won) return;
    G.facing = dir;                     // facing updates even if blocked
    const d = E.DIRS[dir];
    const p = G.state.player;
    if (walkable(p.x + d.x, p.y + d.y)) {  // walking is free (no move cost)
      p.x += d.x; p.y += d.y;
      checkExit();
    }
    updateHUD();
  }

  // Pick which mirror Space should rotate: the tile the player faces, else the
  // single adjacent mirror if there is exactly one (forgiving fallback).
  function targetMirrorCell() {
    const s = G.state, p = s.player, f = E.DIRS[G.facing];
    const fx = p.x + f.x, fy = p.y + f.y;
    if (inBounds(fx, fy) && E.isMirror(s.cells[fy][fx])) return { x: fx, y: fy };
    const adj = [];
    for (const k in E.DIRS) {
      const d = E.DIRS[k], ax = p.x + d.x, ay = p.y + d.y;
      if (inBounds(ax, ay) && E.isMirror(s.cells[ay][ax])) adj.push({ x: ax, y: ay });
    }
    return adj.length === 1 ? adj[0] : null;
  }

  function rotate() {
    if (!G || G.won) return;
    const s = G.state;
    const cell = targetMirrorCell();
    if (!cell) return;                  // nothing to rotate, no move spent
    if (s.movesUsed >= s.limit) { showOverlay('moves'); return; }
    const ch = s.cells[cell.y][cell.x];
    s.cells[cell.y][cell.x] = ch === '/' ? '\\' : '/';
    s.movesUsed++;
    retrace();
    updateHUD();
    if (s.movesUsed >= s.limit && !G.allActive) showOverlay('moves');
  }

  function checkExit() {
    const s = G.state;
    if (s.exit && s.player.x === s.exit.x && s.player.y === s.exit.y && G.allActive) {
      winLevel();
    }
  }

  function winLevel() {
    G.won = true;
    if (G.index + 1 > unlocked) { unlocked = G.index + 1; saveUnlocked(); }
    buildLevelSelect();
    showOverlay('win');
  }

  function nextLevel() {
    if (!G || !G.won) return;
    if (G.index + 1 < LEVELS.length) loadLevel(G.index + 1);
    else showOverlay('all');
  }

  // ---- HUD / overlays / level select ------------------------------------
  function updateHUD() {
    const s = G.state;
    ui.levelNum.textContent = G.index + 1;
    ui.levelName.textContent = G.def.name;
    ui.moveCount.textContent = s.movesUsed;
    ui.moveLimit.textContent = s.limit;
    const status = E.crystalsStatus(s, G.trace);
    const on = status.filter((c) => c.active).length;
    ui.crystalCount.textContent = on + '/' + status.length;
    ui.crystalDots.innerHTML = status
      .map((c) => '<i class="' + (c.active ? 'on' : '') + '"></i>').join('');
    ui.nextBtn.disabled = !(G.won && G.index + 1 < LEVELS.length);
  }

  function buildLevelSelect() {
    ui.levelSelect.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const b = document.createElement('button');
      b.textContent = i + 1;
      b.title = lvl.name;
      if (i === G.index) b.classList.add('current');
      if (i > unlocked) { b.classList.add('locked'); b.disabled = true; }
      b.addEventListener('click', () => { if (i <= unlocked) loadLevel(i); });
      ui.levelSelect.appendChild(b);
    });
  }

  function showOverlay(type) {
    G.overlayType = type;
    ui.overlay.classList.remove('hidden');
    const moreLevels = G.index + 1 < LEVELS.length;
    if (type === 'win') {
      ui.overlayTitle.textContent = 'Room Cleared';
      const n = G.state.movesUsed;
      ui.overlayBody.textContent =
        '“' + G.def.name + '” solved in ' + n + ' move' + (n === 1 ? '' : 's') + '.';
      ui.overlayNext.classList.toggle('hidden', !moreLevels);
      ui.overlayNext.textContent = 'Next Room (N)';
      ui.overlayRestart.textContent = 'Replay (R)';
    } else if (type === 'moves') {
      ui.overlayTitle.textContent = 'Out of Moves';
      ui.overlayBody.textContent =
        'The crystals are not all powered. Restart and find a tighter solution.';
      ui.overlayNext.classList.add('hidden');
      ui.overlayRestart.textContent = 'Restart (R)';
    } else if (type === 'all') {
      ui.overlayTitle.textContent = 'Grid Silenced';
      ui.overlayBody.textContent = 'Every room is cleared. You escaped the Echo Grid.';
      ui.overlayNext.classList.add('hidden');
      ui.overlayRestart.textContent = 'Play Again (R)';
    }
  }
  function hideOverlay() {
    G.overlayType = null;
    ui.overlay.classList.add('hidden');
  }

  // ---- rendering ---------------------------------------------------------
  const px = (gx) => gx * CELL + CELL / 2;   // grid coord -> pixel center
  const py = (gy) => gy * CELL + CELL / 2;

  function frame(now) {
    draw(now);
    requestAnimationFrame(frame);
  }

  function draw(now) {
    const s = G.state;
    const w = s.cols * CELL, h = s.rows * CELL;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    drawGridLines(w, h);

    // static / animated tiles
    for (let y = 0; y < s.rows; y++) {
      for (let x = 0; x < s.cols; x++) {
        drawTile(s.cells[y][x], x, y, now);
      }
    }

    drawBeam(now);
    drawEmitter(s.emitter, now);
    drawPlayer(now);
  }

  function drawGridLines(w, h) {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += CELL) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = 0; y <= h; y += CELL) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
  }

  function drawTile(ch, x, y, now) {
    if (ch === '#') return drawWall(x, y);
    if (ch === 'G') return drawExit(x, y, now);
    if (ch === 'C') return drawCrystal(x, y, now);
    if (ch === 'A') return drawAbsorber(x, y, now);
    if (E.isMirror(ch)) return drawMirror(ch, x, y);
    if (E.isPortal(ch)) return drawPortal(ch, x, y, now);
  }

  function drawWall(x, y) {
    const gx = x * CELL, gy = y * CELL;
    ctx.fillStyle = COLORS.wall;
    roundRect(gx + 2, gy + 2, CELL - 4, CELL - 4, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.wallEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawMirror(ch, x, y) {
    const cx = px(x), cy = py(y), r = CELL * 0.34;
    // faint glass panel
    ctx.fillStyle = 'rgba(125, 249, 255, 0.06)';
    roundRect(x * CELL + 7, y * CELL + 7, CELL - 14, CELL - 14, 8);
    ctx.fill();
    // glowing diagonal
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = COLORS.beam;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#bfefff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (ch === '/') { ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); }
    else { ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); }
    ctx.stroke();
    ctx.restore();
  }

  function drawCrystal(x, y, now) {
    const cx = px(x), cy = py(y);
    const active = G.trace.activated.has(x + ',' + y);
    const pulse = active ? 0.6 + 0.4 * Math.sin(now / 220) : 0;
    const r = CELL * 0.26 * (active ? 1 + 0.06 * Math.sin(now / 220) : 1);
    ctx.save();
    if (active) { ctx.shadowColor = COLORS.crystalOn; ctx.shadowBlur = 12 + 10 * pulse; }
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
    ctx.fillStyle = active ? COLORS.crystalOn : 'rgba(55, 80, 111, 0.35)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? '#d9fff2' : COLORS.crystalOff;
    ctx.stroke();
    ctx.restore();
  }

  function drawAbsorber(x, y, now) {
    const cx = px(x), cy = py(y), r = CELL * 0.28;
    ctx.save();
    ctx.fillStyle = '#0a0d14';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.absorber;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.absorber; ctx.shadowBlur = 8;
    // inward "teeth" that slowly rotate to read as a void
    const t = now / 900;
    for (let i = 0; i < 8; i++) {
      const a = t + (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPortal(ch, x, y, now) {
    const cx = px(x), cy = py(y);
    const color = COLORS.portal[(ch.charCodeAt(0) - 49) % COLORS.portal.length];
    const t = now / 600;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 2; i++) {
      const r = CELL * (0.18 + i * 0.1) + Math.sin(t + i) * 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, t + i, t + i + Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy);
    ctx.restore();
  }

  function drawExit(x, y, now) {
    const gx = x * CELL, gy = y * CELL;
    const open = G.allActive;
    const color = open ? COLORS.exitOpen : COLORS.exitClosed;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (open) { ctx.shadowColor = color; ctx.shadowBlur = 12 + 6 * Math.sin(now / 260); }
    roundRect(gx + 6, gy + 6, CELL - 12, CELL - 12, 7);
    ctx.stroke();
    const cx = px(x), cy = py(y);
    if (open) {
      // upward "open gate" chevron
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy + 5); ctx.lineTo(cx, cy - 6); ctx.lineTo(cx + 7, cy + 5);
      ctx.stroke();
    } else {
      // locked bars
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) { ctx.moveTo(cx + i * 6, cy - 7); ctx.lineTo(cx + i * 6, cy + 7); }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEmitter(em, now) {
    if (!em) return;
    const cx = px(em.x), cy = py(em.y);
    const d = E.DIRS[em.dir];
    ctx.save();
    ctx.shadowColor = COLORS.beam;
    ctx.shadowBlur = 16 + 6 * Math.sin(now / 200);
    ctx.fillStyle = '#0a1622';
    ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.beam; ctx.lineWidth = 2.5; ctx.stroke();
    // direction nub
    ctx.fillStyle = COLORS.beam;
    ctx.beginPath();
    ctx.arc(cx + d.x * CELL * 0.2, cy + d.y * CELL * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(now) {
    const p = G.state.player;
    if (!p) return;
    const cx = px(p.x), cy = py(p.y);
    const d = E.DIRS[G.facing];
    ctx.save();
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS.player;
    roundRect(cx - 10, cy - 10, 20, 20, 6);
    ctx.fill();
    // facing tick
    ctx.fillStyle = '#3a2a06';
    ctx.beginPath();
    ctx.arc(cx + d.x * 6, cy + d.y * 6, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Beam: build pixel polylines, reveal them with a travel animation, then
  // draw a glow pass + a moving dashed core for the "sound flowing" feel.
  function drawBeam(now) {
    const segs = G.trace.segments;
    const polys = segs.map((s) => s.map((pt) => ({ x: px(pt.x), y: py(pt.y) })));

    const total = polys.reduce((sum, poly) => sum + polyLength(poly), 0);
    const prog = Math.min(1, (now - G.beamStart) / REVEAL_MS);
    const ease = 1 - Math.pow(1 - prog, 3);
    const revealed = truncatePolys(polys, total * ease);

    // glow pass
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = COLORS.beam;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.30)';
    ctx.lineWidth = 9;
    strokePolys(revealed);
    // bright core with moving dashes
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#eafdff';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 16]);
    ctx.lineDashOffset = -(now / 28) % 1000;
    strokePolys(revealed);
    ctx.setLineDash([]);
    ctx.restore();

    // bright head while the beam is still revealing
    if (prog < 1) {
      const head = polyHead(revealed);
      if (head) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = COLORS.beam; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(head.x, head.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function strokePolys(polys) {
    for (const poly of polys) {
      if (poly.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.stroke();
    }
  }

  function polyLength(poly) {
    let len = 0;
    for (let i = 1; i < poly.length; i++) len += dist(poly[i - 1], poly[i]);
    return len;
  }

  // Trim a list of polylines so their combined length is at most `maxLen`.
  function truncatePolys(polys, maxLen) {
    const out = [];
    let budget = maxLen;
    for (const poly of polys) {
      if (budget <= 0) break;
      const np = [poly[0]];
      for (let i = 1; i < poly.length; i++) {
        const a = poly[i - 1], b = poly[i];
        const segLen = dist(a, b);
        if (segLen <= budget) { np.push(b); budget -= segLen; }
        else {
          const t = segLen ? budget / segLen : 0;
          np.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          budget = 0;
          break;
        }
      }
      out.push(np);
    }
    return out;
  }

  function polyHead(polys) {
    for (let i = polys.length - 1; i >= 0; i--) {
      const p = polys[i];
      if (p && p.length) return p[p.length - 1];
    }
    return null;
  }

  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- input -------------------------------------------------------------
  const KEYMAP = {
    arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
    arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
  };

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (KEYMAP[k]) { e.preventDefault(); move(KEYMAP[k]); return; }
    if (k === ' ' || e.code === 'Space') { e.preventDefault(); rotate(); return; }
    if (k === 'r') { e.preventDefault(); loadLevel(G.index); return; }
    if (k === 'n') { e.preventDefault(); nextLevel(); return; }
  });

  ui.restartBtn.addEventListener('click', () => loadLevel(G.index));
  ui.nextBtn.addEventListener('click', nextLevel);
  ui.overlayNext.addEventListener('click', nextLevel);
  ui.overlayRestart.addEventListener('click', () => {
    if (G.overlayType === 'all') loadLevel(0);
    else loadLevel(G.index);
  });

  // On-screen touch controls (mobile). pointerdown covers touch + mouse and
  // fires once per press; preventDefault stops scroll / double-tap zoom.
  function bindHold(id, fn) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  }
  bindHold('touchUp', () => move('up'));
  bindHold('touchDown', () => move('down'));
  bindHold('touchLeft', () => move('left'));
  bindHold('touchRight', () => move('right'));
  bindHold('touchRotate', () => rotate());

  // ---- boot --------------------------------------------------------------
  loadLevel(unlocked);             // resume at the player's frontier room
  requestAnimationFrame(frame);
})();

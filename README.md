# Echo Grid

A 2D browser puzzle game. You are trapped inside ancient **sound-powered ruins**.
Each room has a sound emitter, crystals, mirrors, walls, absorbers, portals and an
exit gate. Redirect the sound beam so every required crystal is powered — the exit
opens, and you walk free.

Built with plain **HTML + CSS + Canvas + JavaScript**. No libraries, no build step.

**▶ Play online:** https://priyamthinks.github.io/Echo-Grid/
(or just open `index.html` in any modern browser)

Works on **desktop and mobile** — keyboard on desktop, an on-screen D-pad +
rotate button on touch screens.

## How to play

**Desktop**

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / Arrow keys | Move the player |
| `Space` | Rotate the mirror you are facing |
| `R` | Restart the room |
| `N` | Next room (after clearing the current one) |

**Mobile** — use the on-screen D-pad to move and the **⟳** button to rotate the
mirror you are facing. Restart / Next buttons are below the board.

- The **emitter** fires a glowing beam in a fixed direction.
- Walk next to a **mirror**, face it, and press `Space` to flip it between `/` and `\`.
- The beam reflects off mirrors, **passes through crystals** (powering them),
  is **destroyed by absorbers**, and **teleports between paired portals**.
- When **all** crystals are powered the **exit gate** opens. Step on it to win.
- **Walking is free** — only mirror rotations count against the **move budget**,
  so each room rewards an efficient solution.

## Tiles

| Glyph | Tile | Behaviour |
| --- | --- | --- |
| ` ` `.` | Empty | Sound and player pass through |
| `#` | Wall | Blocks sound and player |
| `/` `\` | Mirror | Reflects sound; player rotates these |
| `C` | Crystal | Must be hit by sound (beam passes through) |
| `A` | Absorber | Destroys the sound beam |
| `1`–`9` | Portal pair | Two cells share a digit; sound teleports |
| `>` `<` `^` `v` | Emitter | Beam source + direction |
| `G` | Exit gate | Opens when every crystal is powered |
| `@` | Player start | |

## Project structure

The code keeps **rules separate from rendering and from level data**:

```
index.html    page, HUD, canvas
style.css     neon sci-fi ruins theme
engine.js     pure simulation (parse level, trace beam) — no DOM
levels.js     handcrafted levels as ASCII maps (data only)
main.js       browser glue: input, rendering, animation, HUD, localStorage
verify.js     node: validates every level is solvable & reachable
test-game.js  node: integration tests for the core rules
smoke.js      node: runs main.js under a stubbed DOM (end-to-end check)
README.md     this file
.github/workflows/pages.yml   deploys the site to GitHub Pages
```

## Editing / adding levels

Levels are plain data in `levels.js` — just edit the ASCII grid. Example:

```js
{
  name: 'First Light',
  moves: 3,                 // rotation budget
  grid: [
    '#########',
    '#   C   #',
    '#       #',
    '#>  \\   #',           // '>' emitter, '\' mirror
    '#       #',
    '#  @  G #',            // '@' player, 'G' exit
    '#########',
  ],
}
```

Rules of thumb: rows must all be the same width, each portal digit must appear
exactly twice, and every level needs one emitter, one player and one exit.

After editing, validate everything stays solvable:

```
node verify.js      # every level: solvable, reachable, not pre-solved, in budget
node test-game.js   # core rules (reflection, gating, restart, progression)
node smoke.js       # boots the real main.js under a stubbed DOM
```

## How the beam works (engine.js)

`traceBeam()` walks the beam cell by cell from the emitter:

- **wall / edge** → stop, **absorber** → stop, **crystal** → mark active + continue,
  **mirror** → look up the new direction in a reflection table, **portal** → jump to
  the paired cell and continue.
- A `(cell, direction)` visited-set plus a step cap make portal/mirror **loops**
  terminate safely.
- It returns drawable beam **segments** (portals split the line) and the set of
  **activated crystals**, which `main.js` renders and uses to open the gate.

## Progress

The furthest room you reach is saved in `localStorage` (`echoGrid.unlocked`), so the
game resumes at your frontier and the room selector unlocks as you advance.

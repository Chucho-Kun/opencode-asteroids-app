# AGENTS.md

Zero-dependency HTML5 Canvas clone of arcade Asteroids. No package manager, bundler, framework, tests, or build step.

## Run

```bash
npx serve .   # then http://localhost:3000
# or open index.html directly in browser
```

No `package.json`, no `opencode.json`, no CI/lint/typecheck. Do not add tooling unless requested.

## Structure

- `index.html` — canvas `800×600` (`#canvas`), loads `game.js` via `<script>` tag, minimal inline CSS (black bg, centered canvas)
- `game.js` — entire game in one file (~423 lines, `'use strict'`), no modules/exports
- `favicon.svg` — static icon

## Architecture (`game.js`)

- Constants: `W=800`, `H=600`, toroidal wrap via `wrap(v,max)` (`((v % max)+max)%max`)
- Classes: `Bullet` (520 px/s, TTL 1.1s), `Asteroid` (sizes 3/2/1 → radii 50/30/16, speeds 32/55/85, points 20/50/100, random irregular polygon), `Ship` (rotation 3.5 rad/s, thrust 260 px/s², drag 0.987, invincibility 3s with blink, shoot cooldown 0.2s), `Particle` (explosion trails)
- Game state machine: `state = 'playing'|'dead'|'gameover'` — `initGame()` spawns 4 large asteroids, `nextLevel()` spawns `3+level`, `deadTimer=2s` before `ship.reset()`, `gameover` restarts on Space
- Input: `keys`/`justPressed` maps keyed by `e.code` (Space, Arrow*); `pressed()` consumes `justPressed` (one-shot for shooting/restart), `preventDefault()` on Space/arrows
- Loop: `requestAnimationFrame(loop)` with `dt` clamped to 0.05s; `update` → `draw`; HUD + `GAME OVER` overlay in canvas

## Conventions

- UI text is Spanish (`NIVEL`, `SCORE`, `PUNTAJE`, `ESPACIO PARA REINICIAR`); keep it.
- Keep `game.js` as single global script — no ES modules, no imports, no bundler.
- Canvas style: white `monospace` on black, `strokeStyle #fff`, `lineWidth 1.5`.
- Asteroid spawn avoids center (`SAFE_DIST=130` from `W/2,H/2`).

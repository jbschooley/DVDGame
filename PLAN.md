# DVD Game — Implementation Plan

## Overview

A browser game built with HTML/CSS/TypeScript/Vite. A DVD logo bounces diagonally across a rectangular canvas. The player controls the logo's direction with arrow keys, trying to land corner hits for points within a 60-second timer.

---

## Project Structure

```
DvdGame/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts        # Entry point — mounts game, wires up input
    ├── game.ts        # Game loop, state machine, scoring, timer
    ├── logo.ts        # DVD logo entity: position, direction, movement
    └── style.css      # Layout, canvas styling, HUD, overlays
```

---

## Setup

- `npm create vite@latest . -- --template vanilla-ts` (in project root)
- Node 22 is available via devbox (`devbox.json` already has `nodejs@22`)
- No additional runtime dependencies — only Vite as dev dep
- `npm run dev` to develop, `npm run build` for production bundle

---

## Canvas & Layout

- **Canvas element**: `<canvas id="game">` responsive, filling the entire browser window.
- Dark background.
- HUD overlaid on the canvas: Score (left), Time remaining (center), Speed (right).
- Four corner indicators (small squares in each canvas corner) drawn directly on the canvas; they highlight red when that corner is "locked out".

---

## DVD Logo

- Drawn on the 2D canvas context (no DOM element for the logo itself).
- Dimensions: **150×75 px** (2:1 ratio, mimicking the real logo's proportions).
- Rendered procedurally as a filled rounded rectangle with "DVD" text (bold, sans-serif, italicized, and centered).
- **Color**: cycles through a palette of ~8 colors each time it bounces off an edge (classic screensaver behavior).

---

## Movement System

### Direction

Direction is stored as `{ dx: ±1, dy: ±1 }` — always perfectly diagonal.

| State | dx | dy |
|---|---|---|
| Northeast | +1 | -1 |
| Southeast | +1 | +1 |
| Southwest | -1 | +1 |
| Northwest | -1 | -1 |

### Speed

- **Initial speed**: `canvasWidth / 8` px/s so the logo crosses the canvas in ~8 s (≈112 px/s for a 900px canvas)
- Speed is a scalar applied equally to both axes (dx and dy), preserving perfect diagonality
- **Speed increase**: +10 px/s each time the logo bounces off any edge (wall or corner). On canvas resize, current speed and speed increment are scaled proportionally to the new canvas size.

### Update each frame (game loop)

```
position.x += dx * speed * deltaTime
position.y += dy * speed * deltaTime
```

Then clamp and bounce (see Collision below).

---

## Controls

Movement is controlled by changing one component of direction, keeping movement diagonal:

| Key/Gesture | Effect |
|---|---|
| Right (`→` / `D` / Swipe Right) | `dx = +1` |
| Left (`←` / `A` / Swipe Left) | `dx = -1` |
| Up (`↑` / `W` / Swipe Up) | `dy = -1` |
| Down (`↓` / `S` / Swipe Down) | `dy = +1` |

Examples:
- Moving NW, press Right → NE
- Moving NE, press Down → SE
- Moving SW, press Up → NW

Prevent default browser scroll behavior on arrow keys and WASD. Implement touch listeners for swipe detection using a lightweight library.

---

## Collision Detection & Bouncing

Each frame, after updating position, check bounds. Logo occupies `[x, x+logoW] × [y, y+logoH]`.

```
hitLeft   = x < 0
hitRight  = x + logoW > canvasW
hitTop    = y < 0
hitBottom = y + logoH > canvasH
```

- If `hitLeft || hitRight`: flip `dx`, clamp x into bounds, **score check**, increment speed
- If `hitTop || hitBottom`: flip `dy`, clamp y into bounds, **score check**, increment speed
- If both axes hit simultaneously (true corner): both flip, single speed increment, single score check

---

## Scoring System

### When to score

After a wall bounce, run a corner proximity check.

### Which canvas corner to check

Determine the "approached corner" from the logo's direction **before** the bounce:

| dx (before) | dy (before) | Canvas corner |
|---|---|---|
| +1 | -1 | Top-right: `(canvasW, 0)` |
| +1 | +1 | Bottom-right: `(canvasW, canvasH)` |
| -1 | +1 | Bottom-left: `(0, canvasH)` |
| -1 | -1 | Top-left: `(0, 0)` |

For single-wall bounces (only one axis hit), use the same table — the "approached corner" is still unambiguous because the other component of direction is known.

### Distance calculation

Find the minimum Euclidean distance from any of the **four logo corners** to the target canvas corner:

```
logoCorners = [
  (x, y),           // top-left
  (x + logoW, y),   // top-right
  (x, y + logoH),   // bottom-left
  (x + logoW, y + logoH) // bottom-right
]

distance = min(euclidean(logoCorner, canvasCorner) for each logoCorner)
```

### Point formula

Linear interpolation: 200 pts for a direct hit (distance = 0), 1 pt at distance = 50 px, 0 pts beyond 50 px.

```
if distance > 50: points = 0
else: points = Math.round(1 + (50 - distance) / 50 * 199)
```

At d=0: `1 + 199 = 200` ✓
At d=50: `1 + 0 = 1` ✓

### Corner lockout

- When a corner earns points (distance ≤ 50), mark that corner as **locked** (highlighted red on canvas and in corner indicators). A locked corner continues to earn 0 points until a different corner is hit.
- Hitting a different corner clears the lock on the previous corner and locks the new one

---

## Game State Machine

```
IDLE → PLAYING → GAME_OVER
```

- **IDLE**: Show a start screen overlay ("Press Space or Enter to start")
- **PLAYING**: Game loop runs, timer counts down from 60 s
- **GAME_OVER**: Show overlay with final score and "Press Space or Enter to restart"

---

## Timer

- 60-second countdown displayed in the HUD
- When timer reaches 0, transition to GAME_OVER
- Timer displayed as `MM:SS` or just seconds (e.g., `0:45`)

---

## HUD

Drawn as styled HTML elements overlaid on the canvas container (not on the canvas itself):

```
[ Score: 1240 ]   [ 0:42 ]   [ Speed: 152 ]
[              CANVAS                      ]
```

---

## Visual Polish

- **Corner indicators**: Four small squares (10×10 px) drawn at the actual canvas corners, colored green normally, red when locked.
- **Score popup**: When points are earned, briefly draw `+N` floating near the canvas corner using a canvas-based fade/float animation.
- **Color palette**: Logo cycles through `[#FF6B6B, #FFD93D, #6BCB77, #4D96FF, #C77DFF, #FF9F1C, #00B4D8, #FFFFFF]`.
- **Speed display**: Shows current px/s in HUD so the player can see acceleration.
- **Game over screen**: Shows final score, high score (stored in `localStorage`), restart prompt.

---

## Implementation Order

1. **Vite project scaffold** — `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
2. **Canvas + HUD layout** — `index.html`, `style.css`
3. **Logo entity** (`logo.ts`) — position, direction, speed, draw method
4. **Game loop** (`game.ts`) — `requestAnimationFrame`, delta time, movement update, wall collision, bounce
5. **Arrow key input** — direction change handlers
6. **Scoring** — corner detection, point formula, lockout system
7. **Timer** — 60-second countdown, game over trigger
8. **State machine** — IDLE / PLAYING / GAME_OVER overlays
9. **Visual polish** — color cycling, score popups, corner indicators, high score

---

## Key Constants (tunable)

```typescript
const LOGO_W = 150;
const LOGO_H = 75;
const INITIAL_SPEED = canvasWidth / 8; // px/s — dynamically calculated at load time
const SPEED_INCREMENT = INITIAL_SPEED / 11.2; // px/s per edge hit (~10 for 900px width)
const GAME_DURATION = 60;            // seconds
const CORNER_THRESHOLD = 50;         // px — max distance for points
const MAX_POINTS = 200;
const MIN_POINTS = 1;
```

---

## Clarifications (2026-04-16)

1. **Touch/swipe library**: Use [Hammer.js](https://hammerjs.github.io/) for swipe detection (add as a dependency).
2. **Initial speed**: Dynamically calculated as `canvasWidth / 8` at load time (larger screens = faster logo).
3. **Speed increment scaling**: On canvas resize, **both** the current speed AND the speed increment scale proportionally to the new canvas size.
4. **Score popup on 0-point hits**: Show the `+0` popup when a corner hit earns 0 points (distance > 50).
5. **Corner lockout on re-hit**: When the player hits an already-locked corner again, just bounce and award 0 points — no additional behavior.
6. **High score**: Single global high score stored in `localStorage` (key: `dvdGameHighScore`).

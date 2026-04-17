import { Game } from './game.js';

// ── DOM elements ────────────────────────────────────────────────────

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudScore = document.getElementById('hud-score') as HTMLElement;
const hudTimer = document.getElementById('hud-timer') as HTMLElement;
const hudSpeed = document.getElementById('hud-speed') as HTMLElement;
const overlay = document.getElementById('overlay') as HTMLElement;
const overlayContent = document.getElementById('overlay-content') as HTMLElement;

// ── Initialize game ────────────────────────────────────────────────

const game = new Game(canvas, hudScore, hudTimer, hudSpeed, overlay, overlayContent);

// ── Keyboard input ─────────────────────────────────────────────────

const keyMap = new Map<string, { dx: number; dy: number }>();
keyMap.set('ArrowRight', { dx: 1, dy: 0 });
keyMap.set('ArrowLeft', { dx: -1, dy: 0 });
keyMap.set('ArrowUp', { dx: 0, dy: -1 });
keyMap.set('ArrowDown', { dx: 0, dy: 1 });
keyMap.set('d', { dx: 1, dy: 0 });
keyMap.set('a', { dx: -1, dy: 0 });
keyMap.set('w', { dx: 0, dy: -1 });
keyMap.set('s', { dx: 0, dy: 1 });
keyMap.set('D', { dx: 1, dy: 0 });
keyMap.set('A', { dx: -1, dy: 0 });
keyMap.set('W', { dx: 0, dy: -1 });
keyMap.set('S', { dx: 0, dy: 1 });

const scrollingKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);

document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Prevent scrolling on arrow keys, WASD, and space
  if (scrollingKeys.has(e.key)) {
    e.preventDefault();
  }

  // Start / restart
  if (e.key === ' ' || e.key === 'Enter') {
    if (game.state === 'IDLE' || game.state === 'GAME_OVER') {
      game.start();
    }
    return;
  }

  // Direction change
  const dir = keyMap.get(e.key);
  if (dir && game.state === 'PLAYING') {
    // If dy is 0, keep current dy; if dx is 0, keep current dx
    const logo = (game as any).logo;
    if (logo) {
      const finalDx = dir.dx !== 0 ? dir.dx : logo.dx;
      const finalDy = dir.dy !== 0 ? dir.dy : logo.dy;
      game.setDirection(finalDx, finalDy);
    }
  }
});

// ── Start game function ────────────────────────────────────────────

function startGame(): void {
  if (game.state === 'IDLE' || game.state === 'GAME_OVER') {
    game.start();
  }
}

// ── Tap / click to start ───────────────────────────────────────────

// Click/tap on overlay to start
overlay.addEventListener('pointerdown', (e: PointerEvent) => {
  // Only handle if clicking on the overlay itself, not the canvas underneath
  if (e.target === overlay || (e.target as HTMLElement).closest('#overlay-content')) {
    e.preventDefault();
    e.stopPropagation();
    startGame();
  }
});

// ── Swipe input (native touch events) ──────────────────────────────

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
const SWIPE_THRESHOLD = 30; // minimum distance in px
const SWIPE_MAX_TIME = 500; // maximum time in ms

canvas.addEventListener('touchstart', (e: TouchEvent) => {
  if (!game.isPlaying()) return;
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
}, { passive: true });

canvas.addEventListener('touchend', (e: TouchEvent) => {
  if (!game.isPlaying()) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  const elapsed = Date.now() - touchStartTime;

  if (elapsed > SWIPE_MAX_TIME) return;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return; // too short

  const logo = (game as any).logo;
  if (!logo) return;

  if (absDx > absDy) {
    // Horizontal swipe
    game.setDirection(dx > 0 ? 1 : -1, logo.dy);
  } else {
    // Vertical swipe
    game.setDirection(logo.dx, dy > 0 ? 1 : -1);
  }
}, { passive: true });

// ── Tap/click on canvas to start (when overlay is hidden) ─────────
canvas.addEventListener('click', () => {
  if (game.state === 'IDLE' || game.state === 'GAME_OVER') {
    startGame();
  }
});

// Initial draw for IDLE state (shows overlay)
game.showOverlay();
game.draw();
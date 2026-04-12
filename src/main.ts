import Hammer from 'hammerjs';
import { Game, GameState } from './game';

const game = new Game();
const hammer = new Hammer(document.getElementById('game')!);

// Keyboard Input
window.addEventListener('keydown', (e) => {
  // Prevent scrolling on game keys
  const scrollKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
  if (scrollKeys.includes(e.key)) {
    e.preventDefault();
  }

  switch (e.key) {
    case 'ArrowRight':
    case 'd':
    case 'D':
      game.setDx(1);
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      game.setDx(-1);
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      game.setDy(-1);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      game.setDy(1);
      break;
    case ' ':
    case 'Enter':
      if (game.state !== GameState.PLAYING) {
        game.start();
      }
      break;
  }
}, { passive: false });

// Mouse/Touch Input to start
const handleStart = (e: Event) => {
  if (game.state !== GameState.PLAYING) {
    game.start();
  }
};

window.addEventListener('mousedown', handleStart);
window.addEventListener('touchstart', handleStart, { passive: false });

// Swipe Input
hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
hammer.on('swipeleft', () => game.setDx(-1));
hammer.on('swiperight', () => game.setDx(1));
hammer.on('swipeup', () => game.setDy(-1));
hammer.on('swipedown', () => game.setDy(1));

// Initial state
document.getElementById('overlay')!.style.opacity = '1';
document.getElementById('overlay-title')!.textContent = 'DVD GAME';
document.getElementById('overlay-message')!.textContent = 'Press Space or Enter to Start';
document.getElementById('final-score-container')!.style.display = 'none';
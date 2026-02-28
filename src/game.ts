import {
  LOGO_W,
  LOGO_H,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  GAME_DURATION,
  CORNER_THRESHOLD,
  MAX_POINTS,
  MIN_POINTS,
  COLORS
} from './logo.js';

const MAX_CANVAS_W = 900;
const MAX_CANVAS_H = 540;

export type GameStatus = 'IDLE' | 'PLAYING' | 'GAME_OVER';

export interface GameState {
  status: GameStatus;
  score: number;
  timeRemaining: number;
  speed: number;
  lockedCorners: Set<string>;
  highScore: number;
}

export interface ScorePopup {
  x: number;
  y: number;
  points: number;
  opacity: number;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scoreElement: HTMLElement;
  private timerElement: HTMLElement;
  private speedElement: HTMLElement;
  private overlay: HTMLElement;
  private overlayContent: HTMLElement;
  private corners: { [key: string]: HTMLElement };

  private logoX = 0;
  private logoY = 0;
  private logoColorIndex = 0;
  private dx = 1;
  private dy = 1;
  private speed = INITIAL_SPEED;
  private canvasW = MAX_CANVAS_W;
  private canvasH = MAX_CANVAS_H;

  private status: GameStatus = 'IDLE';
  private score = 0;
  private timeRemaining = GAME_DURATION;
  private lockedCorners: Set<string> = new Set();
  private highScore = 0;
  private scorePopups: ScorePopup[] = [];

  private lastTime = 0;
  private animationFrameId: number | null = null;

  // Touch handling
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private lastTapTime = 0;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.scoreElement = document.getElementById('score') as HTMLElement;
    this.timerElement = document.getElementById('timer') as HTMLElement;
    this.speedElement = document.getElementById('speed') as HTMLElement;
    this.overlay = document.getElementById('overlay') as HTMLElement;
    this.overlayContent = document.getElementById('overlay-content') as HTMLElement;
    this.corners = {
      'tl': document.getElementById('corner-tl') as HTMLElement,
      'tr': document.getElementById('corner-tr') as HTMLElement,
      'bl': document.getElementById('corner-bl') as HTMLElement,
      'br': document.getElementById('corner-br') as HTMLElement
    };

    this.setupCanvas();
    this.loadHighScore();
    this.bindInput();
    this.bindTouch();
    this.updateHUD();
    this.updateCornerIndicators();
    this.render();
  }

  private setupCanvas(): void {
    const resize = () => {
      const container = document.getElementById('game-container');
      const wrapper = document.getElementById('game-wrapper');

      const maxWidth = Math.min(MAX_CANVAS_W, window.innerWidth - 20);
      const maxHeight = Math.min(MAX_CANVAS_H, window.innerHeight - 180);

      let w = maxWidth;
      let h = Math.floor(w * (MAX_CANVAS_H / MAX_CANVAS_W));

      if (h > maxHeight) {
        h = maxHeight;
        w = Math.floor(h * (MAX_CANVAS_W / MAX_CANVAS_H));
      }

      this.canvasW = w;
      this.canvasH = h;

      this.canvas.width = w;
      this.canvas.height = h;

      this.logoX = (this.canvasW - LOGO_W) / 2;
      this.logoY = (this.canvasH - LOGO_H) / 2;

      if (container && wrapper) {
        const isMobile = window.innerWidth < 768 || window.innerHeight < 600;
        container.classList.toggle('mobile', isMobile);
      }
    };

    resize();
    window.addEventListener('resize', resize);
  }

  private loadHighScore(): void {
    const stored = localStorage.getItem('dvdHighScore');
    this.highScore = stored ? parseInt(stored, 10) : 0;
  }

  private saveHighScore(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('dvdHighScore', this.highScore.toString());
    }
  }

  private bindInput(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.handleStartOrRestart();
      }

      if (this.status !== 'PLAYING') return;

      switch (e.key) {
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.dx = 1;
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.dx = -1;
          e.preventDefault();
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.dy = -1;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.dy = 1;
          e.preventDefault();
          break;
      }
    });
  }

  private bindTouch(): void {
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = performance.now();
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      const deltaTime = performance.now() - this.touchStartTime;

      const tapThreshold = 10;
      const swipeThreshold = 30;
      const tapMaxTime = 200;

      if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold && deltaTime < tapMaxTime) {
        const now = performance.now();
        if (now - this.lastTapTime > 300) {
          if (this.status !== 'PLAYING') {
            this.handleStartOrRestart();
          }
        }
        this.lastTapTime = now;
        return;
      }

      if (Math.abs(deltaX) > swipeThreshold || Math.abs(deltaY) > swipeThreshold) {
        if (this.status === 'PLAYING') {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            this.dx = deltaX > 0 ? 1 : -1;
          } else {
            this.dy = deltaY > 0 ? 1 : -1;
          }
        }
      }
    }, { passive: false });
  }

  private handleStartOrRestart(): void {
    if (this.status === 'IDLE' || this.status === 'GAME_OVER') {
      this.startGame();
    }
  }

  private startGame(): void {
    this.status = 'PLAYING';
    this.score = 0;
    this.timeRemaining = GAME_DURATION;
    this.speed = INITIAL_SPEED;
    this.dx = 1;
    this.dy = 1;
    this.logoColorIndex = 0;
    this.lockedCorners = new Set();
    this.scorePopups = [];
    this.lastTime = performance.now();

    this.overlay.style.display = 'none';
    this.updateHUD();
    this.updateCornerIndicators();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  private gameLoop(currentTime: number): void {
    if (this.status !== 'PLAYING') return;

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.updateScorePopups(deltaTime);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  private update(deltaTime: number): void {
    // Update timer
    this.timeRemaining -= deltaTime;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.endGame();
      return;
    }

    // Move logo
    this.logoX += this.dx * this.speed * deltaTime;
    this.logoY += this.dy * this.speed * deltaTime;

    // Check collisions
    const hitLeft = this.logoX < 0;
    const hitRight = this.logoX + LOGO_W > this.canvasW;
    const hitTop = this.logoY < 0;
    const hitBottom = this.logoY + LOGO_H > this.canvasH;

    let bounced = false;
    let oldDx = this.dx;
    let oldDy = this.dy;

    if (hitLeft || hitRight) {
      oldDx = this.dx;
      this.dx *= -1;
      bounced = true;
    }

    if (hitTop || hitBottom) {
      oldDy = this.dy;
      this.dy *= -1;
      bounced = true;
    }

    if (bounced) {
      // Calculate approached corner BEFORE clamping
      this.handleBounce(oldDx, oldDy);
    }

    // Clamp after scoring
    this.logoX = Math.max(0, Math.min(this.logoX, this.canvasW - LOGO_W));
    this.logoY = Math.max(0, Math.min(this.logoY, this.canvasH - LOGO_H));

    this.updateHUD();
  }

  private handleBounce(approachedDx: number, approachedDy: number): void {
    // Determine approached corner
    const canvasCorner = this.getCanvasCorner(approachedDx, approachedDy);
    if (!canvasCorner) return;

    // Calculate logo corners
    const logoCorners = this.getLogoCorners();
    const distance = this.getDistanceToCorner(logoCorners, canvasCorner);

    // Check if this corner is already locked
    const cornerKey = this.getCornerKey(canvasCorner.x, canvasCorner.y);
    const isCurrentCornerLocked = this.lockedCorners.has(cornerKey);

    // Calculate points
    let points = 0;
    if (distance <= CORNER_THRESHOLD) {
      points = this.calculatePoints(distance);
      if (!isCurrentCornerLocked) {
        this.score += points;
        this.addScorePopup(canvasCorner.x, canvasCorner.y, points);
        this.lockedCorners.add(cornerKey);
        // Unlock the previous corner
        for (const key of this.lockedCorners) {
          if (key !== cornerKey) {
            this.lockedCorners.delete(key);
          }
        }
      }
    }

    // Increase speed and cycle color
    this.speed += SPEED_INCREMENT;
    this.logoColorIndex = (this.logoColorIndex + 1) % COLORS.length;
    this.updateCornerIndicators();
  }

  private getCanvasCorner(dx: number, dy: number): { x: number; y: number } | null {
    switch (`${dx},${dy}`) {
      case '1,-1':
        return { x: this.canvasW, y: 0 };
      case '1,1':
        return { x: this.canvasW, y: this.canvasH };
      case '-1,1':
        return { x: 0, y: this.canvasH };
      case '-1,-1':
        return { x: 0, y: 0 };
      default:
        return null;
    }
  }

  private getLogoCorners(): { x: number; y: number }[] {
    return [
      { x: this.logoX, y: this.logoY },
      { x: this.logoX + LOGO_W, y: this.logoY },
      { x: this.logoX, y: this.logoY + LOGO_H },
      { x: this.logoX + LOGO_W, y: this.logoY + LOGO_H }
    ];
  }

  private getDistanceToCorner(logoCorners: { x: number; y: number }[], corner: { x: number; y: number }): number {
    return logoCorners.reduce((min, c) => {
      const dx = c.x - corner.x;
      const dy = c.y - corner.y;
      return Math.sqrt(dx * dx + dy * dy) < min ? Math.sqrt(dx * dx + dy * dy) : min;
    }, Infinity);
  }

  private getCornerKey(x: number, y: number): string {
    if (x === 0 && y === 0) return 'tl';
    if (x === this.canvasW && y === 0) return 'tr';
    if (x === 0 && y === this.canvasH) return 'bl';
    if (x === this.canvasW && y === this.canvasH) return 'br';
    return '';
  }

  private calculatePoints(distance: number): number {
    if (distance > CORNER_THRESHOLD) return 0;
    return Math.round(MIN_POINTS + (CORNER_THRESHOLD - distance) / CORNER_THRESHOLD * (MAX_POINTS - MIN_POINTS));
  }

  private addScorePopup(x: number, y: number, points: number): void {
    this.scorePopups.push({
      x,
      y,
      points,
      opacity: 1
    });
  }

  private updateScorePopups(deltaTime: number): void {
    for (const popup of this.scorePopups) {
      popup.opacity -= deltaTime * 2;
    }
    this.scorePopups = this.scorePopups.filter(p => p.opacity > 0);
  }

  private renderScorePopups(): void {
    for (const popup of this.scorePopups) {
      this.ctx.globalAlpha = popup.opacity;
      this.ctx.fillStyle = '#FFD93D';
      this.ctx.font = 'bold 24px Arial, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`+${popup.points}`, popup.x, popup.y - 30);
      this.ctx.globalAlpha = 1;
    }
  }

  private endGame(): void {
    this.status = 'GAME_OVER';
    this.saveHighScore();

    this.overlayContent.innerHTML = `
      <h1>Game Over</h1>
      <p class="final-score">Score: ${this.score}</p>
      <p class="high-score">High Score: ${this.highScore}</p>
      <p>Press Space or Enter to restart</p>
    `;
    this.overlay.style.display = 'flex';
    this.updateHUD();
  }

  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#0f0f23';
    this.ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    // Draw logo
    this.ctx.fillStyle = COLORS[this.logoColorIndex];
    const radius = 10;
    const x = this.logoX;
    const y = this.logoY;

    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + LOGO_W - radius, y);
    this.ctx.quadraticCurveTo(x + LOGO_W, y, x + LOGO_W, y + radius);
    this.ctx.lineTo(x + LOGO_W, y + LOGO_H - radius);
    this.ctx.quadraticCurveTo(x + LOGO_W, y + LOGO_H, x + LOGO_W - radius, y + LOGO_H);
    this.ctx.lineTo(x + radius, y + LOGO_H);
    this.ctx.quadraticCurveTo(x, y + LOGO_H, x, y + LOGO_H - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw "DVD" text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 28px Arial, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('DVD', x + LOGO_W / 2, y + LOGO_H / 2);

    // Draw score popups
    this.renderScorePopups();
  }

  private updateHUD(): void {
    this.scoreElement.textContent = `Score: ${this.score}`;
    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = Math.floor(this.timeRemaining % 60);
    this.timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    this.speedElement.textContent = `Speed: ${Math.round(this.speed)}`;
  }

  private updateCornerIndicators(): void {
    for (const [key, element] of Object.entries(this.corners)) {
      if (this.lockedCorners.has(key)) {
        element.classList.add('locked');
      } else {
        element.classList.remove('locked');
      }
    }
  }
}
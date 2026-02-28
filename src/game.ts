import {
  CANVAS_W,
  CANVAS_H,
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

  private logoX = (CANVAS_W - LOGO_W) / 2;
  private logoY = (CANVAS_H - LOGO_H) / 2;
  private logoColorIndex = 0;
  private dx = 1;
  private dy = 1;
  private speed = INITIAL_SPEED;

  private status: GameStatus = 'IDLE';
  private score = 0;
  private timeRemaining = GAME_DURATION;
  private lockedCorners: Set<string> = new Set();
  private highScore = 0;
  private scorePopups: ScorePopup[] = [];

  private lastTime = 0;
  private animationFrameId: number | null = null;

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

    this.loadHighScore();
    this.bindInput();
    this.updateHUD();
    this.updateCornerIndicators();
    this.render();
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
          this.dx = 1;
          e.preventDefault();
          break;
        case 'ArrowLeft':
          this.dx = -1;
          e.preventDefault();
          break;
        case 'ArrowUp':
          this.dy = -1;
          e.preventDefault();
          break;
        case 'ArrowDown':
          this.dy = 1;
          e.preventDefault();
          break;
      }
    });
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
    const hitRight = this.logoX + LOGO_W > CANVAS_W;
    const hitTop = this.logoY < 0;
    const hitBottom = this.logoY + LOGO_H > CANVAS_H;

    let bounced = false;
    let bounceCorner: { dx: number; dy: number } | null = null;

    if (hitLeft || hitRight) {
      this.dx *= -1;
      bounceCorner = { dx: -this.dx, dy: this.dy };
      this.logoX = Math.max(0, Math.min(this.logoX, CANVAS_W - LOGO_W));
      bounced = true;
    }

    if (hitTop || hitBottom) {
      this.dy *= -1;
      bounceCorner = { dx: this.dx, dy: -this.dy };
      this.logoY = Math.max(0, Math.min(this.logoY, CANVAS_H - LOGO_H));
      bounced = true;
    }

    if (bounced && bounceCorner) {
      this.handleBounce(bounceCorner.dx, bounceCorner.dy);
    }

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
    } else if (!isCurrentCornerLocked) {
      // Even if we missed, lock this corner
      this.lockedCorners.add(cornerKey);
      // Unlock the previous corner
      for (const key of this.lockedCorners) {
        if (key !== cornerKey) {
          this.lockedCorners.delete(key);
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
        return { x: CANVAS_W, y: 0 };
      case '1,1':
        return { x: CANVAS_W, y: CANVAS_H };
      case '-1,1':
        return { x: 0, y: CANVAS_H };
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
    if (x === CANVAS_W && y === 0) return 'tr';
    if (x === 0 && y === CANVAS_H) return 'bl';
    if (x === CANVAS_W && y === CANVAS_H) return 'br';
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
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

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
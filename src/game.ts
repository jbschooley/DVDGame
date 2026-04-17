import {
  LOGO_W,
  LOGO_H,
  COLOR_PALETTE,
  type LogoState,
  createLogo,
  drawLogo,
  cycleColor,
} from './logo.js';

// ── Types ──────────────────────────────────────────────────────────

export type GameState = 'IDLE' | 'PLAYING' | 'GAME_OVER';

export interface ScorePopup {
  x: number;
  y: number;
  points: number;
  life: number; // 0–1 fade
}

interface GameConfig {
  gameDuration: number;
  cornerThreshold: number;
  maxPoints: number;
  minPoints: number;
}

// ── Constants ──────────────────────────────────────────────────────

const CORNER_INDICATOR_SIZE = 10;
const CORNER_LOCK_COLOR = '#FF6B6B';
const CORNER_UNLOCK_COLOR = '#6BCB77';
const SCORE_POPUP_FADE_SPEED = 1.5;
const SCORE_POPUP_FLOAT_SPEED = 40; // px/s upward

export const CONFIG: GameConfig = {
  gameDuration: 60,
  cornerThreshold: 50,
  maxPoints: 200,
  minPoints: 1,
};

// ── Corner lock constants ──────────────────────────────────────────

type CornerIndex = 0 | 1 | 2 | 3; // TL, TR, BL, BR

// ── Public Game class ──────────────────────────────────────────────

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hudScore: HTMLElement;
  private hudTimer: HTMLElement;
  private hudSpeed: HTMLElement;
  private overlay: HTMLElement;
  private overlayContent: HTMLElement;

  private gameState: GameState = 'IDLE';
  public logo: LogoState | null = null;
  private currentColor: string = COLOR_PALETTE[0];
  private speedIncrement = 0;

  private score = 0;
  private timeRemaining = CONFIG.gameDuration;
  private lastFrameTime = 0;
  private animationId: number | null = null;

  private lockedCorner: CornerIndex | null = null;
  private popups: ScorePopup[] = [];

  private highScore: number;

  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor(
    canvas: HTMLCanvasElement,
    hudScore: HTMLElement,
    hudTimer: HTMLElement,
    hudSpeed: HTMLElement,
    overlay: HTMLElement,
    overlayContent: HTMLElement
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.hudScore = hudScore;
    this.hudTimer = hudTimer;
    this.hudSpeed = hudSpeed;
    this.overlay = overlay;
    this.overlayContent = overlayContent;

    // Load high score
    this.highScore = parseInt(localStorage.getItem('dvdGameHighScore') || '0', 10);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ── Resize handler ─────────────────────────────────────────────

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const hudHeight = 44;
    const w = window.innerWidth;
    const h = window.innerHeight - hudHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.logo) {
      // Scale position proportionally
      const scaleX = w / (this.canvasWidth || w);
      const scaleY = h / (this.canvasHeight || h);
      this.logo.position.x *= scaleX;
      this.logo.position.y *= scaleY;
      this.logo.speed *= scaleX;
      this.speedIncrement *= scaleX;
    }

    this.canvasWidth = w;
    this.canvasHeight = h;

    if (this.gameState === 'IDLE') {
      this.draw();
    }
  }

  // ── Init / reset ───────────────────────────────────────────────

  private initLogo(): void {
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const initialSpeed = w / 8;
    this.speedIncrement = initialSpeed / 11.2;
    this.logo = createLogo(w, h, initialSpeed);
    this.currentColor = COLOR_PALETTE[0]!;
  }

  private reset(): void {
    this.score = 0;
    this.timeRemaining = CONFIG.gameDuration;
    this.lockedCorner = null;
    this.popups = [];
    this.currentColor = COLOR_PALETTE[0]!;
    this.canvasWidth = window.innerWidth;
    this.canvasHeight = window.innerHeight - 44;
    this.initLogo();
    this.updateHUD();
    // Show overlay for IDLE state
    this.overlay.classList.add('active');
    this.overlayContent.innerHTML = `
      <h1>DVD Bounce</h1>
      <p>Use arrow keys, WASD, or swipe to change direction</p>
      <p>Tap or press <strong>Space</strong> to start</p>
    `;
  }

  // ── State transitions ──────────────────────────────────────────

  start(): void {
    this.reset();
    this.gameState = 'PLAYING';
    this.overlay.classList.remove('active');
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }

  showOverlay(): void {
    this.overlay.classList.add('active');
    this.overlayContent.innerHTML = `
      <h1>DVD Bounce</h1>
      <p>Use arrow keys, WASD, or swipe to change direction</p>
      <p>Tap or press <strong>Space</strong> to start</p>
    `;
  }

  stop(): void {
    this.gameState = 'IDLE';
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  restart(): void {
    this.start();
  }

  // ── Input ──────────────────────────────────────────────────────

  setDirection(dx: number, dy: number): void {
    if (!this.logo || this.gameState !== 'PLAYING') return;
    this.logo.dx = dx;
    this.logo.dy = dy;
  }

  isPlaying(): boolean {
    return this.gameState === 'PLAYING';
  }

  // ── Game loop ──────────────────────────────────────────────────

  private loop(timestamp: number): void {
    if (this.gameState !== 'PLAYING') return;

    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1); // cap at 100ms
    this.lastFrameTime = timestamp;

    // Timer
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.endGame();
      this.draw();
      this.updateHUD();
      return;
    }

    this.update(dt);
    this.draw();
    this.updateHUD();

    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    if (!this.logo) return;

    // Move
    this.logo.position.x += this.logo.dx * this.logo.speed * dt;
    this.logo.position.y += this.logo.dy * this.logo.speed * dt;

    // Clamp & bounce
    const canvasW = this.canvasWidth;
    const canvasH = this.canvasHeight;

    const hitLeft = this.logo.position.x < 0;
    const hitRight = this.logo.position.x + LOGO_W > canvasW;
    const hitTop = this.logo.position.y < 0;
    const hitBottom = this.logo.position.y + LOGO_H > canvasH;

    const hitHorizontal = hitLeft || hitRight;
    const hitVertical = hitTop || hitBottom;

    if (hitHorizontal || hitVertical) {
      // Determine approached corner before bounce
      const preDx = this.logo.dx;
      const preDy = this.logo.dy;

      if (hitHorizontal) {
        this.logo.dx = -this.logo.dx;
        if (hitLeft) this.logo.position.x = 0;
        if (hitRight) this.logo.position.x = canvasW - LOGO_W;
      }
      if (hitVertical) {
        this.logo.dy = -this.logo.dy;
        if (hitTop) this.logo.position.y = 0;
        if (hitBottom) this.logo.position.y = canvasH - LOGO_H;
      }

      // Single speed increment (even for true corners)
      this.logo.speed += this.speedIncrement;

      // Cycle color
      this.logo.colorIndex = cycleColor(this.logo.colorIndex);
      this.currentColor = COLOR_PALETTE[this.logo.colorIndex] ?? COLOR_PALETTE[0]!;

      // Score check
      this.checkCornerScore(preDx, preDy, canvasW, canvasH);
    }

    // Update popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt * SCORE_POPUP_FADE_SPEED;
      p.y -= SCORE_POPUP_FLOAT_SPEED * dt;
      if (p.life <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  private getCornerIndex(dx: number, dy: number): CornerIndex {
    if (dx > 0 && dy < 0) return 1; // TR
    if (dx > 0 && dy > 0) return 3; // BR
    if (dx < 0 && dy > 0) return 2; // BL
    return 0; // TL
  }

  private checkCornerScore(preDx: number, preDy: number, canvasW: number, canvasH: number): void {
    // Ensure we have valid canvas dimensions
    if (canvasW <= 0 || canvasH <= 0) return;
    if (!this.logo) return;

    const cornerIdx = this.getCornerIndex(preDx, preDy);
    const cornerPositions = [
      { x: 0, y: 0 },                         // TL
      { x: canvasW, y: 0 },                   // TR
      { x: 0, y: canvasH },                   // BL
      { x: canvasW, y: canvasH },             // BR
    ];

    const corner = cornerPositions[cornerIdx];
    const logoCorners = [
      { x: this.logo.position.x, y: this.logo.position.y },
      { x: this.logo.position.x + LOGO_W, y: this.logo.position.y },
      { x: this.logo.position.x, y: this.logo.position.y + LOGO_H },
      { x: this.logo.position.x + LOGO_W, y: this.logo.position.y + LOGO_H },
    ];

    let minDist = Infinity;
    for (const lc of logoCorners) {
      const d = Math.sqrt((lc.x - corner.x) ** 2 + (lc.y - corner.y) ** 2);
      if (d < minDist) minDist = d;
    }

    let points: number;
    if (minDist > CONFIG.cornerThreshold) {
      points = 0;
    } else {
      points = Math.round(
        CONFIG.minPoints + ((CONFIG.cornerThreshold - minDist) / CONFIG.cornerThreshold) * (CONFIG.maxPoints - CONFIG.minPoints)
      );
    }

    // Corner lockout logic
    if (points > 0) {
      if (this.lockedCorner !== null && this.lockedCorner !== cornerIdx) {
        // Clear previous lock
        this.lockedCorner = null;
      }
      this.lockedCorner = cornerIdx;
    }
    // For 0-point hits, do NOT lock the corner (per clarification: "just bounce and award 0")

    this.score += points;

    // Add popup only if points were scored
    if (points > 0) {
      // Position popup inside the canvas bounds, away from edges and HUD
      // HUD is 44px tall with 10px padding, so content starts at ~20px from top
      // Score popup is 24px tall, so need at least 32px buffer from top
      const HUD_SAFE = 40; // keep below HUD text area
      const EDGE_SAFE = 40;
      let popupX: number;
      let popupY: number;

      // Position based on which corner was hit
      switch (cornerIdx) {
        case 0: // TL - position inward from top-left
          popupX = EDGE_SAFE;
          popupY = HUD_SAFE;
          break;
        case 1: // TR - position inward from top-right
          popupX = canvasW - EDGE_SAFE;
          popupY = HUD_SAFE;
          break;
        case 2: // BL - position inward from bottom-left
          popupX = EDGE_SAFE;
          popupY = canvasH - EDGE_SAFE;
          break;
        case 3: // BR - position inward from bottom-right
          popupX = canvasW - EDGE_SAFE;
          popupY = canvasH - EDGE_SAFE;
          break;
        default:
          popupX = canvasW / 2;
          popupY = canvasH / 2;
      }

      this.popups.push({
        x: popupX,
        y: popupY,
        points,
        life: 1,
      });
    }
  }

  private endGame(): void {
    this.gameState = 'GAME_OVER';
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('dvdGameHighScore', String(this.highScore));
    }

    // Show overlay
    this.overlayContent.innerHTML = `
      <h1>Game Over</h1>
      <div class="final-score">Score: ${this.score}</div>
      <div class="high-score">High Score: ${this.highScore}</div>
      <p>Press <strong>Space</strong> or <strong>Enter</strong> to restart</p>
    `;
    this.overlay.classList.add('active');
  }

  // ── Drawing ────────────────────────────────────────────────────

  draw(): void {
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    this.ctx.clearRect(0, 0, w, h);

    // Draw corner indicators
    this.drawCornerIndicators(w, h);

    // Draw logo
    if (this.logo) {
      drawLogo(this.ctx, this.logo, this.currentColor);
    }

    // Draw score popups
    for (let i = 0; i < this.popups.length; i++) {
      const p = this.popups[i];
      const alpha = Math.max(0, p.life);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = '#FFD93D';
      this.ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`+${p.points}`, p.x, p.y);
      this.ctx.globalAlpha = 1;
    }
  }

  private drawCornerIndicators(canvasW: number, canvasH: number): void {
    const positions = [
      { x: 0, y: 0 },
      { x: canvasW - CORNER_INDICATOR_SIZE, y: 0 },
      { x: 0, y: canvasH - CORNER_INDICATOR_SIZE },
      { x: canvasW - CORNER_INDICATOR_SIZE, y: canvasH - CORNER_INDICATOR_SIZE },
    ];

    for (let i = 0; i < 4; i++) {
      const p = positions[i];
      this.ctx.fillStyle =
        this.lockedCorner === i ? CORNER_LOCK_COLOR : CORNER_UNLOCK_COLOR;
      this.ctx.fillRect(p.x, p.y, CORNER_INDICATOR_SIZE, CORNER_INDICATOR_SIZE);
    }
  }

  // ── HUD update ─────────────────────────────────────────────────

  private updateHUD(): void {
    this.hudScore.textContent = `Score: ${this.score}`;

    const mins = Math.floor(this.timeRemaining / 60);
    const secs = Math.floor(this.timeRemaining % 60);
    this.hudTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (this.logo) {
      this.hudSpeed.textContent = `Speed: ${Math.round(this.logo.speed)}`;
    }
  }

  // ── Public getters ─────────────────────────────────────────────

  get state(): GameState {
    return this.gameState;
  }

  get canvasDimensions() {
    return {
      width: this.canvasWidth,
      height: this.canvasHeight,
    };
  }
}
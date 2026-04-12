import { Logo, LOGO_W, LOGO_H } from './logo';

export enum GameState {
  IDLE,
  PLAYING,
  GAME_OVER,
}

class ScorePopup {
  x: number;
  y: number;
  text: string;
  opacity: number = 1;
  lifeTime: number = 1.0; // seconds

  constructor(x: number, y: number, points: number) {
    this.x = x;
    this.y = y;
    this.text = `+${points}`;
  }

  update(deltaTime: number) {
    this.y -= 20 * deltaTime; // Float up
    this.lifeTime -= deltaTime;
    this.opacity = Math.max(0, this.lifeTime);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  logo: Logo;
  
  state: GameState = GameState.IDLE;
  score: number = 0;
  timeRemaining: number = 60;
  speedIncrement: number = 10;
  
  // HUD elements
  scoreEl: HTMLElement;
  timerEl: HTMLElement;
  speedEl: HTMLElement;
  overlay: HTMLElement;
  overlayTitle: HTMLElement;
  overlayMessage: HTMLElement;
  finalScoreContainer: HTMLElement;
  finalScoreEl: HTMLElement;
  highScoreEl: HTMLElement;

  lastTime: number = 0;
  lockedCorner: number | null = null; // 0: TL, 1: TR, 2: BL, 3: BR
  popups: ScorePopup[] = [];

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.scoreEl = document.getElementById('score')!;
    this.timerEl = document.getElementById('timer')!;
    this.speedEl = document.getElementById('speed')!;
    this.overlay = document.getElementById('overlay')!;
    this.overlayTitle = document.getElementById('overlay-title')!;
    this.overlayMessage = document.getElementById('overlay-message')!;
    this.finalScoreContainer = document.getElementById('final-score-container')!;
    this.finalScoreEl = document.getElementById('final-score')!;
    this.highScoreEl = document.getElementById('high-score')!;

    // Set initial size before creating logo
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    const initialSpeed = this.canvas.width / 8;
    this.logo = new Logo(this.canvas.width, this.canvas.height, initialSpeed);

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;
    
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    if (oldWidth > 0 && this.logo) {
      const scaleX = this.canvas.width / oldWidth;
      const scaleY = this.canvas.height / oldHeight;
      const scale = (scaleX + scaleY) / 2;

      this.logo.x *= scaleX;
      this.logo.y *= scaleY;
      this.logo.speed *= scale;
      this.speedIncrement *= scale;
    }
  }

  start() {
    this.state = GameState.PLAYING;
    this.score = 0;
    this.timeRemaining = 60;
    this.lockedCorner = null;
    this.popups = [];
    
    // Reset logo speed to initial value based on current canvas width
    this.logo.speed = this.canvas.width / 8;
    
    this.updateHUD();
    this.overlay.style.opacity = '0';
    this.overlay.style.pointerEvents = 'none';
    
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  gameOver() {
    this.state = GameState.GAME_OVER;
    this.overlay.style.opacity = '1';
    this.overlay.style.pointerEvents = 'auto';
    this.overlayTitle.textContent = 'GAME OVER';
    this.overlayMessage.textContent = 'Press Space or Enter to Restart';
    this.finalScoreContainer.style.display = 'block';
    this.finalScoreEl.textContent = this.score.toString();
    
    const highScore = localStorage.getItem('dvd-high-score') || '0';
    this.highScoreEl.textContent = highScore;
    
    if (this.score > parseInt(highScore)) {
      localStorage.setItem('dvd-high-score', this.score.toString());
      this.highScoreEl.textContent = this.score.toString();
    }
  }

  updateHUD() {
    this.scoreEl.textContent = `Score: ${this.score}`;
    this.timerEl.textContent = `0:${Math.ceil(this.timeRemaining).toString().padStart(2, '0')}`;
    this.speedEl.textContent = `Speed: ${Math.round(this.logo.speed)}`;
  }

  setDx(dx: number) {
    if (this.state === GameState.PLAYING) {
      this.logo.dx = dx;
    }
  }

  setDy(dy: number) {
    if (this.state === GameState.PLAYING) {
      this.logo.dy = dy;
    }
  }

  loop(currentTime: number) {
    if (this.state !== GameState.PLAYING) return;

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(deltaTime: number) {
    this.timeRemaining -= deltaTime;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.gameOver();
    }

    const prevDx = this.logo.dx;
    const prevDy = this.logo.dy;

    this.logo.update(deltaTime);

    let hitWall = false;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    // Collision Detection
    if (this.logo.x < 0) {
      this.logo.x = 0;
      this.logo.bounceX();
      hitWall = true;
    } else if (this.logo.x + LOGO_W > canvasW) {
      this.logo.x = canvasW - LOGO_W;
      this.logo.bounceX();
      hitWall = true;
    }

    if (this.logo.y < 0) {
      this.logo.y = 0;
      this.logo.bounceY();
      hitWall = true;
    } else if (this.logo.y + LOGO_H > canvasH) {
      this.logo.y = canvasH - LOGO_H;
      this.logo.bounceY();
      hitWall = true;
    }

    if (hitWall) {
      this.logo.speed += this.speedIncrement;
      this.checkCornerScore(prevDx, prevDy);
    }

    // Update popups
    this.popups = this.popups.filter(p => p.lifeTime > 0);
    this.popups.forEach(p => p.update(deltaTime));

    this.updateHUD();
  }

  checkCornerScore(dx: number, dy: number) {
    // Determine approached corner based on direction BEFORE bounce
    let targetCorner: [number, number];
    let cornerId: number;

    if (dx === 1 && dy === -1) { targetCorner = [this.canvas.width, 0]; cornerId = 1; }
    else if (dx === 1 && dy === 1) { targetCorner = [this.canvas.width, this.canvas.height]; cornerId = 3; }
    else if (dx === -1 && dy === 1) { targetCorner = [0, this.canvas.height]; cornerId = 2; }
    else { targetCorner = [0, 0]; cornerId = 0; }

    const logoCorners = [
      [this.logo.x, this.logo.y],
      [this.logo.x + LOGO_W, this.logo.y],
      [this.logo.x, this.logo.y + LOGO_H],
      [this.logo.x + LOGO_W, this.logo.y + LOGO_H],
    ];

    let minDist = Infinity;
    for (const corner of logoCorners) {
      const dist = Math.sqrt(Math.pow(corner[0] - targetCorner[0], 2) + Math.pow(corner[1] - targetCorner[1], 2));
      if (dist < minDist) minDist = dist;
    }

    if (minDist <= 50) {
      if (this.lockedCorner !== cornerId) {
        const points = Math.round(1 + (50 - minDist) / 50 * 199);
        this.score += points;
        this.lockedCorner = cornerId;
        
        // Create score popup at the target corner
        this.popups.push(new ScorePopup(targetCorner[0], targetCorner[1], points));
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw corner indicators
    const corners = [
      [0, 0], [this.canvas.width, 0], 
      [0, this.canvas.height], [this.canvas.width, this.canvas.height]
    ];
    
    this.ctx.fillStyle = 'green';
    corners.forEach((c, i) => {
      if (this.lockedCorner === i) {
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(c[0] - (i%2===1?10:0), c[1] - (i<2?0:10), 10, 10);
        this.ctx.fillStyle = 'green';
      } else {
        this.ctx.fillRect(c[0] - (i%2===1?10:0), c[1] - (i<2?0:10), 10, 10);
      }
    });

    this.logo.draw(this.ctx);

    // Draw score popups
    this.popups.forEach(p => p.draw(this.ctx));
  }
}
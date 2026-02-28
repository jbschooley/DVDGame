export const CANVAS_W = 900;
export const CANVAS_H = 540;
export const LOGO_W = 150;
export const LOGO_H = 75;
export const INITIAL_SPEED = CANVAS_W / 8; // ~112 px/s
export const SPEED_INCREMENT = 10; // px/s per edge hit
export const GAME_DURATION = 60; // seconds
export const CORNER_THRESHOLD = 50; // px — max distance for points
export const MAX_POINTS = 200;
export const MIN_POINTS = 1;

export const COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#C77DFF', '#FF9F1C', '#00B4D8', '#FFFFFF'
];

export interface Position {
  x: number;
  y: number;
}

export interface Direction {
  dx: number;
  dy: number;
}

export interface GameState {
  status: 'IDLE' | 'PLAYING' | 'GAME_OVER';
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

export class Logo {
  position: Position;
  direction: Direction;
  colorIndex: number;

  constructor() {
    this.position = {
      x: (CANVAS_W - LOGO_W) / 2,
      y: (CANVAS_H - LOGO_H) / 2
    };
    this.direction = { dx: 1, dy: 1 };
    this.colorIndex = 0;
  }

  getCurrentColor(): string {
    return COLORS[this.colorIndex];
  }

  cycleColor(): void {
    this.colorIndex = (this.colorIndex + 1) % COLORS.length;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this.position;
    const color = this.getCurrentColor();

    // Draw rounded rectangle for logo body
    ctx.fillStyle = color;
    const radius = 10;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + LOGO_W - radius, y);
    ctx.quadraticCurveTo(x + LOGO_W, y, x + LOGO_W, y + radius);
    ctx.lineTo(x + LOGO_W, y + LOGO_H - radius);
    ctx.quadraticCurveTo(x + LOGO_W, y + LOGO_H, x + LOGO_W - radius, y + LOGO_H);
    ctx.lineTo(x + radius, y + LOGO_H);
    ctx.quadraticCurveTo(x, y + LOGO_H, x, y + LOGO_H - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    // Draw "DVD" text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DVD', x + LOGO_W / 2, y + LOGO_H / 2);
  }

  update(deltaTime: number, gameState: GameState): void {
    if (gameState.status !== 'PLAYING') return;

    const speed = gameState.speed;
    this.position.x += this.direction.dx * speed * deltaTime;
    this.position.y += this.direction.dy * speed * deltaTime;
  }

  getLogoCorners(): Position[] {
    const { x, y } = this.position;
    return [
      { x, y },
      { x: x + LOGO_W, y },
      { x, y: y + LOGO_H },
      { x: x + LOGO_W, y: y + LOGO_H }
    ];
  }

  getApproachedCorner(dx: number, dy: number): Position | null {
    switch (`${dx},${dy}`) {
      case '1,-1':
        return { x: CANVAS_W, y: 0 }; // Top-right
      case '1,1':
        return { x: CANVAS_W, y: CANVAS_H }; // Bottom-right
      case '-1,1':
        return { x: 0, y: CANVAS_H }; // Bottom-left
      case '-1,-1':
        return { x: 0, y: 0 }; // Top-left
      default:
        return null;
    }
  }

  distanceToCorner(logoCorners: Position[], canvasCorner: Position): number {
    return logoCorners.reduce((min, corner) => {
      const dx = corner.x - canvasCorner.x;
      const dy = corner.y - canvasCorner.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist < min ? dist : min;
    }, Infinity);
  }

  calculatePoints(logoCorners: Position[], canvasCorner: Position): number {
    const distance = this.distanceToCorner(logoCorners, canvasCorner);
    if (distance > CORNER_THRESHOLD) {
      return 0;
    }
    return Math.round(MIN_POINTS + (CORNER_THRESHOLD - distance) / CORNER_THRESHOLD * (MAX_POINTS - MIN_POINTS));
  }
}
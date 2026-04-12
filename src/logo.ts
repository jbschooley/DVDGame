export const LOGO_W = 150;
export const LOGO_H = 75;
export const COLOR_PALETTE = [
  '#FF6B6B',
  '#FFD93D',
  '#6BCB77',
  '#4D96FF',
  '#C77DFF',
  '#FF9F1C',
  '#00B4D8',
  '#FFFFFF',
];

export class Logo {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  colorIndex: number = 0;

  constructor(canvasWidth: number, canvasHeight: number, initialSpeed: number) {
    this.x = Math.random() * (canvasWidth - LOGO_W);
    this.y = Math.random() * (canvasHeight - LOGO_H);
    this.dx = Math.random() > 0.5 ? 1 : -1;
    this.dy = Math.random() > 0.5 ? 1 : -1;
    this.speed = initialSpeed;
  }

  update(deltaTime: number) {
    this.x += this.dx * this.speed * deltaTime;
    this.y += this.dy * this.speed * deltaTime;
  }

  bounceX() {
    this.dx *= -1;
    this.cycleColor();
  }

  bounceY() {
    this.dy *= -1;
    this.cycleColor();
  }

  cycleColor() {
    this.colorIndex = (this.colorIndex + 1) % COLOR_PALETTE.length;
  }

  getCurrentColor() {
    return COLOR_PALETTE[this.colorIndex];
  }

  draw(ctx: CanvasRenderingContext2D) {
    const color = this.getCurrentColor();
    ctx.fillStyle = color;

    // Draw rounded rectangle
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, LOGO_W, LOGO_H, 10);
    ctx.fill();

    // Draw text: Bold, Sans-Serif, Italicized, Centered
    ctx.fillStyle = 'white';
    ctx.font = 'italic bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DVD', this.x + LOGO_W / 2, this.y + LOGO_H / 2);
  }
}
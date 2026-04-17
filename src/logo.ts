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
] as const;

export interface LogoPosition {
  x: number;
  y: number;
}

export interface LogoState {
  position: LogoPosition;
  dx: number;
  dy: number;
  speed: number;
  colorIndex: number;
}

export function createLogo(canvasWidth: number, canvasHeight: number, initialSpeed: number): LogoState {
  return {
    position: {
      x: canvasWidth / 2 - LOGO_W / 2,
      y: canvasHeight / 2 - LOGO_H / 2,
    },
    dx: 1,
    dy: -1,
    speed: initialSpeed,
    colorIndex: 0,
  };
}

export function getCurrentColor(): string {
  return COLOR_PALETTE[0]; // placeholder, set externally
}

export function drawLogo(
  ctx: CanvasRenderingContext2D,
  state: LogoState,
  color: string
): void {
  const { x, y } = state.position;

  // Draw rounded rectangle background
  const radius = 12;
  ctx.fillStyle = color;
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
  ctx.fillStyle = '#000000';
  ctx.font = 'bold italic 32px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DVD', x + LOGO_W / 2, y + LOGO_H / 2);
}

export function cycleColor(currentIndex: number): number {
  return (currentIndex + 1) % COLOR_PALETTE.length;
}
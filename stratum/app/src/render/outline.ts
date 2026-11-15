import { SHAPES, maskFor, type ShapeId } from '../jars/shapes';
import { gridCanvas, type PaintOptions } from './painter';

/**
 * The glass outline of a jar, in grid units, as a closed polygon around the
 * inside: down the left wall, across the base, up the right wall.
 */
export function outlinePoints(shape: ShapeId, wall = 0): [number, number][] {
  const s = SHAPES[shape];
  const m = maskFor(shape);
  const cx = m.w / 2;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let y = s.top; y <= s.bottom + 1; y += 1) {
    const yy = Math.min(y, s.bottom + 0.999);
    const hw = s.halfWidth(Math.min(Math.floor(yy), s.bottom)) + wall;
    left.push([cx - hw, y]);
    right.push([cx + hw, y]);
  }
  const base = s.bottom + 1 + wall;
  const hb = s.halfWidth(s.bottom) + wall * 0.5;
  return [[cx - s.halfWidth(s.top) - wall, s.top - wall * 0.6], ...left, [cx - hb, base], [cx + hb, base], ...right.reverse(), [cx + s.halfWidth(s.top) + wall, s.top - wall * 0.6]];
}

/**
 * Draws a finished or target jar into a 2D canvas: sand, glass, highlight and
 * an optional cork. Used for the shelf, the target picture and results.
 */
export function drawJar(
  ctx: CanvasRenderingContext2D,
  shape: ShapeId,
  cells: Uint8Array | null,
  x: number,
  y: number,
  width: number,
  opts: PaintOptions & { cork?: boolean; glassAlpha?: number; label?: string },
): void {
  const m = maskFor(shape);
  const scale = width / m.w;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Glass body tint
  const pts = outlinePoints(shape, 0.6);
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill();

  if (cells) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(gridCanvas(cells, m, opts), 0, 0);
  }

  // Glass wall
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = `rgba(255,255,255,${opts.glassAlpha ?? 0.55})`;
  ctx.stroke();

  // Highlight
  const s = SHAPES[shape];
  ctx.beginPath();
  const hx = m.w / 2 - s.halfWidth(Math.floor((s.top + s.bottom) * 0.6)) + 4;
  ctx.moveTo(hx, s.top + 30);
  ctx.lineTo(hx, s.bottom - 12);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.stroke();

  if (opts.cork) {
    const hw = s.halfWidth(s.top);
    ctx.fillStyle = '#c8955a';
    roundRect(ctx, m.w / 2 - hw + 2, s.top - 8, hw * 2 - 4, 12, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 6; i++) ctx.fillRect(m.w / 2 - hw + 6 + i * ((hw * 2 - 12) / 6), s.top - 5, 2, 2);
  }
  if (opts.label) {
    ctx.fillStyle = opts.label;
    roundRect(ctx, m.w / 2 - 14, s.bottom - 30, 28, 12, 3);
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A ready-made canvas of a jar, sized for CSS width `cssW` at device pixel ratio. */
export function jarThumb(
  shape: ShapeId,
  cells: Uint8Array | null,
  cssW: number,
  opts: PaintOptions & { cork?: boolean; label?: string },
): HTMLCanvasElement {
  const m = maskFor(shape);
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const cssH = (cssW * (m.h + 4)) / m.w;
  const c = document.createElement('canvas');
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawJar(ctx, shape, cells, 0, (4 * cssW) / m.w, cssW, opts);
  return c;
}

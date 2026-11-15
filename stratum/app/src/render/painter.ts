import { SAND_COLOURS, patternHit } from '../config/theme';
import { TUNING } from '../config/tuning';
import type { JarMask } from '../sand/grid';

/**
 * Turns a sand grid into pixels: one pixel per cell, each grain given a slight
 * lightness fixed for its cell so the sand has texture (§11), with optional
 * colour-blind patterns. Shared by the game view, thumbnails and the editor.
 */

const JITTER_LEVELS = 8;
/** LUT[colour][jitter][pattern 0/1] → packed RGBA (little-endian ABGR). */
const LUT: Uint32Array[][] = [];

function shade(v: number, f: number): number {
  return Math.max(0, Math.min(255, Math.round(v * f)));
}

for (let c = 0; c < SAND_COLOURS.length; c++) {
  LUT[c] = [];
  const [r, g, b] = SAND_COLOURS[c].rgb;
  for (let p = 0; p < 2; p++) {
    const arr = new Uint32Array(JITTER_LEVELS);
    for (let j = 0; j < JITTER_LEVELS; j++) {
      const f = (1 - TUNING.GRAIN_LIGHTNESS_JITTER + (2 * TUNING.GRAIN_LIGHTNESS_JITTER * j) / (JITTER_LEVELS - 1)) * (p ? 0.62 : 1);
      arr[j] = (255 << 24) | (shade(b, f) << 16) | (shade(g, f) << 8) | shade(r, f);
    }
    LUT[c][p] = arr;
  }
}

/** Fixed per-cell jitter index. */
const jitterCache = new Map<number, Uint8Array>();
function jitterFor(w: number, h: number): Uint8Array {
  const key = w * 10000 + h;
  let j = jitterCache.get(key);
  if (!j) {
    j = new Uint8Array(w * h);
    let s = 12345;
    for (let i = 0; i < j.length; i++) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      j[i] = (s >>> 16) % JITTER_LEVELS;
    }
    jitterCache.set(key, j);
  }
  return j;
}

/** Pattern hit cache per colour. */
const patternCache = new Map<number, Uint8Array>();
function patternFor(c: number, w: number, h: number): Uint8Array {
  const key = c * 1e6 + w * 1000 + h;
  let p = patternCache.get(key);
  if (!p) {
    p = new Uint8Array(w * h);
    const pat = SAND_COLOURS[c].pattern;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p[y * w + x] = patternHit(pat, x, y) ? 1 : 0;
    patternCache.set(key, p);
  }
  return p;
}

export interface PaintOptions {
  patterns: boolean;
}

export function paintSand(out: Uint32Array, cells: Uint8Array, mask: JarMask, opts: PaintOptions): void {
  const { w, h } = mask;
  const jit = jitterFor(w, h);
  const pats = opts.patterns ? SAND_COLOURS.map((_, c) => (c ? patternFor(c, w, h) : null)) : null;
  for (let i = 0; i < w * h; i++) {
    const c = cells[i];
    if (!c) {
      out[i] = 0;
      continue;
    }
    const p = pats ? pats[c]![i] : 0;
    out[i] = LUT[c][p][jit[i]];
  }
}

/** Paints guide lines (cells on a colour boundary) as soft white. */
export function paintGuides(out: Uint32Array, guides: Uint8Array): void {
  const col = (200 << 24) | (255 << 16) | (255 << 8) | 255;
  for (let i = 0; i < guides.length; i++) out[i] = guides[i] ? col : 0;
}

/** A small canvas of a grid at one pixel per cell, for thumbnails and textures. */
export function gridCanvas(cells: Uint8Array, mask: JarMask, opts: PaintOptions): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = mask.w;
  c.height = mask.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(mask.w, mask.h);
  paintSand(new Uint32Array(img.data.buffer), cells, mask, opts);
  ctx.putImageData(img, 0, 0);
  return c;
}

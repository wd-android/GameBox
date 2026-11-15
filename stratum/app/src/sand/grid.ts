import { TUNING } from '../config/tuning';

/**
 * A jar mask: which cells are inside the jar (1) and which are solid glass (0),
 * plus where sand can enter and where the jar counts as full.
 */
export interface JarMask {
  w: number;
  h: number;
  inside: Uint8Array;
  /** Top inside row: the opening, where poured grains appear. */
  topRow: number;
  /** Leftmost / rightmost inside columns of the opening (the reach of the spout). */
  openLeft: number;
  openRight: number;
  /** Rows at or below this index (inclusive) must be filled. */
  fillRow: number;
  /** Number of inside cells at or below the fill row. */
  capacity: number;
}

export function buildMask(halfWidthAt: (y: number) => number, topRow: number, bottomRow: number, fillRow: number): JarMask {
  const w = TUNING.GRID_W;
  const h = TUNING.GRID_H;
  const inside = new Uint8Array(w * h);
  const cx = w / 2;
  for (let y = topRow; y <= bottomRow; y++) {
    const hw = halfWidthAt(y);
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d < hw && x > 0 && x < w - 1) inside[y * w + x] = 1;
    }
  }
  let openLeft = w;
  let openRight = -1;
  for (let x = 0; x < w; x++) {
    if (inside[topRow * w + x]) {
      openLeft = Math.min(openLeft, x);
      openRight = Math.max(openRight, x);
    }
  }
  let capacity = 0;
  for (let y = fillRow; y < h; y++) for (let x = 0; x < w; x++) capacity += inside[y * w + x];
  return { w, h, inside, topRow, openLeft, openRight, fillRow, capacity };
}

/** Surface height helpers used by tests and the editor. */
export function columnTop(cells: Uint8Array, mask: JarMask, x: number): number {
  for (let y = 0; y < mask.h; y++) {
    if (cells[y * mask.w + x]) return y;
  }
  return mask.h;
}

export function countGrains(cells: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < cells.length; i++) if (cells[i]) n++;
  return n;
}

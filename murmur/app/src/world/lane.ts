import { TUNING } from '../config/tuning';
import { WIRE_HALF, wireSpans, type Chunk } from './chunk';

/**
 * Clear-lane check (§7.1): is there a continuous lane of the given width
 * from the bottom of the chunk to the top? Hazards are grown by half the
 * width (and the sky's edges too), and a path is searched on a fine grid.
 * Drifting clouds count as occupying their whole sideways range.
 */
export const LANE_RES = 0.2;

export interface LaneResult {
  ok: boolean;
  /** Centre line of a lane, as points from bottom to top. */
  path: { x: number; y: number }[];
  /** Free x-cells on the bottom and top rows (for checking that chunks line up). */
  bottomFree: boolean[];
  topFree: boolean[];
}

export function freeGrid(c: Chunk, width: number): { cols: number; rows: number; free: Uint8Array } {
  const cols = Math.round(TUNING.SKY_W / LANE_RES);
  const rows = Math.round(TUNING.SKY_H / LANE_RES);
  const free = new Uint8Array(cols * rows);
  const half = width / 2;
  for (let j = 0; j < rows; j++) {
    const y = (j + 0.5) * LANE_RES;
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * LANE_RES;
      let ok = x >= half && x <= TUNING.SKY_W - half;
      for (const cl of c.clouds) {
        if (!ok) break;
        const amp = cl.drift?.amp ?? 0;
        const dx = Math.max(0, Math.abs(x - cl.x) - amp);
        if (Math.hypot(dx, y - cl.y) < cl.r + half) ok = false;
      }
      for (const w of c.wires) {
        if (!ok) break;
        if (Math.abs(y - w.y) >= WIRE_HALF + half) continue;
        for (const [a, b] of wireSpans(w)) if (x > a - half && x < b + half) ok = false;
      }
      for (const p of c.pylons) {
        if (!ok) break;
        const dx = Math.max(p.x - x, 0, x - (p.x + p.w));
        const dy = Math.max(p.y - y, 0, y - (p.y + p.h));
        if (Math.hypot(dx, dy) < half) ok = false;
      }
      free[j * cols + i] = ok ? 1 : 0;
    }
  }
  return { cols, rows, free };
}

export function checkLane(c: Chunk, width: number): LaneResult {
  const { cols, rows, free } = freeGrid(c, width);
  const prev = new Int32Array(cols * rows).fill(-2);
  const queue: number[] = [];
  for (let i = 0; i < cols; i++)
    if (free[i]) {
      prev[i] = -1;
      queue.push(i);
    }
  let end = -1;
  for (let qi = 0; qi < queue.length && end < 0; qi++) {
    const cell = queue[qi];
    const i = cell % cols;
    const j = Math.floor(cell / cols);
    if (j === rows - 1) {
      end = cell;
      break;
    }
    for (const [di, dj] of [
      [0, 1],
      [-1, 1],
      [1, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
    ]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue;
      const n = nj * cols + ni;
      if (!free[n] || prev[n] !== -2) continue;
      prev[n] = cell;
      queue.push(n);
    }
  }
  const path: { x: number; y: number }[] = [];
  for (let c2 = end; c2 >= 0; c2 = prev[c2]) path.push({ x: ((c2 % cols) + 0.5) * LANE_RES, y: (Math.floor(c2 / cols) + 0.5) * LANE_RES });
  path.reverse();
  const bottomFree = Array.from({ length: cols }, (_, i) => free[i] === 1);
  const topFree = Array.from({ length: cols }, (_, i) => free[(rows - 1) * cols + i] === 1);
  return { ok: end >= 0, path, bottomFree, topFree };
}

/** Whether the top of one chunk lines up with the bottom of the next: some x is free in both. */
export function linesUp(a: LaneResult, b: LaneResult): boolean {
  return a.topFree.some((f, i) => f && b.bottomFree[i]);
}

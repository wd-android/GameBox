import { TUNING } from '../config/tuning';
import type { Flight, Point } from '../sim/flight';
import { LANE_RES, freeGrid } from '../world/lane';
import type { Chunk } from '../world/chunk';

/**
 * An automatic pilot that simply follows the clear lane (§12), used by the
 * tests and as the survival baseline for comparing steering options (§14).
 *
 * It plans one continuous lane from the leader's position up through the
 * current and next chunks (each grown by its tier's lane width), re-planning
 * twice a second, and aims a short distance along it so it never cuts a
 * corner into a pylon.
 */
const gridCache = new Map<string, ReturnType<typeof freeGrid>>();

function grid(c: Chunk): ReturnType<typeof freeGrid> {
  let g = gridCache.get(c.id);
  if (!g) {
    g = freeGrid(c, TUNING.TIER_LANE[c.tier - 1]);
    gridCache.set(c.id, g);
  }
  return g;
}

export class Pilot {
  private path: Point[] = [];
  private plannedAt = -1;

  constructor(private f: Flight) {}

  private plan(): void {
    const f = this.f;
    const entries = f.placed.filter((e) => e.base + TUNING.SKY_H > f.leader.y).sort((a, b) => a.base - b.base).slice(0, 2);
    if (!entries.length) return;
    const base0 = entries[0].base;
    const cols = Math.round(TUNING.SKY_W / LANE_RES);
    const rowsPer = Math.round(TUNING.SKY_H / LANE_RES);
    const rows = rowsPer * entries.length;
    const free = new Uint8Array(cols * rows);
    entries.forEach((e, k) => {
      const g = grid(e.chunk);
      free.set(g.free, k * rowsPer * cols);
    });
    const col = (x: number) => Math.max(0, Math.min(cols - 1, Math.floor(x / LANE_RES)));
    const row = (y: number) => Math.max(0, Math.min(rows - 1, Math.floor((y - base0) / LANE_RES)));
    // Start from the free cell nearest the leader.
    let start = row(f.leader.y) * cols + col(f.leader.x);
    if (!free[start]) {
      let best = Infinity;
      const r0 = row(f.leader.y);
      for (let j = Math.max(0, r0 - 5); j < Math.min(rows, r0 + 6); j++)
        for (let i = 0; i < cols; i++) {
          if (!free[j * cols + i]) continue;
          const d = Math.hypot((i + 0.5) * LANE_RES - f.leader.x, base0 + (j + 0.5) * LANE_RES - f.leader.y);
          if (d < best) {
            best = d;
            start = j * cols + i;
          }
        }
    }
    const prev = new Int32Array(cols * rows).fill(-2);
    prev[start] = -1;
    const queue = [start];
    let end = start;
    for (let qi = 0; qi < queue.length; qi++) {
      const cell = queue[qi];
      const i = cell % cols;
      const j = Math.floor(cell / cols);
      if (j > Math.floor(end / cols)) end = cell;
      if (j === rows - 1) break;
      // Prefer going up, then diagonally, then sideways.
      for (const [di, dj] of [
        [0, 1],
        [-1, 1],
        [1, 1],
        [-1, 0],
        [1, 0],
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
    const path: Point[] = [];
    for (let c = end; c >= 0; c = prev[c]) path.push({ x: ((c % cols) + 0.5) * LANE_RES, y: base0 + (Math.floor(c / cols) + 0.5) * LANE_RES });
    this.path = path.reverse();
    this.plannedAt = f.t;
  }

  target(): Point | null {
    const f = this.f;
    if (this.plannedAt < 0 || f.t - this.plannedAt > 0.5 || !this.path.length) this.plan();
    const pts = this.path;
    if (!pts.length) return null;
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - f.leader.x, pts[i].y - f.leader.y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    let left = 1.4 + f.scroll * 0.12;
    let i = bi;
    while (i + 1 < pts.length && left > 0) {
      left -= Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      i++;
    }
    return pts[i];
  }
}

/** Flies a run with the pilot; returns the seconds survived (capped). */
export function autofly(f: Flight, maxSeconds: number): number {
  const pilot = new Pilot(f);
  const ticks = maxSeconds * TUNING.TICK_HZ;
  for (let i = 0; i < ticks && !f.over; i++) f.step(pilot.target());
  return f.t;
}

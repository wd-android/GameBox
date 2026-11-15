import { TUNING } from '../config/tuning';
import { nearestRockGap, type Chart } from '../charts/charts';

/**
 * The safe-route grid (§6.3), worked out once per chart: quarter-tile squares,
 * unsafe within 0.6 tiles of a rock, and each safe square's distance to the
 * harbour mouth travelling only through safe squares.
 */
export class RouteGrid {
  readonly n = TUNING.GRID_PER_TILE;
  readonly cols = TUNING.SEA_W * TUNING.GRID_PER_TILE;
  readonly rows = TUNING.SEA_H * TUNING.GRID_PER_TILE;
  readonly safe: Uint8Array;
  readonly dist: Float64Array;
  /** Extra cost of a square near the unsafe band, so routes keep a little sea room. */
  private readonly penalty: Float64Array;

  constructor(readonly chart: Chart) {
    const { cols, rows, n } = this;
    this.safe = new Uint8Array(cols * rows);
    this.dist = new Float64Array(cols * rows).fill(Infinity);
    this.penalty = new Float64Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) / n;
        const y = (r + 0.5) / n;
        const gap = nearestRockGap(chart, x, y);
        this.safe[r * cols + c] = gap >= TUNING.UNSAFE_MARGIN ? 1 : 0;
        this.penalty[r * cols + c] = TUNING.ROUTE_ROOM_COST * Math.max(0, TUNING.ROUTE_ROOM - gap);
      }
    // Dijkstra from the harbour squares over 8-connected safe squares.
    const h = chart.harbour;
    const heap = new MinHeap();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (this.safe[i] && Math.hypot((c + 0.5) / n - h.x, (r + 0.5) / n - h.y) <= h.r) {
          this.dist[i] = 0;
          heap.push(i, 0);
        }
      }
    const steps: [number, number, number][] = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ];
    while (heap.size) {
      const [i, d] = heap.pop();
      if (d > this.dist[i]) continue;
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dc, dr, w] of steps) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (!this.safe[j]) continue;
        // No cutting corners past unsafe squares.
        if (dc && dr && (!this.safe[r * cols + nc] || !this.safe[nr * cols + c])) continue;
        const nd = d + (w / n) * (1 + this.penalty[j]);
        if (nd < this.dist[j]) {
          this.dist[j] = nd;
          heap.push(j, nd);
        }
      }
    }
  }

  index(x: number, y: number): number {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor(x * this.n)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor(y * this.n)));
    return r * this.cols + c;
  }

  centre(i: number): { x: number; y: number } {
    const c = i % this.cols;
    return { x: (c + 0.5) / this.n, y: ((i - c) / this.cols + 0.5) / this.n };
  }

  distanceAt(x: number, y: number): number {
    return this.dist[this.index(x, y)];
  }

  isSafe(x: number, y: number): boolean {
    return this.safe[this.index(x, y)] === 1;
  }

  /** The next square downhill from square i (falling distance), or -1 at the harbour. */
  downhill(i: number): number {
    const c = i % this.cols;
    const r = (i - c) / this.cols;
    let best = -1;
    let bd = this.dist[i];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const j = nr * this.cols + nc;
        if (this.dist[j] < bd) {
          bd = this.dist[j];
          best = j;
        }
      }
    return best;
  }

  /**
   * Where a lit boat should steer: a point a little way ahead along the route of
   * falling distance. From an unsafe square, the nearest safe square first.
   */
  target(x: number, y: number): { x: number; y: number } {
    let i = this.index(x, y);
    if (!this.safe[i] || !Number.isFinite(this.dist[i])) {
      const j = this.nearestSafe(x, y);
      return this.centre(j);
    }
    // The farthest point within the lookahead that can be reached in a straight, safe line.
    let travelled = 0;
    let p = { x, y };
    let best: { x: number; y: number } | null = null;
    while (travelled < TUNING.ROUTE_LOOKAHEAD) {
      const j = this.downhill(i);
      if (j < 0) return best && !this.clearLine(x, y, this.chart.harbour.x, this.chart.harbour.y) ? best : this.chart.harbour;
      const q = this.centre(j);
      travelled += Math.hypot(q.x - p.x, q.y - p.y);
      p = q;
      i = j;
      if (!best || this.clearLine(x, y, q.x, q.y)) best = q;
      else break;
    }
    return best ?? p;
  }

  /** Whether the straight line between two points stays on safe squares. */
  clearLine(x0: number, y0: number, x1: number, y1: number): boolean {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / 0.1));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      if (!this.safe[this.index(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)]) return false;
    }
    return true;
  }

  private nearestCache = new Map<number, number>();
  nearestSafe(x: number, y: number): number {
    const i = this.index(x, y);
    const cached = this.nearestCache.get(i);
    if (cached !== undefined) return cached;
    let best = i;
    let bd = Infinity;
    for (let j = 0; j < this.safe.length; j++) {
      if (!this.safe[j] || !Number.isFinite(this.dist[j])) continue;
      const q = this.centre(j);
      const d = (q.x - x) ** 2 + (q.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    this.nearestCache.set(i, best);
    return best;
  }
}

const gridCache = new Map<string, RouteGrid>();
export function routesFor(chart: Chart): RouteGrid {
  let g = gridCache.get(chart.id);
  if (!g) gridCache.set(chart.id, (g = new RouteGrid(chart)));
  return g;
}

class MinHeap {
  private a: number[] = [];
  private p: number[] = [];
  get size() {
    return this.a.length;
  }
  push(v: number, pr: number) {
    this.a.push(v);
    this.p.push(pr);
    let i = this.a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (this.p[j] <= this.p[i]) break;
      this.swap(i, j);
      i = j;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.a[0], this.p[0]];
    const lv = this.a.pop()!;
    const lp = this.p.pop()!;
    if (this.a.length) {
      this.a[0] = lv;
      this.p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.a.length && this.p[l] < this.p[m]) m = l;
        if (r < this.a.length && this.p[r] < this.p[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(i: number, j: number) {
    [this.a[i], this.a[j]] = [this.a[j], this.a[i]];
    [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
  }
}

import { cellIndex } from '../maze/topology';
import type { Cube } from '../maze/generator';

/**
 * Wall geometry for one face (§7.6): closed walls and rim as line segments on
 * cell boundaries, collinear pieces merged, with a one-cell gap at each gate.
 * Coordinates are face-local cells: x along u, y along v, 0..n.
 */
export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface FaceWalls {
  segments: Segment[];
  /** For each cell (row * n + col), the segments bordering it or its eight neighbours. */
  nearby: number[][];
}

/** Bits: 0 = +u (x+1), 1 = +v (y+1), 2 = −u, 3 = −v. */
export function buildFaceWalls(cube: Cube, face: number): FaceWalls {
  const n = cube.n;
  const open = (col: number, row: number, side: number) => (cube.open[cellIndex(n, face, col, row)] & (1 << side)) !== 0;
  const segments: Segment[] = [];

  // Horizontal lines y = k: boundary below row k−1 / above row k.
  for (let k = 0; k <= n; k++) {
    let runStart = -1;
    for (let c = 0; c <= n; c++) {
      let closed = false;
      if (c < n) {
        if (k === 0) closed = !open(c, 0, 3);
        else if (k === n) closed = !open(c, n - 1, 1);
        else closed = !open(c, k, 3);
      }
      if (closed && runStart < 0) runStart = c;
      if (!closed && runStart >= 0) {
        segments.push({ ax: runStart, ay: k, bx: c, by: k });
        runStart = -1;
      }
    }
  }
  // Vertical lines x = k.
  for (let k = 0; k <= n; k++) {
    let runStart = -1;
    for (let r = 0; r <= n; r++) {
      let closed = false;
      if (r < n) {
        if (k === 0) closed = !open(0, r, 2);
        else if (k === n) closed = !open(n - 1, r, 0);
        else closed = !open(k, r, 2);
      }
      if (closed && runStart < 0) runStart = r;
      if (!closed && runStart >= 0) {
        segments.push({ ax: k, ay: runStart, bx: k, by: r });
        runStart = -1;
      }
    }
  }

  const nearby: number[][] = [];
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const x0 = col - 1;
      const x1 = col + 2;
      const y0 = row - 1;
      const y1 = row + 2;
      const list: number[] = [];
      segments.forEach((s, i) => {
        const minx = Math.min(s.ax, s.bx);
        const maxx = Math.max(s.ax, s.bx);
        const miny = Math.min(s.ay, s.by);
        const maxy = Math.max(s.ay, s.by);
        if (maxx >= x0 && minx <= x1 && maxy >= y0 && miny <= y1) list.push(i);
      });
      nearby.push(list);
    }
  return { segments, nearby };
}

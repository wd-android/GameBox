/**
 * Cube topology (§6.4). Every cell is placed at a point in 3D, in doubled
 * units so all coordinates are whole numbers, and neighbours – including
 * across edges – are derived from geometry instead of hand-written tables.
 */

export type Vec3 = [number, number, number];

export const enum Face {
  PX = 0,
  NX = 1,
  PY = 2,
  NY = 3,
  PZ = 4,
  NZ = 5,
}

export const FACE_NAMES = ['+X', '−X', '+Y', '−Y', '+Z', '−Z'];

export const NORMALS: Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Face-local axes with u × v = N. */
export const U_AXES: Vec3[] = [
  [0, 1, 0],
  [0, 0, 1],
  [0, 0, 1],
  [1, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
];
export const V_AXES: Vec3[] = [
  [0, 0, 1],
  [0, 1, 0],
  [1, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
  [1, 0, 0],
];

/** Sides of a cell in face-local terms: 0 = +u, 1 = +v, 2 = −u, 3 = −v. */
export const SIDE_DU = [1, 0, -1, 0];
export const SIDE_DV = [0, 1, 0, -1];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function scale(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function eq(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function faceOfNormal(n: Vec3): number {
  for (let f = 0; f < 6; f++) if (eq(NORMALS[f], n)) return f;
  throw new Error('not a face normal: ' + n.join(','));
}

/** The side of a face that points along a cube axis, or −1. */
export function sideOfDirection(face: number, d: Vec3): number {
  for (let s = 0; s < 4; s++) {
    const dir = add(scale(U_AXES[face], SIDE_DU[s]), scale(V_AXES[face], SIDE_DV[s]));
    if (eq(dir, d)) return s;
  }
  return -1;
}

export function sideDirection(face: number, side: number): Vec3 {
  return add(scale(U_AXES[face], SIDE_DU[side]), scale(V_AXES[face], SIDE_DV[side]));
}

export interface Topology {
  n: number;
  cellCount: number;
  /** neighbour[cell * 4 + side] = cell */
  neighbour: Int32Array;
  /** backSide[cell * 4 + side] = the side of the neighbour that points back */
  backSide: Int8Array;
  /** Doubled-unit 3D centre of each cell. */
  point: Vec3[];
}

export function cellIndex(n: number, face: number, col: number, row: number): number {
  return face * n * n + row * n + col;
}

export function cellFace(n: number, cell: number): number {
  return Math.floor(cell / (n * n));
}

export function cellCol(n: number, cell: number): number {
  return cell % n;
}

export function cellRow(n: number, cell: number): number {
  return Math.floor(cell / n) % n;
}

export function cellPoint(n: number, face: number, col: number, row: number): Vec3 {
  return add(add(scale(NORMALS[face], n), scale(U_AXES[face], 2 * col - n + 1)), scale(V_AXES[face], 2 * row - n + 1));
}

const cache = new Map<number, Topology>();

export function topology(n: number): Topology {
  const cached = cache.get(n);
  if (cached) return cached;
  const cellCount = 6 * n * n;
  const point: Vec3[] = [];
  const lookup = new Map<string, number>();
  for (let f = 0; f < 6; f++)
    for (let row = 0; row < n; row++)
      for (let col = 0; col < n; col++) {
        const p = cellPoint(n, f, col, row);
        point.push(p);
        lookup.set(p.join(','), cellIndex(n, f, col, row));
      }
  const neighbour = new Int32Array(cellCount * 4).fill(-1);
  const backSide = new Int8Array(cellCount * 4).fill(-1);
  for (let c = 0; c < cellCount; c++) {
    const f = cellFace(n, c);
    const N = NORMALS[f];
    const P = point[c];
    for (let s = 0; s < 4; s++) {
      const d = sideDirection(f, s);
      const Q = add(P, scale(d, 2));
      let target: number | undefined;
      if (Math.abs(dot(Q, d)) <= n - 1) {
        target = lookup.get(Q.join(','));
      } else {
        target = lookup.get(add(add(P, d), scale(N, -1)).join(','));
      }
      if (target === undefined) throw new Error(`no neighbour for cell ${c} side ${s}`);
      neighbour[c * 4 + s] = target;
    }
  }
  for (let c = 0; c < cellCount; c++)
    for (let s = 0; s < 4; s++) {
      const t = neighbour[c * 4 + s];
      for (let b = 0; b < 4; b++) if (neighbour[t * 4 + b] === c) backSide[c * 4 + s] = b;
    }
  const topo = { n, cellCount, neighbour, backSide, point };
  cache.set(n, topo);
  return topo;
}

/** The four side faces in order around the cube (a ring about the Y axis). */
export const RING: number[] = [Face.PZ, Face.PX, Face.NZ, Face.NX];

/** Faces adjacent to a face (sharing an edge). */
export function adjacentFaces(f: number): number[] {
  const out: number[] = [];
  for (let g = 0; g < 6; g++) if (dot(NORMALS[f], NORMALS[g]) === 0) out.push(g);
  return out;
}

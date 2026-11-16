import { TUNING } from '../config/tuning';
import { Rng, hash } from './rng';
import { Face, RING, adjacentFaces, cellFace, cellIndex, topology, type Topology } from './topology';

/**
 * Maze generation (§6): one perfect maze over the whole cube, built in two
 * layers so there are exactly five gates. No rendering code.
 */

export interface Bands {
  length?: [number, number];
  detour?: [number, number];
  deadEnds?: [number, number];
}

export interface GenParams {
  routeFaces: number;
  windiness: number;
  holeShare: number;
  bands?: Bands;
}

export interface Gate {
  faceA: number;
  cellA: number;
  sideA: number;
  faceB: number;
  cellB: number;
  sideB: number;
}

export interface Measures {
  length: number;
  turns: number;
  deadEnds: number;
  longestDetour: number;
  shortestFaceCrossing: number;
}

export interface Cube {
  version: number;
  n: number;
  seed: number;
  attempt: number;
  params: GenParams;
  /** Per cell, 4 bits (one per side, 1 = open). Gates count as open. */
  open: Uint8Array;
  gates: Gate[];
  start: number;
  finish: number;
  holes: number[];
  solution: number[];
  /** Faces the solution passes through, in order. */
  routeFaces: number[];
  measures: Measures;
}

export function startCell(n: number): number {
  // +Y face, nearest the corner (−, +, −). On +Y, u = +Z and v = +X.
  return cellIndex(n, Face.PY, 0, 0);
}

export function finishCell(n: number): number {
  // −Y face, nearest the corner (+, −, +). On −Y, u = +X and v = +Z.
  return cellIndex(n, Face.NY, n - 1, n - 1);
}

/** Layer 1 (§6.5): five links joining the six faces with no loops. */
export function connectFaces(routeFaces: number, rng: Rng): { links: [number, number][]; route: number[] } {
  const first = rng.int(4);
  const direction = rng.pick([1, -1]);
  const sides: number[] = [];
  for (let i = 0; i < routeFaces - 2; i++) sides.push(RING[(((first + direction * i) % 4) + 4) % 4]);
  const route = [Face.PY as number, ...sides, Face.NY as number];
  const links: [number, number][] = [];
  for (let i = 0; i < route.length - 1; i++) links.push([route[i], route[i + 1]]);
  const linked = new Set(route);
  for (const f of RING) {
    if (linked.has(f)) continue;
    const options = adjacentFaces(f).filter((g) => linked.has(g));
    const to = rng.pick(options);
    links.push([to, f]);
    linked.add(f);
  }
  return { links, route };
}

/** Layer 2 (§6.6): growing-tree maze inside one face. */
function carveFace(topo: Topology, open: Uint8Array, face: number, windiness: number, rng: Rng): void {
  const n = topo.n;
  const base = face * n * n;
  const visited = new Uint8Array(n * n);
  const first = base + rng.int(n * n);
  visited[first - base] = 1;
  const active = [first];
  while (active.length) {
    const index = rng.float() < windiness ? active.length - 1 : rng.int(active.length);
    const cell = active[index];
    const options: number[] = [];
    for (let s = 0; s < 4; s++) {
      const t = topo.neighbour[cell * 4 + s];
      if (cellFace(n, t) === face && !visited[t - base]) options.push(s);
    }
    if (!options.length) {
      active.splice(index, 1);
      continue;
    }
    const s = rng.pick(options);
    const next = topo.neighbour[cell * 4 + s];
    open[cell] |= 1 << s;
    open[next] |= 1 << topo.backSide[cell * 4 + s];
    visited[next - base] = 1;
    active.push(next);
  }
}

/** §6.7: one gate per link. */
function openGates(topo: Topology, open: Uint8Array, links: [number, number][], start: number, finish: number, rng: Rng): Gate[] | null {
  const n = topo.n;
  const used = new Set<number>([start, finish]);
  const gates: Gate[] = [];
  for (const [fa, fb] of links) {
    const candidates: Gate[] = [];
    for (let c = fa * n * n; c < (fa + 1) * n * n; c++)
      for (let s = 0; s < 4; s++) {
        const t = topo.neighbour[c * 4 + s];
        if (cellFace(n, t) !== fb) continue;
        if (used.has(c) || used.has(t)) continue;
        candidates.push({ faceA: fa, cellA: c, sideA: s, faceB: fb, cellB: t, sideB: topo.backSide[c * 4 + s] });
      }
    if (!candidates.length) return null;
    const g = rng.pick(candidates);
    open[g.cellA] |= 1 << g.sideA;
    open[g.cellB] |= 1 << g.sideB;
    used.add(g.cellA);
    used.add(g.cellB);
    gates.push(g);
  }
  return gates;
}

/** Breadth-first search; returns parent links from `from`. */
export function bfs(topo: Topology, open: Uint8Array, from: number): Int32Array {
  const parent = new Int32Array(topo.cellCount).fill(-2);
  parent[from] = -1;
  const queue = [from];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    for (let s = 0; s < 4; s++) {
      if (!(open[c] & (1 << s))) continue;
      const t = topo.neighbour[c * 4 + s];
      if (parent[t] !== -2) continue;
      parent[t] = c;
      queue.push(t);
    }
  }
  return parent;
}

export function solve(topo: Topology, open: Uint8Array, start: number, finish: number): number[] {
  const parent = bfs(topo, open, start);
  if (parent[finish] === -2) return [];
  const path: number[] = [];
  for (let c = finish; c !== -1; c = parent[c]) path.push(c);
  return path.reverse();
}

function sideBetween(topo: Topology, a: number, b: number): number {
  for (let s = 0; s < 4; s++) if (topo.neighbour[a * 4 + s] === b) return s;
  return -1;
}

/** §6.8 */
export function measure(topo: Topology, open: Uint8Array, solution: number[], start: number, finish: number): Measures {
  const n = topo.n;
  // Turns: compare the 3D direction of travel into a cell with the direction out of it.
  let turns = 0;
  let arrive: string | null = null;
  for (let i = 0; i < solution.length - 1; i++) {
    const a = solution[i];
    const b = solution[i + 1];
    const fa = cellFace(n, a);
    const fb = cellFace(n, b);
    const pa = topo.point[a];
    const pb = topo.point[b];
    let out: number[];
    let nextArrive: number[];
    if (fa === fb) {
      out = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
      nextArrive = out;
    } else {
      // Leaving face fa in the direction of fb's normal; arriving on fb moving along −(fa's normal).
      const s = sideBetween(topo, a, b);
      const d = sideVec(topo, a, s);
      out = d;
      const na = normalOfCell(topo, a);
      nextArrive = [-na[0], -na[1], -na[2]];
    }
    const key = dirKey(out);
    if (arrive !== null && arrive !== key) turns++;
    arrive = dirKey(nextArrive);
  }

  const onRoute = new Uint8Array(topo.cellCount);
  for (const c of solution) onRoute[c] = 1;

  let deadEnds = 0;
  for (let c = 0; c < topo.cellCount; c++) {
    if (c === start || c === finish) continue;
    if (popcount(open[c]) === 1) deadEnds++;
  }

  // Longest detour: the largest branch hanging off the route.
  let longestDetour = 0;
  const seen = new Uint8Array(topo.cellCount);
  for (const r of solution) {
    for (let s = 0; s < 4; s++) {
      if (!(open[r] & (1 << s))) continue;
      const t = topo.neighbour[r * 4 + s];
      if (onRoute[t] || seen[t]) continue;
      let size = 0;
      const stack = [t];
      seen[t] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        size++;
        for (let k = 0; k < 4; k++) {
          if (!(open[c] & (1 << k))) continue;
          const u = topo.neighbour[c * 4 + k];
          if (onRoute[u] || seen[u]) continue;
          seen[u] = 1;
          stack.push(u);
        }
      }
      longestDetour = Math.max(longestDetour, size);
    }
  }

  // Shortest face crossing: cells on each intermediate route face.
  let shortestFaceCrossing = Infinity;
  let runFace = -1;
  let run = 0;
  const runs: { face: number; len: number }[] = [];
  for (const c of solution) {
    const f = cellFace(n, c);
    if (f !== runFace) {
      if (runFace !== -1) runs.push({ face: runFace, len: run });
      runFace = f;
      run = 0;
    }
    run++;
  }
  runs.push({ face: runFace, len: run });
  for (let i = 1; i < runs.length - 1; i++) shortestFaceCrossing = Math.min(shortestFaceCrossing, runs[i].len);
  if (!Number.isFinite(shortestFaceCrossing)) shortestFaceCrossing = n * n;

  return { length: solution.length, turns, deadEnds, longestDetour, shortestFaceCrossing };
}

function popcount(x: number): number {
  let k = 0;
  for (; x; x &= x - 1) k++;
  return k;
}

function dirKey(d: number[]): string {
  return `${Math.sign(d[0])},${Math.sign(d[1])},${Math.sign(d[2])}`;
}

function normalOfCell(topo: Topology, c: number): number[] {
  const p = topo.point[c];
  const n = topo.n;
  return p.map((v) => (Math.abs(v) === n ? Math.sign(v) : 0));
}

function sideVec(topo: Topology, c: number, s: number): number[] {
  const t = topo.neighbour[c * 4 + s];
  const nt = normalOfCell(topo, t);
  return nt;
}

function bandDistance(m: Measures, bands: Bands | undefined): number {
  if (!bands) return 0;
  let d = 0;
  const check = (v: number, b?: [number, number]) => {
    if (!b) return;
    if (v < b[0]) d += b[0] - v;
    else if (v > b[1]) d += v - b[1];
  };
  check(m.length, bands.length);
  check(m.longestDetour, bands.detour);
  check(m.deadEnds, bands.deadEnds);
  return d;
}

/** §6.10: holes in dead ends, off the route, away from gates. */
function placeHoles(topo: Topology, cube: Omit<Cube, 'holes'>, rng: Rng): number[] {
  const n = topo.n;
  if (n < 5 || cube.params.holeShare <= 0) return [];
  const onRoute = new Set(cube.solution);
  const gateCells = new Set<number>();
  for (const g of cube.gates) {
    gateCells.add(g.cellA);
    gateCells.add(g.cellB);
  }
  // Maze distance from the nearest gate cell.
  const dist = new Int32Array(topo.cellCount).fill(-1);
  const queue: number[] = [];
  for (const g of gateCells) {
    dist[g] = 0;
    queue.push(g);
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    for (let s = 0; s < 4; s++) {
      if (!(cube.open[c] & (1 << s))) continue;
      const t = topo.neighbour[c * 4 + s];
      if (dist[t] !== -1) continue;
      dist[t] = dist[c] + 1;
      queue.push(t);
    }
  }
  const eligible: number[] = [];
  for (let c = 0; c < topo.cellCount; c++) {
    if (c === cube.start || c === cube.finish || gateCells.has(c) || onRoute.has(c)) continue;
    if (popcount(cube.open[c]) !== 1) continue;
    if (dist[c] < TUNING.HOLE_MIN_GATE_DISTANCE) continue;
    eligible.push(c);
  }
  // Deterministic shuffle, then take the share.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const count = Math.round(eligible.length * cube.params.holeShare);
  return eligible.slice(0, count).sort((a, b) => a - b);
}

/** §6.9: generate, measure, accept or retry. */
export function generateCube(n: number, seed: number, params: GenParams, withHoles = true): Cube {
  const topo = topology(n);
  const start = startCell(n);
  const finish = finishCell(n);
  let best: { cube: Omit<Cube, 'holes'>; rng: Rng; score: number } | null = null;

  for (let attempt = 0; attempt < TUNING.MAX_ATTEMPTS; attempt++) {
    const rng = new Rng(hash(seed, attempt, TUNING.GENERATOR_VERSION, n));
    const { links, route } = connectFaces(params.routeFaces, rng);
    const open = new Uint8Array(topo.cellCount);
    for (let f = 0; f < 6; f++) carveFace(topo, open, f, params.windiness, rng);
    const gates = openGates(topo, open, links, start, finish, rng);
    if (!gates) continue;
    const solution = solve(topo, open, start, finish);
    const measures = measure(topo, open, solution, start, finish);
    // Rejected outright: a route face crossed in under 2 cells (from n = 4).
    const hardFail = n >= 4 && measures.shortestFaceCrossing < TUNING.MIN_FACE_CROSSING;
    const score = (hardFail ? 1e6 : 0) + bandDistance(measures, params.bands);
    const cube = { version: TUNING.GENERATOR_VERSION, n, seed, attempt, params, open, gates, start, finish, solution, routeFaces: route, measures };
    if (score === 0) return { ...cube, holes: withHoles ? placeHoles(topo, cube, rng) : [] };
    if (!best || score < best.score) best = { cube, rng, score };
  }
  const b = best!;
  return { ...b.cube, holes: withHoles ? placeHoles(topo, b.cube, b.rng) : [] };
}

/** Default parameters for a size, used by cube codes, Daily Cube and Explore. */
export function defaultParams(n: number): GenParams {
  if (n <= 3) return { routeFaces: 3, windiness: 0.9, holeShare: 0 };
  if (n === 4) return { routeFaces: 4, windiness: 0.8, holeShare: 0 };
  if (n === 5) return { routeFaces: 4, windiness: 0.7, holeShare: 0.3 };
  return { routeFaces: 5, windiness: 0.6, holeShare: 0.4 };
}

/** Cube code `version-n-seed` (§6.11). */
export function cubeCode(n: number, seed: number): string {
  return `${TUNING.GENERATOR_VERSION}-${n}-${seed}`;
}

export function parseCubeCode(code: string): { version: number; n: number; seed: number } | null {
  const m = /^\s*(\d+)-(\d+)-(\d+)\s*$/.exec(code);
  if (!m) return null;
  const version = Number(m[1]);
  const n = Number(m[2]);
  const seed = Number(m[3]);
  if (version !== TUNING.GENERATOR_VERSION || n < 3 || n > 9 || seed > 0xffffffff) return null;
  return { version, n, seed };
}

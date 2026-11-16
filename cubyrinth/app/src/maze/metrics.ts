import { cellFace, type Topology } from './topology';

/**
 * Measuring (§6.8): the figures a cube is accepted or retried on, and the
 * ones the calibration script records. No rendering code.
 */

export interface Measures {
  length: number;
  turns: number;
  deadEnds: number;
  longestDetour: number;
  shortestFaceCrossing: number;
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

/** Number of open sides in a cell's 4-bit mask. */
export function popcount(x: number): number {
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

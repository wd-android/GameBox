import { TUNING } from '../../config/tuning';
import { Rng, hash } from '../rng';
import type { HintResult, LockSpec, LockType } from '../types';

/**
 * Concentric rings (§6.3): a round picture cut into rings, each turned.
 * Turn rings in steps until the picture is whole. A linkage means turning
 * one ring also turns another by one step, the same way or the opposite.
 * Ring 0 is the innermost.
 */
export interface Linkage {
  driver: number;
  follower: number;
  sign: 1 | -1;
}

export interface RingsPuzzle {
  type: 'rings';
  spec: LockSpec;
  steps: number;
  linkages: Linkage[];
  /** Starting offsets (0 = aligned). */
  start: number[];
  shortest: number;
  attempt: number;
  /** Which picture to draw (cosmetic). */
  picture: number;
}

export interface RingsState {
  offsets: number[];
  moves: number;
}

export type RingsMove = { kind: 'turn'; ring: number; dir: 1 | -1 };

export function turn(p: { steps: number; linkages: Linkage[] }, offsets: number[], ring: number, dir: number): number[] {
  const k = p.steps;
  const o = [...offsets];
  o[ring] = (((o[ring] + dir) % k) + k) % k;
  for (const l of p.linkages) if (l.driver === ring) o[l.follower] = (((o[l.follower] + dir * l.sign) % k) + k) % k;
  return o;
}

function encode(o: number[], k: number): number {
  let v = 0;
  for (let i = o.length - 1; i >= 0; i--) v = v * k + o[i];
  return v;
}

function decode(v: number, n: number, k: number): number[] {
  const o: number[] = [];
  for (let i = 0; i < n; i++) {
    o.push(v % k);
    v = Math.floor(v / k);
  }
  return o;
}

/** Distance from every state to solved (moves are reversible, so one search from solved). */
const distCache = new Map<string, Int16Array>();
export function distances(p: { steps: number; linkages: Linkage[]; spec: { parts: number } }): Int16Array {
  const n = p.spec.parts;
  const k = p.steps;
  const key = `${n}/${k}/${p.linkages.map((l) => `${l.driver}${l.follower}${l.sign}`).join(',')}`;
  let dist = distCache.get(key);
  if (dist) return dist;
  const size = k ** n;
  dist = new Int16Array(size).fill(-1);
  dist[0] = 0;
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  queue[tail++] = 0;
  while (head < tail) {
    const v = queue[head++];
    const o = decode(v, n, k);
    for (let r = 0; r < n; r++)
      for (const dir of [1, -1]) {
        const w = encode(turn(p, o, r, dir), k);
        if (dist[w] === -1) {
          dist[w] = dist[v] + 1;
          queue[tail++] = w;
        }
      }
  }
  if (distCache.size > 30) distCache.clear();
  distCache.set(key, dist);
  return dist;
}

export function shortestFrom(p: RingsPuzzle, offsets: number[]): number {
  return distances(p)[encode(offsets, p.steps)];
}

export const Rings: LockType<RingsPuzzle, RingsState, RingsMove> = {
  id: 'rings',
  isAttemptBased: false,

  generate(spec, seed) {
    const n = spec.parts;
    const steps = spec.steps ?? 8;
    const want = spec.information === 'full' ? 0 : Math.min(spec.linkages ?? 1, n * (n - 1));
    const [lo, hi] = TUNING.RING_SHORTEST_BAND[n] ?? [n, 14];
    let best: RingsPuzzle | null = null;
    for (let attempt = 0; attempt < TUNING.MAX_ATTEMPTS; attempt++) {
      const rng = new Rng(hash(seed, attempt, 3));
      const pairs: Linkage[] = [];
      while (pairs.length < want) {
        const driver = rng.int(n);
        const follower = rng.int(n);
        if (driver === follower || pairs.some((l) => l.driver === driver && l.follower === follower)) continue;
        pairs.push({ driver, follower, sign: rng.int(2) ? 1 : -1 });
      }
      let o = new Array(n).fill(0);
      for (let t = 0; t < TUNING.RING_SCRAMBLE_TURNS; t++) o = turn({ steps, linkages: pairs }, o, rng.int(n), rng.int(2) ? 1 : -1);
      const p: RingsPuzzle = { type: 'rings', spec, steps, linkages: pairs, start: o, shortest: 0, attempt, picture: rng.int(3) };
      p.shortest = shortestFrom(p, o);
      if (p.shortest >= Math.max(lo, n) && p.shortest <= hi) return p;
      if (p.shortest > 0 && (!best || Math.abs(p.shortest - lo) < Math.abs(best.shortest - lo))) best = p;
    }
    if (best) return best;
    throw new Error('rings: no puzzle');
  },

  initialState(p) {
    return { offsets: [...p.start], moves: 0 };
  },

  applyMove(p, s, m) {
    return { offsets: turn(p, s.offsets, m.ring, m.dir), moves: s.moves + 1 };
  },

  check(p, s, detail) {
    const which = s.offsets.map((o) => o === 0);
    const right = which.filter(Boolean).length;
    const solved = right === p.spec.parts;
    return detail === 'which' ? { solved, right, which, text: `${right} of ${p.spec.parts} rings aligned` } : { solved, right, text: `${right} of ${p.spec.parts} rings aligned` };
  },

  isSolved(_p, s) {
    return s.offsets.every((o) => o === 0);
  },

  hint(p, s, kind): HintResult<RingsState, RingsPuzzle> | null {
    if (kind !== 'nudge') return null;
    const dist = distances(p);
    const here = dist[encode(s.offsets, p.steps)];
    for (let r = 0; r < p.spec.parts; r++)
      for (const dir of [1, -1] as const) {
        if (dist[encode(turn(p, s.offsets, r, dir), p.steps)] === here - 1) return { move: { ring: r, dir }, message: `Turn ring ${r + 1} ${dir > 0 ? 'clockwise' : 'anticlockwise'}.` };
      }
    return null;
  },

  par(p) {
    return p.shortest;
  },
};

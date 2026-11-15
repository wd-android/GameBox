import { TUNING } from '../../config/tuning';
import { Rng, hash } from '../rng';
import type { HintResult, LockSpec, LockType } from '../types';

/**
 * Sliding bolts (§6.4): a square frame of horizontal and vertical bolts.
 * Each slides only along its own length and cannot pass through another.
 * The brass latch (bolt 0) must slide fully out through the right side of
 * the exit row. One slide = moving one bolt any distance.
 */
export interface Bolt {
  /** Fixed coordinate: row for horizontal bolts, column for vertical. */
  line: number;
  len: number;
  horizontal: boolean;
}

export interface BoltsPuzzle {
  type: 'bolts';
  spec: LockSpec;
  size: number;
  exitRow: number;
  bolts: Bolt[];
  /** Starting position along each bolt's axis (column for horizontal, row for vertical). */
  start: number[];
  shortest: number;
  attempt: number;
}

export interface BoltsState {
  pos: number[];
  moves: number;
}

export type BoltsMove = { kind: 'slide'; bolt: number; to: number };

/** Occupancy grid for a position. */
function grid(p: { size: number; bolts: Bolt[] }, pos: number[], skip = -1): Uint8Array {
  const g = new Uint8Array(p.size * p.size);
  p.bolts.forEach((b, i) => {
    if (i === skip) return;
    for (let k = 0; k < b.len; k++) {
      const x = b.horizontal ? pos[i] + k : b.line;
      const y = b.horizontal ? b.line : pos[i] + k;
      g[y * p.size + x] = 1;
    }
  });
  return g;
}

/** The range a bolt can slide to: [min, max] start positions. */
export function slideRange(p: { size: number; bolts: Bolt[] }, pos: number[], i: number): [number, number] {
  const b = p.bolts[i];
  const g = grid(p, pos, i);
  const free = (t: number) => (b.horizontal ? g[b.line * p.size + t] === 0 : g[t * p.size + b.line] === 0);
  let lo = pos[i];
  while (lo - 1 >= 0 && free(lo - 1)) lo--;
  let hi = pos[i];
  while (hi + b.len < p.size && free(hi + b.len)) hi++;
  return [lo, hi];
}

export function solvedPos(p: BoltsPuzzle, pos: number[]): boolean {
  return pos[0] + p.bolts[0].len === p.size;
}

/** Breadth-first search for the fewest slides; returns the distance and the first slide of a shortest path. */
export function search(p: BoltsPuzzle, from: number[]): { shortest: number; first: BoltsMove | null } {
  const key = (pos: number[]) => pos.join(',');
  const seen = new Map<string, BoltsMove | null>();
  seen.set(key(from), null);
  let frontier: number[][] = [from];
  for (let depth = 0; frontier.length && depth < 60; depth++) {
    const next: number[][] = [];
    for (const pos of frontier) {
      if (solvedPos(p, pos)) return { shortest: depth, first: seen.get(key(pos)) ?? null };
      const firstMove = seen.get(key(pos)) ?? null;
      for (let i = 0; i < p.bolts.length; i++) {
        const [lo, hi] = slideRange(p, pos, i);
        for (let t = lo; t <= hi; t++) {
          if (t === pos[i]) continue;
          const np = [...pos];
          np[i] = t;
          const k = key(np);
          if (seen.has(k)) continue;
          seen.set(k, firstMove ?? { kind: 'slide', bolt: i, to: t });
          next.push(np);
        }
      }
    }
    frontier = next;
    if (seen.size > 400000) break;
  }
  return { shortest: -1, first: null };
}

export const BoltsLock: LockType<BoltsPuzzle, BoltsState, BoltsMove> = {
  id: 'bolts',
  isAttemptBased: false,

  generate(spec, seed) {
    const size = spec.size ?? 5;
    const count = spec.parts;
    const exitRow = Math.floor((size - 1) / 2);
    const [lo, hi] = TUNING.BOLT_SHORTEST_BAND[count] ?? [3, 12];
    let best: BoltsPuzzle | null = null;
    for (let attempt = 0; attempt < TUNING.MAX_ATTEMPTS; attempt++) {
      const rng = new Rng(hash(seed, attempt, 4));
      const bolts: Bolt[] = [{ line: exitRow, len: 2, horizontal: true }];
      const start = [rng.int(2)];
      const occupied = grid({ size, bolts }, start);
      let tries = 0;
      // Vertical bolts in the latch's path first, so it is never free at once.
      while (bolts.length < count && tries++ < 400) {
        const inPath = bolts.length <= 2 && rng.int(3) > 0;
        const horizontal = inPath ? false : rng.int(2) === 0;
        const len = rng.int(3) === 0 ? 3 : 2;
        const line = inPath ? rng.range(start[0] + 2, size - 1) : rng.int(size);
        if (horizontal && line === exitRow) continue;
        const p0 = inPath ? rng.range(Math.max(0, exitRow - len + 1), Math.min(exitRow, size - len)) : rng.int(size - len + 1);
        let ok = true;
        for (let k = 0; k < len; k++) {
          const x = horizontal ? p0 + k : line;
          const y = horizontal ? line : p0 + k;
          if (occupied[y * size + x]) ok = false;
        }
        if (!ok) continue;
        bolts.push({ line, len, horizontal });
        start.push(p0);
        for (let k = 0; k < len; k++) occupied[(horizontal ? line : p0 + k) * size + (horizontal ? p0 + k : line)] = 1;
      }
      if (bolts.length < count) continue;
      const p: BoltsPuzzle = { type: 'bolts', spec, size, exitRow, bolts, start, shortest: 0, attempt };
      const r = search(p, start);
      if (r.shortest < 1) continue;
      p.shortest = r.shortest;
      if (r.shortest >= lo && r.shortest <= hi) return p;
      if (!best || r.shortest > best.shortest) best = p;
    }
    if (best) return best;
    throw new Error('bolts: no puzzle');
  },

  initialState(p) {
    return { pos: [...p.start], moves: 0 };
  },

  applyMove(p, s, m) {
    const [lo, hi] = slideRange(p, s.pos, m.bolt);
    if (m.to < lo || m.to > hi || m.to === s.pos[m.bolt]) return s;
    const pos = [...s.pos];
    pos[m.bolt] = m.to;
    return { pos, moves: s.moves + 1 };
  },

  check(p, s) {
    const solved = solvedPos(p, s.pos);
    return { solved, text: solved ? 'Open!' : '' };
  },

  isSolved(p, s) {
    return solvedPos(p, s.pos);
  },

  hint(p, s, kind): HintResult<BoltsState, BoltsPuzzle> | null {
    if (kind !== 'nudge') return null;
    const r = search(p, s.pos);
    if (!r.first) return null;
    return { move: r.first, message: r.first.bolt === 0 ? 'Slide the brass latch next.' : 'Slide the highlighted bolt next.' };
  },

  par(p) {
    return p.shortest;
  },
};

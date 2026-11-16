import { TUNING } from '../config/tuning';
import { linkIndex, type PieceKind, type Placement, type Puzzle } from './model';

/**
 * Chain calculation (§6.1). Fixed rules, whole milliseconds: the same puzzle
 * and placement always give the same events, on every device.
 */

export interface FallEvent {
  slot: number;
  time: number;
  depth: number;
  /** The slot whose fall caused this one (−1 for the start). */
  by: number;
  /** How it was struck. */
  cause: 'start' | 'reach1' | 'bridge' | 'ball';
}

export interface ChainResult {
  fallen: FallEvent[];
  won: boolean;
  /** Fallen slots that struck nothing (§6.2). */
  stops: number[];
  /** Stopping points directly before a gap – the near misses. */
  nearMisses: { slot: number; gap: number }[];
  /** Ball launches, for drawing: trigger time and the ramp index. */
  balls: { ramp: number; time: number }[];
  /** Total duration in ms (last fall). */
  duration: number;
}

export function delay(depth: number): number {
  return Math.max(TUNING.DELAY_MIN_MS, TUNING.DELAY_START_MS - TUNING.DELAY_PER_DEPTH_MS * depth);
}

/** The piece each slot holds after the player's placement, or null. */
export function pieceAt(p: Puzzle, placement: Placement, slot: number): PieceKind | null {
  const h = p.slots[slot].holds;
  if (h !== 'gap') return h;
  return placement.get(slot) ?? null;
}

interface Pending {
  time: number;
  slot: number;
  by: number;
  depth: number;
  cause: FallEvent['cause'];
  seq: number;
}

export function calculate(p: Puzzle, placement: Placement): ChainResult {
  const idx = linkIndex(p);
  const n = p.slots.length;
  const standing = new Uint8Array(n);
  for (let s = 0; s < n; s++) if (pieceAt(p, placement, s)) standing[s] = 1;

  // A small binary heap ordered by (time, slot id).
  const heap: Pending[] = [];
  let seq = 0;
  const less = (a: Pending, b: Pending) => (a.time !== b.time ? a.time < b.time : a.slot !== b.slot ? a.slot < b.slot : a.seq < b.seq);
  const push = (e: Pending) => {
    heap.push(e);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!less(heap[i], heap[parent])) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  };
  const pop = (): Pending => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };

  push({ time: 0, slot: p.start, by: -1, depth: 0, cause: 'start', seq: seq++ });
  const fallen: FallEvent[] = [];
  const struckSomething = new Uint8Array(n);
  const balls: ChainResult['balls'] = [];

  while (heap.length) {
    const e = pop();
    if (!standing[e.slot]) continue;
    standing[e.slot] = 0;
    fallen.push({ slot: e.slot, time: e.time, depth: e.depth, by: e.by, cause: e.cause });
    const kind = pieceAt(p, placement, e.slot)!;
    const d = delay(e.depth);
    for (const b of idx.reach1[e.slot]) {
      if (pieceAt(p, placement, b)) {
        push({ time: e.time + d, slot: b, by: e.slot, depth: e.depth + 1, cause: 'reach1', seq: seq++ });
        struckSomething[e.slot] = 1;
      } else if (kind === 'tall') {
        // Bridge the empty slot b: strike along the matching reach-2 link past b.
        for (const c of idx.reach1[b]) {
          if (!idx.reach2[e.slot].has(c) || !pieceAt(p, placement, c)) continue;
          push({ time: e.time + d + TUNING.TALL_BRIDGE_EXTRA_MS, slot: c, by: e.slot, depth: e.depth + 1, cause: 'bridge', seq: seq++ });
          struckSomething[e.slot] = 1;
        }
      }
    }
    for (const r of idx.ramps[e.slot]) {
      const ri = p.ramps.indexOf(r);
      balls.push({ ramp: ri, time: e.time });
      push({ time: e.time + r.travelMs, slot: r.target, by: e.slot, depth: e.depth + 1, cause: 'ball', seq: seq++ });
      struckSomething[e.slot] = 1;
    }
  }

  const won = fallen.some((f) => f.slot === p.flag);
  const stops: number[] = [];
  const nearMisses: ChainResult['nearMisses'] = [];
  if (!won) {
    for (const f of fallen) {
      if (struckSomething[f.slot]) continue;
      stops.push(f.slot);
      for (const b of idx.reach1[f.slot]) if (!pieceAt(p, placement, b) && p.slots[b].holds === 'gap') nearMisses.push({ slot: f.slot, gap: b });
    }
  }
  const duration = fallen.length ? fallen[fallen.length - 1].time : 0;
  return { fallen, won, stops, nearMisses, balls, duration };
}

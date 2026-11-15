import { TUNING } from '../../config/tuning';
import { Rng, hash } from '../rng';
import type { Feedback, HintResult, LockSpec, LockType } from '../types';
import { parFor } from '../par';

/**
 * Coloured bottles (§6.2): put the bottles in the right order by swapping.
 * Each bottle differs in colour, silhouette and label symbol, so the puzzle
 * never depends on colour vision.
 */
export const BOTTLES = [
  { name: 'Red', colour: '#e8463c', shape: 'round', symbol: '♥' },
  { name: 'Blue', colour: '#3d7bff', shape: 'tall', symbol: '♦' },
  { name: 'Green', colour: '#34c759', shape: 'square', symbol: '♣' },
  { name: 'Yellow', colour: '#ffc93c', shape: 'flask', symbol: '★' },
  { name: 'Purple', colour: '#9259fe', shape: 'gourd', symbol: '♠' },
  { name: 'Orange', colour: '#ff8a2a', shape: 'jug', symbol: '●' },
  { name: 'White', colour: '#ecebf5', shape: 'slim', symbol: '▲' },
  { name: 'Teal', colour: '#06c8c8', shape: 'potion', symbol: '■' },
] as const;

export type BottleClue =
  | { kind: 'position'; a: number; pos: number }
  | { kind: 'notEnds'; a: number }
  | { kind: 'notPosition'; a: number; pos: number }
  | { kind: 'leftOf'; a: number; b: number }
  | { kind: 'nextTo'; a: number; b: number }
  | { kind: 'notNextTo'; a: number; b: number }
  | { kind: 'between'; a: number; b: number; c: number };

export interface BottlesPuzzle {
  type: 'bottles';
  spec: LockSpec;
  /** secret[position] = bottle id */
  secret: number[];
  clues: BottleClue[];
  attempt: number;
}

export interface BottlesState {
  order: number[];
  fixed: boolean[];
  history: { order: number[]; feedback: Feedback }[];
  extraClues: BottleClue[];
}

export type BottlesMove = { kind: 'swap'; i: number; j: number };

const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

export function bottleClueText(c: BottleClue): string {
  const n = (i: number) => BOTTLES[i].name;
  switch (c.kind) {
    case 'position':
      return `${n(c.a)} is ${ORD[c.pos]}.`;
    case 'notEnds':
      return `${n(c.a)} is not at either end.`;
    case 'notPosition':
      return `${n(c.a)} is not ${ORD[c.pos]}.`;
    case 'leftOf':
      return `${n(c.a)} is somewhere to the left of ${n(c.b)}.`;
    case 'nextTo':
      return `${n(c.a)} is next to ${n(c.b)}.`;
    case 'notNextTo':
      return `${n(c.a)} is not next to ${n(c.b)}.`;
    case 'between':
      return `${n(c.a)} is between ${n(c.b)} and ${n(c.c)}.`;
  }
}

/** pos[bottle] = position, from an order. */
function positions(order: number[]): number[] {
  const pos = new Array(order.length);
  order.forEach((b, i) => (pos[b] = i));
  return pos;
}

export function holds(c: BottleClue, pos: number[], count: number): boolean {
  switch (c.kind) {
    case 'position':
      return pos[c.a] === c.pos;
    case 'notEnds':
      return pos[c.a] !== 0 && pos[c.a] !== count - 1;
    case 'notPosition':
      return pos[c.a] !== c.pos;
    case 'leftOf':
      return pos[c.a] < pos[c.b];
    case 'nextTo':
      return Math.abs(pos[c.a] - pos[c.b]) === 1;
    case 'notNextTo':
      return Math.abs(pos[c.a] - pos[c.b]) !== 1;
    case 'between':
      return (pos[c.b] < pos[c.a] && pos[c.a] < pos[c.c]) || (pos[c.c] < pos[c.a] && pos[c.a] < pos[c.b]);
  }
}

const permCache = new Map<number, number[][]>();
/** Every order of n bottles, as pos[] arrays (position of each bottle). */
export function allPositions(n: number): number[][] {
  let out = permCache.get(n);
  if (out) return out;
  out = [];
  const cur: number[] = [];
  const used = new Array(n).fill(false);
  const rec = () => {
    if (cur.length === n) {
      out!.push([...cur]);
      return;
    }
    for (let p = 0; p < n; p++) {
      if (used[p]) continue;
      used[p] = true;
      cur.push(p);
      rec();
      cur.pop();
      used[p] = false;
    }
  };
  rec();
  permCache.set(n, out);
  return out;
}

export function consistentCount(n: number, clues: BottleClue[]): number {
  let k = 0;
  for (const pos of allPositions(n)) if (clues.every((c) => holds(c, pos, n))) k++;
  return k;
}

/** Every clue that is true of the secret. */
function truePool(secret: number[]): BottleClue[] {
  const n = secret.length;
  const pos = positions(secret);
  const pool: BottleClue[] = [];
  for (let a = 0; a < n; a++) {
    pool.push({ kind: 'position', a, pos: pos[a] });
    if (pos[a] !== 0 && pos[a] !== n - 1 && n >= 4) pool.push({ kind: 'notEnds', a });
    for (let p = 0; p < n; p++) if (p !== pos[a]) pool.push({ kind: 'notPosition', a, pos: p });
    for (let b = 0; b < n; b++) {
      if (b === a) continue;
      if (pos[a] < pos[b]) pool.push({ kind: 'leftOf', a, b });
      if (a < b && Math.abs(pos[a] - pos[b]) === 1) pool.push({ kind: 'nextTo', a, b });
      if (a < b && Math.abs(pos[a] - pos[b]) !== 1) pool.push({ kind: 'notNextTo', a, b });
      for (let c = b + 1; c < n; c++) if (c !== a && ((pos[b] < pos[a] && pos[a] < pos[c]) || (pos[c] < pos[a] && pos[a] < pos[b]))) pool.push({ kind: 'between', a, b, c });
    }
  }
  return pool;
}

/**
 * The deduction solver (§5.2): knowledge is the set of possible positions of
 * each bottle. Each clue on its own (with "one bottle per place") narrows the
 * sets, repeated until nothing changes; with depth 1 it may suppose one
 * bottle's place and strike it out if that contradicts.
 */
export function deduceBottles(n: number, clues: BottleClue[], depth: number): boolean {
  const all = allPositions(n);
  const propagate = (dom: Set<number>[]): Set<number>[] | null => {
    let d = dom;
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of clues) {
        const next: Set<number>[] = Array.from({ length: n }, () => new Set());
        let any = false;
        for (const pos of all) {
          let ok = true;
          for (let b = 0; b < n; b++)
            if (!d[b].has(pos[b])) {
              ok = false;
              break;
            }
          if (!ok || !holds(c, pos, n)) continue;
          any = true;
          for (let b = 0; b < n; b++) next[b].add(pos[b]);
        }
        if (!any) return null;
        for (let b = 0; b < n; b++) if (next[b].size < d[b].size) changed = true;
        d = next;
      }
    }
    return d;
  };
  let dom: Set<number>[] | null = Array.from({ length: n }, () => new Set(Array.from({ length: n }, (_, i) => i)));
  for (let round = 0; round < 20; round++) {
    dom = propagate(dom!);
    if (!dom) return false;
    if (dom.every((s) => s.size === 1)) return true;
    if (depth < 1) return false;
    let struck = false;
    for (let b = 0; b < n && !struck; b++)
      for (const v of [...dom[b]]) {
        const trial = dom.map((s, k) => (k === b ? new Set([v]) : new Set(s)));
        if (!propagate(trial)) {
          dom[b].delete(v);
          struck = true;
        }
      }
    if (!struck) return false;
  }
  return false;
}

function generateClued(spec: LockSpec, rng: Rng): { secret: number[]; clues: BottleClue[] } | null {
  const n = spec.parts;
  const secret = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  const pool = rng.shuffle(truePool(secret));
  const clues: BottleClue[] = [];
  let left = allPositions(n).length;
  for (const c of pool) {
    if (c.kind === 'position' && clues.some((x) => x.kind === 'position')) continue; // at most one
    const next = consistentCount(n, [...clues, c]);
    if (next < left) {
      clues.push(c);
      left = next;
    }
    if (left === 1) break;
  }
  if (left !== 1) return null;
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = clues.filter((_, k) => k !== i);
    if (consistentCount(n, without) === 1) clues.splice(i, 1);
  }
  const [lo, hi] = TUNING.BOTTLE_CLUE_BAND[n] ?? [2, 10];
  if (clues.length < lo || clues.length > hi) return null;
  if (n >= 5 && new Set(clues.map((c) => c.kind)).size < 3) return null;
  if (clues.some((c) => consistentCount(n, [c]) === 1)) return null;
  if (!deduceBottles(n, clues, spec.depth ?? 0)) return null;
  return { secret, clues };
}

export const Bottles: LockType<BottlesPuzzle, BottlesState, BottlesMove> = {
  id: 'bottles',
  isAttemptBased: true,

  generate(spec, seed) {
    for (let attempt = 0; attempt < TUNING.MAX_ATTEMPTS; attempt++) {
      const rng = new Rng(hash(seed, attempt, 2));
      if (spec.information === 'clued') {
        const g = generateClued(spec, rng);
        if (g) return { type: 'bottles', spec, secret: g.secret, clues: g.clues, attempt };
        continue;
      }
      return { type: 'bottles', spec, secret: rng.shuffle(Array.from({ length: spec.parts }, (_, i) => i)), clues: [], attempt };
    }
    throw new Error('bottles: no puzzle in 100 attempts');
  },

  initialState(p) {
    // Start in an order that is not the answer, and not simply reversed into it.
    const n = p.spec.parts;
    const rng = new Rng(hash(p.secret.reduce((a, b) => a * 10 + b, 0), 5));
    let order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
    let guard = 0;
    while (order.some((b, i) => b === p.secret[i]) && guard++ < 50) order = rng.shuffle(order);
    return { order, fixed: new Array(n).fill(false), history: [], extraClues: [] };
  },

  applyMove(_p, s, m) {
    if (m.i === m.j || s.fixed[m.i] || s.fixed[m.j]) return s;
    const order = [...s.order];
    [order[m.i], order[m.j]] = [order[m.j], order[m.i]];
    return { ...s, order };
  },

  check(p, s, detail) {
    const which = s.order.map((b, i) => b === p.secret[i]);
    const right = which.filter(Boolean).length;
    const solved = right === p.spec.parts;
    if (solved) return { solved, text: 'Open!', right };
    if (p.spec.information !== 'feedback') return { solved, text: "That's not it." };
    if (detail === 'howMany') return { solved, right, text: `${right} bottle${right === 1 ? ' is' : 's are'} in the right place.` };
    return { solved, right, which, text: `${right} in the right place (lit).` };
  },

  isSolved(p, s) {
    return s.order.every((b, i) => b === p.secret[i]);
  },

  hint(p, s, kind): HintResult<BottlesState, BottlesPuzzle> | null {
    const n = p.spec.parts;
    if (kind === 'nudge') {
      const i = s.order.findIndex((b, k) => !s.fixed[k] && b !== p.secret[k]);
      const k = i >= 0 ? i : s.fixed.findIndex((f) => !f);
      if (k < 0) return null;
      const order = [...s.order];
      const j = order.indexOf(p.secret[k]);
      [order[k], order[j]] = [order[j], order[k]];
      const fixed = [...s.fixed];
      fixed[k] = true;
      return { state: { ...s, order, fixed }, message: `${BOTTLES[p.secret[k]].name} belongs ${ORD[k]}.` };
    }
    const known = [...p.clues, ...s.extraClues];
    const fixedClues: BottleClue[] = s.fixed.flatMap((f, i) => (f ? [{ kind: 'position', a: p.secret[i], pos: i } as BottleClue] : []));
    const histOk = (pos: number[]) =>
      s.history.every((h) => {
        if (h.feedback.right === undefined) return true;
        let r = 0;
        h.order.forEach((b, i) => (pos[b] === i ? r++ : 0));
        return r === h.feedback.right;
      });
    const rem = allPositions(n).filter((pos) => [...known, ...fixedClues].every((c) => holds(c, pos, n)) && histOk(pos));
    if (rem.length <= 1) return null;
    const pool = new Rng(hash(p.secret.length, s.extraClues.length, 99)).shuffle(truePool(p.secret));
    for (const c of pool) {
      const left = rem.filter((pos) => holds(c, pos, n)).length;
      if (left <= rem.length * (1 - TUNING.CLUE_MIN_CUT) && left >= 1) return { state: { ...s, extraClues: [...s.extraClues, c] }, message: bottleClueText(c) };
    }
    return null;
  },

  par(p, detail) {
    if (p.spec.information !== 'feedback') return 1;
    return parFor('bottles', p.spec.parts, detail);
  },
};

import { TUNING } from '../../config/tuning';
import { Rng, hash } from '../rng';
import type { Feedback, HintResult, LockSpec, LockType } from '../types';
import { parFor } from '../par';

/**
 * Digit padlock (§6.1): wheels showing 0–9, all digits different in v1.
 * Full: the code is scratched on the chest. Clued: sample codes with
 * statements. Feedback: only the result of each try.
 */
export interface Clue {
  guess: number[];
  right: number;
  wrong: number;
}

export interface PadlockPuzzle {
  type: 'padlock';
  spec: LockSpec;
  secret: number[];
  clues: Clue[];
  /** Full: where the code is shown ("scratched on the lid", "on a tag"). */
  shown: string | null;
  attempt: number;
}

export interface PadlockState {
  wheels: number[];
  /** Wheels fixed by a Nudge. */
  fixed: boolean[];
  history: { code: number[]; feedback: Feedback }[];
  /** Extra clues added by the Clue hint. */
  extraClues: Clue[];
}

export type PadlockMove = { kind: 'turn'; wheel: number; delta: number };

export function score(secret: number[], guess: number[]): { right: number; wrong: number } {
  let right = 0;
  let wrong = 0;
  guess.forEach((d, i) => {
    if (secret[i] === d) right++;
    else if (secret.includes(d)) wrong++;
  });
  return { right, wrong };
}

export function clueText(c: { right: number; wrong: number }): string {
  const total = c.right + c.wrong;
  const num = ['Nothing', 'One', 'Two', 'Three', 'Four', 'Five'];
  if (total === 0) return 'Nothing is correct.';
  if (c.wrong === 0) return total === 1 ? 'One digit is correct and in the right place.' : `${num[total]} digits are correct and in the right place.`;
  if (c.right === 0) return total === 1 ? 'One digit is correct but in the wrong place.' : `${num[total]} digits are correct, but all in the wrong place.`;
  return `${num[total]} digits are correct; ${c.right === 1 ? 'one is' : `${num[c.right].toLowerCase()} are`} in the right place.`;
}

/** Every code with distinct digits for n wheels. */
const allCache = new Map<number, number[][]>();
export function allCodes(n: number): number[][] {
  let out = allCache.get(n);
  if (out) return out;
  out = [];
  const cur: number[] = [];
  const used = new Array(10).fill(false);
  const rec = () => {
    if (cur.length === n) {
      out!.push([...cur]);
      return;
    }
    for (let d = 0; d < 10; d++) {
      if (used[d]) continue;
      used[d] = true;
      cur.push(d);
      rec();
      cur.pop();
      used[d] = false;
    }
  };
  rec();
  allCache.set(n, out);
  return out;
}

export function consistent(code: number[], clues: Clue[]): boolean {
  for (const c of clues) {
    const s = score(code, c.guess);
    if (s.right !== c.right || s.wrong !== c.wrong) return false;
  }
  return true;
}

function randomCode(n: number, rng: Rng): number[] {
  return rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, n);
}

/**
 * The deduction solver (§5.2). Knowledge is a set of possible digits per
 * wheel. Each clue is applied on its own (with "all digits different") and
 * narrows the wheels to the digits still possible; this repeats until
 * nothing changes. With depth 1 the solver may suppose one wheel's digit,
 * and strike it out if that leads to a contradiction.
 */
export function deduce(n: number, clues: Clue[], depth: number): { solved: boolean; steps: number; code: number[] | null } {
  const codes = allCodes(n);
  // For each clue, the codes consistent with it on its own (computed once).
  const lists = clues.map((c) => codes.filter((code) => {
    const s = score(code, c.guess);
    return s.right === c.right && s.wrong === c.wrong;
  }));
  const propagate = (dom: Set<number>[]): Set<number>[] | null => {
    let changed = true;
    let d = dom.map((x) => new Set(x));
    while (changed) {
      changed = false;
      for (const list of lists) {
        const next: Set<number>[] = Array.from({ length: n }, () => new Set());
        let any = false;
        for (const code of list) {
          let ok = true;
          for (let i = 0; i < n; i++)
            if (!d[i].has(code[i])) {
              ok = false;
              break;
            }
          if (!ok) continue;
          any = true;
          for (let i = 0; i < n; i++) next[i].add(code[i]);
        }
        if (!any) return null;
        for (let i = 0; i < n; i++) if (next[i].size < d[i].size) changed = true;
        d = next;
      }
    }
    return d;
  };
  let dom: Set<number>[] | null = Array.from({ length: n }, () => new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  let steps = 0;
  for (let round = 0; round < 20; round++) {
    dom = propagate(dom!);
    if (!dom) return { solved: false, steps, code: null };
    if (dom.every((s) => s.size === 1)) {
      const code = dom.map((s) => [...s][0]);
      return consistent(code, clues) && new Set(code).size === n ? { solved: true, steps, code } : { solved: false, steps, code: null };
    }
    if (depth < 1) return { solved: false, steps, code: null };
    // One "suppose this, then…": strike out any candidate that leads to a contradiction.
    let struck = false;
    for (let i = 0; i < n && !struck; i++)
      for (const v of [...dom[i]]) {
        const trial = dom.map((s, k) => (k === i ? new Set([v]) : new Set(s)));
        if (!propagate(trial)) {
          dom[i].delete(v);
          struck = true;
          steps++;
        }
      }
    if (!struck) return { solved: false, steps, code: null };
  }
  return { solved: false, steps, code: null };
}

/** Indices of codes consistent with one clue, as a mask (for fast counting). */
function clueMask(codes: number[][], c: Clue): Uint8Array {
  const m = new Uint8Array(codes.length);
  for (let i = 0; i < codes.length; i++) {
    const s = score(codes[i], c.guess);
    if (s.right === c.right && s.wrong === c.wrong) m[i] = 1;
  }
  return m;
}

function countAll(masks: Uint8Array[], len: number): number {
  let k = 0;
  outer: for (let i = 0; i < len; i++) {
    for (const m of masks) if (!m[i]) continue outer;
    k++;
  }
  return k;
}

function generateClued(spec: LockSpec, rng: Rng, earlyChapter: boolean): { secret: number[]; clues: Clue[] } | null {
  const n = spec.parts;
  const secret = randomCode(n, rng);
  const codes = allCodes(n);
  const clues: Clue[] = [];
  const masks: Uint8Array[] = [];
  let left = codes.length;
  let tries = 0;
  while (left > 1 && clues.length < TUNING.PADLOCK_MAX_CLUES_TRIED && tries++ < 60) {
    let guess = randomCode(n, rng);
    while (guess.every((d, i) => d === secret[i])) guess = randomCode(n, rng);
    const clue = { guess, ...score(secret, guess) };
    const m = clueMask(codes, clue);
    const next = countAll([...masks, m], codes.length);
    if (next === left) continue; // adds nothing
    clues.push(clue);
    masks.push(m);
    left = next;
  }
  if (left !== 1) return null;
  // Keep the set minimal.
  for (let i = clues.length - 1; i >= 0; i--) {
    if (countAll(masks.filter((_, k) => k !== i), codes.length) === 1) {
      clues.splice(i, 1);
      masks.splice(i, 1);
    }
  }
  if (clues.length < TUNING.PADLOCK_CLUES_MIN || clues.length > TUNING.PADLOCK_CLUES_MAX) return null;
  if (earlyChapter && !clues.some((c) => c.right === 0 && c.wrong === 0)) return null;
  // Not trivial: no single clue gives the whole answer.
  if (masks.some((m) => countAll([m], codes.length) === 1)) return null;
  if (!deduce(n, clues, spec.depth ?? 0).solved) return null;
  return { secret, clues };
}

export const Padlock: LockType<PadlockPuzzle, PadlockState, PadlockMove> = {
  id: 'padlock',
  isAttemptBased: true,

  generate(spec, seed) {
    for (let attempt = 0; attempt < TUNING.MAX_ATTEMPTS; attempt++) {
      const rng = new Rng(hash(seed, attempt, 1));
      if (spec.information === 'clued') {
        const g = generateClued(spec, rng, (spec.depth ?? 0) === 0);
        if (g) return { type: 'padlock', spec, secret: g.secret, clues: g.clues, shown: null, attempt };
        continue;
      }
      const secret = randomCode(spec.parts, rng);
      return { type: 'padlock', spec, secret, clues: [], shown: spec.information === 'full' ? rng.pick(['Scratched on the lid', 'Written on a luggage tag', 'Chalked on the side']) : null, attempt };
    }
    throw new Error('padlock: no puzzle in 100 attempts');
  },

  initialState(p) {
    return { wheels: new Array(p.spec.parts).fill(0), fixed: new Array(p.spec.parts).fill(false), history: [], extraClues: [] };
  },

  applyMove(_p, s, m) {
    if (s.fixed[m.wheel]) return s;
    const wheels = [...s.wheels];
    wheels[m.wheel] = (((wheels[m.wheel] + m.delta) % 10) + 10) % 10;
    return { ...s, wheels };
  },

  check(p, s, detail) {
    const { right, wrong } = score(p.secret, s.wheels);
    const solved = right === p.spec.parts;
    if (solved) return { solved, text: 'Open!', right, wrong };
    if (p.spec.information !== 'feedback') return { solved, text: "That's not it." };
    if (detail === 'howMany') return { solved, right, wrong, text: `${right} in the right place, ${wrong} in the wrong place.` };
    return { solved, right, wrong, which: s.wheels.map((d, i) => d === p.secret[i]), text: `${right} right (lit), ${wrong} in the wrong place.` };
  },

  isSolved(p, s) {
    return s.wheels.every((d, i) => d === p.secret[i]);
  },

  hint(p, s, kind): HintResult<PadlockState, PadlockPuzzle> | null {
    if (kind === 'nudge') {
      const i = s.wheels.findIndex((d, k) => !s.fixed[k] && d !== p.secret[k]);
      const k = i >= 0 ? i : s.fixed.findIndex((f) => !f);
      if (k < 0) return null;
      const wheels = [...s.wheels];
      wheels[k] = p.secret[k];
      const fixed = [...s.fixed];
      fixed[k] = true;
      return { state: { ...s, wheels, fixed }, message: `Wheel ${k + 1} is ${p.secret[k]}.` };
    }
    // Clue: a new true line that removes at least a quarter of what is still possible.
    const known = [...p.clues, ...s.extraClues, ...s.history.filter((h) => h.feedback.right !== undefined).map((h) => ({ guess: h.code, right: h.feedback.right!, wrong: h.feedback.wrong! }))];
    const fixedOk = (c: number[]) => s.fixed.every((f, i) => !f || c[i] === p.secret[i]);
    const remaining = allCodes(p.spec.parts).filter((c) => consistent(c, known) && fixedOk(c));
    if (remaining.length <= 1) return null;
    const rng = new Rng(hash(Number(p.secret.join('')), s.extraClues.length, 77));
    let best: Clue | null = null;
    let bestLeft = remaining.length;
    for (let t = 0; t < 400; t++) {
      const guess = randomCode(p.spec.parts, rng);
      if (guess.every((d, i) => d === p.secret[i])) continue;
      const clue = { guess, ...score(p.secret, guess) };
      const left = remaining.filter((c) => consistent(c, [clue])).length;
      if (left < bestLeft) {
        best = clue;
        bestLeft = left;
      }
      if (left <= remaining.length * (1 - TUNING.CLUE_MIN_CUT) && left > 1) break;
    }
    if (!best || bestLeft > remaining.length * (1 - TUNING.CLUE_MIN_CUT)) return null;
    return { state: { ...s, extraClues: [...s.extraClues, best] }, message: `${best.guess.join(' ')} – ${clueText(best)}` };
  },

  par(p, detail) {
    if (p.spec.information !== 'feedback') return 1;
    return parFor('padlock', p.spec.parts, detail);
  },
};

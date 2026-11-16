import { calculate } from './chain';
import { gapIds, type PieceKind, type Placement, type Puzzle } from './model';

/**
 * Solver (§6.3): tries every way of placing the tray's pieces in the gaps
 * (pieces may be left in the tray) and measures the puzzle.
 */

export interface SolverReport {
  solvable: boolean;
  par: number;
  placements: number;
  winning: number;
  winningAtPar: number;
  parSolution: Placement | null;
  decoyGaps: number[];
  essentialGaps: number[];
  needsTall: boolean;
  needsBall: boolean;
  solutionShare: number;
  winsWithNothing: boolean;
  uselessKinds: PieceKind[];
  /** Fork slots (two or more reach-1 links) – used for difficulty. */
  forks: number;
  acceptable: boolean;
  problems: string[];
}

/** Every distinct placement of up to the tray's pieces into the gaps. */
export function* placements(p: Puzzle): Generator<Placement> {
  const gaps = gapIds(p);
  const counts = new Map<PieceKind, number>();
  for (const k of p.tray) counts.set(k, (counts.get(k) ?? 0) + 1);
  const kinds = [...counts.keys()];
  const current: Placement = new Map();
  function* rec(i: number): Generator<Placement> {
    if (i === gaps.length) {
      yield new Map(current);
      return;
    }
    yield* rec(i + 1); // leave this gap empty
    for (const k of kinds) {
      const c = counts.get(k)!;
      if (c === 0) continue;
      counts.set(k, c - 1);
      current.set(gaps[i], k);
      yield* rec(i + 1);
      current.delete(gaps[i]);
      counts.set(k, c);
    }
  }
  yield* rec(0);
}

function gapKey(pl: Placement): string {
  return [...pl.keys()].sort((a, b) => a - b).join(',');
}

export function solve(p: Puzzle): SolverReport {
  const gaps = gapIds(p);
  let total = 0;
  const wins: Placement[] = [];
  let winsWithNothing = false;
  for (const pl of placements(p)) {
    total++;
    if (calculate(p, pl).won) {
      wins.push(pl);
      if (pl.size === 0) winsWithNothing = true;
    }
  }
  const par = wins.length ? Math.min(...wins.map((w) => w.size)) : 0;
  const atPar = wins.filter((w) => w.size === par);
  // Distinct par solutions by which gaps are filled (the "best answer" is a choice of gaps;
  // swapping a standard for a tall piece in the same gaps is the same answer).
  const parKeys = new Set(atPar.map(gapKey));
  const inPar = new Set<number>();
  for (const w of atPar) for (const g of w.keys()) inPar.add(g);
  const decoyGaps = gaps.filter((g) => !inPar.has(g));
  const essentialGaps = wins.length ? gaps.filter((g) => wins.every((w) => w.has(g))) : [];

  // Needs tall: every win uses a tall piece. Needs ball: every win's chain uses a ball.
  const needsTall = wins.length > 0 && p.tray.includes('tall') && wins.every((w) => [...w.values()].includes('tall'));
  const needsBall = wins.length > 0 && p.ramps.length > 0 && wins.every((w) => calculate(p, w).fallen.some((f) => f.cause === 'ball' && reachesFlagVia(p, w, f.slot)));

  const kinds = [...new Set(p.tray)];
  const uselessKinds = kinds.filter((k) => !wins.some((w) => [...w.values()].includes(k)));

  let forks = 0;
  const outs = new Map<number, number>();
  for (const l of p.links) if (l.reach === 1) outs.set(l.from, (outs.get(l.from) ?? 0) + 1);
  for (const c of outs.values()) if (c >= 2) forks++;

  const problems: string[] = [];
  if (!wins.length) problems.push('not solvable with the tray');
  if (winsWithNothing) problems.push('can be won with no pieces placed');
  if (!decoyGaps.length) problems.push('no decoy gap');
  if (parKeys.size > 1) problems.push(`par solution not unique (${parKeys.size})`);
  if (uselessKinds.length) problems.push(`useless tray piece: ${uselessKinds.join(', ')}`);

  return {
    solvable: wins.length > 0,
    par,
    placements: total,
    winning: wins.length,
    winningAtPar: atPar.length,
    parSolution: atPar.length ? atPar[0] : null,
    decoyGaps,
    essentialGaps,
    needsTall,
    needsBall,
    solutionShare: total ? wins.length / total : 0,
    winsWithNothing,
    uselessKinds,
    forks,
    acceptable: problems.length === 0,
    problems,
  };
}

/** Whether the flag is downstream of a ball strike (the flag's chain of causes passes through it). */
function reachesFlagVia(p: Puzzle, w: Placement, slot: number): boolean {
  const r = calculate(p, w);
  const by = new Map(r.fallen.map((f) => [f.slot, f.by]));
  for (let s: number | undefined = p.flag; s !== undefined && s !== -1; s = by.get(s)) if (s === slot) return true;
  return false;
}

/**
 * Difficulty 1–7 (§6.4) from the measures. The weighting is a tuning table;
 * `scoreDifficulty` gives a raw score that the report turns into 1–7 by
 * ranking the pool, so each level holds a fair share of puzzles.
 */
export const DIFFICULTY_WEIGHTS = {
  gap: 0.6,
  decoy: 0.9,
  fork: 0.7,
  share: 6,
  ballBranch: 1.5,
  par: 0.8,
};

export function scoreDifficulty(p: Puzzle, r: SolverReport): number {
  const W = DIFFICULTY_WEIGHTS;
  const gaps = gapIds(p).length;
  const ballBranch = p.ramps.length && r.forks ? 1 : 0;
  return W.gap * gaps + W.decoy * r.decoyGaps.length + W.fork * r.forks - W.share * Math.log10(Math.max(1e-4, r.solutionShare)) + W.ballBranch * ballBranch + W.par * r.par;
}

import { calculate, type ChainResult } from '../chain/chain';
import { gapIds, type PieceKind, type Placement, type Puzzle } from '../chain/model';
import { solve } from '../chain/solver';

/**
 * One puzzle being played (§8): the placement, the topple count, the hint.
 * No drawing code; serialisable so a closed app loses nothing.
 */
export type HintKind = 'essential' | 'decoy';

export interface SessionState {
  placement: [number, PieceKind][];
  topples: number;
  hintUsed: boolean;
  hint: { gap: number; kind: HintKind } | null;
  solved: boolean;
  usedWhenSolved: number;
}

export class PuzzleSession {
  readonly puzzle: Puzzle;
  placement: Placement = new Map();
  topples = 0;
  hintUsed = false;
  hint: { gap: number; kind: HintKind } | null = null;
  solved = false;
  usedWhenSolved = 0;
  lastResult: ChainResult | null = null;

  constructor(puzzle: Puzzle, state?: SessionState) {
    this.puzzle = puzzle;
    if (state) this.restore(state);
  }

  get gaps(): number[] {
    return gapIds(this.puzzle);
  }

  /** Pieces still in the tray. */
  tray(): PieceKind[] {
    const left = [...this.puzzle.tray];
    for (const k of this.placement.values()) left.splice(left.indexOf(k), 1);
    return left;
  }

  canPlace(gap: number, kind: PieceKind): boolean {
    return this.puzzle.slots[gap]?.holds === 'gap' && !this.placement.has(gap) && this.tray().includes(kind);
  }

  place(gap: number, kind: PieceKind): boolean {
    if (!this.canPlace(gap, kind)) return false;
    this.placement.set(gap, kind);
    return true;
  }

  remove(gap: number): PieceKind | null {
    const k = this.placement.get(gap) ?? null;
    this.placement.delete(gap);
    return k;
  }

  /** Taps the start domino. Counts as one topple. */
  topple(): ChainResult {
    this.topples++;
    const r = calculate(this.puzzle, this.placement);
    this.lastResult = r;
    if (r.won && !this.solved) {
      this.solved = true;
      this.usedWhenSolved = this.placement.size;
    }
    return r;
  }

  /** A gold mark: dominoes used equals par (§8.2). */
  isGold(used = this.placement.size): boolean {
    return used === this.puzzle.par;
  }

  /**
   * The hint (§8.3): one gap chosen by the solver, marked as essential (part
   * of the best answer) or as a decoy, whichever the player asked for.
   */
  takeHint(kind: HintKind): { gap: number; kind: HintKind } | null {
    if (this.hintUsed) return this.hint;
    const r = solve(this.puzzle);
    let gap: number | undefined;
    if (kind === 'essential') {
      const best = [...(r.parSolution?.keys() ?? [])];
      gap = best.find((g) => !this.placement.has(g)) ?? best[0];
    } else {
      gap = r.decoyGaps.find((g) => this.placement.has(g)) ?? r.decoyGaps[0];
    }
    if (gap === undefined) return null;
    this.hintUsed = true;
    this.hint = { gap, kind };
    return this.hint;
  }

  serialize(): SessionState {
    return {
      placement: [...this.placement.entries()],
      topples: this.topples,
      hintUsed: this.hintUsed,
      hint: this.hint ? { ...this.hint } : null,
      solved: this.solved,
      usedWhenSolved: this.usedWhenSolved,
    };
  }

  restore(s: SessionState): void {
    this.placement = new Map(s.placement);
    this.topples = s.topples;
    this.hintUsed = s.hintUsed;
    this.hint = s.hint ? { ...s.hint } : null;
    this.solved = s.solved;
    this.usedWhenSolved = s.usedWhenSolved;
  }
}

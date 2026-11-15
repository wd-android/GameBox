/**
 * The lock framework (§5). Every lock type is a module with the same shape;
 * adding a type means adding one module and one view. No UI code here.
 */
export type LockTypeId = 'padlock' | 'bottles' | 'rings' | 'bolts';
export type Information = 'full' | 'clued' | 'feedback';
/** "After each try, show…" (§7). */
export type Detail = 'howMany' | 'which';

/** What a chest asks for: the difficulty controls (§5.3) plus type-specific extras. */
export interface LockSpec {
  type: LockTypeId;
  parts: number;
  information: Information;
  /** Rings: steps per full turn (8 or 12) and number of linkages. */
  steps?: number;
  linkages?: number;
  /** Bolts: frame size (5 or 6). Parts = bolt count. */
  size?: number;
  /** Deduction depth allowed for clued puzzles (0 or 1). */
  depth?: number;
}

export interface Feedback {
  solved: boolean;
  /** Text shown in the history, already in the chosen form. */
  text: string;
  /** Padlock: wheels right / digits in the wrong place. Bottles: bottles right. Rings: rings aligned. */
  right?: number;
  wrong?: number;
  /** "Which": per part, whether it is correct. */
  which?: boolean[];
}

export interface HintResult<S, P> {
  state?: S;
  puzzle?: P;
  message: string;
  /** For rings and bolts: the suggested move, for the view to highlight. */
  move?: unknown;
}

export interface LockType<P, S, M> {
  id: LockTypeId;
  generate(spec: LockSpec, seed: number): P;
  initialState(p: P): S;
  applyMove(p: P, s: S, m: M): S;
  isAttemptBased: boolean;
  check(p: P, s: S, detail: Detail): Feedback;
  isSolved(p: P, s: S): boolean;
  hint(p: P, s: S, kind: 'nudge' | 'clue'): HintResult<S, P> | null;
  /** Expected tries (attempt-based) or the shortest solution (move-based) for three stars. */
  par(p: P, detail: Detail): number;
}

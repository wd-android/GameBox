import { TUNING } from '../config/tuning';
import { lockSeed, type ChestDef } from '../chest/chest';
import type { Detail, Feedback } from '../locks/types';
import { LOCKS, detailFor, isDeduced, locksmithLimit, starsFor, type Mode } from './rules';

/**
 * A chest being opened (§9.1): any lock can be worked on, in any order, and
 * progress on each is kept. Puzzles are regenerated from the chest's seed,
 * so only states, counts and hints need saving.
 */
export interface LockProgress {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
  /** Tries (attempt-based) or moves (rings and bolts). */
  count: number;
  hints: number;
  solved: boolean;
  jammed: boolean;
  stars: number;
}

export interface SessionSave {
  chestId: string;
  mode: Mode;
  retry: number;
  locks: LockProgress[];
}

export class ChestSession {
  readonly chest: ChestDef;
  readonly mode: Mode;
  retry: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  puzzles: any[];
  locks: LockProgress[];

  constructor(chest: ChestDef, mode: Mode, saved?: SessionSave) {
    this.chest = chest;
    this.mode = mode;
    this.retry = saved?.retry ?? 0;
    this.puzzles = this.generate();
    this.locks = saved ? saved.locks.map((l) => ({ ...l })) : this.puzzles.map((p, i) => this.fresh(i, p));
  }

  private generate() {
    return this.chest.locks.map((spec, i) => LOCKS[spec.type].generate(spec, lockSeed(this.chest, i, this.retry)));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fresh(i: number, p: any): LockProgress {
    return { state: LOCKS[this.chest.locks[i].type].initialState(p), count: 0, hints: 0, solved: false, jammed: false, stars: 0 };
  }

  get open(): boolean {
    return this.locks.every((l) => l.solved);
  }

  /** The chest's stars: the lowest of its locks' stars (§8.3). */
  get stars(): number {
    return this.open ? Math.min(...this.locks.map((l) => l.stars)) : 0;
  }

  get totalTries(): number {
    return this.locks.reduce((a, l) => a + l.count, 0);
  }

  par(i: number, setting: Detail): number {
    return LOCKS[this.chest.locks[i].type].par(this.puzzles[i], detailFor(this.mode, setting));
  }

  /** Locksmith only: the most tries or moves allowed. */
  limit(i: number): number | null {
    if (this.mode !== 'locksmith') return null;
    return locksmithLimit(this.chest.locks[i], this.puzzles[i].shortest ?? 0);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  move(i: number, m: any): { solved: boolean } {
    const l = this.locks[i];
    if (l.solved || l.jammed) return { solved: l.solved };
    const type = LOCKS[this.chest.locks[i].type];
    const next = type.applyMove(this.puzzles[i], l.state, m);
    if (next === l.state) return { solved: false };
    l.state = next;
    if (!type.isAttemptBased) {
      l.count = next.moves;
      if (type.isSolved(this.puzzles[i], next)) this.solve(i, 'which');
      else this.checkJam(i);
    }
    return { solved: l.solved };
  }

  /** Tries the current setting of an attempt-based lock. */
  attempt(i: number, setting: Detail): Feedback {
    const l = this.locks[i];
    const type = LOCKS[this.chest.locks[i].type];
    const detail = detailFor(this.mode, setting);
    const fb = type.check(this.puzzles[i], l.state, detail);
    l.count++;
    const record = l.state.wheels ? { code: [...l.state.wheels], feedback: fb } : { order: [...l.state.order], feedback: fb };
    l.state = { ...l.state, history: [...l.state.history, record] };
    if (fb.solved) this.solve(i, setting);
    else this.checkJam(i);
    return fb;
  }

  private solve(i: number, setting: Detail): void {
    const l = this.locks[i];
    l.solved = true;
    l.stars = starsFor(this.chest.locks[i], l.count, this.par(i, setting), l.hints > 0);
  }

  private checkJam(i: number): void {
    const lim = this.limit(i);
    if (lim !== null && this.locks[i].count >= lim && !this.locks[i].solved) this.locks[i].jammed = true;
  }

  get jammed(): boolean {
    return this.locks.some((l) => l.jammed);
  }

  /** Locksmith: after a jam the chest is retried with freshly generated puzzles of the same difficulty. */
  retryFresh(): void {
    this.retry++;
    this.puzzles = this.generate();
    this.locks = this.puzzles.map((p, i) => this.fresh(i, p));
  }

  canHint(i: number, kind: 'nudge' | 'clue'): boolean {
    const spec = this.chest.locks[i];
    if (this.mode === 'daily' || this.locks[i].solved || this.locks[i].hints >= TUNING.HINTS_PER_LOCK) return false;
    if (kind === 'clue') return spec.type === 'padlock' || spec.type === 'bottles';
    return true;
  }

  /** Applies a hint; returns its message (and a suggested move for rings and bolts). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hint(i: number, kind: 'nudge' | 'clue'): { message: string; move?: any } | null {
    if (!this.canHint(i, kind)) return null;
    const type = LOCKS[this.chest.locks[i].type];
    const h = type.hint(this.puzzles[i], this.locks[i].state, kind);
    if (!h) return null;
    if (h.state) this.locks[i].state = h.state;
    this.locks[i].hints++;
    return { message: h.message, move: h.move };
  }

  isDeduced(i: number): boolean {
    return isDeduced(this.chest.locks[i]);
  }

  serialize(): SessionSave {
    return { chestId: this.chest.id, mode: this.mode, retry: this.retry, locks: JSON.parse(JSON.stringify(this.locks)) };
  }
}

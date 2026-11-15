import { TUNING } from '../config/tuning';
import { Padlock } from '../locks/padlock/padlock';
import { Bottles } from '../locks/bottles/bottles';
import { Rings } from '../locks/rings/rings';
import { BoltsLock } from '../locks/bolts/bolts';
import type { Detail, LockSpec, LockType, LockTypeId } from '../locks/types';

/** Every lock type, by id. Adding a type later means adding it here and a view. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LOCKS: Record<LockTypeId, LockType<any, any, any>> = {
  padlock: Padlock,
  bottles: Bottles,
  rings: Rings,
  bolts: BoltsLock,
};

export type Mode = 'relaxed' | 'locksmith' | 'daily';

/** Locksmith mode and the Daily Safe always use "How many" (§7). */
export function detailFor(mode: Mode, setting: Detail): Detail {
  return mode === 'relaxed' ? setting : 'howMany';
}

/** Is this lock solved by deduction before trying (Full or Clued padlock/bottles)? */
export function isDeduced(spec: LockSpec): boolean {
  return (spec.type === 'padlock' || spec.type === 'bottles') && spec.information !== 'feedback';
}

/** Locksmith attempt limits (§8.2): tries for attempt-based locks, moves for rings and bolts. */
export function locksmithLimit(spec: LockSpec, shortest: number): number {
  if (isDeduced(spec)) return TUNING.LIMIT_DEDUCED;
  if (spec.type === 'padlock') return TUNING.LIMIT_PADLOCK_FEEDBACK[spec.parts] ?? 10;
  if (spec.type === 'bottles') return TUNING.LIMIT_BOTTLES_FEEDBACK[spec.parts] ?? 10;
  if (spec.type === 'rings') return Math.ceil(shortest * TUNING.LIMIT_RINGS_FACTOR);
  return Math.ceil(shortest * TUNING.LIMIT_BOLTS_FACTOR);
}

/**
 * Stars (§8.3). `count` is tries for attempt-based locks, moves for rings and
 * bolts; `par` is the calibrated par or the shortest solution. A hint caps
 * the lock at two stars (§10).
 */
export function starsFor(spec: LockSpec, count: number, par: number, hinted: boolean): number {
  let s: number;
  if (isDeduced(spec)) s = count <= 1 ? 3 : count === 2 ? 2 : 1;
  else if (spec.type === 'padlock' || spec.type === 'bottles') s = count <= par ? 3 : count <= par + TUNING.PAR_EXTRA_2_STARS ? 2 : 1;
  else s = count <= par * TUNING.MOVES_3_STARS ? 3 : count <= par * TUNING.MOVES_2_STARS ? 2 : 1;
  return hinted ? Math.min(2, s) : s;
}

export function rankFor(goldStars: number): { name: string; next: number | null } {
  let name = TUNING.RANKS[0][0];
  let next: number | null = null;
  for (const [n, at] of TUNING.RANKS) {
    if (goldStars >= at) name = n;
    else if (next === null) next = at;
  }
  return { name, next };
}

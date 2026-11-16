import { TUNING } from '../config/tuning';
import type { SaveData } from '../state/save';
import { PACK, type PuzzleKey } from './puzzles';
import { computeStreak, type StreakInfo } from './streak';
import { dateForNumber, dateKey } from './schedule';

/**
 * Recording attempts and results, tokens (§9.5) and statistics (§12).
 * The "Show par" setting is deliberately not an input to anything here.
 */

export function streakInfo(save: SaveData, today: number): StreakInfo {
  return computeStreak((n) => !!save.daily[n]?.solved && save.daily[n].onTime, today);
}

/** Called on every topple, so "played" counts attempts that are not yet solved. */
export function recordTopple(save: SaveData, key: PuzzleKey): void {
  if (key.kind === 'daily') {
    const rec = (save.daily[key.n] ??= { topples: 0, solved: false, onTime: false, gold: false, hint: false });
    if (!rec.solved) rec.topples++;
  } else if (key.kind === 'pack') {
    const rec = (save.pack[key.n] ??= { solved: false, gold: false, topples: 0, used: 0 });
    if (!rec.solved) rec.topples++;
  }
}

export interface Outcome {
  tokens: number;
  firstSolve: boolean;
  gold: boolean;
  streak: number;
  milestone: boolean;
}

export function recordSolve(save: SaveData, key: PuzzleKey, o: { used: number; gold: boolean; hint: boolean; today: number; todayDate?: string }): Outcome {
  let tokens = 0;
  let firstSolve = false;
  let milestone = false;
  if (key.kind === 'daily') {
    const rec = (save.daily[key.n] ??= { topples: 1, solved: false, onTime: false, gold: false, hint: false });
    const onTime = key.n === o.today && dateForNumber(key.n) === (o.todayDate ?? dateKey());
    if (!rec.solved) {
      firstSolve = true;
      rec.solved = true;
      rec.solvedDate = o.todayDate ?? dateKey();
      rec.onTime = onTime;
      rec.used = o.used;
      rec.hint = o.hint;
      rec.gold = o.gold;
      if (onTime) tokens += TUNING.TOKENS_DAILY + (o.gold ? TUNING.TOKENS_DAILY_GOLD : 0);
      else tokens += TUNING.TOKENS_ARCHIVE;
    } else if (o.gold && !rec.gold) {
      // Replays can earn the gold mark but never change the original topples.
      rec.gold = true;
    }
  } else if (key.kind === 'pack') {
    const rec = (save.pack[key.n] ??= { solved: false, gold: false, topples: 1, used: o.used });
    if (!rec.solved) {
      firstSolve = true;
      rec.solved = true;
      rec.used = o.used;
      tokens += TUNING.TOKENS_PACK;
    }
    rec.gold ||= o.gold;
  }
  const streak = streakInfo(save, o.today).current;
  const due = Math.floor(streak / 7);
  // A broken streak starts its milestones again; otherwise a second streak would pay nothing until it beat the first.
  if (due < save.streakMilestonesPaid) save.streakMilestonesPaid = due;
  if (key.kind === 'daily' && due > save.streakMilestonesPaid) {
    tokens += TUNING.TOKENS_STREAK_7 * (due - save.streakMilestonesPaid);
    save.streakMilestonesPaid = due;
    milestone = true;
  }
  save.tokens += tokens;
  return { tokens, firstSolve, gold: o.gold, streak, milestone };
}

export function packUnlocked(save: SaveData, n: number): boolean {
  return n === 1 || !!save.pack[n - 1]?.solved;
}

export function packProgress(save: SaveData): { solved: number; gold: number; total: number } {
  let solved = 0;
  let gold = 0;
  for (let i = 1; i <= PACK.length; i++) {
    if (save.pack[i]?.solved) solved++;
    if (save.pack[i]?.gold) gold++;
  }
  return { solved, gold, total: PACK.length };
}

export interface Stats {
  played: number;
  solved: number;
  current: number;
  longest: number;
  gold: number;
  /** Solves by topple number: index 0 = 1st topple … index 5 = 6 or more. */
  byTopples: number[];
}

export function statistics(save: SaveData, today: number): Stats {
  const recs = Object.values(save.daily);
  const byTopples = [0, 0, 0, 0, 0, 0];
  for (const r of recs) if (r.solved) byTopples[Math.min(5, Math.max(1, r.topples) - 1)]++;
  const s = streakInfo(save, today);
  return {
    played: recs.filter((r) => r.topples > 0 || r.solved).length,
    solved: recs.filter((r) => r.solved).length,
    current: s.current,
    longest: s.longest,
    gold: recs.filter((r) => r.gold).length,
    byTopples,
  };
}

/** Archive colour (§9.3). */
export function dayColour(r: { solved: boolean; topples: number; gold: boolean } | undefined): 'gold' | 'green' | 'amber' | 'grey' | 'blank' {
  if (!r || !r.solved) return 'blank';
  if (r.gold) return 'gold';
  if (r.topples <= 1) return 'green';
  if (r.topples <= 3) return 'amber';
  return 'grey';
}

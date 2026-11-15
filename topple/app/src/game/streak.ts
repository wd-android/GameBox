import { dateForNumber } from './schedule';

/**
 * Streaks (§9.2): consecutive days on which the daily puzzle was solved on
 * its own date. One missed day in each calendar month is forgiven (shown
 * with a shield). Solving an old puzzle from the Archive does not repair it.
 * Computed from the history, so it can never drift.
 */
export interface StreakInfo {
  current: number;
  longest: number;
  /** Dates forgiven by streak protection. */
  shields: string[];
  /** Whether this month's protection has been used. */
  protectionUsedThisMonth: boolean;
}

export function computeStreak(solvedOnTime: (n: number) => boolean, today: number): StreakInfo {
  let current = 0;
  let longest = 0;
  const shields: string[] = [];
  const usedMonths = new Set<string>();
  for (let n = 1; n <= today; n++) {
    if (solvedOnTime(n)) {
      current++;
      longest = Math.max(longest, current);
      continue;
    }
    if (n === today) break; // today's puzzle can still be solved
    const date = dateForNumber(n);
    const month = date.slice(0, 7);
    if (current > 0 && !usedMonths.has(month)) {
      usedMonths.add(month);
      shields.push(date);
    } else current = 0;
  }
  const thisMonth = dateForNumber(today).slice(0, 7);
  return { current, longest, shields, protectionUsedThisMonth: usedMonths.has(thisMonth) };
}

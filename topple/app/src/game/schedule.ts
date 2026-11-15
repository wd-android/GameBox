import { APP } from '../config/app';

/**
 * Daily schedule (§9.1). Puzzle number = days since the launch date + 1,
 * using the device's local date; difficulty by weekday (Monday 1 … Sunday
 * 7); the monthly special on the last day of each month.
 */

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function fromIndex(i: number): string {
  const d = new Date(i * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(key: string, n: number): string {
  return fromIndex(dayIndex(key) + n);
}

export function puzzleNumber(key: string, launch: string = APP.LAUNCH_DATE): number {
  return dayIndex(key) - dayIndex(launch) + 1;
}

export function dateForNumber(n: number, launch: string = APP.LAUNCH_DATE): string {
  return fromIndex(dayIndex(launch) + n - 1);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: string): number {
  return (((dayIndex(key) + 4) % 7) + 7) % 7; // 1 Jan 1970 was a Thursday
}

export function weekdayDifficulty(key: string): number {
  const w = weekday(key);
  return w === 0 ? 7 : w;
}

export function isLastDayOfMonth(key: string): boolean {
  return addDays(key, 1).slice(8) === '01';
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Which bundled puzzle to show for a puzzle number. If the supply runs out
 * before an update, the earliest puzzles are replayed (A3).
 */
export function bundledIndex(n: number, count: number): { index: number; replay: boolean } {
  if (n <= count) return { index: n - 1, replay: false };
  return { index: (n - 1) % count, replay: true };
}

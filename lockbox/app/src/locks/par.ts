import parTable from './par.json';
import type { Detail, LockTypeId } from './types';

/**
 * Par for feedback-level locks (§8.3) is measured, not guessed: the
 * calibration script (`npm run calibrate`) plays 1,000 puzzles of each lock,
 * size and feedback option with a reference solver and stores the median
 * tries plus one in par.json.
 */
const table = parTable as Record<string, number>;

export function parFor(type: LockTypeId, parts: number, detail: Detail): number {
  return table[`${type}/${parts}/${detail}`] ?? table[`${type}/${parts}/howMany`] ?? parts + 3;
}

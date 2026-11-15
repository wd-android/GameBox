import dailyData from '../puzzles/daily/daily.json';
import packData from '../puzzles/packs/first-tricks.json';
import tutorialData from '../puzzles/tutorial.json';
import type { Puzzle } from '../chain/model';
import { bundledIndex, dateForNumber, puzzleNumber, dateKey } from './schedule';

/** Bundled puzzles (A3): the Daily Topple, Pack 1 and the first-launch puzzles. */
export const DAILY = dailyData as unknown as Puzzle[];
export const PACK = packData as unknown as Puzzle[];
export const TUTORIAL = tutorialData as unknown as Puzzle[];

export type PuzzleKey = { kind: 'daily'; n: number } | { kind: 'pack'; n: number } | { kind: 'tutorial'; n: number };

export function keyString(k: PuzzleKey): string {
  return `${k.kind}:${k.n}`;
}

export function parseKey(s: string): PuzzleKey | null {
  const m = /^(daily|pack|tutorial):(\d+)$/.exec(s);
  return m ? ({ kind: m[1], n: Number(m[2]) } as PuzzleKey) : null;
}

export function puzzleFor(k: PuzzleKey): { puzzle: Puzzle; replay: boolean } {
  if (k.kind === 'daily') {
    const b = bundledIndex(k.n, DAILY.length);
    return { puzzle: DAILY[b.index], replay: b.replay };
  }
  if (k.kind === 'pack') return { puzzle: PACK[k.n - 1], replay: false };
  return { puzzle: TUTORIAL[k.n - 1], replay: false };
}

export function todayNumber(): number {
  return Math.max(1, puzzleNumber(dateKey()));
}

export { dateForNumber };

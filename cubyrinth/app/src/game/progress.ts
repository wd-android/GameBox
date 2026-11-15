import { BALL_ORDER, TUNING, type BallId } from '../config/tuning';
import { BALL_UNLOCK_LEVEL, LEVELS } from './levels';
import type { SaveData } from '../state/save';
import type { MaterialId } from '../render/materials';
import { MATERIALS } from '../render/materials';

/** Unlocking, medals, coins and the daily streak. */

export function levelDone(save: SaveData, id: number): boolean {
  const r = save.levels[id];
  return !!r && Object.keys(r).length > 0;
}

/** The next level is unlocked by finishing the one before with any ball (or in step mode). */
export function highestUnlocked(save: SaveData): number {
  let n = 1;
  for (const l of LEVELS) if (levelDone(save, l.id)) n = Math.max(n, l.id + 1);
  return Math.min(n, LEVELS.length);
}

export function ballUnlocked(save: SaveData, ball: BallId): boolean {
  return highestUnlocked(save) >= BALL_UNLOCK_LEVEL[ball];
}

export function unlockedSizes(save: SaveData): number[] {
  const top = LEVELS[highestUnlocked(save) - 1];
  return [3, 4, 5, 6].filter((n) => n <= top.n);
}

export interface Outcome {
  coins: number;
  newMedal: boolean;
  improved: boolean;
}

/**
 * Records a finished Journey level. Step-mode completions earn a separate
 * "step" medal and do not count towards bronze, silver or gold (§7.11).
 */
export function recordLevel(save: SaveData, id: number, key: BallId | 'step', result: { time: number; stars: number; falls: number; score: number }): Outcome {
  const rec = (save.levels[id] ??= {});
  const prev = rec[key];
  let coins = 0;
  if (!prev) coins += TUNING.COINS_FIRST_MEDAL;
  coins += TUNING.COINS_PER_STAR * Math.max(0, result.stars - (prev?.stars ?? 0));
  const improved = !prev || result.time < prev.time;
  rec[key] = {
    time: Math.min(result.time, prev?.time ?? Infinity),
    stars: Math.max(result.stars, prev?.stars ?? 0),
    falls: improved ? result.falls : prev!.falls,
    score: Math.max(result.score, prev?.score ?? 0),
  };
  save.coins += coins;
  return { coins, newMedal: !prev, improved };
}

export function medals(save: SaveData, id: number): (BallId | 'step')[] {
  const r = save.levels[id] ?? {};
  return [...BALL_ORDER, 'step' as const].filter((k) => r[k]);
}

export function bestStars(save: SaveData, id: number): number {
  const r = save.levels[id] ?? {};
  return Math.max(0, ...BALL_ORDER.map((b) => r[b]?.stars ?? 0));
}

export function totalStars(save: SaveData): number {
  return LEVELS.reduce((s, l) => s + bestStars(save, l.id), 0);
}

// ── Daily Cube (§9.3): unlimited attempts, best time kept, a streak of days played ──

export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentStreak(save: SaveData, today: string): number {
  const last = save.daily.last;
  if (!last) return 0;
  return last === today || last === previousDay(today) ? save.daily.streak : 0;
}

export function recordDaily(save: SaveData, key: string, code: string, time: number): { coins: number; best: boolean; streak: number } {
  const prev = save.daily.history[key];
  let coins = 0;
  if (!prev) {
    coins = TUNING.COINS_DAILY;
    save.daily.streak = save.daily.last === previousDay(key) ? save.daily.streak + 1 : 1;
    save.daily.last = key;
  }
  const best = !prev || time < prev.best;
  save.daily.history[key] = { best: Math.min(time, prev?.best ?? Infinity), code };
  save.coins += coins;
  return { coins, best, streak: save.daily.streak };
}

export function buyMaterial(save: SaveData, id: MaterialId): boolean {
  if (save.materials.includes(id)) return true;
  const price = MATERIALS[id].price;
  if (save.coins < price) return false;
  save.coins -= price;
  save.materials.push(id);
  return true;
}

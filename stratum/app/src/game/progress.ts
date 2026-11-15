import { TUNING } from '../config/tuning';
import { SETS, type SetDef } from '../jars/sets';
import { previousDay } from '../jars/jars';
import { SHAPES, SHAPE_ORDER, type ShapeId } from '../jars/shapes';
import type { SaveData } from '../state/save';

/** Rules for stars, corks, unlocking, sets and the daily streak (§6.7, §8.4, §8.5, §9). */

export interface PourResult {
  acc: number;
  stars: number;
  freehand: boolean;
  grid: string;
}

/** Corks a result is worth in total: 5 for completing, 5 per star, 5 for freehand. */
export function corkValue(stars: number, freehand: boolean): number {
  if (stars <= 0) return 0;
  return TUNING.CORKS_PER_JAR + TUNING.CORKS_PER_STAR * stars + (freehand ? TUNING.CORKS_FREEHAND : 0);
}

/** A jar below one star is kept but does not unlock the next (§16 question 3, as specified). */
export function highestUnlocked(save: SaveData): number {
  let n = 1;
  for (const [id, rec] of Object.entries(save.jars)) {
    if (rec.stars >= 1) n = Math.max(n, Number(id) + 1);
  }
  return Math.min(n, TUNING.MATCH_JAR_COUNT);
}

export function isJarUnlocked(save: SaveData, id: number): boolean {
  return id <= highestUnlocked(save);
}

export function freePourUnlocked(save: SaveData): boolean {
  return highestUnlocked(save) > TUNING.FREE_POUR_UNLOCK_AFTER_JAR;
}

export function unlockedShapes(save: SaveData): ShapeId[] {
  const top = highestUnlocked(save);
  return SHAPE_ORDER.filter((s) => SHAPES[s].unlockJar <= top);
}

export function guidesForced(jarId: number): boolean {
  return jarId <= TUNING.GUIDES_FORCED_UNTIL_JAR;
}

export interface MatchOutcome {
  earned: number;
  improved: boolean;
  firstClear: boolean;
  setCompleted: SetDef | null;
}

/**
 * Records a Match result. The kept grid is replaced only if the player chose
 * to keep the new pour (or there was none).
 */
export function applyMatchResult(save: SaveData, jarId: number, res: PourResult, keepNew: boolean): MatchOutcome {
  const prev = save.jars[jarId];
  const value = corkValue(res.stars, res.freehand);
  const paid = prev?.paid ?? 0;
  const earned = Math.max(0, value - paid);
  const firstClear = !prev || prev.stars < 1;
  const rec = prev ?? { best: 0, stars: 0, freehand: false, kept: '', paid: 0 };
  const improved = res.acc > rec.best;
  rec.best = Math.max(rec.best, res.acc);
  rec.stars = Math.max(rec.stars, res.stars);
  rec.freehand = rec.freehand || (res.freehand && res.stars > 0);
  rec.paid = paid + earned;
  if (keepNew || !rec.kept) rec.kept = res.grid;
  save.jars[jarId] = rec;
  save.corks += earned;

  let setCompleted: SetDef | null = null;
  for (const set of SETS) {
    if (jarId < set.first || jarId > set.last || save.setsDone.includes(set.name)) continue;
    let done = true;
    for (let id = set.first; id <= set.last; id++) {
      if ((save.jars[id]?.stars ?? 0) < TUNING.SET_COMPLETE_MIN_STARS) done = false;
    }
    if (done) {
      save.setsDone.push(set.name);
      save.decorations.push(set.decoration);
      save.corks += TUNING.CORKS_SET_COMPLETE;
      setCompleted = set;
    }
  }
  return { earned: earned + (setCompleted ? TUNING.CORKS_SET_COMPLETE : 0), improved, firstClear, setCompleted };
}

export function setProgress(save: SaveData, set: SetDef): { done: number; total: number; stars: number } {
  let done = 0;
  let stars = 0;
  for (let id = set.first; id <= set.last; id++) {
    const s = save.jars[id]?.stars ?? 0;
    stars += s;
    if (s >= TUNING.SET_COMPLETE_MIN_STARS) done++;
  }
  return { done, total: set.last - set.first + 1, stars };
}

/** Daily Jar: one scored attempt per day; the streak counts consecutive days played. */
export function dailyPlayed(save: SaveData, key: string): boolean {
  return !!save.daily.history[key];
}

export function currentStreak(save: SaveData, today: string): number {
  const last = save.daily.last;
  if (!last) return 0;
  if (last === today || last === previousDay(today)) return save.daily.streak;
  return 0;
}

export function applyDailyResult(save: SaveData, key: string, jarId: number, res: PourResult): { earned: number; streak: number } {
  if (dailyPlayed(save, key)) return { earned: 0, streak: save.daily.streak };
  save.daily.history[key] = { acc: res.acc, stars: res.stars, grid: res.grid, jarId };
  save.daily.streak = save.daily.last === previousDay(key) ? save.daily.streak + 1 : 1;
  save.daily.last = key;
  const earned = res.stars >= 1 ? TUNING.CORKS_DAILY : 0;
  save.corks += earned;
  return { earned, streak: save.daily.streak };
}

// ── Shelf shop (§8.5: corks are spent on backdrops, lighting and labels, 30 to 300) ──

export type ShopKind = 'backdrop' | 'lighting' | 'label';

export interface ShopItem {
  kind: ShopKind;
  id: string;
  name: string;
  price: number;
  /** CSS value used to draw it. */
  css: string;
}

export const SHOP: ShopItem[] = [
  { kind: 'backdrop', id: 'dusk', name: 'Dusk', price: 0, css: 'linear-gradient(180deg,#2a0b5a 0%,#1b043b 100%)' },
  { kind: 'backdrop', id: 'lagoon', name: 'Lagoon', price: 60, css: 'linear-gradient(180deg,#073b5a 0%,#120b3b 100%)' },
  { kind: 'backdrop', id: 'ember', name: 'Ember', price: 120, css: 'linear-gradient(180deg,#5a1b2a 0%,#24042f 100%)' },
  { kind: 'backdrop', id: 'forest', name: 'Forest', price: 180, css: 'linear-gradient(180deg,#0f4a33 0%,#0d1b2f 100%)' },
  { kind: 'backdrop', id: 'night', name: 'Night sky', price: 300, css: 'radial-gradient(circle at 30% 20%,#3b2a8a 0%,#0b0420 70%)' },
  { kind: 'lighting', id: 'soft', name: 'Soft', price: 0, css: 'rgba(146,89,254,0.35)' },
  { kind: 'lighting', id: 'cyan', name: 'Neon cyan', price: 30, css: 'rgba(6,255,255,0.35)' },
  { kind: 'lighting', id: 'gold', name: 'Golden hour', price: 90, css: 'rgba(246,146,30,0.4)' },
  { kind: 'lighting', id: 'rose', name: 'Rose', price: 150, css: 'rgba(255,84,140,0.4)' },
  { kind: 'label', id: 'plain', name: 'Plain', price: 0, css: '#ffffff' },
  { kind: 'label', id: 'kraft', name: 'Kraft paper', price: 40, css: '#c89b5e' },
  { kind: 'label', id: 'mint', name: 'Mint', price: 80, css: '#7fffd4' },
  { kind: 'label', id: 'gold', name: 'Gold leaf', price: 250, css: '#ffd166' },
];

export function shopItem(kind: ShopKind, id: string): ShopItem {
  return SHOP.find((s) => s.kind === kind && s.id === id) ?? SHOP.find((s) => s.kind === kind)!;
}

export function buy(save: SaveData, item: ShopItem): boolean {
  const key = `${item.kind}:${item.id}`;
  if (save.owned.includes(key)) return true;
  if (save.corks < item.price) return false;
  save.corks -= item.price;
  save.owned.push(key);
  return true;
}

import { BUILDINGS, type BuildingId } from '../config/tuning';
import { NIGHT_COUNT } from '../nights/nights';
import type { NightResult } from '../sim/night';
import type { SaveData } from '../state/save';
import { requestAt, progressFrom, type Request } from '../town/requests';
import { accrue, buildingUnlocked, collect, levelCost, upgradeCost, type UpgradeId } from '../town/town';
import { TUNING } from '../config/tuning';

/** Night progress, purchases and requests (§6.6, §9). */

/** The furthest night the player may play: one past the last night completed. */
export function reachedNight(save: SaveData): number {
  let n = 1;
  while (n <= NIGHT_COUNT && (save.nights[n]?.stars ?? 0) > 0) n++;
  return Math.min(n, NIGHT_COUNT);
}

export function nightUnlocked(save: SaveData, n: number): boolean {
  return n >= 1 && n <= reachedNight(save);
}

export function allDone(save: SaveData): boolean {
  return (save.nights[NIGHT_COUNT]?.stars ?? 0) > 0;
}

export function totalStars(save: SaveData): number {
  return Object.values(save.nights).reduce((a, r) => a + r.stars, 0);
}

export interface RequestReport {
  request: Request;
  progress: number;
  completed: boolean;
}

export interface NightOutcome {
  coins: number;
  newBest: boolean;
  request: RequestReport | null;
  /** The night that should be offered next. */
  next: number;
}

export function activeRequest(save: SaveData): { request: Request; progress: number } | null {
  if (save.buildings.inn <= 0) return null;
  if (!save.request) save.request = { index: save.requestsDone, progress: 0 };
  return { request: requestAt(save.request.index), progress: save.request.progress };
}

/** Records a finished night. A failed night keeps the catch already landed (§6.6) but does not progress. */
export function recordNight(save: SaveData, n: number, r: NightResult): NightOutcome {
  const rec = (save.nights[n] ??= { stars: 0, best: 0 });
  const newBest = r.stars > rec.stars || r.total > rec.best;
  rec.stars = Math.max(rec.stars, r.stars);
  rec.best = Math.max(rec.best, r.total);
  save.coins += r.total;
  save.landedTotal += r.landed;
  let report: RequestReport | null = null;
  const active = activeRequest(save);
  if (active && save.request) {
    save.request.progress = Math.min(active.request.target, save.request.progress + progressFrom(active.request, r));
    const completed = save.request.progress >= active.request.target;
    report = { request: active.request, progress: save.request.progress, completed };
    if (completed) {
      save.coins += active.request.reward;
      save.requestsDone++;
      save.request = { index: save.requestsDone, progress: 0 };
    }
  }
  return { coins: r.total, newBest, request: report, next: r.failed ? n : Math.min(NIGHT_COUNT, n + 1) };
}

// ── Town purchases ────────────────────────────────────────────

export function collectEarnings(save: SaveData, now = Date.now()): number {
  const coins = collect(save.store, save.buildings, now);
  save.coins += coins;
  return coins;
}

/** Brings the store up to date before anything changes the hourly rate. */
export function settle(save: SaveData, now = Date.now()): void {
  accrue(save.store, save.buildings, now);
}

export type BuyCheck = { ok: true; cost: number } | { ok: false; reason: string; cost?: number };

export function canBuild(save: SaveData, id: BuildingId): BuyCheck {
  const level = save.buildings[id];
  if (level >= TUNING.MAX_LEVEL) return { ok: false, reason: 'Fully built' };
  if (!buildingUnlocked(id, reachedNight(save))) return { ok: false, reason: `Unlocks at night ${BUILDINGS.find((b) => b.id === id)!.unlock}` };
  const cost = levelCost(id, level + 1);
  if (save.coins < cost) return { ok: false, reason: 'Not enough coins', cost };
  return { ok: true, cost };
}

export function build(save: SaveData, id: BuildingId, now = Date.now()): boolean {
  const c = canBuild(save, id);
  if (!c.ok) return false;
  settle(save, now);
  save.coins -= c.cost;
  save.buildings[id]++;
  return true;
}

export function canUpgrade(save: SaveData, id: UpgradeId): BuyCheck {
  const cost = upgradeCost(id, save.upgrades[id], save.buildings);
  if (cost === null) return { ok: false, reason: 'Fully upgraded' };
  if (save.coins < cost) return { ok: false, reason: 'Not enough coins', cost };
  return { ok: true, cost };
}

export function upgrade(save: SaveData, id: UpgradeId): boolean {
  const c = canUpgrade(save, id);
  if (!c.ok) return false;
  save.coins -= c.cost;
  save.upgrades[id]++;
  return true;
}

/** After the tutorial, the first catch builds the fish market (§10). */
export function finishTutorial(save: SaveData, now = Date.now()): void {
  save.tutorial = 2;
  if (save.buildings.market < 1) {
    save.buildings.market = 1;
    save.store = { stored: 0, last: now };
  }
}

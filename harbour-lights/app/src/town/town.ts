import { BUILDINGS, TUNING, type BuildingId } from '../config/tuning';
import type { Upgrades } from '../sim/beam';

/** The town (§9): buildings, idle earnings and lighthouse upgrades. No drawing code. */

export type Levels = Record<BuildingId, number>;

export function freshLevels(): Levels {
  return { market: 1, smokehouse: 0, boatyard: 0, inn: 0, chandlery: 0, pier: 0 };
}

export function building(id: BuildingId) {
  return BUILDINGS.find((b) => b.id === id)!;
}

/** Cost of taking a building to `level` (1 = building it). Costs rise by COST_FACTOR per level. */
export function levelCost(id: BuildingId, level: number): number {
  const b = building(id);
  if (level <= 1) return b.cost;
  const base = b.cost || TUNING.FISH_MARKET_BASE_COST;
  return Math.round((base * TUNING.COST_FACTOR ** (level - 1)) / 10) * 10;
}

/** Earnings per hour of one building at a level (0 = not built). */
export function buildingRate(id: BuildingId, level: number): number {
  if (level <= 0) return 0;
  return Math.round(building(id).perHour * TUNING.EARN_FACTOR ** (level - 1));
}

export function hourlyRate(levels: Levels): number {
  return BUILDINGS.reduce((a, b) => a + buildingRate(b.id, levels[b.id]), 0);
}

/** A building is offered once the player has reached its night. */
export function buildingUnlocked(id: BuildingId, reachedNight: number): boolean {
  return reachedNight >= building(id).unlock;
}

export interface Store {
  /** Coins earned and waiting to be collected. */
  stored: number;
  /** Device time (ms) up to which earnings have been counted. */
  last: number;
}

export function storeCap(levels: Levels): number {
  return hourlyRate(levels) * TUNING.STORE_HOURS;
}

/**
 * Brings the store up to `now`. Earnings stop at four hours' worth (§9.2). A clock set
 * backwards earns nothing; a clock set forwards can claim at most one full store.
 */
export function accrue(store: Store, levels: Levels, now: number): void {
  const dt = (now - store.last) / 3_600_000;
  if (dt > 0) store.stored = Math.min(storeCap(levels), store.stored + hourlyRate(levels) * dt);
  store.last = now;
}

export function collect(store: Store, levels: Levels, now: number): number {
  accrue(store, levels, now);
  const coins = Math.floor(store.stored);
  store.stored -= coins;
  return coins;
}

// ── Lighthouse upgrades (§9.3) ───────────────────────────────

export type UpgradeId = keyof Upgrades;

export const UPGRADE_NAMES: Record<UpgradeId, { name: string; stat: string; values: readonly number[]; unit: string }> = {
  width: { name: 'Wider beam', stat: 'Half-width', values: TUNING.BEAM_HALF_WIDTH, unit: '°' },
  reach: { name: 'Longer reach', stat: 'Reach', values: TUNING.BEAM_REACH, unit: ' tiles' },
  turn: { name: 'Faster turn', stat: 'Turning', values: TUNING.BEAM_TURN, unit: '°/s' },
};

/** Cost of the next level of an upgrade, or null at the top. The chandlery takes 10% off. */
export function upgradeCost(id: UpgradeId, current: number, levels: Levels): number | null {
  const costs = TUNING.UPGRADE_COSTS[id];
  if (current >= costs.length) return null;
  const discount = levels.chandlery > 0 ? 1 - TUNING.CHANDLERY_DISCOUNT : 1;
  return Math.round(costs[current] * discount);
}

/** Lit windows in the town grow with buildings and levels (§11). */
export function windowCount(levels: Levels): number {
  return BUILDINGS.reduce((a, b) => a + (levels[b.id] > 0 ? 1 + levels[b.id] : 0), 0);
}

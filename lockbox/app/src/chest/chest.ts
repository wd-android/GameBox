import { TIER_REWARDS, TUNING, type Tier } from '../config/tuning';
import { Rng, hash } from '../locks/rng';
import type { LockSpec } from '../locks/types';
import { RARES, SETS, type Trinket } from './trinkets';
import chapterData from './chapters.json';

/** Chests (§9). Seeds for both chapters are fixed in chapters.json, so every player meets the same chests. */
export interface ChestDef {
  id: string;
  chapter: number;
  index: number;
  tier: Tier;
  seed: number;
  locks: LockSpec[];
}

export const CHAPTERS = [
  { id: 1, name: 'The Attic', blurb: 'Dusty trunks under the eaves', chests: (chapterData as { chapters: ChestDef[][] }).chapters[0] },
  { id: 2, name: "The Ship's Hold", blurb: 'Sea chests below deck', chests: (chapterData as { chapters: ChestDef[][] }).chapters[1] },
];

export function chestById(id: string): ChestDef | undefined {
  return CHAPTERS.flatMap((c) => c.chests).find((c) => c.id === id);
}

/** The seed of lock i of a chest, for a given retry (Locksmith re-generates after a jam). */
export function lockSeed(chest: { seed: number }, lock: number, retry: number): number {
  return hash(chest.seed, lock, retry);
}

export interface Reward {
  coins: number;
  trinket: string | null;
  rare: string | null;
}

/**
 * Rewards (§9.2), decided from the chest's seed. A trinket comes from the
 * chapter's sets, favouring ones the player does not have yet.
 */
export function rollReward(chest: ChestDef, owned: string[]): Reward {
  const rng = new Rng(hash(chest.seed, 0xbeef));
  const r = TIER_REWARDS[chest.tier];
  const coins = rng.range(r.coins[0], r.coins[1]);
  let trinket: string | null = null;
  if (rng.float() < r.trinket) {
    const pool = SETS.filter((s) => s.chapter === chest.chapter).flatMap((s) => s.items);
    const unowned = pool.filter((t) => !owned.includes(t.id));
    trinket = rng.pick(unowned.length ? unowned : pool).id;
  }
  let rare: string | null = null;
  if (rng.float() < r.rare) {
    const pool = RARES.filter((t) => t.chapter === chest.chapter);
    const unowned = pool.filter((t) => !owned.includes(t.id));
    rare = rng.pick(unowned.length ? unowned : pool).id;
  }
  return { coins, trinket, rare };
}

export function replayCoins(reward: Reward): number {
  return Math.round(reward.coins * TUNING.REPLAY_COIN_FACTOR);
}

/** Daily Safe (§9.4): one chest a day from the date; two locks of different types at mid-chapter-2 difficulty. */
export function dailyChest(dateKey: string): ChestDef {
  const seed = Number(dateKey.replace(/-/g, ''));
  const rng = new Rng(hash(seed, 0xda11));
  const types = rng.shuffle(['padlock', 'bottles', 'rings', 'bolts'] as const).slice(0, 2);
  const locks: LockSpec[] = types.map((t) => {
    if (t === 'padlock') return { type: t, parts: 4, information: rng.pick(['clued', 'feedback'] as const), depth: 1 };
    if (t === 'bottles') return { type: t, parts: rng.range(4, 5), information: rng.pick(['clued', 'feedback'] as const), depth: 1 };
    if (t === 'rings') return { type: t, parts: rng.range(3, 4), information: 'clued', steps: 8, linkages: rng.range(1, 2) };
    return { type: t, parts: rng.range(6, 7), information: 'full', size: 6 };
  });
  return { id: `daily-${dateKey}`, chapter: 2, index: 0, tier: 'silver', seed, locks };
}

export function trinketsOf(ids: string[]): Trinket[] {
  return ids.map((id) => [...SETS.flatMap((s) => s.items), ...RARES].find((t) => t.id === id)).filter((t): t is Trinket => !!t);
}

import { TUNING } from '../config/tuning';
import { CHAPTERS, replayCoins, rollReward, type ChestDef, type Reward } from '../chest/chest';
import { SETS } from '../chest/trinkets';
import type { SaveData } from '../state/save';
import { rankFor, type Mode } from './rules';

/** Rewards, sets, ranks, chapters and the Daily Safe (§9, §11). */

export interface OpenOutcome {
  reward: Reward;
  coins: number;
  first: boolean;
  setsCompleted: string[];
  newBest: boolean;
}

export function recordOpen(save: SaveData, chest: ChestDef, mode: Mode, stars: number): OpenOutcome {
  const rec = (save.chests[chest.id] ??= { silver: 0, gold: 0, rewardTaken: false });
  const before = mode === 'locksmith' ? rec.gold : rec.silver;
  if (mode === 'locksmith') rec.gold = Math.max(rec.gold, stars);
  else rec.silver = Math.max(rec.silver, stars);
  const first = !rec.rewardTaken;
  const reward = rec.reward ?? rollReward(chest, save.trinkets);
  rec.reward = reward;
  let coins: number;
  const setsCompleted: string[] = [];
  if (first) {
    rec.rewardTaken = true;
    coins = reward.coins;
    for (const t of [reward.trinket, reward.rare]) {
      if (!t || save.trinkets.includes(t)) continue;
      save.trinkets.push(t);
      save.vault[save.vault.length - 1].push(t);
    }
    for (const s of SETS) {
      if (save.setsDone.includes(s.id)) continue;
      if (s.items.every((it) => save.trinkets.includes(it.id))) {
        save.setsDone.push(s.id);
        coins += TUNING.SET_REWARD;
        setsCompleted.push(s.name);
      }
    }
  } else coins = replayCoins(reward);
  save.coins += coins;
  return { reward, coins, first, setsCompleted, newBest: stars > before };
}

export function goldStars(save: SaveData): number {
  return Object.values(save.chests).reduce((a, r) => a + r.gold, 0);
}

export function rank(save: SaveData): { name: string; next: number | null; stars: number } {
  const stars = goldStars(save);
  return { ...rankFor(stars), stars };
}

export function openedIn(save: SaveData, chapter: number): number {
  return CHAPTERS[chapter - 1].chests.filter((c) => save.chests[c.id]?.rewardTaken).length;
}

export function chapterUnlocked(save: SaveData, chapter: number): boolean {
  return chapter === 1 || openedIn(save, 1) >= TUNING.CHAPTER2_UNLOCK;
}

/** Chests open in order within a chapter. */
export function chestUnlocked(save: SaveData, chest: ChestDef): boolean {
  if (!chapterUnlocked(save, chest.chapter)) return false;
  if (chest.index === 1) return true;
  const prev = CHAPTERS[chest.chapter - 1].chests[chest.index - 2];
  return !!save.chests[prev.id]?.rewardTaken;
}

export function nextChest(save: SaveData): ChestDef | null {
  for (const ch of CHAPTERS) for (const c of ch.chests) if (chestUnlocked(save, c) && !save.chests[c.id]?.rewardTaken) return c;
  return null;
}

// ── Daily Safe (§9.4) ─────────────────────────────────────────

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

export function currentStreak(save: SaveData, today: string): number {
  const last = save.daily.last;
  if (!last) return 0;
  return last === today || last === previousDay(today) ? save.daily.streak : 0;
}

export function recordDaily(save: SaveData, key: string, tries: number): { streak: number; first: boolean } {
  if (save.daily.history[key]) return { streak: save.daily.streak, first: false };
  save.daily.history[key] = { tries };
  save.daily.streak = save.daily.last === previousDay(key) ? save.daily.streak + 1 : 1;
  save.daily.last = key;
  return { streak: save.daily.streak, first: true };
}

export function dailyText(key: string, tries: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const month = new Date(y, m - 1, d).toLocaleString('en-GB', { month: 'short' });
  return `Lockbox Daily ${d} ${month} – opened in ${tries} tries.`;
}

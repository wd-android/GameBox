import { chestById, dailyChest, type ChestDef } from '../chest/chest';
import { ChestSession } from '../game/session';
import { dateKey, nextChest, recordDaily, recordOpen, type OpenOutcome } from '../game/progress';
import type { Mode } from '../game/rules';
import type { SaveData } from '../state/save';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import type { Route } from './store';

/** The first three chests are played straight through, with no menu (§12, first launch). */
export const FIRST_CHESTS = 3;

export function sessionRoute(session: ChestSession): Route {
  return session.chest.locks.length === 1 ? { name: 'lock', session, index: 0 } : { name: 'chest', session };
}

export function startChest(save: SaveData, chest: ChestDef, mode: Mode): Route {
  const session = new ChestSession(chest, mode);
  save.inProgress = session.serialize();
  return sessionRoute(session);
}

export function startDaily(save: SaveData): Route {
  const key = dateKey();
  const ip = save.inProgress;
  if (ip && ip.chestId === `daily-${key}`) return sessionRoute(new ChestSession(dailyChest(key), 'daily', ip));
  return startChest(save, dailyChest(key), 'daily');
}

/** Rebuilds the chest in progress, exactly where it stopped. */
export function resume(save: SaveData): ChestSession | null {
  const ip = save.inProgress;
  if (!ip) return null;
  const chest = ip.chestId.startsWith('daily-') ? dailyChest(ip.chestId.slice(6)) : chestById(ip.chestId);
  if (!chest) return null;
  try {
    return new ChestSession(chest, ip.mode, ip);
  } catch {
    return null;
  }
}

export function startRoute(save: SaveData): Route {
  const s = resume(save);
  if (s) return sessionRoute(s);
  save.inProgress = null;
  if (save.firstChestsDone < FIRST_CHESTS) {
    const c = nextChest(save);
    if (c) return startChest(save, c, 'relaxed');
  }
  return { name: 'home' };
}

/** Called when the last lock opens: records stars and rewards, then plays the opening. */
export function finishChest(save: SaveData, session: ChestSession): Route {
  save.inProgress = null;
  sound.chestOpen();
  haptic.long();
  if (session.mode === 'daily') {
    const key = session.chest.id.slice(6);
    const r = recordDaily(save, key, session.totalTries);
    const outcome: OpenOutcome = { reward: { coins: 0, trinket: null, rare: null }, coins: 0, first: r.first, setsCompleted: [], newBest: false };
    return { name: 'opening', session, outcome, extra: key };
  }
  const outcome = recordOpen(save, session.chest, session.mode, session.stars);
  if (save.firstChestsDone < FIRST_CHESTS) save.firstChestsDone++;
  return { name: 'opening', session, outcome };
}

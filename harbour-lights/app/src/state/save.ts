import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { APP } from '../config/app';
import { TUNING } from '../config/tuning';
import { freshLevels, type Levels, type Store } from '../town/town';
import type { Upgrades } from '../sim/beam';

/**
 * One JSON document, saved after every night and every purchase (§12).
 * A night in progress is not saved. Nothing leaves the device.
 */
export type BeamControl = 'drag' | 'touch';

export interface Settings {
  control: BeamControl;
  sensitivity: number;
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  reduceMotion: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
  coins: number;
  /** Per night: best stars (0 = failed or not played) and best catch. */
  nights: Record<number, { stars: number; best: number }>;
  buildings: Levels;
  upgrades: Upgrades;
  request: { index: number; progress: number } | null;
  requestsDone: number;
  store: Store;
  /** 0 and 1: tutorial nights still to play; 2: done. */
  tutorial: number;
  landedTotal: number;
}

function deviceReducesMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function freshSave(now = Date.now()): SaveData {
  return {
    version: APP.SAVE_VERSION,
    settings: { control: 'drag', sensitivity: TUNING.DRAG_SENSITIVITY.default, music: true, sfx: true, vibration: true, reduceMotion: deviceReducesMotion() },
    coins: 0,
    nights: {},
    buildings: { ...freshLevels(), market: 0 },
    upgrades: { width: 0, reach: 0, turn: 0 },
    request: null,
    requestsDone: 0,
    store: { stored: 0, last: now },
    tutorial: 0,
    landedTotal: 0,
  };
}

export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return {
    ...base,
    ...r,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    buildings: { ...base.buildings, ...(r.buildings ?? {}) },
    upgrades: { ...base.upgrades, ...(r.upgrades ?? {}) },
    store: { ...base.store, ...(r.store ?? {}) },
    version: APP.SAVE_VERSION,
  };
}

const native = Capacitor.isNativePlatform();

export async function loadSave(): Promise<SaveData> {
  try {
    const text = native ? (await Preferences.get({ key: APP.SAVE_KEY })).value : localStorage.getItem(APP.SAVE_KEY);
    return migrate(text ? JSON.parse(text) : null);
  } catch {
    return freshSave();
  }
}

let pending: Promise<void> = Promise.resolve();

export function writeSave(save: SaveData): Promise<void> {
  const text = JSON.stringify(save);
  pending = pending.then(async () => {
    try {
      if (native) await Preferences.set({ key: APP.SAVE_KEY, value: text });
      else localStorage.setItem(APP.SAVE_KEY, text);
    } catch {
      /* keep the light burning */
    }
  });
  return pending;
}

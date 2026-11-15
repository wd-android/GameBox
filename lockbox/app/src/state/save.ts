import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { APP } from '../config/app';
import type { Detail } from '../locks/types';
import type { SessionSave } from '../game/session';
import type { Reward } from '../chest/chest';

/** One JSON document, saved after every move (§14). Nothing leaves the device. */
export interface Settings {
  detail: Detail;
  preferredMode: 'relaxed' | 'locksmith';
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  symbols: boolean;
  largeClues: boolean;
  reduceMotion: boolean;
}

export interface ChestRecord {
  /** Relaxed stars (silver) and Locksmith stars (gold). */
  silver: number;
  gold: number;
  rewardTaken: boolean;
  reward?: Reward;
}

export interface SaveData {
  version: number;
  settings: Settings;
  coins: number;
  chests: Record<string, ChestRecord>;
  trinkets: string[];
  /** Vault shelves: trinket ids per shelf, in order. */
  vault: string[][];
  setsDone: string[];
  daily: { history: Record<string, { tries: number }>; streak: number; last: string | null };
  inProgress: SessionSave | null;
  firstChestsDone: number;
}

function deviceReducesMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function freshSave(): SaveData {
  return {
    version: APP.SAVE_VERSION,
    settings: { detail: 'which', preferredMode: 'relaxed', music: true, sfx: true, vibration: true, symbols: true, largeClues: false, reduceMotion: deviceReducesMotion() },
    coins: 0,
    chests: {},
    trinkets: [],
    vault: [[], [], []],
    setsDone: [],
    daily: { history: {}, streak: 0, last: null },
    inProgress: null,
    firstChestsDone: 0,
  };
}

export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return { ...base, ...r, settings: { ...base.settings, ...(r.settings ?? {}) }, daily: { ...base.daily, ...(r.daily ?? {}) }, version: APP.SAVE_VERSION };
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
      /* keep playing */
    }
  });
  return pending;
}

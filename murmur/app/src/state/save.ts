import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { APP } from '../config/app';
import type { SpeciesId } from '../config/tuning';

/** One JSON document, saved after every run (§11). A run in progress is not saved. */
export type Steering = 'thumb' | 'draw';

export interface Settings {
  steering: Steering;
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  reduceMotion: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
  feathers: number;
  best: number;
  bestBySpecies: Partial<Record<SpeciesId, number>>;
  totalGathered: number;
  species: SpeciesId;
  sky: string;
  completed: number[];
  runsPlayed: number;
  firstLaunchDone: boolean;
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
    settings: { steering: 'thumb', music: true, sfx: true, vibration: true, reduceMotion: deviceReducesMotion() },
    feathers: 0,
    best: 0,
    bestBySpecies: {},
    totalGathered: 0,
    species: 'starlings',
    sky: 'dusk',
    completed: [],
    runsPlayed: 0,
    firstLaunchDone: false,
  };
}

export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return { ...base, ...r, settings: { ...base.settings, ...(r.settings ?? {}) }, version: APP.SAVE_VERSION };
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
      /* keep flying */
    }
  });
  return pending;
}

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { APP } from '../config/app';
import type { ShapeId } from '../jars/shapes';
import type { PourMode } from '../input/pourControl';

/** Everything the game keeps (§12). Saved as one JSON document; nothing leaves the device. */
export interface Settings {
  pouring: PourMode;
  guides: boolean;
  patterns: boolean;
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  reduceMotion: boolean;
}

export interface JarRecord {
  /** Best accuracy, 0..1. */
  best: number;
  stars: number;
  freehand: boolean;
  /** The kept grid, run-length compressed. */
  kept: string;
  /** Corks already paid for this jar (replays pay only for improvement). */
  paid: number;
}

export interface FreeJar {
  shape: ShapeId;
  grid: string;
  made: string;
}

export interface InProgress {
  mode: 'match' | 'daily' | 'free';
  jarId: number;
  shape: ShapeId;
  cells: string;
  remaining: number[] | null;
  tilt: number;
  colour: number;
  undosUsed: number;
  tick: number;
  rng: number;
  date?: string;
}

export interface SaveData {
  version: number;
  settings: Settings;
  corks: number;
  jars: Record<string, JarRecord>;
  free: FreeJar[];
  setsDone: string[];
  decorations: string[];
  owned: string[];
  equipped: { backdrop: string; lighting: string; label: string };
  daily: { history: Record<string, { acc: number; stars: number; grid: string; jarId: number }>; streak: number; last: string | null };
  inProgress: InProgress | null;
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
    settings: {
      pouring: 'thumb',
      guides: true,
      patterns: false,
      music: true,
      sfx: true,
      vibration: true,
      reduceMotion: deviceReducesMotion(),
    },
    corks: 0,
    jars: {},
    free: [],
    setsDone: [],
    decorations: [],
    owned: ['backdrop:dusk', 'lighting:soft', 'label:plain'],
    equipped: { backdrop: 'dusk', lighting: 'soft', label: 'plain' },
    daily: { history: {}, streak: 0, last: null },
    inProgress: null,
    firstLaunchDone: false,
  };
}

/** Converts older saves to the current shape (§12: a version number allows later builds to convert). */
export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  // v1 is the first version: fill any missing fields from defaults.
  return {
    ...base,
    ...r,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    equipped: { ...base.equipped, ...(r.equipped ?? {}) },
    daily: { ...base.daily, ...(r.daily ?? {}) },
    version: APP.SAVE_VERSION,
  };
}

const native = Capacitor.isNativePlatform();

export async function loadSave(): Promise<SaveData> {
  try {
    let text: string | null;
    if (native) text = (await Preferences.get({ key: APP.SAVE_KEY })).value;
    else text = localStorage.getItem(APP.SAVE_KEY);
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
      /* storage full or unavailable: keep playing */
    }
  });
  return pending;
}

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { APP } from '../config/app';
import type { BallId } from '../config/tuning';
import type { MaterialId } from '../render/materials';
import type { Mat3 } from '../physics/orientation';

/** Everything the game keeps (§10), as one JSON document. Nothing leaves the device. */
export interface Settings {
  control: 'tilt' | 'step';
  sensitivity: number;
  minimap: boolean;
  trail: boolean;
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  reduceMotion: boolean;
}

export interface BallRecord {
  time: number;
  stars: number;
  falls: number;
  score: number;
}

/** Per level: best per ball, plus the separate step medal. */
export type LevelRecord = Partial<Record<BallId | 'step', BallRecord>>;

export type PlayKind = 'journey' | 'daily' | 'explore';

export interface InProgress {
  kind: PlayKind;
  levelId?: number;
  code?: string;
  date?: string;
  ball: BallId;
  control: 'tilt' | 'step';
  checkpoint: { face: number; p: { x: number; y: number }; R: Mat3; disarmed: number };
  timerTicks: number;
  falls: number;
}

export interface SaveData {
  version: number;
  settings: Settings;
  coins: number;
  ball: BallId;
  material: MaterialId;
  materials: MaterialId[];
  levels: Record<string, LevelRecord>;
  daily: { history: Record<string, { best: number; code: string }>; streak: number; last: string | null };
  inProgress: InProgress | null;
  seenTutorial: boolean;
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
    settings: { control: 'tilt', sensitivity: 80, minimap: true, trail: true, music: true, sfx: true, vibration: true, reduceMotion: deviceReducesMotion() },
    coins: 0,
    ball: 'bronze',
    material: 'violet',
    materials: ['violet'],
    levels: {},
    daily: { history: {}, streak: 0, last: null },
    inProgress: null,
    seenTutorial: false,
  };
}

/** Converts older saves (§10: a version number allows later builds to convert). */
export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return {
    ...base,
    ...r,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    daily: { ...base.daily, ...(r.daily ?? {}) },
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
      /* keep playing */
    }
  });
  return pending;
}

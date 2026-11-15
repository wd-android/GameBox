import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { APP } from '../config/app';
import { TUNING } from '../config/tuning';
import type { SessionState } from '../game/session';

/** One JSON document, saved after every topple (§13). Nothing leaves the device. */
export interface Settings {
  showPar: boolean;
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  reminder: boolean;
  reminderTime: string;
  reduceMotion: boolean;
}

export interface DailyRecord {
  /** Topples in the original attempt record (Archive replays don't change it). */
  topples: number;
  solved: boolean;
  /** Date it was solved, and whether that was on its own date. */
  solvedDate?: string;
  onTime: boolean;
  used?: number;
  gold: boolean;
  hint: boolean;
}

export interface PackRecord {
  solved: boolean;
  gold: boolean;
  topples: number;
  used: number;
}

export interface SaveData {
  version: number;
  settings: Settings;
  tokens: number;
  styles: { owned: string[]; domino: string; table: string };
  daily: Record<string, DailyRecord>;
  pack: Record<string, PackRecord>;
  streakMilestonesPaid: number;
  tutorialDone: number;
  inProgress: { key: string; state: SessionState } | null;
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
    settings: { showPar: false, music: true, sfx: true, vibration: true, reminder: false, reminderTime: '09:00', reduceMotion: deviceReducesMotion() },
    tokens: TUNING.STARTER_TOKENS,
    styles: { owned: ['domino:classic', 'table:oak'], domino: 'classic', table: 'oak' },
    daily: {},
    pack: {},
    streakMilestonesPaid: 0,
    tutorialDone: 0,
    inProgress: null,
  };
}

export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return { ...base, ...r, settings: { ...base.settings, ...(r.settings ?? {}) }, styles: { ...base.styles, ...(r.styles ?? {}) }, version: APP.SAVE_VERSION };
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

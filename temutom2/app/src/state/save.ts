import { Preferences } from '@capacitor/preferences';
import { APP } from '../config/app';
import type { Mark } from '../sim/types';
import type { DayCard, ReviewKey } from '../game/reviews';

export interface Settings {
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  /** null follows the device */
  reduceFlashing: boolean | null;
  reduceMotion: boolean | null;
  moodHints: boolean;
  longerWarnings: boolean;
  largerCaptions: boolean;
  leftHanded: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
  moments: Record<string, { stars: number; best: number }>;
  lapsesSeen: number;
  notes: string[];
  cabinet: string[];
  archive: DayCard[];
  /** Per day in progress: the latest score and review of each moment won */
  dayLog: Record<string, { scores: Record<string, number>; keys: Record<string, ReviewKey> }>;
  mood: { history: Record<string, number>; streak: number; last: string | null; quote: Record<string, string> };
  /** Claw marks from the last moment, shown on Home until the next one starts */
  marks: Mark[];
  played: number;
}

export function freshSave(): SaveData {
  return {
    version: APP.saveVersion,
    settings: { music: true, sfx: true, vibration: true, reduceFlashing: null, reduceMotion: null, moodHints: false, longerWarnings: false, largerCaptions: false, leftHanded: false },
    moments: {}, lapsesSeen: 0, notes: [], cabinet: [], archive: [], dayLog: {},
    mood: { history: {}, streak: 0, last: null, quote: {} },
    marks: [], played: 0,
  };
}

export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return { ...base, ...r, settings: { ...base.settings, ...(r.settings ?? {}) }, mood: { ...base.mood, ...(r.mood ?? {}) }, version: APP.saveVersion };
}

const KEY = 'temutom2.save';

export async function loadSave(): Promise<SaveData> {
  try { const { value } = await Preferences.get({ key: KEY }); if (value) return migrate(JSON.parse(value)); } catch { /* fall back */ }
  try { const v = localStorage.getItem(KEY); if (v) return migrate(JSON.parse(v)); } catch { /* ignore */ }
  return freshSave();
}

export async function writeSave(d: SaveData) {
  const json = JSON.stringify(d);
  try { await Preferences.set({ key: KEY, value: json }); } catch { /* ignore */ }
  try { localStorage.setItem(KEY, json); } catch { /* ignore */ }
}

export const serialise = (d: SaveData) => JSON.stringify(d);
export const deserialise = (s: string) => migrate(JSON.parse(s));

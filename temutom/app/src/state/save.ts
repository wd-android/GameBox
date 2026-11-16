import { Preferences } from '@capacitor/preferences';
import { APP } from '../config/app';
import { TUNING } from '../config/tuning';
import type { DemandKind, RoomId, StaffId } from '../sim/types';
import type { DayCard, ReviewCondition } from '../game/reviews';

export interface Settings {
  music: boolean;
  sfx: boolean;
  vibration: boolean;
  fewerLapses: boolean;
  longerPatience: boolean;
  largerCaptions: boolean;
  /** null follows the device */
  reduceMotion: boolean | null;
}

export interface SaveData {
  version: number;
  settings: Settings;
  shifts: Record<string, { stars: number; best: number }>;
  compliance: Record<StaffId, Record<DemandKind, number>>;
  morale: number;
  lastPlayed: string | null;
  thrones: RoomId[];
  cabinet: string[];
  archive: DayCard[];
  staffReviews: Record<StaffId, string[]>;
  dayLog: Record<string, { scores: Record<string, number>; conditions: Partial<Record<StaffId, ReviewCondition[]>> }>;
  daily: { history: Record<string, number>; streak: number; last: string | null; quote: Record<string, string> };
  played: number;
}

const zero = (): Record<DemandKind, number> => ({ food: 0, door: 0, lap: 0, play: 0 });

export function freshSave(): SaveData {
  return {
    version: APP.saveVersion,
    settings: { music: true, sfx: true, vibration: true, fewerLapses: false, longerPatience: false, largerCaptions: false, reduceMotion: null },
    shifts: {},
    compliance: { soft: zero(), busy: zero(), guest: zero(), soft2: zero() },
    morale: TUNING.morale.start,
    lastPlayed: null,
    thrones: [],
    cabinet: [],
    archive: [],
    staffReviews: { soft: [], busy: [], guest: [], soft2: [] },
    dayLog: {},
    daily: { history: {}, streak: 0, last: null, quote: {} },
    played: 0,
  };
}

/** Convert older saves to the current shape. */
export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const out: SaveData = {
    ...base,
    ...r,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    compliance: { ...base.compliance, ...(r.compliance ?? {}) },
    staffReviews: { ...base.staffReviews, ...(r.staffReviews ?? {}) },
    daily: { ...base.daily, ...(r.daily ?? {}) },
    version: APP.saveVersion,
  };
  return out;
}

const KEY = 'temutom.save';

export async function loadSave(): Promise<SaveData> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) return migrate(JSON.parse(value));
  } catch { /* fall through */ }
  try {
    const v = localStorage.getItem(KEY);
    if (v) return migrate(JSON.parse(v));
  } catch { /* ignore */ }
  return freshSave();
}

export async function writeSave(d: SaveData) {
  const json = JSON.stringify(d);
  try { await Preferences.set({ key: KEY, value: json }); } catch { /* ignore */ }
  try { localStorage.setItem(KEY, json); } catch { /* ignore */ }
}

export function serialise(d: SaveData) { return JSON.stringify(d); }
export function deserialise(s: string) { return migrate(JSON.parse(s)); }

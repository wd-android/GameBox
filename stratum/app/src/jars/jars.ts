import matchData from './data/match.json';
import dailyData from './data/daily.json';
import type { JarDef, JarFile } from './types';
import { TUNING } from '../config/tuning';

const match = (matchData as JarFile).jars;
const daily = (dailyData as JarFile).jars;

export function matchJar(id: number): JarDef {
  return match[Math.max(0, Math.min(match.length - 1, id - 1))];
}

export function allMatchJars(): JarDef[] {
  return match;
}

export function dailyJars(): JarDef[] {
  return daily;
}

export function jarById(id: number): JarDef | undefined {
  return id > 1000 ? daily.find((d) => d.id === id) : match.find((m) => m.id === id);
}

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Days since 1 Jan 2026 for a YYYY-MM-DD key. Used to rotate the daily jar, the same for every player. */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000);
}

export function dailyJarFor(key: string): JarDef {
  const n = dayNumber(key);
  const i = ((n % TUNING.DAILY_JAR_COUNT) + TUNING.DAILY_JAR_COUNT) % TUNING.DAILY_JAR_COUNT;
  return daily[i];
}

export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(y, m - 1, d - 1);
  return dateKey(t);
}

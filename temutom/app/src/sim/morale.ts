import { TUNING } from '../config/tuning';
import type { ShiftState } from './types';
import { inBand } from './attention';
import { changeMorale, emit } from './util';

export type MoraleLevel = 'fine' | 'boundaries' | 'spray' | 'carrier';

export function moraleLevel(morale: number): MoraleLevel {
  if (morale <= 0) return 'carrier';
  if (morale < TUNING.morale.spray) return 'spray';
  if (morale < TUNING.morale.boundaries) return 'boundaries';
  return 'fine';
}

export function stepMorale(s: ShiftState, dt: number, before: number) {
  if (!s.def.systems.morale) return;
  if (s.cat.sittingOn && inBand(s)) changeMorale(s, TUNING.morale.lapInBandPerSecond * dt);
  const a = moraleLevel(before);
  const b = moraleLevel(s.morale);
  if (a !== b) emit(s, { type: 'moraleLevel', kind: b });
}

/** Between shifts (spec §8.3) */
export function moraleBetweenShifts(m: number, newDay: boolean) {
  let v = Math.min(100, m + TUNING.morale.betweenShifts);
  if (newDay) v = Math.max(v, TUNING.morale.newDayFloor);
  return v;
}

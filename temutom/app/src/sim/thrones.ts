import { TUNING } from '../config/tuning';
import type { ShiftState } from './types';
import { emit } from './util';
import { inBand } from './attention';

/** Sitting on the throne with attention inside the band adds to progress (spec §10). */
export function stepThrone(s: ShiftState, dt: number) {
  const c = s.cat;
  if (!s.def.systems.verbs.includes('sitOn')) return;
  if (c.action === 'moving' || c.action === 'held' || c.spot !== s.room.throne) return;
  if (!inBand(s)) return;
  if (s.throne.claimedNow) return;
  s.throne.progress += dt;
  if (s.throne.progress >= TUNING.throne.need) {
    s.throne.claimedNow = true;
    emit(s, { type: 'throneClaimed', x: c.x, y: c.y });
  }
}

export function onThrone(s: ShiftState) {
  return s.cat.spot === s.room.throne && s.cat.action !== 'moving' && s.cat.action !== 'held';
}

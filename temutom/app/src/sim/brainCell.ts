import { TUNING } from '../config/tuning';
import { chance, pick, range } from './rng';
import type { ShiftState } from './types';
import { activeSpots, changeMorale, emit, present, spot } from './util';

const B = TUNING.brainCell;
const L = TUNING.lapse;

export function initBrain(s: ShiftState) {
  s.cat.brain = { phase: 'away', t: range(s.rng, B.away[0], B.away[1]) };
}

export function brainPresent(s: ShiftState) {
  return s.def.systems.brainCell && s.cat.brain.phase === 'present';
}

export function stepBrain(s: ShiftState, dt: number) {
  if (!s.def.systems.brainCell) return;
  const b = s.cat.brain;
  b.t -= dt;
  if (b.phase === 'away' && b.t <= B.arrivingWarning) {
    b.phase = 'arriving';
    emit(s, { type: 'brainArriving' });
  }
  if (b.t <= 0) {
    if (b.phase === 'present') {
      b.phase = 'away';
      b.t = range(s.rng, B.away[0], B.away[1]);
      emit(s, { type: 'brainLeft' });
      if (s.scheme) {
        // He forgets what he was doing.
        s.scheme = null;
        if (s.cat.action === 'scheme') { s.cat.action = 'idle'; s.cat.actionT = 0; }
        emit(s, { type: 'schemeForgotten' });
      }
    } else {
      b.phase = 'present';
      b.t = range(s.rng, B.present[0], B.present[1]);
      emit(s, { type: 'brainPresent' });
    }
  }
}

export function lapseChance(s: ShiftState): number {
  let p = L.chance;
  if (s.settings.fewerLapses) p *= 0.5;
  if (s.def.modifiers?.includes('box')) p *= 2;
  return p;
}

/** Whether a lapse is permitted right now (spec §9.1) */
export function lapseAllowed(s: ShiftState): boolean {
  if (!s.def.systems.brainCell) return false;
  if (s.cat.brain.phase === 'present') return false;
  if (s.time - s.lastLapseAt < L.gap) return false;
  if (s.length - s.time < L.noneInLast) return false;
  if (s.scheme) return false;
  return true;
}

/**
 * Called when the player tells him to move. Returns the spot he actually goes to,
 * or null if he has stopped to stare at a wall / get into a box instead.
 */
export function maybeLapse(s: ShiftState, wanted: string, forced = false): string | null | undefined {
  if (!lapseAllowed(s)) return undefined;
  if (!forced && !chance(s.rng, lapseChance(s))) return undefined;
  const c = s.cat;
  s.lastLapseAt = s.time;
  s.tally.lapses++;
  const options: ('wrongSpot' | 'wall' | 'box')[] = ['wrongSpot', 'wall'];
  if (s.hasBox) options.push('box');
  const kind = pick(s.rng, options);
  c.lapse = kind;
  emit(s, { type: 'lapse', kind, x: c.x, y: c.y });
  // Staff find it endearing
  for (const m of present(s)) {
    if (m.mode !== 'recoiling') {
      changeMorale(s, TUNING.morale.lapsePerWitness);
      m.mark = { kind: 'heart', t: 1.2 };
    }
  }
  if (kind === 'wrongSpot') {
    const target = spot(s, wanted);
    const alts = activeSpots(s).filter((p) => target.adjacentTo.includes(p.id) && p.id !== wanted && p.id !== c.spot && p.kind !== 'box');
    if (alts.length) return pick(s.rng, alts).id;
    c.lapse = 'wall';
  }
  if (c.lapse === 'wall') {
    c.action = 'lapse';
    c.actionT = range(s.rng, L.wall[0], L.wall[1]);
    return null;
  }
  // Box
  c.action = 'moving';
  c.dest = 'box';
  return 'box';
}

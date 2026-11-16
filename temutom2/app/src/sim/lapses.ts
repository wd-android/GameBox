import { TUNING } from '../config/tuning';
import { chance, pick } from './cat';
import type { LapseKind, MomentState } from './types';
import { emit, note, place } from './util';
import { dropDemand } from './demands';

const L = TUNING.lapse;

export function lapseEligible(s: MomentState) {
  const c = s.cat;
  if (!s.def.systems.lapses || !s.def.systems.brainCell) return false;
  if (c.brain.phase !== 'away') return false;
  if (!c.onScreen || c.strike || c.lapse || c.scheme || c.mood === 'warning' || c.forcedWarning) return false;
  if (s.time - c.lastLapse < L.gap) return false;
  if (c.activity === 'demanding') return (c.demand?.step ?? 9) < 3;
  return c.activity === 'idle' || c.activity === 'seeking';
}

/** On average once every 18 s (twice as often with the box modifier) (§10.2) */
export function maybeLapse(s: MomentState, dt: number) {
  if (!lapseEligible(s)) return;
  const mean = s.def.modifiers?.includes('box') ? L.meanEvery / 2 : L.meanEvery;
  if (!chance(s.rng, dt / mean)) return;
  startLapse(s);
}

export function startLapse(s: MomentState, forced?: LapseKind) {
  const c = s.cat;
  const opts: LapseKind[] = ['prey', 'jump'];
  if (place(s).box || s.def.modifiers?.includes('box')) opts.push('box');
  if (c.demand && c.demand.step < 3) opts.push('forgot', 'forgot');
  const kind = forced ?? pick(s.rng, opts);
  const len = kind === 'prey' ? L.prey : kind === 'jump' ? L.jump : kind === 'box' ? L.box : L.forgot;
  c.lapse = { kind, until: s.time + len };
  c.lastLapse = s.time;
  c.sitOn = null;
  s.tally.lapses++;
  emit(s, { type: 'lapse', kind });
  if (kind === 'forgot') dropDemand(s, true);
}

export function stepLapse(s: MomentState) {
  const c = s.cat;
  if (c.lapse && s.time >= c.lapse.until) {
    emit(s, { type: 'lapseEnded', kind: c.lapse.kind });
    c.lapse = null;
  }
}

/** Tapping him during a lapse counts as having seen it */
export function seeLapse(s: MomentState) {
  const c = s.cat;
  if (!c.lapse || c.lapse.seen) return false;
  c.lapse.seen = true;
  s.tally.lapsesSeen++;
  note(s, `lapse-${c.lapse.kind}`);
  emit(s, { type: 'lapseSeen', kind: c.lapse.kind });
  return true;
}

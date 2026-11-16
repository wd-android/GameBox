import { TUNING } from '../config/tuning';
import { range } from './rng';
import type { ShiftState, StaffState } from './types';
import { catHidden, clamp, present } from './util';

const A = TUNING.attention;

/** What one staff member contributes per second (spec §6.1) */
export function staffAttention(s: ShiftState, m: StaffState): number {
  switch (m.mode) {
    case 'holding': return A.holding;
    case 'stroking': return A.stroking;
    case 'asking': return A.looking + A.talking;
    case 'attending':
    case 'evicting':
    case 'spraying':
      return A.looking;
    case 'responding':
      // Walking over to serve him counts as looking at him; doing something else entirely does not.
      return m.job && (m.job.kind === 'stroke' || m.job.kind === 'pickUp' || m.job.kind === 'ask') ? A.looking : A.busy;
    default:
      if (s.cat.heldBy === m.id) return A.holding;
      if (s.cat.sittingOn === m.id) return A.lap;
      return A.busy;
  }
}

export function attentionRate(s: ShiftState): number {
  const here = present(s);
  if (here.length === 0 || catHidden(s)) return A.empty;
  let total = 0;
  for (const m of here) total += staffAttention(s, m);
  return total;
}

export function stepAttention(s: ShiftState, dt: number) {
  s.cat.attention = clamp(s.cat.attention + attentionRate(s) * dt, 0, 100);
}

export function inBand(s: ShiftState): boolean {
  if (!s.def.systems.band) return true;
  return Math.abs(s.cat.attention - s.band.centre) <= s.band.halfWidth;
}

/** Distance outside the band, 0 when inside */
export function bandDistance(s: ShiftState): number {
  return Math.max(0, Math.abs(s.cat.attention - s.band.centre) - s.band.halfWidth);
}

export function stepBand(s: ShiftState, dt: number) {
  const B = TUNING.band;
  const b = s.band;
  if (!s.def.band.drifts) return;
  if (s.time >= b.nextDrift) {
    b.target = range(s.rng, B.min, B.max);
    b.nextDrift = s.time + range(s.rng, B.driftEvery[0], B.driftEvery[1]);
  }
  const d = b.target - b.centre;
  const maxStep = B.driftSpeed * dt;
  b.centre += clamp(d, -maxStep, maxStep);
  b.centre = clamp(b.centre, B.min, B.max);
}

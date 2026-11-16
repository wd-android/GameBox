import { TUNING } from '../config/tuning';
import { addAttention, addIrritation, pick, range } from './cat';
import { LADDER, type DemandKind, type MomentState } from './types';
import { emit, note, place } from './util';

const D = TUNING.demands;
const L = TUNING.ladder;
/** Seconds into a demand at which each ladder step begins (§8.2) */
export const LADDER_AT = [0, L.near, L.scream, L.knockOff, L.sitOn, L.closeStare, L.smack];

export function demandKinds(s: MomentState): DemandKind[] {
  if (s.def.modifiers?.includes('ravenous')) return ['food'];
  return s.def.demands.kinds ?? place(s).demands;
}

export function issueDemand(s: MomentState, kind: DemandKind, step = 0) {
  const c = s.cat;
  if (c.demand) {
    if (s.def.systems.queue && !c.queued) c.queued = kind;
    return;
  }
  const started = s.time - (LADDER_AT[step] ?? 0);
  c.demand = { kind, startedAt: started, step: -1, nextScream: 0, answered: null };
  c.onScreen = true;
  s.tally.issued++;
  emit(s, { type: 'demand', kind });
  note(s, `tell-${kind}`);
}

export function stepDemandSchedule(s: MomentState) {
  const def = s.def.demands;
  if (def.timed) {
    while (s.timedIdx < def.timed.length && def.timed[s.timedIdx].t <= s.time) {
      const td = def.timed[s.timedIdx++];
      issueDemand(s, td.kind, td.step ?? 0);
    }
  }
  if (def.interval && s.time >= s.nextDemandAt) {
    s.nextDemandAt = s.time + range(s.rng, def.interval[0], def.interval[1]);
    if (s.length - s.time > 10 && (!s.cat.demand || (s.def.systems.queue && !s.cat.queued))) {
      const ks = demandKinds(s);
      let k = pick(s.rng, ks);
      if (s.def.modifiers?.includes('raining') && ks.includes('door') && range(s.rng, 0, 1) < 0.5) k = 'door';
      issueDemand(s, k);
    }
  }
}

/** Is his tell for the current demand being shown right now? (§8.1) */
export function tellShown(s: MomentState): boolean {
  const d = s.cat.demand;
  if (!d) return false;
  if (!s.def.systems.shortTells) return true;
  const e = s.time - d.startedAt;
  if (e < D.tellsFirst) return true;
  return (e - D.tellsFirst) % D.tellsEvery < D.tellsFlash;
}

function settle(s: MomentState) {
  const c = s.cat;
  // Meeting (or forgetting) the demand ends the ladder at any step, including a smack not yet thrown (§8.2).
  if (c.demand && c.demand.step >= LADDER.length - 1) c.forcedWarning = false;
  c.demand = null;
  if (c.queued) {
    const q = c.queued;
    c.queued = null;
    issueDemand(s, q);
  }
}

/** The player gives one of the five answers (§8.1). Returns true if it met his demand. */
export function answer(s: MomentState, kind: DemandKind): boolean {
  const c = s.cat;
  const d = c.demand;
  if (!d) {
    if (kind === 'door') { s.doorOpen = true; emit(s, { type: 'door', value: 1 }); }
    if (kind === 'food') { c.eatUntil = s.time + 2.5; emit(s, { type: 'fed', kind: 'unasked' }); }
    return false;
  }
  if (d.kind !== kind) {
    c.irritation = addIrritation(c.irritation, TUNING.irritation.wrongAnswer);
    s.tally.wrong++;
    if (d.answered === null) d.answered = 'wrong';
    emit(s, { type: 'wrong', kind: d.kind, value: kind === 'nothing' ? 1 : 0 });
    if (kind === 'door') { s.doorOpen = true; emit(s, { type: 'door', value: 1 }); }
    return false;
  }
  // Correct
  const waited = s.time - d.startedAt;
  if (d.answered === null) s.tally.firstTime++;
  s.tally.met++;
  s.tally.slowest = Math.max(s.tally.slowest, waited);
  c.attention = addAttention(c.attention, TUNING.attention.served);
  emit(s, { type: 'met', kind, value: waited });
  note(s, `met-${kind}`);
  c.sitOn = null;
  switch (kind) {
    case 'food': c.eatUntil = s.time + 3; break;
    case 'door':
      s.doorOpen = true;
      emit(s, { type: 'door', value: 1 });
      c.doorPlan = { at: s.time + range(s.rng, D.doorAfter[0], D.doorAfter[1]), kind: pick(s.rng, ['through', 'sit', 'away'] as const), until: 0 };
      if (s.def.modifiers?.includes('raining')) s.nextDemandAt = Math.min(s.nextDemandAt, s.time + 5);
      break;
    case 'lap': c.lapUntil = s.time + range(s.rng, D.lapStay[0], D.lapStay[1]); break;
    case 'play': c.playUntil = s.time + 2; break;
    case 'nothing': break;
  }
  settle(s);
  return true;
}

/** Demand dropped without being met (abandoned, or forgotten during a lapse) */
export function dropDemand(s: MomentState, forgotten: boolean) {
  const d = s.cat.demand;
  if (!d) return;
  emit(s, { type: forgotten ? 'forgot' : 'abandoned', kind: d.kind });
  settle(s);
}

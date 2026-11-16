import { TUNING } from '../config/tuning';
import { addIrritation, chance } from './cat';
import type { MomentState, Over, SchemeId } from './types';
import { emit, note, place } from './util';
import { answer } from './demands';
import { undoChoreStep } from './chores';
import { dist, position } from './util';

const SC = TUNING.scheme;

export function possibleSchemes(s: MomentState): SchemeId[] {
  if (!s.def.systems.schemes) return [];
  const p = place(s);
  const out: SchemeId[] = [];
  if (p.schemePos.treats && p.cupboard) out.push('treats');
  if (p.schemePos.doorHandle && !s.doorOpen) out.push('doorHandle');
  if (p.schemePos.keyboard && s.chore && !s.chore.hoover && s.chore.current > 0) out.push('keyboard');
  return out;
}

/** When the Brain Cell becomes his, he starts a Scheme 70% of the time (§10.1). */
export function maybeStartScheme(s: MomentState) {
  const c = s.cat;
  if (c.strike || c.activity === 'carried' || c.lapse || c.mood === 'warning') return;
  const opts = possibleSchemes(s);
  if (!opts.length || !chance(s.rng, SC.startChance)) return;
  // Prefer the one that serves his current demand
  let id = opts[0];
  if (c.demand?.kind === 'food' && opts.includes('treats')) id = 'treats';
  else if (c.demand?.kind === 'door' && opts.includes('doorHandle')) id = 'doorHandle';
  else id = opts[Math.floor(s.rng.s % opts.length)];
  c.scheme = { id, step: 0, t: SC.stepTime };
  c.sitOn = null;
  emit(s, { type: 'schemeStart', kind: id });
}

export function schemeTarget(id: SchemeId): Over['kind'] {
  return id === 'treats' ? 'cupboard' : id === 'doorHandle' ? 'door' : 'laptop';
}

export function stopScheme(s: MomentState, byPlayer: boolean) {
  const c = s.cat;
  if (!c.scheme) return;
  const id = c.scheme.id;
  c.scheme = null;
  if (byPlayer) {
    c.irritation = addIrritation(c.irritation, TUNING.irritation.schemeStopped);
    s.tally.schemesStopped++;
    if (id === 'keyboard') s.lidClosedUntil = s.time + SC.lidClosed;
    if (id === 'doorHandle') s.doorHeld = s.time + 2;
    emit(s, { type: 'schemeStopped', kind: id });
  } else {
    c.confusedUntil = s.time + 1.5;
    emit(s, { type: 'schemeForgotten', kind: id });
  }
}

export function stepScheme(s: MomentState, dt: number) {
  const c = s.cat;
  if (!c.scheme) return;
  const p = position(s, place(s).schemePos[c.scheme.id] ?? 'near');
  if (dist(c, p) > 4) return; // still walking there
  c.scheme.t -= dt;
  if (c.scheme.t > 0) return;
  c.scheme.step++;
  emit(s, { type: 'schemeStep', kind: c.scheme.id, value: c.scheme.step });
  if (c.scheme.step < SC.steps) { c.scheme.t = SC.stepTime; return; }
  const id = c.scheme.id;
  c.scheme = null;
  s.tally.schemesDone++;
  note(s, `scheme-${id}`);
  emit(s, { type: 'schemeDone', kind: id });
  if (id === 'treats') {
    s.cupboardOpen = s.time + 3;
    c.eatUntil = s.time + 3;
    if (c.demand?.kind === 'food') answer(s, 'food');
    if (s.def.noExtraFood) s.failFlag = true;
  } else if (id === 'doorHandle') {
    if (c.demand?.kind === 'door') answer(s, 'door');
    else { s.doorOpen = true; emit(s, { type: 'door', value: 1 }); }
  } else {
    undoChoreStep(s);
  }
}

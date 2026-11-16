import { TUNING } from '../config/tuning';
import { LADDER, type MomentState } from './types';
import { dropDemand } from './demands';
import { emit, note } from './util';
import { range } from './cat';

const L = TUNING.ladder;
const AT = [0, L.near, L.scream, L.knockOff, L.sitOn, L.closeStare, L.smack];

export function ladderStepAt(elapsed: number): number {
  let i = 0;
  for (let k = 0; k < AT.length; k++) if (elapsed >= AT[k]) i = k;
  return i;
}

/** Climb the escalation ladder for an unmet demand (§8.2). */
export function stepLadder(s: MomentState) {
  const c = s.cat;
  const d = c.demand;
  if (!d) return;
  if (c.lapse || c.strike || c.activity === 'carried') return;
  const e = s.time - d.startedAt;
  const max = s.def.systems.ladderMax;
  const want = Math.min(ladderStepAt(e), max);
  // A capped ladder gives up after a while, without a strike.
  if (max < LADDER.length - 1 && e > 40) {
    dropDemand(s, false);
    c.sulkUntil = s.time + range(s.rng, TUNING.sulk[0], TUNING.sulk[1]);
    return;
  }
  while (d.step < want) {
    d.step++;
    enterStep(s, LADDER[d.step]);
  }
  if (LADDER[d.step] === 'scream' && s.time >= d.nextScream) scream(s);
}

function scream(s: MomentState) {
  const d = s.cat.demand!;
  d.nextScream = s.time + L.screamEvery;
  s.nowUntil = s.time + L.nowFor;
  s.shakeUntil = s.time + 0.6;
  if (s.chore && !s.chore.hoover) {
    const st = s.chore.steps[s.chore.current];
    if (st && st.progress > 0) { st.progress = 0; emit(s, { type: 'choreLost' }); }
  }
  emit(s, { type: 'scream' });
}

function enterStep(s: MomentState, step: (typeof LADDER)[number]) {
  const c = s.cat;
  note(s, `ladder-${step}`);
  emit(s, { type: 'ladder', kind: step });
  switch (step) {
    case 'scream':
      scream(s);
      break;
    case 'knockOff': {
      const o = s.objects.find((x) => !x.knocked);
      if (o) {
        o.knocked = true; o.t = 0;
        s.tally.knocked.push(o.kind);
        emit(s, { type: 'knocked', kind: o.kind, x: o.x, y: o.y });
      } else if (!s.ui.score) {
        s.ui.score = true; s.tally.knocked.push('scoreCounter');
        emit(s, { type: 'uiKnocked', kind: 'score' });
      } else if (!s.ui.plasters) {
        s.ui.plasters = true; s.tally.knocked.push('plasterCounter');
        emit(s, { type: 'uiKnocked', kind: 'plasters' });
      }
      break;
    }
    case 'sitOn':
      if (s.chore && !s.chore.hoover && s.chore.current < s.chore.steps.length) c.sitOn = { what: 'chore', step: s.chore.current, until: Infinity };
      else c.sitOn = { what: 'pause', step: -1, until: Infinity };
      break;
    case 'closeStare':
      s.hand.stareHold = 0;
      break;
    case 'smack':
      c.forcedWarning = true;
      break;
    default:
  }
}

/** A close stare acknowledged with a tap returns him to Sit On. */
export function acknowledgeCloseStare(s: MomentState) {
  const d = s.cat.demand;
  if (!d) return;
  d.step = 4;
  d.startedAt = s.time - L.sitOn;
  emit(s, { type: 'stareAcknowledged' });
}

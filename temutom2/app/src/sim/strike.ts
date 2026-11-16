import { TUNING } from '../config/tuning';
import { range } from './cat';
import type { MomentState, Pt, Strike } from './types';
import { headPos } from './body';
import { distToPath, emit, note, pointAt } from './util';
import { dropDemand } from './demands';

const S = TUNING.strike;

/** Minimum Warning before any strike: the fairness rule (§6.4), plus Standing and the setting. */
export function minWarning(s: MomentState) {
  return s.standing.minWarning + (s.settings.longerWarnings ? TUNING.mood.longerWarnings : 0);
}

export function canStrike(s: MomentState) {
  const c = s.cat;
  return c.mood === 'warning' && !c.lapse && !c.strike && c.onScreen && s.time - c.warningSince >= minWarning(s) && s.hand.locked <= 0;
}

function thumbOnCat(s: MomentState) {
  return s.hand.down && s.hand.over.kind === 'cat';
}

function thumbOnHoover(s: MomentState) {
  return s.hand.down && (s.hand.over.kind === 'hoover' || s.hand.drag?.what === 'hoover');
}

/** Begin a swipe or a bite (§9.1, §9.2) */
export function startStrike(s: MomentState) {
  const c = s.cat;
  const h = s.hand;
  const held = h.drag?.what === 'cat';
  const onSoftTarget = h.down && h.over.kind === 'cat' && (h.over.zone === 'belly' || h.over.zone === 'tail' || h.over.zone === 'paws');
  let target: Strike['target'] = 'player';
  const guestStroking = s.guest && s.guest.phase === 'stroking';
  if (guestStroking && !thumbOnCat(s) && !held) target = 'guest';
  else if (s.difficulty?.id === 'hoover' && !thumbOnCat(s) && !held && s.chore?.hoover) target = 'hoover';
  const kind: Strike['kind'] = target === 'player' && (held || onSoftTarget) ? 'bite' : 'swipe';
  c.strike = { kind, target, phase: 'windup', t: kind === 'bite' ? S.biteWindup : S.swipeWindup, aim: aimPoint(s, target), path: [], free: false };
  c.forcedWarning = false;
  s.tally.strikes++;
  emit(s, { type: kind === 'bite' ? 'biteWindup' : 'swipeWindup', kind: target });
}

function aimPoint(s: MomentState, target: Strike['target']): Pt {
  const h = s.hand;
  if (target === 'guest' && s.guest) return { x: s.guest.x, y: s.guest.y };
  if (target === 'hoover' && s.chore?.hoover) return pointAt(s.chore.hoover.path, s.chore.hoover.s);
  if (h.down) return { x: h.x, y: h.y };
  if (s.time - h.upAt <= S.thumbUpChore) return { x: h.x, y: h.y };
  const st = s.chore && !s.chore.hoover ? s.chore.steps[s.chore.current] : null;
  return st ? { x: st.x, y: st.y } : { x: 195, y: 520 };
}

/** A curved paw path through the aim point, coming from his side of the screen */
function swipePath(s: MomentState, aim: Pt): Pt[] {
  const c = s.cat;
  const fromLeft = c.x < aim.x ? 1 : c.x > aim.x ? -1 : (c.facing as number);
  const len = range(s.rng, TUNING.marks.length[0], TUNING.marks.length[1]);
  const tilt = range(s.rng, -0.55, -0.25);
  const pts: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12 - 0.5;
    const bow = (1 - 4 * t * t) * 26;
    const dx = Math.cos(tilt) * len * t * fromLeft;
    const dy = Math.sin(tilt) * len * t * -fromLeft;
    pts.push({ x: aim.x + dx - Math.sin(tilt) * bow, y: aim.y + dy - Math.cos(tilt) * bow * 0.6 });
  }
  return pts;
}

export function losePlaster(s: MomentState, why: string) {
  if (!s.def.systems.plasters) { emit(s, { type: 'plasterSpared', kind: why }); return; }
  s.plasters = Math.max(0, s.plasters - 1);
  s.tally.plastersLost++;
  emit(s, { type: 'plaster', kind: why, value: s.plasters });
}

function addMark(s: MomentState, path: Pt[]) {
  s.marks.push({ id: ++s.markSeq, path, born: s.time });
  while (s.marks.length > TUNING.marks.max) s.marks.shift();
  emit(s, { type: 'mark' });
}

/** The red wash: never more than one in any 3 seconds (§9.3) */
function wash(s: MomentState, at: Pt) {
  if (s.time - s.lastWash < TUNING.wash.minGap) return false;
  s.wash = { x: at.x, y: at.y, born: s.time, soft: s.settings.reduceFlashing };
  s.lastWash = s.time;
  return true;
}

function afterStrike(s: MomentState) {
  const c = s.cat;
  if (c.demand && c.demand.step >= 6) {
    dropDemand(s, false);
    c.sulkUntil = s.time + range(s.rng, TUNING.sulk[0], TUNING.sulk[1]);
  }
}

export function stepStrike(s: MomentState, dt: number) {
  const c = s.cat;
  const st = c.strike;
  if (!st) return;
  const h = s.hand;
  st.t -= dt;
  if (st.phase === 'windup') {
    // The aim follows the thumb while it is down; a thumb lifted during the wind-up leaves the aim where it was.
    if (st.kind === 'swipe' && st.target === 'player' && h.down) st.aim = { x: h.x, y: h.y };
    if (st.t > 0) return;
    if (st.kind === 'swipe') {
      st.phase = 'strike';
      st.t = S.swipeStrike;
      st.path = swipePath(s, st.aim);
      return;
    }
    // Bite resolves at the end of its wind-up
    const held = h.drag?.what === 'cat';
    const still = held || (h.down && h.over.kind === 'cat');
    if (still) {
      const zone = h.over.kind === 'cat' ? h.over.zone : null;
      const at = h.down ? { x: h.x, y: h.y } : headPos(c, c.pose);
      losePlaster(s, zone === 'belly' ? 'belly' : 'bite');
      s.tally.bites++;
      if (zone === 'belly') { s.tally.bellyBites++; note(s, 'zone-bellyTrap'); }
      const washed = wash(s, at);
      emit(s, { type: 'bite', x: at.x, y: at.y, value: washed ? 1 : 0, kind: zone ?? (held ? 'held' : '') });
      h.locked = S.biteLockout;
      h.drag = null;
      h.down = false;
      if (held) { c.activity = 'idle'; c.target = null; }
      note(s, 'mood-bite');
    } else {
      emit(s, { type: 'snap' });
    }
    c.irritation = 0;
    c.attention = s.band.centre;
    c.sulkUntil = s.time + range(s.rng, TUNING.sulk[0], TUNING.sulk[1]);
    c.strike = null;
    afterStrike(s);
    return;
  }
  if (st.phase === 'strike') {
    if (st.t > 0) return;
    // The paw crosses the screen now.
    addMark(s, st.path);
    note(s, 'mood-swipe');
    if (st.target === 'guest' && s.guest) {
      s.guest.plasters = Math.max(0, s.guest.plasters - 1);
      s.guest.bitten++;
      s.tally.guestBitten++;
      s.guest.phase = 'withdrawing';
      emit(s, { type: 'guestHit', value: s.guest.plasters });
    } else if (st.target === 'hoover' && s.chore?.hoover) {
      const hv = s.chore.hoover;
      hv.s = Math.max(0, hv.s - hv.length * TUNING.hoover.pushBack);
      emit(s, { type: 'hooverHit' });
      if (thumbOnHoover(s) && distToPath({ x: h.x, y: h.y }, st.path) <= S.swipeHitRange) losePlaster(s, 'hoover');
    } else {
      const hit = h.down && distToPath({ x: h.x, y: h.y }, st.path) <= S.swipeHitRange;
      if (hit) {
        if (s.freeSwipes > 0) { s.freeSwipes--; emit(s, { type: 'plasterSpared', kind: 'first' }); }
        else losePlaster(s, 'swipe');
      }
      emit(s, { type: 'swipe', value: hit ? 1 : 0 });
    }
    c.irritation = Math.max(0, c.irritation - S.swipeIrrDrop);
    c.attention = s.band.centre;
    st.phase = 'after';
    st.t = 0.35;
    afterStrike(s);
    return;
  }
  if (st.t <= 0) c.strike = null;
}

/** Marks fade within a moment and never build up (§9.1) */
export function stepMarks(s: MomentState) {
  const M = TUNING.marks;
  const life = M.fresh + M.settled + M.fading;
  s.marks = s.marks.filter((m) => s.time - m.born < life);
  if (s.wash) {
    const W = s.wash.soft ? TUNING.wash.soft : TUNING.wash;
    if (s.time - s.wash.born > W.spread + W.hold + W.drain) s.wash = null;
  }
}

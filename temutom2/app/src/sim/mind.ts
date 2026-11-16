import { TUNING } from '../config/tuning';
import { bandOffset, chance, range } from './cat';
import type { Activity, Display, MomentState, Pose, Pt } from './types';
import { LADDER } from './types';
import { dist, emit, note, place, position } from './util';
import { tellShown } from './demands';
import type { Position } from '../content/places';
import { headPos } from './body';
import { pointAt } from './util';

const M = TUNING.mood;

/** Mood from the hidden numbers (§6.4). The renderer never sees the numbers, only the display. */
export function stepMood(s: MomentState, suspendContent: boolean) {
  const c = s.cat;
  const off = bandOffset(s.band, c.attention);
  const prev = c.mood;
  let m: typeof c.mood;
  if (c.irritation >= M.warningFrom || c.forcedWarning) m = 'warning';
  else if (prev === 'warning' && c.irritation >= M.warningLeave) m = 'warning';
  else if (off > 0 || c.irritation >= M.tolerateFrom) m = 'tolerating';
  else if (off < 0) m = 'seeking';
  else m = 'content';
  if (suspendContent && m === 'content') m = 'tolerating';
  if (m !== prev) {
    if (m === 'warning') { c.warningSince = s.time; note(s, 'mood-warning'); }
    if (m === 'content') note(s, 'mood-content');
    if (m === 'tolerating') note(s, 'mood-tolerating');
    if (m === 'seeking') note(s, 'mood-seeking');
    emit(s, { type: 'mood', kind: m });
  }
  c.mood = m;
}

/** Affection and its signs: the slow blink, the head-butt, belly-up (§9.5) */
export function stepAffection(s: MomentState, dt: number) {
  const c = s.cat;
  const A = TUNING.affection;
  if (c.mood === 'content' && c.onScreen && !c.lapse && !c.strike) {
    const before = c.contentFor;
    c.contentFor += dt;
    if (s.time >= c.nextBlink) {
      c.blinkAt = s.time;
      c.blinking = 0.8;
      c.nextBlink = s.time + range(s.rng, M.slowBlinkEvery[0], M.slowBlinkEvery[1]);
      emit(s, { type: 'slowBlink' });
      note(s, 'love-blink');
    }
    if (c.contentFor >= A.headButtAfter && s.standing.rank >= 2 && !c.headButted && c.activity !== 'onLap') {
      c.headButted = true;
      s.nudgeAt = s.time;
      c.irritation = Math.max(0, c.irritation + A.headButtIrr);
      s.tally.headButts++;
      note(s, 'love-headbutt');
      emit(s, { type: 'headButt' });
    }
    if (s.def.systems.belly && Math.floor(c.contentFor / A.bellyUpAfter) > Math.floor(before / A.bellyUpAfter)
      && c.activity === 'idle' && chance(s.rng, A.bellyUpChance)) {
      c.bellyUntil = s.time + A.bellyUpFor;
      emit(s, { type: 'bellyUp' });
    }
  } else {
    c.contentFor = 0;
    // The belly stays on offer for its full five seconds: it is a trap, and gives no warning of its own.
  }
  c.blinking = Math.max(0, c.blinking - dt);
}

const PAUSE_SPOT: Position = { x: 52, y: 92, scale: 0.36, facing: 1 };

function demandPosition(s: MomentState): Position | 'closeUp' {
  const c = s.cat;
  const d = c.demand!;
  const p = place(s);
  const step = LADDER[d.step] ?? 'stareFar';
  if (step === 'closeStare') return 'closeUp';
  if (step === 'sitOn' && c.sitOn) {
    if (c.sitOn.what === 'pause') return PAUSE_SPOT;
    const st = s.chore?.steps[c.sitOn.step];
    if (st) return { x: st.x, y: st.y + 22, scale: 0.7, facing: c.facing };
  }
  const tell = p.tellPos[d.kind] ?? 'centre';
  if (step === 'stareFar' || tell === 'lap' || tell === 'bowl' || tell === 'door') return position(s, tell);
  return position(s, 'near');
}

function idlePosition(s: MomentState): Position {
  const c = s.cat;
  if (c.pos && place(s).positions[c.pos]) return position(s, c.pos);
  return position(s, 'far');
}

/** Choose what he is doing, by priority (§7) */
export function decide(s: MomentState, dt: number): { activity: Activity; target: Position | 'closeUp' | 'stay' | Pt } {
  const c = s.cat;
  const h = s.hand;
  if (!c.onScreen) {
    if (c.demand) c.onScreen = true;
    else return { activity: 'away', target: 'stay' };
  }
  if (c.strike) return { activity: 'striking', target: 'stay' };
  if (h.drag?.what === 'cat') return { activity: 'carried', target: { x: h.x, y: h.y + 70 } };
  if (c.mood === 'warning') return { activity: 'warning', target: 'stay' };
  if (c.lapse) return { activity: 'lapsing', target: c.lapse.kind === 'box' && place(s).box ? position(s, 'box') : c.lapse.kind === 'prey' && h.down ? { x: h.x, y: Math.max(h.y + 60, 420) } : 'stay' };
  if (c.scheme) return { activity: 'scheming', target: position(s, place(s).schemePos[c.scheme.id] ?? 'near') };
  if (s.time < c.sulkUntil) return { activity: 'sulking', target: position(s, 'far') };
  if (s.time < c.eatUntil) return { activity: 'eating', target: place(s).bowl ? position(s, 'bowl') : 'stay' };
  if (s.time < c.lapUntil) return { activity: 'onLap', target: position(s, 'lap') };
  if (c.treat && s.time < c.treat.until) return { activity: 'following', target: { x: c.treat.x, y: c.treat.y } };
  if (s.wand?.active) return { activity: 'playing', target: { x: s.wand.x, y: Math.max(420, Math.min(790, s.wand.y + 70)) } };
  if (s.time < c.playUntil) return { activity: 'playing', target: 'stay' };
  if (c.doorPlan) {
    const dp = c.doorPlan;
    if (s.time >= dp.at) {
      if (dp.until === 0) {
        dp.until = s.time + (dp.kind === 'sit' ? 5 : 1.5);
        emit(s, { type: 'doorway', kind: dp.kind });
      }
      if (s.time >= dp.until) {
        c.doorPlan = null;
        s.doorOpen = false;
        emit(s, { type: 'door', value: 0 });
        if (dp.kind !== 'away') { c.onScreen = false; c.x = position(s, 'door').x; emit(s, { type: 'leave' }); return { activity: 'away', target: 'stay' }; }
        c.pos = 'far';
      }
      if (dp.kind !== 'away') return { activity: 'doorway', target: position(s, 'door') };
    }
  }
  if (c.demand) return { activity: 'demanding', target: demandPosition(s) };
  if (c.sitOn && s.time < c.sitOn.until) {
    const st = c.sitOn.what === 'chore' ? s.chore?.steps[c.sitOn.step] : null;
    if (c.sitOn.what === 'chore' && (!st || st.done)) c.sitOn = null;
    else if (st) return { activity: 'sittingOn', target: { x: st.x, y: st.y + 22, scale: 0.7, facing: c.facing } };
    else if (c.sitOn.what === 'pile') return { activity: 'sittingOn', target: position(s, 'pile') };
  } else if (c.sitOn) {
    c.sitOn = null;
  }
  if (c.mood === 'seeking') {
    c.seekingFor += dt;
    if (c.seekingFor > 5 && s.def.systems.chores && s.chore && !s.chore.hoover && s.chore.current < s.chore.steps.length) {
      c.sitOn = { what: 'chore', step: s.chore.current, until: s.time + range(s.rng, TUNING.sitOn[0], TUNING.sitOn[1]) };
      c.seekingFor = 0;
      note(s, 'ladder-walkWork');
      emit(s, { type: 'walksOnWork' });
    }
    c.pos = 'near';
    return { activity: 'seeking', target: position(s, 'near') };
  }
  c.seekingFor = 0;
  // At Preferred Lap and above, he sleeps on finished chores (§13.3)
  if (s.standing.rank >= 3 && s.def.place === 'bedroom' && s.chore?.kind === 'washing' && s.chore.current >= s.chore.steps.length && c.mood === 'content' && !c.sitOn) {
    c.sitOn = { what: 'pile', step: -1, until: s.time + 20 };
    note(s, 'love-pile');
    return { activity: 'sittingOn', target: position(s, 'pile') };
  }
  // Idle: occasionally changes spot
  if (c.actT <= 0) {
    c.actT = range(s.rng, 8, 14);
    if (chance(s.rng, 0.5)) c.pos = chance(s.rng, 0.5) ? 'far' : 'near';
  }
  c.actT -= dt;
  return { activity: 'idle', target: idlePosition(s) };
}

/** Walk towards the chosen spot */
export function move(s: MomentState, dt: number, target: Position | 'closeUp' | 'stay' | Pt) {
  const c = s.cat;
  if (target === 'stay' || target === 'closeUp') return;
  const tx = target.x, ty = target.y;
  const ts = 'scale' in target ? (target as Position).scale : c.scale;
  const d = dist(c, { x: tx, y: ty });
  const step = TUNING.cat.speed * dt * (c.activity === 'carried' ? 4 : c.activity === 'playing' ? 1.4 : 1);
  if (d <= step) {
    c.x = tx; c.y = ty; c.scale = ts;
    if ('facing' in target && (target as Position).facing) c.facing = (target as Position).facing;
  } else {
    const k = step / d;
    c.facing = tx < c.x ? -1 : 1;
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    c.scale += (ts - c.scale) * Math.min(1, k * 1.2);
  }
}

function moving(s: MomentState, target: Position | 'closeUp' | 'stay' | Pt) {
  if (target === 'stay' || target === 'closeUp') return false;
  return dist(s.cat, target) > 3;
}

export function choosePose(s: MomentState, target: Position | 'closeUp' | 'stay' | Pt): Pose {
  const c = s.cat;
  if (target === 'closeUp') return 'closeUp';
  if (c.activity === 'carried') return 'carried';
  if (c.lapse) {
    const left = c.lapse.until - s.time;
    if (c.lapse.kind === 'prey') return left < 0.6 ? 'jump' : 'crouch';
    if (c.lapse.kind === 'jump') return left > 1 ? 'jump' : 'loaf';
    if (c.lapse.kind === 'box') return moving(s, target) ? 'walk' : 'sitOn';
    return 'sit';
  }
  if (moving(s, target)) return Math.abs(('y' in (target as Pt) ? (target as Pt).y : c.y) - c.y) > 120 ? 'jump' : 'walk';
  if (s.time < c.bellyUntil && (c.strike || c.activity === 'warning' || c.activity === 'idle' || c.activity === 'seeking')) return 'bellyUp';
  if (c.strike || c.activity === 'warning') return c.pose === 'walk' || c.pose === 'jump' ? 'crouch' : c.pose === 'bellyUp' ? 'bellyUp' : c.pose;
  switch (c.activity) {
    case 'onLap': return 'onLap';
    case 'sittingOn': return c.sitOn?.what === 'pile' ? 'sleep' : 'sitOn';
    case 'scheming': return c.scheme?.id === 'keyboard' ? 'walk' : 'stand';
    case 'eating': return 'stand';
    case 'playing': return 'crouch';
    case 'doorway': return 'sit';
    case 'sulking': return 'loaf';
    case 'demanding': {
      const d = c.demand!;
      const step = LADDER[d.step];
      if (step === 'sitOn') return 'sitOn';
      if (!tellShown(s)) return 'sit';
      if (d.kind === 'lap' || d.kind === 'food') return 'stand';
      if (d.kind === 'play') return 'crouch';
      return 'sit';
    }
    case 'idle':
      if (s.time < c.bellyUntil) return 'bellyUp';
      if (c.mood === 'content' && c.contentFor > 20) return 'sleep';
      return c.mood === 'content' ? 'loaf' : 'sit';
    default: return 'sit';
  }
}

function gazeFor(s: MomentState): Pt | null {
  const c = s.cat;
  const h = s.hand;
  const player = { x: 195, y: 900 };
  if (c.mood === 'warning' || c.strike) return h.down ? { x: h.x, y: h.y } : player;
  if (c.lapse?.kind === 'prey') return h.down ? { x: h.x, y: h.y } : { x: c.x + 80, y: c.y };
  if (c.activity === 'playing' && s.wand?.active) return s.wand;
  if (c.demand && tellShown(s)) {
    const p = place(s);
    switch (c.demand.kind) {
      case 'food': return Math.floor(s.time / 1.2) % 2 === 0 && p.bowl ? { x: p.bowl.x + 50, y: p.bowl.y + 30 } : player;
      case 'door': return p.door ? { x: p.door.x + p.door.w / 2, y: p.door.y + p.door.h / 2 } : null;
      case 'play': return p.wand ?? null;
      case 'nothing': return { x: c.x - 120 * c.facing, y: c.y - 300 };
      case 'lap': return player;
    }
  }
  if (c.mood === 'seeking') return h.down ? { x: h.x, y: h.y } : player;
  return null;
}

/** Body-language values (§6.4): every state differs from its neighbours in at least two of tail, ears, eyes, sound. */
export function deriveDisplay(s: MomentState): Display {
  const c = s.cat;
  const mood = c.mood;
  const d: Display = {
    mood: c.strike ? 'striking' : c.lapse ? 'lapsing' : mood,
    pose: c.pose,
    head: 'neutral', ears: 'forward', eyes: 'open', align: 0, glint: false, tail: 'still', paw: null,
    gaze: gazeFor(s), sound: 'none', rumble: null, tell: tellShown(s) ? c.demand!.kind : null,
    wiggle: false, confused: s.time < c.confusedUntil,
  };
  switch (mood) {
    case 'seeking': d.tail = 'hooked'; d.ears = 'forward'; d.eyes = 'wide'; d.sound = 'chirp'; break;
    case 'content': d.tail = c.contentFor > 3 ? 'still' : 'wave'; d.ears = 'relaxed'; d.eyes = c.blinking > 0 ? 'slowBlink' : 'half'; d.sound = 'purr'; d.rumble = 'purr'; break;
    case 'tolerating': d.tail = 'flick'; d.ears = 'sideways'; d.eyes = 'open'; d.sound = 'none'; break;
    case 'warning': d.tail = 'lash'; d.ears = 'flat'; d.eyes = 'dilated'; d.sound = 'growl'; d.rumble = 'tremor'; break;
  }
  if (c.pose === 'sleep') { d.eyes = 'closed'; d.tail = 'still'; }
  if (c.lapse) { d.ears = 'relaxed'; d.eyes = 'wide'; d.tail = 'wave'; d.sound = 'none'; d.rumble = null; if (c.lapse.kind === 'prey') d.paw = 'pat'; }
  if (c.strike) {
    d.ears = 'flat'; d.eyes = 'dilated'; d.tail = 'lash'; d.sound = 'growl';
    if (c.strike.kind === 'bite') d.head = 'bite';
    else d.paw = c.strike.aim.x < c.x ? 'swipeL' : 'swipeR';
  }
  if (c.demand && s.time < s.nowUntil) { d.head = 'scream'; d.sound = 'scream'; }
  if (c.activity === 'eating') d.head = 'eat';
  if ((c.activity === 'onLap' || (c.demand?.kind === 'lap' && d.tell === 'lap')) && !c.strike) d.paw = 'knead';
  if (c.demand?.kind === 'play' && d.tell === 'play') d.wiggle = true;
  if (c.activity === 'idle' && mood === 'tolerating' && Math.floor(s.time / 4) % 3 === 0) d.head = 'groom';
  const LAST = LADDER[c.demand?.step ?? 0];
  if (c.demand && LAST === 'knockOff' && s.time - (c.demand.startedAt + TUNING.ladder.knockOff) < 0.8) d.paw = 'push';
  // The Brain Cell: his eyes line up
  const b = c.brain;
  if (s.def.systems.brainCell) {
    if (b.phase === 'present') { d.align = 1; d.glint = b.t > 0 && (TUNING.brainCell.present[0] - b.t) < 0.6; }
    else if (b.phase === 'arriving') d.align = Math.max(0, 1 - b.t / TUNING.brainCell.arriving);
  } else d.align = 0;
  if (c.lapse) d.align = 0;
  return d;
}

export function headOnScreen(s: MomentState) {
  return headPos(s.cat, s.cat.pose);
}

export function hooverPoint(s: MomentState) {
  return s.chore?.hoover ? pointAt(s.chore.hoover.path, s.chore.hoover.s) : null;
}

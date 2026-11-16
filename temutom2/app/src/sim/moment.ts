import { TUNING } from '../config/tuning';
import {
  addAttention, addIrritation, bandOffset, irritationRate, makeBand, makeBrainCell, makeRng, range, stepBand, stepBrainCell,
} from './cat';
import type { Input, MomentDef, MomentState, Zone } from './types';
import { PLACES } from '../content/places';
import { makeHand, updateHand, overAt, type HandFrame } from './hand';
import { answer, issueDemand, stepDemandSchedule } from './demands';
import { acknowledgeCloseStare, stepLadder } from './escalation';
import { canStrike, startStrike, stepMarks, stepStrike } from './strike';
import { choreDone, makeChore, workChore } from './chores';
import { maybeStartScheme, schemeTarget, stepScheme, stopScheme } from './schemes';
import { maybeLapse, seeLapse, stepLapse } from './lapses';
import { difficultyModule } from './difficulties';
import { choosePose, decide, deriveDisplay, move, stepAffection, stepMood } from './mind';
import { clamp, dist, emit, inRect, note, place, position } from './util';

export interface MomentOptions {
  standing: { minWarning: number; bandBonus: number; rank: number };
  settings: { longerWarnings: boolean; reduceFlashing: boolean; leftHanded: boolean };
}

export const DEFAULT_OPTIONS: MomentOptions = {
  standing: { minWarning: 0.8, bandBonus: 0, rank: 0 },
  settings: { longerWarnings: false, reduceFlashing: false, leftHanded: false },
};

export function createMoment(def: MomentDef, opts: MomentOptions = DEFAULT_OPTIONS): MomentState {
  const rng = makeRng(def.seed);
  const pl = PLACES[def.place];
  let lo: number | undefined, hi: number | undefined;
  if (def.modifiers?.includes('wokeUpWrong')) hi = 40;
  if (def.modifiers?.includes('needy')) lo = 60;
  const band = makeBand(rng, TUNING.band, { halfWidth: def.band.halfWidth + opts.standing.bandBonus, drifts: def.band.drifts, centre: def.band.centre, lo, hi });
  const startName = def.startPos ?? 'far';
  const start = startName === 'away' ? pl.positions.far : pl.positions[startName] ?? pl.positions.far;
  const early = def.week === 1 && def.day <= 2;
  const plasters = early ? TUNING.plasters.early : TUNING.plasters.normal;
  const s: MomentState = {
    def, rng, time: 0, length: def.length,
    hand: makeHand(),
    cat: {
      x: start.x, y: start.y, scale: start.scale, facing: start.facing, target: null, pos: startName === 'away' ? 'far' : startName,
      onScreen: startName !== 'away', activity: 'idle', actT: 6,
      attention: Math.max(0, band.centre - band.halfWidth - 6), irritation: 0,
      brain: makeBrainCell(rng, TUNING.brainCell), demand: null, queued: null, mood: 'seeking', warningSince: -99, forcedWarning: false,
      contentFor: 0, nextBlink: range(rng, 6, 10), blinkAt: -99, blinking: 0, bellyUntil: -1, headButted: false,
      sitOn: null, lapUntil: -1, treat: null, sulkUntil: -1, lapse: null, lastLapse: -99, scheme: null, confusedUntil: -1,
      strike: null, seekingFor: 0, eatUntil: -1, doorPlan: null, playUntil: -1, lastAck: -99,
      display: null as never, pose: 'sit',
    },
    band,
    plasters, plastersStart: plasters,
    chore: def.systems.chores ? makeChore(def.place, def.chore, def.hooverAreas ?? 1) : null,
    objects: pl.objects.map((o, i) => ({ id: i + 1, kind: o.kind, x: o.x, y: o.y, knocked: false, t: 0 })),
    ui: { score: false, plasters: false },
    marks: [], markSeq: 0, wash: null, lastWash: -99, shakeUntil: -1, nowUntil: -1, nudgeAt: -99,
    doorOpen: false, doorHeld: -1, cupboardOpen: -1, lidClosedUntil: -1,
    treatsLeft: def.systems.treats ? TUNING.treat.perMoment : 0,
    wand: pl.wand ? { x: pl.wand.x, y: pl.wand.y, active: false, time: 0 } : null,
    pouch: { x: pl.pouch?.x ?? -100, y: pl.pouch?.y ?? -100, carried: false },
    guest: null,
    difficulty: def.difficulty ? { id: def.difficulty.id, boss: !!def.difficulty.boss, data: {} } : null,
    nextDemandAt: def.demands.interval ? range(rng, 4, 8) : Infinity,
    timedIdx: 0, scriptIdx: 0,
    freeSwipes: def.script?.some((e) => e.do === 'swipeFree') ? 1 : 0,
    standing: opts.standing,
    settings: opts.settings,
    tally: {
      contentSecs: 0, onScreenSecs: 0, issued: 0, met: 0, firstTime: 0, wrong: 0, slowest: 0, strikes: 0, bites: 0, bellyBites: 0,
      plastersLost: 0, lapsesSeen: 0, lapses: 0, lifted: 0, schemesStopped: 0, schemesDone: 0, knocked: [], headButts: 0,
      blinksAnswered: 0, zones: [], notes: [], guestBitten: 0, treatsUsed: 0,
    },
    events: [],
    status: 'running', endReason: null, objectiveMet: false, failFlag: false,
  };
  difficultyModule(s)?.start(s);
  s.cat.display = deriveDisplay(s);
  return s;
}

const raw = { down: false, x: 0, y: 0 };
const rawByMoment = new WeakMap<MomentState, { down: boolean; x: number; y: number }>();

export function applyInput(s: MomentState, i: Input) {
  if (i.type === 'hand') {
    rawByMoment.set(s, { down: i.down, x: i.x, y: i.y });
  } else if (i.type === 'restore') {
    if (s.ui[i.id]) { s.ui[i.id] = false; emit(s, { type: 'uiRestored', kind: i.id }); }
  }
}

// ---------------------------------------------------------------------------

function strokeRates(zone: Zone) {
  const A = TUNING.attention;
  switch (zone) {
    case 'head': return { att: A.head, irr: 0 };
    case 'back': return { att: A.back, irr: 0 };
    case 'tail': case 'paws': return { att: A.tail, irr: A.tailIrr };
    case 'belly': return { att: A.belly, irr: A.bellyIrr };
  }
}

function handlePlayer(s: MomentState, f: HandFrame, dt: number) {
  const h = s.hand;
  const c = s.cat;
  const pl = place(s);
  const mod = difficultyModule(s);

  // Start of a drag
  if (f.pressed && !h.drag) {
    const o = h.over;
    if (o.kind === 'source') {
      if (o.id === 'pouch') { s.pouch.carried = true; h.drag = { what: 'pouch', x: h.x, y: h.y, t: 0, startX: h.x, startY: h.y }; }
      else if (o.id === 'wand' && s.wand) { s.wand.active = true; s.wand.time = 0; h.drag = { what: 'wand', x: h.x, y: h.y, t: 0, startX: h.x, startY: h.y }; }
      else if (o.id === 'treat0' || o.id === 'treat1') h.drag = { what: o.id, x: h.x, y: h.y, t: 0, startX: h.x, startY: h.y };
    } else if (o.kind === 'guest') h.drag = { what: 'guest', x: h.x, y: h.y, t: 0, startX: h.x, startY: h.y };
    else if (o.kind === 'hoover') h.drag = { what: 'hoover', x: h.x, y: h.y, t: 0, startX: h.x, startY: h.y };
  }

  if (h.down && h.drag) {
    const dr = h.drag;
    if (dr.what === 'pouch') { s.pouch.x = h.x; s.pouch.y = h.y; }
    if (dr.what === 'wand' && s.wand) {
      s.wand.x = h.x; s.wand.y = h.y;
      if (h.speed > TUNING.hand.strokeMin && s.wand.time >= 0) s.wand.time += dt;
      if (s.wand.time >= TUNING.hand.wandTime) { s.wand.time = -999; note(s, 'demand-wand'); answer(s, 'play'); }
    }
    if (dr.what === 'guest' && Math.hypot(h.x - dr.startX, h.y - dr.startY) > 40) { mod?.onPlayerAction(s, 'pushGuest'); h.drag = null; }
  }

  // Lifting him: held still on his body for 0.6 s, then dragged clear
  if (h.down && !h.drag && s.def.systems.lift && c.onScreen && !c.strike && !c.lapse && c.pose !== 'closeUp') {
    if (h.over.kind === 'cat' && h.stillFor >= TUNING.hand.liftHold) h.liftArmed = true;
    if (h.liftArmed && h.over.kind !== 'cat' && h.moved > 20) {
      h.drag = { what: 'cat', x: h.x, y: h.y, t: 0, startX: h.x, startY: h.y };
      h.liftArmed = false;
      c.irritation = addIrritation(c.irritation, TUNING.irritation.lifted);
      c.sitOn = null; c.treat = null; c.lapUntil = -1; c.bellyUntil = -1;
      s.tally.lifted++;
      note(s, 'move-lift');
      emit(s, { type: 'lifted' });
    }
  }

  // Door: swipe across it
  if (h.down && h.overDoorAtDown && Math.abs(h.travelX) >= TUNING.hand.doorSwipe) {
    h.overDoorAtDown = false;
    if (c.scheme?.id === 'doorHandle') stopScheme(s, true);
    else answer(s, 'door');
  }

  // Lap: stop and hold still on the lap for 4 s
  if (pl.lap && h.down && !h.drag && inRect(h, pl.lap) && h.speed < TUNING.hand.stillBelow && (h.over.kind === 'lap' || h.over.kind === 'cat')) {
    h.lapHold += dt;
    if (h.lapHold >= TUNING.hand.lapHold) { h.lapHold = -999; answer(s, 'lap'); }
  } else if (h.lapHold > 0) h.lapHold = 0;

  // Answering a slow blink: thumb still on empty scene for 1 s within 3 s of it
  if (h.down && !h.drag && h.over.kind === 'empty' && h.speed < TUNING.hand.stillBelow && s.time - c.blinkAt <= TUNING.hand.blinkWindow) {
    h.blinkHold += dt;
    if (h.blinkHold >= TUNING.hand.blinkHold) {
      h.blinkHold = -999;
      c.blinkAt = -99;
      c.attention = addAttention(c.attention, TUNING.attention.blinkAnswer);
      c.irritation = addIrritation(c.irritation, TUNING.attention.blinkIrr);
      s.tally.blinksAnswered++;
      note(s, 'love-blinkAnswered');
      emit(s, { type: 'blinkAnswered' });
    }
  }

  // Holding his gaze in a close stare is a challenge
  if (c.pose === 'closeUp' && h.down && h.over.kind === 'cat') {
    h.stareHold += dt;
    if (h.stareHold > TUNING.ladder.challengeHold) {
      h.stareHold = -999;
      c.irritation = addIrritation(c.irritation, TUNING.irritation.challenge);
      emit(s, { type: 'challenge' });
    }
  }

  // Release
  if (f.released) {
    const dr = h.drag;
    h.drag = null;
    h.liftArmed = false;
    if (dr?.what === 'pouch') {
      s.pouch.carried = false;
      const pp = pl.pouch!;
      if (inRect({ x: dr.x, y: dr.y }, pl.bowl)) { emit(s, { type: 'pouchEmptied' }); answer(s, 'food'); }
      s.pouch.x = pp.x; s.pouch.y = pp.y;
    } else if (dr?.what === 'treat0' || dr?.what === 'treat1') {
      if (Math.hypot(dr.x - dr.startX, dr.y - dr.startY) > 40 && s.treatsLeft > 0) {
        s.treatsLeft--;
        s.tally.treatsUsed++;
        const fl = pl.floor;
        const tx = clamp(dr.x, fl.x, fl.x + fl.w), ty = clamp(dr.y, fl.y, fl.y + fl.h);
        c.treat = { x: tx, y: ty, until: s.time + TUNING.treat.stay + 1.5 };
        c.sitOn = null;
        c.attention = addAttention(c.attention, TUNING.attention.treat);
        note(s, 'move-treat');
        emit(s, { type: 'treat', x: tx, y: ty });
      }
    } else if (dr?.what === 'cat') {
      // Put down at the nearest place he can be
      let best = 'far', bd = Infinity;
      for (const [k, p] of Object.entries(pl.positions)) { const d = dist(p, { x: dr.x, y: dr.y + 70 }); if (d < bd) { bd = d; best = k; } }
      c.pos = best === 'lap' ? 'near' : best;
      emit(s, { type: 'putDown' });
    } else if (dr?.what === 'wand' && s.wand) {
      s.wand.active = false;
      if (pl.wand) { s.wand.x = pl.wand.x; s.wand.y = pl.wand.y; }
    }
  }

  // Taps
  if (f.tap) {
    const o = f.tap;
    if (o.kind === 'cat') {
      if (c.lapse) seeLapse(s);
      else if (c.pose === 'closeUp') acknowledgeCloseStare(s);
      else {
        if (s.time - c.lastAck >= TUNING.attention.acknowledgeEvery) {
          c.attention = addAttention(c.attention, TUNING.attention.acknowledge);
          c.lastAck = s.time;
        }
        emit(s, { type: 'ack' });
        if (c.demand) answer(s, 'nothing');
      }
    } else if (c.scheme && o.kind === schemeTarget(c.scheme.id)) {
      stopScheme(s, true);
    }
  }

  // Work
  if (f.action === 'work' && s.chore && !s.chore.hoover && h.over.kind === 'chore' && h.over.step === s.chore.current) workChore(s, dt);
  if (f.action === 'stroke' && f.zone && !s.tally.zones.includes(f.zone)) { s.tally.zones.push(f.zone); note(s, `zone-${f.zone}`); }
}

function attentionStep(s: MomentState, f: HandFrame, dt: number, suspend: boolean, extraIrr: number) {
  const c = s.cat;
  const A = TUNING.attention;
  if (!c.onScreen) return;
  let att = 0, irr = 0;
  if (!suspend) {
    if (f.action === 'held') { att = A.held; irr = A.heldIrr; }
    else if (f.action === 'stroke' && f.zone) { const r = strokeRates(f.zone); att = r.att; irr = r.irr; }
    else if (f.action === 'rest') att = A.rest;
    else att = A.nothing;
    const g = s.guest;
    if (g && g.phase === 'stroking') { const r = strokeRates(g.zone); att += r.att; irr += r.irr; }
  }
  c.attention = addAttention(c.attention, att * dt);
  const rate = irritationRate(bandOffset(s.band, c.attention), TUNING.irritation) + irr + extraIrr;
  // During a lapse Irritation does not rise
  const v = c.lapse ? Math.min(0, rate) : rate;
  c.irritation = addIrritation(c.irritation, v * dt);
}

function checkEnd(s: MomentState) {
  const o = s.def.objective;
  const mod = difficultyModule(s);
  if (s.failFlag) { s.status = 'failed'; s.endReason = 'noExtraFood'; emit(s, { type: 'end' }); return; }
  if (s.def.systems.plasters && s.plasters <= 0) { s.status = 'failed'; s.endReason = 'plasters'; emit(s, { type: 'end' }); return; }
  if (s.difficulty?.id === 'guest' && s.difficulty.boss && s.tally.guestBitten > 0) { s.status = 'failed'; s.endReason = 'objective'; emit(s, { type: 'end' }); return; }
  let met = false;
  switch (o.kind) {
    case 'finishChore': met = choreDone(s.chore); break;
    case 'serve': met = s.tally.met >= o.n; break;
    case 'content': met = s.tally.contentSecs >= o.seconds; break;
    case 'boss': met = mod ? mod.objectiveMet(s) : false; break;
    case 'survive': met = false; break;
  }
  if (met && !s.objectiveMet) { s.objectiveMet = true; emit(s, { type: 'objectiveMet' }); }
  // A moment always runs its full length (§5); a met objective is kept.
  if (s.time >= s.length) {
    if (o.kind === 'survive') s.objectiveMet = true;
    s.status = s.objectiveMet ? 'won' : 'failed';
    s.endReason = 'time';
    emit(s, { type: 'end' });
  }
}

export function step(s: MomentState) {
  if (s.status !== 'running') return;
  const dt = TUNING.dt;
  s.time += dt;
  const c = s.cat;
  const r = rawByMoment.get(s) ?? raw;

  // 1. The thumb
  const f = updateHand(s, r, dt);
  if (c.strike || c.lapse || c.activity === 'striking') { /* input still accepted */ }
  handlePlayer(s, f, dt);

  // 2. Hidden state
  stepBand(s.band, s.rng, s.time, dt, TUNING.band);
  if (s.def.systems.brainCell) {
    const ch = stepBrainCell(c.brain, s.rng, dt, TUNING.brainCell);
    if (ch === 'present') { emit(s, { type: 'brainPresent' }); maybeStartScheme(s); }
    if (ch === 'arriving') emit(s, { type: 'brainArriving' });
    if (ch === 'away' && c.scheme) stopScheme(s, false);
  }
  stepDemandSchedule(s);
  stepLadder(s);
  const diff = difficultyModule(s)?.step(s, dt, f) ?? { irritation: 0, suspend: false };
  attentionStep(s, f, dt, diff.suspend, diff.irritation);
  stepMood(s, diff.suspend);
  maybeLapse(s, dt);
  stepLapse(s);
  stepScheme(s, dt);

  // 3. Strikes (fairness rule enforced in canStrike)
  if (!c.strike && (c.irritation >= 100 || c.forcedWarning) && canStrike(s)) startStrike(s);
  stepStrike(s, dt);
  stepAffection(s, dt);

  // 4. Mind and body
  const choice = decide(s, dt);
  c.activity = choice.activity;
  move(s, dt, choice.target);
  c.pose = choosePose(s, choice.target);
  c.display = deriveDisplay(s);

  // 5. Bookkeeping
  stepMarks(s);
  for (const o of s.objects) if (o.knocked) o.t += dt;
  if (c.onScreen) {
    s.tally.onScreenSecs += dt;
    if (c.mood === 'content' && !c.strike) s.tally.contentSecs += dt;
  }
  checkEnd(s);
}

/** Run a moment without a screen. `policy` returns the thumb for each step. */
export function runMoment(s: MomentState, policy: (s: MomentState) => { down: boolean; x: number; y: number } | null = () => null, max = 100000) {
  let n = 0;
  while (s.status === 'running' && n++ < max) {
    const p = policy(s);
    if (p) applyInput(s, { type: 'hand', ...p });
    step(s);
    s.events.length = 0;
  }
  return s;
}

export { issueDemand, overAt, position };

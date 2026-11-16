import { TUNING } from '../config/tuning';
import { STAFF } from '../content/staff';
import { makeRng, range } from './rng';
import type {
  DemandKind, Input, SchemeId, ShiftDef, ShiftState, StaffId, WorldObject,
} from './types';
import { ROOMS } from '../content/rooms';
import { inBand, stepAttention, stepBand } from './attention';
import { initBrain, brainPresent, stepBrain } from './brainCell';
import { startOutburst, stepIrritation, addIrritation } from './irritation';
import { stepDemands, meetDemand } from './demands';
import { initialStaffState, stepStaff } from './staff';
import {
  moveTo, performVerb, screamEnd, screamStart, stepCatActions, stepMovement, stepScreamAndStare, canAct,
} from './verbs';
import { stepThrone } from './thrones';
import { stepMorale } from './morale';
import { threatDefeated, threatRespond, threatStart, threatStep } from './threats';
import { emit, point, spot } from './util';
import { hooverData } from './threats/hoover';

export interface ShiftOptions {
  compliance: Partial<Record<StaffId, Record<DemandKind, number>>>;
  morale: number;
  thronesClaimed: string[];
  settings: { fewerLapses: boolean; longerPatience: boolean };
}

export const ZERO_COMPLIANCE: Record<DemandKind, number> = { food: 0, door: 0, lap: 0, play: 0 };

export function createShift(def: ShiftDef, opts: ShiftOptions): ShiftState {
  const room = ROOMS[def.room];
  const rng = makeRng(def.seed);
  const hasBox = !!def.box || !!def.modifiers?.includes('box');
  const startSpot = def.start ?? room.spots.find((p) => p.kind === 'floor')!.id;
  const sp = room.spots.find((p) => p.id === startSpot)!;
  const centre = def.band.centre ?? 50;

  const s: ShiftState = {
    def, room, rng, time: 0, length: def.length,
    cat: {
      x: sp.x, y: sp.y, spot: sp.id, dest: null, action: 'idle', actionT: 0, facing: 1,
      attention: Math.max(0, centre - def.band.halfWidth * 0.6), irritation: 0,
      brain: { phase: 'away', t: 99 }, screaming: false, screamT: 0, screamSignalled: false,
      stareTarget: null, stareT: 0, pending: null, heldBy: null, lapse: null, outburst: null,
      sittingOn: null, lapT: 0, still: 0, inBand: true,
    },
    band: { centre, halfWidth: def.band.halfWidth, target: centre, nextDrift: 0 },
    staff: [],
    morale: def.daily ? TUNING.morale.start : opts.morale,
    moraleStart: 0,
    objects: [],
    doors: {},
    bowl: { full: 0, fills: 0 },
    demands: [],
    timedIdx: 0,
    nextDemandAt: 0,
    demandSeq: 0,
    putBack: [],
    throne: { progress: 0, claimedBefore: opts.thronesClaimed.includes(def.room), claimedNow: false },
    threat: def.threat ? { id: def.threat.id, spec: def.threat, data: {} } : null,
    tally: { issued: 0, met: 0, secondsInBand: 0, outbursts: 0, lapses: 0, screams: 0, knocked: [], sprayed: 0, evictions: 0 },
    events: [],
    scheme: null,
    screamTimes: [],
    status: 'running',
    endReason: null,
    objectiveMet: false,
    lastLapseAt: -999,
    lastDoorClose: 0,
    settings: opts.settings,
    hasBox,
    bossMorale: 1,
    dynPoints: {},
  };
  s.moraleStart = s.morale;
  s.band.nextDrift = range(rng, TUNING.band.driftEvery[0], TUNING.band.driftEvery[1]);
  if (def.band.drifts) s.band.target = range(rng, TUNING.band.min, TUNING.band.max);
  if (def.demands.interval) s.nextDemandAt = range(rng, 3, 6);

  for (const d of room.doors) s.doors[d] = def.modifiers?.includes('closedDoors') ? false : range(rng, 0, 1) < 0.5;

  // Objects on ledges, rotated by seed so that every kind turns up over time.
  let oid = 0;
  const pool = room.objectPool;
  let k = Math.floor(range(rng, 0, pool.length));
  const objects: WorldObject[] = [];
  for (const ledge of room.spots.filter((p) => p.kind === 'ledge')) {
    for (let i = 0; i < (ledge.slots ?? 1); i++) {
      objects.push({ id: ++oid, kind: pool[k % pool.length], spot: ledge.id, slot: i, knocked: false, t: 0 });
      k++;
    }
  }
  s.objects = objects;

  for (const st of def.staff) {
    const routine = st.routine ?? room.routines[st.id] ?? [{ at: room.entry, task: 'sit', dur: 999 }];
    const base = def.daily ? { food: 40, door: 40, lap: 40, play: 40 } : (opts.compliance[st.id] ?? ZERO_COMPLIANCE);
    const comp = { ...base };
    const cap = STAFF[st.id].cap;
    if (cap != null) for (const kk of Object.keys(comp) as DemandKind[]) comp[kk] = Math.min(comp[kk], cap);
    const at = st.away ? point(s, room.entry) : point(s, routine[0].at);
    const m = initialStaffState(st.id, routine, at.x, at.y, comp, !!st.away);
    m.nextStroke = range(rng, 5, 9);
    s.staff.push(m);
  }

  initBrain(s);
  threatStart(s);
  return s;
}

// ---------------------------------------------------------------------------
// Schemes (spec §9.2)

export function schemeHere(s: ShiftState): SchemeId | null {
  const c = s.cat;
  if (c.action === 'moving' || c.action === 'held') return null;
  const here = spot(s, c.spot);
  const id = here.schemeId;
  if (!id) return null;
  if (id === 'plug') {
    if (!s.threat || s.threat.id !== 'hoover') return null;
    const st = hooverData(s.threat).state;
    if (st !== 'running' && st !== 'stopped') return null;
  }
  return id;
}

/** Spots that glow while the Brain Cell is present */
export function schemeSpots(s: ShiftState): string[] {
  if (!brainPresent(s)) return [];
  return s.room.spots
    .filter((p) => p.schemeId && (p.schemeId !== 'plug' || (s.threat?.id === 'hoover' && ['running', 'stopped'].includes(hooverData(s.threat).state))))
    .map((p) => p.id);
}

export function schemeAvailable(s: ShiftState): boolean {
  return brainPresent(s) && schemeHere(s) !== null && (s.cat.action === 'idle' || s.cat.action === 'sitting');
}

function schemeTap(s: ShiftState) {
  if (!schemeAvailable(s)) return;
  const id = schemeHere(s)!;
  if (!s.scheme || s.scheme.id !== id || s.scheme.spot !== s.cat.spot) s.scheme = { id, spot: s.cat.spot, step: 0, t: 0 };
  s.cat.action = 'scheme';
  s.cat.actionT = TUNING.scheme.stepTime;
  emit(s, { type: 'schemeStep', kind: id, value: s.scheme.step + 1 });
}

function stepScheme(s: ShiftState, dt: number) {
  const c = s.cat;
  if (c.action !== 'scheme' || !s.scheme) return;
  c.actionT -= dt;
  if (c.actionT > 0) return;
  c.action = 'idle';
  s.scheme.step++;
  if (s.scheme.step < TUNING.scheme.steps) return;
  const id = s.scheme.id;
  s.scheme = null;
  emit(s, { type: 'schemeDone', kind: id });
  if (id === 'treats') {
    const food = s.demands.find((d) => d.kind === 'food');
    if (food) { food.need = 1; meetDemand(s, food, null, 2); } else addIrritation(s, -30);
  } else if (id === 'doorHandle') {
    const here = spot(s, c.spot);
    const door = here.doorId ?? s.room.doors[0];
    s.doors[door] = !s.doors[door];
    emit(s, { type: 'door', kind: door, value: s.doors[door] ? 1 : 0 });
    const dd = s.demands.find((d) => d.kind === 'door' && d.door === door && d.wantOpen === s.doors[door]);
    if (dd) meetDemand(s, dd, null);
  } else if (id === 'plug') {
    threatRespond(s, 'scheme', { kind: 'spot', id: c.spot });
  }
}

// ---------------------------------------------------------------------------
// Input

export function applyInput(s: ShiftState, input: Input) {
  if (s.status !== 'running') return;
  switch (input.type) {
    case 'tapSpot':
      if (canAct(s)) moveTo(s, input.spot);
      break;
    case 'verb':
      if (input.verb === 'scream') screamStart(s);
      else { s.cat.pending = null; performVerb(s, input.verb, input.target); }
      break;
    case 'screamStart': screamStart(s); break;
    case 'screamEnd': screamEnd(s); break;
    case 'scheme': schemeTap(s); break;
    case 'outburst':
      if (s.def.systems.irritation && s.cat.action !== 'outburst' && s.cat.action !== 'stunned') startOutburst(s, true);
      break;
    case 'endShift':
      if (s.objectiveMet && ['serve', 'claim', 'train'].includes(s.def.objective.kind)) {
        s.status = 'won';
        s.endReason = 'player';
        emit(s, { type: 'shiftEnd' });
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Objectives

export function checkObjective(s: ShiftState): boolean {
  const o = s.def.objective;
  switch (o.kind) {
    case 'serve': return s.tally.met >= o.n;
    case 'claim': return s.throne.claimedNow;
    case 'train': {
      const m = s.staff.find((x) => x.id === o.staff);
      return !!m && m.compliance[o.demand] >= o.level;
    }
    case 'endure': return s.morale > 0 && s.time >= s.length;
    case 'boss': return s.time >= s.length && threatDefeated(s);
  }
}

// ---------------------------------------------------------------------------
// Step

export function step(s: ShiftState) {
  if (s.status !== 'running') return;
  const dt = TUNING.dt;
  s.time += dt;
  const moraleBefore = s.morale;

  stepBand(s, dt);
  stepBrain(s, dt);
  stepDemands(s, dt);
  stepMovement(s, dt);
  stepScreamAndStare(s, dt);
  stepCatActions(s, dt);
  stepScheme(s, dt);
  stepStaff(s, dt);
  const threatRate = threatStep(s, dt);
  stepAttention(s, dt);
  stepIrritation(s, dt, threatRate);
  stepThrone(s, dt);
  stepMorale(s, dt, moraleBefore);
  if (s.bowl.full > 0) s.bowl.full = Math.max(0, s.bowl.full - dt);

  const ib = inBand(s);
  if (ib !== s.cat.inBand) emit(s, { type: ib ? 'bandIn' : 'bandOut' });
  s.cat.inBand = ib;
  if (ib) s.tally.secondsInBand += dt;

  const wasMet = s.objectiveMet;
  if (s.def.objective.kind !== 'endure' && s.def.objective.kind !== 'boss') s.objectiveMet = s.objectiveMet || checkObjective(s);
  if (!wasMet && s.objectiveMet) emit(s, { type: 'objectiveMet' });

  if (s.def.systems.morale && s.morale <= 0) {
    s.status = 'failed';
    s.endReason = 'carrier';
    emit(s, { type: 'carrier' });
    return;
  }
  if (s.time >= s.length) {
    if (s.def.objective.kind === 'endure' || s.def.objective.kind === 'boss') s.objectiveMet = checkObjective(s);
    s.status = s.objectiveMet ? 'won' : 'failed';
    s.endReason = 'time';
    emit(s, { type: 'shiftEnd' });
  }
}

/** Run a shift without a screen. `policy` is called each step and returns inputs. */
export function runShift(s: ShiftState, policy: (s: ShiftState) => Input[] = () => [], maxSteps = 100000) {
  let n = 0;
  while (s.status === 'running' && n++ < maxSteps) {
    for (const i of policy(s)) applyInput(s, i);
    step(s);
    s.events.length = 0;
  }
  return s;
}

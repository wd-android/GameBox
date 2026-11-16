import { TUNING } from '../config/tuning';
import { STAFF } from '../content/staff';
import { chance, next, pick, range } from './rng';
import type {
  Demand, DemandKind, Job, JobKind, Pt, ShiftState, StaffId, StaffState, Verb,
} from './types';
import { DEMAND_KINDS } from './types';
import { changeMorale, clamp, dist, emit, point, present, spot } from './util';
import { demandById, matchingSpot, meetDemand } from './demands';
import { addIrritation } from './irritation';
import { threatHook, threatStaffNotice } from './threats';
import { rewardIfDue } from './verbs';

const T = TUNING.staff;
const V = TUNING.verbs;
const C = TUNING.compliance;

// ---------------------------------------------------------------------------
// Compliance

export function complianceCap(s: ShiftState, m: StaffState, kind: DemandKind): number {
  const cap = STAFF[m.id].cap;
  if (cap == null) return 100;
  if (m.id === 'guest' && kind === 'lap' && s.threat?.id === 'guest' && s.threat.spec.boss) return 100;
  return cap;
}

export function addCompliance(s: ShiftState, m: StaffState, kind: DemandKind, v: number) {
  const before = m.compliance[kind];
  m.compliance[kind] = clamp(before + v, 0, complianceCap(s, m, kind));
  if (m.compliance[kind] !== before) emit(s, { type: 'compliance', staff: m.id, kind, value: m.compliance[kind] });
}

export function complianceAll(s: ShiftState, m: StaffState, v: number) {
  for (const k of DEMAND_KINDS) addCompliance(s, m, k, v);
}

// ---------------------------------------------------------------------------
// Probabilities (spec §7.2, §8.2)

export function currentTask(m: StaffState) {
  return m.routine[m.routineIdx]?.task;
}

export function isWorking(m: StaffState) {
  return m.mode === 'routine' && currentTask(m) === 'work';
}

export function isIdle(m: StaffState) {
  const t = currentTask(m);
  return m.mode === 'routine' && (t === 'tv' || t === 'sit' || t === 'read' || t === 'phone');
}

export function noticeProbability(s: ShiftState, m: StaffState, verb: Verb, targeted: boolean): number {
  let p: number;
  switch (verb) {
    case 'scream': p = V.scream.notice; break;
    case 'stare': p = targeted ? (isIdle(m) ? V.stare.noticeIdle : V.stare.notice) : 0; break;
    case 'smack': p = targeted ? 1 : 0; break;
    case 'sitOn': p = targeted ? 1 : 0; break;
    case 'knockOff': p = 1; break;
  }
  const prof = STAFF[m.id];
  if (!prof.noticeWhileWorkingOnly || isWorking(m)) p += prof.notice;
  // Someone asleep elsewhere is always woken by a scream; otherwise sound from the next room carries less.
  if (!m.present) p = verb === 'scream' && m.mode === 'away' && !Number.isFinite(m.modeT) ? 1 : p * T.adjoiningNotice;
  return clamp(p, 0, 1);
}

export function verbUnderstanding(verb: Verb): number {
  switch (verb) {
    case 'scream': return V.scream.understand;
    case 'stare': return V.stare.understand;
    case 'sitOn': return V.sitOn.understand;
    case 'knockOff': return V.knockOff.understand;
    case 'smack': return 0;
  }
}

/** p = base + 0.25 at matching spot + 0.5 × compliance ÷ 100 + modifier, capped at 0.95 */
export function understandProbability(base: number, atMatchingSpot: boolean, compliance: number, modifier: number): number {
  const p = base + (atMatchingSpot ? V.matchingSpotBonus : 0) + V.complianceWeight * (compliance / 100) + modifier;
  return clamp(p, 0, V.understandCap);
}

export function understandFor(s: ShiftState, m: StaffState, verb: Verb, d: Demand): number {
  const atSpot = s.cat.action !== 'moving' && matchingSpot(s, d).includes(s.cat.spot);
  return understandProbability(verbUnderstanding(verb), atSpot, m.compliance[d.kind], STAFF[m.id].understand);
}

/** Anticipation probability: 25% at 60 rising evenly to 100% at 90 */
export function anticipationProbability(compliance: number): number {
  if (compliance < C.anticipateMin) return 0;
  return clamp(0.25 + 0.75 * (compliance - C.anticipateMin) / (C.anticipateFull - C.anticipateMin), 0, 1);
}

export function maybeAnticipate(s: ShiftState, d: Demand) {
  for (const m of present(s)) {
    if (m.mode !== 'routine' || m.anticipate) continue;
    const p = anticipationProbability(m.compliance[d.kind]);
    if (p > 0 && next(s.rng) < p) {
      m.anticipate = { at: s.time + range(s.rng, 0.5, C.anticipateWithin), demandId: d.id };
    }
  }
}

// ---------------------------------------------------------------------------
// Movement helpers

export function nearCat(s: ShiftState, m: Pt): Pt {
  const c = s.cat;
  const side = m.x < c.x ? -1 : 1;
  let x = c.x + side * 12;
  if (x < 6 || x > 94) x = c.x - side * 12;
  return { x: clamp(x, 6, 94), y: clamp(c.y + 4, 48, 126) };
}

function walkTo(m: StaffState, to: Pt, dt: number): boolean {
  const d = dist(m, to);
  const stepLen = TUNING.staffSpeed * dt;
  if (d <= stepLen || d < 0.5) {
    m.x = to.x; m.y = to.y;
    return true;
  }
  m.facing = to.x < m.x ? -1 : 1;
  m.x += ((to.x - m.x) / d) * stepLen;
  m.y += ((to.y - m.y) / d) * stepLen;
  return false;
}

// ---------------------------------------------------------------------------
// Jobs

function setJob(m: StaffState, kind: JobKind, to: Pt, opts: Partial<Job> = {}) {
  m.job = { kind, phase: 'walk', t: 0, to: { ...to }, demandId: null, correct: false, ...opts };
  m.mode = modeForJob(m.job);
  m.anticipate = null;
}

function modeForJob(j: Job): StaffState['mode'] {
  if (j.phase === 'walk') {
    if (j.kind === 'stroke' || j.kind === 'pickUp' || j.kind === 'ask' || j.kind === 'evict') return 'attending';
    return 'responding';
  }
  switch (j.kind) {
    case 'stroke': return 'stroking';
    case 'pickUp': return 'holding';
    case 'ask': return 'asking';
    case 'evict': return 'evicting';
    case 'spray': return 'spraying';
    case 'fussDog': return 'fussingDog';
    default: return 'responding';
  }
}

function freeLapSpot(s: ShiftState, m: StaffState): string | null {
  const laps = s.room.spots.filter((p) => (p.kind === 'lap' || p.kind === 'throne') && p.seat);
  const free = laps.filter((p) => !s.staff.some((o) => o !== m && o.present && o.seatedAt === p.id));
  if (!free.length) return null;
  free.sort((a, b) => dist(a, s.cat) - dist(b, s.cat));
  // Prefer a proper lap over a throne seat
  const lap = free.find((p) => p.kind === 'lap');
  return (lap ?? free[0]).id;
}

export function startCorrectJob(s: ShiftState, m: StaffState, d: Demand) {
  d.claimedBy = m.id;
  const base = { demandId: d.id, correct: true };
  switch (d.kind) {
    case 'food': setJob(m, 'fillBowl', point(s, 'bowl'), base); break;
    case 'door': {
      const sp = s.room.spots.find((p) => p.kind === 'door' && p.doorId === d.door)!;
      setJob(m, 'toggleDoor', { x: sp.x - 4, y: Math.max(sp.y + 6, 50) }, { ...base, door: d.door });
      break;
    }
    case 'lap': {
      const seat = freeLapSpot(s, m);
      if (!seat) { setJob(m, 'ask', nearCat(s, m), { demandId: d.id, correct: false }); d.claimedBy = null; return; }
      const sp = spot(s, seat);
      setJob(m, 'sitLap', point(s, sp.seat!), { ...base, seat });
      break;
    }
    case 'play': setJob(m, 'fetchToy', point(s, 'toy'), { ...base, stage: 0 }); break;
  }
}

function wrongKind(s: ShiftState, m: StaffState): JobKind {
  if (s.threat?.id === 'dog' && threatHook(s, 'dogDistracts', m) && chance(s.rng, TUNING.dog.distractChance)) return 'fussDog';
  const r = next(s.rng);
  if (m.id === 'soft' || m.id === 'soft2') return r < 0.4 ? 'stroke' : r < 0.7 ? 'pickUp' : r < 0.85 ? 'ask' : 'wrongThing';
  if (m.id === 'busy') return r < 0.45 ? 'ask' : r < 0.8 ? 'wrongThing' : r < 0.9 ? 'stroke' : 'pickUp';
  return r < 0.6 ? 'ask' : 'wrongThing';
}

export function startWrongJob(s: ShiftState, m: StaffState, d: Demand) {
  const k = wrongKind(s, m);
  const base = { demandId: d.id, correct: false };
  if (k === 'wrongThing') {
    const others = (['food', 'door', 'play'] as DemandKind[]).filter((x) => x !== d.kind && (x !== 'food' || s.room.spots.some((p) => p.kind === 'bowl')) && (x !== 'door' || s.room.doors.length));
    const other = others.length ? pick(s.rng, others) : null;
    if (other === 'food') return setJob(m, 'fillBowl', point(s, 'bowl'), base);
    if (other === 'door') {
      const door = pick(s.rng, s.room.doors);
      const sp = s.room.spots.find((p) => p.kind === 'door' && p.doorId === door)!;
      return setJob(m, 'toggleDoor', { x: sp.x - 4, y: Math.max(sp.y + 6, 50) }, { ...base, door });
    }
    if (other === 'play') return setJob(m, 'fetchToy', point(s, 'toy'), { ...base, stage: 0 });
    return setJob(m, 'ask', nearCat(s, m), base);
  }
  if (k === 'fussDog') {
    const dp = threatHook(s, 'dogPos', m) as Pt | null;
    if (dp) return setJob(m, 'fussDog', dp, base);
    return setJob(m, 'ask', nearCat(s, m), base);
  }
  setJob(m, k, nearCat(s, m), base);
}

/** Attention with no demand: The Soft One strokes him; anyone else asks what he wants. */
function giveAttention(s: ShiftState, m: StaffState) {
  if (STAFF[m.id].strokes) setJob(m, 'stroke', nearCat(s, m));
  else setJob(m, 'ask', nearCat(s, m));
}

// ---------------------------------------------------------------------------
// Signals

const NOTICING: StaffState['mode'][] = ['routine', 'attending', 'asking', 'stroking', 'fussingDog', 'away'];

/**
 * A verb has been performed. Each staff member who notices it works out what he wants.
 * `target` is the staff member the verb was aimed at (stare, sit on).
 */
export function signal(s: ShiftState, verb: Verb, target: StaffId | null = null) {
  const reachesAdjoining = verb === 'scream' || verb === 'knockOff';
  for (const m of s.staff) {
    if (!NOTICING.includes(m.mode)) continue;
    if (!m.present && !reachesAdjoining) continue;
    if (m.mode === 'away' && !m.present && m.modeT > 0 && !reachesAdjoining) continue;
    // A staff member already on the way for this demand ignores further signals.
    if (m.job && m.job.correct) continue;
    if (m.job && (m.mode === 'attending' || m.mode === 'asking') && m.job.demandId != null && verb !== 'stare') continue;
    const targeted = target === m.id;
    const pN = noticeProbability(s, m, verb, targeted);
    if (pN <= 0 || next(s.rng) >= pN) continue;
    if (!threatStaffNotice(s, m, verb)) continue;
    emit(s, { type: 'notice', staff: m.id, kind: verb });
    if (!m.present) enterRoom(s, m);
    const d = s.demands.find((x) => !x.claimedBy) ?? null;
    if (d) {
      // The very first shift follows the script: she shuffles in and fills the bowl.
      const p = s.def.teach === 'scream' ? 1 : understandFor(s, m, verb, d);
      if (next(s.rng) < p) {
        m.mark = { kind: 'tick', t: 1.4 };
        emit(s, { type: 'understood', staff: m.id, kind: d.kind });
        startCorrectJob(s, m, d);
      } else {
        m.mark = { kind: 'question', t: 1.4 };
        m.stats.wrong++;
        emit(s, { type: 'misunderstood', staff: m.id, kind: d.kind });
        startWrongJob(s, m, d);
      }
    } else if (s.demands.length === 0 && m.mode !== 'stroking' && m.mode !== 'asking') {
      giveAttention(s, m);
    }
  }
}

function enterRoom(s: ShiftState, m: StaffState) {
  m.present = true;
  const e = point(s, s.room.entry);
  m.x = e.x; m.y = e.y;
  m.mode = 'routine';
  m.modeT = 0;
  m.routineT = m.routine[m.routineIdx]?.dur ?? 10;
  emit(s, { type: 'enter', staff: m.id });
}

// ---------------------------------------------------------------------------
// Staff step

function endJob(s: ShiftState, m: StaffState) {
  const j = m.job;
  if (j) {
    if (j.correct) m.lastCorrect = { t: s.time, demand: demandKindOf(s, j) };
    else if (j.demandId != null) m.lastWrong = { t: s.time, demand: demandKindOf(s, j) };
    const d = demandById(s, j.demandId);
    if (d && d.claimedBy === m.id && !(j.kind === 'sitLap')) d.claimedBy = null;
  }
  m.job = null;
  m.mode = 'routine';
  m.modeT = 0;
}

function demandKindOf(s: ShiftState, j: Job): DemandKind {
  const d = demandById(s, j.demandId);
  if (d) return d.kind;
  switch (j.kind) {
    case 'fillBowl': return 'food';
    case 'toggleDoor': return 'door';
    case 'sitLap': return 'lap';
    case 'fetchToy': return 'play';
    default: return m_lastDemand(s);
  }
}

function m_lastDemand(s: ShiftState): DemandKind {
  return s.demands[0]?.kind ?? 'food';
}

function putCatDown(s: ShiftState, m: StaffState) {
  const c = s.cat;
  c.heldBy = null;
  const sp = s.room.spots
    .filter((p) => p.kind === 'floor' || p.kind === 'lap')
    .sort((a, b) => dist(a, m) - dist(b, m))[0];
  c.spot = sp.id; c.x = sp.x; c.y = sp.y;
  c.action = 'idle';
  c.still = 0;
}

function actDuration(s: ShiftState, j: Job): number {
  switch (j.kind) {
    case 'stroke': return range(s.rng, T.strokeTime[0], T.strokeTime[1]);
    case 'pickUp': return T.holdTime;
    case 'ask': return T.askTime;
    case 'evict': return T.evictTime;
    case 'spray': return T.sprayTime;
    case 'closeDoor': return 1;
    case 'fussDog': return 5;
    case 'sitLap': return T.lapSitTime;
    case 'fetchToy': return j.stage === 0 ? 1 : 3;
    default: return range(s.rng, T.respondAct[0], T.respondAct[1]);
  }
}

function beginAct(s: ShiftState, m: StaffState) {
  const j = m.job!;
  j.phase = 'act';
  j.t = actDuration(s, j);
  m.mode = modeForJob(j);
  const c = s.cat;
  if (j.kind === 'pickUp') {
    if (c.action === 'outburst' || c.action === 'held' || dist(m, c) > 30) { endJob(s, m); return; }
    c.heldBy = m.id;
    c.action = 'held';
    c.dest = null;
    c.pending = null;
    c.screaming = false;
    emit(s, { type: 'pickedUp', staff: m.id });
  }
  if (j.kind === 'stroke') {
    if (dist(m, c) > 30 || c.action === 'moving') { endJob(s, m); return; }
    emit(s, { type: 'stroke', staff: m.id });
  }
  if (j.kind === 'sitLap') m.seatedAt = j.seat ?? null;
  if (!j.correct && j.demandId != null) m.lastWrong = { t: s.time, demand: demandKindOf(s, j) };
}

function completeAct(s: ShiftState, m: StaffState) {
  const j = m.job!;
  const d = demandById(s, j.demandId);
  switch (j.kind) {
    case 'fillBowl': {
      const stolen = threatHook(s, 'bowlFilled', m);
      if (!stolen) {
        s.bowl.full = 8;
        s.bowl.fills++;
        emit(s, { type: 'bowlFilled', staff: m.id });
        const food = s.demands.find((x) => x.kind === 'food');
        if (food && j.correct) { serve(s, m, food); }
      }
      break;
    }
    case 'toggleDoor': {
      if (j.door) {
        s.doors[j.door] = !s.doors[j.door];
        emit(s, { type: 'door', kind: j.door, value: s.doors[j.door] ? 1 : 0 });
        const dd = s.demands.find((x) => x.kind === 'door' && x.door === j.door && x.wantOpen === s.doors[j.door!]);
        if (dd && j.correct) serve(s, m, dd);
      }
      break;
    }
    case 'closeDoor':
      if (j.door) { s.doors[j.door] = false; emit(s, { type: 'door', kind: j.door, value: 0 }); }
      break;
    case 'fetchToy':
      if (j.stage === 0) {
        j.stage = 1; j.phase = 'walk'; j.to = nearCat(s, m); m.mode = 'responding';
        emit(s, { type: 'toyFetched', staff: m.id });
        if (threatHook(s, 'toyFetched', m)) { endJob(s, m); }
        return;
      }
      if (j.correct) {
        const play = s.demands.find((x) => x.kind === 'play');
        if (play) serve(s, m, play);
      }
      break;
    case 'pickUp':
      if (s.cat.heldBy === m.id) putCatDown(s, m);
      break;
    case 'evict': {
      const c = s.cat;
      if (c.action !== 'moving' && c.action !== 'held' && dist(m, c) < 34) evictCat(s, m);
      break;
    }
    case 'spray': {
      const c = s.cat;
      c.action = 'stunned';
      c.actionT = TUNING.morale.sprayStun;
      c.dest = null; c.pending = null; c.screaming = false;
      addIrritation(s, TUNING.irritation.sprayed);
      s.tally.sprayed++;
      emit(s, { type: 'sprayed', staff: m.id, x: c.x, y: c.y });
      break;
    }
    case 'sitLap':
      m.seatedAt = null;
      break;
    default:
      break;
  }
  void d;
  endJob(s, m);
}

function serve(s: ShiftState, m: StaffState, d: Demand) {
  addCompliance(s, m, d.kind, C.correct);
  meetDemand(s, d, m);
  m.mark = { kind: 'tick', t: 1.2 };
}

export function evictCat(s: ShiftState, m: StaffState) {
  const c = s.cat;
  const here = spot(s, c.spot);
  const opts = s.room.spots.filter((p) => here.adjacentTo.includes(p.id) && (p.kind === 'floor' || p.kind === 'hide'));
  const to = (opts.length ? opts : s.room.spots.filter((p) => p.kind === 'floor')).sort((a, b) => dist(a, here) - dist(b, here))[0];
  if (here.id === s.room.throne) s.throne.progress = Math.max(0, s.throne.progress - TUNING.throne.evictLoss);
  c.spot = to.id; c.x = to.x; c.y = to.y;
  c.action = 'idle'; c.still = 0; c.sittingOn = null; c.lapT = 0;
  m.stats.evicted++;
  m.evictCooldown = T.evictCooldown;
  s.tally.evictions++;
  emit(s, { type: 'evicted', staff: m.id, x: to.x, y: to.y });
  threatHook(s, 'evicted', m);
}

/** Does the cat, where he sits, block this staff member or sit on their lap? */
export function catBlocks(s: ShiftState, m: StaffState): boolean {
  const c = s.cat;
  if (c.action === 'moving' || c.action === 'held') return false;
  if (c.sittingOn === m.id) return true;
  const here = spot(s, c.spot);
  const step = m.routine[m.routineIdx];
  return !!here.blocks && !!step && step.at === here.blocks && m.mode === 'routine' && dist(m, point(s, step.at)) < 4;
}

function wantsToEvict(s: ShiftState, m: StaffState): boolean {
  const c = s.cat;
  if (c.action === 'moving' || c.action === 'held' || c.action === 'outburst' || c.still < 1.5) return false;
  if (m.evictCooldown > 0) return false;
  if (m.job?.kind === 'sitLap' && c.sittingOn === m.id) return false;
  const onThrone = c.spot === s.room.throne;
  const blocks = catBlocks(s, m);
  const lowMorale = s.def.systems.morale && s.morale < TUNING.morale.boundaries;
  if (m.id === 'guest') {
    if (c.sittingOn === m.id && s.threat?.spec.boss && s.threat.id === 'guest') return m.compliance.lap < 60;
    return blocks;
  }
  if (m.id === 'busy' && blocks && m.compliance.lap < C.busyEvictLapBelow) return true;
  if (lowMorale && (blocks || onThrone)) return true;
  return false;
}

export function stepStaff(s: ShiftState, dt: number) {
  for (const m of s.staff) {
    if (m.mark) { m.mark.t -= dt; if (m.mark.t <= 0) m.mark = null; }
    m.evictCooldown = Math.max(0, m.evictCooldown - dt);

    if (!m.present) {
      if (m.mode === 'away' && m.modeT > 0 && Number.isFinite(m.modeT)) {
        m.modeT -= dt;
        if (m.modeT <= 0) { advanceRoutine(m); enterRoom(s, m); }
      }
      continue;
    }

    if (m.mode === 'recoiling') {
      m.modeT -= dt;
      if (m.modeT <= 0) { m.mode = 'routine'; m.modeT = 0; }
      continue;
    }

    // Anticipation
    if (m.anticipate && m.mode === 'routine' && s.time >= m.anticipate.at) {
      const d = demandById(s, m.anticipate.demandId);
      m.anticipate = null;
      if (d && !d.claimedBy) {
        m.stats.anticipated++;
        m.mark = { kind: 'tick', t: 1.4 };
        emit(s, { type: 'anticipated', staff: m.id, kind: d.kind });
        startCorrectJob(s, m, d);
      }
    }

    if (m.job) {
      stepJob(s, m, dt);
      continue;
    }

    // Routine
    stepRoutine(s, m, dt);
    if (!m.present || m.job) continue;

    // Eviction
    if (wantsToEvict(s, m)) {
      setJob(m, 'evict', nearCat(s, m));
      continue;
    }

    // Unprompted stroking
    if (STAFF[m.id].strokes && s.def.systems.verbs.includes('smack')) {
      m.nextStroke -= dt;
      if (m.nextStroke <= 0) {
        m.nextStroke = range(s.rng, T.softStrokeEvery[0], T.softStrokeEvery[1]);
        const c = s.cat;
        if (!threatHook(s, 'softStroke', m) && c.action !== 'held' && c.action !== 'outburst' && !(spot(s, c.spot).kind === 'hide')) {
          setJob(m, 'stroke', nearCat(s, m));
        }
      }
    }

    // Bath night: tries to pick him up
    if (m.id === 'soft' && s.def.modifiers?.includes('bathNight')) {
      const k = Math.floor(s.time / 15);
      const prevK = Math.floor((s.time - dt) / 15);
      if (k !== prevK && s.time > 5 && s.cat.action !== 'held' && !m.job) setJob(m, 'pickUp', nearCat(s, m));
    }

    // Boundaries: close doors
    if (s.def.systems.morale && s.morale < TUNING.morale.boundaries && s.time - s.lastDoorClose > TUNING.morale.doorCloseEvery) {
      const open = s.room.doors.find((d) => s.doors[d] && !s.demands.some((x) => x.door === d));
      if (open) {
        s.lastDoorClose = s.time;
        const sp = s.room.spots.find((p) => p.doorId === open)!;
        setJob(m, 'closeDoor', { x: sp.x - 4, y: Math.max(sp.y + 6, 50) }, { door: open });
      }
    }
  }
  stepSeats(s, dt);
}

function advanceRoutine(m: StaffState) {
  m.routineIdx = (m.routineIdx + 1) % Math.max(1, m.routine.length);
  m.routineT = m.routine[m.routineIdx]?.dur ?? 10;
}

function stepRoutine(s: ShiftState, m: StaffState, dt: number) {
  m.mode = 'routine';
  const step = m.routine[m.routineIdx];
  if (!step) return;
  if (step.task === 'away') {
    const e = point(s, s.room.entry);
    if (walkTo(m, e, dt)) {
      m.present = false;
      m.mode = 'away';
      m.modeT = step.dur;
      m.seatedAt = null;
      emit(s, { type: 'leave', staff: m.id });
    }
    return;
  }
  const at = point(s, step.at);
  if (walkTo(m, at, dt)) {
    if (step.task !== 'hoover') {
      m.routineT -= dt;
      if (m.routineT <= 0 && m.routine.length > 1) advanceRoutine(m);
    }
  }
}

function stepJob(s: ShiftState, m: StaffState, dt: number) {
  const j = m.job!;
  const c = s.cat;
  if (j.phase === 'walk') {
    // Track the cat for jobs that need him
    if (j.kind === 'stroke' || j.kind === 'pickUp' || j.kind === 'ask' || j.kind === 'evict' || (j.kind === 'fetchToy' && j.stage === 1)) {
      j.to = nearCat(s, m);
    }
    if (j.kind === 'fussDog') {
      const dp = threatHook(s, 'dogPos', m) as Pt | null;
      if (!dp) { endJob(s, m); return; }
      j.to = { x: dp.x + (m.x < dp.x ? -10 : 10), y: dp.y + 2 };
    }
    if (j.kind === 'spray') { beginAct(s, m); return; }
    if (walkTo(m, j.to, dt)) beginAct(s, m);
    return;
  }
  // Acting
  j.t -= dt;
  if (j.kind === 'stroke') {
    if (c.action === 'moving' || dist(m, c) > 30 || c.action === 'outburst') { endJob(s, m); return; }
    if (s.def.systems.band && s.cat.attention > s.band.centre + s.band.halfWidth) m.stats.overStroke += dt;
  }
  if (j.kind === 'pickUp') {
    if (c.heldBy !== m.id) { endJob(s, m); return; }
    c.x = m.x + m.facing * 7; c.y = m.y - 17;
  }
  if (j.kind === 'ask' && (dist(m, c) > 34)) { endJob(s, m); return; }
  if (j.kind === 'fussDog') threatHook(s, 'fussing', m, dt);
  if (j.kind === 'sitLap') {
    // Stays seated; the lap is credited in stepSeats.
    const d = demandById(s, j.demandId);
    if (!d && c.sittingOn !== m.id && j.t < T.lapSitTime - 4) { m.seatedAt = null; endJob(s, m); return; }
  }
  if (j.t <= 0) completeAct(s, m);
}

/** Work out which staff are seated, and whether he is on a lap (spec §7.1 Lap). */
function stepSeats(s: ShiftState, dt: number) {
  const c = s.cat;
  for (const m of s.staff) {
    if (!m.present) { m.seatedAt = null; continue; }
    if (m.job?.kind === 'sitLap' && m.job.phase === 'act') { m.seatedAt = m.job.seat ?? null; continue; }
    if (m.mode === 'routine') {
      const step = m.routine[m.routineIdx];
      const sp = step && s.room.spots.find((p) => p.seat === step.at);
      m.seatedAt = sp && dist(m, point(s, step.at)) < 3 && step.task !== 'tidy' && step.task !== 'cook' ? sp.id : null;
    } else if (m.mode !== 'stroking' && m.mode !== 'asking') {
      m.seatedAt = null;
    }
  }
  const prev = c.sittingOn;
  c.sittingOn = null;
  if (c.action !== 'moving' && c.action !== 'held') {
    const lapOwner = s.staff.find((m) => m.present && m.seatedAt === c.spot);
    if (lapOwner) c.sittingOn = lapOwner.id;
  }
  if (c.sittingOn && c.sittingOn === prev) c.lapT += dt;
  else c.lapT = 0;
  if (c.sittingOn) {
    const owner = s.staff.find((m) => m.id === c.sittingOn)!;
    const lap = s.demands.find((d) => d.kind === 'lap');
    if (lap && c.lapT >= T.lapHold) {
      addCompliance(s, owner, 'lap', C.correct);
      meetDemand(s, lap, owner);
      owner.mark = { kind: 'tick', t: 1.2 };
      owner.lastCorrect = { t: s.time, demand: 'lap' };
      threatHook(s, 'lapMet', owner);
    }
    // Staying on and purring counts as a reward.
    if (c.lapT >= T.lapHold + 2 && owner.lastCorrect?.demand === 'lap') rewardIfDue(s, owner);
  }
}

export function initialStaffState(id: StaffId, routine: StaffState['routine'], x: number, y: number, compliance: Record<DemandKind, number>, away: boolean): StaffState {
  return {
    id, x, y, present: !away, mode: away ? 'away' : 'routine', modeT: away ? Infinity : 0, job: null,
    routine, routineIdx: 0, routineT: routine[0]?.dur ?? 10,
    compliance: { ...compliance }, nextStroke: 4, evictCooldown: 0, mark: null,
    lastWrong: null, lastCorrect: null, anticipate: null, facing: 1,
    stats: { slowest: 0, wrong: 0, overStroke: 0, anticipated: 0, evicted: 0, bitten: 0, served: 0 },
    seatedAt: null, lapSitUntil: 0,
  };
}

export function sprayResponse(s: ShiftState): boolean {
  if (!s.def.systems.morale || s.morale >= TUNING.morale.spray) return false;
  if (s.staff.some((m) => m.job?.kind === 'spray')) return true;
  const m = present(s).filter((x) => x.mode !== 'recoiling').sort((a, b) => dist(a, s.cat) - dist(b, s.cat))[0];
  if (!m) return false;
  setJob(m, 'spray', { x: m.x, y: m.y });
  emit(s, { type: 'sprayStart', staff: m.id });
  return true;
}

export function startJobPublic(m: StaffState, kind: JobKind, to: Pt, opts: Partial<Job> = {}) {
  setJob(m, kind, to, opts);
}

export { endJob, changeMorale };

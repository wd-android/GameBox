import { TUNING } from '../config/tuning';
import { OBJECTS } from '../content/rooms';
import type { ShiftState, Spot, StaffState, TargetRef, Verb } from './types';
import { changeMorale, dist, emit, nearestSpot, present, spot, staffById } from './util';
import { addCompliance, catBlocks, endJob, signal, sprayResponse } from './staff';
import { lapseAllowed, maybeLapse } from './brainCell';
import { threatRespond, threatBlocksSpot } from './threats';

const V = TUNING.verbs;

export function verbEnabled(s: ShiftState, v: Verb) {
  return s.def.systems.verbs.includes(v);
}

export function canAct(s: ShiftState) {
  const a = s.cat.action;
  return s.status === 'running' && a !== 'outburst' && a !== 'stunned' && a !== 'lapse' && a !== 'held' && a !== 'scheme' && a !== 'knocking';
}

// ---------------------------------------------------------------------------
// Movement

export function moveTo(s: ShiftState, spotId: string, allowLapse = true) {
  const c = s.cat;
  if (!canAct(s) && c.action !== 'held') return;
  if (c.action === 'held') return;
  let dest: string | null | undefined = spotId;
  if (threatBlocksSpot(s, spotId)) {
    const sp = spot(s, spotId);
    dest = sp.adjacentTo.find((id) => !threatBlocksSpot(s, id) && spot(s, id).kind !== 'box') ?? c.spot;
  }
  if (allowLapse && lapseAllowed(s)) {
    const r = maybeLapse(s, dest);
    if (r === null) { c.dest = null; c.pending = null; return; }
    if (r !== undefined) dest = r;
  }
  if (dest === c.spot && c.action !== 'moving') {
    arrive(s);
    return;
  }
  c.dest = dest;
  c.action = 'moving';
  c.screaming = false;
  c.stareTarget = null;
  c.sittingOn = null;
  // Leaving a lap or a stroke ends it.
  for (const m of present(s)) if (m.mode === 'stroking' || m.mode === 'asking') endJob(s, m);
}

export function stepMovement(s: ShiftState, dt: number) {
  const c = s.cat;
  if (c.action !== 'moving' || !c.dest) {
    if (c.action !== 'moving') c.still += dt;
    return;
  }
  const to = spot(s, c.dest);
  const d = dist(c, to);
  const stepLen = TUNING.cat.speed * dt;
  if (d <= stepLen) {
    c.x = to.x; c.y = to.y;
    c.spot = to.id;
    c.dest = null;
    arrive(s);
  } else {
    c.facing = to.x < c.x ? -1 : 1;
    c.x += ((to.x - c.x) / d) * stepLen;
    c.y += ((to.y - c.y) / d) * stepLen;
  }
}

function arrive(s: ShiftState) {
  const c = s.cat;
  c.action = 'idle';
  c.still = 0;
  const here = spot(s, c.spot);
  if (c.lapse === 'box' && here.kind === 'box') {
    c.action = 'lapse';
    c.actionT = TUNING.lapse.box;
    return;
  }
  if (c.lapse === 'wrongSpot') {
    c.lapse = null;
    c.pending = null;
    emit(s, { type: 'lapseEnded' });
    return;
  }
  if (c.pending) {
    const p = c.pending;
    c.pending = null;
    performVerb(s, p.verb, p.target, true);
    return;
  }
  sitOnArrival(s, here);
}

/** Arriving on a lap, a throne or someone's work counts as Sit On (spec §7.2). */
function sitOnArrival(s: ShiftState, here: Spot) {
  if (!verbEnabled(s, 'sitOn')) return;
  const sittable = here.kind === 'lap' || here.kind === 'throne' || here.kind === 'perch' || !!here.blocks;
  if (!sittable) return;
  const c = s.cat;
  c.action = 'sitting';
  emit(s, { type: 'sitOn', kind: here.id });
  const owner = s.staff.find((m) => m.present && m.seatedAt === here.id) ?? null;
  // Reward: sitting on someone shortly after they served him correctly.
  if (owner) rewardIfDue(s, owner);
  const blocked = s.staff.find((m) => m.present && catBlocksAt(s, m, here));
  if (blocked) {
    changeMorale(s, V.sitOn.morale, blocked.id);
    signal(s, 'sitOn', blocked.id);
  }
}

function catBlocksAt(s: ShiftState, m: StaffState, here: Spot) {
  const step = m.routine[m.routineIdx];
  if (m.seatedAt === here.id && step && (step.task === 'work' || step.task === 'phone' || step.task === 'read')) return true;
  return !!here.blocks && !!step && step.at === here.blocks && m.mode === 'routine' && dist(m, s.room.points[step.at] ?? m) < 4;
}

export function rewardIfDue(s: ShiftState, m: StaffState) {
  if (m.lastCorrect && s.time - m.lastCorrect.t <= V.rewardWindow) {
    addCompliance(s, m, m.lastCorrect.demand, TUNING.compliance.rewarded);
    emit(s, { type: 'rewarded', staff: m.id, kind: m.lastCorrect.demand });
    m.mark = { kind: 'heart', t: 1.4 };
    m.lastCorrect = null;
  }
}

// ---------------------------------------------------------------------------
// Verbs

/** Spot from which he can act on a target */
export function actSpotFor(s: ShiftState, target: TargetRef): string | null {
  switch (target.kind) {
    case 'spot': return target.id;
    case 'object': {
      const o = s.objects.find((x) => x.id === target.id);
      return o && !o.knocked ? o.spot : null;
    }
    case 'staff': {
      const m = staffById(s, target.id);
      if (!m || !m.present) return null;
      if (m.seatedAt) return m.seatedAt;
      return nearestSpot(s, m, (p) => p.kind !== 'ledge' && p.kind !== 'box' && p.kind !== 'perch' && p.kind !== 'throne').id;
    }
    case 'dog': {
      const pos = threatRespond(s, 'dogPos', target) as { x: number; y: number } | null;
      if (!pos) return null;
      return nearestSpot(s, pos, (p) => p.kind !== 'ledge' && p.kind !== 'box' && p.kind !== 'perch').id;
    }
  }
}

function targetPos(s: ShiftState, t: TargetRef): { x: number; y: number } | null {
  if (t.kind === 'staff') return staffById(s, t.id) ?? null;
  if (t.kind === 'dog') return threatRespond(s, 'dogPos', t) as { x: number; y: number } | null;
  if (t.kind === 'object') return s.objects.find((o) => o.id === t.id) ? spot(s, s.objects.find((o) => o.id === t.id)!.spot) : null;
  return spot(s, t.id);
}

/** Verbs valid for a target, as offered on the verb arc */
export function verbsFor(s: ShiftState, target: TargetRef): Verb[] {
  const out: Verb[] = [];
  if (target.kind === 'staff') {
    const m = staffById(s, target.id);
    if (!m?.present) return out;
    if (verbEnabled(s, 'stare')) out.push('stare');
    if (verbEnabled(s, 'smack')) out.push('smack');
    if (verbEnabled(s, 'sitOn')) out.push('sitOn');
  } else if (target.kind === 'object') {
    if (verbEnabled(s, 'knockOff')) out.push('knockOff');
  } else if (target.kind === 'dog') {
    if (verbEnabled(s, 'stare')) out.push('stare');
    if (verbEnabled(s, 'smack')) out.push('smack');
  }
  return out;
}

export function performVerb(s: ShiftState, verb: Verb, target: TargetRef, arrived = false) {
  const c = s.cat;
  if (!verbEnabled(s, verb)) return;
  if (!canAct(s) && !(arrived && c.action === 'idle')) return;
  const pos = targetPos(s, target);
  if (!pos) return;

  if (verb === 'stare') {
    c.action = 'staring';
    c.stareTarget = target;
    c.stareT = TUNING.verbs.stare.time;
    c.facing = pos.x < c.x ? -1 : 1;
    emit(s, { type: 'stareStart' });
    return;
  }

  const near = dist(c, pos) <= TUNING.cat.adjacent + 8 || (target.kind === 'object' && s.objects.find((o) => o.id === target.id)?.spot === c.spot);
  if (!near) {
    if (arrived) return; // Target moved away; give up quietly.
    const sp = actSpotFor(s, target);
    if (!sp) return;
    c.pending = { verb, target };
    moveTo(s, sp, false);
    if (c.action !== 'moving') { c.pending = null; performVerb(s, verb, target, true); }
    return;
  }

  switch (verb) {
    case 'smack': return smack(s, target);
    case 'knockOff':
      if (target.kind === 'object') {
        c.action = 'knocking';
        c.actionT = TUNING.verbs.knockOff.time;
        c.stareTarget = target; // remember which
      }
      return;
    case 'sitOn': {
      if (target.kind === 'staff') {
        const m = staffById(s, target.id)!;
        c.action = 'sitting';
        c.facing = m.x < c.x ? -1 : 1;
        rewardIfDue(s, m);
        if (catBlocks(s, m)) { changeMorale(s, V.sitOn.morale, m.id); signal(s, 'sitOn', m.id); }
        emit(s, { type: 'sitOn', staff: m.id });
      }
      return;
    }
    default:
  }
}

function smack(s: ShiftState, target: TargetRef) {
  const c = s.cat;
  c.action = 'smacking';
  c.actionT = 0.35;
  if (target.kind === 'dog') {
    threatRespond(s, 'smack', target);
    emit(s, { type: 'smack', kind: 'dog' });
    return;
  }
  if (target.kind !== 'staff') return;
  const m = staffById(s, target.id)!;
  c.facing = m.x < c.x ? -1 : 1;
  const punish = (m.job && !m.job.correct && m.job.demandId != null && m.lastWrong) || (m.lastWrong && s.time - m.lastWrong.t <= V.punishWindow);
  if (punish && m.lastWrong) {
    addCompliance(s, m, m.lastWrong.demand, TUNING.compliance.punished);
    emit(s, { type: 'punished', staff: m.id, kind: m.lastWrong.demand });
    m.lastWrong = null;
  }
  if (c.heldBy === m.id) {
    c.heldBy = null;
    const sp = nearestSpot(s, m, (p) => p.kind === 'floor');
    c.spot = sp.id; c.x = sp.x; c.y = sp.y;
  }
  const wasStroking = m.mode === 'stroking' || m.mode === 'holding';
  if (m.job) {
    const d = s.demands.find((x) => x.id === m.job!.demandId);
    if (d && d.claimedBy === m.id) d.claimedBy = null;
  }
  m.job = null;
  m.mode = 'recoiling';
  m.modeT = V.smack.recoil;
  m.mark = { kind: 'yelp', t: 1 };
  changeMorale(s, V.smack.morale, m.id);
  emit(s, { type: 'smack', staff: m.id, value: wasStroking ? 1 : 0 });
  threatRespond(s, 'smack', target);
}

export function knockObject(s: ShiftState, id: number, outburst = false) {
  const o = s.objects.find((x) => x.id === id);
  if (!o || o.knocked) return;
  o.knocked = true;
  o.t = 0;
  const info = OBJECTS[o.kind];
  s.tally.knocked.push(o.kind);
  emit(s, { type: 'knocked', kind: o.kind, value: info?.breakable ? 1 : 0, x: spot(s, o.spot).x, y: spot(s, o.spot).y });
  if (!outburst) {
    changeMorale(s, info?.breakable ? V.knockOff.moraleBreakable : V.knockOff.morale, 'room');
    if (!sprayResponse(s)) signal(s, 'knockOff');
  }
}

// ---------------------------------------------------------------------------
// Scream and stare (continuous)

export function screamStart(s: ShiftState) {
  const c = s.cat;
  if (!verbEnabled(s, 'scream')) return;
  if (!canAct(s)) return;
  c.screaming = true;
  c.screamT = 0;
  c.screamSignalled = false;
  if (c.action !== 'moving') c.action = 'screaming';
  emit(s, { type: 'screamStart' });
}

export function screamEnd(s: ShiftState) {
  const c = s.cat;
  if (!c.screaming) return;
  c.screaming = false;
  if (c.action === 'screaming') c.action = 'idle';
  emit(s, { type: 'screamEnd' });
}

export function stepScreamAndStare(s: ShiftState, dt: number) {
  const c = s.cat;
  if (c.screaming) {
    c.screamT += dt;
    if (!c.screamSignalled && c.screamT >= V.scream.minHold) {
      c.screamSignalled = true;
      s.tally.screams++;
      s.screamTimes = s.screamTimes.filter((t) => s.time - t < V.scream.nagWindow);
      s.screamTimes.push(s.time);
      if (s.screamTimes.length > V.scream.nagFree) changeMorale(s, V.scream.nagMorale, 'room');
      emit(s, { type: 'scream' });
      threatRespond(s, 'scream', { kind: 'spot', id: c.spot });
      if (!sprayResponse(s)) signal(s, 'scream');
    }
  }
  if (c.action === 'staring' && c.stareTarget) {
    c.stareT -= dt;
    if (c.stareT <= 0) {
      const t = c.stareTarget;
      c.action = 'idle';
      c.stareTarget = null;
      emit(s, { type: 'stareDone' });
      if (t.kind === 'staff') signal(s, 'stare', t.id);
      else if (t.kind === 'dog') threatRespond(s, 'stare', t);
    }
  }
}

/** Timed cat actions: knocking, smacking, lapses, stun */
export function stepCatActions(s: ShiftState, dt: number) {
  const c = s.cat;
  if (c.action === 'knocking') {
    c.actionT -= dt;
    if (c.actionT <= 0) {
      const t = c.stareTarget;
      c.stareTarget = null;
      c.action = 'idle';
      if (t?.kind === 'object') knockObject(s, t.id);
    }
  } else if (c.action === 'smacking' || c.action === 'stunned') {
    c.actionT -= dt;
    if (c.actionT <= 0) c.action = 'idle';
  } else if (c.action === 'lapse') {
    c.actionT -= dt;
    if (c.actionT <= 0) {
      c.action = 'idle';
      c.lapse = null;
      emit(s, { type: 'lapseEnded' });
    }
  } else if (c.action === 'outburst') {
    c.actionT -= dt;
    if (c.actionT <= 0) {
      c.action = 'idle';
      c.outburst = null;
      // Zoomies leave him somewhere else
    }
  }
  for (const o of s.objects) if (o.knocked) o.t += dt;
}

export { present };

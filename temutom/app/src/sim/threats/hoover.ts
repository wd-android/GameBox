import { TUNING } from '../../config/tuning';
import { pick } from '../rng';
import type { ShiftState, StaffState, ThreatState } from '../types';
import { catHidden, changeMorale, dist, emit, spot, staffById } from '../util';
import type { ThreatModule } from './index';

const H = TUNING.hoover;

export interface HooverData {
  state: 'waiting' | 'running' | 'stopped' | 'done';
  startAt: number;
  x: number; y: number;
  spot: string;
  progress: number;
  ran: number;
  stopT: number;
  stopReason: 'sit' | 'bite' | 'plug' | null;
  moveT: number;
  operator: string | null;
  savedRoutine: StaffState['routine'] | null;
  [k: string]: unknown;
}

export function hooverData(t: ThreatState) {
  return t.data as HooverData;
}

function floorSpots(s: ShiftState) {
  return s.room.spots.filter((p) => p.kind === 'floor' || p.kind === 'toy');
}

function operatorOf(s: ShiftState): StaffState | undefined {
  return staffById(s, 'busy') ?? s.staff.find((m) => m.id !== 'guest');
}

function begin(s: ShiftState, d: HooverData) {
  const op = operatorOf(s);
  if (!op) { d.state = 'done'; return; }
  d.operator = op.id;
  d.savedRoutine = op.routine;
  op.routine = [{ at: 'hoover', task: 'hoover', dur: 999 }];
  op.routineIdx = 0;
  if (!op.present) { op.present = true; op.mode = 'routine'; const e = s.room.points[s.room.entry]; op.x = e.x; op.y = e.y; }
  const sp = pick(s.rng, floorSpots(s));
  d.spot = sp.id; d.x = sp.x; d.y = sp.y;
  d.state = 'running';
  s.dynPoints.hoover = { x: Math.min(94, d.x + 10), y: d.y + 2 };
  emit(s, { type: 'hooverStart' });
}

function finish(s: ShiftState, d: HooverData) {
  d.state = 'done';
  const op = d.operator ? staffById(s, d.operator as never) : undefined;
  if (op && d.savedRoutine) { op.routine = d.savedRoutine; op.routineIdx = 0; }
  if (s.dynPoints.hoover) s.dynPoints.hoover = { ...s.dynPoints.hoover };
  emit(s, { type: 'hooverEnd' });
}

function stop(s: ShiftState, d: HooverData, secs: number, reason: HooverData['stopReason']) {
  if (d.state !== 'running' && d.state !== 'stopped') return;
  d.state = 'stopped';
  d.stopT = Math.max(d.stopT, secs);
  d.stopReason = reason;
  emit(s, { type: 'hooverStopped', kind: reason ?? '' });
}

export const hoover: ThreatModule = {
  id: 'hoover',
  start(s, t) {
    const d: HooverData = {
      state: 'waiting', startAt: t.spec.startAt ?? (t.spec.boss ? 5 : 25), x: 0, y: 0, spot: '',
      progress: 0, ran: 0, stopT: 0, stopReason: null, moveT: 4, operator: null, savedRoutine: null,
    };
    t.data = d;
  },
  step(s, t, dt) {
    const d = hooverData(t);
    const c = s.cat;
    if (d.state === 'waiting') {
      if (s.time >= d.startAt) begin(s, d);
      return 0;
    }
    if (d.state === 'done') return 0;
    const op = d.operator ? staffById(s, d.operator as never) : undefined;
    s.dynPoints.hoover = { x: Math.min(94, d.x + 10), y: d.y + 2 };
    const operatorThere = !!op && op.present && op.mode === 'routine' && dist(op, s.dynPoints.hoover) < 6;

    if (d.state === 'stopped') {
      d.stopT -= dt;
      const onPlug = d.stopReason === 'plug' && c.action !== 'moving' && spot(s, c.spot).kind === 'socket';
      if (d.stopT <= 0 && !onPlug) {
        if (d.stopReason === 'sit' && c.spot === d.spot && c.action !== 'moving') {
          // He is moved aside.
          const here = spot(s, c.spot);
          const to = s.room.spots.find((p) => here.adjacentTo.includes(p.id) && p.kind === 'floor') ?? here;
          c.spot = to.id; c.x = to.x; c.y = to.y; c.still = 0;
          emit(s, { type: 'movedAside' });
        }
        d.state = 'running';
        d.stopReason = null;
        emit(s, { type: 'hooverResumed' });
      }
      return 0;
    }

    // Running
    if (operatorThere) {
      d.progress = Math.min(100, d.progress + (100 / H.runToFinish) * dt);
      d.ran += dt;
      d.moveT -= dt;
      if (d.moveT <= 0) {
        d.moveT = 4;
        const opts = floorSpots(s).filter((p) => p.id !== d.spot);
        const sp = pick(s.rng, opts.length ? opts : floorSpots(s));
        d.spot = sp.id;
      }
      const target = spot(s, d.spot);
      const dd = dist(d, target);
      const step = 18 * dt;
      if (dd > step) { d.x += ((target.x - d.x) / dd) * step; d.y += ((target.y - d.y) / dd) * step; } else { d.x = target.x; d.y = target.y; }
    }
    if (!t.spec.boss && t.spec.visit && d.ran >= t.spec.visit) { finish(s, d); return 0; }
    // Sit On the spot in front of it
    if (c.action !== 'moving' && c.spot === d.spot && c.still > 0.3) {
      stop(s, d, H.sitStop, 'sit');
      changeMorale(s, H.sitMorale, (d.operator as never) ?? 'room');
      return 0;
    }
    if (!operatorThere) return catHidden(s) ? H.irritationHidden / 2 : H.irritation / 2;
    return catHidden(s) ? H.irritationHidden : H.irritation;
  },
  respond(s, t, verb, target) {
    const d = hooverData(t);
    if (verb === 'bite' && target.kind === 'staff' && target.id === d.operator) stop(s, d, H.biteStop, 'bite');
    if (verb === 'scheme') stop(s, d, H.plugStop, 'plug');
    return null;
  },
  isDefeated(_s, t) {
    const d = hooverData(t);
    return d.progress < 100;
  },
  hook() { return null; },
};

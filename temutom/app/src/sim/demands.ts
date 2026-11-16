import { TUNING } from '../config/tuning';
import { pick, range } from './rng';
import type { Demand, DemandKind, ShiftState, StaffState } from './types';
import { emit, staffById } from './util';
import { addIrritation } from './irritation';
import { maybeAnticipate } from './staff';

const D = TUNING.demands;

export function matchingSpot(s: ShiftState, d: Demand): string[] {
  switch (d.kind) {
    case 'food': return s.room.spots.filter((p) => p.kind === 'bowl').map((p) => p.id);
    case 'door': return s.room.spots.filter((p) => p.kind === 'door' && p.doorId === d.door).map((p) => p.id);
    case 'lap': return s.room.spots.filter((p) => p.kind === 'lap' || (p.kind === 'throne' && p.seat)).map((p) => p.id);
    case 'play': return s.room.spots.filter((p) => p.kind === 'toy').map((p) => p.id);
  }
}

export function kindsAvailable(s: ShiftState): DemandKind[] {
  const ks = s.def.demands.kinds ?? s.room.demands;
  return ks.filter((k) => {
    if (k === 'food') return s.room.spots.some((p) => p.kind === 'bowl');
    if (k === 'door') return s.room.doors.length > 0;
    if (k === 'play') return true;
    return true;
  });
}

export function issueDemand(s: ShiftState, kind: DemandKind, door?: string, wantOpen?: boolean) {
  if (s.demands.some((d) => d.kind === kind && (kind !== 'door' || d.door === door))) return;
  const patience = s.settings.longerPatience ? D.longPatience : D.patience;
  const d: Demand = {
    id: ++s.demandSeq,
    kind,
    issuedAt: s.time,
    patience,
    maxPatience: patience,
    need: kind === 'food' && s.def.modifiers?.includes('halfEmptyBowl') ? 2 : 1,
    claimedBy: null,
  };
  if (kind === 'door') {
    d.door = door ?? pick(s.rng, s.room.doors);
    d.wantOpen = wantOpen ?? !s.doors[d.door];
  }
  s.demands.push(d);
  s.tally.issued++;
  emit(s, { type: 'demand', kind });
  maybeAnticipate(s, d);
}

export function stepDemands(s: ShiftState, dt: number) {
  const def = s.def.demands;
  const maxActive = def.maxActive;
  // Timed demands
  if (def.timed) {
    while (s.timedIdx < def.timed.length && def.timed[s.timedIdx].t <= s.time) {
      const td = def.timed[s.timedIdx++];
      if (s.demands.length < maxActive) issueDemand(s, td.kind, td.door);
    }
  }
  // Put-back door demands
  for (let i = s.putBack.length - 1; i >= 0; i--) {
    const pb = s.putBack[i];
    if (pb.at <= s.time && s.demands.length < maxActive) {
      s.putBack.splice(i, 1);
      if (s.doors[pb.door] !== pb.wantOpen) issueDemand(s, 'door', pb.door, pb.wantOpen);
    }
  }
  // Random demands
  if (def.interval && s.time >= s.nextDemandAt) {
    if (s.demands.length < maxActive && s.length - s.time > 12) {
      const kinds = kindsAvailable(s).filter((k) => !s.demands.some((d) => d.kind === k));
      if (kinds.length) issueDemand(s, pick(s.rng, kinds));
    }
    s.nextDemandAt = s.time + range(s.rng, def.interval[0], def.interval[1]);
  }
  // Patience
  for (let i = s.demands.length - 1; i >= 0; i--) {
    const d = s.demands[i];
    d.patience -= dt;
    if (d.patience <= 0) {
      s.demands.splice(i, 1);
      addIrritation(s, TUNING.irritation.demandExpired);
      emit(s, { type: 'demandExpired', kind: d.kind });
      for (const m of s.staff) if (m.job?.demandId === d.id && m.job.correct) m.job.demandId = null;
    }
  }
}

/** A demand has been satisfied. `by` is the staff member who served it, if any. */
export function meetDemand(s: ShiftState, d: Demand, by: StaffState | null, credit = 1) {
  d.need--;
  if (d.need > 0) {
    emit(s, { type: 'demandProgress', kind: d.kind });
    return;
  }
  const idx = s.demands.indexOf(d);
  if (idx >= 0) s.demands.splice(idx, 1);
  s.tally.met += credit;
  const late = s.time - d.issuedAt;
  emit(s, { type: 'demandMet', kind: d.kind, staff: by?.id, value: late });
  if (by) {
    by.stats.served++;
    by.stats.slowest = Math.max(by.stats.slowest, late);
  }
  if (d.kind === 'door' && d.door) {
    s.putBack.push({ at: s.time + range(s.rng, D.putBackDelay[0], D.putBackDelay[1]), door: d.door, wantOpen: !d.wantOpen });
  }
}

export function demandById(s: ShiftState, id: number | null) {
  return id == null ? undefined : s.demands.find((d) => d.id === id);
}

export function firstDemandFor(s: ShiftState, by: StaffState) {
  // Unclaimed first, prefer the oldest
  return s.demands.find((d) => !d.claimedBy || d.claimedBy === by.id) ?? null;
}

export { staffById };

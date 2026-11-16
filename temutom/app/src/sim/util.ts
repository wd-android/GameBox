import type { Pt, ShiftState, Spot, StaffId, StaffState, SimEvent } from './types';
import { STAFF } from '../content/staff';

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function spot(s: ShiftState, id: string): Spot {
  const sp = s.room.spots.find((p) => p.id === id);
  if (!sp) throw new Error(`No spot ${id} in ${s.room.id}`);
  return sp;
}

export function activeSpots(s: ShiftState): Spot[] {
  return s.room.spots.filter((p) => !p.optional || (p.kind === 'box' && s.hasBox));
}

export function point(s: ShiftState, id: string): Pt {
  const dp = s.dynPoints[id];
  if (dp) return dp;
  const p = s.room.points[id];
  if (p) return p;
  return spot(s, id);
}

export function present(s: ShiftState): StaffState[] {
  return s.staff.filter((m) => m.present);
}

export function staffById(s: ShiftState, id: StaffId): StaffState | undefined {
  return s.staff.find((m) => m.id === id);
}

export function emit(s: ShiftState, e: SimEvent) {
  s.events.push(e);
}

/** Change household morale. Losses are scaled by the multiplier of whoever suffered them. */
export function changeMorale(s: ShiftState, delta: number, cause?: StaffId | 'room') {
  if (!s.def.systems.morale) return;
  let d = delta;
  if (d < 0) {
    if (cause === 'room') {
      const here = present(s);
      const m = here.length ? here.reduce((a, x) => a + STAFF[x.id].moraleMult, 0) / here.length : 1;
      d *= m;
    } else if (cause) {
      d *= STAFF[cause].moraleMult;
    }
    d *= s.bossMorale;
  }
  s.morale = clamp(s.morale + d, 0, 100);
}

export function catAtSpot(s: ShiftState): Spot | null {
  if (s.cat.action === 'moving' || s.cat.action === 'held') return null;
  return s.room.spots.find((p) => p.id === s.cat.spot) ?? null;
}

export function catHidden(s: ShiftState): boolean {
  const sp = catAtSpot(s);
  return !!sp && (sp.kind === 'hide' || (sp.kind === 'box' && s.cat.action !== 'moving'));
}

export function nearestStaff(s: ShiftState, p: Pt, filter: (m: StaffState) => boolean = () => true): StaffState | null {
  let best: StaffState | null = null;
  let bd = Infinity;
  for (const m of present(s)) {
    if (!filter(m)) continue;
    const d = dist(m, p);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** Spot nearest to a point (excluding optional spots that are not in play) */
export function nearestSpot(s: ShiftState, p: Pt, filter: (sp: Spot) => boolean = () => true): Spot {
  let best = activeSpots(s)[0];
  let bd = Infinity;
  for (const sp of activeSpots(s)) {
    if (!filter(sp)) continue;
    const d = dist(sp, p);
    if (d < bd) { bd = d; best = sp; }
  }
  return best;
}

export function isFinalWeekShift(s: ShiftState) {
  return s.def.day === 7 && s.def.slot === 'night';
}

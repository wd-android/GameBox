import type { Chore, ChoreKind, MomentState, Pt } from './types';
import { PLACES } from '../content/places';
import { emit, note, pathLength } from './util';
import type { PlaceId } from './types';

export function makeChore(place: PlaceId, kind: ChoreKind | null, hooverAreas = 1): Chore | null {
  if (!kind) return null;
  const p = PLACES[place];
  if (kind === 'hoover') {
    const areas = p.hooverAreas.slice(0, hooverAreas);
    const path: Pt[] = [];
    const areaEnds: number[] = [];
    for (const a of areas) { path.push(...a); areaEnds.push(pathLength(path)); }
    return { kind, steps: [], current: 0, hoover: { path, length: pathLength(path), s: 0, areaEnds, running: false, lastMove: -9 } };
  }
  const items = p.chores[kind];
  if (!items) return null;
  return { kind, current: 0, steps: items.map((i) => ({ ...i, r: 44, progress: 0, done: false })) };
}

export function choreDone(c: Chore | null) {
  if (!c) return false;
  if (c.hoover) return c.hoover.s >= c.hoover.length - 1;
  return c.current >= c.steps.length;
}

export function choreFraction(c: Chore | null) {
  if (!c) return 1;
  if (c.hoover) return Math.min(1, c.hoover.s / c.hoover.length);
  return c.steps.filter((x) => x.done).length / c.steps.length;
}

/** Is the current chore item covered (sat on, under him on the lap, or the lid closed)? */
export function choreBlocked(s: MomentState): boolean {
  const ch = s.chore;
  const c = s.cat;
  if (!ch || ch.hoover) return false;
  const st = ch.steps[ch.current];
  if (!st) return true;
  if (c.sitOn?.what === 'chore' && c.sitOn.step === ch.current) return true;
  if (c.activity === 'onLap' && PLACES[s.def.place].lapCoverY !== undefined && st.y >= PLACES[s.def.place].lapCoverY!) return true;
  if (s.def.place === 'study' && s.time < s.lidClosedUntil) return true;
  if (c.pose === 'closeUp') return true;
  return false;
}

export function workChore(s: MomentState, dt: number) {
  const ch = s.chore!;
  if (choreBlocked(s)) return;
  const st = ch.steps[ch.current];
  st.progress = Math.min(1, st.progress + dt / st.time);
  if (st.progress >= 1) {
    st.done = true;
    ch.current++;
    emit(s, { type: 'choreStep', kind: st.id, x: st.x, y: st.y });
    note(s, 'chore-one-thumb');
    if (choreDone(ch)) emit(s, { type: 'choreDone' });
  }
}

/** The keyboard walk: undo the last completed step */
export function undoChoreStep(s: MomentState) {
  const ch = s.chore;
  if (!ch || ch.hoover || ch.current === 0) return;
  ch.current--;
  const st = ch.steps[ch.current];
  st.done = false;
  st.progress = 0;
  emit(s, { type: 'choreUndone', kind: st.id });
}

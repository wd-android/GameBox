import { PLACES, type PlaceDef, type Position } from '../content/places';
import type { MomentState, Pt, Rect, SimEvent } from './types';

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const inRect = (p: Pt, r?: Rect) => !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export function place(s: MomentState): PlaceDef {
  return PLACES[s.def.place];
}

export function position(s: MomentState, name: string): Position {
  const p = place(s).positions[name];
  return p ?? place(s).positions.near;
}

export function emit(s: MomentState, e: SimEvent) {
  s.events.push(e);
}

/** Field notes are unlocked the first time the player meets what they describe */
export function note(s: MomentState, id: string) {
  if (!s.tally.notes.includes(id)) s.tally.notes.push(id);
}

/** Distance from a point to a polyline */
export function distToPath(p: Pt, path: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

export function pathLength(path: Pt[]) {
  let l = 0;
  for (let i = 0; i < path.length - 1; i++) l += dist(path[i], path[i + 1]);
  return l;
}

/** Point at distance `s` along a polyline */
export function pointAt(path: Pt[], s: number): Pt {
  let left = s;
  for (let i = 0; i < path.length - 1; i++) {
    const l = dist(path[i], path[i + 1]);
    if (left <= l) {
      const t = l ? left / l : 0;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * t, y: path[i].y + (path[i + 1].y - path[i].y) * t };
    }
    left -= l;
  }
  return path[path.length - 1];
}

/** Projection of a point on a polyline, as a distance along it, searching only between lo and hi */
export function projectOnPath(path: Pt[], p: Pt, lo: number, hi: number): number {
  let best = lo, bd = Infinity, acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const l = dist(a, b);
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (l * l || 1), 0, 1);
    const sAt = acc + t * l;
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = dist(p, q);
    if (sAt >= lo && sAt <= hi && d < bd) { bd = d; best = sAt; }
    acc += l;
  }
  return best;
}

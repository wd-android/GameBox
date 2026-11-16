import { TUNING } from '../config/tuning';
import { withReach2, type Holds, type Link, type PieceKind, type Puzzle, type Ramp, type Slot } from '../chain/model';

/**
 * Lays out runs of slots at standard spacing along lines and curves, and
 * joins them into forks, merges and ramps. Used by the generator, the
 * tutorial puzzles, the editor and the tests.
 */

export interface Pose {
  x: number;
  y: number;
  /** Heading in degrees (0 = +x, 90 = +y). */
  h: number;
}

const D2R = Math.PI / 180;

export function ahead(p: Pose, dist: number, turn = 0): Pose {
  const h = p.h + turn;
  return { x: p.x + Math.cos(h * D2R) * dist, y: p.y + Math.sin(h * D2R) * dist, h };
}

/** Samples a smooth curve through the points at arc-length spacing; returns poses with headings. */
export function samplePath(points: [number, number][], spacing: number, includeFirst = true): Pose[] {
  // Catmull-Rom densify.
  const dense: [number, number][] = [];
  const P = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), f(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]);
    }
  }
  dense.push(points[points.length - 1]);
  // Walk the dense polyline by arc length.
  const out: Pose[] = [];
  let target = includeFirst ? 0 : spacing;
  let travelled = 0;
  for (let i = 0; i < dense.length - 1; i++) {
    const [x0, y0] = dense[i];
    const [x1, y1] = dense[i + 1];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg === 0) continue;
    while (target <= travelled + seg + 1e-9) {
      const t = (target - travelled) / seg;
      out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, h: Math.atan2(y1 - y0, x1 - x0) / D2R });
      target += spacing;
    }
    travelled += seg;
  }
  // Headings: smooth from neighbours.
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)];
    const b = out[Math.min(out.length - 1, i + 1)];
    if (a !== b) out[i].h = Math.atan2(b.y - a.y, b.x - a.x) / D2R;
  }
  return out;
}

export class PuzzleBuilder {
  slots: Slot[] = [];
  links: Link[] = [];
  ramps: Ramp[] = [];
  readonly spacing: number;

  constructor(spacing: number = TUNING.SLOT_SPACING) {
    this.spacing = spacing;
  }

  add(p: Pose, holds: Holds = 'standard'): number {
    const id = this.slots.length;
    this.slots.push({ id, x: round(p.x), y: round(p.y), facing: round(normDeg(p.h)), holds });
    return id;
  }

  link(a: number, b: number): void {
    if (!this.links.some((l) => l.from === a && l.to === b)) this.links.push({ from: a, to: b, reach: 1 });
  }

  /** A run of slots at the given poses, each linked to the next. Returns the ids. */
  run(poses: Pose[], linkFrom?: number): number[] {
    const ids = poses.map((p) => this.add(p));
    if (linkFrom !== undefined && ids.length) this.link(linkFrom, ids[0]);
    for (let i = 0; i + 1 < ids.length; i++) this.link(ids[i], ids[i + 1]);
    return ids;
  }

  /** A straight run of `count` slots starting one spacing ahead of `from`. */
  straight(from: Pose, count: number, linkFrom?: number): number[] {
    const poses: Pose[] = [];
    let p = from;
    for (let i = 0; i < count; i++) {
      p = ahead(p, this.spacing);
      poses.push(p);
    }
    return this.run(poses, linkFrom);
  }

  /** A curved run through waypoints (the first waypoint is one spacing from the previous slot). */
  curve(points: [number, number][], linkFrom?: number): number[] {
    return this.run(samplePath(points, this.spacing), linkFrom);
  }

  pose(id: number): Pose {
    const s = this.slots[id];
    return { x: s.x, y: s.y, h: s.facing };
  }

  ramp(trigger: number, target: number, travelMs: number): void {
    const a = this.slots[trigger];
    const b = this.slots[target];
    this.ramps.push({ trigger, target, travelMs, path: [[round(a.x), round(a.y)], [round(b.x), round(b.y)]] });
  }

  setGaps(ids: number[]): void {
    for (const id of ids) this.slots[id].holds = 'gap';
  }

  /** Smallest distance between two slots that are not directly linked (layout check). */
  minClearance(): number {
    const linked = new Set(this.links.map((l) => `${Math.min(l.from, l.to)}-${Math.max(l.from, l.to)}`));
    let best = Infinity;
    for (let i = 0; i < this.slots.length; i++)
      for (let j = i + 1; j < this.slots.length; j++) {
        if (linked.has(`${i}-${j}`)) continue;
        const d = Math.hypot(this.slots[i].x - this.slots[j].x, this.slots[i].y - this.slots[j].y);
        if (d < best) best = d;
      }
    return best;
  }

  inBoard(margin = 0.35): boolean {
    return this.slots.every((s) => s.x >= margin && s.x <= TUNING.BOARD_W - margin && s.y >= margin && s.y <= TUNING.BOARD_H - margin);
  }

  build(id: string, start: number, flag: number, tray: PieceKind[], title?: string): Puzzle {
    return {
      id,
      difficulty: 0,
      board: { width: TUNING.BOARD_W, height: TUNING.BOARD_H },
      slots: this.slots.map((s) => ({ ...s })),
      links: withReach2(this.links),
      ramps: this.ramps.map((r) => ({ ...r, path: r.path.map((p) => [...p] as [number, number]) })),
      start,
      flag,
      tray,
      par: 0,
      ...(title ? { title } : {}),
    };
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

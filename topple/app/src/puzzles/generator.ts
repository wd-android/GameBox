import { TUNING } from '../config/tuning';
import type { PieceKind, Puzzle } from '../chain/model';
import { solve, type SolverReport } from '../chain/solver';
import { PuzzleBuilder, ahead, type Pose } from './builder';

/**
 * Proposes candidate puzzles from templates (§17: "a generator that proposes
 * candidate puzzles for a person to choose from"). Every candidate is laid
 * out with the builder and must pass the solver's acceptance rules (§6.3).
 */

export class Rand {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  }
}

export interface RouteOptions {
  routes: 2 | 3;
  tall: boolean;
  ramp: boolean;
  decoys: number;
  /** Extra gaps on the stem or tail, which every solution needs. */
  essential: number;
}

export interface Candidate {
  puzzle: Puzzle;
  report: SolverReport;
}

const MIN_CLEARANCE = 0.5;

function accept(b: PuzzleBuilder, puzzle: Puzzle): Candidate | null {
  if (!b.inBoard() || b.minClearance() < MIN_CLEARANCE || b.slots.length > TUNING.MAX_SLOTS) return null;
  const gaps = b.slots.filter((s) => s.holds === 'gap').length;
  if (gaps < TUNING.MIN_GAPS || gaps > TUNING.MAX_GAPS) return null;
  const report = solve(puzzle);
  if (!report.acceptable) return null;
  puzzle.par = report.par;
  return { puzzle, report };
}

/**
 * The main template: a stem that forks into two or three routes which merge
 * again below the flag. Routes need different numbers of pieces; dead-end
 * branches hold decoy gaps; a tall domino can bridge a pair of gaps; a ramp
 * can carry a ball from one route across to another.
 */
export function routesPuzzle(id: string, rng: Rand, o: RouteOptions): Candidate | null {
  const b = new PuzzleBuilder();
  const sp = b.spacing;
  const W = TUNING.BOARD_W;
  const sx = 4.5 + rng.int(-1, 1) * 0.4;
  const start = b.add({ x: sx, y: 0.9, h: 90 });
  const stemLen = rng.int(2, 4);
  const stem = b.straight(b.pose(start), stemLen, start);
  const F = stem[stem.length - 1];
  const fPose = b.pose(F);

  const offsets = o.routes === 2 ? [48, -48] : [52, 0, -52];
  const lanes = o.routes === 2 ? [1.7 + rng.next() * 0.6, W - 1.7 - rng.next() * 0.6] : [1.3 + rng.next() * 0.3, 4.5, W - 1.3 - rng.next() * 0.3];
  const my = 10.9 + rng.next() * 0.6;
  const mx = 4.5 + rng.int(-1, 1) * 0.3;
  const M: Pose = { x: mx, y: my, h: 90 };
  const routes: number[][] = [];
  for (let r = 0; r < o.routes; r++) {
    const first = ahead(fPose, sp, offsets[r]);
    const approach = ahead({ x: M.x, y: M.y, h: 270 }, sp, -offsets[r]);
    const lx = lanes[r];
    const pts: [number, number][] = [
      [first.x, first.y],
      [lx, first.y + 1.7 + rng.next() * 0.6],
      [lx + (rng.next() - 0.5) * 0.6, (first.y + approach.y) / 2],
      [lx, approach.y - 1.6 - rng.next() * 0.5],
      [approach.x, approach.y],
    ];
    routes.push(b.curve(pts, F));
  }
  // Merge slot, then the tail up to the flag.
  const mId = b.add(M);
  for (const r of routes) b.link(r[r.length - 1], mId);
  const tail = b.straight(M, rng.int(1, 3), mId);
  const flag = tail[tail.length - 1];

  // Ramp: one route is cut short at a trigger; a ball crosses to another route.
  let rampInfo: { trigger: number; target: number; from: number; to: number } | null = null;
  if (o.ramp) {
    const from = rng.int(0, o.routes - 1);
    let to = rng.int(0, o.routes - 2);
    if (to >= from) to++;
    const rf = routes[from];
    const cut = Math.floor(rf.length * (0.35 + rng.next() * 0.2));
    // Unlink the rest of the cut route from the trigger onwards.
    const trigger = rf[cut];
    b.links = b.links.filter((l) => l.from !== trigger);
    const rt = routes[to];
    const target = rt[Math.floor(rt.length * (0.6 + rng.next() * 0.2))];
    const dist = Math.hypot(b.slots[trigger].x - b.slots[target].x, b.slots[trigger].y - b.slots[target].y);
    b.ramp(trigger, target, Math.round(500 + dist * 180));
    rampInfo = { trigger, target, from, to };
    // The part after the trigger is now a separate dead stretch: keep it as decoy ground.
  }

  // Decoy branches off the routes, heading outwards.
  const decoyBranches: number[][] = [];
  for (let d = 0; d < o.decoys; d++) {
    const r = rng.int(0, o.routes - 1);
    const route = routes[r];
    if (route.length < 6) continue;
    const at = route[rng.int(2, route.length - 4)];
    const p = b.pose(at);
    const outward = b.slots[at].x < 4.5 ? 1 : -1;
    const dir = (p.h > 90 ? -1 : 1) * outward;
    const turn = dir * (50 + rng.int(0, 10));
    const len = rng.int(2, 4);
    const poses: Pose[] = [];
    let q = ahead(p, sp, turn);
    poses.push(q);
    for (let i = 1; i < len; i++) {
      q = ahead(q, sp, -turn * 0.25);
      poses.push(q);
    }
    decoyBranches.push(b.run(poses, at));
  }

  // Gaps.
  const gaps: number[] = [];
  const need: number[] = [];
  const order = rng.shuffle([...routes.keys()]);
  const counts = order.map((_, i) => Math.min(3, 1 + i + (rng.chance(0.3) ? 1 : 0)));
  order.forEach((r, i) => {
    const route = routes[r];
    let usable = route.slice(1, -1);
    if (rampInfo && r === rampInfo.from) usable = route.slice(1, route.indexOf(rampInfo.trigger));
    if (rampInfo && r === rampInfo.to) usable = route.slice(1, -1);
    const k = Math.min(counts[i], Math.max(0, usable.length - 1));
    const tallPair = o.tall && i === 0 && usable.length > 4;
    if (tallPair) {
      const at = rng.int(0, usable.length - 3);
      gaps.push(usable[at], usable[at + 1]);
    } else {
      const picks = rng.shuffle([...usable]).slice(0, k);
      gaps.push(...picks);
    }
    need.push(k);
  });
  for (const br of decoyBranches) gaps.push(...rng.shuffle([...br]).slice(0, rng.int(1, Math.min(2, br.length))));
  const essentialPool = [...stem.slice(0, -1).filter((s) => s !== start), ...tail.slice(0, -1)];
  gaps.push(...rng.shuffle(essentialPool).slice(0, o.essential));
  b.setGaps([...new Set(gaps)].filter((g) => g !== start && g !== flag && g !== F && g !== mId));

  const tray: PieceKind[] = o.tall ? ['standard', 'standard', 'tall'] : ['standard', 'standard', 'standard'];
  return accept(b, b.build(id, start, flag, tray));
}

/**
 * The monthly special (§9.1): a long serpentine run of 120–150 dominoes with
 * a long payoff, and a tempting short cut up the side that needs more pieces.
 */
export function specialPuzzle(id: string, rng: Rand): Candidate | null {
  const b = new PuzzleBuilder();
  const sp = b.spacing;
  const start = b.add({ x: 1.5, y: 0.7, h: 90 });
  const stem = b.straight(b.pose(start), 1, start);
  const F = stem[0];
  const fp = b.pose(F);
  // Snake: rows across the board, U-turns at the ends.
  const rowGap = 0.95 + rng.next() * 0.1;
  const xL = 2.0;
  const xR = TUNING.BOARD_W - 0.6;
  const pts: [number, number][] = [];
  const first = ahead(fp, sp, -55);
  pts.push([first.x, first.y]);
  let y = first.y + 0.25;
  let right = true;
  while (y + rowGap < TUNING.BOARD_H - 1.4) {
    pts.push(right ? [xR - 0.5, y] : [xL + 0.5, y]);
    pts.push(right ? [xR, y + rowGap / 2] : [xL, y + rowGap / 2]);
    pts.push(right ? [xR - 0.5, y + rowGap] : [xL + 0.5, y + rowGap]);
    y += rowGap;
    right = !right;
  }
  const flagPose: Pose = { x: 1.2, y: TUNING.BOARD_H - 0.7, h: 135 };
  pts.push([2.4, TUNING.BOARD_H - 1.1]);
  const snake = b.curve(pts, F);
  // Side short cut up the left margin.
  const side = b.curve([
    [ahead(fp, sp, 30).x, ahead(fp, sp, 30).y],
    [0.6, 2.4],
    [0.6, TUNING.BOARD_H - 2.6],
    [0.75, TUNING.BOARD_H - 1.5],
  ], F);
  const flag = b.add(flagPose);
  b.link(snake[snake.length - 1], flag);
  b.link(side[side.length - 1], flag);
  if (b.slots.length < TUNING.SPECIAL_MIN_SLOTS || b.slots.length > TUNING.SPECIAL_MAX_SLOTS) return null;

  const snakeGaps = rng.shuffle(snake.slice(3, -3)).slice(0, 2);
  const sideGaps = rng.shuffle(side.slice(2, -2)).slice(0, 3);
  const extra = rng.shuffle(snake.slice(3, -3).filter((s) => !snakeGaps.includes(s))).slice(0, rng.int(0, 1));
  b.setGaps([...snakeGaps, ...sideGaps, ...extra]);
  return accept(b, b.build(id, start, flag, ['standard', 'standard', 'standard'], 'Monthly special'));
}

/** First-launch puzzles (§12): one gap and one domino; then two gaps (one on a dead end) and one domino. */
export function tutorialPuzzles(): Puzzle[] {
  const a = new PuzzleBuilder();
  const s0 = a.add({ x: 4.5, y: 2.5, h: 90 });
  const run = a.straight(a.pose(s0), 9, s0);
  a.setGaps([run[4]]);
  const t1 = a.build('tutorial-1', s0, run[run.length - 1], ['standard'], 'Fill the gap');
  t1.par = solve(t1).par;

  const b = new PuzzleBuilder();
  const start = b.add({ x: 4.5, y: 1.8, h: 90 });
  const stem = b.straight(b.pose(start), 3, start);
  const F = stem[2];
  const main = b.curve(
    [
      [ahead(b.pose(F), b.spacing, 35).x, ahead(b.pose(F), b.spacing, 35).y],
      [3.4, 6.5],
      [3.6, 9.5],
      [4.2, 11.6],
    ],
    F,
  );
  const deadEnd = b.curve(
    [
      [ahead(b.pose(F), b.spacing, -40).x, ahead(b.pose(F), b.spacing, -40).y],
      [6.4, 5.5],
      [6.8, 7.4],
    ],
    F,
  );
  b.setGaps([main[4], deadEnd[2]]);
  const t2 = b.build('tutorial-2', start, main[main.length - 1], ['standard'], 'Which gap?');
  t2.par = solve(t2).par;
  return [t1, t2];
}

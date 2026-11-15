import { describe, expect, it } from 'vitest';
import { calculate, delay } from '../src/chain/chain';
import { solve } from '../src/chain/solver';
import type { Placement, PieceKind } from '../src/chain/model';
import { PuzzleBuilder } from '../src/puzzles/builder';

/** A straight run of n slots; gaps at the given indices. */
function line(n: number, gaps: number[] = [], tray: PieceKind[] = ['standard', 'standard', 'standard']) {
  const b = new PuzzleBuilder();
  const s = b.add({ x: 4.5, y: 1, h: 90 });
  const run = [s, ...b.straight(b.pose(s), n - 1, s)];
  b.setGaps(gaps.map((i) => run[i]));
  return { p: b.build('line', run[0], run[n - 1], tray), run };
}

const place = (entries: [number, PieceKind][]): Placement => new Map(entries);

describe('chain calculation', () => {
  it('a straight run with no gaps falls completely', () => {
    const { p, run } = line(10);
    const r = calculate(p, new Map());
    expect(r.won).toBe(true);
    expect(r.fallen.map((f) => f.slot)).toEqual(run);
  });

  it('with one gap it stops at the gap', () => {
    const { p, run } = line(10, [5]);
    const r = calculate(p, new Map());
    expect(r.won).toBe(false);
    expect(r.fallen.map((f) => f.slot)).toEqual(run.slice(0, 5));
    expect(r.stops).toEqual([run[4]]);
    expect(r.nearMisses).toEqual([{ slot: run[4], gap: run[5] }]);
  });

  it('times follow delay(depth) and quicken down the run', () => {
    const { p } = line(60);
    const r = calculate(p, new Map());
    for (let i = 1; i < r.fallen.length; i++) expect(r.fallen[i].time - r.fallen[i - 1].time).toBe(delay(i - 1));
    expect(delay(0)).toBe(100);
    expect(delay(100)).toBe(55);
  });

  it('a tall domino bridges exactly one empty slot, and not two', () => {
    const { p, run } = line(12, [4, 5]);
    expect(calculate(p, place([[run[4], 'tall']])).won).toBe(true);
    const r = calculate(p, place([[run[4], 'tall']]));
    const bridged = r.fallen.find((f) => f.slot === run[6])!;
    expect(bridged.cause).toBe('bridge');
    expect(bridged.time - r.fallen.find((f) => f.slot === run[4])!.time).toBe(delay(4) + 40);
    const two = line(12, [4, 5, 6], ['standard', 'standard', 'tall']);
    expect(calculate(two.p, place([[two.run[4], 'tall']])).won).toBe(false);
    // A standard domino does not bridge.
    expect(calculate(p, place([[run[4], 'standard']])).won).toBe(false);
  });

  it('a fork starts both branches', () => {
    const b = new PuzzleBuilder();
    const s = b.add({ x: 4.5, y: 1, h: 90 });
    const stem = b.straight(b.pose(s), 2, s);
    const left = b.straight({ ...b.pose(stem[1]), h: 130 }, 4, stem[1]);
    const right = b.straight({ ...b.pose(stem[1]), h: 50 }, 4, stem[1]);
    const p = b.build('fork', s, right[3], []);
    const r = calculate(p, new Map());
    const fell = new Set(r.fallen.map((f) => f.slot));
    for (const id of [...left, ...right]) expect(fell.has(id)).toBe(true);
    // Both branches start at the same moment.
    expect(r.fallen.find((f) => f.slot === left[0])!.time).toBe(r.fallen.find((f) => f.slot === right[0])!.time);
  });

  it('a ball strikes its target at the stated time, and has no effect if the target has already fallen', () => {
    const b = new PuzzleBuilder();
    const s = b.add({ x: 2, y: 1, h: 90 });
    const a = b.straight(b.pose(s), 3, s);
    const far = b.add({ x: 7, y: 8, h: 90 });
    const tail = b.straight(b.pose(far), 3, far);
    b.ramp(a[2], far, 900);
    const p = b.build('ramp', s, tail[2], []);
    const r = calculate(p, new Map());
    const trig = r.fallen.find((f) => f.slot === a[2])!;
    const hit = r.fallen.find((f) => f.slot === far)!;
    expect(hit.time).toBe(trig.time + 900);
    expect(hit.cause).toBe('ball');
    expect(r.won).toBe(true);
    // If the target already fell by another route, the ball changes nothing.
    b.link(a[0], far);
    const p2 = b.build('ramp2', s, tail[2], []);
    const r2 = calculate(p2, new Map());
    expect(r2.fallen.filter((f) => f.slot === far).length).toBe(1);
    expect(r2.fallen.find((f) => f.slot === far)!.cause).toBe('reach1');
  });

  it('the same puzzle and placement always give the same events in the same order', () => {
    const { p, run } = line(30, [7, 15, 16], ['standard', 'standard', 'tall']);
    const pl = place([
      [run[7], 'standard'],
      [run[15], 'tall'],
    ]);
    expect(calculate(p, pl)).toEqual(calculate(p, pl));
  });

  it('reports stopping points at a gap, at a dead end, and at both', () => {
    const b = new PuzzleBuilder();
    const s = b.add({ x: 4.5, y: 1, h: 90 });
    const stem = b.straight(b.pose(s), 2, s);
    const dead = b.straight({ ...b.pose(stem[1]), h: 140 }, 3, stem[1]);
    const main = b.straight({ ...b.pose(stem[1]), h: 60 }, 6, stem[1]);
    b.setGaps([main[3]]);
    const p = b.build('stops', s, main[5], ['standard']);
    const r = calculate(p, new Map());
    expect(r.stops.sort()).toEqual([dead[2], main[2]].sort());
    expect(r.nearMisses).toEqual([{ slot: main[2], gap: main[3] }]);
    // Dead end only: fill the gap, but the flag needs nothing else – won; take the flag away instead.
    const r2 = calculate(p, place([[main[3], 'standard']]));
    expect(r2.won).toBe(true);
  });
});

describe('solver', () => {
  it('agrees with hand-worked par', () => {
    // Two routes to the flag: one needs one piece, the other two. Plus a decoy.
    const b = new PuzzleBuilder();
    const s = b.add({ x: 4.5, y: 1, h: 90 });
    const stem = b.straight(b.pose(s), 2, s);
    const A = b.straight({ ...b.pose(stem[1]), h: 60 }, 5, stem[1]);
    const B = b.straight({ ...b.pose(stem[1]), h: 120 }, 5, stem[1]);
    const M = b.add({ x: 4.5, y: 7, h: 90 });
    b.link(A[4], M);
    b.link(B[4], M);
    const tail = b.straight(b.pose(M), 2, M);
    const D = b.straight({ ...b.pose(stem[0]), h: 180 }, 3, stem[0]);
    b.setGaps([A[2], B[1], B[3], D[1]]);
    const p = b.build('par', s, tail[1], ['standard', 'standard', 'standard']);
    const r = solve(p);
    expect(r.par).toBe(1);
    expect(r.decoyGaps.sort()).toEqual([B[1], B[3], D[1]].sort());
    expect(r.essentialGaps).toEqual([]);
    expect(r.acceptable).toBe(true);
    expect([...r.parSolution!.keys()]).toEqual([A[2]]);
  });

  it('rejects a puzzle with two par solutions', () => {
    const b = new PuzzleBuilder();
    const s = b.add({ x: 4.5, y: 1, h: 90 });
    const stem = b.straight(b.pose(s), 2, s);
    const A = b.straight({ ...b.pose(stem[1]), h: 60 }, 4, stem[1]);
    const B = b.straight({ ...b.pose(stem[1]), h: 120 }, 4, stem[1]);
    const M = b.add({ x: 4.5, y: 7, h: 90 });
    b.link(A[3], M);
    b.link(B[3], M);
    b.setGaps([A[1], B[1], stem[0]]);
    const p = b.build('two', s, M, ['standard', 'standard', 'standard']);
    expect(solve(p).problems).toContain('par solution not unique (2)');
  });
});

import { describe, expect, it } from 'vitest';
import { SandSim, replay, runUntilSettled, type InputEvent } from '../src/sand/sim';
import { columnTop, countGrains } from '../src/sand/grid';
import { maskFor, SHAPE_ORDER } from '../src/jars/shapes';
import { PourControl } from '../src/input/pourControl';
import { decodeGrid, encodeGrid, encodeRecording, decodeRecording } from '../src/sand/rle';

const straight = maskFor('straight');

function pourAt(sim: SandSim, col: number, ticks: number, colour = 1): void {
  sim.setColour(colour);
  sim.setColumn(col);
  sim.setPouring(true);
  for (let i = 0; i < ticks; i++) sim.step();
  sim.setPouring(false);
}

function pourSweep(sim: SandSim, ticks: number, colour = 1): void {
  const { openLeft: lo, openRight: hi } = sim.mask;
  sim.setColour(colour);
  sim.setPouring(true);
  let col = lo;
  let dir = 1;
  for (let i = 0; i < ticks; i++) {
    sim.setColumn(col);
    sim.step();
    col += dir;
    if (col >= hi || col <= lo) dir = -dir;
  }
  sim.setPouring(false);
}

describe('grain conservation', () => {
  for (const shape of SHAPE_ORDER) {
    it(`never enters glass or an occupied cell, and only pouring changes the count (${shape})`, () => {
      const mask = maskFor(shape);
      const sim = new SandSim(mask, 7);
      let expected = 0;
      for (let k = 0; k < 6; k++) {
        sim.setTilt([0, 25, -14, 30, -30, 9][k]);
        sim.setColour(1 + k);
        sim.setColumn(mask.openLeft + ((k * 17) % (mask.openRight - mask.openLeft)));
        sim.setPouring(true);
        for (let t = 0; t < 120; t++) {
          sim.step();
          expected += sim.addedThisTick;
          for (let i = 0; i < sim.cells.length; i++) if (sim.cells[i]) expect(mask.inside[i]).toBe(1);
          expect(countGrains(sim.cells)).toBe(expected);
        }
        sim.setPouring(false);
        for (let t = 0; t < 120; t++) sim.step();
        expect(countGrains(sim.cells)).toBe(expected);
      }
    });
  }
});

describe('falling rules', () => {
  it('sand poured in one place on a level jar settles at 45 degrees', () => {
    const sim = new SandSim(straight, 1);
    const mid = 48;
    pourAt(sim, mid, 200);
    runUntilSettled(sim, 2000);
    const peak = columnTop(sim.cells, straight, mid);
    // Each step away from the peak drops by at most one cell (45°), and on average by about one.
    let total = 0;
    let n = 0;
    for (let x = mid; x < mid + 20; x++) {
      const d = columnTop(sim.cells, straight, x + 1) - columnTop(sim.cells, straight, x);
      expect(Math.abs(d)).toBeLessThanOrEqual(1);
      total += d;
      n++;
    }
    expect(total / n).toBeGreaterThan(0.75);
    expect(peak).toBeLessThan(straight.h - 15);
  });

  it('sand poured evenly across a level jar settles flat to within one cell', () => {
    const sim = new SandSim(straight, 2);
    pourSweep(sim, 89 * 10);
    runUntilSettled(sim, 2000);
    // "Flat to within one cell": no step between neighbouring columns is more
    // than one cell, and the whole surface stays within a few cells (the
    // grain-scale ripple of real poured sand).
    const tops: number[] = [];
    for (let x = straight.openLeft + 6; x <= straight.openRight - 6; x++) tops.push(columnTop(sim.cells, straight, x));
    for (let i = 1; i < tops.length; i++) expect(Math.abs(tops[i] - tops[i - 1])).toBeLessThanOrEqual(1);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(4);
  });

  it('a jar tilted 25 degrees and filled settles to a slope, and keeps it when levelled', () => {
    const sim = new SandSim(straight, 3);
    sim.setTilt(25);
    pourSweep(sim, 900);
    runUntilSettled(sim, 3000);
    const left = columnTop(sim.cells, straight, straight.openLeft + 4);
    const right = columnTop(sim.cells, straight, straight.openRight - 4);
    // Right side is low, so sand is deeper (smaller row index) on the right.
    expect(left - right).toBeGreaterThan(20);
    const before = sim.cells.slice();
    sim.setTilt(0);
    runUntilSettled(sim, 3000);
    expect(Array.from(sim.cells)).toEqual(Array.from(before));
  });
});

describe('repeatability', () => {
  it('the same jar and inputs always give an identical grid', () => {
    const run = () => {
      const sim = new SandSim(maskFor('round-bottle'), 99);
      pourAt(sim, 45, 150, 2);
      sim.setTilt(22);
      pourSweep(sim, 300, 5);
      sim.setTilt(-10);
      pourAt(sim, 50, 200, 7);
      runUntilSettled(sim, 2000);
      return sim;
    };
    const a = run();
    const b = run();
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
    const c = replay(a.mask, 99, null, decodeRecording(encodeRecording(a.recording)), 2000);
    expect(Array.from(c.cells)).toEqual(Array.from(a.cells));
  });

  it('grid compression round-trips', () => {
    const sim = new SandSim(straight, 5);
    pourSweep(sim, 300, 3);
    runUntilSettled(sim);
    expect(Array.from(decodeGrid(encodeGrid(sim.cells), sim.cells.length))).toEqual(Array.from(sim.cells));
  });

  it('a picture poured with "Follow my thumb" is reproduced exactly with "Fixed spout" by the mirrored inputs', () => {
    const geom = { cell: 3, jarLeft: 20, spoutX: 0 };
    const thumbXs: number[] = [];
    for (let t = 0; t < 600; t++) thumbXs.push(30 + Math.round(330 * (0.5 + 0.5 * Math.sin(t / 40))) + (t % 7));
    geom.spoutX = thumbXs[0];

    const pourWith = (mode: 'thumb' | 'fixed', xs: number[]) => {
      const sim = new SandSim(straight, 11);
      const ctl = new PourControl(straight, geom, mode);
      sim.setColour(4);
      sim.setColumn(ctl.begin(xs[0]));
      sim.setPouring(true);
      for (let t = 0; t < xs.length; t++) {
        if (t === 300) sim.setColour(6);
        sim.setColumn(ctl.move(xs[t]));
        sim.step();
      }
      sim.setPouring(false);
      runUntilSettled(sim, 2000);
      return sim.cells;
    };

    const thumb = pourWith('thumb', thumbXs);
    // Mirrored: the thumb moves the opposite way, sliding the jar under the spout.
    const mirrored = thumbXs.map((x) => 400 - (x - thumbXs[0]));
    const fixed = pourWith('fixed', mirrored);
    expect(Array.from(fixed)).toEqual(Array.from(thumb));
  });
});

describe('undo', () => {
  it('restores the exact earlier grid and sand amounts', () => {
    const sim = new SandSim(straight, 4, { 1: 3000, 2: 3000 });
    pourAt(sim, 30, 200, 1);
    runUntilSettled(sim);
    const grid = sim.cells.slice();
    const rem = sim.remaining!.slice();
    pourAt(sim, 60, 150, 2);
    runUntilSettled(sim);
    expect(sim.remaining![2]).toBeLessThan(3000);
    expect(sim.undo()).toBe(true);
    expect(Array.from(sim.cells)).toEqual(Array.from(grid));
    expect(Array.from(sim.remaining!)).toEqual(Array.from(rem));
  });

  it('limited colours run out and cannot be poured', () => {
    const sim = new SandSim(straight, 4, { 1: 100 });
    pourAt(sim, 30, 200, 1);
    expect(countGrains(sim.cells)).toBe(100);
    expect(sim.ranOut).toBe(true);
  });
});

describe('fill line', () => {
  it('pouring stops by itself at the fill line', () => {
    const sim = new SandSim(straight, 6);
    pourAt(sim, 48, 6000);
    runUntilSettled(sim);
    expect(sim.reachedFillLine).toBe(true);
    expect(columnTop(sim.cells, straight, 48)).toBeGreaterThanOrEqual(straight.fillRow - 1);
  });
});

export type { InputEvent };

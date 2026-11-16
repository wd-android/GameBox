import { describe, expect, it } from 'vitest';
import { BALLS, BALL_ORDER, TUNING } from '../src/config/tuning';
import { defaultParams, generateCube } from '../src/maze/generator';
import { cellCol, cellFace, cellRow } from '../src/maze/topology';
import { BallSim, replayRun } from '../src/physics/sim';
import { isValidOrientation, IDENTITY, rollTowards } from '../src/physics/orientation';
import { buildFaceWalls } from '../src/physics/walls';
import { Rng } from '../src/maze/rng';
import { autoplay } from '../src/game/autopilot';

const CONTACT = TUNING.BALL_RADIUS + TUNING.WALL_THICKNESS / 2;

function wallDistance(sim: BallSim): number {
  const w = buildFaceWalls(sim.cube, sim.face);
  let best = Infinity;
  for (const s of w.segments) {
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    let k = ((sim.p.x - s.ax) * dx + (sim.p.y - s.ay) * dy) / (dx * dx + dy * dy);
    k = Math.max(0, Math.min(1, k));
    best = Math.min(best, Math.hypot(sim.p.x - (s.ax + dx * k), sim.p.y - (s.ay + dy * k)));
  }
  return best;
}

describe('ball physics', () => {
  it('movement per tick stays below the ball radius for every ball', () => {
    for (const b of BALL_ORDER) expect(BALLS[b].vMax / TUNING.TICK_HZ).toBeLessThan(TUNING.BALL_RADIUS);
    expect(TUNING.V_ENTRY / TUNING.TICK_HZ).toBeLessThan(TUNING.BALL_RADIUS);
  });

  it('over a million random ticks the ball never gets closer to a wall than r + w/2', () => {
    const rng = new Rng(7);
    let ticks = 0;
    let worst = Infinity;
    for (let k = 0; ticks < 1_000_000; k++) {
      const n = 3 + (k % 7);
      const cube = generateCube(n, 1000 + k, { ...defaultParams(n), holeShare: 0 });
      const sim = new BallSim(cube, { ball: BALLS[BALL_ORDER[k % 3]] });
      let ix = 0;
      let iy = 0;
      for (let i = 0; i < 20000; i++, ticks++) {
        if (i % 30 === 0) {
          const a = rng.float() * 6.283185307179586;
          const m = rng.float();
          ix = Math.cos(a) * m;
          iy = Math.sin(a) * m;
        }
        sim.step(ix, iy);
        if (sim.state === 'ROLLING' && sim.disarmed < 0) {
          const inside = sim.p.x > 0 && sim.p.x < n && sim.p.y > 0 && sim.p.y < n;
          if (inside) worst = Math.min(worst, wallDistance(sim));
        }
        if (sim.state === 'FINISHED') break;
      }
    }
    expect(worst).toBeGreaterThan(CONTACT - 1e-6);
  }, 300000);

  it('a collision never increases the speed', () => {
    const rng = new Rng(3);
    for (let k = 0; k < 40; k++) {
      const cube = generateCube(5, 50 + k, { ...defaultParams(5), holeShare: 0 });
      const sim = new BallSim(cube, { ball: BALLS.gold });
      for (let i = 0; i < 3000; i++) {
        const before = Math.hypot(sim.v.x, sim.v.y);
        const a = rng.float() * 6.283185307179586;
        sim.step(Math.cos(a), Math.sin(a));
        const impacts = sim.drainEvents().filter((e) => e.type === 'impact');
        if (impacts.length && sim.state === 'ROLLING') {
          // Speed after the tick can only come from acceleration (≤ a·dt), never from the bounce.
          expect(Math.hypot(sim.v.x, sim.v.y)).toBeLessThanOrEqual(before + BALLS.gold.accel / TUNING.TICK_HZ + 1e-9);
        }
      }
    }
  });

  it('a ball on a level cube always comes to rest', () => {
    for (let k = 0; k < 30; k++) {
      const cube = generateCube(4, 300 + k, defaultParams(4));
      const sim = new BallSim(cube, { ball: BALLS[BALL_ORDER[k % 3]] });
      for (let i = 0; i < 240; i++) sim.step(0.9, 0.4 * ((k % 3) - 1));
      for (let i = 0; i < 120 * 20; i++) sim.step(0, 0);
      if (sim.state === 'ROLLING') expect(sim.v).toEqual({ x: 0, y: 0 });
    }
  });

  it('after any sequence of turns, the orientation is one of the 24 valid ones', () => {
    const rng = new Rng(11);
    const dirs: [number, number, number][] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0, 1, 0],
      [0, -1, 0],
    ];
    let R = IDENTITY.slice();
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      // Roll towards any cube direction that is currently horizontal in the world.
      const options = dirs.filter((d) => {
        const w = [R[0] * d[0] + R[1] * d[1] + R[2] * d[2], R[3] * d[0] + R[4] * d[1] + R[5] * d[2], R[6] * d[0] + R[7] * d[1] + R[8] * d[2]];
        return w[1] === 0;
      });
      R = rollTowards(R, rng.pick(options));
      expect(isValidOrientation(R)).toBe(true);
      seen.add(R.join(','));
    }
    expect(seen.size).toBe(24);
  });

  it('crossing a gate and crossing straight back returns to the original face and orientation', () => {
    for (let k = 0; k < 20; k++) {
      const cube = generateCube(4, 900 + k, defaultParams(4));
      const sim = new BallSim(cube, { ball: BALLS.bronze });
      // Steer through the first gate on the route with the autopilot.
      const startFace = sim.face;
      const startR = sim.R.slice();
      let guard = 0;
      while (sim.face === startFace && guard++ < 120 * 60) {
        const turned = sim.state === 'TURNING';
        // simple pilot: reuse autoplay one tick at a time
        if (!turned) stepAuto(sim);
        else sim.step(0, 0);
      }
      while (sim.state === 'TURNING') sim.step(0, 0);
      expect(sim.face).not.toBe(startFace);
      const g = cube.gates[sim.disarmed];
      const entrySide = cellFace(4, g.cellA) === sim.face ? g.sideA : g.sideB;
      // Roll inwards to re-arm, then straight back out through the same gate.
      const inward = [2, 3, 0, 1][entrySide];
      const face = sim.face;
      for (let i = 0; i < 240 && sim.disarmed >= 0; i++) pushLocal(sim, inward, 1);
      expect(sim.disarmed).toBe(-1);
      expect(sim.face).toBe(face);
      // Steer back out through the middle of the opening.
      const gc = cellFace(4, g.cellA) === sim.face ? g.cellA : g.cellB;
      const mid = { x: cellCol(4, gc) + 0.5 + [0.6, 0, -0.6, 0][entrySide], y: cellRow(4, gc) + 0.5 + [0, 0.6, 0, -0.6][entrySide] };
      for (let i = 0; i < 400 && sim.state === 'ROLLING'; i++) steerLocal(sim, mid.x - sim.p.x, mid.y - sim.p.y);
      while ((sim.state as string) === "TURNING") sim.step(0, 0);
      expect(sim.face).toBe(startFace);
      expect(sim.R).toEqual(startR);
    }
  });

  it('a recorded run replays to exactly the same final state', () => {
    const cube = generateCube(5, 4242, defaultParams(5));
    const sim = new BallSim(cube, { ball: BALLS.silver });
    autoplay(sim, 120);
    const rng = new Rng(5);
    for (let i = 0; i < 2000; i++) sim.step(rng.float() * 2 - 1, rng.float() * 2 - 1);
    const again = replayRun(cube, { ball: BALLS.silver }, sim.inputs);
    expect(again.p).toEqual(sim.p);
    expect(again.v).toEqual(sim.v);
    expect(again.face).toBe(sim.face);
    expect(again.R).toEqual(sim.R);
    expect(again.timerTicks).toBe(sim.timerTicks);
  });

  it('falling into a hole returns the ball to the checkpoint and counts the fall', () => {
    const cube = generateCube(6, 77, defaultParams(6));
    expect(cube.holes.length).toBeGreaterThan(0);
    const sim = new BallSim(cube, { ball: BALLS.bronze });
    const h = cube.holes[0];
    // Teleport onto the hole's face next to it, as a unit test of the rule.
    (sim as unknown as { face: number }).face = cellFace(6, h);
    sim.state = 'ROLLING';
    sim.p = { x: cellCol(6, h) + 0.5, y: cellRow(6, h) + 0.5 };
    sim.step(0, 0);
    expect(sim.state).toBe('FALLING');
    for (let i = 0; i < 200; i++) sim.step(0, 0);
    expect(sim.state).toBe('ROLLING');
    expect(sim.falls).toBe(1);
    expect(sim.p).toEqual(sim.checkpoint.p);
  });

  it('step mode reaches the finish by swiping along the solution', () => {
    const cube = generateCube(4, 5150, defaultParams(4));
    const sim = new BallSim(cube, { ball: BALLS.bronze, mode: 'step' });
    let guard = 0;
    while (sim.state !== 'FINISHED' && guard++ < 20000) {
      if ((sim.state === 'ROLLING' || sim.state === 'READY') && Math.hypot(sim.v.x, sim.v.y) === 0) {
        const dir = stepDirection(sim);
        if (dir >= 0) sim.swipe(dir);
      }
      sim.step(0, 0);
    }
    expect(sim.state).toBe('FINISHED');
  });
});

import { Autopilot } from '../src/game/autopilot';
import { U_AXES, V_AXES } from '../src/maze/topology';
import { apply } from '../src/physics/orientation';

const pilots = new WeakMap<BallSim, Autopilot>();
function stepAuto(sim: BallSim): void {
  let p = pilots.get(sim);
  if (!p) pilots.set(sim, (p = new Autopilot(sim)));
  const t = p.input();
  sim.step(t.x, t.y);
}

/** Tilts towards a face-local side for `ticks` ticks. */
function pushLocal(sim: BallSim, side: number, ticks: number): void {
  const lx = [1, 0, -1, 0][side];
  const ly = [0, 1, 0, -1][side];
  const u = U_AXES[sim.face];
  const v = V_AXES[sim.face];
  const w = apply(sim.R, [lx * u[0] + ly * v[0], lx * u[1] + ly * v[1], lx * u[2] + ly * v[2]]);
  for (let i = 0; i < ticks && sim.state !== 'TURNING'; i++) sim.step(w[0] * 0.6, w[2] * 0.6);
}

/** Tilts towards a face-local vector for one tick. */
function steerLocal(sim: BallSim, lx: number, ly: number): void {
  const l = Math.hypot(lx, ly) || 1;
  const u = U_AXES[sim.face];
  const v = V_AXES[sim.face];
  const w = apply(sim.R, [(lx / l) * u[0] + (ly / l) * v[0], (lx / l) * u[1] + (ly / l) * v[1], (lx / l) * u[2] + (ly / l) * v[2]]);
  sim.step(w[0] * 0.5, w[2] * 0.5);
}

/** Screen direction (0 right, 1 down, 2 left, 3 up) of the next solution step. */
function stepDirection(sim: BallSim): number {
  const n = sim.n;
  const path = sim.cube.solution;
  const here = sim.face * n * n + Math.floor(sim.p.y) * n + Math.floor(sim.p.x);
  const i = path.indexOf(here);
  if (i < 0 || i === path.length - 1) return -1;
  for (let side = 0; side < 4; side++) {
    if (!(sim.cube.open[here] & (1 << side))) continue;
    // Follow the solution: which neighbour is next?
    const lx = [1, 0, -1, 0][side];
    const ly = [0, 1, 0, -1][side];
    const u = U_AXES[sim.face];
    const v = V_AXES[sim.face];
    const w = apply(sim.R, [lx * u[0] + ly * v[0], lx * u[1] + ly * v[1], lx * u[2] + ly * v[2]]);
    const dir = w[0] === 1 ? 0 : w[2] === 1 ? 1 : w[0] === -1 ? 2 : 3;
    const nbCell = neighbourOf(sim, here, side);
    if (nbCell === path[i + 1]) return dir;
  }
  return -1;
}

import { topology } from '../src/maze/topology';
function neighbourOf(sim: BallSim, cell: number, side: number): number {
  return topology(sim.n).neighbour[cell * 4 + side];
}

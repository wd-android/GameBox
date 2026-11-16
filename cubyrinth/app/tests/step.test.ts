import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/config/tuning';
import { defaultParams, generateCube } from '../src/maze/generator';
import { U_AXES, V_AXES, cellCol, cellFace, cellRow } from '../src/maze/topology';
import { apply } from '../src/physics/orientation';
import { BallSim } from '../src/physics/sim';

/** Screen direction (0 right, 1 down, 2 left, 3 up) of a face-local side. */
function screenDir(sim: BallSim, side: number): number {
  const lx = [1, 0, -1, 0][side];
  const ly = [0, 1, 0, -1][side];
  const u = U_AXES[sim.face];
  const v = V_AXES[sim.face];
  const w = apply(sim.R, [lx * u[0] + ly * v[0], lx * u[1] + ly * v[1], lx * u[2] + ly * v[2]]);
  return w[0] === 1 ? 0 : w[2] === 1 ? 1 : w[0] === -1 ? 2 : 3;
}

function run(sim: BallSim, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step(0, 0);
}

describe('step mode', () => {
  it('can go back through the gate it has just come through', () => {
    for (let k = 0; k < 20; k++) {
      const n = 4;
      const cube = generateCube(n, 700 + k, defaultParams(n));
      const sim = new BallSim(cube, { ball: BALLS.bronze, mode: 'step' });
      // The first gate always leaves the start face. Put the ball in its cell, as a unit test of the rule.
      const g = cube.gates[0];
      const home = g.faceA;
      expect(home).toBe(sim.face);
      sim.p = { x: cellCol(n, g.cellA) + 0.5, y: cellRow(n, g.cellA) + 0.5 };
      sim.state = 'ROLLING';
      const R = sim.R.slice();

      sim.swipe(screenDir(sim, g.sideA));
      run(sim, 240);
      expect(sim.state).toBe('ROLLING');
      expect(sim.face).toBe(g.faceB);
      expect(cellFace(n, g.cellB)).toBe(sim.face);
      expect(sim.p).toEqual({ x: cellCol(n, g.cellB) + 0.5, y: cellRow(n, g.cellB) + 0.5 });

      sim.swipe(screenDir(sim, g.sideB));
      run(sim, 240);
      expect(sim.face, `cube ${700 + k}`).toBe(home);
      expect(sim.R).toEqual(R);
    }
  });
});

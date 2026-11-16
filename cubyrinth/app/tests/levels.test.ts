import { describe, expect, it } from 'vitest';
import { BALLS, BALL_ORDER } from '../src/config/tuning';
import { LEVELS, levelCube, parTime, score } from '../src/game/levels';
import { BallSim } from '../src/physics/sim';
import { autoplay } from '../src/game/autopilot';

describe('Journey', () => {
  it('has 80 levels in four stages of 10, 20, 25 and 25', () => {
    expect(LEVELS.length).toBe(80);
    const counts = [1, 2, 3, 4].map((s) => LEVELS.filter((l) => l.stage === s).length);
    expect(counts).toEqual([10, 20, 25, 25]);
  });

  it('every level can be completed by the automatic player with each ball', () => {
    for (const level of LEVELS) {
      const cube = levelCube(level);
      for (const b of BALL_ORDER) {
        const t = autoplay(new BallSim(cube, { ball: BALLS[b] }), 300);
        expect(t, `level ${level.id} with ${b}`).not.toBeNull();
      }
    }
  });

  it('holes appear from stage 3 only and never on the route', () => {
    for (const level of LEVELS) {
      const cube = levelCube(level);
      if (level.stage < 3) expect(cube.holes.length).toBe(0);
      const route = new Set(cube.solution);
      for (const h of cube.holes) expect(route.has(h)).toBe(false);
    }
  });

  it('scoring follows §9.4', () => {
    const cube = levelCube(LEVELS[0]);
    const par = parTime(cube, 'bronze');
    expect(par).toBeCloseTo(cube.measures.length / (0.45 * 6) + 0.45 * 2, 6);
    expect(score(cube, 'bronze', par).stars).toBe(3);
    expect(score(cube, 'bronze', par * 1.4).stars).toBe(2);
    expect(score(cube, 'bronze', par * 2).stars).toBe(1);
    // At par: base + base · 1, times the ball factor.
    expect(score(cube, 'gold', parTime(cube, 'gold')).score).toBe(Math.round(600 * 2));
  });
});

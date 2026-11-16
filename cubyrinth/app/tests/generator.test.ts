import { describe, expect, it } from 'vitest';
import { defaultParams, finishCell, generateCube, startCell, type Cube } from '../src/maze/generator';
import { bfs } from '../src/maze/solver';
import { cellFace, topology } from '../src/maze/topology';

const SEEDS_PER_SIZE = Number(process.env.SEEDS ?? 300);
const SIZES = [3, 4, 5, 6, 7, 8, 9];

function popcount(x: number): number {
  let k = 0;
  for (; x; x &= x - 1) k++;
  return k;
}

describe('topology', () => {
  for (const n of SIZES) {
    it(`every cell has four neighbours that agree from both sides (n=${n})`, () => {
      const t = topology(n);
      for (let c = 0; c < t.cellCount; c++)
        for (let s = 0; s < 4; s++) {
          const nb = t.neighbour[c * 4 + s];
          expect(nb).toBeGreaterThanOrEqual(0);
          expect(nb).not.toBe(c);
          const back = t.backSide[c * 4 + s];
          expect(t.neighbour[nb * 4 + back]).toBe(c);
        }
    });
  }

  it('start and finish are at opposite corners of the cube', () => {
    for (const n of SIZES) {
      const t = topology(n);
      const s = t.point[startCell(n)];
      const f = t.point[finishCell(n)];
      expect(s).toEqual([-(n - 1), n, -(n - 1)]);
      expect(f).toEqual([n - 1, -n, n - 1]);
    }
  });
});

function checkCube(cube: Cube): void {
  const n = cube.n;
  const t = topology(n);
  // Open walls are recorded from both sides.
  let halfOpen = 0;
  for (let c = 0; c < t.cellCount; c++)
    for (let s = 0; s < 4; s++)
      if (cube.open[c] & (1 << s)) {
        halfOpen++;
        const nb = t.neighbour[c * 4 + s];
        expect(cube.open[nb] & (1 << t.backSide[c * 4 + s])).toBeTruthy();
      }
  // One connected maze with no loops: exactly 6n² − 1 open walls.
  expect(halfOpen / 2).toBe(6 * n * n - 1);
  // Every cell reachable from the start.
  const parent = bfs(t, cube.open, cube.start);
  for (let c = 0; c < t.cellCount; c++) expect(parent[c]).not.toBe(-2);
  // Five gates, none touching start or finish, each joining two different faces.
  expect(cube.gates.length).toBe(5);
  for (const g of cube.gates) {
    expect([g.cellA, g.cellB]).not.toContain(cube.start);
    expect([g.cellA, g.cellB]).not.toContain(cube.finish);
    expect(cellFace(n, g.cellA)).not.toBe(cellFace(n, g.cellB));
  }
  // No hole on the route, holes only in dead ends.
  const route = new Set(cube.solution);
  for (const h of cube.holes) {
    expect(route.has(h)).toBe(false);
    expect(popcount(cube.open[h])).toBe(1);
  }
  expect(cube.solution[0]).toBe(cube.start);
  expect(cube.solution[cube.solution.length - 1]).toBe(cube.finish);
}

describe('generator', () => {
  for (const n of SIZES) {
    it(`produces valid cubes over ${SEEDS_PER_SIZE} seeds (n=${n})`, () => {
      for (let seed = 1; seed <= SEEDS_PER_SIZE; seed++) checkCube(generateCube(n, seed * 7919, defaultParams(n)));
    });
  }

  it('the same code always produces an identical cube', () => {
    for (const n of SIZES) {
      const a = generateCube(n, 48213, defaultParams(n));
      const b = generateCube(n, 48213, defaultParams(n));
      expect(Array.from(a.open)).toEqual(Array.from(b.open));
      expect(a.gates).toEqual(b.gates);
      expect(a.holes).toEqual(b.holes);
    }
  });

  it('every routeFaces value gives a route through that many faces', () => {
    for (let rf = 3; rf <= 6; rf++) {
      const cube = generateCube(5, 99 + rf, { routeFaces: rf, windiness: 0.7, holeShare: 0 });
      const faces = new Set(cube.solution.map((c) => cellFace(5, c)));
      expect(faces.size).toBe(rf);
    }
  });

  it('rejects face crossings shorter than two cells from n=4', () => {
    for (let seed = 1; seed < 200; seed++) expect(generateCube(4, seed, defaultParams(4)).measures.shortestFaceCrossing).toBeGreaterThanOrEqual(2);
  });

  it('generates a 9 × 9 cube, with retries, well within 100 ms', () => {
    const t0 = performance.now();
    const k = 10;
    for (let i = 0; i < k; i++) generateCube(9, 1000 + i, { ...defaultParams(9), bands: { length: [120, 200] } });
    expect((performance.now() - t0) / k).toBeLessThan(100);
  });
});

/**
 * Calibration (§6.9): generates 2,000 cubes for each combination of size and
 * parameters used by the game and records the spread of each measure. Bands
 * are then set from that spread (thirds). Output is committed with the code.
 *
 *   npm run calibrate
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultParams, generateCube } from '../src/maze/generator';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES = Number(process.env.SAMPLES ?? 2000);

export const COMBOS: [number, number, number][] = [
  [3, 3, 0.9],
  [4, 3, 0.8],
  [4, 4, 0.8],
  [5, 4, 0.6],
  [5, 4, 0.7],
  [5, 4, 0.8],
  [5, 5, 0.6],
  [5, 5, 0.7],
  [5, 5, 0.8],
  [6, 5, 0.5],
  [6, 5, 0.6],
  [6, 5, 0.7],
  [6, 6, 0.5],
  [6, 6, 0.6],
  [6, 6, 0.7],
];
for (const n of [7, 8, 9]) {
  const d = defaultParams(n);
  COMBOS.push([n, d.routeFaces, d.windiness]);
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const out: Record<string, unknown> = {};
for (const [n, routeFaces, windiness] of COMBOS) {
  const len: number[] = [];
  const detour: number[] = [];
  const dead: number[] = [];
  const turns: number[] = [];
  for (let s = 0; s < SAMPLES; s++) {
    const c = generateCube(n, 100000 + s, { routeFaces, windiness, holeShare: 0 }, false);
    len.push(c.measures.length);
    detour.push(c.measures.longestDetour);
    dead.push(c.measures.deadEnds);
    turns.push(c.measures.turns);
  }
  const summary = (a: number[]) => {
    a.sort((x, y) => x - y);
    return { min: a[0], p33: pct(a, 1 / 3), p50: pct(a, 0.5), p67: pct(a, 2 / 3), max: a[a.length - 1] };
  };
  const key = `${n}/${routeFaces}/${windiness}`;
  out[key] = { length: summary(len), detour: summary(detour), deadEnds: summary(dead), turns: summary(turns) };
  console.log(key, JSON.stringify(out[key]));
}
writeFileSync(resolve(root, 'tools/calibration.json'), JSON.stringify({ samples: SAMPLES, generated: new Date().toISOString().slice(0, 10), combos: out }, null, 1));

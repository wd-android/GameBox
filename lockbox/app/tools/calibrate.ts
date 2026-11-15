/**
 * Calibration (§8.3): plays 1,000 generated feedback-level puzzles of each
 * lock, size and feedback option with a competent reference solver, and
 * sets par to the median number of tries plus one. Writes src/locks/par.json.
 *
 *   npm run calibrate        (SAMPLES=200 for a quicker pass)
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING } from '../src/config/tuning';
import { referenceTries } from '../src/locks/reference';
import type { Detail, LockTypeId } from '../src/locks/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES = Number(process.env.SAMPLES ?? TUNING.CALIBRATION_SAMPLES);
const out: Record<string, number> = {};
const report: string[] = [];
const cases: [LockTypeId, number[]][] = [
  ['padlock', [3, 4, 5]],
  ['bottles', [3, 4, 5, 6, 7, 8]],
];
for (const [type, sizes] of cases)
  for (const parts of sizes)
    for (const detail of ['howMany', 'which'] as Detail[]) {
      const tries: number[] = [];
      for (let s = 0; s < SAMPLES; s++) tries.push(referenceTries(type, parts, detail, 7000 + s));
      tries.sort((a, b) => a - b);
      const median = tries[Math.floor(tries.length / 2)];
      out[`${type}/${parts}/${detail}`] = median + 1;
      report.push(`${type} ${parts} ${detail}: median ${median}, par ${median + 1} (min ${tries[0]}, max ${tries[tries.length - 1]})`);
      console.log(report[report.length - 1]);
    }
writeFileSync(resolve(root, 'src/locks/par.json'), JSON.stringify(out, null, 1));
writeFileSync(resolve(root, 'tools/calibration.txt'), `${SAMPLES} puzzles per row\n${report.join('\n')}\n`);

/**
 * Survival baseline (§12, §14): an automatic pilot that simply follows the
 * clear lane flies RUNS random runs (default 500) of three minutes each,
 * hawks excluded, cycling through the species. Fails if any run ends early.
 *
 *   npm run autopilot            (RUNS=100 npm run autopilot for a quicker pass)
 */
import chunks from '../src/world/chunks/chunks.json';
import { SPECIES_ORDER } from '../src/config/tuning';
import { Flight } from '../src/sim/flight';
import { autofly } from '../src/game/autopilot';
import type { Chunk } from '../src/world/chunk';

const RUNS = Number(process.env.RUNS ?? 500);
const t0 = performance.now();
let failed = 0;
let worst = Infinity;
let birds = 0;
for (let i = 0; i < RUNS; i++) {
  const species = SPECIES_ORDER[i % 3];
  const f = new Flight({ species, seed: 1 + i * 7919, chunks: chunks as Chunk[], runsPlayed: 5, hawks: false });
  const t = autofly(f, 180);
  worst = Math.min(worst, t);
  birds += f.n;
  if (t < 180 - 1e-6) {
    failed++;
    console.log(`run ${i} (${species}, seed ${1 + i * 7919}) ended at ${t.toFixed(1)} s`);
  }
}
console.log(`${RUNS - failed}/${RUNS} runs survived three minutes (shortest ${worst.toFixed(1)} s, average flock at the end ${(birds / RUNS).toFixed(0)}) in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
if (failed) process.exit(1);

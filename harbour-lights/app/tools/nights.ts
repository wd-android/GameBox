/**
 * Night seeds (§8.3): for each of the 40 nights, try seeds in order until the
 * automatic keeper earns three stars with the starting lighthouse. Writes
 * src/nights/accepted.json. `--check` verifies the committed seeds instead.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { NIGHT_COUNT, recipe } from '../src/nights/nights';
import { NightSim } from '../src/sim/night';
import { NO_UPGRADES } from '../src/sim/beam';
import { keeperPlay } from '../src/sim/keeper';

const file = new URL('../src/nights/accepted.json', import.meta.url);
const check = process.argv.includes('--check');

if (check) {
  const seeds = JSON.parse(readFileSync(file, 'utf8')) as Record<string, number>;
  let bad = 0;
  for (let n = 1; n <= NIGHT_COUNT; n++) {
    const r = keeperPlay(new NightSim(recipe(n, seeds[n]), NO_UPGRADES));
    if (r.stars !== 3) {
      bad++;
      console.log(`night ${n}: keeper got ${r.stars} stars`);
    }
  }
  console.log(bad ? `${bad} nights fail` : `all ${NIGHT_COUNT} nights accepted`);
  process.exit(bad ? 1 : 0);
}

const out: Record<number, number> = {};
const lines: string[] = [];
for (let n = 1; n <= NIGHT_COUNT; n++) {
  let seed = 1;
  for (; seed < 500; seed++) {
    const def = recipe(n, seed);
    const r = keeperPlay(new NightSim(def, NO_UPGRADES));
    if (r.stars === 3) {
      out[n] = seed;
      lines.push(`night ${String(n).padStart(2)}: seed ${seed}, ${def.boats} boats [${def.mix.join(', ')}], every ${def.interval}s, fog ${def.fog}, current ${def.currentStrength}, catch ${r.catch}`);
      break;
    }
  }
  if (!out[n]) throw new Error(`night ${n}: no seed accepted in 500 tries`);
  console.log(lines[lines.length - 1]);
}
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
writeFileSync(new URL('./nights.txt', import.meta.url), lines.join('\n') + '\n');

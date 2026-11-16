/**
 * Balance script (spec §17). Runs every moment N times for each scripted player.
 * Usage:  npm run balance -- [runs] [--only=w1d3]
 */
import { MOMENTS } from '../src/content/moments';
import { createMoment, runMoment } from '../src/sim/moment';
import { scoreMoment, starsFor } from '../src/game/scoring';
import { ignorer, reader, type Bot } from './bots';

const args = process.argv.slice(2);
const runs = Number(args.find((a) => /^\d+$/.test(a)) ?? 30);
const only = args.find((a) => a.startsWith('--only='))?.slice(7);

const players: [string, () => Bot][] = [['ignores', ignorer], ['sensible', () => reader(false)], ['perfect', () => reader(true)]];
const sum: Record<string, { met: number; three: number; n: number }> = {};
for (const def of MOMENTS) {
  if (only && !def.id.startsWith(only)) continue;
  const line = [def.id.padEnd(14)];
  for (const [name, mk] of players) {
    let met = 0, three = 0;
    for (let i = 0; i < runs; i++) {
      const s = runMoment(createMoment({ ...def, seed: def.seed + i * 7919 }), mk());
      const st = starsFor(s.status === 'won', scoreMoment(s).total);
      if (st > 0) met++;
      if (st === 3) three++;
    }
    (sum[name] ??= { met: 0, three: 0, n: 0 });
    sum[name].met += met; sum[name].three += three; sum[name].n += runs;
    line.push(`${name}: ${String(Math.round((met / runs) * 100)).padStart(3)}% met ${String(Math.round((three / runs) * 100)).padStart(3)}% ★★★`);
  }
  console.log(line.join('  '));
}
console.log('\nOverall');
for (const [k, v] of Object.entries(sum)) console.log(`  ${k.padEnd(9)} objective met ${Math.round((v.met / v.n) * 100)}%   three stars ${Math.round((v.three / v.n) * 100)}%`);

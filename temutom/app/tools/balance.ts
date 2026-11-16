/**
 * Balance script (spec §16). Runs every shift N times for each scripted player and reports
 * objective success and star distribution.  Usage:  npm run balance -- [runs] [--lapses=max]
 */
import { SHIFTS } from '../src/content/shifts';
import { createShift, runShift } from '../src/sim/shift';
import { scoreShift, starsFor } from '../src/game/scoring';
import { screamer, thinker, type Bot } from './bots';
import type { DemandKind, StaffId } from '../src/sim/types';
import { TUNING } from '../src/config/tuning';

const args = process.argv.slice(2);
const runs = Number(args.find((a) => /^\d+$/.test(a)) ?? 40);
const forceLapses = args.includes('--lapses=max');
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
if (forceLapses) (TUNING.lapse as { chance: number }).chance = 1;

const players: [string, () => Bot][] = [
  ['screams', screamer],
  ['sensible', () => thinker(false)],
  ['perfect', () => thinker(true)],
];

/** Compliance a player would plausibly have reached by a given shift */
function progressCompliance(idx: number, quality: number): Partial<Record<StaffId, Record<DemandKind, number>>> {
  const v = Math.min(70, idx * 0.9 * quality);
  const c = { food: v, door: v, lap: v, play: v };
  return { soft: { ...c }, busy: { ...c }, guest: { food: Math.min(40, v), door: Math.min(40, v), lap: Math.min(40, v), play: Math.min(40, v) }, soft2: { ...c } };
}

const summary: Record<string, { met: number; three: number; n: number }> = {};
const rows: string[] = [];
SHIFTS.forEach((def, idx) => {
  if (only && !def.id.startsWith(only)) return;
  const line: string[] = [def.id.padEnd(14)];
  for (const [name, mk] of players) {
    let met = 0, three = 0;
    for (let i = 0; i < runs; i++) {
      const d = { ...def, seed: def.seed + i * 7919 };
      const s = createShift(d, {
        compliance: progressCompliance(idx, name === 'screams' ? 0.5 : name === 'sensible' ? 0.8 : 1),
        morale: 70, thronesClaimed: [], settings: { fewerLapses: false, longerPatience: false },
      });
      runShift(s, mk());
      const sc = scoreShift(s).total;
      const st = starsFor(s.status === 'won', sc, def.stars);
      if (st > 0) met++;
      if (st === 3) three++;
    }
    const key = `${name}`;
    summary[key] ??= { met: 0, three: 0, n: 0 };
    summary[key].met += met; summary[key].three += three; summary[key].n += runs;
    line.push(`${name}: ${String(Math.round((met / runs) * 100)).padStart(3)}% met ${String(Math.round((three / runs) * 100)).padStart(3)}% ★★★`);
  }
  rows.push(line.join('  '));
});
console.log(rows.join('\n'));
console.log('\nOverall');
for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(9)} objective met ${Math.round((v.met / v.n) * 100)}%   three stars ${Math.round((v.three / v.n) * 100)}%`);

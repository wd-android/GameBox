/**
 * Report (§14.2): runs the solver over every puzzle, writes a table of all
 * measures, flags any puzzle that fails §6.3, and arranges the daily
 * puzzles into weekday order (Monday 1 … Sunday 7, monthly special on the
 * last day of each month).
 *
 *   npm run report            arrange the dailies and write the report
 *   npm run report -- --check verify the bundled puzzles (the build runs this)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP } from '../../src/config/app';
import { TUNING } from '../../src/config/tuning';
import type { Puzzle } from '../../src/chain/model';
import { scoreDifficulty, solve, type SolverReport } from '../../src/chain/solver';
import { gapIds } from '../../src/chain/model';
import { dateForNumber, isLastDayOfMonth, weekdayDifficulty } from '../../src/game/schedule';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => JSON.parse(readFileSync(resolve(root, rel), 'utf8')) as Puzzle[];
const check = process.argv.includes('--check');

function verify(label: string, puzzles: Puzzle[], allowNoDecoy = false): string[] {
  const failures: string[] = [];
  for (const p of puzzles) {
    const r = solve(p);
    const problems = r.problems.filter((x) => !(allowNoDecoy && x === 'no decoy gap'));
    if (problems.length) failures.push(`${label} ${p.id}: ${problems.join('; ')}`);
    if (r.par !== p.par) failures.push(`${label} ${p.id}: stored par ${p.par} but solver says ${r.par}`);
    const gaps = gapIds(p).length;
    if (!allowNoDecoy && (gaps < TUNING.MIN_GAPS || gaps > TUNING.MAX_GAPS)) failures.push(`${label} ${p.id}: ${gaps} gaps`);
    if (p.slots.length > TUNING.MAX_SLOTS) failures.push(`${label} ${p.id}: ${p.slots.length} slots`);
  }
  return failures;
}

if (check) {
  const daily = read('src/puzzles/daily/daily.json');
  const failures = [...verify('daily', daily), ...verify('pack', read('src/puzzles/packs/first-tricks.json')), ...verify('tutorial', read('src/puzzles/tutorial.json'), true)];
  const today = new Date();
  const launch = new Date(APP.LAUNCH_DATE + 'T00:00:00');
  const used = Math.max(0, Math.floor((today.getTime() - launch.getTime()) / 86400000) + 1);
  console.log(`Daily puzzles: ${daily.length}; ${Math.max(0, daily.length - used)} days remain before the app replays early puzzles.`);
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log('All bundled puzzles pass §6.3.');
  process.exit(0);
}

// ── Arrange the dailies ─────────────────────────────────────
const pool = read('src/puzzles/daily/pool.json');
const specials = read('src/puzzles/daily/specials.json');
const scored = pool.map((p) => ({ p, r: solve(p), s: 0 })).map((x) => ({ ...x, s: scoreDifficulty(x.p, x.r) }));
scored.sort((a, b) => a.s - b.s);
// Difficulty 1–7 by rank, so each level holds a seventh of the pool.
scored.forEach((x, i) => (x.p.difficulty = 1 + Math.floor((i / scored.length) * 7)));
const buckets = new Map<number, typeof scored>();
for (const x of scored) {
  const list = buckets.get(x.p.difficulty) ?? [];
  list.push(x);
  buckets.set(x.p.difficulty, list);
}
// Spread choices across each bucket (interleave so neighbours in the schedule differ).
for (const list of buckets.values()) list.sort((a, b) => (hash(a.p.id) % 9973) - (hash(b.p.id) % 9973));

const daily: Puzzle[] = [];
let special = 0;
for (let n = 1; n <= TUNING.DAILY_COUNT; n++) {
  const date = dateForNumber(n);
  let p: Puzzle;
  if (isLastDayOfMonth(date)) {
    p = specials[special++ % specials.length];
    p.difficulty = 7;
  } else {
    const d = weekdayDifficulty(date);
    let list = buckets.get(d)!;
    for (let k = 1; !list.length && k < 7; k++) list = buckets.get(Math.max(1, d - k)) ?? buckets.get(Math.min(7, d + k))!;
    p = list.shift()!.p;
  }
  daily.push({ ...p, id: `daily-${String(n).padStart(4, '0')}` });
}
writeFileSync(resolve(root, 'src/puzzles/daily/daily.json'), JSON.stringify(daily));

// ── Report table ────────────────────────────────────────────
const rows: string[] = [];
const head = '| Puzzle | Date | Diff | Slots | Gaps | Par | Wins | At par | Share | Decoys | Essential | Forks | Tall? | Ball? | OK |';
const line = (p: Puzzle, r: SolverReport, date = '') =>
  `| ${p.id} | ${date} | ${p.difficulty} | ${p.slots.length} | ${gapIds(p).length} | ${r.par} | ${r.winning} | ${r.winningAtPar} | ${(r.solutionShare * 100).toFixed(1)}% | ${r.decoyGaps.length} | ${r.essentialGaps.length} | ${r.forks} | ${r.needsTall ? 'yes' : ''} | ${r.needsBall ? 'yes' : ''} | ${r.acceptable ? '✓' : '✗ ' + r.problems.join('; ')} |`;
rows.push('# Puzzle report', '', `Generated ${new Date().toISOString().slice(0, 10)} by tools/report/report.ts. Launch date ${APP.LAUNCH_DATE}.`, '', '## Daily Topple', '', head, '|' + '---|'.repeat(15));
daily.forEach((p, i) => rows.push(line(p, solve(p), dateForNumber(i + 1))));
rows.push('', '## Pack 1: First Tricks', '', head, '|' + '---|'.repeat(15));
for (const p of read('src/puzzles/packs/first-tricks.json')) rows.push(line(p, solve(p)));
rows.push('', '## First launch', '', head, '|' + '---|'.repeat(15));
for (const p of read('src/puzzles/tutorial.json')) rows.push(line(p, solve(p)));
writeFileSync(resolve(root, 'tools/report/report.md'), rows.join('\n') + '\n');
console.log(`Arranged ${daily.length} daily puzzles (${special} monthly specials). Report written to tools/report/report.md.`);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

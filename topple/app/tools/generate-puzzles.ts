/**
 * Proposes the bundled puzzles (§9, §17): a pool of daily candidates, four
 * monthly specials, the 30-puzzle pack "First Tricks" and the two first-launch
 * puzzles. Every one passes the solver (§6.3). Then run `npm run report`,
 * which arranges the dailies into weekday order.
 *
 *   npm run puzzles
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rand, routesPuzzle, specialPuzzle, tutorialPuzzles, type Candidate, type RouteOptions } from '../src/puzzles/generator';
import { scoreDifficulty } from '../src/chain/solver';
import { compactPuzzle } from '../src/puzzles/files';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const write = (rel: string, data: unknown) => writeFileSync(resolve(root, rel), JSON.stringify(data));

function collect(seed: number, count: number, opts: (r: Rand) => RouteOptions, filter: (c: Candidate) => boolean, prefix: string): Candidate[] {
  const rng = new Rand(seed);
  const out: Candidate[] = [];
  for (let i = 0; out.length < count && i < count * 400; i++) {
    const c = routesPuzzle(`${prefix}-${i}`, rng, opts(rng));
    if (c && filter(c)) out.push(c);
  }
  if (out.length < count) throw new Error(`only ${out.length}/${count} for ${prefix}`);
  return out;
}

const byScore = (a: Candidate, b: Candidate) => scoreDifficulty(a.puzzle, a.report) - scoreDifficulty(b.puzzle, b.report);

// ── Daily pool: varied templates ────────────────────────────
const pool = collect(
  20261115,
  420,
  (r) => ({ routes: r.pick([2, 3] as const), tall: r.chance(0.35), ramp: r.chance(0.3), decoys: r.int(0, 3), essential: r.int(0, 1) }),
  () => true,
  'pool',
);
const specials: Candidate[] = [];
{
  const rng = new Rand(31);
  for (let i = 0; specials.length < 8 && i < 400; i++) {
    const c = specialPuzzle(`special-${i}`, rng);
    if (c) specials.push(c);
  }
}
write('src/puzzles/daily/pool.json', pool.map((c) => compactPuzzle(c.puzzle)));
write('src/puzzles/daily/specials.json', specials.map((c) => compactPuzzle(c.puzzle)));

// ── Pack 1: "First Tricks" (§9.4) ───────────────────────────
const plain = collect(7001, 6, (r) => ({ routes: r.pick([2, 3] as const), tall: false, ramp: false, decoys: r.int(1, 2), essential: 0 }), (c) => c.report.forks >= 2, 'p1').sort(byScore);
const tall = collect(7002, 10, (r) => ({ routes: r.pick([2, 3] as const), tall: true, ramp: false, decoys: r.int(0, 2), essential: r.int(0, 1) }), (c) => c.report.needsTall, 'p2').sort(byScore);
const ramp = collect(7003, 8, (r) => ({ routes: r.pick([2, 3] as const), tall: false, ramp: true, decoys: r.int(0, 2), essential: r.int(0, 1) }), (c) => c.report.needsBall, 'p3').sort(byScore);
const mixed = collect(7004, 6, (r) => ({ routes: 3, tall: true, ramp: true, decoys: r.int(1, 3), essential: r.int(0, 1) }), (c) => c.puzzle.ramps.length > 0 && (c.report.needsTall || c.report.needsBall), 'p4').sort(byScore);
const pack = [...plain, ...tall, ...ramp, ...mixed].map((c, i) => {
  const p = c.puzzle;
  p.id = `first-tricks-${String(i + 1).padStart(2, '0')}`;
  p.title = `First Tricks ${i + 1}`;
  return p;
});
// Difficulty within the pack rises gently from 1 to 7.
pack.forEach((p, i) => (p.difficulty = Math.min(7, 1 + Math.floor((i / pack.length) * 7))));
write('src/puzzles/packs/first-tricks.json', pack.map(compactPuzzle));

// ── First launch (§12) ──────────────────────────────────────
write('src/puzzles/tutorial.json', tutorialPuzzles().map(compactPuzzle));
console.log(`pool ${pool.length}, specials ${specials.length}, pack ${pack.length}`);

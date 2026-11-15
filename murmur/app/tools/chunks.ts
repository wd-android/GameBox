/**
 * Chunk tool (§7.1, §12): builds the 40 chunks, checks that each has a
 * continuous clear lane of its tier's width and that it lines up with any
 * chunk that may follow it, and writes src/world/chunks/chunks.json.
 *
 *   npm run chunks             build and write
 *   npm run chunks -- --check  verify the committed file (the build runs this)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING } from '../src/config/tuning';
import { buildChunks, firstLaunchChunks } from '../src/world/chunkDefs';
import { checkLane, linesUp } from '../src/world/lane';
import type { Chunk } from '../src/world/chunk';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'src/world/chunks/chunks.json');
const check = process.argv.includes('--check');

export function verify(chunks: Chunk[]): string[] {
  const problems: string[] = [];
  const lanes = chunks.map((c) => checkLane(c, TUNING.TIER_LANE[c.tier - 1]));
  chunks.forEach((c, i) => {
    if (!lanes[i].ok) problems.push(`${c.id}: no clear lane ${TUNING.TIER_LANE[c.tier - 1]} tiles wide`);
    if (c.tree && c.clouds.some((cl) => Math.hypot(cl.x - c.tree!.x, cl.y - c.tree!.y) < cl.r)) problems.push(`${c.id}: cloud over the tree`);
  });
  // Any chunk may follow any chunk of its own tier, the tier below or the tier above.
  chunks.forEach((a, i) =>
    chunks.forEach((b, j) => {
      if (Math.abs(a.tier - b.tier) > 1) return;
      const wa = TUNING.TIER_LANE[Math.max(a.tier, b.tier) - 1];
      if (!linesUp(checkLane(a, wa), checkLane(b, wa))) problems.push(`${a.id} → ${b.id}: lanes do not line up`);
      void i;
      void j;
    }),
  );
  return problems;
}

if (check) {
  const chunks = JSON.parse(readFileSync(file, 'utf8')) as Chunk[];
  const problems = verify(chunks);
  const tiers = [1, 2, 3, 4, 5].map((t) => chunks.filter((c) => c.tier === t).length);
  console.log(`${chunks.length} chunks, per tier ${tiers.join('/')}`);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('Every chunk has its clear lane and lines up with its neighbours.');
} else {
  const chunks = buildChunks();
  const problems = verify(chunks);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  writeFileSync(file, JSON.stringify(chunks, null, 1));
  writeFileSync(resolve(root, 'src/world/chunks/first-launch.json'), JSON.stringify(firstLaunchChunks(), null, 1));
  console.log(`Wrote ${chunks.length} chunks.`);
}

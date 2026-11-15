/**
 * Authors all jars (§8, §13) by scripted pouring with the real simulation and
 * writes the jar files plus the designer recordings. Fails the build if any
 * recording does not replay to at least 97% against its own target, or if a
 * one-colour pour could earn a star.
 *
 *   npm run jars
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING } from '../src/config/tuning';
import { author, matchPlan, dailyPlan, type Plan } from '../src/jars/generate';
import type { JarFile, RecordingFile } from '../src/jars/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function build(name: string, plans: Plan[]): void {
  const file: JarFile = { version: 1, jars: [] };
  const recs: RecordingFile = {};
  let failures = 0;
  for (const plan of plans) {
    const a = author(plan);
    file.jars.push(a.def);
    recs[plan.id] = a.recording;
    const ok = a.selfScore >= TUNING.DESIGNER_MIN_SELF_SCORE && a.worstSingleColour < TUNING.STAR_1;
    if (!ok) failures++;
    console.log(
      `${ok ? ' ' : '✗'} ${name} ${String(plan.id).padStart(4)}  ${plan.shape.padEnd(12)} ${plan.technique.padEnd(7)} layers ${plan.layers}  self ${(a.selfScore * 100).toFixed(1)}%  one-colour ${(a.worstSingleColour * 100).toFixed(1)}%`,
    );
  }
  const out = resolve(root, 'src/jars/data', `${name}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(file));
  writeFileSync(resolve(root, 'tools/recordings', `${name}.json`), JSON.stringify(recs));
  if (failures) {
    console.error(`${failures} ${name} jars failed validation`);
    process.exit(1);
  }
}

build('match', Array.from({ length: TUNING.MATCH_JAR_COUNT }, (_, i) => matchPlan(i + 1)));
build('daily', Array.from({ length: TUNING.DAILY_JAR_COUNT }, (_, i) => dailyPlan(i)));

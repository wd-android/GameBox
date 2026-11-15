import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TUNING } from '../src/config/tuning';
import { replay } from '../src/sand/sim';
import { decodeRecording } from '../src/sand/rle';
import { accuracy, starsFor, toleranceMap } from '../src/sand/scoring';
import { maskFor } from '../src/jars/shapes';
import { targetGrid } from '../src/jars/generate';
import type { JarFile, RecordingFile } from '../src/jars/types';

const load = <T>(p: string): T => JSON.parse(readFileSync(resolve(__dirname, '..', p), 'utf8')) as T;

for (const name of ['match', 'daily'] as const) {
  const file = load<JarFile>(`src/jars/data/${name}.json`);
  const recs = load<RecordingFile>(`tools/recordings/${name}.json`);

  describe(`${name} jars`, () => {
    it('has the right number of jars', () => {
      expect(file.jars.length).toBe(name === 'match' ? TUNING.MATCH_JAR_COUNT : TUNING.DAILY_JAR_COUNT);
    });

    it(`every recording replays to at least ${TUNING.DESIGNER_MIN_SELF_SCORE * 100}% against its own target`, () => {
      for (const def of file.jars) {
        const mask = maskFor(def.shape);
        const target = targetGrid(def);
        const sim = replay(mask, def.seed, null, decodeRecording(recs[def.id]));
        const acc = accuracy(sim.cells, toleranceMap(target, mask), mask, target);
        expect(acc, `jar ${def.id}`).toBeGreaterThanOrEqual(TUNING.DESIGNER_MIN_SELF_SCORE);
      }
    });

    it('the recording also succeeds within the colour limits', () => {
      for (const def of file.jars) {
        if (!def.limits) continue;
        const mask = maskFor(def.shape);
        const target = targetGrid(def);
        const sim = replay(mask, def.seed, def.limits, decodeRecording(recs[def.id]));
        const acc = accuracy(sim.cells, toleranceMap(target, mask), mask, target);
        expect(acc, `jar ${def.id}`).toBeGreaterThanOrEqual(TUNING.DESIGNER_MIN_SELF_SCORE);
      }
    });

    it('a deliberately poor pour (one colour only) scores below one star', () => {
      for (const def of file.jars) {
        const mask = maskFor(def.shape);
        const target = targetGrid(def);
        const tol = toleranceMap(target, mask);
        for (const c of def.palette) {
          const poor = new Uint8Array(target.length);
          for (let i = 0; i < poor.length; i++) if (mask.inside[i] && i >= mask.fillRow * mask.w) poor[i] = c;
          expect(starsFor(accuracy(poor, tol, mask, target)), `jar ${def.id} colour ${c}`).toBe(0);
        }
      }
    });
  });
}

describe('acceptance', () => {
  const file = load<JarFile>('src/jars/data/match.json');

  it('a careful pour that looks right to the eye scores at least two stars (flat jars 1–15)', async () => {
    const { Designer } = await import('../src/jars/designer');
    for (const def of file.jars.filter((j) => j.id <= 15)) {
      const mask = maskFor(def.shape);
      const target = targetGrid(def);
      const counts = new Map<number, number>();
      for (const c of target) if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
      // A different seed, a faster sweep and amounts judged by eye (±8%).
      const d = new Designer(def.shape, def.seed + 77);
      def.palette.forEach((c, i) => {
        const jitter = 1 + (i % 2 ? 0.08 : -0.08);
        if (i < def.palette.length - 1) d.sweep(c, Math.round((counts.get(c) ?? 0) * jitter), undefined, undefined, 2);
        else d.fillUp(c, false);
      });
      const acc = accuracy(d.sim.cells, toleranceMap(target, mask), mask, target);
      expect(starsFor(acc), `jar ${def.id} scored ${(acc * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(2);
    }
  });
});

/**
 * Journey selection (§9.1): generates candidate cubes for every level slot,
 * measures them (including how long the automatic player takes with the
 * bronze ball), and writes an ordered list so every player gets the same
 * Journey. Run `npm run calibrate` first.
 *
 *   npm run levels
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BALLS } from '../src/config/tuning';
import { generateCube, type Bands } from '../src/maze/generator';
import { BallSim } from '../src/physics/sim';
import { autoplay } from '../src/game/autopilot';
import type { LevelDef } from '../src/game/levels';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Summary = { min: number; p33: number; p50: number; p67: number; max: number };
const cal = JSON.parse(readFileSync(resolve(root, 'tools/calibration.json'), 'utf8')).combos as Record<string, { length: Summary; detour: Summary }>;

interface Slot {
  stage: number;
  n: number;
  routeFaces: number;
  windiness: number;
  holeShare: number;
  band: 'normal' | 'long';
  limitDetour: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const slots: Slot[] = [];
for (let i = 0; i < 10; i++) slots.push({ stage: 1, n: 3, routeFaces: 3, windiness: 0.9, holeShare: 0, band: 'normal', limitDetour: false });
for (let i = 0; i < 20; i++) slots.push({ stage: 2, n: 4, routeFaces: i < 10 ? 3 : 4, windiness: 0.8, holeShare: 0, band: 'normal', limitDetour: false });
for (let i = 0; i < 25; i++) {
  const t = i / 24;
  slots.push({ stage: 3, n: 5, routeFaces: i < 12 ? 4 : 5, windiness: Math.round(lerp(0.8, 0.6, t) * 10) / 10, holeShare: 0.3, band: i < 17 ? 'normal' : 'long', limitDetour: false });
}
for (let i = 0; i < 25; i++) {
  const t = i / 24;
  slots.push({ stage: 4, n: 6, routeFaces: i < 12 ? 5 : 6, windiness: Math.round(lerp(0.7, 0.5, t) * 10) / 10, holeShare: 0.4, band: i < 15 ? 'normal' : 'long', limitDetour: true });
}

function bandsFor(s: Slot): Bands {
  const c = cal[`${s.n}/${s.routeFaces}/${s.windiness}`];
  if (!c) throw new Error(`no calibration for ${s.n}/${s.routeFaces}/${s.windiness}`);
  const length: [number, number] = s.band === 'normal' ? [c.length.p33, c.length.p67] : [c.length.p67, c.length.max];
  const bands: Bands = { length };
  // Dead-end faces punish at large sizes (§13): keep the biggest detour in the lower two thirds.
  if (s.limitDetour) bands.detour = [c.detour.min, c.detour.p67];
  return bands;
}

const CANDIDATES = 6;
const levels: LevelDef[] = [];
for (let stage = 1; stage <= 4; stage++) {
  const stageSlots = slots.map((s, i) => ({ s, id: i + 1 })).filter((x) => x.s.stage === stage);
  const pool = stageSlots.map(({ s, id }) => {
    const bands = bandsFor(s);
    const cands = [];
    for (let k = 0; k < CANDIDATES; k++) {
      const seed = id * 1000 + k * 37 + 1;
      const cube = generateCube(s.n, seed, { routeFaces: s.routeFaces, windiness: s.windiness, holeShare: s.holeShare, bands });
      const t = autoplay(new BallSim(cube, { ball: BALLS.bronze }), 300);
      if (t === null) continue;
      cands.push({ seed, t, length: cube.measures.length });
    }
    return { s, id, bands, cands };
  });
  const times = pool.flatMap((p) => p.cands.map((c) => c.t)).sort((a, b) => a - b);
  const q = (p: number) => times[Math.floor(p * (times.length - 1))];
  const lo = q(0.1);
  const hi = q(0.9);
  pool.forEach((p, i) => {
    // A difficulty ramp through the stage; the first three levels are the quickest found.
    const target = stage === 1 && i < 3 ? 0 : lerp(lo, hi, i / Math.max(1, pool.length - 1));
    const best = p.cands.reduce((a, b) => (Math.abs(b.t - target) < Math.abs(a.t - target) ? b : a));
    levels.push({ id: p.id, stage, n: p.s.n, seed: best.seed, routeFaces: p.s.routeFaces, windiness: p.s.windiness, holeShare: p.s.holeShare, bands: p.bands });
    console.log(`level ${String(p.id).padStart(2)}  stage ${stage}  ${p.s.n}×${p.s.n}  route ${p.s.routeFaces}  wind ${p.s.windiness}  length ${best.length}  autoplayer ${best.t.toFixed(1)} s`);
  });
}
writeFileSync(resolve(root, 'src/game/levels.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), levels }, null, 1));

import { TUNING } from '../config/tuning';
import { Rng } from '../sand/rng';
import { encodeGrid, encodeRecording, decodeGrid, decodeRecording } from '../sand/rle';
import { replay } from '../sand/sim';
import { accuracy, toleranceMap } from '../sand/scoring';
import { Designer } from './designer';
import { maskFor, type ShapeId } from './shapes';
import { SETS, setForJar } from './sets';
import type { JarDef } from './types';

/**
 * Authors jars by scripted pouring (the same thing a designer does by hand in
 * the jar editor, §13). Each jar is described by a plan – shape, palette,
 * technique, layer sizes – and the Designer pours it with the real simulation
 * while the inputs are recorded.
 */

export interface Plan {
  id: number;
  stage: number;
  shape: ShapeId;
  palette: number[];
  layers: number;
  technique: JarDef['technique'];
  picture?: 'hills' | 'waves' | 'sunset';
  limited: boolean;
  set: string;
  title: string;
  seed: number;
}

export interface Authored {
  def: JarDef;
  recording: string;
  /** Best score any single colour achieves alone (must stay under one star). */
  worstSingleColour: number;
  selfScore: number;
}

function pickPalette(rng: Rng, from: number[], k: number): number[] {
  const pool = from.slice();
  const out: number[] = [];
  while (out.length < k && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}

/** A layer colour sequence over the palette with no two neighbours alike. */
function layerColours(rng: Rng, palette: number[], layers: number): number[] {
  const seq: number[] = [];
  for (let i = 0; i < layers; i++) {
    const prev = seq[i - 1];
    const choices = palette.filter((c) => c !== prev && (i < palette.length ? !seq.includes(c) : true));
    seq.push(choices[rng.int(choices.length)] ?? palette[i % palette.length]);
  }
  return seq;
}

function fractions(rng: Rng, n: number): number[] {
  const raw = Array.from({ length: n }, () => 70 + rng.int(61));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / sum);
}

export function matchPlan(id: number): Plan {
  const rng = new Rng(9001 + id * 7919);
  const set = setForJar(id);
  let stage: number;
  let layers: number;
  let technique: JarDef['technique'];
  let shape: ShapeId = 'straight';
  let limited = false;
  let picture: Plan['picture'];

  if (id <= 15) {
    stage = 1;
    layers = id <= 8 ? 3 : 4;
    technique = 'flat';
  } else if (id <= 40) {
    stage = 2;
    layers = 4 + Math.min(2, Math.floor((id - 16) / 9));
    technique = id < 25 ? 'mounds' : id % 2 === 1 ? 'slopes' : 'mounds';
    if (id === 25) technique = 'slopes';
    if (id >= 26 && (id === 26 || id % 3 === 2)) shape = 'round-bottle';
    limited = id >= 30;
  } else if (id <= 65) {
    stage = 3;
    layers = 6 + Math.min(3, Math.floor((id - 41) / 7));
    technique = id % 3 === 0 ? 'slopes' : 'zigzag';
    if (id === 51 || (id > 51 && id % 3 === 1)) shape = 'tall-vase';
    else if (id % 3 === 2) shape = 'round-bottle';
    limited = id % 6 !== 0;
  } else {
    stage = 4;
    layers = 9 + Math.min(3, Math.floor((id - 66) / 4));
    technique = 'picture';
    picture = (['hills', 'waves', 'sunset'] as const)[id % 3];
    shape = (['straight', 'tall-vase', 'round-bottle'] as const)[(id >> 1) % 3];
    limited = true;
  }
  if (id === 1) layers = 3;
  const paletteSize = Math.min(layers, stage === 1 ? layers : stage === 2 ? 4 : stage === 3 ? 5 : 6);
  const palette = picturePalette(picture) ?? pickPalette(rng, set.colours, paletteSize);
  return {
    id,
    stage,
    shape,
    palette,
    layers,
    technique,
    picture,
    limited,
    set: set.name,
    title: `${set.name} ${id - set.first + 1}`,
    seed: 1000 + id,
  };
}

function picturePalette(p: Plan['picture']): number[] | null {
  if (p === 'hills') return [2, 4, 5, 6, 8, 3];
  if (p === 'waves') return [6, 5, 8, 3, 7];
  if (p === 'sunset') return [6, 8, 3, 2, 1, 7];
  return null;
}

export function dailyPlan(i: number): Plan {
  const rng = new Rng(4242 + i * 104729);
  const id = 1001 + i;
  const techniques: JarDef['technique'][] = ['flat', 'mounds', 'slopes', 'zigzag', 'picture'];
  const technique = techniques[i % techniques.length];
  const shape = (['straight', 'round-bottle', 'tall-vase'] as const)[Math.floor(i / 5) % 3];
  const layers = technique === 'picture' ? 9 : 4 + rng.int(4);
  const set = SETS[rng.int(SETS.length)];
  const picture = technique === 'picture' ? (['hills', 'waves', 'sunset'] as const)[i % 3] : undefined;
  const palette = picturePalette(picture) ?? pickPalette(rng, set.colours, Math.min(layers, 5));
  return {
    id,
    stage: technique === 'picture' ? 4 : technique === 'zigzag' ? 3 : 2,
    shape,
    palette,
    layers,
    technique,
    picture,
    limited: i % 2 === 1,
    set: 'Daily',
    title: `Daily ${i + 1}`,
    seed: 5000 + i,
  };
}

/** Pours a plan. Variant changes the random choices if a first attempt fails validation. */
export function pourPlan(plan: Plan, variant = 0): Designer {
  const rng = new Rng(plan.seed * 31 + variant * 977);
  const d = new Designer(plan.shape, plan.seed);
  const mask = d.mask;
  const cap = mask.capacity;
  const bottle = plan.shape === 'round-bottle';
  const mid = Math.floor((mask.openLeft + mask.openRight) / 2);
  const span = mask.openRight - mask.openLeft;
  const randCol = () => mask.openLeft + 6 + rng.int(Math.max(1, span - 12));
  const tiltAmt = () => 22 + rng.int(7);

  if (plan.technique === 'picture') {
    pourPicture(d, plan, rng);
    return d;
  }

  const seq = layerColours(rng, plan.palette, plan.layers);
  const fr = fractions(rng, plan.layers);
  let side = rng.int(2) ? 1 : -1;
  for (let i = 0; i < plan.layers - 1; i++) {
    const c = seq[i];
    const amt = Math.round(fr[i] * cap);
    switch (plan.technique) {
      case 'flat':
        d.sweep(c, amt);
        break;
      case 'mounds':
        if (i % 2 === 1 || bottle) d.at(c, bottle ? mid + rng.int(9) - 4 : randCol(), amt, 1 + rng.int(3));
        else d.sweep(c, amt);
        break;
      case 'slopes':
        if (i % 2 === 1) {
          d.tilt(side * tiltAmt());
          d.sweep(c, amt);
          d.tilt(0);
          side = -side;
        } else d.sweep(c, amt);
        break;
      case 'zigzag':
        d.tilt(side * tiltAmt());
        d.sweep(c, amt);
        side = -side;
        break;
    }
  }
  if (plan.technique === 'zigzag') d.tilt(0);
  d.fillUp(seq[plan.layers - 1], bottle);
  d.settle();
  void mid;
  return d;
}

function pourPicture(d: Designer, plan: Plan, rng: Rng): void {
  const mask = d.mask;
  const cap = mask.capacity;
  const bottle = plan.shape === 'round-bottle';
  const lo = mask.openLeft;
  const hi = mask.openRight;
  const mid = Math.floor((lo + hi) / 2);
  const span = hi - lo;
  const L = plan.layers;
  const part = (k: number) => Math.round((cap * k) / (L + 2));
  const at = (frac: number) => lo + Math.round(span * frac);

  if (plan.picture === 'hills') {
    // Earth, rolling hills, then sky with a band of cloud.
    d.sweep(2, part(1));
    d.sweep(3, part(0.6));
    d.at(4, at(0.25 + rng.int(10) / 100), part(1.3), 2);
    d.at(5, at(0.7 + rng.int(10) / 100), part(1.1), 2);
    d.at(4, at(0.5), part(0.8), 1);
    d.sweep(6, part(0.6));
    for (let i = 0; i < L - 7; i++) d.sweep(i % 2 ? 8 : 6, part(0.45));
    d.tilt(rng.int(2) ? 24 : -24);
    d.sweep(8, part(0.6));
    d.tilt(0);
    d.fillUp(6, bottle);
  } else if (plan.picture === 'waves') {
    const cols = [6, 5, 8, 6, 5, 3, 6, 8, 5, 7, 6, 5];
    let side = 1;
    d.sweep(3, part(0.9));
    for (let i = 0; i < L - 2; i++) {
      d.tilt(side * (18 + rng.int(10)));
      d.sweep(cols[i % cols.length], part(0.8));
      side = -side;
    }
    d.tilt(0);
    d.fillUp(7, bottle);
  } else {
    // Sunset: sea, shore line, a rising sun, bands of evening sky.
    d.sweep(6, part(1.3));
    d.sweep(8, part(0.35));
    d.at(3, mid + rng.int(7) - 3, part(1.2), 1);
    d.sweep(2, part(0.8));
    const sky = [1, 2, 1, 7, 1, 7, 6];
    for (let i = 0; i < L - 5; i++) d.sweep(sky[i % sky.length], part(0.7));
    d.fillUp(7, bottle);
  }
  d.settle();
}

/** Pours, records, verifies by replay, and packages a jar. */
export function author(plan: Plan): Authored {
  let best: Authored | null = null;
  for (let variant = 0; variant < 8; variant++) {
    const d = pourPlan(plan, variant);
    const sim = d.sim;
    const mask = sim.mask;
    const target = sim.cells.slice();
    const rec = encodeRecording(sim.recording);

    // Replay from the encoded recording – must reproduce the grid exactly.
    const again = replay(mask, plan.seed, null, decodeRecording(rec));
    const tol = toleranceMap(target, mask);
    const selfScore = accuracy(again.cells, tol, mask, target);

    // Worst case "one colour only" pour.
    let worst = 0;
    for (const c of plan.palette) {
      const fake = new Uint8Array(target.length);
      for (let i = 0; i < fake.length; i++) if (mask.inside[i] && target[i]) fake[i] = c;
      worst = Math.max(worst, accuracy(fake, tol, mask, target));
    }

    let limits: Record<string, number> | null = null;
    if (plan.limited) {
      limits = {};
      for (const c of plan.palette) {
        const used = sim.used[c];
        limits[c] = Math.ceil(used * (1 + TUNING.LIMIT_MARGIN));
      }
    }
    const palette = plan.palette.filter((c) => sim.used[c] > 0);
    const def: JarDef = {
      id: plan.id,
      stage: plan.stage,
      shape: plan.shape,
      palette,
      limits,
      target: encodeGrid(target),
      set: plan.set,
      seed: plan.seed,
      layers: plan.layers,
      technique: plan.technique,
      title: plan.title,
    };
    const result: Authored = { def, recording: rec, worstSingleColour: worst, selfScore };
    if (!best || worst < best.worstSingleColour) best = result;
    if (worst < TUNING.STAR_1 - 0.03 && selfScore >= TUNING.DESIGNER_MIN_SELF_SCORE) return result;
  }
  return best!;
}

export function targetGrid(def: JarDef): Uint8Array {
  const m = maskFor(def.shape);
  return decodeGrid(def.target, m.w * m.h);
}

/**
 * The cat's hidden zone of acceptable attention. Self-contained (spec A6): knows nothing of either game.
 */
import { type Rng, range } from './rng';

export interface Band {
  centre: number;
  halfWidth: number;
  target: number;
  nextDrift: number;
  drifts: boolean;
  /** Limits the centre may take (Today's Mood can narrow these) */
  lo: number;
  hi: number;
}

export interface BandConfig {
  min: number;
  max: number;
  driftEvery: readonly [number, number];
  driftSpeed: number;
}

export function makeBand(rng: Rng, cfg: BandConfig, opts: { halfWidth: number; drifts: boolean; centre?: number; lo?: number; hi?: number }): Band {
  const lo = Math.max(cfg.min, opts.lo ?? cfg.min);
  const hi = Math.min(cfg.max, opts.hi ?? cfg.max);
  const centre = clamp(opts.centre ?? (lo + hi) / 2, lo, hi);
  return { centre, halfWidth: opts.halfWidth, target: centre, nextDrift: range(rng, cfg.driftEvery[0], cfg.driftEvery[1]), drifts: opts.drifts, lo, hi };
}

export function stepBand(b: Band, rng: Rng, time: number, dt: number, cfg: BandConfig) {
  if (!b.drifts) return;
  if (time >= b.nextDrift) {
    b.target = range(rng, b.lo, b.hi);
    b.nextDrift = time + range(rng, cfg.driftEvery[0], cfg.driftEvery[1]);
  }
  const step = cfg.driftSpeed * dt;
  const d = b.target - b.centre;
  b.centre = clamp(b.centre + clamp(d, -step, step), b.lo, b.hi);
}

/** Negative: points below the band. Positive: points above. Zero: inside. */
export function bandOffset(b: Band, attention: number): number {
  const lo = b.centre - b.halfWidth;
  const hi = b.centre + b.halfWidth;
  if (attention < lo) return attention - lo;
  if (attention > hi) return attention - hi;
  return 0;
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

import { type Rng, range } from './rng';

export type BrainPhase = 'away' | 'arriving' | 'present';
/** `t` is the time left in the phase; `full` is how long the current visit was when it began. */
export interface BrainCell { phase: BrainPhase; t: number; full?: number }
export interface BrainConfig { away: readonly [number, number]; arriving: number; present: readonly [number, number] }

/** All orange cats share one brain cell. A moment always starts with it away. */
export function makeBrainCell(rng: Rng, cfg: BrainConfig): BrainCell {
  return { phase: 'away', t: range(rng, cfg.away[0], cfg.away[1]) };
}

/** Advances the Brain Cell. Returns the phase it changed to, if any. */
export function stepBrainCell(b: BrainCell, rng: Rng, dt: number, cfg: BrainConfig): BrainPhase | null {
  b.t -= dt;
  if (b.phase === 'away' && b.t <= cfg.arriving) {
    b.phase = 'arriving';
    return 'arriving';
  }
  if (b.t > 0) return null;
  if (b.phase === 'present') {
    b.phase = 'away';
    b.t = range(rng, cfg.away[0], cfg.away[1]);
    return 'away';
  }
  b.phase = 'present';
  b.t = range(rng, cfg.present[0], cfg.present[1]);
  b.full = b.t;
  return 'present';
}

import type { MomentState } from '../types';
import type { HandFrame } from '../hand';
import { hoover } from './hoover';
import { guest } from './guest';

/** Each week's difficulty has the same shape (§12), so later weeks add one module each. */
export interface DifficultyModule {
  id: 'hoover' | 'guest';
  start(s: MomentState): void;
  /** Effect each step; returns extra Irritation per second, and whether attention is suspended */
  step(s: MomentState, dt: number, f: HandFrame): { irritation: number; suspend: boolean };
  onPlayerAction(s: MomentState, action: string): void;
  objectiveMet(s: MomentState): boolean;
}

export const DIFFICULTIES: Record<'hoover' | 'guest', DifficultyModule> = { hoover, guest };

export function difficultyModule(s: MomentState) {
  return s.difficulty ? DIFFICULTIES[s.difficulty.id] : null;
}

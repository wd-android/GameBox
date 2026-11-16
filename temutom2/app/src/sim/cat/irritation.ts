import { clamp } from './band';

export interface IrritationConfig {
  inBand: number;
  belowBase: number;
  belowPerPoint: number;
  aboveBase: number;
  abovePerPoint: number;
}

/** Irritation per second for a given band offset (too much attention irritates faster than too little). */
export function irritationRate(offset: number, cfg: IrritationConfig): number {
  if (offset === 0) return cfg.inBand;
  if (offset < 0) return cfg.belowBase + cfg.belowPerPoint * -offset;
  return cfg.aboveBase + cfg.abovePerPoint * offset;
}

export function addIrritation(i: number, v: number) {
  return clamp(i + v, 0, 100);
}

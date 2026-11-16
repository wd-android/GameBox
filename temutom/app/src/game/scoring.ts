import { TUNING } from '../config/tuning';
import type { ShiftState } from '../sim/types';
import { onThrone } from '../sim/thrones';
import { TOTAL_STARS } from '../content/shifts';

const S = TUNING.scoring;

export interface ScoreParts { demands: number; band: number; morale: number; throne: number; total: number }

/** Score out of 100 (spec §12.2) */
export function scoreShift(s: ShiftState): ScoreParts {
  const issued = s.tally.issued;
  const demands = issued === 0 ? S.demands : S.demands * Math.min(1, s.tally.met / issued);
  const band = S.band * Math.min(1, s.tally.secondsInBand / s.length);
  const morale = S.morale * (s.def.systems.morale ? s.morale / 100 : 1);
  const throne = onThrone(s) ? S.throne : 0;
  const total = Math.round(demands + band + morale + throne);
  return { demands, band, morale, throne, total };
}

export function starsFor(objectiveMet: boolean, score: number, thresholds?: { two: number; three: number }): number {
  if (!objectiveMet) return 0;
  const two = thresholds?.two ?? S.twoStars;
  const three = thresholds?.three ?? S.threeStars;
  if (score >= three) return 3;
  if (score >= two) return 2;
  return 1;
}

/** Ranks, scaled from the specification's 210 stars to this build's three weeks */
export const RANKS = [
  { name: 'Nuisance', at: 0 },
  { name: 'Menace', at: Math.round((40 / 210) * TOTAL_STARS) },
  { name: 'Despot', at: Math.round((90 / 210) * TOTAL_STARS) },
  { name: 'Tyrant', at: Math.round((140 / 210) * TOTAL_STARS) },
  { name: 'Emperor', at: Math.round((190 / 210) * TOTAL_STARS) },
];

export function rankFor(stars: number) {
  let r = RANKS[0];
  for (const x of RANKS) if (stars >= x.at) r = x;
  const idx = RANKS.indexOf(r);
  const nextRank = RANKS[idx + 1] ?? null;
  return { rank: r.name, next: nextRank?.name ?? null, nextAt: nextRank?.at ?? null };
}

import { TUNING } from '../config/tuning';
import type { MomentState } from '../sim/types';
import { choreFraction } from '../sim/chores';

const S = TUNING.scoring;

export interface ScoreParts { chore: number; content: number; firstTime: number; plasters: number; total: number }

/** Score out of 100 (§13.2) */
export function scoreMoment(s: MomentState): ScoreParts {
  const chore = s.chore ? S.chore * choreFraction(s.chore) : S.chore;
  const content = S.content * (s.tally.onScreenSecs > 0 ? Math.min(1, s.tally.contentSecs / s.tally.onScreenSecs) : 1);
  const firstTime = s.tally.issued ? S.firstTime * Math.min(1, s.tally.firstTime / s.tally.issued) : S.firstTime;
  const plasters = S.plasters * (s.plastersStart ? s.plasters / s.plastersStart : 1);
  return { chore, content, firstTime, plasters, total: Math.round(chore + content + firstTime + plasters) };
}

export function starsFor(met: boolean, score: number) {
  if (!met) return 0;
  if (score >= S.three) return 3;
  if (score >= S.two) return 2;
  return 1;
}

/** Standing (§13.3) */
export const STANDING = [
  { name: 'Intruder', at: 0, minWarning: 0.8, bandBonus: 0, unlock: '' },
  { name: 'Staff', at: 40, minWarning: 0.9, bandBonus: 1, unlock: 'He answers a slow blink' },
  { name: 'Adequate Staff', at: 90, minWarning: 1.0, bandBonus: 2, unlock: 'The head-butt' },
  { name: 'Preferred Lap', at: 140, minWarning: 1.2, bandBonus: 3, unlock: 'He sleeps on finished chores' },
  { name: '“Mine”', at: 190, minWarning: 1.4, bandBonus: 4, unlock: 'He sleeps on you at the end of each day' },
] as const;

/** Every 10 lapses seen counts as one extra star towards Standing, up to 10 stars. */
export function standingStars(stars: number, lapsesSeen: number) {
  return stars + Math.min(10, Math.floor(lapsesSeen / 10));
}

export function standingFor(points: number) {
  let rank = 0;
  STANDING.forEach((r, i) => { if (points >= r.at) rank = i; });
  const r = STANDING[rank];
  return { rank, name: r.name, minWarning: r.minWarning, bandBonus: r.bandBonus, next: STANDING[rank + 1] ?? null };
}

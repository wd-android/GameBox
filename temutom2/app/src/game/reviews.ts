import { DAY_PHRASES, REVIEW, VERDICTS } from '../content/lines';
import type { MomentState } from '../sim/types';

export type ReviewKey = keyof typeof REVIEW;

/** The most notable thing the player did, in the order of §14.3 */
export function reviewKey(s: MomentState, stars: number): ReviewKey {
  const t = s.tally;
  if (t.bellyBites > 0) return 'bellyBite';
  if (t.slowest > 14) return 'slow';
  if (t.wrong >= 2) return 'wrong';
  if (t.lifted > 0) return 'lifted';
  if (t.schemesStopped > 0) return 'schemeStopped';
  if (t.plastersLost === 0 && stars === 3) return 'perfect';
  if (t.lapsesSeen > 0) return 'lapseSeen';
  return 'none';
}

export function verdictFor(avg: number) {
  let v = VERDICTS[0].name;
  for (const x of VERDICTS) if (avg >= x.at) v = x.name;
  return v;
}

export interface DayCard { week: number; day: number; date: string; average: number; paragraph: string; verdict: string }

export function dayCard(week: number, day: number, scores: number[], keys: ReviewKey[], date: string): DayCard {
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const counts = new Map<ReviewKey, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]).filter((k) => k !== 'none');
  const parts = (ranked.length ? ranked.slice(0, 3) : ['none' as ReviewKey]).map((k) => DAY_PHRASES[k]);
  return { week, day, date, average, paragraph: parts.join(' '), verdict: verdictFor(average) };
}

export function dayCardText(c: DayCard) {
  return `Temutom’s review of you — Week ${c.week}, Day ${c.day}\n\nYou. ${c.paragraph} ${c.verdict}.`;
}

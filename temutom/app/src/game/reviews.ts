import { DAY_PARAGRAPHS, REVIEW_LINES, VERDICTS } from '../content/lines';
import { STAFF } from '../content/staff';
import type { ShiftState, StaffId, StaffState } from '../sim/types';

export type ReviewCondition = keyof typeof REVIEW_LINES;

/** The condition that best describes a staff member's shift, in the order of spec §13.2 */
export function conditionFor(m: StaffState): ReviewCondition {
  const st = m.stats;
  if (st.slowest > 10) return 'slow';
  if (st.wrong >= 2) return 'wrong';
  if (st.overStroke > 8) return 'overStroke';
  if (st.anticipated > 0) return 'anticipated';
  if (st.evicted > 0) return 'evicted';
  if (st.bitten > 0) return 'bitten';
  if (st.served > 0) return 'served';
  return 'none';
}

function fill(line: string, n: number) {
  return line.replace('{n}', String(Math.round(n)));
}

export interface StaffReview { staff: StaffId; condition: ReviewCondition; line: string }

export function shiftReviews(s: ShiftState, pickIndex: (n: number) => number): StaffReview[] {
  const seen = new Set<StaffId>();
  const out: StaffReview[] = [];
  for (const m of s.staff) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const c = conditionFor(m);
    const lines = REVIEW_LINES[c];
    const n = c === 'slow' ? m.stats.slowest : m.stats.wrong;
    out.push({ staff: m.id, condition: c, line: fill(lines[pickIndex(lines.length)], n) });
  }
  return out;
}

export function verdictFor(avg: number) {
  let v = VERDICTS[0].name;
  for (const x of VERDICTS) if (avg >= x.at) v = x.name;
  return v;
}

export interface DayCard {
  week: number;
  day: number;
  date: string;
  average: number;
  staff: { staff: StaffId; paragraph: string; verdict: string }[];
}

export function dayCard(week: number, day: number, scores: number[], conditions: Partial<Record<StaffId, ReviewCondition[]>>, date: string): DayCard {
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const staff = (Object.keys(conditions) as StaffId[]).map((id) => {
    const cs = conditions[id] ?? [];
    const counts = new Map<ReviewCondition, number>();
    for (const c of cs) counts.set(c, (counts.get(c) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const top = ranked.filter((c) => c !== 'none').slice(0, 2);
    const parts = (top.length ? top : ['none' as ReviewCondition]).map((c) => DAY_PARAGRAPHS[c]);
    return { staff: id, paragraph: parts.join(' '), verdict: verdictFor(average) };
  });
  return { week, day, date, average, staff };
}

export function dayCardText(card: DayCard) {
  const head = `Temutom’s review of the staff — Week ${card.week}, Day ${card.day}`;
  const body = card.staff.map((x) => `${STAFF[x.staff].name} (${STAFF[x.staff].title}). ${x.paragraph} ${x.verdict}.`).join('\n\n');
  return `${head}\n\n${body}`;
}

import type { ShiftState } from '../sim/types';
import type { SaveData } from '../state/save';
import { scoreShift, starsFor } from './scoring';
import { shiftReviews, dayCard, type DayCard, type StaffReview } from './reviews';
import { moraleBetweenShifts } from '../sim/morale';
import { SHIFTS } from '../content/shifts';
import { dateKey, previousKey, prettyDate } from './daily';
import { OBJECTS } from '../content/rooms';

export interface ShiftResult {
  shiftId: string;
  won: boolean;
  reason: ShiftState['endReason'];
  score: number;
  parts: ReturnType<typeof scoreShift>;
  stars: number;
  best: number;
  reviews: StaffReview[];
  newCabinet: string[];
  throneClaimed: boolean;
  dayCard: DayCard | null;
  daily: { scored: boolean; text: string } | null;
}

const rand = (n: number) => Math.floor(Math.random() * n);

/** Apply a finished shift to the save. Returns the result to show. Mutates `save`. */
export function applyShiftResult(save: SaveData, s: ShiftState): ShiftResult {
  const parts = scoreShift(s);
  const won = s.status === 'won';
  const stars = starsFor(won, parts.total, s.def.stars);
  const reviews = shiftReviews(s, rand);
  const newCabinet: string[] = [];
  for (const k of s.tally.knocked) if (!save.cabinet.includes(k) && OBJECTS[k] && !newCabinet.includes(k)) newCabinet.push(k);
  let dayCardOut: DayCard | null = null;
  let daily: ShiftResult['daily'] = null;
  save.played++;

  if (s.def.daily) {
    const key = s.def.id.replace('daily-', '');
    const scored = save.daily.history[key] === undefined;
    if (scored) {
      save.daily.history[key] = parts.total;
      save.daily.streak = save.daily.last === previousKey(key) ? save.daily.streak + 1 : 1;
      save.daily.last = key;
      const quote = reviews.find((r) => r.condition !== 'none')?.line ?? reviews[0]?.line ?? 'Present.';
      save.daily.quote[key] = quote;
    }
    const q = save.daily.quote[key] ?? reviews[0]?.line ?? '';
    daily = { scored, text: `Temutom’s Daily Grievance, ${prettyDate(key)}: ${save.daily.history[key]}. ‘${q}’` };
    save.cabinet.push(...newCabinet);
    return { shiftId: s.def.id, won, reason: s.endReason, score: parts.total, parts, stars, best: parts.total, reviews, newCabinet, throneClaimed: false, dayCard: null, daily };
  }

  const prev = save.shifts[s.def.id] ?? { stars: 0, best: 0 };
  save.shifts[s.def.id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, won ? parts.total : 0) };
  save.cabinet.push(...newCabinet);

  // Compliance and morale are kept only from completed shifts (spec §8.2, §15)
  const throneClaimed = s.throne.claimedNow && !save.thrones.includes(s.def.room);
  if (won) {
    for (const m of s.staff) save.compliance[m.id] = { ...m.compliance };
    if (throneClaimed) save.thrones.push(s.def.room);
  }
  const dayKey = `w${s.def.week}d${s.def.day}`;
  const newDay = save.lastPlayed !== dayKey;
  save.morale = moraleBetweenShifts(won ? s.morale : Math.max(s.morale, 40), newDay);
  save.lastPlayed = dayKey;

  for (const r of reviews) {
    const list = save.staffReviews[r.staff];
    list.unshift(`W${s.def.week} D${s.def.day} ${s.def.slot}: ${r.line}`);
    if (list.length > 30) list.length = 30;
  }

  if (won) {
    const log = (save.dayLog[dayKey] ??= { scores: {}, conditions: {} });
    log.scores[s.def.id] = parts.total;
    for (const r of reviews) (log.conditions[r.staff] ??= []).push(r.condition);
    const dayShifts = SHIFTS.filter((x) => x.week === s.def.week && x.day === s.def.day);
    const done = dayShifts.every((x) => log.scores[x.id] !== undefined);
    const already = save.archive.some((c) => c.week === s.def.week && c.day === s.def.day);
    if (done && !already) {
      dayCardOut = dayCard(s.def.week, s.def.day, Object.values(log.scores), log.conditions, dateKey(new Date()));
      save.archive.unshift(dayCardOut);
    }
  }

  return { shiftId: s.def.id, won, reason: s.endReason, score: parts.total, parts, stars, best: save.shifts[s.def.id].best, reviews, newCabinet, throneClaimed, dayCard: dayCardOut, daily };
}

export function totalStars(save: SaveData) {
  return Object.values(save.shifts).reduce((a, b) => a + b.stars, 0);
}

/** First shift not yet completed, in order */
export function nextShift(save: SaveData) {
  return SHIFTS.find((x) => !(save.shifts[x.id]?.stars > 0)) ?? SHIFTS[SHIFTS.length - 1];
}

export function isUnlocked(save: SaveData, id: string) {
  const idx = SHIFTS.findIndex((x) => x.id === id);
  if (idx <= 0) return true;
  return (save.shifts[SHIFTS[idx - 1].id]?.stars ?? 0) > 0 || (save.shifts[id]?.stars ?? 0) > 0;
}

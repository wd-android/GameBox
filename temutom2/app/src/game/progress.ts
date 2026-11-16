import type { MomentState } from '../sim/types';
import type { SaveData } from '../state/save';
import { scoreMoment, standingFor, standingStars, starsFor } from './scoring';
import { dayCard, reviewKey, type DayCard, type ReviewKey } from './reviews';
import { REVIEW } from '../content/lines';
import { MOMENTS } from '../content/moments';
import { FIELD_NOTES } from '../content/fieldNotes';

const NOTE_IDS = new Set(FIELD_NOTES.map((f) => f.id));
import { dateKey, prettyDate, previousKey } from './daily';

export interface MomentResult {
  id: string;
  won: boolean;
  reason: MomentState['endReason'];
  score: number;
  parts: ReturnType<typeof scoreMoment>;
  stars: number;
  review: string;
  reviewKey: ReviewKey;
  newNotes: string[];
  newCabinet: string[];
  dayCard: DayCard | null;
  daily: { scored: boolean; text: string } | null;
  standingUp: string | null;
}

export function totalStars(save: SaveData) {
  return Object.values(save.moments).reduce((a, b) => a + b.stars, 0);
}

export function standing(save: SaveData) {
  return standingFor(standingStars(totalStars(save), save.lapsesSeen));
}

export function applyResult(save: SaveData, s: MomentState): MomentResult {
  const parts = scoreMoment(s);
  const won = s.status === 'won';
  const stars = starsFor(won, parts.total);
  const key = reviewKey(s, stars);
  const before = standing(save).name;
  // The simulation records more than the journal holds; only real entries are kept and counted.
  const newNotes = s.tally.notes.filter((n) => NOTE_IDS.has(n) && !save.notes.includes(n));
  save.notes.push(...newNotes);
  const newCabinet = [...new Set(s.tally.knocked)].filter((k) => !save.cabinet.includes(k));
  save.cabinet.push(...newCabinet);
  save.lapsesSeen += s.tally.lapsesSeen;
  save.marks = s.marks.map((m) => ({ ...m, born: 0 }));
  save.played++;
  let card: DayCard | null = null;
  let daily: MomentResult['daily'] = null;
  if (s.def.daily) {
    const k = s.def.id.replace('mood-', '');
    const scored = save.mood.history[k] === undefined;
    if (scored) {
      save.mood.history[k] = parts.total;
      save.mood.streak = save.mood.last === previousKey(k) ? save.mood.streak + 1 : 1;
      save.mood.last = k;
      save.mood.quote[k] = REVIEW[key];
    }
    daily = { scored, text: `Living with Temutom, ${prettyDate(k)}: ${save.mood.history[k]}. ‘${save.mood.quote[k]}’` };
  } else {
    const prev = save.moments[s.def.id] ?? { stars: 0, best: 0 };
    save.moments[s.def.id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, won ? parts.total : 0) };
    if (won) {
      const dk = `w${s.def.week}d${s.def.day}`;
      const log = (save.dayLog[dk] ??= { scores: {}, keys: {} });
      if (Array.isArray(log.keys)) log.keys = {}; // older saves kept a list, which counted replays twice
      log.scores[s.def.id] = parts.total;
      log.keys[s.def.id] = key;
      const all = MOMENTS.filter((m) => m.week === s.def.week && m.day === s.def.day).every((m) => log.scores[m.id] !== undefined);
      if (all && !save.archive.some((c) => c.week === s.def.week && c.day === s.def.day)) {
        card = dayCard(s.def.week, s.def.day, Object.values(log.scores), Object.values(log.keys), dateKey(new Date()));
        save.archive.unshift(card);
        if (standing(save).rank >= 4 && !save.notes.includes('love-sleep')) save.notes.push('love-sleep');
      }
    }
  }
  const after = standing(save).name;
  return { id: s.def.id, won, reason: s.endReason, score: parts.total, parts, stars, review: REVIEW[key], reviewKey: key, newNotes, newCabinet, dayCard: card, daily, standingUp: after !== before ? after : null };
}

export function nextMoment(save: SaveData) {
  return MOMENTS.find((m) => !(save.moments[m.id]?.stars > 0)) ?? MOMENTS[MOMENTS.length - 1];
}

export function isUnlocked(save: SaveData, id: string) {
  const i = MOMENTS.findIndex((m) => m.id === id);
  return i <= 0 || (save.moments[MOMENTS[i - 1].id]?.stars ?? 0) > 0 || (save.moments[id]?.stars ?? 0) > 0;
}

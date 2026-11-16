import type { ChoreKind, MomentDef, Modifier, PlaceId } from '../sim/types';
import { hashString, makeRng, pick } from '../sim/cat';
import { PLACES, PLACE_ORDER } from '../content/places';

export const MOODS: { id: Modifier; name: string; blurb: string }[] = [
  { id: 'wokeUpWrong', name: 'Woke up wrong', blurb: 'He wants hardly any attention today.' },
  { id: 'needy', name: 'Needy', blurb: 'He wants a great deal of attention today.' },
  { id: 'raining', name: 'It is raining, and this is your fault', blurb: 'He wants the door. The door is never enough.' },
  { id: 'box', name: 'The box', blurb: 'There is a box. Lapses twice as often.' },
  { id: 'ravenous', name: 'Ravenous', blurb: 'Food. Only food. Every ten seconds.' },
];

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function prettyDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export function previousKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

const CHORE_FOR: Record<PlaceId, ChoreKind | null> = { kitchen: 'coffee', study: 'email', sofa: 'tidy', bedroom: 'washing', hallway: null };

/** Today's Mood (§13.5): the same moment for everyone on a date, at late Week 2 difficulty. */
export function todaysMood(key: string): MomentDef {
  const seed = hashString(`mood:${key}`);
  const r = makeRng(seed);
  const modifier = pick(r, MOODS).id;
  let place: PlaceId = pick(r, PLACE_ORDER);
  if (modifier === 'ravenous') place = 'kitchen';
  if (modifier === 'raining' && !PLACES[place].demands.includes('door')) place = 'hallway';
  if (modifier === 'box') place = 'sofa';
  const chore = CHORE_FOR[place];
  return {
    id: `mood-${key}`, week: 2, day: 6, slot: 'afternoon', place, seed, length: 90, chore,
    objective: chore ? { kind: 'finishChore' } : { kind: 'serve', n: 4 },
    band: { halfWidth: 13, drifts: true },
    demands: { interval: modifier === 'ravenous' ? [10, 10] : [12, 16] },
    systems: { plasters: true, belly: true, chores: true, treats: true, lift: true, ladderMax: 6, brainCell: true, lapses: true, schemes: true, shortTells: true, queue: true },
    modifiers: [modifier], title: MOODS.find((m) => m.id === modifier)!.name, daily: true, startPos: 'near',
  };
}

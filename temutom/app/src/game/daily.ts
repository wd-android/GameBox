import type { Modifier, RoomId, ShiftDef, ShiftStaffSpec } from '../sim/types';
import { hashString, makeRng, pick, range } from '../sim/rng';
import { ROOM_ORDER, ROOMS } from '../content/rooms';

export const MODIFIERS: { id: Modifier; name: string; blurb: string }[] = [
  { id: 'halfEmptyBowl', name: 'The bowl is half empty', blurb: 'Food must be served twice.' },
  { id: 'bathNight', name: 'Bath night', blurb: 'Wendy tries to pick you up every fifteen seconds.' },
  { id: 'box', name: 'The box', blurb: 'There is a box. You know what happens.' },
  { id: 'closedDoors', name: 'Closed doors', blurb: 'Every door starts shut.' },
  { id: 'visitors', name: 'Visitors', blurb: 'Auntie Pat is here. Also soft.' },
];

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The Daily Grievance: the same shift for everyone on a given date (spec §12.5). */
export function dailyShift(key: string): ShiftDef {
  const seed = hashString(`daily:${key}`);
  const r = makeRng(seed);
  const modifier = pick(r, MODIFIERS).id;
  let room: RoomId = pick(r, ROOM_ORDER);
  if (modifier === 'halfEmptyBowl') room = 'kitchen';
  const staff: ShiftStaffSpec[] = [{ id: 'soft' }, { id: 'busy' }];
  if (modifier === 'visitors') staff.push({ id: 'soft2' });
  const kinds = ROOMS[room].demands;
  return {
    id: `daily-${key}`, week: 2, day: 6, slot: 'afternoon', room, seed, length: 90,
    staff, objective: { kind: 'serve', n: 3 },
    band: { halfWidth: 11, drifts: true },
    demands: { interval: [Math.round(range(r, 9, 11)), Math.round(range(r, 12, 15))], kinds, maxActive: 2 },
    systems: { band: true, irritation: true, compliance: true, morale: true, brainCell: true, verbs: ['scream', 'stare', 'smack', 'sitOn', 'knockOff'] },
    modifiers: [modifier], title: MODIFIERS.find((m) => m.id === modifier)!.name, daily: true,
  };
}

export function prettyDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function previousKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

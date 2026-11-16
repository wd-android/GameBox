import type { ChoreKind, DemandKind, MomentDef, Objective, PlaceId, ScriptEvent, Slot, Systems } from '../sim/types';
import { SLOTS } from '../sim/types';
import { hashString } from '../sim/cat';

/**
 * v1: Weeks 1 (The Hoover) and 2 (The Houseguest), 35 moments each, written by hand (A4)
 * in the teaching order of spec §13.4.
 */
export const WEEKS = [
  { n: 1, difficulty: 'The Hoover', blurb: 'You must hoover the house. He regards this as an act of war.' },
  { n: 2, difficulty: 'The Houseguest', blurb: 'A visitor’s hand keeps reaching in to stroke him, badly. Protect the visitor.' },
] as const;

function systems(week: number, day: number): Systems {
  if (week === 2) {
    return { plasters: true, belly: true, chores: true, treats: true, lift: true, ladderMax: 6, brainCell: true, lapses: true, schemes: true, shortTells: true, queue: true };
  }
  return {
    plasters: day >= 2,
    belly: day >= 2,
    chores: day >= 3,
    treats: day >= 3,
    lift: day >= 3,
    ladderMax: day >= 5 ? 6 : 2,
    brainCell: day >= 6,
    lapses: day >= 6,
    schemes: day >= 6,
    shortTells: false,
    queue: false,
  };
}

interface Row {
  place: PlaceId;
  obj: Objective;
  title: string;
  chore?: ChoreKind;
  length?: number;
  timed?: { t: number; kind: DemandKind; step?: number }[];
  kinds?: DemandKind[];
  interval?: [number, number];
  teach?: string;
  start?: string;
  script?: ScriptEvent[];
  hoover?: number;
  boss?: boolean;
  guest?: boolean;
  noExtraFood?: boolean;
  brainOff?: boolean;
}

const serve = (n: number): Objective => ({ kind: 'serve', n });
const content = (seconds: number): Objective => ({ kind: 'content', seconds });
const survive: Objective = { kind: 'survive' };
const finish: Objective = { kind: 'finishChore' };
const boss: Objective = { kind: 'boss' };

const W1: Row[][] = [
  // Day 1 – Kitchen: Screaming and Food; stroking the head; the purr; the first, scripted swipe
  [
    { place: 'kitchen', obj: survive, title: '4:50am. He is screaming.', length: 45, timed: [{ t: 0, kind: 'food', step: 2 }], start: 'bowl', teach: 'feed', script: [{ t: 28, do: 'swipeFree' }] },
    { place: 'kitchen', obj: content(10), title: 'Head, not tail', length: 60, timed: [{ t: 2, kind: 'food' }], start: 'near', teach: 'stroke' },
    { place: 'kitchen', obj: serve(2), title: 'Second breakfast', length: 70, timed: [{ t: 3, kind: 'food' }, { t: 35, kind: 'food' }], start: 'near' },
    { place: 'kitchen', obj: content(15), title: 'Purring is the target', length: 70, timed: [{ t: 30, kind: 'food' }], start: 'near', teach: 'purr' },
    { place: 'kitchen', obj: serve(3), title: 'Supper, then more supper', length: 80, kinds: ['food'], interval: [14, 20], start: 'near' },
  ],
  // Day 2 – Kitchen: tail and ears; the Warning; lifting the thumb in time; plasters; the belly and the bite
  [
    { place: 'kitchen', obj: survive, title: 'Read the tail', length: 60, timed: [{ t: 3, kind: 'food' }], start: 'near', teach: 'warning' },
    { place: 'kitchen', obj: content(18), title: 'Let go in time', length: 70, kinds: ['food'], interval: [18, 24], start: 'near', teach: 'letGo' },
    { place: 'kitchen', obj: serve(2), title: 'Plasters are finite', length: 75, kinds: ['food'], interval: [16, 22], start: 'near', teach: 'plasters' },
    { place: 'kitchen', obj: survive, title: 'The stomach', length: 70, timed: [{ t: 40, kind: 'food' }], start: 'near', teach: 'belly' },
    { place: 'kitchen', obj: content(25), title: 'A whole minute of purring', length: 80, kinds: ['food'], interval: [16, 22], start: 'near' },
  ],
  // Day 3 – Study: chores; one thumb for two jobs; Sit On; treats and lifting
  [
    { place: 'study', obj: finish, chore: 'email', title: 'Write the email', length: 75, start: 'far', teach: 'chore' },
    { place: 'study', obj: finish, chore: 'email', title: 'He walks across the work', length: 80, start: 'near', teach: 'oneThumb' },
    { place: 'study', obj: finish, chore: 'email', title: 'A treat, elsewhere', length: 80, start: 'near', teach: 'treat' },
    { place: 'study', obj: finish, chore: 'email', title: 'Lift (he will remember)', length: 80, start: 'near', teach: 'lift' },
    { place: 'study', obj: finish, chore: 'email', title: 'Reply all', length: 90, start: 'near' },
  ],
  // Day 4 – Sofa (and the study door): Door, Play and Nothing; reading tells; wrong answers; Lap
  [
    { place: 'sofa', obj: serve(1), chore: 'tidy', title: 'He wants to hunt', length: 75, timed: [{ t: 3, kind: 'play' }], start: 'near', teach: 'play' },
    { place: 'study', obj: serve(2), title: 'Facing the door', length: 75, timed: [{ t: 3, kind: 'door' }, { t: 35, kind: 'door' }], start: 'near', teach: 'door' },
    { place: 'sofa', obj: serve(2), chore: 'tidy', title: 'He wants nothing', length: 80, timed: [{ t: 3, kind: 'nothing' }, { t: 40, kind: 'nothing' }], start: 'near', teach: 'nothing' },
    { place: 'sofa', obj: serve(1), chore: 'tidy', title: 'He has chosen your lap', length: 80, timed: [{ t: 3, kind: 'lap' }], start: 'near', teach: 'lap' },
    { place: 'sofa', obj: serve(3), chore: 'tidy', title: 'Read him', length: 90, kinds: ['lap', 'play', 'nothing'], interval: [14, 20], start: 'near', teach: 'tells' },
  ],
  // Day 5 – Study, sofa: the full escalation ladder
  [
    { place: 'study', obj: serve(2), chore: 'email', title: 'Ignore him and see', length: 80, kinds: ['door', 'nothing'], interval: [16, 22], start: 'near', teach: 'ladder' },
    { place: 'sofa', obj: finish, chore: 'tidy', title: 'The score has fallen off', length: 80, kinds: ['play', 'nothing'], interval: [16, 22], start: 'near', teach: 'knockOff' },
    { place: 'study', obj: finish, chore: 'email', title: 'Sitting on the keys', length: 85, kinds: ['door', 'play'], interval: [16, 22], start: 'near' },
    { place: 'sofa', obj: serve(3), chore: 'tidy', title: 'His face, all of it', length: 85, kinds: ['lap', 'play', 'nothing'], interval: [14, 20], start: 'near', teach: 'closeStare' },
    { place: 'study', obj: finish, chore: 'email', title: 'Deadline', length: 90, kinds: ['door', 'play', 'nothing'], interval: [14, 20], start: 'near' },
  ],
  // Day 6 – Kitchen, study: the Brain Cell; lapses first, then Schemes
  [
    { place: 'kitchen', obj: content(25), title: 'He sees a beetle', length: 80, kinds: ['food', 'nothing'], interval: [18, 24], start: 'near', teach: 'lapse', brainOff: false },
    { place: 'kitchen', obj: finish, chore: 'coffee', title: 'Make the coffee', length: 85, kinds: ['food', 'door', 'nothing'], interval: [16, 22], start: 'near', teach: 'eyes' },
    { place: 'kitchen', obj: finish, chore: 'coffee', title: 'The treat cupboard', length: 85, kinds: ['food', 'door'], interval: [16, 22], start: 'near', teach: 'scheme', noExtraFood: false },
    { place: 'study', obj: finish, chore: 'email', title: 'He has the keyboard', length: 90, kinds: ['door', 'play'], interval: [16, 22], start: 'near', teach: 'keyboard' },
    { place: 'kitchen', obj: finish, chore: 'coffee', title: 'Coffee, no extra food', length: 90, kinds: ['food', 'door', 'nothing'], interval: [16, 22], start: 'near', noExtraFood: true, teach: 'noExtraFood' },
  ],
  // Day 7 – All three: the Hoover; the final moment is three areas
  [
    { place: 'kitchen', obj: boss, title: 'The Hoover comes out', length: 75, hoover: 1, kinds: ['food'], interval: [20, 26], start: 'near', teach: 'hoover' },
    { place: 'study', obj: boss, title: 'Hoover in bursts', length: 80, hoover: 1, kinds: ['door', 'nothing'], interval: [18, 24], start: 'near', teach: 'bursts' },
    { place: 'sofa', obj: boss, title: 'Under the coffee table', length: 85, hoover: 2, kinds: ['play', 'lap'], interval: [18, 24], start: 'near' },
    { place: 'kitchen', obj: boss, title: 'He attacks the Hoover', length: 85, hoover: 2, kinds: ['food', 'door'], interval: [18, 24], start: 'near' },
    { place: 'sofa', obj: boss, title: 'THE HOOVER: three rooms’ worth', length: 90, hoover: 3, kinds: ['play', 'nothing'], interval: [18, 24], start: 'near', boss: true, teach: 'hooverBoss' },
  ],
];

const W2: Row[][] = [
  [
    { place: 'bedroom', obj: finish, chore: 'washing', title: 'Fold the washing', length: 85, kinds: ['lap', 'door'], interval: [14, 20], start: 'near', teach: 'bedroom' },
    { place: 'bedroom', obj: serve(3), chore: 'washing', title: 'Two at once', length: 85, kinds: ['lap', 'door', 'nothing'], interval: [12, 16], start: 'near', teach: 'queue' },
    { place: 'kitchen', obj: finish, chore: 'coffee', title: 'Blink and you miss it', length: 85, kinds: ['food', 'door', 'nothing'], interval: [14, 20], start: 'near', teach: 'shortTells' },
    { place: 'bedroom', obj: content(30), chore: 'washing', title: 'He sleeps on the clean pile', length: 85, kinds: ['lap', 'nothing'], interval: [16, 22], start: 'near' },
    { place: 'sofa', obj: finish, chore: 'tidy', title: 'Narrower margins', length: 90, kinds: ['lap', 'play', 'nothing'], interval: [12, 18], start: 'near' },
  ],
  [
    { place: 'sofa', obj: survive, chore: 'tidy', title: 'A hand reaches in', length: 75, kinds: ['play', 'nothing'], interval: [18, 24], start: 'near', guest: true, teach: 'guest' },
    { place: 'sofa', obj: finish, chore: 'tidy', title: 'Drag the hand away', length: 85, kinds: ['lap', 'play'], interval: [16, 22], start: 'near', guest: true, teach: 'pushGuest' },
    { place: 'kitchen', obj: finish, chore: 'coffee', title: 'A treat, out of reach', length: 85, kinds: ['food', 'nothing'], interval: [16, 22], start: 'near', guest: true, teach: 'lureGuest' },
    { place: 'bedroom', obj: serve(3), chore: 'washing', title: 'He is on the bed. So is she.', length: 85, kinds: ['lap', 'door'], interval: [14, 20], start: 'near', guest: true },
    { place: 'study', obj: finish, chore: 'email', title: 'She has never met a cat', length: 90, kinds: ['door', 'play', 'nothing'], interval: [14, 20], start: 'near', guest: true },
  ],
  [
    { place: 'hallway', obj: serve(2), title: 'The hallway', length: 75, kinds: ['door', 'nothing'], interval: [12, 18], start: 'near', teach: 'hallway' },
    { place: 'hallway', obj: boss, title: 'Hoover the hall', length: 85, hoover: 2, kinds: ['door', 'nothing'], interval: [16, 22], start: 'near' },
    { place: 'bedroom', obj: finish, chore: 'washing', title: 'The door handle', length: 90, kinds: ['door', 'lap'], interval: [14, 20], start: 'near' },
    { place: 'hallway', obj: serve(3), title: 'In. Out. In.', length: 85, kinds: ['door'], interval: [10, 14], start: 'near', guest: true },
    { place: 'kitchen', obj: finish, chore: 'coffee', title: 'Coffee for the visitor', length: 90, kinds: ['food', 'door', 'nothing'], interval: [12, 18], start: 'near', guest: true, noExtraFood: true },
  ],
  [
    { place: 'study', obj: finish, chore: 'email', title: 'Working from home, with company', length: 90, kinds: ['door', 'play'], interval: [12, 18], start: 'near', guest: true },
    { place: 'sofa', obj: content(30), chore: 'tidy', title: 'Everyone on the sofa', length: 85, kinds: ['lap', 'play', 'nothing'], interval: [14, 20], start: 'near', guest: true },
    { place: 'bedroom', obj: finish, chore: 'washing', title: 'Socks, everywhere', length: 90, kinds: ['lap', 'door', 'nothing'], interval: [12, 18], start: 'near' },
    { place: 'kitchen', obj: boss, title: 'Hoover before the visitor is up', length: 85, hoover: 2, kinds: ['food', 'nothing'], interval: [16, 22], start: 'near' },
    { place: 'hallway', obj: survive, title: 'Coats on, coats off', length: 80, kinds: ['door', 'nothing'], interval: [10, 14], start: 'near', guest: true },
  ],
  [
    { place: 'sofa', obj: finish, chore: 'tidy', title: 'The remote is under him', length: 90, kinds: ['lap', 'play', 'nothing'], interval: [12, 16], start: 'near', guest: true },
    { place: 'study', obj: finish, chore: 'email', title: 'He has the keyboard again', length: 90, kinds: ['door', 'play'], interval: [12, 16], start: 'near' },
    { place: 'bedroom', obj: serve(3), chore: 'washing', title: 'Laundry day', length: 90, kinds: ['lap', 'door', 'nothing'], interval: [12, 16], start: 'near', guest: true },
    { place: 'kitchen', obj: finish, chore: 'coffee', title: 'Third coffee', length: 90, kinds: ['food', 'door', 'nothing'], interval: [12, 16], start: 'near', guest: true },
    { place: 'hallway', obj: boss, title: 'Hoover the stairs', length: 90, hoover: 3, kinds: ['door'], interval: [16, 22], start: 'near' },
  ],
  [
    { place: 'kitchen', obj: content(30), title: 'A quiet breakfast', length: 85, kinds: ['food', 'nothing'], interval: [12, 16], start: 'near', guest: true },
    { place: 'sofa', obj: finish, chore: 'tidy', title: 'Guests and ornaments', length: 90, kinds: ['lap', 'play'], interval: [12, 16], start: 'near', guest: true },
    { place: 'study', obj: finish, chore: 'email', title: 'Reply to everyone', length: 90, kinds: ['door', 'play', 'nothing'], interval: [10, 14], start: 'near', guest: true },
    { place: 'bedroom', obj: finish, chore: 'washing', title: 'Fold around him', length: 90, kinds: ['lap', 'door'], interval: [10, 14], start: 'near' },
    { place: 'hallway', obj: serve(4), title: 'Everyone is leaving, slowly', length: 90, kinds: ['door', 'nothing'], interval: [10, 14], start: 'near', guest: true },
  ],
  [
    { place: 'kitchen', obj: finish, chore: 'coffee', title: 'Sunday coffee', length: 90, kinds: ['food', 'door', 'nothing'], interval: [10, 14], start: 'near' },
    { place: 'bedroom', obj: finish, chore: 'washing', title: 'The clean pile, contested', length: 90, kinds: ['lap', 'door', 'nothing'], interval: [10, 14], start: 'near', guest: true },
    { place: 'study', obj: finish, chore: 'email', title: 'The last email', length: 90, kinds: ['door', 'play', 'nothing'], interval: [10, 14], start: 'near', guest: true },
    { place: 'hallway', obj: content(30), title: 'Seeing her off', length: 85, kinds: ['door', 'nothing'], interval: [10, 14], start: 'near', guest: true },
    { place: 'sofa', obj: boss, chore: 'tidy', title: 'THE HOUSEGUEST: tidy up, nobody bitten', length: 90, kinds: ['play', 'lap', 'nothing'], interval: [14, 20], start: 'near', guest: true, boss: true, teach: 'guestBoss' },
  ],
];

function band(week: number, day: number) {
  if (week === 1 && day <= 2) return { halfWidth: 24, drifts: false, centre: 55 };
  if (week === 1) return { halfWidth: 16, drifts: true };
  return { halfWidth: 13, drifts: true };
}

function toDef(week: number, day: number, si: number, r: Row): MomentDef {
  const slot: Slot = SLOTS[si];
  const id = `w${week}d${day}${slot}`;
  const sys = systems(week, day);
  if (r.hoover) sys.chores = true;
  const chore: ChoreKind | null = r.hoover ? 'hoover' : r.chore ?? null;
  if (chore && !sys.chores) sys.chores = true;
  let difficulty: MomentDef['difficulty'];
  if (r.hoover) difficulty = { id: 'hoover', boss: r.boss };
  else if (r.guest) difficulty = { id: 'guest', boss: r.boss };
  return {
    id, week, day, slot, place: r.place, seed: hashString(id), length: r.length ?? 90,
    chore, hooverAreas: r.hoover, objective: r.obj, band: band(week, day),
    demands: { timed: r.timed, interval: r.interval, kinds: r.kinds ?? (r.timed ? undefined : r.interval ? undefined : []) },
    systems: sys, difficulty, script: r.script, title: r.title, teach: r.teach, noExtraFood: r.noExtraFood,
    startPos: r.start,
  };
}

export const MOMENTS: MomentDef[] = [W1, W2].flatMap((w, wi) => w.flatMap((d, di) => d.map((r, si) => toDef(wi + 1, di + 1, si, r))));
export const TOTAL_STARS = MOMENTS.length * 3;

export function momentById(id: string) { return MOMENTS.find((m) => m.id === id); }
export function momentIndex(id: string) { return MOMENTS.findIndex((m) => m.id === id); }

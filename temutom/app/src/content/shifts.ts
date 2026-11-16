import type {
  DemandKind, Objective, RoomId, ShiftDef, ShiftStaffSpec, Slot, Systems, ThreatSpec, Verb,
} from '../sim/types';
import { SLOTS } from '../sim/types';
import { hashString } from '../sim/rng';

/**
 * v1 content: three weeks of seven days of five shifts.
 *   Week 1 – The Hoover
 *   Week 2 – The Dog (Biscuit), brought forward from Week 5 at the producer's request
 *   Week 3 – The Houseguest Who "Isn't a Cat Person" (Uncle Clive)
 * Shifts are written by hand from a few templates (assumption A4).
 */

export const WEEKS = [
  { n: 1, threat: 'The Hoover', blurb: 'Noise. Suction. An affront.' },
  { n: 2, threat: 'The Dog', blurb: 'Biscuit has arrived. He is enormous and has no thoughts.' },
  { n: 3, threat: 'The Houseguest', blurb: 'Uncle Clive “isn’t a cat person”. This will be corrected.' },
] as const;

const ALL_VERBS: Verb[] = ['scream', 'stare', 'smack', 'sitOn', 'knockOff'];

function systems(week: number, day: number, slot: number): Systems {
  if (week > 1 || day >= 5) return { band: true, irritation: true, compliance: true, morale: true, brainCell: true, verbs: ALL_VERBS };
  const verbs: Verb[] = ['scream'];
  const sys: Systems = { band: false, irritation: false, compliance: false, morale: false, brainCell: false, verbs };
  if (day > 1 || slot >= 1) { sys.band = true; verbs.push('smack'); }
  if (day >= 2) verbs.push('stare');
  if (day > 2 || (day === 2 && slot >= 2)) sys.irritation = true;
  if (day >= 3) { verbs.push('sitOn'); sys.compliance = true; }
  if (day >= 4) { verbs.push('knockOff'); sys.morale = true; }
  return sys;
}

function band(week: number, day: number) {
  if (week === 1 && day <= 2) return { halfWidth: 22, drifts: false };
  if (week === 1) return { halfWidth: 14, drifts: true };
  if (week === 2) return { halfWidth: 11, drifts: true };
  return { halfWidth: 10, drifts: true };
}

interface Row {
  room: RoomId;
  obj: Objective;
  staff: (StaffId | `${StaffId}:away`)[];
  title: string;
  length?: number;
  timed?: { t: number; kind: DemandKind; door?: string }[];
  kinds?: DemandKind[];
  interval?: [number, number];
  threat?: ThreatSpec;
  teach?: string;
  start?: string;
  box?: boolean;
  maxActive?: number;
}
type StaffId = 'soft' | 'busy' | 'guest' | 'soft2';

const serve = (n: number): Objective => ({ kind: 'serve', n });
const claim: Objective = { kind: 'claim' };
const endure: Objective = { kind: 'endure' };
const boss: Objective = { kind: 'boss' };
const train = (staff: StaffId, demand: DemandKind, level: number): Objective => ({ kind: 'train', staff, demand, level });

const hooverVisit = (startAt = 30, visit = 25): ThreatSpec => ({ id: 'hoover', startAt, visit });
const dogVisit = (startAt = 3): ThreatSpec => ({ id: 'dog', startAt });
const guestIn: ThreatSpec = { id: 'guest' };

// Each week: 7 days × 5 rows (dawn, morning, afternoon, evening, night)
const W1: Row[][] = [
  // Day 1 – Kitchen: Scream, Food, moving; then Smack and unprompted stroking
  [
    { room: 'kitchen', obj: serve(1), staff: ['soft:away'], title: '4:50am. The bowl is empty.', length: 45, timed: [{ t: 1, kind: 'food' }], teach: 'scream', start: 'mat' },
    { room: 'kitchen', obj: serve(1), staff: ['soft'], title: 'Breakfast, and an unwanted hand', length: 60, timed: [{ t: 22, kind: 'food' }], teach: 'smack', start: 'mid' },
    { room: 'kitchen', obj: serve(2), staff: ['soft'], title: 'Second breakfast', length: 75, timed: [{ t: 6, kind: 'food' }, { t: 40, kind: 'food' }], teach: 'move' },
    { room: 'kitchen', obj: serve(2), staff: ['soft'], title: 'Dinner is a right', timed: [{ t: 5, kind: 'food' }, { t: 45, kind: 'food' }] },
    { room: 'kitchen', obj: serve(3), staff: ['soft'], title: 'Supper, then more supper', kinds: ['food'], interval: [14, 20] },
  ],
  // Day 2 – Living room: Stare, Door, the matching-spot bonus; Irritation and the Outburst
  [
    { room: 'living', obj: serve(1), staff: ['soft'], title: 'The door is the wrong way round', length: 60, timed: [{ t: 4, kind: 'door' }], teach: 'stare' },
    { room: 'living', obj: serve(2), staff: ['soft'], title: 'Stand where you mean it', timed: [{ t: 4, kind: 'door' }, { t: 40, kind: 'door' }], teach: 'matching' },
    { room: 'living', obj: serve(2), staff: ['soft'], title: 'Short fuse', kinds: ['door'], interval: [14, 20], teach: 'irritation' },
    { room: 'living', obj: serve(2), staff: ['soft'], title: 'In and out and in', kinds: ['door'], interval: [12, 18], teach: 'outburst' },
    { room: 'living', obj: serve(3), staff: ['soft'], title: 'Door duty', kinds: ['door'], interval: [12, 18] },
  ],
  // Day 3 – Study: Marcus; Sit On, Lap, reward and punishment; Compliance
  [
    { room: 'study', obj: serve(1), staff: ['busy'], title: 'Marcus works from home', timed: [{ t: 6, kind: 'door' }], teach: 'busy' },
    { room: 'study', obj: serve(1), staff: ['busy'], title: 'A lap has been identified', timed: [{ t: 5, kind: 'lap' }, { t: 45, kind: 'lap' }], teach: 'sitOn' },
    { room: 'study', obj: serve(2), staff: ['busy'], title: 'Reward good service', kinds: ['door', 'lap'], interval: [14, 20], teach: 'reward' },
    { room: 'study', obj: train('busy', 'door', 12), staff: ['busy'], title: 'Training: doors', kinds: ['door'], interval: [12, 16], teach: 'compliance' },
    { room: 'study', obj: serve(3), staff: ['busy'], title: 'Overtime', kinds: ['door', 'lap'], interval: [12, 18] },
  ],
  // Day 4 – Living room: Knock Off, Morale, thrones
  [
    { room: 'living', obj: serve(2), staff: ['soft'], title: 'Things that are too close to the edge', kinds: ['play', 'door'], interval: [14, 20], teach: 'knockOff' },
    { room: 'living', obj: serve(2), staff: ['soft'], title: 'Morale is their problem', kinds: ['play', 'door'], interval: [12, 18], teach: 'morale' },
    { room: 'living', obj: claim, staff: ['soft'], title: 'The armchair', kinds: ['play'], interval: [16, 22], teach: 'throne' },
    { room: 'living', obj: serve(3), staff: ['soft', 'busy'], title: 'Both of them, at once', kinds: ['play', 'door', 'lap'], interval: [12, 18] },
    { room: 'living', obj: claim, staff: ['soft', 'busy'], title: 'Evening sitting', kinds: ['play', 'lap'], interval: [14, 20] },
  ],
  // Day 5 – Kitchen: the Brain Cell, lapses, the treat cupboard
  [
    { room: 'kitchen', obj: serve(2), staff: ['soft'], title: 'A visitor from elsewhere', kinds: ['food'], interval: [14, 20], teach: 'brainCell', box: true },
    { room: 'kitchen', obj: serve(2), staff: ['soft'], title: 'The treat cupboard', kinds: ['food'], interval: [12, 16], teach: 'scheme' },
    { room: 'kitchen', obj: serve(3), staff: ['soft', 'busy'], title: 'Lunch is overdue', kinds: ['food', 'door'], interval: [12, 18], box: true },
    { room: 'kitchen', obj: claim, staff: ['soft'], title: 'The clean worktop', kinds: ['food', 'door'], interval: [14, 20] },
    { room: 'kitchen', obj: train('soft', 'food', 30), staff: ['soft'], title: 'Training: the bowl', kinds: ['food'], interval: [11, 15] },
  ],
  // Day 6 – Study, living room: both staff; the Hoover's first visits; hide spots
  [
    { room: 'study', obj: serve(2), staff: ['busy', 'soft'], title: 'Two staff, one desk', kinds: ['door', 'lap'], interval: [12, 18] },
    { room: 'study', obj: endure, staff: ['busy', 'soft'], title: 'A noise in the cupboard', kinds: ['door', 'lap'], interval: [14, 20], threat: hooverVisit(15, 25), teach: 'hoover' },
    { room: 'living', obj: serve(2), staff: ['soft', 'busy'], title: 'Behind the sofa', kinds: ['play', 'door', 'lap'], interval: [12, 18], threat: hooverVisit(35, 22), teach: 'hide' },
    { room: 'study', obj: claim, staff: ['busy'], title: 'The laptop keyboard', kinds: ['door', 'lap'], interval: [14, 20] },
    { room: 'living', obj: endure, staff: ['soft', 'busy'], title: 'Pull the plug', kinds: ['play', 'lap'], interval: [14, 20], threat: hooverVisit(10, 35), teach: 'plug' },
  ],
  // Day 7 – All three rooms; final shift is the Hoover
  [
    { room: 'kitchen', obj: serve(3), staff: ['soft', 'busy'], title: 'Sunday breakfast', kinds: ['food', 'door'], interval: [12, 16] },
    { room: 'study', obj: train('busy', 'lap', 25), staff: ['busy'], title: 'Training: laps', kinds: ['lap', 'door'], interval: [12, 16] },
    { room: 'living', obj: serve(3), staff: ['soft', 'busy'], title: 'Full house', kinds: ['play', 'door', 'lap'], interval: [12, 16], threat: hooverVisit(40, 20) },
    { room: 'study', obj: endure, staff: ['busy', 'soft'], title: 'It is coming', kinds: ['door', 'lap'], interval: [14, 18], threat: hooverVisit(8, 40) },
    { room: 'living', obj: boss, staff: ['soft', 'busy'], title: 'THE HOOVER', kinds: ['play', 'lap'], interval: [16, 22], threat: { id: 'hoover', boss: true, startAt: 5 }, teach: 'boss' },
  ],
];

const W2: Row[][] = [
  // Day 1 – Bedroom opens; two demands at once
  [
    { room: 'bedroom', obj: serve(2), staff: ['soft'], title: 'The pillow is occupied', kinds: ['lap', 'door'], interval: [10, 16], teach: 'two' },
    { room: 'bedroom', obj: claim, staff: ['soft'], title: 'The pillow', kinds: ['lap', 'door'], interval: [12, 18] },
    { room: 'kitchen', obj: serve(3), staff: ['soft', 'busy'], title: 'Breakfast for one (cat)', kinds: ['food', 'door'], interval: [10, 15] },
    { room: 'bedroom', obj: serve(3), staff: ['soft', 'busy'], title: 'Clean washing, warm', kinds: ['lap', 'door'], interval: [10, 15] },
    { room: 'bedroom', obj: train('soft', 'lap', 30), staff: ['soft'], title: 'Training: bedtime laps', kinds: ['lap'], interval: [10, 14] },
  ],
  // Day 2 – The Dog arrives
  [
    { room: 'living', obj: serve(2), staff: ['soft'], title: 'Something large has come in', kinds: ['play', 'door'], interval: [12, 18], threat: dogVisit(6), teach: 'dog' },
    { room: 'living', obj: endure, staff: ['soft', 'busy'], title: 'His name is Biscuit', kinds: ['play', 'lap', 'door'], interval: [12, 18], threat: dogVisit(2), teach: 'dogSmack' },
    { room: 'kitchen', obj: serve(2), staff: ['soft'], title: 'The bowl is not for dogs', kinds: ['food'], interval: [10, 15], threat: dogVisit(4), teach: 'dogBowl' },
    { room: 'living', obj: claim, staff: ['soft'], title: 'He is on the armchair', kinds: ['play', 'lap'], interval: [14, 20], threat: dogVisit(2), teach: 'dogStare' },
    { room: 'bedroom', obj: serve(3), staff: ['soft', 'busy'], title: 'No dogs on the bed', kinds: ['lap', 'door'], interval: [10, 15], threat: dogVisit(20) },
  ],
  // Day 3 – Hallway opens
  [
    { room: 'hallway', obj: serve(2), staff: ['soft'], title: 'The hallway', kinds: ['door', 'play'], interval: [11, 16] },
    { room: 'hallway', obj: claim, staff: ['soft', 'busy'], title: 'The top stair', kinds: ['door', 'lap'], interval: [12, 18] },
    { room: 'hallway', obj: serve(3), staff: ['busy'], title: 'Walkies (not for him)', kinds: ['door', 'play'], interval: [10, 15], threat: dogVisit(10) },
    { room: 'study', obj: serve(3), staff: ['busy', 'soft'], title: 'Working from home, with dog', kinds: ['door', 'lap'], interval: [10, 15], threat: dogVisit(5) },
    { room: 'hallway', obj: endure, staff: ['soft', 'busy'], title: 'Hoover in the hall', kinds: ['door', 'play'], interval: [12, 18], threat: hooverVisit(10, 40) },
  ],
  // Day 4 – Food under pressure
  [
    { room: 'kitchen', obj: serve(3), staff: ['soft', 'busy'], title: 'Guard the bowl', kinds: ['food', 'door'], interval: [9, 14], threat: dogVisit(2) },
    { room: 'kitchen', obj: claim, staff: ['soft'], title: 'Worktop, dog-free', kinds: ['food', 'door'], interval: [12, 18], threat: dogVisit(8) },
    { room: 'living', obj: serve(3), staff: ['soft', 'busy'], title: 'Stolen toys', kinds: ['play', 'door', 'lap'], interval: [10, 14], threat: dogVisit(2) },
    { room: 'bedroom', obj: train('busy', 'lap', 40), staff: ['busy'], title: 'Training: Marcus, lap', kinds: ['lap', 'door'], interval: [9, 13] },
    { room: 'kitchen', obj: serve(4), staff: ['soft', 'busy'], title: 'Feeding time at the zoo', kinds: ['food', 'door'], interval: [9, 13], threat: dogVisit(4) },
  ],
  // Day 5 – Mixed
  [
    { room: 'hallway', obj: serve(3), staff: ['soft', 'busy'], title: 'Coats, keys, chaos', kinds: ['door', 'play', 'lap'], interval: [10, 14], threat: dogVisit(3) },
    { room: 'bedroom', obj: claim, staff: ['soft', 'busy'], title: 'Pillow politics', kinds: ['lap', 'door'], interval: [12, 16], threat: dogVisit(6) },
    { room: 'study', obj: claim, staff: ['busy'], title: 'Keyboard, again', kinds: ['door', 'lap'], interval: [12, 16], threat: dogVisit(10) },
    { room: 'living', obj: endure, staff: ['soft', 'busy'], title: 'Hoover and hound', kinds: ['play', 'door'], interval: [12, 16], threat: hooverVisit(8, 40) },
    { room: 'hallway', obj: train('soft', 'door', 50), staff: ['soft'], title: 'Training: the front door', kinds: ['door'], interval: [9, 12] },
  ],
  // Day 6 – Mixed
  [
    { room: 'kitchen', obj: serve(4), staff: ['soft', 'busy'], title: 'Brunch', kinds: ['food', 'door'], interval: [9, 13], threat: dogVisit(2) },
    { room: 'living', obj: claim, staff: ['soft', 'busy'], title: 'Remind him whose chair it is', kinds: ['play', 'lap'], interval: [12, 16], threat: dogVisit(2) },
    { room: 'bedroom', obj: serve(3), staff: ['soft'], title: 'Afternoon nap, contested', kinds: ['lap', 'door'], interval: [10, 14], threat: dogVisit(5) },
    { room: 'hallway', obj: claim, staff: ['soft', 'busy'], title: 'Top of the stairs, top of the house', kinds: ['door', 'play'], interval: [12, 16], threat: dogVisit(4) },
    { room: 'study', obj: serve(3), staff: ['busy', 'soft'], title: 'Late meeting', kinds: ['door', 'lap'], interval: [10, 13], threat: dogVisit(3) },
  ],
  // Day 7 – The Pecking Order
  [
    { room: 'kitchen', obj: serve(4), staff: ['soft', 'busy'], title: 'Sunday breakfast, two bowls', kinds: ['food', 'door'], interval: [9, 12], threat: dogVisit(2) },
    { room: 'bedroom', obj: claim, staff: ['soft', 'busy'], title: 'The pillow, finally', kinds: ['lap', 'door'], interval: [12, 16], threat: dogVisit(3) },
    { room: 'hallway', obj: serve(3), staff: ['soft', 'busy'], title: 'The dog wants a walk. So?', kinds: ['door', 'play', 'lap'], interval: [10, 14], threat: dogVisit(2) },
    { room: 'living', obj: train('soft', 'play', 40), staff: ['soft'], title: 'Training: play, not with him', kinds: ['play'], interval: [9, 12], threat: dogVisit(5) },
    { room: 'living', obj: boss, staff: ['soft', 'busy'], title: 'THE PECKING ORDER', kinds: ['play', 'lap', 'door'], interval: [12, 16], threat: { id: 'dog', boss: true, startAt: 1 }, teach: 'dogBoss' },
  ],
];

const W3: Row[][] = [
  [
    { room: 'hallway', obj: serve(2), staff: ['soft', 'busy'], title: 'Someone at the door', kinds: ['door', 'play'], interval: [10, 14] },
    { room: 'living', obj: serve(2), staff: ['soft', 'guest'], title: 'Uncle Clive “isn’t a cat person”', kinds: ['play', 'door', 'lap'], interval: [11, 15], threat: guestIn, teach: 'guest' },
    { room: 'kitchen', obj: serve(3), staff: ['soft', 'guest'], title: 'He has taken a chair', kinds: ['food', 'door'], interval: [10, 14], threat: guestIn },
    { room: 'living', obj: train('guest', 'door', 18), staff: ['guest', 'soft'], title: 'Training: Clive, doors', kinds: ['door'], interval: [9, 12], threat: guestIn },
    { room: 'bedroom', obj: serve(3), staff: ['soft', 'busy'], title: 'The spare room is my room', kinds: ['lap', 'door'], interval: [10, 13] },
  ],
  [
    { room: 'kitchen', obj: serve(3), staff: ['busy', 'guest'], title: 'Breakfast with Clive', kinds: ['food', 'door'], interval: [9, 13], threat: guestIn },
    { room: 'living', obj: claim, staff: ['guest', 'soft'], title: 'He is in the armchair', kinds: ['play', 'door'], interval: [12, 16], threat: guestIn },
    { room: 'study', obj: serve(3), staff: ['busy', 'guest'], title: 'Clive is “just checking emails”', kinds: ['door', 'lap'], interval: [10, 13], threat: guestIn },
    { room: 'hallway', obj: claim, staff: ['soft', 'guest'], title: 'The stairs are not for sitting, Clive', kinds: ['door', 'play'], interval: [12, 16], threat: guestIn },
    { room: 'living', obj: train('guest', 'play', 18), staff: ['guest'], title: 'Training: Clive, toys', kinds: ['play'], interval: [9, 12], threat: guestIn },
  ],
  [
    { room: 'kitchen', obj: serve(4), staff: ['soft', 'busy', 'guest'], title: 'Everybody wants toast', kinds: ['food', 'door'], interval: [9, 12], threat: guestIn },
    { room: 'bedroom', obj: claim, staff: ['soft'], title: 'Pillow, unattended', kinds: ['lap', 'door'], interval: [12, 16] },
    { room: 'living', obj: serve(3), staff: ['guest', 'busy'], title: 'Men watching football', kinds: ['play', 'door', 'lap'], interval: [10, 13], threat: guestIn },
    { room: 'study', obj: endure, staff: ['busy', 'guest'], title: 'Hoover, with an audience', kinds: ['door', 'lap'], interval: [11, 15], threat: hooverVisit(10, 40) },
    { room: 'hallway', obj: serve(3), staff: ['soft', 'guest'], title: 'Clive’s shoes', kinds: ['door', 'play'], interval: [10, 13], threat: guestIn },
  ],
  [
    { room: 'kitchen', obj: train('guest', 'food', 24), staff: ['guest'], title: 'Training: Clive, the bowl', kinds: ['food'], interval: [9, 12], threat: guestIn },
    { room: 'living', obj: serve(3), staff: ['guest', 'soft'], title: 'Clive’s lap is not a lap', kinds: ['play', 'lap', 'door'], interval: [10, 13], threat: guestIn },
    { room: 'bedroom', obj: serve(3), staff: ['soft', 'busy'], title: 'Mid-week siesta', kinds: ['lap', 'door'], interval: [10, 13], threat: dogVisit(6) },
    { room: 'hallway', obj: claim, staff: ['busy', 'guest'], title: 'Heights', kinds: ['door', 'play'], interval: [12, 16], threat: guestIn },
    { room: 'living', obj: endure, staff: ['soft', 'guest'], title: 'Hoovering round Clive', kinds: ['play', 'door'], interval: [12, 16], threat: hooverVisit(6, 45) },
  ],
  [
    { room: 'study', obj: claim, staff: ['guest'], title: 'Clive has borrowed the laptop', kinds: ['door', 'lap'], interval: [12, 16], threat: guestIn },
    { room: 'kitchen', obj: serve(4), staff: ['soft', 'guest'], title: 'Second lunch', kinds: ['food', 'door'], interval: [9, 12], threat: guestIn },
    { room: 'living', obj: train('guest', 'lap', 30), staff: ['guest', 'soft'], title: 'Training: Clive, lap (theory)', kinds: ['lap', 'play'], interval: [9, 12], threat: guestIn },
    { room: 'hallway', obj: serve(3), staff: ['soft', 'busy'], title: 'Biscuit visits', kinds: ['door', 'play', 'lap'], interval: [10, 13], threat: dogVisit(3) },
    { room: 'bedroom', obj: serve(3), staff: ['guest', 'soft'], title: 'Clive is in the spare bed', kinds: ['lap', 'door'], interval: [10, 13], threat: guestIn },
  ],
  [
    { room: 'kitchen', obj: serve(4), staff: ['soft', 'busy', 'guest'], title: 'Full English', kinds: ['food', 'door'], interval: [8, 12], threat: guestIn },
    { room: 'living', obj: claim, staff: ['guest', 'busy'], title: 'Armchair, reclaimed', kinds: ['play', 'lap'], interval: [12, 15], threat: guestIn },
    { room: 'study', obj: serve(3), staff: ['busy', 'guest'], title: 'Clive’s “quick call”', kinds: ['door', 'lap'], interval: [10, 13], threat: guestIn },
    { room: 'hallway', obj: endure, staff: ['soft', 'guest'], title: 'The hoover, the hall, the houseguest', kinds: ['door', 'play'], interval: [11, 14], threat: hooverVisit(6, 45) },
    { room: 'living', obj: train('guest', 'lap', 36), staff: ['guest'], title: 'Training: Clive, lap (practice)', kinds: ['lap'], interval: [8, 11], threat: guestIn },
  ],
  [
    { room: 'kitchen', obj: serve(4), staff: ['soft', 'busy', 'guest'], title: 'Clive leaves tomorrow', kinds: ['food', 'door'], interval: [8, 12], threat: guestIn },
    { room: 'bedroom', obj: claim, staff: ['soft', 'busy'], title: 'The pillow, the whole pillow', kinds: ['lap', 'door'], interval: [11, 14] },
    { room: 'hallway', obj: claim, staff: ['busy', 'guest'], title: 'The summit', kinds: ['door', 'play'], interval: [11, 14], threat: guestIn },
    { room: 'study', obj: serve(3), staff: ['busy', 'soft'], title: 'Packing', kinds: ['door', 'lap'], interval: [10, 13], threat: dogVisit(5) },
    { room: 'living', obj: boss, staff: ['guest', 'soft'], title: 'CONVERT CLIVE', kinds: ['lap', 'play'], interval: [10, 13], threat: { id: 'guest', boss: true }, teach: 'guestBoss' },
  ],
];

const TABLE = [W1, W2, W3];

function toDef(week: number, day: number, slotIdx: number, r: Row): ShiftDef {
  const slot: Slot = SLOTS[slotIdx];
  const id = `w${week}d${day}${slot}`;
  const staff: ShiftStaffSpec[] = r.staff.map((x) => {
    const [sid, away] = x.split(':') as [StaffId, string?];
    return { id: sid, away: away === 'away' };
  });
  const maxActive = r.maxActive ?? (week === 1 ? 1 : 2);
  return {
    id, week, day, slot, room: r.room, seed: hashString(id), length: r.length ?? 90,
    staff, objective: r.obj, band: band(week, day),
    demands: { timed: r.timed, interval: r.interval, kinds: r.kinds, maxActive },
    systems: systems(week, day, slotIdx), threat: r.threat, title: r.title,
    teach: r.teach, start: r.start, box: r.box,
  };
}

export const SHIFTS: ShiftDef[] = TABLE.flatMap((w, wi) => w.flatMap((d, di) => d.map((r, si) => toDef(wi + 1, di + 1, si, r))));

export function shiftById(id: string) {
  return SHIFTS.find((s) => s.id === id);
}

export function shiftIndex(id: string) {
  return SHIFTS.findIndex((s) => s.id === id);
}

export const TOTAL_STARS = SHIFTS.length * 3;

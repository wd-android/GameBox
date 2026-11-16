import type { Rng } from './rng';

export type DemandKind = 'food' | 'door' | 'lap' | 'play';
export const DEMAND_KINDS: DemandKind[] = ['food', 'door', 'lap', 'play'];

export type Verb = 'scream' | 'stare' | 'smack' | 'sitOn' | 'knockOff';
export type SpotKind =
  | 'floor' | 'bowl' | 'door' | 'lap' | 'perch' | 'ledge' | 'hide' | 'throne' | 'scheme' | 'socket' | 'toy' | 'box';
export type SchemeId = 'treats' | 'doorHandle' | 'plug';
export type StaffId = 'soft' | 'busy' | 'guest' | 'soft2';
export type RoomId = 'kitchen' | 'living' | 'study' | 'bedroom' | 'hallway';
export type Slot = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
export const SLOTS: Slot[] = ['dawn', 'morning', 'afternoon', 'evening', 'night'];

export interface Pt { x: number; y: number }

export interface Spot extends Pt {
  id: string;
  kind: SpotKind;
  label: string;
  adjacentTo: string[];
  doorId?: string;
  schemeId?: SchemeId;
  /** Staff point whose occupant becomes the lap (for lap spots) */
  seat?: string;
  /** Staff point whose task this spot blocks when he sits here */
  blocks?: string;
  /** Number of objects this ledge holds */
  slots?: number;
  /** Only exists when a modifier says so (the box) */
  optional?: boolean;
}

export type TaskKind = 'cook' | 'tidy' | 'work' | 'tv' | 'read' | 'sit' | 'phone' | 'sleep' | 'away' | 'hoover';

export interface RoutineStep { at: string; task: TaskKind; dur: number }

export interface RoomDef {
  id: RoomId;
  name: string;
  throne: string;
  throneName: string;
  spots: Spot[];
  /** Places staff stand or sit, by id */
  points: Record<string, Pt>;
  doors: string[];
  /** Where staff enter and leave */
  entry: string;
  objectPool: string[];
  /** Which demand kinds make sense here */
  demands: DemandKind[];
  routines: Partial<Record<StaffId, RoutineStep[]>>;
}

export type Objective =
  | { kind: 'serve'; n: number }
  | { kind: 'claim' }
  | { kind: 'train'; staff: StaffId; demand: DemandKind; level: number }
  | { kind: 'endure' }
  | { kind: 'boss' };

export type Modifier = 'halfEmptyBowl' | 'bathNight' | 'box' | 'closedDoors' | 'visitors';

export interface Systems {
  band: boolean;
  irritation: boolean;
  compliance: boolean;
  morale: boolean;
  brainCell: boolean;
  verbs: Verb[];
}

export interface ThreatSpec {
  id: 'hoover' | 'dog' | 'guest';
  startAt?: number;
  /** Seconds of running time before a non-boss visit ends */
  visit?: number;
  boss?: boolean;
}

export interface ShiftStaffSpec {
  id: StaffId;
  routine?: RoutineStep[];
  /** Starts out of the room (asleep, elsewhere) */
  away?: boolean;
}

export interface ShiftDef {
  id: string;
  week: number;
  day: number;
  slot: Slot;
  room: RoomId;
  seed: number;
  length: number;
  staff: ShiftStaffSpec[];
  objective: Objective;
  band: { halfWidth: number; drifts: boolean; centre?: number };
  demands: { timed?: { t: number; kind: DemandKind; door?: string }[]; interval?: [number, number]; kinds?: DemandKind[]; maxActive: number };
  systems: Systems;
  threat?: ThreatSpec;
  modifiers?: Modifier[];
  stars?: { two: number; three: number };
  title: string;
  daily?: boolean;
  /** A box is in the room (for box lapses) */
  box?: boolean;
  /** Where he starts */
  start?: string;
  /** Short hint key for the shift that introduces something */
  teach?: string;
}

export type CatAction =
  | 'idle' | 'moving' | 'screaming' | 'staring' | 'sitting' | 'lapse' | 'outburst' | 'scheme' | 'stunned' | 'held' | 'knocking' | 'smacking';

export type BrainPhase = 'away' | 'arriving' | 'present';

export type TargetRef =
  | { kind: 'staff'; id: StaffId }
  | { kind: 'object'; id: number }
  | { kind: 'dog' }
  | { kind: 'spot'; id: string };

export interface CatState extends Pt {
  spot: string;
  dest: string | null;
  action: CatAction;
  actionT: number;
  facing: 1 | -1;
  attention: number;
  irritation: number;
  brain: { phase: BrainPhase; t: number };
  screaming: boolean;
  screamT: number;
  screamSignalled: boolean;
  stareTarget: TargetRef | null;
  stareT: number;
  pending: { verb: Verb; target: TargetRef } | null;
  heldBy: StaffId | null;
  lapse: 'wrongSpot' | 'wall' | 'box' | null;
  outburst: 'bite' | 'swipe' | 'zoomies' | null;
  sittingOn: StaffId | null;
  lapT: number;
  /** Seconds he has been stationary at his current spot */
  still: number;
  inBand: boolean;
}

export type StaffMode =
  | 'routine' | 'attending' | 'responding' | 'stroking' | 'holding' | 'recoiling' | 'evicting' | 'spraying' | 'asking' | 'fussingDog' | 'away';

export type JobKind =
  | 'fillBowl' | 'toggleDoor' | 'sitLap' | 'fetchToy' | 'stroke' | 'pickUp' | 'ask' | 'evict' | 'spray' | 'closeDoor' | 'fussDog' | 'wrongThing';

export interface Job {
  kind: JobKind;
  phase: 'walk' | 'act';
  t: number;
  to: Pt;
  demandId: number | null;
  correct: boolean;
  door?: string;
  stage?: number;
  seat?: string;
}

export interface StaffStats {
  slowest: number;
  wrong: number;
  overStroke: number;
  anticipated: number;
  evicted: number;
  bitten: number;
  served: number;
}

export interface StaffState extends Pt {
  id: StaffId;
  present: boolean;
  mode: StaffMode;
  modeT: number;
  job: Job | null;
  routine: RoutineStep[];
  routineIdx: number;
  routineT: number;
  compliance: Record<DemandKind, number>;
  nextStroke: number;
  evictCooldown: number;
  mark: { kind: 'tick' | 'question' | 'yelp' | 'heart' | 'zzz'; t: number } | null;
  lastWrong: { t: number; demand: DemandKind } | null;
  lastCorrect: { t: number; demand: DemandKind } | null;
  /** Anticipation scheduled for a demand */
  anticipate: { at: number; demandId: number } | null;
  facing: 1 | -1;
  stats: StaffStats;
  seatedAt: string | null;
  lapSitUntil: number;
}

export interface Demand {
  id: number;
  kind: DemandKind;
  door?: string;
  /** For door demands, the state the door must end up in */
  wantOpen?: boolean;
  issuedAt: number;
  patience: number;
  maxPatience: number;
  /** Fills required (half-empty bowl) */
  need: number;
  /** Staff assigned to answer it */
  claimedBy: StaffId | null;
}

export interface WorldObject {
  id: number;
  kind: string;
  spot: string;
  slot: number;
  knocked: boolean;
  t: number;
}

export interface TallyState {
  issued: number;
  met: number;
  secondsInBand: number;
  outbursts: number;
  lapses: number;
  screams: number;
  knocked: string[];
  sprayed: number;
  evictions: number;
}

export interface SimEvent {
  type: string;
  staff?: StaffId;
  kind?: string;
  x?: number;
  y?: number;
  value?: number;
}

export interface ThreatState {
  id: ThreatSpec['id'];
  spec: ThreatSpec;
  data: Record<string, unknown>;
}

export interface ShiftState {
  def: ShiftDef;
  room: RoomDef;
  rng: Rng;
  time: number;
  length: number;
  cat: CatState;
  band: { centre: number; halfWidth: number; target: number; nextDrift: number };
  staff: StaffState[];
  morale: number;
  moraleStart: number;
  objects: WorldObject[];
  doors: Record<string, boolean>;
  bowl: { full: number; fills: number };
  demands: Demand[];
  timedIdx: number;
  nextDemandAt: number;
  demandSeq: number;
  putBack: { at: number; door: string; wantOpen: boolean }[];
  throne: { progress: number; claimedBefore: boolean; claimedNow: boolean };
  threat: ThreatState | null;
  tally: TallyState;
  events: SimEvent[];
  scheme: { id: SchemeId; spot: string; step: number; t: number } | null;
  screamTimes: number[];
  status: 'running' | 'won' | 'failed';
  endReason: 'time' | 'player' | 'carrier' | 'objective' | null;
  objectiveMet: boolean;
  lastLapseAt: number;
  lastDoorClose: number;
  settings: { fewerLapses: boolean; longerPatience: boolean };
  hasBox: boolean;
  bossMorale: number;
  /** Points that move during a shift (the Hoover) */
  dynPoints: Record<string, Pt>;
}

export type Input =
  | { type: 'tapSpot'; spot: string }
  | { type: 'verb'; verb: Verb; target: TargetRef }
  | { type: 'screamStart' }
  | { type: 'screamEnd' }
  | { type: 'scheme' }
  | { type: 'outburst' }
  | { type: 'endShift' };

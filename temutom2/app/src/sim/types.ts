import type { Band, BrainCell, Rng } from './cat';

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export type Zone = 'head' | 'back' | 'belly' | 'tail' | 'paws';
export type Pose = 'sit' | 'loaf' | 'stand' | 'walk' | 'crouch' | 'bellyUp' | 'onLap' | 'sitOn' | 'sleep' | 'jump' | 'carried' | 'closeUp';
export type HeadV = 'neutral' | 'scream' | 'bite' | 'eat' | 'groom';
export type EarsV = 'forward' | 'relaxed' | 'sideways' | 'flat';
export type EyesV = 'half' | 'open' | 'wide' | 'dilated' | 'slowBlink' | 'closed';
export type TailV = 'still' | 'wave' | 'hooked' | 'flick' | 'lash';
export type PawV = 'swipeL' | 'swipeR' | 'pat' | 'push' | 'knead' | null;
export type MoodState = 'seeking' | 'content' | 'tolerating' | 'warning';

export type DemandKind = 'food' | 'door' | 'lap' | 'play' | 'nothing';
export const DEMAND_KINDS: DemandKind[] = ['food', 'door', 'lap', 'play', 'nothing'];

export type PlaceId = 'kitchen' | 'study' | 'sofa' | 'bedroom' | 'hallway';
export type Slot = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
export const SLOTS: Slot[] = ['dawn', 'morning', 'afternoon', 'evening', 'night'];

export type ChoreKind = 'coffee' | 'email' | 'washing' | 'tidy' | 'hoover';
export type SchemeId = 'treats' | 'doorHandle' | 'keyboard';
export type LapseKind = 'prey' | 'jump' | 'box' | 'forgot';
export type Activity =
  | 'away' | 'idle' | 'seeking' | 'demanding' | 'accepting' | 'warning' | 'striking' | 'sulking'
  | 'scheming' | 'lapsing' | 'sittingOn' | 'eating' | 'onLap' | 'following' | 'carried' | 'playing' | 'doorway';

/** The ladder (§8.2) */
export const LADDER = ['stareFar', 'stareNear', 'scream', 'knockOff', 'sitOn', 'closeStare', 'smack'] as const;
export type LadderStep = (typeof LADDER)[number];

/** Body-language values derived each step (§6.4). Renderer and audio read only these. */
export interface Display {
  mood: MoodState | 'striking' | 'lapsing';
  pose: Pose;
  head: HeadV;
  ears: EarsV;
  eyes: EyesV;
  /** Eyes in line: the Brain Cell is his (or arriving, partly) */
  align: number;
  glint: boolean;
  tail: TailV;
  paw: PawV;
  gaze: Pt | null;
  sound: 'chirp' | 'purr' | 'growl' | 'scream' | 'none';
  rumble: 'purr' | 'tremor' | null;
  /** Visible tell for the current demand, if being shown */
  tell: DemandKind | null;
  wiggle: boolean;
  confused: boolean;
}

export interface Hand {
  down: boolean;
  x: number; y: number;
  px: number; py: number;
  speed: number;
  downAt: number;
  downX: number; downY: number;
  heldFor: number;
  stillFor: number;
  upAt: number;
  over: Over;
  drag: Drag | null;
  /** Armed for a lift: held still on his body for 0.6 s */
  liftArmed: boolean;
  travelX: number;
  overDoorAtDown: boolean;
  lapHold: number;
  blinkHold: number;
  locked: number;
  stareHold: number;
  moved: number;
}

export type Over =
  | { kind: 'cat'; zone: Zone }
  | { kind: 'chore'; step: number }
  | { kind: 'source'; id: SourceId }
  | { kind: 'door' } | { kind: 'bowl' } | { kind: 'cupboard' } | { kind: 'laptop' } | { kind: 'lap' }
  | { kind: 'guest' } | { kind: 'hoover' } | { kind: 'object'; id: number }
  | { kind: 'empty' };

export type SourceId = 'pouch' | 'wand' | 'treat0' | 'treat1';

export interface Drag { what: SourceId | 'cat' | 'guest' | 'hoover'; x: number; y: number; t: number; startX: number; startY: number }

export interface ChoreStep { id: string; label: string; x: number; y: number; r: number; time: number; progress: number; done: boolean }
export interface Chore {
  kind: ChoreKind;
  steps: ChoreStep[];
  current: number;
  /** Hoover: the path, its total length, how far along, and where each area ends */
  hoover?: { path: Pt[]; length: number; s: number; areaEnds: number[]; running: boolean; lastMove: number };
}

export interface Demand {
  kind: DemandKind;
  startedAt: number;
  step: number;
  nextScream: number;
  answered: null | 'correct' | 'wrong';
  door?: boolean;
}

export interface Strike {
  kind: 'swipe' | 'bite';
  target: 'player' | 'guest' | 'hoover';
  phase: 'windup' | 'strike' | 'after';
  t: number;
  aim: Pt;
  path: Pt[];
  free: boolean;
}

export interface Mark { id: number; path: Pt[]; born: number }
export interface Wash { x: number; y: number; born: number; soft: boolean }

export interface WorldObject { id: number; kind: string; x: number; y: number; knocked: boolean; t: number }

export interface CatState extends Pt {
  scale: number;
  facing: 1 | -1;
  target: { x: number; y: number; scale: number; pose?: Pose } | null;
  pos: string;
  onScreen: boolean;
  activity: Activity;
  actT: number;
  attention: number;
  irritation: number;
  brain: BrainCell;
  demand: Demand | null;
  queued: DemandKind | null;
  mood: MoodState;
  warningSince: number;
  forcedWarning: boolean;
  contentFor: number;
  nextBlink: number;
  blinkAt: number;
  blinking: number;
  bellyUntil: number;
  headButted: boolean;
  sitOn: { what: 'chore' | 'pause' | 'pile'; step: number; until: number } | null;
  lapUntil: number;
  treat: { x: number; y: number; until: number } | null;
  sulkUntil: number;
  lapse: { kind: LapseKind; until: number } | null;
  lastLapse: number;
  scheme: { id: SchemeId; step: number; t: number } | null;
  confusedUntil: number;
  strike: Strike | null;
  seekingFor: number;
  eatUntil: number;
  doorPlan: { at: number; kind: 'through' | 'sit' | 'away'; until: number } | null;
  playUntil: number;
  lastAck: number;
  display: Display;
  pose: Pose;
}

export interface UiKnock { score: boolean; plasters: boolean }

export interface GuestState {
  phase: 'out' | 'reaching' | 'stroking' | 'withdrawing';
  x: number; y: number;
  t: number;
  next: number;
  zone: Zone;
  plasters: number;
  bitten: number;
  side: 1 | -1;
}

export type Objective =
  | { kind: 'finishChore' }
  | { kind: 'serve'; n: number }
  | { kind: 'content'; seconds: number }
  | { kind: 'survive' }
  | { kind: 'boss' };

export type Modifier = 'wokeUpWrong' | 'needy' | 'raining' | 'box' | 'ravenous';

export interface Systems {
  plasters: boolean;
  belly: boolean;
  chores: boolean;
  treats: boolean;
  lift: boolean;
  /** Highest ladder step reached (index into LADDER) */
  ladderMax: number;
  brainCell: boolean;
  lapses: boolean;
  schemes: boolean;
  /** Tells shown only briefly (Week 2) */
  shortTells: boolean;
  queue: boolean;
}

export interface ScriptEvent { t: number; do: 'demand' | 'come' | 'swipeFree'; kind?: DemandKind; step?: number }

export interface MomentDef {
  id: string;
  week: number;
  day: number;
  slot: Slot;
  place: PlaceId;
  seed: number;
  length: number;
  chore: ChoreKind | null;
  hooverAreas?: number;
  objective: Objective;
  band: { halfWidth: number; drifts: boolean; centre?: number };
  demands: { timed?: { t: number; kind: DemandKind; step?: number }[]; interval?: [number, number]; kinds?: DemandKind[] };
  systems: Systems;
  difficulty?: { id: 'hoover' | 'guest'; boss?: boolean };
  script?: ScriptEvent[];
  modifiers?: Modifier[];
  title: string;
  teach?: string;
  noExtraFood?: boolean;
  /** Starts with him already on screen at this position */
  startPos?: string;
  daily?: boolean;
}

export interface Tally {
  contentSecs: number;
  onScreenSecs: number;
  issued: number;
  met: number;
  firstTime: number;
  wrong: number;
  slowest: number;
  strikes: number;
  bites: number;
  bellyBites: number;
  plastersLost: number;
  lapsesSeen: number;
  lapses: number;
  lifted: number;
  schemesStopped: number;
  schemesDone: number;
  knocked: string[];
  headButts: number;
  blinksAnswered: number;
  zones: Zone[];
  notes: string[];
  guestBitten: number;
  treatsUsed: number;
}

export interface SimEvent { type: string; kind?: string; x?: number; y?: number; value?: number }

export interface MomentState {
  def: MomentDef;
  rng: Rng;
  time: number;
  length: number;
  hand: Hand;
  cat: CatState;
  band: Band;
  plasters: number;
  plastersStart: number;
  chore: Chore | null;
  objects: WorldObject[];
  ui: UiKnock;
  marks: Mark[];
  markSeq: number;
  wash: Wash | null;
  lastWash: number;
  shakeUntil: number;
  nowUntil: number;
  nudgeAt: number;
  doorOpen: boolean;
  doorHeld: number;
  cupboardOpen: number;
  lidClosedUntil: number;
  treatsLeft: number;
  wand: { x: number; y: number; active: boolean; time: number } | null;
  pouch: { x: number; y: number; carried: boolean };
  guest: GuestState | null;
  difficulty: { id: 'hoover' | 'guest'; boss: boolean; data: Record<string, unknown> } | null;
  nextDemandAt: number;
  timedIdx: number;
  scriptIdx: number;
  freeSwipes: number;
  standing: { minWarning: number; bandBonus: number; rank: number };
  settings: { longerWarnings: boolean; reduceFlashing: boolean; leftHanded: boolean };
  tally: Tally;
  events: SimEvent[];
  status: 'running' | 'won' | 'failed';
  endReason: 'time' | 'plasters' | 'objective' | 'noExtraFood' | null;
  objectiveMet: boolean;
  failFlag: boolean;
}

export type Input = { type: 'hand'; down: boolean; x: number; y: number } | { type: 'restore'; id: keyof UiKnock };

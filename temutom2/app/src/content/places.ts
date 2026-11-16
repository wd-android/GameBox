import type { ChoreKind, DemandKind, PlaceId, Pt, Rect } from '../sim/types';

/** A named position he can occupy (§5.4): far, near, at a demand target, and so on */
export interface Position extends Pt { scale: number; facing: 1 | -1 }

export interface ChoreItemDef { id: string; label: string; x: number; y: number; time: number }

export interface PlaceDef {
  id: PlaceId;
  name: string;
  view: string;
  positions: Record<string, Position>;
  demands: DemandKind[];
  door?: Rect;
  bowl?: Rect;
  cupboard?: Rect;
  laptop?: Rect;
  lap?: Rect;
  /** Where a pouch and a wand are taken from */
  pouch?: Pt;
  wand?: Pt;
  wandLabel?: string;
  box?: Pt;
  objects: { kind: string; x: number; y: number }[];
  chores: Partial<Record<ChoreKind, ChoreItemDef[]>>;
  /** The Hoover's path through the place, as three areas */
  hooverAreas: Pt[][];
  /** Where his tell for each demand is shown */
  tellPos: Partial<Record<DemandKind, string>>;
  /** Where he sits to work each Scheme */
  schemePos: Partial<Record<'treats' | 'doorHandle' | 'keyboard', string>>;
  /** Lower edge above which the lap covers chore items when he is on it */
  lapCoverY?: number;
  /** Floor area where a treat may be put down */
  floor: Rect;
  dark?: boolean;
}

const P = (x: number, y: number, scale: number, facing: 1 | -1 = -1): Position => ({ x, y, scale, facing });

const kitchen: PlaceDef = {
  id: 'kitchen', name: 'Kitchen', view: 'The worktop, the bowl on the floor',
  positions: {
    far: P(332, 468, 0.42), near: P(205, 568, 0.95), bowl: P(118, 790, 0.85, -1), door: P(318, 470, 0.46, 1),
    cupboard: P(108, 515, 0.72, -1), centre: P(205, 760, 0.85), drawer: P(205, 568, 0.95),
  },
  demands: ['food', 'door', 'nothing'],
  door: { x: 296, y: 186, w: 88, h: 286 },
  bowl: { x: 20, y: 735, w: 110, h: 60 },
  cupboard: { x: 26, y: 128, w: 140, h: 160 },
  pouch: { x: 52, y: 548 },
  objects: [{ kind: 'plantPot', x: 190, y: 318 }, { kind: 'saltShaker', x: 246, y: 318 }, { kind: 'egg', x: 330, y: 560 }],
  chores: {
    coffee: [
      { id: 'kettle', label: 'Kettle', x: 82, y: 470, time: 2.5 },
      { id: 'mug', label: 'Mug', x: 188, y: 505, time: 1.5 },
      { id: 'jar', label: 'Coffee', x: 295, y: 470, time: 2 },
      { id: 'spoon', label: 'Spoon', x: 300, y: 560, time: 1.5 },
      { id: 'pour', label: 'Pour', x: 188, y: 505, time: 3 },
    ],
  },
  hooverAreas: [
    [{ x: 40, y: 690 }, { x: 350, y: 690 }],
    [{ x: 350, y: 735 }, { x: 160, y: 735 }],
    [{ x: 160, y: 780 }, { x: 360, y: 780 }],
  ],
  tellPos: { food: 'bowl', door: 'door', nothing: 'centre' },
  schemePos: { treats: 'cupboard' },
  floor: { x: 140, y: 680, w: 240, h: 110 },
};

const study: PlaceDef = {
  id: 'study', name: 'Study', view: 'The desk and the laptop',
  positions: {
    far: P(334, 476, 0.44), near: P(52, 590, 0.82, 1), door: P(326, 478, 0.46, 1), drawer: P(80, 795, 0.8, -1),
    keyboard: P(200, 690, 0.8), handle: P(312, 478, 0.5, 1), centre: P(220, 790, 0.8),
  },
  demands: ['door', 'play', 'nothing'],
  door: { x: 296, y: 176, w: 88, h: 302 },
  laptop: { x: 62, y: 430, w: 268, h: 300 },
  wand: { x: 66, y: 752 }, wandLabel: 'Toy drawer',
  objects: [{ kind: 'figurine', x: 112, y: 262 }, { kind: 'mug', x: 182, y: 262 }, { kind: 'plantPot', x: 252, y: 262 }],
  chores: {
    email: [
      { id: 'k1', label: 'Dear', x: 102, y: 628, time: 1.8 },
      { id: 'k2', label: 'Sorry', x: 196, y: 628, time: 1.8 },
      { id: 'k3', label: 'the cat', x: 290, y: 628, time: 1.8 },
      { id: 'k4', label: 'sat on', x: 102, y: 708, time: 1.8 },
      { id: 'k5', label: 'the', x: 196, y: 708, time: 1.8 },
      { id: 'k6', label: 'report', x: 290, y: 708, time: 1.8 },
      { id: 'send', label: 'Send', x: 196, y: 530, time: 1.5 },
    ],
  },
  hooverAreas: [
    [{ x: 40, y: 760 }, { x: 330, y: 760 }],
    [{ x: 330, y: 785 }, { x: 140, y: 785 }],
    [{ x: 140, y: 740 }, { x: 360, y: 740 }],
  ],
  tellPos: { door: 'door', play: 'drawer', nothing: 'centre' },
  schemePos: { doorHandle: 'handle', keyboard: 'keyboard' },
  floor: { x: 140, y: 740, w: 240, h: 55 },
};

const sofa: PlaceDef = {
  id: 'sofa', name: 'Sofa', view: 'Your own lap, and the coffee table',
  positions: {
    far: P(300, 470, 0.46), near: P(196, 612, 0.95), lap: P(196, 800, 1.15, -1), basket: P(318, 715, 0.75, 1),
    box: P(64, 478, 0.5), centre: P(196, 612, 0.95), table: P(196, 612, 0.95),
  },
  demands: ['lap', 'play', 'nothing'],
  lap: { x: 40, y: 690, w: 310, h: 110 },
  wand: { x: 344, y: 676 }, wandLabel: 'Toy basket',
  box: { x: 64, y: 478 },
  objects: [{ kind: 'vase', x: 120, y: 278 }, { kind: 'photoFrame', x: 196, y: 278 }, { kind: 'snowGlobe', x: 272, y: 278 }],
  chores: {
    tidy: [
      { id: 'remote', label: 'Remote', x: 56, y: 548, time: 1.6 },
      { id: 'cup', label: 'Cup', x: 126, y: 592, time: 1.6 },
      { id: 'book', label: 'Book', x: 196, y: 548, time: 1.6 },
      { id: 'candle', label: 'Candle', x: 266, y: 592, time: 1.6 },
      { id: 'coaster', label: 'Coaster', x: 336, y: 548, time: 1.6 },
    ],
  },
  hooverAreas: [
    [{ x: 40, y: 470 }, { x: 350, y: 470 }],
    [{ x: 350, y: 640 }, { x: 40, y: 640 }],
    [{ x: 40, y: 670 }, { x: 350, y: 670 }],
  ],
  tellPos: { lap: 'lap', play: 'basket', nothing: 'centre' },
  schemePos: {},
  lapCoverY: 640,
  floor: { x: 30, y: 440, w: 330, h: 60 },
};

const bedroom: PlaceDef = {
  id: 'bedroom', name: 'Bedroom', view: 'The bed and the washing basket',
  positions: {
    far: P(330, 452, 0.46), near: P(196, 640, 0.95), lap: P(196, 800, 1.15, -1), door: P(60, 478, 0.48, -1),
    handle: P(78, 478, 0.5, -1), pile: P(326, 640, 0.85), centre: P(220, 600, 0.9),
  },
  demands: ['lap', 'door', 'nothing'],
  door: { x: 6, y: 176, w: 90, h: 302 },
  lap: { x: 40, y: 700, w: 310, h: 100 },
  objects: [{ kind: 'perfume', x: 200, y: 296 }, { kind: 'alarmClock', x: 272, y: 296 }],
  chores: {
    washing: [
      { id: 'g1', label: 'Shirt', x: 72, y: 560, time: 1.4 },
      { id: 'g2', label: 'Socks', x: 162, y: 540, time: 1.4 },
      { id: 'g3', label: 'Jumper', x: 252, y: 560, time: 1.6 },
      { id: 'g4', label: 'Towel', x: 112, y: 640, time: 1.6 },
      { id: 'g5', label: 'Jeans', x: 232, y: 650, time: 1.6 },
      { id: 'g6', label: 'Pillowcase', x: 330, y: 560, time: 1.4 },
    ],
  },
  hooverAreas: [
    [{ x: 120, y: 470 }, { x: 370, y: 470 }],
    [{ x: 370, y: 690 }, { x: 40, y: 690 }],
    [{ x: 40, y: 720 }, { x: 350, y: 720 }],
  ],
  tellPos: { lap: 'lap', door: 'door', nothing: 'centre' },
  schemePos: { doorHandle: 'handle' },
  lapCoverY: 640,
  floor: { x: 110, y: 440, w: 260, h: 50 },
};

const hallway: PlaceDef = {
  id: 'hallway', name: 'Hallway', view: 'The front door and the stairs',
  positions: {
    far: P(318, 342, 0.5, -1), near: P(206, 700, 1.05), door: P(140, 560, 0.75, -1), centre: P(206, 700, 1.05), cupboard: P(312, 640, 0.7),
  },
  demands: ['door', 'nothing'],
  door: { x: 40, y: 150, w: 160, h: 400 },
  objects: [{ kind: 'keys', x: 232, y: 452 }, { kind: 'figurine', x: 282, y: 452 }],
  chores: {},
  hooverAreas: [
    [{ x: 40, y: 620 }, { x: 350, y: 620 }],
    [{ x: 350, y: 700 }, { x: 40, y: 700 }],
    [{ x: 40, y: 775 }, { x: 350, y: 775 }],
  ],
  tellPos: { door: 'door', nothing: 'centre' },
  schemePos: {},
  floor: { x: 30, y: 600, w: 330, h: 190 },
};

export const PLACES: Record<PlaceId, PlaceDef> = { kitchen, study, sofa, bedroom, hallway };
export const PLACE_ORDER: PlaceId[] = ['kitchen', 'study', 'sofa', 'bedroom', 'hallway'];

export const OBJECT_NAMES: Record<string, string> = {
  plantPot: 'Pot plant', saltShaker: 'Salt shaker', egg: 'Egg', figurine: 'China figurine', mug: 'Mug', vase: 'Vase',
  photoFrame: 'Photo frame', snowGlobe: 'Snow globe', perfume: 'Perfume', alarmClock: 'Alarm clock', keys: 'Keys',
  scoreCounter: 'The score', plasterCounter: 'The plasters',
};

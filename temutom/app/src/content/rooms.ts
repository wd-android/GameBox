import type { RoomDef, RoomId, Spot } from '../sim/types';

type SpotIn = Omit<Spot, 'adjacentTo'> & { adjacentTo?: string[] };

const ADJ_RANGE = 40;

function withAdjacency(spots: SpotIn[]): Spot[] {
  return spots.map((s) => {
    if (s.adjacentTo) return s as Spot;
    const near = spots
      .filter((o) => o.id !== s.id)
      .map((o) => ({ id: o.id, d: Math.hypot(o.x - s.x, o.y - s.y) }))
      .sort((a, b) => a.d - b.d);
    const adj = near.filter((n) => n.d <= ADJ_RANGE).map((n) => n.id);
    while (adj.length < 2 && adj.length < near.length) adj.push(near[adj.length].id);
    return { ...s, adjacentTo: adj };
  });
}

const kitchen: RoomDef = {
  id: 'kitchen',
  name: 'Kitchen',
  throne: 'worktop',
  throneName: 'The clean worktop',
  spots: withAdjacency([
    { id: 'bowl', kind: 'bowl', label: 'Bowl', x: 18, y: 112 },
    { id: 'backDoor', kind: 'door', label: 'Back door', x: 88, y: 64, doorId: 'back' },
    { id: 'worktop', kind: 'throne', label: 'Clean worktop', x: 52, y: 44, blocks: 'hob' },
    { id: 'cupboard', kind: 'scheme', label: 'Treat cupboard', x: 20, y: 44, schemeId: 'treats' },
    { id: 'sill', kind: 'ledge', label: 'Windowsill', x: 36, y: 24, slots: 2 },
    { id: 'fridgeTop', kind: 'ledge', label: 'Top of the fridge', x: 74, y: 22, slots: 1 },
    { id: 'mid', kind: 'floor', label: 'Floor', x: 46, y: 84 },
    { id: 'chair', kind: 'lap', label: 'Kitchen chair', x: 74, y: 98, seat: 'table' },
    { id: 'underTable', kind: 'hide', label: 'Under the table', x: 86, y: 120 },
    { id: 'mat', kind: 'floor', label: 'Mat', x: 44, y: 116 },
    { id: 'box', kind: 'box', label: 'A box', x: 60, y: 122, optional: true },
  ]),
  points: {
    hob: { x: 54, y: 58 },
    sink: { x: 32, y: 58 },
    table: { x: 74, y: 98 },
    bowl: { x: 28, y: 106 },
    cupboard: { x: 22, y: 60 },
    entry: { x: 92, y: 70 },
    toy: { x: 46, y: 100 },
  },
  doors: ['back'],
  entry: 'entry',
  objectPool: ['mug', 'egg', 'saltShaker', 'spoon', 'tomato'],
  demands: ['food', 'door'],
  routines: {
    soft: [
      { at: 'hob', task: 'cook', dur: 12 },
      { at: 'sink', task: 'tidy', dur: 9 },
      { at: 'table', task: 'sit', dur: 12 },
    ],
    busy: [
      { at: 'table', task: 'phone', dur: 16 },
      { at: 'hob', task: 'cook', dur: 10 },
    ],
    guest: [{ at: 'table', task: 'phone', dur: 999 }],
    soft2: [
      { at: 'table', task: 'sit', dur: 15 },
      { at: 'sink', task: 'tidy', dur: 8 },
    ],
  },
};

const living: RoomDef = {
  id: 'living',
  name: 'Living room',
  throne: 'armchair',
  throneName: 'The armchair',
  spots: withAdjacency([
    { id: 'armchair', kind: 'throne', label: 'Armchair', x: 80, y: 74, seat: 'armchair' },
    { id: 'sofa', kind: 'lap', label: 'Sofa', x: 30, y: 74, seat: 'sofa' },
    { id: 'shelf', kind: 'ledge', label: 'Ornament shelf', x: 18, y: 28, slots: 2 },
    { id: 'tvTop', kind: 'ledge', label: 'Top of the telly', x: 56, y: 34, slots: 1 },
    { id: 'toys', kind: 'toy', label: 'Toy basket', x: 56, y: 116 },
    { id: 'behindSofa', kind: 'hide', label: 'Behind the sofa', x: 10, y: 98 },
    { id: 'door', kind: 'door', label: 'Door', x: 90, y: 44, doorId: 'hall' },
    { id: 'rug', kind: 'floor', label: 'Rug', x: 52, y: 88 },
    { id: 'corner', kind: 'floor', label: 'Corner', x: 86, y: 116 },
    { id: 'socket', kind: 'socket', label: 'Plug socket', x: 28, y: 118, schemeId: 'plug' },
    { id: 'box', kind: 'box', label: 'A box', x: 70, y: 100, optional: true },
  ]),
  points: {
    sofa: { x: 30, y: 74 },
    armchair: { x: 80, y: 74 },
    tv: { x: 56, y: 58 },
    shelf: { x: 22, y: 56 },
    toy: { x: 52, y: 108 },
    entry: { x: 94, y: 52 },
  },
  doors: ['hall'],
  entry: 'entry',
  objectPool: ['vase', 'remote', 'photoFrame', 'candle', 'snowGlobe'],
  demands: ['door', 'play', 'lap'],
  routines: {
    soft: [
      { at: 'sofa', task: 'tv', dur: 16 },
      { at: 'shelf', task: 'tidy', dur: 8 },
    ],
    busy: [
      { at: 'armchair', task: 'phone', dur: 14 },
      { at: 'tv', task: 'tidy', dur: 6 },
    ],
    guest: [
      { at: 'armchair', task: 'read', dur: 22 },
      { at: 'tv', task: 'tidy', dur: 5 },
      { at: 'entry', task: 'away', dur: 12 },
    ],
    soft2: [{ at: 'sofa', task: 'tv', dur: 999 }],
  },
};

const study: RoomDef = {
  id: 'study',
  name: 'Study',
  throne: 'laptop',
  throneName: 'The laptop keyboard',
  spots: withAdjacency([
    { id: 'laptop', kind: 'throne', label: 'Laptop keyboard', x: 58, y: 52, blocks: 'desk' },
    { id: 'deskChair', kind: 'lap', label: 'Desk chair', x: 58, y: 80, seat: 'desk', blocks: 'desk' },
    { id: 'sill', kind: 'ledge', label: 'Windowsill', x: 22, y: 26, slots: 2 },
    { id: 'books', kind: 'ledge', label: 'Bookshelf', x: 86, y: 22, slots: 1 },
    { id: 'door', kind: 'door', label: 'Door', x: 90, y: 60, doorId: 'study', schemeId: 'doorHandle' },
    { id: 'socket', kind: 'socket', label: 'Plug socket', x: 10, y: 96, schemeId: 'plug' },
    { id: 'rug', kind: 'floor', label: 'Rug', x: 34, y: 100 },
    { id: 'corner', kind: 'floor', label: 'Corner', x: 80, y: 116 },
    { id: 'underDesk', kind: 'hide', label: 'Under the desk', x: 44, y: 66 },
    { id: 'armchair', kind: 'lap', label: 'Reading chair', x: 18, y: 64, seat: 'reading' },
    { id: 'box', kind: 'box', label: 'A box', x: 56, y: 120, optional: true },
  ]),
  points: {
    desk: { x: 58, y: 80 },
    reading: { x: 18, y: 64 },
    shelf: { x: 80, y: 50 },
    toy: { x: 34, y: 106 },
    entry: { x: 94, y: 66 },
  },
  doors: ['study'],
  entry: 'entry',
  objectPool: ['pen', 'glasses', 'headphones', 'stapler', 'plantPot'],
  demands: ['door', 'lap'],
  routines: {
    busy: [{ at: 'desk', task: 'work', dur: 999 }],
    soft: [
      { at: 'reading', task: 'read', dur: 14 },
      { at: 'shelf', task: 'tidy', dur: 7 },
    ],
    guest: [{ at: 'reading', task: 'read', dur: 999 }],
    soft2: [{ at: 'reading', task: 'read', dur: 999 }],
  },
};

const bedroom: RoomDef = {
  id: 'bedroom',
  name: 'Bedroom',
  throne: 'pillow',
  throneName: 'The pillow',
  spots: withAdjacency([
    { id: 'pillow', kind: 'throne', label: 'Pillow', x: 32, y: 50 },
    { id: 'bed', kind: 'lap', label: 'Bed', x: 54, y: 70, seat: 'bed' },
    { id: 'underBed', kind: 'hide', label: 'Under the bed', x: 40, y: 92 },
    { id: 'wardrobe', kind: 'perch', label: 'Wardrobe top', x: 86, y: 18 },
    { id: 'dresser', kind: 'ledge', label: 'Dressing table', x: 66, y: 34, slots: 2 },
    { id: 'sill', kind: 'ledge', label: 'Windowsill', x: 40, y: 20, slots: 1 },
    { id: 'door', kind: 'door', label: 'Door', x: 10, y: 62, doorId: 'bed', schemeId: 'doorHandle' },
    { id: 'washing', kind: 'perch', label: 'The clean washing', x: 80, y: 92, blocks: 'washing' },
    { id: 'floor', kind: 'floor', label: 'Floor', x: 64, y: 118 },
    { id: 'rug', kind: 'floor', label: 'Rug', x: 18, y: 118 },
    { id: 'box', kind: 'box', label: 'A box', x: 90, y: 120, optional: true },
  ]),
  points: {
    bed: { x: 54, y: 70 },
    washing: { x: 72, y: 100 },
    dresser: { x: 66, y: 52 },
    toy: { x: 60, y: 110 },
    entry: { x: 6, y: 70 },
  },
  doors: ['bed'],
  entry: 'entry',
  objectPool: ['perfume', 'lipstick', 'earring', 'alarmClock', 'sock'],
  demands: ['lap', 'door'],
  routines: {
    soft: [
      { at: 'washing', task: 'tidy', dur: 10 },
      { at: 'bed', task: 'read', dur: 14 },
      { at: 'dresser', task: 'tidy', dur: 6 },
    ],
    busy: [
      { at: 'bed', task: 'phone', dur: 14 },
      { at: 'washing', task: 'tidy', dur: 8 },
    ],
    guest: [{ at: 'bed', task: 'read', dur: 999 }],
    soft2: [{ at: 'bed', task: 'read', dur: 999 }],
  },
};

const hallway: RoomDef = {
  id: 'hallway',
  name: 'Hallway',
  throne: 'topStair',
  throneName: 'The top stair',
  spots: withAdjacency([
    { id: 'topStair', kind: 'throne', label: 'Top stair', x: 82, y: 22 },
    { id: 'midStair', kind: 'perch', label: 'Halfway up', x: 80, y: 55 },
    { id: 'frontDoor', kind: 'door', label: 'Front door', x: 14, y: 52, doorId: 'front' },
    { id: 'console', kind: 'ledge', label: 'Hall table', x: 40, y: 46, slots: 2 },
    { id: 'shoes', kind: 'ledge', label: 'Shoe rack', x: 26, y: 104, slots: 1 },
    { id: 'cupboard', kind: 'hide', label: 'Hoover cupboard', x: 56, y: 100 },
    { id: 'mat', kind: 'floor', label: 'Doormat', x: 20, y: 80 },
    { id: 'floor', kind: 'floor', label: 'Floor', x: 46, y: 80 },
    { id: 'bottomStair', kind: 'lap', label: 'Bottom stair', x: 80, y: 88, seat: 'stair' },
    { id: 'socket', kind: 'socket', label: 'Plug socket', x: 92, y: 118, schemeId: 'plug' },
    { id: 'box', kind: 'box', label: 'A box', x: 40, y: 122, optional: true },
  ]),
  points: {
    stair: { x: 80, y: 88 },
    console: { x: 40, y: 64 },
    mat: { x: 24, y: 70 },
    shoes: { x: 30, y: 92 },
    toy: { x: 46, y: 96 },
    entry: { x: 54, y: 126 },
  },
  doors: ['front'],
  entry: 'entry',
  objectPool: ['keys', 'figurine', 'coaster', 'glove'],
  demands: ['door', 'play', 'lap'],
  routines: {
    soft: [
      { at: 'shoes', task: 'tidy', dur: 9 },
      { at: 'stair', task: 'phone', dur: 12 },
    ],
    busy: [
      { at: 'console', task: 'phone', dur: 12 },
      { at: 'mat', task: 'tidy', dur: 6 },
    ],
    guest: [{ at: 'stair', task: 'phone', dur: 999 }],
    soft2: [{ at: 'stair', task: 'sit', dur: 999 }],
  },
};

export const ROOMS: Record<RoomId, RoomDef> = { kitchen, living, study, bedroom, hallway };

/** The 24 cabinet kinds in v1 */
export const OBJECTS: Record<string, { name: string; breakable: boolean }> = {
  mug: { name: 'Mug', breakable: true },
  egg: { name: 'Egg', breakable: true },
  saltShaker: { name: 'Salt shaker', breakable: false },
  spoon: { name: 'Spoon', breakable: false },
  tomato: { name: 'Tomato', breakable: true },
  vase: { name: 'Vase', breakable: true },
  remote: { name: 'Remote control', breakable: false },
  photoFrame: { name: 'Photo frame', breakable: true },
  candle: { name: 'Candle', breakable: false },
  snowGlobe: { name: 'Snow globe', breakable: true },
  pen: { name: 'Pen', breakable: false },
  glasses: { name: 'Reading glasses', breakable: true },
  headphones: { name: 'Headphones', breakable: false },
  stapler: { name: 'Stapler', breakable: false },
  plantPot: { name: 'Pot plant', breakable: true },
  perfume: { name: 'Perfume', breakable: true },
  lipstick: { name: 'Lipstick', breakable: false },
  earring: { name: 'Earring', breakable: false },
  alarmClock: { name: 'Alarm clock', breakable: false },
  sock: { name: 'Sock', breakable: false },
  keys: { name: 'Keys', breakable: false },
  figurine: { name: 'China figurine', breakable: true },
  coaster: { name: 'Coaster', breakable: false },
  glove: { name: 'Glove', breakable: false },
};

export const ROOM_ORDER: RoomId[] = ['kitchen', 'living', 'study', 'bedroom', 'hallway'];

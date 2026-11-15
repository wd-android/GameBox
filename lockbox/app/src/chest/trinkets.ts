/**
 * Trinket sets (§11): four sets of eight per chapter, plus a few rare items.
 * Each trinket has a name, a glyph and a tint for its drawn token.
 */
export interface Trinket {
  id: string;
  name: string;
  glyph: string;
  tint: string;
  set: string;
  chapter: number;
  rare?: boolean;
}

export interface TrinketSet {
  id: string;
  name: string;
  chapter: number;
  items: Trinket[];
}

function set(chapter: number, id: string, name: string, glyph: string, items: [string, string][]): TrinketSet {
  return { id, name, chapter, items: items.map(([n, tint], i) => ({ id: `${id}-${i + 1}`, name: n, glyph, tint, set: id, chapter })) };
}

export const SETS: TrinketSet[] = [
  set(1, 'keys', 'Old Keys', '🗝️', [
    ['Brass key', '#d4a64a'],
    ['Iron key', '#8a8f9c'],
    ['Silver key', '#d8dbe6'],
    ['Copper key', '#c8743c'],
    ['Bone key', '#efe6cf'],
    ['Glass key', '#9fe8ff'],
    ['Skeleton key', '#5a5466'],
    ['Ribboned key', '#ff6b9a'],
  ]),
  set(1, 'buttons', 'Buttons & Thimbles', '🧵', [
    ['Pearl button', '#f4efe6'],
    ['Horn button', '#7a5235'],
    ['Enamel button', '#3d7bff'],
    ['Silver thimble', '#cfd3dd'],
    ['Brass thimble', '#d4a64a'],
    ['Velvet pincushion', '#c0395b'],
    ['Wooden bobbin', '#b07f4f'],
    ['Lace bobbin', '#efe6cf'],
  ]),
  set(1, 'postcards', 'Postcards', '💌', [
    ['From Paris', '#ff8a5c'],
    ['From Venice', '#06c8c8'],
    ['From Cairo', '#ffc93c'],
    ['From Kyoto', '#ff6b9a'],
    ['From Lisbon', '#3d7bff'],
    ['From Vienna', '#9259fe'],
    ['From Oslo', '#9fe8ff'],
    ['From Lima', '#34c759'],
  ]),
  set(1, 'soldiers', 'Toy Soldiers', '💂', [
    ['Drummer', '#e8463c'],
    ['Bugler', '#ffc93c'],
    ['Captain', '#3d7bff'],
    ['Piper', '#34c759'],
    ['Sentry', '#5a5466'],
    ['Cavalry', '#b07f4f'],
    ['Flag bearer', '#ffffff'],
    ['General', '#d4a64a'],
  ]),
  set(2, 'coins', 'Foreign Coins', '🪙', [
    ['Spanish real', '#d8dbe6'],
    ['Dutch guilder', '#ff8a2a'],
    ['Venetian ducat', '#ffc93c'],
    ['Ottoman akçe', '#cfd3dd'],
    ['Chinese cash', '#c8743c'],
    ['Indian rupee', '#d4a64a'],
    ['Danish krone', '#e8463c'],
    ['Portuguese cruzado', '#06c8c8'],
  ]),
  set(2, 'charts', 'Compasses & Charts', '🧭', [
    ['Pocket compass', '#d4a64a'],
    ['Sun compass', '#ffc93c'],
    ['Sea chart', '#9fe8ff'],
    ['Star chart', '#9259fe'],
    ['Sextant', '#cfd3dd'],
    ['Astrolabe', '#c8743c'],
    ['Logbook', '#7a5235'],
    ['Telescope', '#3d7bff'],
  ]),
  set(2, 'glass', 'Sea Glass', '💎', [
    ['Bottle green', '#34c759'],
    ['Cobalt', '#3d7bff'],
    ['Amber', '#ff8a2a'],
    ['Seafoam', '#7fffd4'],
    ['Lavender', '#b49cff'],
    ['Ruby', '#e8463c'],
    ['Milk glass', '#f4efe6'],
    ['Aqua', '#06c8c8'],
  ]),
  set(2, 'shells', 'Shells & Pearls', '🐚', [
    ['Cowrie', '#efe6cf'],
    ['Conch', '#ff9ec7'],
    ['Nautilus', '#d8a06a'],
    ['Scallop', '#ff8a5c'],
    ['Abalone', '#7fffd4'],
    ['Black pearl', '#3a3446'],
    ['White pearl', '#f4efe6'],
    ['Pink pearl', '#ff9ec7'],
  ]),
];

export const RARES: Trinket[] = [
  { id: 'rare-1', name: 'Jewelled music box', glyph: '🎼', tint: '#ffd166', set: 'rare', chapter: 1, rare: true },
  { id: 'rare-2', name: 'Golden locket', glyph: '📿', tint: '#ffd166', set: 'rare', chapter: 1, rare: true },
  { id: 'rare-3', name: 'Ruby brooch', glyph: '💍', tint: '#e8463c', set: 'rare', chapter: 1, rare: true },
  { id: 'rare-4', name: "Captain's hourglass", glyph: '⏳', tint: '#ffd166', set: 'rare', chapter: 2, rare: true },
  { id: 'rare-5', name: 'Pirate doubloon', glyph: '🏴‍☠️', tint: '#ffc93c', set: 'rare', chapter: 2, rare: true },
  { id: 'rare-6', name: 'Crown of the deep', glyph: '👑', tint: '#ffd166', set: 'rare', chapter: 2, rare: true },
];

export const ALL_TRINKETS: Trinket[] = [...SETS.flatMap((s) => s.items), ...RARES];

export function trinket(id: string): Trinket | undefined {
  return ALL_TRINKETS.find((t) => t.id === id);
}

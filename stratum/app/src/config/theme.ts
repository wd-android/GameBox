/**
 * Visual style. The UI chrome follows the "Battle Game Apps UI Kit" Figma file
 * supplied as the style guide: deep violet backgrounds with purple gradient
 * cards, glowing cyan pill buttons, Readex Pro type, rounded 20–30 px corners.
 */
export const THEME = {
  bg: '#1b043b',
  bgDeep: '#120228',
  cardTop: '#5b33a0',
  cardBottom: '#270951',
  violet: '#9259fe',
  violetDeep: '#482585',
  accent: '#06ffff',
  text: '#ffffff',
  textDim: '#d0c8df',
  gold: '#f6921e',
} as const;

/**
 * The eight sand colours: strongly saturated, each with a pattern for players
 * who cannot tell colours apart (§11). Index 0 is "empty"; colours are 1..8.
 */
export interface SandColour {
  name: string;
  rgb: [number, number, number];
  pattern: 'none' | 'dots' | 'stripes' | 'cross' | 'checks' | 'diag' | 'rings' | 'bars';
  /** Base pitch offset for the pouring hiss, in semitones. */
  tone: number;
}

export const SAND_COLOURS: SandColour[] = [
  { name: 'empty', rgb: [0, 0, 0], pattern: 'none', tone: 0 },
  { name: 'Coral', rgb: [255, 84, 84], pattern: 'none', tone: 0 },
  { name: 'Amber', rgb: [255, 170, 30], pattern: 'dots', tone: 2 },
  { name: 'Lemon', rgb: [255, 230, 60], pattern: 'stripes', tone: 4 },
  { name: 'Leaf', rgb: [70, 210, 90], pattern: 'cross', tone: 5 },
  { name: 'Lagoon', rgb: [20, 200, 220], pattern: 'checks', tone: 7 },
  { name: 'Cobalt', rgb: [60, 100, 255], pattern: 'diag', tone: 9 },
  { name: 'Orchid', rgb: [200, 80, 240], pattern: 'rings', tone: 11 },
  { name: 'Chalk', rgb: [245, 240, 230], pattern: 'bars', tone: 12 },
];

/** Whether the pattern for a colour darkens grid cell (x, y). */
export function patternHit(pattern: SandColour['pattern'], x: number, y: number): boolean {
  switch (pattern) {
    case 'none':
      return false;
    case 'dots':
      return x % 4 === 1 && y % 4 === 1;
    case 'stripes':
      return y % 4 === 0;
    case 'cross':
      return (x % 6 === 2 && y % 6 >= 1 && y % 6 <= 3) || (y % 6 === 2 && x % 6 >= 1 && x % 6 <= 3);
    case 'checks':
      return ((x >> 2) + (y >> 2)) % 2 === 0 && x % 2 === 0 && y % 2 === 0;
    case 'diag':
      return (x + y) % 5 === 0;
    case 'rings': {
      const dx = (x % 8) - 3.5;
      const dy = (y % 8) - 3.5;
      const d = dx * dx + dy * dy;
      return d > 5 && d < 9;
    }
    case 'bars':
      return x % 4 === 0;
  }
}

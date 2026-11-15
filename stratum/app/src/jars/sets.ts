/** Themed sets of jars on the shelf (§9). Match jars are grouped ten to a set. */
export interface SetDef {
  name: string;
  first: number;
  last: number;
  /** Colours the set draws its palettes from. */
  colours: number[];
  /** Decoration awarded for completing the set at two stars or better. */
  decoration: string;
}

export const SETS: SetDef[] = [
  { name: 'Stripes', first: 1, last: 10, colours: [1, 2, 3, 4, 5, 6, 7, 8], decoration: '🎗️' },
  { name: 'Deserts', first: 11, last: 20, colours: [2, 3, 1, 8, 7], decoration: '🌵' },
  { name: 'Sunsets', first: 21, last: 30, colours: [1, 2, 3, 7, 6], decoration: '🌅' },
  { name: 'Seas', first: 31, last: 40, colours: [6, 5, 8, 3, 4], decoration: '🐚' },
  { name: 'Hills', first: 41, last: 50, colours: [4, 5, 3, 6, 8], decoration: '⛰️' },
  { name: 'Canyons', first: 51, last: 60, colours: [1, 2, 8, 7, 3], decoration: '🪨' },
  { name: 'Meadows', first: 61, last: 70, colours: [4, 3, 7, 5, 8, 1], decoration: '🌼' },
  { name: 'Auroras', first: 71, last: 80, colours: [6, 4, 7, 5, 8, 3], decoration: '✨' },
];

export function setForJar(id: number): SetDef {
  return SETS.find((s) => id >= s.first && id <= s.last) ?? SETS[0];
}

/**
 * Sea charts (§8.1): rocks, currents and the harbour mouth. Units are tiles;
 * the sea is 12 × 16 with y running down, and the harbour strip below it.
 * Charts are hand-made; the chart editor (tools/chart-editor) shows the safe-route grid.
 */
export interface Rock {
  x: number;
  y: number;
  /** Radius of the rock body. Distances in the rules are measured from its edge. */
  r: number;
}

export interface Current {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Unit direction of flow. */
  dx: number;
  dy: number;
  /** Strength relative to the night's current strength (1 = as given). */
  k: number;
  /** First night on which this current flows. */
  from: number;
}

export interface Chart {
  id: 'bay' | 'skerries';
  name: string;
  rocks: Rock[];
  currents: Current[];
  harbour: { x: number; y: number; r: number };
}

const dir = (deg: number) => ({ dx: Math.cos((deg * Math.PI) / 180), dy: Math.sin((deg * Math.PI) / 180) });

export const HOME_BAY: Chart = {
  id: 'bay',
  name: 'Home Bay',
  rocks: [
    { x: 2.6, y: 3.6, r: 0.5 },
    { x: 9.0, y: 2.8, r: 0.45 },
    { x: 5.6, y: 6.6, r: 0.6 },
    { x: 10.2, y: 8.4, r: 0.5 },
    { x: 2.3, y: 10.5, r: 0.55 },
    { x: 7.4, y: 10.6, r: 0.45 },
    { x: 3.9, y: 12.9, r: 0.42 },
    { x: 10.6, y: 13.2, r: 0.4 },
  ],
  currents: [{ x: 0, y: 7.4, w: 12, h: 2.2, ...dir(0), k: 1, from: 5 }],
  harbour: { x: 8.4, y: 15.5, r: 0.7 },
};

/** A reef across the middle with two channels through it. */
function reef(): Rock[] {
  const rocks: Rock[] = [];
  const xs = [0.35, 1.0, 4.6, 5.35, 6.1, 6.85, 7.5, 11.0, 11.65];
  xs.forEach((x, i) => rocks.push({ x, y: 7.9 + (i % 2 ? 0.35 : -0.15), r: 0.45 }));
  return rocks;
}

export const SKERRIES: Chart = {
  id: 'skerries',
  name: 'The Skerries',
  rocks: [
    ...reef(),
    { x: 6.0, y: 3.0, r: 0.5 },
    { x: 2.2, y: 4.6, r: 0.4 },
    { x: 10.0, y: 4.2, r: 0.45 },
    { x: 3.4, y: 11.6, r: 0.45 },
    { x: 6.4, y: 12.4, r: 0.4 },
    { x: 10.9, y: 11.4, r: 0.4 },
  ],
  currents: [
    { x: 0, y: 4.9, w: 12, h: 1.8, ...dir(180), k: 1, from: 21 },
    { x: 0, y: 9.4, w: 12, h: 1.8, ...dir(0), k: 0.8, from: 21 },
  ],
  harbour: { x: 8.4, y: 15.5, r: 0.7 },
};

export const CHARTS: Record<Chart['id'], Chart> = { bay: HOME_BAY, skerries: SKERRIES };

/** Distance from a point to a rock's edge (negative inside). */
export function rockGap(r: Rock, x: number, y: number): number {
  return Math.hypot(x - r.x, y - r.y) - r.r;
}

export function nearestRockGap(chart: Chart, x: number, y: number): number {
  let best = Infinity;
  for (const r of chart.rocks) best = Math.min(best, rockGap(r, x, y));
  return best;
}

/** Puzzle model (§5). No drawing code. */

export type PieceKind = 'standard' | 'tall';
export type Holds = PieceKind | 'gap';

export interface Slot {
  id: number;
  x: number;
  y: number;
  /** Direction of fall, degrees: 0 = +x, 90 = +y (up the board). */
  facing: number;
  holds: Holds;
}

export interface Link {
  from: number;
  to: number;
  reach: 1 | 2;
}

export interface Ramp {
  trigger: number;
  target: number;
  travelMs: number;
  /** Drawing only: the ball's path across the board. */
  path: [number, number][];
}

export interface Puzzle {
  id: string;
  difficulty: number;
  board: { width: number; height: number };
  slots: Slot[];
  links: Link[];
  ramps: Ramp[];
  start: number;
  flag: number;
  tray: PieceKind[];
  par: number;
  /** Optional title (pack and tutorial puzzles). */
  title?: string;
}

/** Which tray piece goes in which gap: gap slot id → piece kind. */
export type Placement = Map<number, PieceKind>;

export function gapIds(p: Puzzle): number[] {
  return p.slots.filter((s) => s.holds === 'gap').map((s) => s.id);
}

/** Links indexed by source slot. */
export interface LinkIndex {
  reach1: number[][];
  /** reach2[from] = set of targets two places ahead */
  reach2: Set<number>[];
  /** For each slot, the ramps it triggers. */
  ramps: Ramp[][];
}

const indexCache = new WeakMap<Puzzle, LinkIndex>();

export function linkIndex(p: Puzzle): LinkIndex {
  let idx = indexCache.get(p);
  if (idx) return idx;
  const n = p.slots.length;
  const reach1: number[][] = Array.from({ length: n }, () => []);
  const reach2: Set<number>[] = Array.from({ length: n }, () => new Set());
  const ramps: Ramp[][] = Array.from({ length: n }, () => []);
  for (const l of p.links) {
    if (l.reach === 1) reach1[l.from].push(l.to);
    else reach2[l.from].add(l.to);
  }
  for (const r of reach1) r.sort((a, b) => a - b);
  for (const r of p.ramps) ramps[r.trigger].push(r);
  idx = { reach1, reach2, ramps };
  indexCache.set(p, idx);
  return idx;
}

/**
 * Builds the reach-2 links: for every reach-1 link a→b and b→c, a→c with
 * reach 2 ("every slot is also linked to the slot two places ahead").
 */
export function withReach2(links: Link[]): Link[] {
  const r1 = links.filter((l) => l.reach === 1);
  const out: Link[] = [...r1];
  const seen = new Set<string>();
  for (const ab of r1)
    for (const bc of r1) {
      if (bc.from !== ab.to || bc.to === ab.from) continue;
      const key = `${ab.from}>${bc.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from: ab.from, to: bc.to, reach: 2 });
    }
  return out;
}

import type { Puzzle } from '../chain/model';

/** Puzzle files are the §5.3 format with coordinates rounded to keep the bundle small. */
export function compactPuzzle(p: Puzzle): Puzzle {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    ...p,
    slots: p.slots.map((s) => ({ ...s, x: r2(s.x), y: r2(s.y), facing: Math.round(s.facing) })),
    ramps: p.ramps.map((r) => ({ ...r, path: r.path.map(([x, y]) => [r2(x), r2(y)] as [number, number]) })),
  };
}

import { TUNING } from '../config/tuning';

/**
 * A chunk (§7.1): a hand-made section of sky, 12 tiles wide and 20 tall.
 * Coordinates are tiles; y grows up the sky from the chunk's bottom edge.
 */
export interface CloudDef {
  x: number;
  y: number;
  r: number;
  /** Slow sideways drift: amplitude in tiles and period in seconds. */
  drift?: { amp: number; period: number };
}

export interface WireDef {
  y: number;
  /** Open gaps along the wire as [x0, x1]; the rest of the width is wire. */
  gaps: [number, number][];
}

export interface RectDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Chunk {
  id: string;
  tier: number;
  clouds: CloudDef[];
  wires: WireDef[];
  pylons: RectDef[];
  strays: { x: number; y: number }[];
  thermals: RectDef[];
  tree?: { x: number; y: number };
}

export const WIRE_HALF = 0.05;

/** The spans of a wire that are solid. */
export function wireSpans(w: WireDef): [number, number][] {
  const gaps = [...w.gaps].sort((a, b) => a[0] - b[0]);
  const spans: [number, number][] = [];
  let x = 0;
  for (const [g0, g1] of gaps) {
    if (g0 > x) spans.push([x, g0]);
    x = Math.max(x, g1);
  }
  if (x < TUNING.SKY_W) spans.push([x, TUNING.SKY_W]);
  return spans;
}

/** Cloud centre x at time t (seconds since the run began). */
export function cloudX(c: CloudDef, t: number): number {
  if (!c.drift) return c.x;
  return c.x + c.drift.amp * Math.sin((2 * Math.PI * t) / c.drift.period);
}

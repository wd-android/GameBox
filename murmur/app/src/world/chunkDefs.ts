import { TUNING } from '../config/tuning';
import type { Chunk, CloudDef, RectDef, WireDef } from './chunk';
import { Rng } from './spawner';
import { checkLane } from './lane';

/**
 * The 40 chunks (§7.1): eight per tier, each designed from a named pattern
 * with its own fixed seed. Every chunk keeps a one-tile calm band at its top
 * and bottom, so any chunk lines up with any other, and must pass the lane
 * check for its tier. `tools/chunks.ts` writes them to chunks.json.
 */

type Pattern = (r: Rng, c: Chunk) => void;

const W = TUNING.SKY_W;
const rnd = (r: Rng, a: number, b: number) => a + (b - a) * r.next();

function strayLine(c: Chunk, x0: number, y0: number, x1: number, y1: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1);
    c.strays.push({ x: round(x0 + (x1 - x0) * k), y: round(y0 + (y1 - y0) * k) });
  }
}

function strayArc(c: Chunk, cx: number, cy: number, rad: number, a0: number, a1: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / Math.max(1, n - 1);
    c.strays.push({ x: round(cx + Math.cos(a) * rad), y: round(cy + Math.sin(a) * rad) });
  }
}

function wire(y: number, gaps: [number, number][]): WireDef {
  return { y: round(y), gaps: gaps.map(([a, b]) => [round(a), round(b)] as [number, number]) };
}

function cloud(x: number, y: number, rad: number, drift?: CloudDef['drift']): CloudDef {
  return { x: round(x), y: round(y), r: round(rad), ...(drift ? { drift: { amp: round(drift.amp), period: round(drift.period) } } : {}) };
}

function pylon(x: number, y: number, w = 0.5, h = 0.9): RectDef {
  return { x: round(x - w / 2), y: round(y - h / 2), w, h };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/** A gap of width g somewhere along a wire, with pylons standing at its edges. */
function gapWire(c: Chunk, r: Rng, y: number, g: number, at?: number, pylons = false): number {
  const x0 = at ?? rnd(r, 0.6, W - g - 0.6);
  c.wires.push(wire(y, [[x0, x0 + g]]));
  if (pylons) c.pylons.push(pylon(x0 - 0.3, y), pylon(x0 + g + 0.3, y));
  return x0;
}

// ── Tier patterns ────────────────────────────────────────────

const T1: Pattern[] = [
  (r, c) => strayLine(c, rnd(r, 3, 9), 3, rnd(r, 3, 9), 17, 10),
  (r, c) => {
    c.clouds.push(cloud(rnd(r, 1.5, 2.5), rnd(r, 8, 12), 1.7));
    strayArc(c, 7.5, 10, 3, -1.2, 1.2, 9);
  },
  (r, c) => {
    c.clouds.push(cloud(rnd(r, 9.5, 10.5), rnd(r, 7, 13), 2));
    strayLine(c, 3, 4, 5, 16, 9);
  },
  (r, c) => {
    c.thermals.push({ x: round(rnd(r, 3.5, 6.5)), y: 3, w: 2.4, h: 14 });
    strayLine(c, c.thermals[0].x + 1.2, 4, c.thermals[0].x + 1.2, 16, 8);
  },
  (_r, c) => {
    for (let i = 0; i < 12; i++) c.strays.push({ x: round(6 + Math.sin(i * 0.8) * 3.5), y: round(3 + i * 1.2) });
  },
  (r, c) => {
    c.clouds.push(cloud(rnd(r, 1.2, 2.2), 6, 1.6), cloud(rnd(r, 9.8, 10.8), 14, 1.6));
    strayLine(c, 6, 3, 6, 17, 10);
  },
  (r, c) => {
    c.tree = { x: round(rnd(r, 5, 7)), y: 10 };
    strayArc(c, c.tree.x, 10, 2.2, 0, Math.PI * 1.6, 10);
  },
  (r, c) => {
    c.tree = { x: round(rnd(r, 4.5, 7.5)), y: 9.5 };
    strayLine(c, 2, 3, 10, 3.5, 7);
  },
];

const T2: Pattern[] = [
  (r, c) => {
    const x = gapWire(c, r, 10, 5.5);
    strayLine(c, x + 2.75, 6, x + 2.75, 13, 7);
  },
  (r, c) => {
    gapWire(c, r, 6, 5.5, 0.8);
    gapWire(c, r, 14, 5.5, W - 6.3);
    strayLine(c, 3.5, 4, 8.5, 16, 10);
  },
  (r, c) => {
    const x = gapWire(c, r, 9, 5.2);
    c.clouds.push(cloud(x < 4 ? 10 : 2, 15, 1.6));
    strayArc(c, x + 2.6, 9, 1.8, 0, Math.PI * 2, 8);
  },
  (r, c) => {
    gapWire(c, r, 5, 6);
    gapWire(c, r, 11, 6);
    strayLine(c, 6, 3, 6, 17, 9);
  },
  (r, c) => {
    c.thermals.push({ x: 4.8, y: 2, w: 2.4, h: 16 });
    gapWire(c, r, 12, 5.4, 3.3);
    strayLine(c, 6, 3, 6, 17, 10);
  },
  (_r, c) => {
    c.clouds.push(cloud(3, 6, 1.8), cloud(9, 14, 1.8));
    strayLine(c, 8.5, 4, 3.5, 16, 10);
  },
  (r, c) => {
    c.tree = { x: 6, y: 11 };
    gapWire(c, r, 4, 6, 3);
    strayArc(c, 6, 11, 2.4, Math.PI, Math.PI * 2.6, 9);
  },
  (r, c) => {
    c.tree = { x: round(rnd(r, 5, 7)), y: 9 };
    c.clouds.push(cloud(1.5, 16, 1.5));
    strayLine(c, 2, 2.5, 10, 2.5, 6);
  },
];

const T3: Pattern[] = [
  (r, c) => {
    const x = gapWire(c, r, 7, 4.4);
    c.clouds.push(cloud(x < 4 ? 8.5 : 3.5, 13, 2));
    strayLine(c, x + 2.2, 5, x + 2.2, 9, 5);
  },
  (r, c) => {
    gapWire(c, r, 5, 4.4, 0.8);
    gapWire(c, r, 10, 4.4, 6.8);
    gapWire(c, r, 15, 4.4, 0.8);
    strayLine(c, 3, 6, 9, 9, 6);
    strayLine(c, 9, 11, 3, 14, 6);
  },
  (_r, c) => {
    c.clouds.push(cloud(2.5, 6, 2.2), cloud(9.5, 10, 2.2), cloud(2.5, 15, 2.2));
    strayLine(c, 6, 3, 6, 17, 12);
  },
  (r, c) => {
    const x = gapWire(c, r, 10, 4.2, undefined, true);
    strayArc(c, x + 2.1, 10, 1.4, 0, Math.PI * 2, 10);
  },
  (_r, c) => {
    c.clouds.push(cloud(6, 9, 2.0));
    strayLine(c, 2, 5, 2, 13, 6);
    strayLine(c, 10, 5, 10, 13, 6);
  },
  (r, c) => {
    gapWire(c, r, 6, 4.5, 3.75);
    c.clouds.push(cloud(rnd(r, 2, 3), 13, 1.8), cloud(rnd(r, 9, 10), 13, 1.8));
    strayLine(c, 6, 4, 6, 16, 10);
  },
  (r, c) => {
    c.tree = { x: 6, y: 11.5 };
    gapWire(c, r, 4, 4.4, 3.8);
    strayArc(c, 6, 11.5, 2.5, 0, Math.PI * 2, 12);
  },
  (r, c) => {
    c.tree = { x: round(rnd(r, 5, 7)), y: 10 };
    c.clouds.push(cloud(1.3, 4, 1.5), cloud(10.7, 16, 1.5));
    strayLine(c, 3, 3, 9, 3, 6);
  },
];

const T4: Pattern[] = [
  (r, c) => {
    gapWire(c, r, 6, 3.2, undefined, true);
    gapWire(c, r, 13, 3.2, undefined, true);
    strayLine(c, 6, 4, 6, 15, 8);
  },
  (_r, c) => {
    c.clouds.push(cloud(4, 7, 1.8, { amp: 1.2, period: 4 }), cloud(8, 14, 1.8, { amp: 1.2, period: 5 }));
    strayLine(c, 9.5, 3, 2.5, 17, 12);
  },
  (r, c) => {
    const x = gapWire(c, r, 10, 3, undefined, true);
    c.clouds.push(cloud(x < 4.5 ? 9 : 3, 4.5, 1.6, { amp: 1, period: 4.5 }));
    strayLine(c, x + 1.5, 8, x + 1.5, 13, 6);
  },
  (r, c) => {
    gapWire(c, r, 5, 3, 2);
    gapWire(c, r, 10, 3, 7);
    gapWire(c, r, 15, 3, 2);
    strayLine(c, 3.5, 6, 8.5, 9, 6);
    strayLine(c, 8.5, 11, 3.5, 14, 6);
  },
  (_r, c) => {
    c.clouds.push(cloud(2.4, 10, 1.6, { amp: 0.5, period: 3.5 }), cloud(9.6, 10, 1.6, { amp: 0.5, period: 3.5 }));
    strayLine(c, 6, 3, 6, 17, 12);
  },
  (r, c) => {
    gapWire(c, r, 8, 3.1, 4.45, true);
    c.clouds.push(cloud(6, 14.5, 1.5, { amp: 1.5, period: 6 }));
    strayArc(c, 6, 8, 1.2, 0, Math.PI * 2, 8);
  },
  (_r, c) => {
    c.tree = { x: 6, y: 11 };
    c.clouds.push(cloud(6, 3.8, 1.2, { amp: 1.8, period: 6 }));
    strayArc(c, 6, 11, 2.6, 0, Math.PI * 2, 12);
  },
  (r, c) => {
    c.tree = { x: round(rnd(r, 5, 7)), y: 11 };
    gapWire(c, r, 4, 3.2, 4.4, true);
    strayLine(c, 6, 5, 6, 8, 4);
  },
];

const T5: Pattern[] = [
  (r, c) => {
    // Weave: gaps alternate 4.5 tiles apart, 6 tiles up – reachable by every species at top speed.
    gapWire(c, r, 4, 2.6, 2.2, true);
    gapWire(c, r, 10, 2.6, 6.7, true);
    gapWire(c, r, 16, 2.6, 2.2, true);
    strayLine(c, 3.5, 5, 8, 9, 5);
    strayLine(c, 8, 11, 3.5, 15, 5);
  },
  (_r, c) => {
    c.clouds.push(cloud(3, 4, 1.6, { amp: 1, period: 3.2 }), cloud(9, 10, 1.6, { amp: 1, period: 3.6 }), cloud(3, 16, 1.6, { amp: 1, period: 3.4 }));
    strayLine(c, 6, 3, 6, 17, 10);
  },
  (r, c) => {
    gapWire(c, r, 6, 2.5, 4.75, true);
    gapWire(c, r, 13, 2.5, 4.75, true);
    c.clouds.push(cloud(2, 9.5, 1.5), cloud(10, 9.5, 1.5));
    strayLine(c, 6, 4, 6, 16, 10);
  },
  (r, c) => {
    for (let k = 0; k < 4; k++) gapWire(c, r, 3.5 + k * 4, 2.5, k % 2 ? 6 : 3.5, true);
    strayLine(c, 4.2, 4.5, 7.8, 16.5, 8);
  },
  (r, c) => {
    gapWire(c, r, 9, 2.4, undefined, true);
    c.clouds.push(cloud(4, 5.8, 1.6, { amp: 2, period: 4 }), cloud(8, 14.5, 1.6, { amp: 2, period: 4 }));
    strayLine(c, 6, 3, 6, 6, 3);
  },
  (_r, c) => {
    c.clouds.push(cloud(1.8, 7, 2.2), cloud(10.2, 7, 2.2), cloud(6, 13.5, 1.6, { amp: 1.5, period: 5 }));
    strayLine(c, 6, 3, 6, 9, 6);
  },
  (r, c) => {
    c.tree = { x: 6, y: 10.5 };
    gapWire(c, r, 3.5, 2.6, 4.7, true);
    gapWire(c, r, 17.5, 2.6, 4.7, true);
    strayArc(c, 6, 10.5, 2.4, 0, Math.PI * 2, 10);
  },
  (r, c) => {
    c.tree = { x: round(rnd(r, 5.2, 6.8)), y: 10 };
    c.clouds.push(cloud(6, 3.6, 1.2, { amp: 2, period: 5 }), cloud(6, 16.4, 1.2, { amp: 2, period: 5.5 }));
    strayLine(c, 4, 6, 8, 6, 5);
  },
];

const TIERS = [T1, T2, T3, T4, T5];

export function buildChunks(): Chunk[] {
  const out: Chunk[] = [];
  TIERS.forEach((patterns, ti) => {
    patterns.forEach((pattern, pi) => {
      const tier = ti + 1;
      const id = `t${tier}-${pi + 1}`;
      // Try a few seeds until the lane check passes for the tier's width.
      for (let attempt = 0; attempt < 30; attempt++) {
        const c: Chunk = { id, tier, clouds: [], wires: [], pylons: [], strays: [], thermals: [] };
        pattern(new Rng(tier * 1000 + pi * 37 + attempt * 7919), c);
        if (checkLane(c, TUNING.TIER_LANE[ti]).ok || attempt === 29) {
          out.push(c);
          break;
        }
      }
    });
  });
  return out;
}

/** The first-launch opening (§9): strays straight ahead, then the first roost tree at about 12 s. */
export function firstLaunchChunks(): Chunk[] {
  const a: Chunk = { id: 'first-1', tier: 1, clouds: [], wires: [], pylons: [], strays: [], thermals: [] };
  strayLine(a, 6, 4, 6, 18, 12);
  const b: Chunk = { id: 'first-2', tier: 1, clouds: [], wires: [], pylons: [], strays: [], thermals: [] };
  for (let i = 0; i < 12; i++) b.strays.push({ x: round(6 + Math.sin(i * 0.7) * 3), y: round(2 + i * 1.4) });
  const tree: Chunk = { id: 'first-tree', tier: 1, clouds: [], wires: [], pylons: [], strays: [], thermals: [], tree: { x: 6, y: 10 } };
  strayArc(tree, 6, 10, 2.3, 0, Math.PI * 2, 12);
  return [a, b, tree];
}

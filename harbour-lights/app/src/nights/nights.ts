import { TUNING, type BoatKind } from '../config/tuning';
import { CHARTS, nearestRockGap, type Chart } from '../charts/charts';
import { routesFor } from '../sim/routes';
import { Rng } from '../sim/rng';
import accepted from './accepted.json';

/** A night (§8.2): `{ chart, seed, boats, mix, interval, fog, currentStrength }`. */
export interface NightDef {
  n: number;
  chart: Chart['id'];
  seed: number;
  boats: number;
  mix: BoatKind[];
  interval: number;
  /** 0 none, 1 light, 2 heavy. */
  fog: 0 | 1 | 2;
  currentStrength: number;
  maxOnSea: number;
  /** Tutorial nights carry a fixed arrival list. */
  scripted?: Arrival[];
  title?: string;
}

export interface Arrival {
  t: number;
  kind: BoatKind;
  x: number;
  y: number;
  /** Radians in screen space (0 = east, π/2 = south). */
  heading: number;
}

export interface FogBank {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

export const NIGHT_COUNT = 40;

/** The recipe for night n, before a seed is chosen (§8.2 table). */
export function recipe(n: number, seed = 0): NightDef {
  const r = new Rng(seed * 7919 + n);
  const between = (a: number, b: number) => a + r.int(b - a + 1);
  const chart: Chart['id'] = n <= 20 ? 'bay' : 'skerries';
  const mix: BoatKind[] = n >= 8 ? ['fishing', 'dinghy', 'trawler'] : n >= 4 ? ['fishing', 'dinghy'] : ['fishing'];
  let boats: number, interval: number, fog: 0 | 1 | 2, current: number;
  if (n <= 3) [boats, interval, fog, current] = [between(4, 6), 9, 0, 0];
  else if (n <= 7) [boats, interval, fog, current] = [between(7, 9), 7, 0, n >= 5 ? 0.3 : 0];
  else if (n <= 14) [boats, interval, fog, current] = [between(9, 12), 6, 0, 0.4];
  else if (n <= 20) [boats, interval, fog, current] = [between(12, 15), 5, 1, 0.55];
  else if (n <= 30) [boats, interval, fog, current] = [between(12, 16), 5, 2, 0.5];
  else [boats, interval, fog, current] = [between(15, 20), 4, 2, 0.7];
  return { n, chart, seed, boats, mix, interval, fog, currentStrength: current, maxOnSea: n < 15 ? TUNING.MAX_ON_SEA_EARLY : TUNING.MAX_ON_SEA_LATE };
}

/** Night n with its accepted seed (committed by tools/nights.ts). */
export function night(n: number): NightDef {
  const seeds = accepted as Record<string, number>;
  return recipe(n, seeds[n] ?? 0);
}

// ── Tutorial (§10, first launch) ──────────────────────────────

const toward = (x: number, y: number, tx: number, ty: number) => Math.atan2(ty - y, tx - x);

/** One boat heading for one rock, then two boats from opposite sides. */
export const TUTORIAL: NightDef[] = [
  {
    n: 0, chart: 'bay', seed: 1, boats: 1, mix: ['fishing'], interval: 0, fog: 0, currentStrength: 0, maxOnSea: 1,
    title: 'Light the boat',
    scripted: [{ t: 1.2, kind: 'fishing', x: 0.05, y: 4, heading: toward(0, 4, 5.6, 6.6) }],
  },
  {
    n: 0, chart: 'bay', seed: 2, boats: 2, mix: ['fishing'], interval: 0, fog: 0, currentStrength: 0, maxOnSea: 2,
    title: 'Two boats',
    scripted: [
      { t: 1.0, kind: 'fishing', x: 0.05, y: 5.4, heading: toward(0, 5.4, 5.6, 6.6) },
      { t: 2.0, kind: 'fishing', x: 11.95, y: 6.4, heading: toward(12, 6.4, 10.2, 8.4) },
    ],
  },
];

// ── Arrivals and fog from the seed ────────────────────────────

const KIND_WEIGHT: Record<BoatKind, number> = { fishing: 5, dinghy: 3, trawler: 2 };

export function arrivals(def: NightDef): Arrival[] {
  if (def.scripted) return def.scripted;
  const chart = CHARTS[def.chart];
  const grid = routesFor(chart);
  const rng = new Rng(def.seed * 31 + def.n * 1009 + 17);
  const list: Arrival[] = [];
  const leaves: number[] = [];
  let t = 2;
  for (let k = 0; k < def.boats; k++) {
    // Kind: every kind in the mix appears at least once.
    let kind: BoatKind;
    if (k < def.mix.length && def.n > 3) kind = def.mix[def.mix.length - 1 - k];
    else {
      const total = def.mix.reduce((a, m) => a + KIND_WEIGHT[m], 0);
      let roll = rng.next() * total;
      kind = def.mix[0];
      for (const m of def.mix) if ((roll -= KIND_WEIGHT[m]) < 0) {
        kind = m;
        break;
      }
    }
    // A point on the top or side edge, clear of rocks and on the route grid.
    // A point on the top or side edge, clear of rocks, on the route grid, and a fair start (see fairStart).
    const h = chart.harbour;
    let x = 6, y = 0.05, heading = Math.PI / 2;
    for (let tries = 0; tries < 400; tries++) {
      const side = rng.next();
      if (side < 0.6) [x, y] = [rng.range(0.6, 11.4), 0.05];
      else if (side < 0.8) [x, y] = [0.05, rng.range(0.6, 9.5)];
      else [x, y] = [11.95, rng.range(0.6, 9.5)];
      heading = toward(x, y, h.x, h.y) + (rng.range(-1, 1) * TUNING.HEADING_SPREAD * Math.PI) / 180;
      if (nearestRockGap(chart, x, y) > 1.4 && Number.isFinite(grid.distanceAt(x, y)) && fairStart(chart, kind, x, y, heading, def.currentStrength, def.n)) break;
    }
    const spec = TUNING.BOATS[kind];
    const stay = grid.distanceAt(x, y) / spec.speed + 3;
    // Staggered by at least 1.5 s, and never more than maxOnSea on the sea at once.
    if (k > 0) t += Math.max(TUNING.MIN_ARRIVAL_GAP, def.interval * rng.range(0.7, 1.3));
    for (;;) {
      const onSea = leaves.filter((l, i) => l > t && list[i].t <= t).length;
      if (onSea < def.maxOnSea) break;
      t = Math.min(...leaves.filter((l) => l > t)) + 0.1;
    }
    list.push({ t, kind, x, y, heading });
    leaves.push(t + stay);
  }
  return list;
}

/**
 * A boat must not be doomed before the starting beam can reach it: left dark,
 * it stays out of harm until it has been within reach for a few seconds.
 */
export function fairStart(chart: Chart, kind: BoatKind, x: number, y: number, heading: number, current: number, n: number): boolean {
  const spec = TUNING.BOATS[kind];
  const L = TUNING.LIGHTHOUSE;
  const reach = TUNING.BEAM_REACH[0] - 0.5;
  const dt = 0.1;
  let inReach = -1;
  for (let t = 0; t < 30; t += dt) {
    let vx = Math.cos(heading) * spec.speed;
    let vy = Math.sin(heading) * spec.speed;
    for (const c of chart.currents)
      if (current > 0 && n >= c.from && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        vx += c.dx * current * c.k * spec.drift;
        vy += c.dy * current * c.k * spec.drift;
      }
    x += vx * dt;
    y += vy * dt;
    if (inReach < 0 && Math.hypot(x - L.x, y - L.y) <= reach) inReach = t;
    const harmed = x < 0 || y < 0 || x > TUNING.SEA_W || y > TUNING.SEA_H || nearestRockGap(chart, x, y) < TUNING.WRECK_DISTANCE + 0.3;
    if (harmed) return inReach >= 0 && t - inReach >= TUNING.FAIR_WARNING;
    if (Math.hypot(x - chart.harbour.x, y - chart.harbour.y) <= chart.harbour.r) return true;
  }
  return true;
}

export function fogBanks(def: NightDef): FogBank[] {
  if (!def.fog) return [];
  const rng = new Rng(def.seed * 13 + def.n * 101 + 5);
  const count = def.fog === 1 ? 2 : 3;
  const chart = CHARTS[def.chart];
  const banks: FogBank[] = [];
  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = def.fog === 1 ? rng.range(1.5, 2.1) : rng.range(2, 2.7);
    let x = 6, y = 12;
    for (let tries = 0; tries < 200; tries++) {
      x = rng.range(1.5, 10.5);
      y = rng.range(1.5, 13.5);
      if (fogAllowed(chart, x, y, r)) break;
    }
    banks.push({ x, y, r, vx: Math.cos(a) * TUNING.FOG_DRIFT, vy: Math.sin(a) * TUNING.FOG_DRIFT });
  }
  return banks;
}

/**
 * Fog may not settle over a rock that the fogged beam cannot reach, or a boat
 * could be steered onto it with no way to light it in time. Fog banks bounce off these rocks.
 */
export function fogAllowed(chart: Chart, x: number, y: number, r: number): boolean {
  const L = TUNING.LIGHTHOUSE;
  const fogReach = TUNING.BEAM_REACH[0] * TUNING.FOG_REACH_SHARE;
  for (const rock of chart.rocks) {
    if (Math.hypot(rock.x - L.x, rock.y - L.y) <= fogReach - 1) continue;
    if (Math.hypot(rock.x - x, rock.y - y) < r + rock.r + TUNING.FOG_ROCK_ROOM) return false;
  }
  return true;
}

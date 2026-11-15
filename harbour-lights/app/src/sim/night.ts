import { TUNING, type BoatKind } from '../config/tuning';
import { CHARTS, nearestRockGap, type Chart, type Current } from '../charts/charts';
import { arrivals, fogAllowed, fogBanks, type Arrival, type FogBank, type NightDef } from '../nights/nights';
import { Beam, type Upgrades } from './beam';
import { routesFor, type RouteGrid } from './routes';

/**
 * One night (§6): fixed 1/60 s ticks, so a night always plays the same way for
 * the same inputs. No drawing code here.
 */
export type Outcome = 'sailing' | 'landed' | 'wrecked' | 'lost';

export interface Boat {
  id: number;
  kind: BoatKind;
  x: number;
  y: number;
  heading: number;
  /** Seconds of alertness left (> 0 means alert). */
  alert: number;
  lit: boolean;
  fogged: boolean;
  outcome: Outcome;
  closeCall: boolean;
  danger: boolean;
  /** Seconds since the outcome, for animations. */
  since: number;
  age: number;
}

export type SimEvent =
  | { type: 'warning'; x: number; y: number; kind: BoatKind }
  | { type: 'spawn' | 'lit' | 'landed' | 'wrecked' | 'lost' | 'close' | 'danger'; boat: Boat };

export interface NightResult {
  landed: number;
  strikes: number;
  stars: number;
  failed: boolean;
  catch: number;
  closeCalls: number;
  closeCallCoins: number;
  bonus: number;
  total: number;
  landedByKind: Record<BoatKind, number>;
}

const turnToward = (h: number, want: number, max: number): number => {
  let d = want - h;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return h + Math.max(-max, Math.min(max, d));
};

export class NightSim {
  readonly chart: Chart;
  readonly grid: RouteGrid;
  readonly beam: Beam;
  readonly schedule: Arrival[];
  readonly fog: FogBank[];
  readonly currents: (Current & { strength: number })[];
  boats: Boat[] = [];
  time = 0;
  ticks = 0;
  strikes = 0;
  closeCalls = 0;
  events: SimEvent[] = [];
  over = false;
  private next = 0;
  private warned = 0;

  constructor(
    readonly def: NightDef,
    upgrades: Upgrades,
  ) {
    this.chart = CHARTS[def.chart];
    this.grid = routesFor(this.chart);
    this.beam = new Beam(upgrades);
    this.schedule = arrivals(def);
    this.fog = fogBanks(def).map((f) => ({ ...f }));
    this.currents = this.chart.currents.filter((c) => def.currentStrength > 0 && def.n >= c.from).map((c) => ({ ...c, strength: def.currentStrength * c.k }));
  }

  get remaining(): number {
    return this.schedule.length - this.next + this.boats.filter((b) => b.outcome === 'sailing').length;
  }

  get landed(): number {
    return this.boats.filter((b) => b.outcome === 'landed').length;
  }

  /** Arrivals due within the warning time, for the edge lanterns. */
  get upcoming(): Arrival[] {
    return this.schedule.slice(this.next).filter((a) => a.t - this.time <= TUNING.ARRIVAL_WARNING);
  }

  inFog(x: number, y: number): boolean {
    return this.fog.some((f) => Math.hypot(x - f.x, y - f.y) < f.r);
  }

  /** The current under a point, as a velocity (tiles per second). */
  currentAt(x: number, y: number): { x: number; y: number } {
    let vx = 0;
    let vy = 0;
    for (const c of this.currents)
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        vx += c.dx * c.strength;
        vy += c.dy * c.strength;
      }
    return { x: vx, y: vy };
  }

  /** Moves a dark boat one step: last heading, own speed, plus the current × drift. */
  darkStep(kind: BoatKind, x: number, y: number, heading: number, dt: number): { x: number; y: number } {
    const spec = TUNING.BOATS[kind];
    const c = this.currentAt(x, y);
    return { x: x + (Math.cos(heading) * spec.speed + c.x * spec.drift) * dt, y: y + (Math.sin(heading) * spec.speed + c.y * spec.drift) * dt };
  }

  offChart(x: number, y: number): boolean {
    return x < 0 || y < 0 || x > TUNING.SEA_W || y > TUNING.SEA_H;
  }

  /**
   * Seconds until a boat comes to harm if left dark from now (Infinity if it
   * lands or stays safe for `horizon` seconds). Used for the danger marker and the keeper.
   */
  harmIn(b: Boat, horizon: number, dt = 0.1): number {
    let { x, y } = b;
    const h = this.chart.harbour;
    for (let t = dt; t <= horizon + 1e-9; t += dt) {
      ({ x, y } = this.darkStep(b.kind, x, y, b.heading, dt));
      if (Math.hypot(x - h.x, y - h.y) <= h.r) return Infinity;
      if (this.offChart(x, y) || nearestRockGap(this.chart, x, y) < TUNING.WRECK_DISTANCE) return t;
    }
    return Infinity;
  }

  step(): void {
    if (this.over) return;
    const dt = TUNING.TICK;
    this.events.length = 0;
    this.time += dt;
    this.ticks++;
    this.beam.step(dt);

    for (const f of this.fog) {
      const nx = f.x + f.vx * dt;
      const ny = f.y + f.vy * dt;
      if (nx < 1 || nx > TUNING.SEA_W - 1 || !fogAllowed(this.chart, nx, f.y, f.r)) f.vx = -f.vx;
      else f.x = nx;
      if (ny < 1 || ny > TUNING.SEA_H - 2 || !fogAllowed(this.chart, f.x, ny, f.r)) f.vy = -f.vy;
      else f.y = ny;
    }

    while (this.warned < this.schedule.length && this.schedule[this.warned].t - this.time <= TUNING.ARRIVAL_WARNING) {
      const a = this.schedule[this.warned++];
      this.events.push({ type: 'warning', x: a.x, y: a.y, kind: a.kind });
    }
    while (this.next < this.schedule.length && this.schedule[this.next].t <= this.time) {
      const a = this.schedule[this.next++];
      const b: Boat = { id: this.next, kind: a.kind, x: a.x, y: a.y, heading: a.heading, alert: 0, lit: false, fogged: false, outcome: 'sailing', closeCall: false, danger: false, since: 0, age: 0 };
      this.boats.push(b);
      this.events.push({ type: 'spawn', boat: b });
    }

    const h = this.chart.harbour;
    const checkDanger = this.ticks % 6 === 0;
    for (const b of this.boats) {
      if (b.outcome !== 'sailing') {
        b.since += dt;
        continue;
      }
      b.age += dt;
      const spec = TUNING.BOATS[b.kind];
      b.fogged = this.inFog(b.x, b.y);
      const wasLit = b.lit;
      b.lit = this.beam.lights(b.x, b.y, b.fogged);
      if (b.lit) {
        b.alert = TUNING.ALERT_SECONDS;
        if (!wasLit) this.events.push({ type: 'lit', boat: b });
      } else b.alert = Math.max(0, b.alert - dt);

      if (b.alert > 0) {
        const tgt = this.grid.target(b.x, b.y);
        const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
        b.heading = turnToward(b.heading, want, ((spec.turn * Math.PI) / 180) * dt);
        b.x += Math.cos(b.heading) * spec.speed * dt;
        b.y += Math.sin(b.heading) * spec.speed * dt;
      } else {
        const p = this.darkStep(b.kind, b.x, b.y, b.heading, dt);
        b.x = p.x;
        b.y = p.y;
      }

      const gap = nearestRockGap(this.chart, b.x, b.y);
      if (Math.hypot(b.x - h.x, b.y - h.y) <= h.r) this.finish(b, 'landed');
      else if (gap < TUNING.WRECK_DISTANCE) this.finish(b, 'wrecked');
      else if (this.offChart(b.x, b.y)) this.finish(b, 'lost');
      else {
        if (b.alert > 0 && !b.closeCall && gap < TUNING.CLOSE_CALL_DISTANCE) {
          b.closeCall = true;
          this.closeCalls++;
          this.events.push({ type: 'close', boat: b });
        }
        if (checkDanger) {
          const was = b.danger;
          b.danger = b.alert <= 0 && this.harmIn(b, TUNING.DANGER_SECONDS) < Infinity;
          if (b.danger && !was) this.events.push({ type: 'danger', boat: b });
        }
      }
    }

    const done = this.next >= this.schedule.length && this.boats.every((b) => b.outcome !== 'sailing');
    if (done || this.strikes >= TUNING.STRIKES) this.over = true;
  }

  private finish(b: Boat, o: Outcome): void {
    b.outcome = o;
    b.danger = false;
    b.since = 0;
    if (o !== 'landed') this.strikes++;
    this.events.push({ type: o as 'landed', boat: b });
  }

  result(): NightResult {
    const landedByKind: Record<BoatKind, number> = { fishing: 0, dinghy: 0, trawler: 0 };
    let catchRaw = 0;
    for (const b of this.boats)
      if (b.outcome === 'landed') {
        landedByKind[b.kind]++;
        catchRaw += TUNING.BOATS[b.kind].catch;
      }
    const scale = 1 + TUNING.CATCH_PER_NIGHT * Math.max(0, this.def.n - 1);
    const fish = Math.round(catchRaw * scale);
    const failed = this.strikes >= TUNING.STRIKES;
    const stars = failed ? 0 : 3 - this.strikes;
    const closeCallCoins = this.closeCalls * TUNING.CLOSE_CALL_COINS;
    const bonus = stars === 3 ? Math.round(fish * TUNING.CLEAN_BONUS) : 0;
    return { landed: this.landed, strikes: this.strikes, stars, failed, catch: fish, closeCalls: this.closeCalls, closeCallCoins, bonus, total: fish + closeCallCoins + bonus, landedByKind };
  }
}

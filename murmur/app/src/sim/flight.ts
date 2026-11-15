import { SPECIES, TUNING, type Species, type SpeciesId } from '../config/tuning';
import { WIRE_HALF, cloudX, wireSpans, type Chunk, type CloudDef, type RectDef } from '../world/chunk';
import { Rng, Spawner } from '../world/spawner';

/**
 * Flight simulation (§6). The flock is a ribbon that follows its leader's
 * path (A1). World coordinates in tiles; y grows up the sky; the camera's
 * bottom edge is `camY` and the visible sky is 12 × 20 tiles above it.
 * No drawing code.
 */

const DT = 1 / TUNING.TICK_HZ;

export interface Point {
  x: number;
  y: number;
}

interface TrailPoint extends Point {
  s: number;
}

export interface Cloud extends CloudDef {
  id: number;
  baseY: number;
  nearMissed: boolean;
}
export interface Wire {
  id: number;
  y: number;
  spans: [number, number][];
  nearMissed: boolean;
}
export interface Pylon extends RectDef {
  id: number;
  nearMissed: boolean;
}
export interface Stray extends Point {
  id: number;
}
export interface Thermal extends RectDef {
  id: number;
}
export interface Tree extends Point {
  id: number;
  banked: boolean;
  sum: number;
  last: number | null;
}
export interface Hawk {
  id: number;
  spot: Point;
  /** Ticks until it lands, and the warning length (for the darkening shadow). */
  left: number;
  total: number;
}

export type FlightEvent =
  | { type: 'gathered'; at: Point; count: number }
  | { type: 'lost'; at: Point; count: number; cause: 'cloud' | 'wire' | 'pylon' | 'hawk' }
  | { type: 'hawkWarn'; spot: Point }
  | { type: 'hawkLand'; spot: Point; taken: number }
  | { type: 'banked'; amount: number; tree: Point }
  | { type: 'murmuration'; birds: number }
  | { type: 'nearMiss' }
  | { type: 'over'; cause: 'flock' | 'hawk' };

export interface RunStats {
  seconds: number;
  gathered: number;
  hawksPassed: number;
  murmurations: number;
  maxFlock: number;
  banks: number;
}

export interface FlightOptions {
  species: SpeciesId;
  seed: number;
  chunks: Chunk[];
  /** Runs played before this one (the first hawk is slower in the first three runs). */
  runsPlayed: number;
  /** First launch: scripted opening, first tree at 12 s and first hawk at 20 s. */
  firstLaunch?: boolean;
  scripted?: Chunk[];
  /** Tests and the autopilot can switch hawks off. */
  hawks?: boolean;
  startBirds?: number;
}

export class Flight {
  readonly species: Species;
  t = 0;
  ticks = 0;
  camY = 0;
  scroll: number = TUNING.SCROLL_START;
  leader: Point;
  trail: TrailPoint[] = [];
  /** Personal sideways values in [−1, 1]; index 0 is the leader. */
  personal: number[] = [];
  /** Bird positions this tick (index 0 = leader). */
  birds: Point[] = [];
  /** Recent leader velocity in world tiles/s. */
  vel: Point = { x: 0, y: 0 };

  clouds: Cloud[] = [];
  wires: Wire[] = [];
  pylons: Pylon[] = [];
  strays: Stray[] = [];
  thermals: Thermal[] = [];
  trees: Tree[] = [];
  hawks: Hawk[] = [];

  banked = 0;
  unbanked = 0;
  over = false;
  overCause: 'flock' | 'hawk' | null = null;
  revived = false;
  inThermal = false;
  murmurUntil = -1;
  murmurReadyAt = 0;
  stats: RunStats = { seconds: 0, gathered: 0, hawksPassed: 0, murmurations: 0, maxFlock: 0, banks: 0 };
  events: FlightEvent[] = [];
  /** Chunks placed so far, with their bottom edge in world y (for the lane-following pilot). */
  placed: { chunk: Chunk; base: number }[] = [];

  private rng: Rng;
  private spawner: Spawner;
  private builtTo = 0;
  private nextId = 1;
  private nextHawkAt: number;
  private hawksSent = 0;
  private hawksOn: boolean;
  private slowFirstHawk: boolean;

  constructor(opts: FlightOptions) {
    this.species = SPECIES[opts.species];
    this.rng = new Rng(opts.seed);
    this.spawner = new Spawner(opts.chunks, this.rng);
    if (opts.scripted) this.spawner.queue = [...opts.scripted];
    this.hawksOn = opts.hawks ?? true;
    this.slowFirstHawk = opts.runsPlayed < TUNING.HAWK_SLOW_RUNS;
    this.nextHawkAt = opts.firstLaunch ? TUNING.FIRST_HAWK_S : TUNING.HAWK_INTERVAL_START;
    this.leader = { x: TUNING.SKY_W / 2, y: 4 };
    this.resetFlock(opts.startBirds ?? TUNING.START_BIRDS, this.leader);
    // The first chunk starts above the flock so the opening is calm.
    this.builtTo = 6;
    this.build();
  }

  get n(): number {
    return this.personal.length;
  }

  get spread(): number {
    return Math.min(TUNING.SPREAD_BASE + TUNING.SPREAD_PER_BIRD * this.n, this.species.spreadMax);
  }

  get murmuring(): boolean {
    return this.t < this.murmurUntil;
  }

  get score(): number {
    return Math.floor(this.banked);
  }

  get feathers(): number {
    return Math.floor(this.banked * TUNING.FEATHERS_PER_POINT);
  }

  private resetFlock(count: number, at: Point): void {
    this.personal = [];
    for (let i = 0; i < count; i++) this.personal.push(i === 0 ? 0 : this.rng.next() * 2 - 1);
    // A short straight trail below the leader, so the flock starts as a line.
    this.trail = [];
    const len = count * this.species.spacing + 1;
    for (let k = 20; k >= 0; k--) this.trail.push({ x: at.x, y: at.y - (len * k) / 20, s: len - (len * k) / 20 });
    this.leader = { ...at };
    this.placeBirds();
  }

  // ── Building the sky from chunks ──────────────────────────

  private build(): void {
    while (this.builtTo < this.camY + TUNING.SKY_H * 2) {
      const chunk = this.spawner.next(this.t + (this.builtTo - this.camY) / Math.max(1, this.scroll));
      this.place(chunk, this.builtTo);
      this.builtTo += TUNING.SKY_H;
    }
    // Forget what has scrolled away (keep the flock's tail region).
    const tailY = this.trail.length ? this.trail[0].y : this.camY;
    const cut = Math.min(this.camY, tailY) - 4;
    this.clouds = this.clouds.filter((c) => c.baseY + c.y + c.r > cut);
    this.wires = this.wires.filter((w) => w.y > cut);
    this.pylons = this.pylons.filter((p) => p.y + p.h > cut);
    this.strays = this.strays.filter((s) => s.y > cut);
    this.thermals = this.thermals.filter((h) => h.y + h.h > cut);
    this.trees = this.trees.filter((h) => h.y + TUNING.TREE_RADIUS > cut);
  }

  /** Places a chunk with its bottom edge at world y = base. */
  place(c: Chunk, base: number): void {
    this.placed.push({ chunk: c, base });
    if (this.placed.length > 8) this.placed.shift();
    for (const cl of c.clouds) this.clouds.push({ ...cl, y: cl.y, baseY: base, id: this.nextId++, nearMissed: false });
    for (const w of c.wires) this.wires.push({ id: this.nextId++, y: base + w.y, spans: wireSpans(w), nearMissed: false });
    for (const p of c.pylons) this.pylons.push({ ...p, y: base + p.y, id: this.nextId++, nearMissed: false });
    for (const s of c.strays) this.strays.push({ x: s.x, y: base + s.y, id: this.nextId++ });
    for (const h of c.thermals) this.thermals.push({ ...h, y: base + h.y, id: this.nextId++ });
    if (c.tree) this.trees.push({ x: c.tree.x, y: base + c.tree.y, id: this.nextId++, banked: false, sum: 0, last: null });
  }

  cloudPos(c: Cloud): Point {
    return { x: cloudX(c, this.t), y: c.baseY + c.y };
  }

  // ── The flock along the trail (§6.3) ──────────────────────

  private headS(): number {
    return this.trail[this.trail.length - 1].s;
  }

  /** Position and tangent on the trail at arc length s. */
  private along(s: number): { p: Point; tx: number; ty: number } {
    const tr = this.trail;
    if (s <= tr[0].s) {
      const a = tr[0];
      const b = tr[Math.min(1, tr.length - 1)];
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const tx = (b.x - a.x) / d || 0;
      const ty = (b.y - a.y) / d || 1;
      return { p: { x: a.x - tx * (tr[0].s - s), y: a.y - ty * (tr[0].s - s) }, tx, ty };
    }
    let lo = 0;
    let hi = tr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tr[mid].s <= s) lo = mid;
      else hi = mid;
    }
    const a = tr[lo];
    const b = tr[hi];
    const seg = b.s - a.s || 1;
    const k = (s - a.s) / seg;
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, tx: (b.x - a.x) / d, ty: (b.y - a.y) / d };
  }

  /** Where bird i sits: i × SPACING behind the leader along the trail, shifted sideways. */
  birdAt(i: number): Point {
    if (i === 0) return { ...this.leader };
    const back = i * this.species.spacing;
    const { p, tx, ty } = this.along(this.headS() - back);
    let off: number;
    if (this.species.vShape) {
      const side = i % 2 === 0 ? 1 : -1;
      off = side * Math.min(this.species.spreadMax, back * TUNING.V_SLOPE);
    } else off = this.personal[i] * this.spread;
    // Perpendicular to the direction of travel.
    return { x: p.x - ty * off, y: p.y + tx * off };
  }

  private placeBirds(): void {
    this.birds = this.personal.map((_, i) => this.birdAt(i));
  }

  // ── One tick (§6.2) ───────────────────────────────────────

  /**
   * Advances one tick. `target` is where the leader is heading, in world
   * coordinates, or null to hold its position on screen.
   */
  step(target: Point | null): void {
    if (this.over) return;
    this.events = [];
    this.t += DT;
    this.ticks++;

    // Scroll: 3 → 6 tiles/s over two minutes; thermals raise it by half.
    this.inThermal = this.thermals.some((h) => this.leader.x >= h.x && this.leader.x <= h.x + h.w && this.leader.y >= h.y && this.leader.y <= h.y + h.h);
    const base = TUNING.SCROLL_START + (TUNING.SCROLL_END - TUNING.SCROLL_START) * Math.min(1, this.t / TUNING.SCROLL_RAMP_S);
    this.scroll = base * (this.inThermal ? TUNING.THERMAL_FACTOR : 1);
    const before = { ...this.leader };
    const screenY = this.leader.y - this.camY;
    const goal = target ? { x: target.x, y: target.y - this.camY } : { x: this.leader.x, y: screenY };
    this.camY += this.scroll * DT;

    // The leader moves on screen towards the target, limited to LEADER_SPEED; the
    // scroll carries it up the sky. With no target it holds its place on screen.
    let mx = goal.x - this.leader.x;
    let my = goal.y - screenY;
    const dist = Math.hypot(mx, my);
    const maxStep = this.species.leaderSpeed * DT;
    if (dist > maxStep) {
      mx *= maxStep / dist;
      my *= maxStep / dist;
    }
    this.leader.x = Math.max(0.3, Math.min(TUNING.SKY_W - 0.3, this.leader.x + mx));
    this.leader.y = this.camY + Math.max(0.6, Math.min(TUNING.SKY_H - 0.6, screenY + my));
    this.vel = { x: this.vel.x * 0.85 + ((this.leader.x - before.x) / DT) * 0.15, y: this.vel.y * 0.85 + ((this.leader.y - before.y) / DT) * 0.15 };

    // Trail.
    const head = this.trail[this.trail.length - 1];
    const stepLen = Math.hypot(this.leader.x - head.x, this.leader.y - head.y);
    if (stepLen > 0.02) {
      this.trail.push({ x: this.leader.x, y: this.leader.y, s: head.s + stepLen });
      this.checkMurmuration();
    }
    const keep = this.headS() - Math.max(this.n * this.species.spacing + 2, TUNING.MURMUR_WINDOW + 1);
    while (this.trail.length > 3 && this.trail[1].s < keep) this.trail.shift();

    this.build();
    this.placeBirds();
    this.collide();
    if (this.over) return;
    this.gather();
    this.hawkTick();
    if (this.over) return;
    this.trees.forEach((tr) => this.treeTick(tr));

    // Score accumulates unbanked (§6.9).
    this.unbanked += this.n * this.species.pointsPerBird * DT * (this.inThermal ? TUNING.THERMAL_FACTOR : 1);
    this.stats.seconds = this.t;
    this.stats.maxFlock = Math.max(this.stats.maxFlock, this.n);
  }

  // ── Hazards (§6.5) ────────────────────────────────────────

  private collide(): void {
    const r = TUNING.BIRD_RADIUS;
    const lost = new Set<number>();
    const causes = new Map<number, 'cloud' | 'wire' | 'pylon'>();
    const yMin = Math.min(...this.birds.map((b) => b.y)) - 3;
    const yMax = Math.max(...this.birds.map((b) => b.y)) + 3;
    const near = TUNING.NEAR_MISS;
    for (const c of this.clouds) {
      const p = this.cloudPos(c);
      if (p.y + c.r < yMin || p.y - c.r > yMax) continue;
      let touched = false;
      let close = false;
      this.birds.forEach((b, i) => {
        const d = Math.hypot(b.x - p.x, b.y - p.y) - c.r;
        if (d < r) {
          lost.add(i);
          causes.set(i, 'cloud');
          touched = true;
        } else if (d < r + near) close = true;
      });
      this.nearMiss(c, touched, close);
    }
    for (const w of this.wires) {
      if (w.y < yMin || w.y > yMax) continue;
      let touched = false;
      let close = false;
      this.birds.forEach((b, i) => {
        const dy = Math.abs(b.y - w.y) - WIRE_HALF;
        if (dy > r + near) return;
        for (const [a, e] of w.spans) {
          const dx = Math.max(a - b.x, 0, b.x - e);
          const d = Math.hypot(dx, Math.max(0, dy));
          if (d < r) {
            lost.add(i);
            causes.set(i, 'wire');
            touched = true;
          } else if (d < r + near) close = true;
        }
      });
      this.nearMiss(w, touched, close);
    }
    for (const pl of this.pylons) {
      if (pl.y + pl.h < yMin || pl.y > yMax) continue;
      let touched = false;
      let close = false;
      this.birds.forEach((b, i) => {
        const dx = Math.max(pl.x - b.x, 0, b.x - (pl.x + pl.w));
        const dy = Math.max(pl.y - b.y, 0, b.y - (pl.y + pl.h));
        const d = Math.hypot(dx, dy);
        if (d < r) {
          lost.add(i);
          causes.set(i, 'pylon');
          touched = true;
        } else if (d < r + near) close = true;
      });
      this.nearMiss(pl, touched, close);
    }
    if (lost.size) this.loseBirds([...lost], causes.get([...lost][0]) ?? 'cloud');
  }

  /** +2 when a hazard passes within 0.4 tiles of a bird without touching, at most once per hazard. */
  private nearMiss(h: { nearMissed: boolean }, touched: boolean, close: boolean): void {
    if (touched) h.nearMissed = true;
    else if (close && !h.nearMissed) {
      h.nearMissed = true;
      this.unbanked += TUNING.NEAR_MISS_POINTS;
      this.events.push({ type: 'nearMiss' });
    }
  }

  /** Lost birds are removed and those behind close up; if the leader is lost, the next bird leads. */
  loseBirds(indices: number[], cause: 'cloud' | 'wire' | 'pylon' | 'hawk'): void {
    const sorted = [...new Set(indices)].sort((a, b) => b - a);
    const at = this.birds[sorted[sorted.length - 1]] ?? this.leader;
    const leaderLost = sorted.includes(0);
    for (const i of sorted) this.personal.splice(i, 1);
    this.events.push({ type: 'lost', at: { ...at }, count: sorted.length, cause });
    if (!this.personal.length) {
      this.end('flock');
      return;
    }
    if (leaderLost) {
      // The first surviving bird takes over: cut the trail back to it.
      const firstSurvivor = Math.min(...this.birds.map((_, i) => i).filter((i) => !sorted.includes(i)));
      const newHeadS = this.headS() - firstSurvivor * this.species.spacing;
      const { p } = this.along(newHeadS);
      while (this.trail.length > 2 && this.trail[this.trail.length - 1].s > newHeadS) this.trail.pop();
      this.trail.push({ x: p.x, y: p.y, s: newHeadS });
      this.leader = { x: Math.max(0.3, Math.min(TUNING.SKY_W - 0.3, p.x)), y: Math.max(this.camY + 0.6, p.y) };
      this.personal[0] = 0;
    }
    this.placeBirds();
  }

  private end(cause: 'flock' | 'hawk'): void {
    this.over = true;
    this.overCause = cause;
    this.events.push({ type: 'over', cause });
  }

  // ── Gathering (§6.4) ──────────────────────────────────────

  private gather(): void {
    const reach = TUNING.GATHER_DIST * (this.murmuring ? TUNING.MURMUR_GATHER_FACTOR : 1);
    const yMin = Math.min(...this.birds.map((b) => b.y)) - reach;
    const yMax = Math.max(...this.birds.map((b) => b.y)) + reach;
    const joined: Stray[] = [];
    for (const s of this.strays) {
      if (s.y < yMin || s.y > yMax) continue;
      if (this.n + joined.length >= TUNING.MAX_BIRDS) break;
      if (this.birds.some((b) => Math.abs(b.x - s.x) < reach && Math.abs(b.y - s.y) < reach && Math.hypot(b.x - s.x, b.y - s.y) < reach)) joined.push(s);
    }
    if (!joined.length) return;
    this.strays = this.strays.filter((s) => !joined.includes(s));
    for (const s of joined) {
      this.personal.push(this.rng.next() * 2 - 1);
      this.events.push({ type: 'gathered', at: { x: s.x, y: s.y }, count: 1 });
    }
    this.stats.gathered += joined.length;
    this.placeBirds();
  }

  // ── Hawks (§6.5) ──────────────────────────────────────────

  private hawkTick(): void {
    if (this.hawksOn && this.t >= this.nextHawkAt) {
      const slow = this.slowFirstHawk && this.hawksSent === 0;
      const ahead = TUNING.HAWK_WARNING_S;
      const spot = {
        x: Math.max(0.5, Math.min(TUNING.SKY_W - 0.5, this.leader.x + this.vel.x * ahead)),
        y: this.leader.y + this.vel.y * ahead,
      };
      const total = Math.round((slow ? TUNING.HAWK_FIRST_SLOW_S : TUNING.HAWK_WARNING_S) * TUNING.TICK_HZ);
      this.hawks.push({ id: this.nextId++, spot, left: total, total });
      this.hawksSent++;
      this.events.push({ type: 'hawkWarn', spot: { ...spot } });
      const k = Math.min(1, this.t / TUNING.HAWK_INTERVAL_RAMP_S);
      this.nextHawkAt = this.t + TUNING.HAWK_INTERVAL_START - (TUNING.HAWK_INTERVAL_START - TUNING.HAWK_INTERVAL_END) * k;
    }
    for (const h of this.hawks) {
      h.left--;
      if (h.left > 0) continue;
      const taken: number[] = [];
      this.birds.forEach((b, i) => {
        if (Math.hypot(b.x - h.spot.x, b.y - h.spot.y) < TUNING.HAWK_RADIUS) taken.push(i);
      });
      this.events.push({ type: 'hawkLand', spot: { ...h.spot }, taken: taken.length });
      if (taken.includes(0)) {
        // The leader is taken: the run ends.
        this.personal.splice(0, this.personal.length);
        this.end('hawk');
        return;
      }
      this.stats.hawksPassed++;
      if (taken.length) this.loseBirds(taken, 'hawk');
      if (this.over) return;
    }
    this.hawks = this.hawks.filter((h) => h.left > 0);
  }

  // ── Roost trees and banking (§6.6) ────────────────────────

  private treeTick(tr: Tree): void {
    if (tr.banked) return;
    const dx = this.leader.x - tr.x;
    const dy = this.leader.y - tr.y;
    if (Math.hypot(dx, dy) > TUNING.TREE_RADIUS) {
      tr.sum = 0;
      tr.last = null;
      return;
    }
    const a = Math.atan2(dy, dx);
    if (tr.last !== null) {
      let d = a - tr.last;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      tr.sum += d;
    }
    tr.last = a;
    if (Math.abs(tr.sum) >= 2 * Math.PI) {
      tr.banked = true;
      const amount = this.unbanked;
      this.banked += this.unbanked;
      this.unbanked = 0;
      this.stats.banks++;
      this.events.push({ type: 'banked', amount, tree: { x: tr.x, y: tr.y } });
    }
  }

  /** Inside any tree's banking circle (circling a tree does not count as a murmuration). */
  private nearTree(): boolean {
    return this.trees.some((tr) => Math.hypot(this.leader.x - tr.x, this.leader.y - tr.y) <= TUNING.TREE_RADIUS);
  }

  // ── Murmurations (§6.7) ───────────────────────────────────

  private checkMurmuration(): void {
    if (this.t < this.murmurReadyAt || this.nearTree()) return;
    const tr = this.trail;
    const n = tr.length;
    if (n < 5) return;
    const a = tr[n - 2];
    const b = tr[n - 1];
    const minS = b.s - TUNING.MURMUR_WINDOW;
    for (let i = n - 4; i > 0 && tr[i].s >= minS; i--) {
      if (segmentsCross(a, b, tr[i - 1], tr[i])) {
        this.murmurUntil = this.t + TUNING.MURMUR_DURATION_S;
        this.murmurReadyAt = this.t + TUNING.MURMUR_COOLDOWN_S;
        this.unbanked += TUNING.MURMUR_POINTS_PER_BIRD * this.n;
        this.stats.murmurations++;
        this.events.push({ type: 'murmuration', birds: this.n });
        return;
      }
    }
  }

  // ── Revive (§6.10) ────────────────────────────────────────

  /** Restarts with 10 birds just above the point of failure; hazards on screen are cleared; unbanked kept. */
  revive(): void {
    if (!this.over || this.revived) return;
    this.revived = true;
    this.over = false;
    this.overCause = null;
    const at = { x: Math.max(1, Math.min(TUNING.SKY_W - 1, this.leader.x)), y: Math.max(this.camY + 3, Math.min(this.camY + TUNING.SKY_H - 4, this.leader.y + 1)) };
    const top = this.camY + TUNING.SKY_H;
    const onScreen = (y: number) => y >= this.camY - 2 && y <= top + 1;
    this.clouds = this.clouds.filter((c) => !onScreen(c.baseY + c.y));
    this.wires = this.wires.filter((w) => !onScreen(w.y));
    this.pylons = this.pylons.filter((p) => !onScreen(p.y));
    this.hawks = [];
    this.nextHawkAt = this.t + TUNING.HAWK_INTERVAL_START / 2;
    this.resetFlock(TUNING.REVIVE_BIRDS, at);
  }
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(a, b, c);
  const d2 = o(a, b, d);
  const d3 = o(c, d, a);
  const d4 = o(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

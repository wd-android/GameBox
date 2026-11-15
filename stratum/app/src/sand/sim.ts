import { TUNING } from '../config/tuning';
import { Rng } from './rng';
import type { JarMask } from './grid';

/**
 * Grain-by-grain sand simulation (§6). Integer-only and driven by a single
 * seeded generator, so the same jar + the same inputs always produce the same
 * grid on every device (§6.6). Contains no drawing code.
 *
 * Coordinates: x grows to the right, y grows downwards (row 0 is the top).
 * Tilt: positive degrees lower the RIGHT side of the jar.
 */

export const enum Ev {
  PourOn = 0,
  PourOff = 1,
  Column = 2,
  Colour = 3,
  Tilt = 4,
  Undo = 5,
}

/** One recorded input: [tick, event, value]. */
export type InputEvent = [number, Ev, number];

interface Snapshot {
  cells: Uint8Array;
  remaining: Int32Array | null;
  rng: number;
}

export type TiltClass = 0 | 1 | 2;

export function tiltClass(tiltDeg: number): TiltClass {
  const a = Math.abs(tiltDeg);
  if (a < TUNING.TILT_SLIGHT_DEG) return 0;
  if (a < TUNING.TILT_STEEP_DEG) return 1;
  return 2;
}

export class SandSim {
  readonly mask: JarMask;
  readonly w: number;
  readonly h: number;
  cells: Uint8Array;
  tick = 0;
  rng: Rng;

  // Inputs
  pouring = false;
  column: number;
  colour = 1;
  tilt = 0;

  /** Remaining grains per colour (index 1..8), or null for unlimited. */
  remaining: Int32Array | null;
  /** Grains of each colour poured so far (for setting limits in the editor). */
  used = new Int32Array(9);

  /** True when the last pour attempt was stopped by the fill line. */
  reachedFillLine = false;
  /** True when the chosen colour has run out. */
  ranOut = false;
  /** Grains added during the latest tick. */
  addedThisTick = 0;
  /** Grains moved during the latest tick (for the "sliding" cue). */
  movedThisTick = 0;
  lastChangeTick = 0;
  /** Increases whenever any cell changes (for redrawing). */
  version = 0;

  readonly recording: InputEvent[] = [];
  private undoStack: Snapshot[] = [];
  private quiet: Uint16Array;
  private stamp: Uint32Array;
  private stampId = 1;

  constructor(mask: JarMask, seed: number, limits: Record<number, number> | null = null) {
    this.mask = mask;
    this.w = mask.w;
    this.h = mask.h;
    this.cells = new Uint8Array(mask.w * mask.h);
    this.quiet = new Uint16Array(mask.h);
    this.stamp = new Uint32Array(mask.w * mask.h);
    this.rng = new Rng(seed);
    this.column = Math.floor((mask.openLeft + mask.openRight) / 2);
    if (limits) {
      this.remaining = new Int32Array(9);
      for (let c = 1; c <= 8; c++) this.remaining[c] = limits[c] ?? 0;
    } else {
      this.remaining = null;
    }
  }

  /** Restores a jar in progress (saved when the app was closed). */
  restore(cells: Uint8Array, remaining: number[] | null, tick: number, rngState: number): void {
    this.cells.set(cells);
    if (remaining) this.remaining = Int32Array.from(remaining);
    this.tick = tick;
    this.rng.state = rngState;
    this.recountUsed();
    this.wakeAll();
  }

  // ── Inputs (all recorded) ─────────────────────────────────

  setPouring(on: boolean): void {
    if (on === this.pouring) return;
    this.pouring = on;
    this.record(on ? Ev.PourOn : Ev.PourOff, 0);
    if (on) {
      this.undoStack.push({
        cells: this.cells.slice(),
        remaining: this.remaining ? this.remaining.slice() : null,
        rng: this.rng.state,
      });
    }
  }

  setColumn(col: number): void {
    const c = Math.max(this.mask.openLeft, Math.min(this.mask.openRight, Math.round(col)));
    if (c === this.column) return;
    this.column = c;
    this.record(Ev.Column, c);
  }

  setColour(colour: number): void {
    if (colour === this.colour) return;
    this.colour = colour;
    this.ranOut = false;
    this.record(Ev.Colour, colour);
  }

  setTilt(deg: number): void {
    const t = Math.max(-TUNING.TILT_MAX_DEG, Math.min(TUNING.TILT_MAX_DEG, Math.round(deg)));
    if (t === this.tilt) return;
    const before = tiltClass(this.tilt) * Math.sign(this.tilt);
    this.tilt = t;
    this.record(Ev.Tilt, t);
    if (tiltClass(t) * Math.sign(t) !== before) this.wakeAll();
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  /** Removes the most recent pour (§6.8). Returns false if there is nothing to undo. */
  undo(): boolean {
    const snap = this.undoStack.pop();
    if (!snap) return false;
    if (this.pouring) this.pouring = false;
    this.record(Ev.Undo, 0);
    this.cells.set(snap.cells);
    this.remaining = snap.remaining ? snap.remaining.slice() : null;
    this.rng.state = snap.rng;
    this.recountUsed();
    this.reachedFillLine = false;
    this.ranOut = false;
    this.wakeAll();
    return true;
  }

  private recountUsed(): void {
    this.used.fill(0);
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i]) this.used[this.cells[i]]++;
  }

  private record(ev: Ev, value: number): void {
    this.recording.push([this.tick, ev, value]);
  }

  /** Applies a recorded event without re-recording semantics differing from live play. */
  apply(ev: Ev, value: number): void {
    switch (ev) {
      case Ev.PourOn:
        this.setPouring(true);
        break;
      case Ev.PourOff:
        this.setPouring(false);
        break;
      case Ev.Column:
        this.setColumn(value);
        break;
      case Ev.Colour:
        this.setColour(value);
        break;
      case Ev.Tilt:
        this.setTilt(value);
        break;
      case Ev.Undo:
        this.undo();
        break;
    }
  }

  wakeAll(): void {
    this.version++;
    this.quiet.fill(0);
    this.lastChangeTick = this.tick;
  }

  /** True when nothing has moved for a couple of ticks and nothing is being poured. */
  get settled(): boolean {
    return !this.pouring && this.tick - this.lastChangeTick > 2;
  }

  /** Nothing more can be poured: sand reaches the fill line across the whole opening. */
  get openingFull(): boolean {
    const { w, fillRow, openLeft, openRight } = this.mask;
    for (let x = openLeft; x <= openRight; x++) if (!this.cells[fillRow * w + x]) return false;
    return true;
  }

  /** Grains inside the jar at or below the fill line. */
  filledBelowLine(): number {
    const { w, h, fillRow } = this.mask;
    let n = 0;
    for (let i = fillRow * w; i < w * h; i++) if (this.cells[i]) n++;
    return n;
  }

  // ── Simulation ────────────────────────────────────────────

  step(): void {
    this.addedThisTick = 0;
    this.movedThisTick = 0;
    for (let y = 0; y < this.h; y++) if (this.quiet[y] < 65535) this.quiet[y]++;
    this.stampId = (this.stampId + 1) >>> 0 || 1;

    if (this.pouring) this.pour();
    this.fall();
    this.tick++;
  }

  private pour(): void {
    const { w, inside, topRow, fillRow } = this.mask;
    const col = this.column;
    // Stops by itself when sand reaches the fill line at the spout's column
    // (§6.4) – resting sand, not grains of the stream falling past it.
    const fi = fillRow * w + col;
    if (this.cells[fi] && this.stampId - this.stamp[fi] > 2) {
      this.reachedFillLine = true;
      return;
    }
    this.reachedFillLine = false;
    const c = this.colour;
    if (this.remaining && this.remaining[c] <= 0) {
      this.ranOut = true;
      return;
    }
    // New grains fill the stream's head – the cells just vacated by the
    // grains of the previous tick, which fall two cells per tick. The slots
    // are visited from a random starting point, so the scatter is random but
    // an even sweep still lays an even layer.
    const s = TUNING.POUR_SCATTER;
    const span = 2 * s + 1;
    const slots = span * TUNING.POUR_DROP_ROWS;
    const start = this.rng.int(slots);
    for (let k = 0; k < TUNING.POUR_RATE; k++) {
      if (this.remaining && this.remaining[c] <= 0) {
        this.ranOut = true;
        break;
      }
      const slot = (start + k) % slots;
      const dx = (slot % span) - s;
      const dy = Math.floor(slot / span);
      const x = col + dx;
      const y = topRow + dy;
      const i = y * w + x;
      if (x < 0 || x >= w || !inside[i] || this.cells[i]) continue;
      this.cells[i] = c;
      this.used[c]++;
      if (this.remaining) this.remaining[c]--;
      this.addedThisTick++;
      this.touch(y);
    }
  }

  private touch(y: number): void {
    this.version++;
    this.quiet[y] = 0;
    if (y > 0) this.quiet[y - 1] = 0;
    this.lastChangeTick = this.tick;
  }

  private free(x: number, y: number): boolean {
    if (x < 0 || x >= this.w || y >= this.h) return false;
    const i = y * this.w + x;
    return this.mask.inside[i] === 1 && this.cells[i] === 0;
  }

  private move(x: number, y: number, nx: number, ny: number): void {
    const w = this.w;
    const j = ny * w + nx;
    this.cells[j] = this.cells[y * w + x];
    this.cells[y * w + x] = 0;
    this.stamp[j] = this.stampId;
    this.movedThisTick++;
    this.touch(y);
    if (ny !== y) this.touch(ny);
  }

  private fall(): void {
    const { w, h } = this;
    const settle = TUNING.ROW_SETTLE_TICKS;
    const tc = tiltClass(this.tilt);
    const low = this.tilt > 0 ? 1 : -1;
    const cells = this.cells;
    const stamp = this.stamp;
    const sid = this.stampId;

    for (let y = h - 2; y >= 0; y--) {
      if (this.quiet[y] > settle) continue;
      // Scan direction: from the low side when tilted, alternating when level.
      const ltr = tc === 0 ? ((this.tick + y) & 1) === 0 : low < 0;
      for (let k = 0; k < w; k++) {
        const x = ltr ? k : w - 1 - k;
        const i = y * w + x;
        if (cells[i] === 0 || stamp[i] === sid) continue;
        if (tc === 0) this.ruleLevel(x, y);
        else if (tc === 1) this.ruleSlight(x, y, low);
        else this.ruleSteep(x, y, low);
      }
    }
  }

  /** Down (up to two cells while falling freely), then diagonals in alternating order. */
  private ruleLevel(x: number, y: number): void {
    if (this.fallDown(x, y)) return;
    const a = ((y + this.tick) & 1) === 0 ? 1 : -1;
    if (this.free(x + a, y + 1)) this.move(x, y, x + a, y + 1);
    else if (this.free(x - a, y + 1)) this.move(x, y, x - a, y + 1);
  }

  /** Down; diagonal to the low side; diagonal to the high side only where the drop is deep. */
  private ruleSlight(x: number, y: number, low: number): void {
    if (this.fallDown(x, y)) return;
    if (this.free(x + low, y + 1)) {
      this.move(x, y, x + low, y + 1);
      return;
    }
    const hx = x - low;
    for (let d = 1; d <= TUNING.SLIGHT_HIGH_SIDE_DROP; d++) if (!this.free(hx, y + d)) return;
    this.move(x, y, hx, y + 1);
  }

  /**
   * Diagonal to the low side; down; sideways to the low side (§6.2).
   * Two further moves keep the slope that builds up against the low wall no
   * steeper than one cell per STEEP_SLOPE_RUN columns – gentler than the 45°
   * rest angle of the level rules, so the slope survives when the jar is
   * levelled: a grain drops diagonally to the high side over a 45° edge, and
   * rolls sideways to the high side where the slope is too steep.
   */
  private ruleSteep(x: number, y: number, low: number): void {
    if (this.free(x + low, y + 1)) {
      this.move(x, y, x + low, y + 1);
      return;
    }
    if (this.fallDown(x, y)) return;
    const run = TUNING.STEEP_SLOPE_RUN;
    const high = -low;
    // Slide to the low side, unless the grain would only roll straight back.
    if (this.free(x + low, y) && !this.free(x + high * (run - 1), y + 1)) {
      this.move(x, y, x + low, y);
      return;
    }
    if (this.free(x + high, y + 1)) {
      this.move(x, y, x + high, y + 1);
      return;
    }
    for (let j = 1; j < run; j++) if (!this.free(x + high * j, y)) return;
    if (this.free(x + high * run, y + 1)) this.move(x, y, x + high, y);
  }

  private fallDown(x: number, y: number): boolean {
    if (!this.free(x, y + 1)) return false;
    if (this.free(x, y + 2)) this.move(x, y, x, y + 2);
    else this.move(x, y, x, y + 1);
    return true;
  }
}

/** Replays a recording on a fresh simulation and lets it settle. */
export function replay(
  mask: JarMask,
  seed: number,
  limits: Record<number, number> | null,
  events: InputEvent[],
  settleTicks = 600,
): SandSim {
  const sim = new SandSim(mask, seed, limits);
  let e = 0;
  const lastTick = events.length ? events[events.length - 1][0] : 0;
  while (sim.tick <= lastTick) {
    while (e < events.length && events[e][0] === sim.tick) {
      sim.apply(events[e][1], events[e][2]);
      e++;
    }
    sim.step();
  }
  runUntilSettled(sim, settleTicks);
  return sim;
}

export function runUntilSettled(sim: SandSim, maxTicks = 600): void {
  sim.setPouring(false);
  for (let i = 0; i < maxTicks && !sim.settled; i++) sim.step();
}

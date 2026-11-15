import { SandSim, runUntilSettled } from '../sand/sim';
import { maskFor, type ShapeId } from './shapes';

/**
 * Scripted pouring with the real simulation, used to author jars (§A2): every
 * target is made by actually pouring it, with the same rules as the player,
 * and the inputs are recorded tick by tick.
 */
export class Designer {
  readonly sim: SandSim;
  private dir = 1;

  constructor(shape: ShapeId, seed: number) {
    this.sim = new SandSim(maskFor(shape), seed, null);
  }

  get mask() {
    return this.sim.mask;
  }

  private tick(): void {
    this.sim.step();
  }

  idle(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.tick();
  }

  settle(): void {
    runUntilSettled(this.sim, 900);
  }

  tilt(deg: number): void {
    // Ease the tilt in a few degrees per tick, as a thumb would.
    const s = this.sim;
    while (s.tilt !== deg) {
      const step = Math.sign(deg - s.tilt) * Math.min(3, Math.abs(deg - s.tilt));
      s.setTilt(s.tilt + step);
      this.tick();
    }
    this.settle();
  }

  /**
   * Pours `grains` of `colour` while sweeping the spout between `from` and
   * `to` (inclusive, clamped to the opening) at `speed` columns per tick.
   * Stops early if nothing can be added for a while.
   */
  sweep(colour: number, grains: number, from?: number, to?: number, speed = 1): number {
    const s = this.sim;
    const lo = Math.max(this.mask.openLeft, from ?? this.mask.openLeft);
    const hi = Math.min(this.mask.openRight, to ?? this.mask.openRight);
    s.setColour(colour);
    if (s.column < lo || s.column > hi) s.setColumn(lo);
    s.setPouring(true);
    let added = 0;
    let stalled = 0;
    const patience = 2 * (hi - lo) + 60;
    while (added < grains && stalled < patience) {
      let next = s.column + this.dir * speed;
      if (next > hi) {
        next = hi;
        this.dir = -1;
      } else if (next < lo) {
        next = lo;
        this.dir = 1;
      }
      if (hi > lo) s.setColumn(next);
      this.tick();
      added += s.addedThisTick;
      stalled = s.addedThisTick ? 0 : stalled + 1;
    }
    s.setPouring(false);
    this.settle();
    return added;
  }

  /** Pours at one column, building a mound. */
  at(colour: number, col: number, grains: number, wobble = 0): number {
    return this.sweep(colour, grains, col - wobble, col + wobble, 1);
  }

  /** Fills the jar to its fill line, tilting both ways to reach pockets (bottle shoulders). */
  fillUp(colour: number, tiltPockets: boolean): void {
    const cap = this.mask.capacity;
    if (tiltPockets) {
      for (const t of [25, -25]) {
        this.tilt(t);
        this.sweep(colour, cap);
      }
      this.tilt(0);
    }
    this.sweep(colour, cap);
  }

  /** Grains currently in the jar. */
  total(): number {
    let n = 0;
    for (const c of this.sim.cells) if (c) n++;
    return n;
  }
}

import { TUNING } from '../config/tuning';
import { angleTo, clampAngle, type Beam } from '../sim/beam';
import type { BeamControl } from '../state/save';

/**
 * Beam control (§7). Both options only set the beam's *target*; the beam itself
 * always turns at its own turning speed, so neither can swing it faster.
 *
 * - Drag to turn: sideways drag anywhere turns the target by `sensitivity` degrees per point.
 * - Touch to aim: the target points at the touch; touches on the harbour strip are ignored.
 */
export class BeamInput {
  mode: BeamControl = 'drag';
  sensitivity: number = TUNING.DRAG_SENSITIVITY.default;
  /** Set when the player first moves the beam (for the first-launch hand hint). */
  moved = false;
  private lastX: number | null = null;
  private pointer: number | null = null;

  constructor(
    private beam: Beam,
    /** Converts a screen point (CSS px) to world tiles. */
    private toWorld: (x: number, y: number) => { x: number; y: number },
  ) {}

  down(id: number, x: number, y: number): void {
    if (this.pointer !== null) return;
    this.pointer = id;
    this.lastX = x;
    if (this.mode === 'touch') this.aim(x, y);
  }

  move(id: number, x: number, y: number): void {
    if (id !== this.pointer) return;
    if (this.mode === 'drag') {
      const dx = x - (this.lastX ?? x);
      this.lastX = x;
      if (dx) {
        this.beam.setTarget(clampAngle(this.beam.target + dx * this.sensitivity));
        this.moved = true;
      }
    } else this.aim(x, y);
  }

  up(id: number): void {
    if (id !== this.pointer) return;
    // Lifting the thumb leaves the beam where it is: the target stays.
    this.pointer = null;
    this.lastX = null;
  }

  private aim(x: number, y: number): void {
    const w = this.toWorld(x, y);
    if (w.y > TUNING.SEA_H) return; // the harbour strip
    this.beam.setTarget(angleTo(w.x, w.y));
    this.moved = true;
  }
}

import { TUNING } from '../config/tuning';
import type { Point } from '../sim/flight';
import type { Steering } from '../state/save';

/**
 * Steering (§8). "Follow my thumb": the leader heads for a point 2.5 tiles
 * above the thumb while touching, and holds its place when lifted. "Draw a
 * path": a line drawn on the sky, fixed to the sky, flown from its nearest
 * end; a new line replaces what remains of the old one.
 *
 * Works in world tiles; the screen mapping comes from `toWorld`.
 */
export class SteeringInput {
  readonly mode: Steering;
  private pointer: number | null = null;
  private thumb: Point | null = null; // screen px
  /** The drawn line being flown (world tiles). */
  path: Point[] = [];
  /** The line being drawn right now (world tiles). */
  drawing: Point[] = [];
  onFirstTouch: (() => void) | null = null;
  private touched = false;
  private down = (e: PointerEvent) => this.handleDown(e);
  private move = (e: PointerEvent) => this.handleMove(e);
  private up = (e: PointerEvent) => this.handleUp(e);

  constructor(
    mode: Steering,
    private el: HTMLElement,
    private toWorld: (px: number, py: number) => Point,
    private leader: () => Point,
  ) {
    this.mode = mode;
    el.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
  }

  get touching(): boolean {
    return this.pointer !== null;
  }

  /** The leader's target this tick, or null to hold its place on screen. */
  target(): Point | null {
    if (this.mode === 'thumb') {
      if (!this.thumb) return null;
      const w = this.toWorld(this.thumb.x, this.thumb.y);
      return { x: w.x, y: w.y + TUNING.THUMB_OFFSET };
    }
    const lead = this.leader();
    // Drop points the leader has reached.
    while (this.path.length && Math.hypot(this.path[0].x - lead.x, this.path[0].y - lead.y) < 0.35) this.path.shift();
    return this.path[0] ?? null;
  }

  private handleDown(e: PointerEvent): void {
    if (this.pointer !== null) return;
    this.pointer = e.pointerId;
    if (!this.touched) {
      this.touched = true;
      this.onFirstTouch?.();
    }
    if (this.mode === 'thumb') this.thumb = { x: e.clientX, y: e.clientY };
    else this.drawing = [this.toWorld(e.clientX, e.clientY)];
  }

  private handleMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointer) return;
    if (this.mode === 'thumb') this.thumb = { x: e.clientX, y: e.clientY };
    else {
      const p = this.toWorld(e.clientX, e.clientY);
      const last = this.drawing[this.drawing.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.2) this.drawing.push(p);
    }
  }

  private handleUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointer) return;
    this.pointer = null;
    if (this.mode === 'thumb') {
      this.thumb = null;
      return;
    }
    if (this.drawing.length >= 2) {
      // Fly it from the end nearest the leader; it replaces whatever remains of the old line.
      const lead = this.leader();
      const a = this.drawing[0];
      const b = this.drawing[this.drawing.length - 1];
      this.path = Math.hypot(a.x - lead.x, a.y - lead.y) <= Math.hypot(b.x - lead.x, b.y - lead.y) ? this.drawing : [...this.drawing].reverse();
    }
    this.drawing = [];
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
  }
}

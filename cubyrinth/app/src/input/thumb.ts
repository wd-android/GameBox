import { TUNING } from '../config/tuning';

/**
 * Thumb-tilt and step-swipe input (§7.12, §7.11). Touching anywhere sets the
 * neutral point; dragging away gives the tilt vector (current − neutral) ÷
 * radius, limited to length 1. There is no fixed on-screen joystick.
 */
export class ThumbInput {
  radius: number = TUNING.TILT_RADIUS_DEFAULT;
  mode: 'tilt' | 'step' = 'tilt';
  /** Current tilt vector in screen axes. */
  tilt = { x: 0, y: 0 };
  /** Where the neutral point is, for the on-screen ring. Null when not touching. */
  neutral: { x: number; y: number } | null = null;
  current: { x: number; y: number } | null = null;
  onSwipe: ((dir: number) => void) | null = null;
  onTouch: (() => void) | null = null;
  private pointerId: number | null = null;
  private swipeFrom: { x: number; y: number } | null = null;
  private down = (e: PointerEvent) => this.handleDown(e);
  private move = (e: PointerEvent) => this.handleMove(e);
  private up = (e: PointerEvent) => this.handleUp(e);

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
  }

  /** After a turn, the current touch becomes the new neutral point (§7.7). */
  resetNeutral(): void {
    if (this.current) this.neutral = { ...this.current };
    this.tilt = { x: 0, y: 0 };
  }

  release(): void {
    this.pointerId = null;
    this.neutral = null;
    this.current = null;
    this.tilt = { x: 0, y: 0 };
    this.swipeFrom = null;
  }

  private handleDown(e: PointerEvent): void {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.neutral = { x: e.clientX, y: e.clientY };
    this.current = { ...this.neutral };
    this.swipeFrom = { ...this.neutral };
    this.tilt = { x: 0, y: 0 };
    this.onTouch?.();
  }

  private handleMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId || !this.neutral) return;
    this.current = { x: e.clientX, y: e.clientY };
    if (this.mode === 'tilt') {
      let x = (e.clientX - this.neutral.x) / this.radius;
      let y = (e.clientY - this.neutral.y) / this.radius;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      this.tilt = { x, y };
    } else if (this.swipeFrom) {
      const dx = e.clientX - this.swipeFrom.x;
      const dy = e.clientY - this.swipeFrom.y;
      if (Math.hypot(dx, dy) > 28) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
        this.onSwipe?.(dir);
        // Allow a further swipe without lifting the thumb.
        this.swipeFrom = { x: e.clientX, y: e.clientY };
      }
    }
  }

  private handleUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
  }
}

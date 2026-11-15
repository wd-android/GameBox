import type { JarMask } from '../sand/grid';

/**
 * Turns thumb positions into the spout column, for both "Pouring" settings
 * (§7). The simulation only ever sees a grid column, so both settings can
 * make exactly the same pictures.
 *
 *  - thumb: the stream falls in the column above the thumb.
 *  - fixed: the spout stays at `spoutX`; moving the thumb slides the jar by
 *           the same distance, until its inner wall reaches the spout.
 */
export type PourMode = 'thumb' | 'fixed';

export interface PourGeometry {
  /** Screen width of one grid cell. */
  cell: number;
  /** Screen x of the left edge of grid column 0 when the jar is not slid. */
  jarLeft: number;
  /** Screen x of the fixed spout. */
  spoutX: number;
}

export class PourControl {
  mode: PourMode;
  /** How far the jar is slid (screen px), fixed-spout mode only. */
  offset = 0;
  private startX = 0;
  private startOffset = 0;

  constructor(
    private mask: JarMask,
    public geom: PourGeometry,
    mode: PourMode,
  ) {
    this.mode = mode;
  }

  setMode(mode: PourMode): void {
    this.mode = mode;
    if (mode === 'thumb') this.offset = 0;
    else this.offset = this.clampOffset(this.offset);
  }

  columnAt(screenX: number): number {
    const c = Math.floor((screenX - (this.geom.jarLeft + this.offset)) / this.geom.cell);
    return Math.max(this.mask.openLeft, Math.min(this.mask.openRight, c));
  }

  /** Thumb touches the jar. Returns the column to pour into. */
  begin(x: number): number {
    if (this.mode === 'thumb') return this.columnAt(x);
    this.startX = x;
    this.startOffset = this.offset;
    return this.columnAt(this.geom.spoutX);
  }

  /** Thumb moves. Returns the column to pour into. */
  move(x: number): number {
    if (this.mode === 'thumb') return this.columnAt(x);
    this.offset = this.clampOffset(this.startOffset + (x - this.startX));
    return this.columnAt(this.geom.spoutX);
  }

  /** The screen x of the stream for drawing. */
  streamX(column: number): number {
    if (this.mode === 'fixed') return this.geom.spoutX;
    return this.geom.jarLeft + (column + 0.5) * this.geom.cell;
  }

  private clampOffset(o: number): number {
    const { cell, jarLeft, spoutX } = this.geom;
    // Column under the spout = floor((spoutX - jarLeft - offset) / cell) must stay inside the opening.
    const maxO = spoutX - jarLeft - this.mask.openLeft * cell;
    const minO = spoutX - jarLeft - (this.mask.openRight + 1) * cell + 0.001;
    return Math.max(minO, Math.min(maxO, o));
  }
}

import { BufferImageSource, Container, Graphics, Sprite, Texture, Text } from 'pixi.js';
import { SAND_COLOURS, THEME } from '../config/theme';
import { TUNING } from '../config/tuning';
import type { JarMask } from '../sand/grid';
import type { SandSim } from '../sand/sim';
import { SHAPES, type ShapeId } from '../jars/shapes';
import { outlinePoints } from './outline';
import { paintGuides, paintSand } from './painter';

/**
 * A grid-sized pixel buffer uploaded straight to a nearest-neighbour texture.
 * Uploading from a typed array avoids the GPU read-back that a 2D canvas
 * texture source can cause on every frame.
 */
class GridLayer {
  readonly bytes: Uint8Array;
  readonly buf: Uint32Array;
  readonly source: BufferImageSource;
  readonly texture: Texture;
  readonly sprite: Sprite;

  constructor(w: number, h: number) {
    this.bytes = new Uint8Array(w * h * 4);
    this.buf = new Uint32Array(this.bytes.buffer);
    this.source = new BufferImageSource({
      resource: this.bytes,
      width: w,
      height: h,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
      alphaMode: 'premultiply-alpha-on-upload',
    });
    this.texture = new Texture({ source: this.source });
    this.sprite = new Sprite(this.texture);
  }

  flush(): void {
    this.source.update();
  }

  destroy(): void {
    this.sprite.destroy();
    this.texture.destroy(true);
  }
}

export interface ViewState {
  tilt: number;
  offset: number;
  pouring: boolean;
  streamX: number;
  colour: number;
  patterns: boolean;
  fixedSpout: boolean;
  spoutX: number;
  peek: number;
  showHand: boolean;
  /** 0..1 – how hard the jar is being held at the rim, for the rim glow. */
  rimActive: number;
}

/**
 * Draws the jar on the pouring screen: sand from the grid every frame, glass
 * with soft highlights over it, guide lines, the target "peek", the falling
 * stream and, in fixed-spout mode, the spout. Drawing only – no rules.
 */
export class JarView {
  readonly root = new Container();
  readonly jar = new Container();
  private sand: GridLayer;
  private guides: GridLayer;
  private peek: GridLayer;
  private glassBack = new Graphics();
  private glassFront = new Graphics();
  private rim = new Graphics();
  private stream = new Graphics();
  private spout = new Graphics();
  private hand: Text;
  private lastPaintTick = -1;
  private lastPatterns = false;
  private time = 0;
  private particles: { y: number; dx: number; v: number }[] = [];

  cell = 4;
  baseX = 0;
  baseY = 0;

  constructor(
    readonly mask: JarMask,
    readonly shape: ShapeId,
  ) {
    this.sand = new GridLayer(mask.w, mask.h);
    this.guides = new GridLayer(mask.w, mask.h);
    this.peek = new GridLayer(mask.w, mask.h);
    this.guides.sprite.alpha = 0.5;
    this.peek.sprite.alpha = 0;

    this.jar.pivot.set(mask.w / 2, (SHAPES[shape].top + SHAPES[shape].bottom) / 2);
    this.jar.addChild(this.glassBack, this.sand.sprite, this.peek.sprite, this.guides.sprite, this.glassFront, this.rim);
    this.drawGlass();

    this.hand = new Text({ text: '👆', style: { fontSize: 44 } });
    this.hand.anchor.set(0.5);
    this.root.addChild(this.spout, this.jar, this.stream, this.hand);

    for (let i = 0; i < TUNING.STREAM_PARTICLES; i++) this.particles.push({ y: Math.random(), dx: Math.random() * 2 - 1, v: 0.6 + Math.random() * 0.8 });
  }

  /** Space kept above the jar for the spout and the falling stream (px). */
  static readonly STREAM_SPACE = 64;

  /** Fits the jar into the free area between the HUD bands, leaving room for the stream above. */
  layout(width: number, top: number, bottom: number): void {
    const s = SHAPES[this.shape];
    const jarTop = s.top - 4;
    const jarH = s.bottom + 2 - jarTop;
    const space = JarView.STREAM_SPACE;
    const availH = bottom - top - space;
    // Width leaves room for the swing of a tilted jar.
    this.cell = Math.max(1.5, Math.min((width * 0.84) / this.mask.w, availH / jarH));
    this.jar.scale.set(this.cell);
    this.baseX = width / 2;
    const used = jarH * this.cell;
    const y0 = top + space + Math.max(0, (availH - used) / 2);
    this.baseY = y0 + (this.jar.pivot.y - jarTop) * this.cell;
    this.spoutY = y0 - space + 26;
  }

  /** Screen y of the fixed spout's mouth. */
  spoutY = 0;

  setGuides(lines: Uint8Array | null): void {
    if (lines) paintGuides(this.guides.buf, lines);
    else this.guides.buf.fill(0);
    this.guides.flush();
  }

  setTarget(target: Uint8Array | null, patterns: boolean): void {
    if (target) paintSand(this.peek.buf, target, this.mask, { patterns });
    else this.peek.buf.fill(0);
    this.peek.flush();
  }

  /** Screen position of the top of the opening at a grid column. */
  openingPoint(col: number): { x: number; y: number } {
    return this.jar.toGlobal({ x: col + 0.5, y: this.mask.topRow });
  }

  /** Converts a screen point to jar grid coordinates. */
  toGrid(x: number, y: number): { x: number; y: number } {
    return this.jar.toLocal({ x, y });
  }

  update(sim: SandSim, st: ViewState, dtMs: number): void {
    this.time += dtMs;
    this.jar.position.set(this.baseX + st.offset, this.baseY);
    this.jar.rotation = (st.tilt * Math.PI) / 180;

    if (sim.version !== this.lastPaintTick || st.patterns !== this.lastPatterns) {
      paintSand(this.sand.buf, sim.cells, this.mask, { patterns: st.patterns });
      this.sand.flush();
      this.lastPaintTick = sim.version;
      this.lastPatterns = st.patterns;
    }

    this.peek.sprite.alpha = st.peek * 0.5;
    this.drawRim(st.rimActive);
    this.drawStream(sim, st, dtMs);
    this.drawSpout(st);

    this.hand.visible = st.showHand;
    if (st.showHand) {
      const p = this.jar.toGlobal({ x: this.mask.w / 2, y: (this.mask.topRow + this.mask.h) / 2 });
      const k = (Math.sin(this.time / 260) + 1) / 2;
      this.hand.position.set(p.x + 6, p.y + 10 - k * 8);
      this.hand.scale.set(1 - k * 0.12);
      this.hand.alpha = 0.95;
    }
  }

  private drawGlass(): void {
    const pts = outlinePoints(this.shape, 0.5).flat();
    this.glassBack.clear().poly(pts).fill({ color: 0xffffff, alpha: 0.06 });

    const s = SHAPES[this.shape];
    const g = this.glassFront.clear();
    g.poly(pts).stroke({ color: 0xffffff, alpha: 0.6, width: 1.1, join: 'round' });
    // Soft vertical highlights on the glass, over the sand.
    const midY = Math.floor((s.top + s.bottom) * 0.62);
    const hwMid = s.halfWidth(midY);
    const lx = this.mask.w / 2 - hwMid + 3;
    g.roundRect(lx, s.top + 34, 2.2, s.bottom - s.top - 48, 1.1).fill({ color: 0xffffff, alpha: 0.2 });
    g.roundRect(lx + 4, s.top + 50, 1, s.bottom - s.top - 80, 0.5).fill({ color: 0xffffff, alpha: 0.12 });
    const rx = this.mask.w / 2 + hwMid - 4;
    g.roundRect(rx, s.top + 60, 1.2, (s.bottom - s.top) * 0.3, 0.6).fill({ color: 0xffffff, alpha: 0.1 });
    // Fill-line ticks.
    const hwF = s.halfWidth(s.fill);
    const accent = parseInt(THEME.accent.slice(1), 16);
    g.rect(this.mask.w / 2 - hwF - 2.6, s.fill, 2.4, 0.7).fill({ color: accent, alpha: 0.8 });
    g.rect(this.mask.w / 2 + hwF + 0.2, s.fill, 2.4, 0.7).fill({ color: accent, alpha: 0.8 });
  }

  private drawRim(active: number): void {
    const s = SHAPES[this.shape];
    const hw = s.halfWidth(s.top) + 1.6;
    const cx = this.mask.w / 2;
    this.rim
      .clear()
      .roundRect(cx - hw, s.top - 3.2, hw * 2, 3.4, 1.7)
      .fill({ color: 0xffffff, alpha: 0.22 + active * 0.3 })
      .stroke({ color: active > 0 ? parseInt(THEME.accent.slice(1), 16) : 0xffffff, alpha: 0.7, width: 0.6 });
  }

  private drawStream(sim: SandSim, st: ViewState, dt: number): void {
    const g = this.stream.clear();
    const flowing = st.pouring && sim.addedThisTick > 0;
    if (!flowing) return;
    const [r, gg, b] = SAND_COLOURS[st.colour].rgb;
    const colour = (r << 16) | (gg << 8) | b;
    const end = this.openingPoint(sim.column);
    const top = st.fixedSpout ? this.spoutY + 10 : Math.max(8, Math.min(end.y - 20, this.spoutY - 10));
    const x = st.fixedSpout ? st.spoutX : st.streamX;
    const len = end.y - top;
    const w = Math.max(2, this.cell * 0.9);
    g.rect(x - w / 2, top, w, len).fill({ color: colour, alpha: 0.55 });
    for (const p of this.particles) {
      p.y += (dt / 1000) * p.v * 2.2;
      if (p.y > 1) p.y -= 1;
      const py = top + p.y * len;
      g.rect(x + p.dx * this.cell * 1.3 - 1, py, Math.max(1.5, this.cell * 0.6), Math.max(1.5, this.cell * 0.6)).fill({ color: colour, alpha: 0.95 });
    }
    // A small splash where the stream meets the sand.
    g.circle(x, end.y + 2, this.cell * 1.4).fill({ color: colour, alpha: 0.35 });
  }

  private drawSpout(st: ViewState): void {
    const g = this.spout.clear();
    if (!st.fixedSpout) return;
    const y = this.spoutY;
    const x = st.spoutX;
    g.poly([x - 26, y - 22, x + 26, y - 22, x + 7, y + 4, x + 5, y + 10, x - 5, y + 10, x - 7, y + 4])
      .fill({ color: parseInt(THEME.violet.slice(1), 16), alpha: 0.95 })
      .stroke({ color: parseInt(THEME.accent.slice(1), 16), alpha: 0.9, width: 2 });
  }

  destroy(): void {
    this.root.destroy({ children: true });
    this.sand.destroy();
    this.guides.destroy();
    this.peek.destroy();
  }
}

import { Container, Graphics, Sprite } from 'pixi.js';
import { BUILDINGS, type BuildingId } from '../config/tuning';
import type { Levels } from '../town/town';
import { Rng } from '../sim/rng';
import { radial } from './textures';

/**
 * The town above the harbour (§10, §11): night sky, the lighthouse sweeping,
 * and six building plots whose lit windows multiply as they are built and upgraded.
 */

const WARM = 0xffd27a;

/** Plot positions in a 100 × 100 layout box (x, baseline y, width, height). */
const PLOTS: Record<BuildingId, [number, number, number, number]> = {
  market: [36, 70, 20, 12],
  smokehouse: [14, 64, 15, 15],
  boatyard: [60, 72, 22, 12],
  inn: [30, 52, 18, 16],
  chandlery: [52, 54, 16, 14],
  pier: [70, 84, 26, 4],
};

export class TownView {
  readonly root = new Container();
  private sky = new Graphics();
  private stars = new Graphics();
  private land = new Graphics();
  private houses = new Graphics();
  private windows = new Graphics();
  private beam = new Graphics();
  private sea = new Graphics();
  private lamp: Sprite;
  private time = 0;
  private w = 390;
  private h = 844;
  private box = { x: 0, y: 0, s: 1 };
  reducedMotion = false;

  constructor(private levels: Levels) {
    this.lamp = new Sprite(radial('#ffd27a', [[0, 1], [0.3, 0.6], [1, 0]]));
    this.lamp.anchor.set(0.5);
    this.root.addChild(this.sky, this.stars, this.beam, this.land, this.houses, this.windows, this.sea, this.lamp);
  }

  setLevels(levels: Levels): void {
    this.levels = levels;
    this.drawTown();
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    // The town sits in the middle band of the screen, between the top bar and the buttons.
    const s = Math.min(w, h * 0.55) / 100;
    this.box = { x: (w - 100 * s) / 2, y: h * 0.16, s };
    this.sky.clear();
    const bands = 16;
    for (let k = 0; k < bands; k++) {
      const t = k / (bands - 1);
      const col = mix(0x120228, 0x3a1a6a, t);
      this.sky.rect(0, (h * k) / bands, w, h / bands + 1).fill({ color: col });
    }
    this.stars.clear();
    const rng = new Rng(7);
    for (let k = 0; k < 70; k++) this.stars.circle(rng.range(0, w), rng.range(0, h * 0.5), rng.range(0.6, 1.6)).fill({ color: 0xffffff, alpha: rng.range(0.3, 0.9) });
    this.stars.circle(w * 0.14, h * 0.2, 16).fill({ color: 0xfff3d0, alpha: 0.9 });
    this.stars.circle(w * 0.14 + 7, h * 0.2 - 4, 14).fill({ color: 0x1f0a48 });
    this.drawTown();
  }

  private P(x: number, y: number): [number, number] {
    return [this.box.x + x * this.box.s, this.box.y + y * this.box.s];
  }

  private drawTown(): void {
    const { s } = this.box;
    const l = this.land;
    l.clear();
    // Hills behind the town
    const hill: number[] = [];
    for (let x = -10; x <= 110; x += 5) hill.push(...this.P(x, 46 + 6 * Math.sin(x * 0.07) + 4 * Math.sin(x * 0.19)));
    hill.push(...this.P(110, 100), ...this.P(-10, 100));
    l.poly(hill).fill({ color: 0x24104a });
    // The quay
    l.poly([...this.P(-10, 74), ...this.P(110, 74), ...this.P(110, 100), ...this.P(-10, 100)]).fill({ color: 0x2c1858 });
    l.rect(...this.P(-10, 74), 120 * s, 1.2 * s).fill({ color: 0x5a3a9a });
    // Lighthouse on the headland to the right
    const [lx, ly] = this.P(90, 40);
    l.poly([lx - 3 * s, ly + 34 * s, lx - 1.8 * s, ly, lx + 1.8 * s, ly, lx + 3 * s, ly + 34 * s]).fill({ color: 0xf2efe8 });
    l.rect(lx - 2.3 * s, ly + 8 * s, 4.6 * s, 2 * s).fill({ color: 0xc2412d });
    l.rect(lx - 2.6 * s, ly + 18 * s, 5.2 * s, 2 * s).fill({ color: 0xc2412d });
    l.poly([lx - 2.4 * s, ly, lx, ly - 3 * s, lx + 2.4 * s, ly]).fill({ color: 0x8a2a20 });
    this.lamp.position.set(lx, ly + 1.2 * s);
    this.lamp.width = this.lamp.height = 16 * s;

    const g = this.houses;
    const win = this.windows;
    g.clear();
    win.clear();
    for (const b of BUILDINGS) {
      const level = this.levels[b.id];
      const [px, py, pw, ph] = PLOTS[b.id];
      const [x, y] = this.P(px, py);
      const W = pw * s;
      const H = ph * s;
      if (level <= 0) {
        g.rect(x, y - H, W, H).stroke({ color: 0xffffff, width: 1, alpha: 0.18 });
        continue;
      }
      if (b.id === 'pier') {
        g.rect(x, y - H, W, H * 0.5).fill({ color: 0x6b4a2a });
        for (let k = 0; k <= 5; k++) g.rect(x + (k * W) / 5 - 1, y - H * 0.5, 2, H * 1.6).fill({ color: 0x4a301a });
        for (let k = 0; k < level; k++) win.circle(x + ((k + 0.5) * W) / level, y - H - 2 * s, 1.2 * s).fill({ color: WARM });
        continue;
      }
      const wall = { market: 0x7a5a9a, smokehouse: 0x5a4a6a, boatyard: 0x4a6a8a, inn: 0x8a4a5a, chandlery: 0x5a7a6a, pier: 0 }[b.id];
      g.rect(x, y - H, W, H).fill({ color: wall }).stroke({ color: 0x1b043b, width: 1.5 });
      g.poly([x - 2 * s, y - H, x + W / 2, y - H - H * 0.45, x + W + 2 * s, y - H]).fill({ color: 0x3a1a3a }).stroke({ color: 0x1b043b, width: 1.5 });
      if (b.id === 'smokehouse') g.rect(x + W * 0.7, y - H - H * 0.6, W * 0.14, H * 0.5).fill({ color: 0x3a2a3a });
      // Windows multiply with level: level + 1 lit windows
      const count = level + 1;
      const cols = Math.min(3, count);
      const rows = Math.ceil(count / cols);
      for (let k = 0; k < count; k++) {
        const c = k % cols;
        const r = Math.floor(k / cols);
        const wx = x + ((c + 0.5) * W) / cols - 1.5 * s;
        const wy = y - H + ((r + 0.35) * H) / (rows + 0.3);
        win.rect(wx, wy, 3 * s, 3 * s).fill({ color: WARM });
        win.circle(wx + 1.5 * s, wy + 1.5 * s, 4 * s).fill({ color: WARM, alpha: 0.12 });
      }
    }
    // Sea below the quay with a few moored boats
    const sea = this.sea;
    sea.clear();
    const [, sy] = this.P(0, 88);
    sea.rect(0, sy, this.w, this.h - sy).fill({ color: 0x0b1a3a });
    for (let k = 0; k < 4; k++) {
      const [bx, by] = this.P(8 + k * 15, 93);
      sea.ellipse(bx, by, 4 * s, 1.2 * s).fill({ color: [0xc2412d, 0x3fa7d6, 0x2f7d4a, 0xc2412d][k] });
      sea.circle(bx, by - 2 * s, 0.9 * s).fill({ color: 0xffcf5a });
    }
  }

  render(dt: number): void {
    this.time += dt;
    const [lx, ly] = this.P(90, 41.2);
    const a = this.reducedMotion ? -2.4 : Math.PI + Math.sin(this.time * 0.45) * 0.9 - 0.4;
    const len = this.w * 1.2;
    const hw = 0.12;
    this.beam.clear();
    for (let k = 3; k >= 1; k--) {
      const r = (len * k) / 3;
      this.beam.poly([lx, ly, lx + Math.cos(a - hw) * r, ly + Math.sin(a - hw) * r, lx + Math.cos(a + hw) * r, ly + Math.sin(a + hw) * r]).fill({ color: WARM, alpha: 0.06 });
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

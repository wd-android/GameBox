import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { TUNING, type BoatKind } from '../config/tuning';
import type { Boat, NightSim, SimEvent } from '../sim/night';
import { Rng } from '../sim/rng';
import { radial } from './textures';

/**
 * Draws a night (§11): a dark blue sea, a warm beam that brightens everything
 * inside it, rocks faintly visible by their foam until lit, boats that always
 * carry a lantern, currents as faint streaks, drifting fog, and short effects.
 * Appearance only; the simulation is in sim/.
 */

const SEA_TOP = 0x0b1a3a;
const SEA_BOTTOM = 0x06122b;
const WARM = 0xffd27a;
const LIT_TINT = 0xffe7b0;

interface Fx {
  kind: 'flare' | 'spray' | 'text' | 'crew' | 'ripple';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  node?: Container;
}

interface BoatNode {
  root: Container;
  hull: Graphics;
  halo: Sprite;
  lantern: Sprite;
  marker: Graphics;
  bob: number;
}

export class SeaView {
  readonly root = new Container();
  private bg = new Graphics();
  private world = new Container();
  private waves = new Graphics();
  private currents = new Graphics();
  private beamG = new Graphics();
  private rockDark = new Container();
  private rockLit: Graphics[] = [];
  private harbourG = new Graphics();
  private lampGlow: Sprite | null = null;
  private boatLayer = new Container();
  private fogLayer = new Container();
  private fxLayer = new Container();
  private markerG = new Graphics();
  private dawn = new Graphics();
  private boats = new Map<number, BoatNode>();
  private fogSprites: Sprite[] = [];
  private fx: Fx[] = [];
  private wavePts: { x: number; y: number; len: number; ph: number }[] = [];
  private time = 0;
  private turnRate = 0;
  private lastAngle = 0;
  dawnAmount = 0;
  reducedMotion = false;
  scale = 32;
  offX = 0;
  offY = 0;
  width = 390;
  height = 844;

  constructor(private sim: NightSim) {
    this.world.addChild(this.waves, this.currents, this.beamG, this.rockDark, this.harbourG, this.boatLayer, this.fogLayer, this.markerG, this.fxLayer);
    this.root.addChild(this.bg, this.world, this.dawn);
    const rng = new Rng(sim.def.seed + 3);
    for (let i = 0; i < 170; i++) this.wavePts.push({ x: rng.range(0, 12), y: rng.range(-6, 16), len: rng.range(0.15, 0.45), ph: rng.range(0, 6.28) });
    this.buildRocks();
    this.buildHarbour();
    if (this.lampGlow) this.world.addChildAt(this.lampGlow, this.world.getChildIndex(this.harbourG) + 1);
    for (const f of sim.fog) {
      const s = new Sprite(radial('#c9d4e6', [[0, 0.55], [0.55, 0.42], [1, 0]]));
      s.anchor.set(0.5);
      this.fogSprites.push(s);
      this.fogLayer.addChild(s);
      s.width = s.height = f.r * 2.4;
    }
  }

  /** Fits the 12 × 18 world to the screen width, anchored at the bottom; sea extends upwards. */
  layout(w: number, h: number, safeBottom: number): void {
    this.width = w;
    this.height = h;
    this.scale = Math.min(w / TUNING.SEA_W, (h - safeBottom) / (TUNING.SEA_H + TUNING.STRIP_H));
    this.offX = (w - TUNING.SEA_W * this.scale) / 2;
    this.offY = h - safeBottom - (TUNING.SEA_H + TUNING.STRIP_H) * this.scale;
    this.world.position.set(this.offX, this.offY);
    this.world.scale.set(this.scale);
    this.bg.clear();
    this.bg.rect(0, 0, w, h).fill({ color: SEA_BOTTOM });
    for (let k = 0; k < 12; k++) this.bg.rect(0, (h * k) / 12, w, h / 12 + 1).fill({ color: SEA_TOP, alpha: 1 - k / 12 });
    this.dawn.clear();
    for (let k = 0; k < 10; k++) this.dawn.rect(0, (k * h) / 30, w, h / 30 + 1).fill({ color: 0xff9a6a, alpha: 0.5 * (1 - k / 10) });
    this.dawn.alpha = this.dawnAmount;
  }

  toWorld(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.offX) / this.scale, y: (y - this.offY) / this.scale };
  }

  private buildRocks(): void {
    for (const r of this.sim.chart.rocks) {
      const dark = new Graphics();
      // Faint foam ring: rocks show in the dark only by their foam.
      // Broken arcs of surf around the rock
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + r.x;
        const rr = r.r + 0.1 + (k % 2) * 0.07;
        dark.moveTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr);
        dark.arc(r.x, r.y, rr, a, a + 0.5).stroke({ color: 0xcfe2ff, width: 0.05, alpha: 0.3 });
      }
      dark.circle(r.x, r.y, r.r * 0.9).fill({ color: 0x0a1428, alpha: 0.85 });
      this.rockDark.addChild(dark);
      const lit = new Graphics();
      const n = 9;
      const pts: number[] = [];
      const rng = new Rng(Math.round(r.x * 100 + r.y * 7));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const rr = r.r * rng.range(0.82, 1.08);
        pts.push(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr);
      }
      lit.circle(r.x, r.y, r.r + 0.16).stroke({ color: 0xffffff, width: 0.08, alpha: 0.85 });
      lit.poly(pts).fill({ color: 0x6b5a4a }).stroke({ color: 0x2a1e14, width: 0.05 });
      lit.circle(r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.3).fill({ color: 0xa08a6e, alpha: 0.8 });
      lit.alpha = 0;
      this.rockLit.push(lit);
      this.rockDark.addChild(lit);
    }
  }

  private buildHarbour(): void {
    const g = this.harbourG;
    const H = TUNING.SEA_H;
    const h = this.sim.chart.harbour;
    // Land strip
    g.rect(-2, H + 0.25, 16, TUNING.STRIP_H + 2).fill({ color: 0x1d1530 });
    g.rect(-2, H + 0.25, 16, 0.12).fill({ color: 0x3b2c58 });
    // Breakwaters either side of the harbour mouth
    g.roundRect(h.x - 2.6, H - 0.15, 1.75, 0.45, 0.2).fill({ color: 0x2e2448 }).stroke({ color: 0x5a4a80, width: 0.05 });
    g.roundRect(h.x + 0.85, H - 0.15, 2.2, 0.45, 0.2).fill({ color: 0x2e2448 }).stroke({ color: 0x5a4a80, width: 0.05 });
    // Harbour water and quay lamps
    g.rect(h.x - 0.85, H + 0.25, 1.7, 1.1).fill({ color: 0x0a1a3a });
    for (const dx of [-1.1, 1.1]) g.circle(h.x + dx, H + 0.55, 0.09).fill({ color: WARM });
    // Cottages along the shore
    for (let k = 0; k < 6; k++) {
      const x = 0.4 + k * 0.75;
      g.rect(x, H + 0.75, 0.6, 0.55).fill({ color: 0x2b1f44 });
      g.poly([x - 0.05, H + 0.75, x + 0.3, H + 0.45, x + 0.65, H + 0.75]).fill({ color: 0x3a2a5c });
      if (k % 2 === 0) g.rect(x + 0.2, H + 0.9, 0.16, 0.16).fill({ color: WARM, alpha: 0.85 });
    }
    // Lighthouse
    const L = TUNING.LIGHTHOUSE;
    g.poly([L.x - 0.45, H + 1.9, L.x - 0.28, L.y - 0.05, L.x + 0.28, L.y - 0.05, L.x + 0.45, H + 1.9]).fill({ color: 0xf2efe8 });
    g.rect(L.x - 0.33, L.y + 0.35, 0.66, 0.16).fill({ color: 0xc2412d });
    g.rect(L.x - 0.38, L.y + 0.8, 0.76, 0.16).fill({ color: 0xc2412d });
    g.roundRect(L.x - 0.32, L.y - 0.35, 0.64, 0.32, 0.06).fill({ color: 0x2a2440 });
    g.poly([L.x - 0.38, L.y - 0.35, L.x, L.y - 0.65, L.x + 0.38, L.y - 0.35]).fill({ color: 0x8a2a20 });
    const glow = new Sprite(radial('#ffd27a', [[0, 1], [0.3, 0.6], [1, 0]]));
    glow.anchor.set(0.5);
    glow.position.set(L.x, L.y - 0.2);
    glow.width = glow.height = 2.2;
    this.lampGlow = glow;
  }

  private boatNode(b: Boat): BoatNode {
    let n = this.boats.get(b.id);
    if (n) return n;
    const root = new Container();
    const halo = new Sprite(radial('#ffe7b0', [[0, 0.75], [0.5, 0.3], [1, 0]]));
    halo.anchor.set(0.5);
    halo.width = halo.height = b.kind === 'trawler' ? 3 : 2.3;
    halo.alpha = 0;
    const hull = new Graphics();
    drawHull(hull, b.kind);
    hull.scale.set(1.6);
    const lantern = new Sprite(radial('#ffcf5a', [[0, 1], [0.25, 0.9], [0.5, 0.25], [1, 0]]));
    lantern.anchor.set(0.5);
    lantern.width = lantern.height = 0.7;
    const marker = new Graphics();
    root.addChild(halo, hull, lantern, marker);
    this.boatLayer.addChild(root);
    n = { root, hull, halo, lantern, marker, bob: 0 };
    this.boats.set(b.id, n);
    return n;
  }

  /** Reacts to the tick's events with effects. */
  onEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'warning') continue;
      const b = e.boat;
      if (e.type === 'lit') this.boatNode(b).bob = 1;
      if (e.type === 'close') {
        this.text(b.x, b.y - 0.6, `+${TUNING.CLOSE_CALL_COINS}`, 0x9ff0ff);
        if (!this.reducedMotion) for (let k = 0; k < 10; k++) this.fx.push({ kind: 'spray', x: b.x, y: b.y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 0.6, max: 0.6 });
      }
      if (e.type === 'landed') {
        this.fx.push({ kind: 'flare', x: this.sim.chart.harbour.x, y: TUNING.SEA_H + 0.2, vx: 0, vy: 0, life: 1.2, max: 1.2 });
        const catchNow = Math.round(TUNING.BOATS[b.kind].catch * (1 + TUNING.CATCH_PER_NIGHT * Math.max(0, this.sim.def.n - 1)));
        this.text(this.sim.chart.harbour.x, TUNING.SEA_H - 0.7, `+${catchNow}`, 0xffd27a);
      }
      if (e.type === 'wrecked') {
        // The crew row ashore.
        const node = new Graphics();
        node.ellipse(0, 0, 0.18, 0.08).fill({ color: 0x8a5a2b });
        node.circle(-0.05, -0.06, 0.05).fill({ color: 0xf2d0a0 });
        node.circle(0.06, -0.06, 0.05).fill({ color: 0xf2d0a0 });
        this.fxLayer.addChild(node);
        const dx = this.sim.chart.harbour.x - b.x;
        const dy = TUNING.SEA_H + 0.3 - b.y;
        const d = Math.hypot(dx, dy) || 1;
        this.fx.push({ kind: 'crew', x: b.x, y: b.y, vx: (dx / d) * 0.9, vy: (dy / d) * 0.9, life: Math.min(8, d / 0.9), max: Math.min(8, d / 0.9), node });
        this.fx.push({ kind: 'ripple', x: b.x, y: b.y, vx: 0, vy: 0, life: 1, max: 1 });
      }
    }
  }

  private text(x: number, y: number, s: string, colour: number): void {
    const t = new Text({ text: s, style: { fontFamily: 'Readex Pro', fontSize: 40, fontWeight: '700', fill: colour, stroke: { color: 0x0b1a3a, width: 6 } } });
    t.anchor.set(0.5);
    t.scale.set(1 / 60);
    t.position.set(x, y);
    this.fxLayer.addChild(t);
    this.fx.push({ kind: 'text', x, y, vx: 0, vy: -0.6, life: 1.2, max: 1.2, node: t });
  }

  render(dt: number): void {
    const sim = this.sim;
    this.time += dt;
    const beam = sim.beam;
    this.turnRate = this.turnRate * 0.85 + Math.abs(beam.angle - this.lastAngle) * 0.15;
    this.lastAngle = beam.angle;
    const L = TUNING.LIGHTHOUSE;

    // ── Beam: a warm wedge, brighter near the lamp ──
    const g = this.beamG;
    g.clear();
    const a0 = ((beam.angle - beam.halfWidth) * Math.PI) / 180;
    const a1 = ((beam.angle + beam.halfWidth) * Math.PI) / 180;
    const layers = 6;
    for (let k = layers; k >= 1; k--) {
      const r = (beam.reach * k) / layers;
      g.poly([L.x, L.y, L.x + Math.sin(a0) * r, L.y - Math.cos(a0) * r, L.x + Math.sin((a0 + a1) / 2) * r * 1.01, L.y - Math.cos((a0 + a1) / 2) * r * 1.01, L.x + Math.sin(a1) * r, L.y - Math.cos(a1) * r]).fill({ color: WARM, alpha: 0.07 });
    }
    // Fogged reach shown as a soft inner edge
    if (sim.fog.length) {
      const r = beam.reach * TUNING.FOG_REACH_SHARE;
      g.moveTo(L.x + Math.cos(a0 - Math.PI / 2) * r, L.y + Math.sin(a0 - Math.PI / 2) * r);
      g.arc(L.x, L.y, r, a0 - Math.PI / 2, a1 - Math.PI / 2).stroke({ color: WARM, width: 0.04, alpha: 0.3 });
    }

    // ── Waves: short dashes that glint inside the beam ──
    const w = this.waves;
    w.clear();
    for (const p of this.wavePts) {
      const drift = this.reducedMotion ? 0 : Math.sin(this.time * 0.6 + p.ph) * 0.15;
      const x = p.x + drift;
      const lit = beam.lights(x, p.y, false);
      const glint = lit && !this.reducedMotion ? Math.min(0.5, this.turnRate * 0.25) * (0.5 + 0.5 * Math.sin(this.time * 9 + p.ph)) : 0;
      w.moveTo(x, p.y).lineTo(x + p.len, p.y).stroke({ color: lit ? LIT_TINT : 0x3a5a9a, width: 0.045, alpha: lit ? 0.45 + glint : 0.22 });
    }

    // ── Currents: faint moving streaks ──
    const c = this.currents;
    c.clear();
    for (const cur of sim.currents) {
      const rng = new Rng(Math.round(cur.y * 10));
      for (let k = 0; k < 18; k++) {
        const len = 0.8;
        const span = cur.w + len;
        const base = rng.range(0, span);
        const off = this.reducedMotion ? 0 : (this.time * cur.strength * 1.2) % span;
        const along = ((base + off) % span) - len;
        const across = rng.range(0.2, cur.h - 0.2);
        const x = cur.dx >= 0 ? cur.x + along : cur.x + cur.w - along;
        const y = cur.y + across;
        c.moveTo(x, y).lineTo(x + cur.dx * len, y + cur.dy * len).stroke({ color: 0x8fb8ff, width: 0.04, alpha: 0.22 });
        c.moveTo(x + cur.dx * len, y).lineTo(x + cur.dx * (len - 0.18), y - 0.1).stroke({ color: 0x8fb8ff, width: 0.04, alpha: 0.22 });
      }
    }

    // ── Rocks: clear when lit ──
    sim.chart.rocks.forEach((r, i) => {
      const lit = beam.lights(r.x, r.y, sim.inFog(r.x, r.y));
      const t = this.rockLit[i];
      t.alpha += ((lit ? 1 : 0) - t.alpha) * Math.min(1, dt * 10);
    });

    // ── Fog ──
    sim.fog.forEach((f, i) => {
      const s = this.fogSprites[i];
      s.position.set(f.x, f.y);
      s.alpha = 0.75 + (this.reducedMotion ? 0 : 0.1 * Math.sin(this.time * 0.4 + i));
    });

    // ── Boats ──
    const m = this.markerG;
    m.clear();
    for (const b of sim.boats) {
      const n = this.boatNode(b);
      if (b.outcome === 'landed') {
        n.root.alpha = Math.max(0, 1 - b.since * 2);
        n.root.position.set(b.x, b.y + b.since * 0.6);
        continue;
      }
      if (b.outcome === 'wrecked') {
        n.root.alpha = Math.max(0, 1 - b.since * 0.6);
        n.root.rotation = b.heading + Math.PI / 2 + Math.min(1.2, b.since * 1.5);
        n.lantern.alpha = Math.max(0, 1 - b.since * 2);
        continue;
      }
      if (b.outcome === 'lost') {
        n.root.alpha = Math.max(0, 1 - b.since * 1.5);
        continue;
      }
      n.bob = Math.max(0, n.bob - dt * 1.6);
      const bob = this.reducedMotion ? 0 : Math.sin((1 - n.bob) * Math.PI * 3) * n.bob * 0.12;
      n.root.position.set(b.x, b.y - bob);
      n.root.rotation = b.heading + Math.PI / 2;
      const alert = b.alert > 0;
      n.halo.alpha += ((b.lit ? 1 : alert ? 0.45 : 0) - n.halo.alpha) * Math.min(1, dt * 12);
      n.hull.tint = alert ? 0xffffff : 0x7a86a8;
      n.lantern.scale.set((0.9 / 128) * (alert ? 1.25 : 1) * (1 + (this.reducedMotion ? 0 : 0.08 * Math.sin(this.time * 5 + b.id))));
      // Lit boats are marked with a ring as well as light, so "which are lit" reads at a glance (acceptance 3).
      if (alert) m.circle(b.x, b.y, b.kind === 'trawler' ? 0.95 : 0.7).stroke({ color: 0xffe7b0, width: 0.06, alpha: b.lit ? 0.9 : 0.45 });
      if (b.danger) {
        const on = this.reducedMotion || Math.floor(this.time * 4) % 2 === 0;
        const y = b.y - 1.15;
        m.poly([b.x, y - 0.32, b.x + 0.3, y + 0.2, b.x - 0.3, y + 0.2]).fill({ color: on ? 0xff5a4a : 0xffb347 }).stroke({ color: 0x1b043b, width: 0.04 });
        m.rect(b.x - 0.03, y - 0.15, 0.06, 0.2).fill({ color: 0xffffff });
        m.circle(b.x, y + 0.11, 0.035).fill({ color: 0xffffff });
      }
    }

    // ── Edge lanterns for boats about to arrive ──
    for (const a of sim.upcoming) {
      const k = 1 - Math.max(0, a.t - sim.time) / TUNING.ARRIVAL_WARNING;
      const x = Math.min(11.7, Math.max(0.3, a.x));
      const y = Math.max(0.3, a.y);
      const pulse = this.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(this.time * 10);
      m.circle(x, y, 0.22 + 0.1 * k).fill({ color: 0xffcf5a, alpha: 0.35 + 0.5 * k * pulse });
      m.circle(x, y, 0.4 + 0.2 * k).stroke({ color: 0xffcf5a, width: 0.05, alpha: 0.5 * k });
    }

    // ── Effects ──
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const k = Math.max(0, f.life / f.max);
      if (f.kind === 'flare') {
        m.circle(f.x, f.y, (1 - k) * 2.2).fill({ color: WARM, alpha: 0.35 * k });
      } else if (f.kind === 'spray') {
        f.vy += 4 * dt;
        m.circle(f.x, f.y, 0.06).fill({ color: 0xdff6ff, alpha: k });
      } else if (f.kind === 'ripple') {
        m.circle(f.x, f.y, (1 - k) * 1.2).stroke({ color: 0xbfd6ff, width: 0.05, alpha: k });
      } else if (f.node) {
        f.node.position.set(f.x, f.y);
        f.node.alpha = f.kind === 'text' ? k : Math.min(1, k * 3);
      }
      if (f.life <= 0) {
        f.node?.destroy();
        this.fx.splice(i, 1);
      }
    }
    this.dawn.alpha = this.dawnAmount;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

/** Boat hulls, drawn pointing up (heading is applied by rotation). */
function drawHull(g: Graphics, kind: BoatKind): void {
  if (kind === 'fishing') {
    g.poly([0, -0.42, 0.2, -0.1, 0.18, 0.32, -0.18, 0.32, -0.2, -0.1]).fill({ color: 0xc2412d }).stroke({ color: 0x2a0e08, width: 0.04 });
    g.rect(-0.1, -0.02, 0.2, 0.2).fill({ color: 0xf2e6c8 });
    g.rect(-0.015, -0.32, 0.03, 0.3).fill({ color: 0x3a2410 });
  } else if (kind === 'dinghy') {
    g.ellipse(0, 0, 0.13, 0.28).fill({ color: 0x3fa7d6 }).stroke({ color: 0x0b2a3a, width: 0.035 });
    g.poly([0.02, -0.26, 0.2, 0.08, 0.02, 0.08]).fill({ color: 0xf8f4ea });
  } else {
    g.roundRect(-0.27, -0.55, 0.54, 1.05, 0.18).fill({ color: 0x2f7d4a }).stroke({ color: 0x0c2414, width: 0.05 });
    g.rect(-0.18, -0.05, 0.36, 0.3).fill({ color: 0xf2e6c8 });
    g.rect(-0.02, -0.5, 0.04, 0.45).fill({ color: 0x3a2410 });
    g.moveTo(0, -0.45).lineTo(0.35, 0.1).stroke({ color: 0x3a2410, width: 0.025 });
  }
}

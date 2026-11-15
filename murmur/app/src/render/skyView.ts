import { Application, Container, FillGradient, Graphics, Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js';
import { TUNING } from '../config/tuning';
import type { Flight, Point } from '../sim/flight';
import { cloudX } from '../world/chunk';

/**
 * Draws the sky (§10): a vivid gradient, dark birds drawn as one batch with
 * their own wobble and wing-beat, a ripple down the ribbon on sharp turns,
 * glowing strays, hazards with warning-coloured edges, hawk shadows, roost
 * trees, the leader's bright trace, and short effects. Appearance only.
 */

interface Fx {
  kind: 'feather' | 'ring' | 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  rot: number;
  colour: number;
}

const WARN = 0xff9a3c;
const DARK = 0x1a0b2e;

export class SkyView {
  readonly root = new Container();
  private bg = new Graphics();
  private world = new Container();
  private hazardLayer = new Container();
  private dyn = new Graphics();
  private screenFx = new Graphics();
  private birdLayer: ParticleContainer;
  private strayLayer: ParticleContainer;
  private birdTex: Texture;
  private strayTex: Texture;
  private particles: Particle[] = [];
  private strayParticles = new Map<number, Particle>();
  private hazardGfx = new Map<number, Graphics>();
  private fx: Fx[] = [];
  private turnHistory: number[] = [];
  private lastHeading = 0;
  private time = 0;
  private murmurBlend = 0;
  private skyStops: string[] = [];

  scale = 32;
  offX = 0;
  width = 390;
  height = 844;
  reducedMotion = false;
  /** Show the looping arrow round the first tree (first launch). */
  tutorialTreeArrow = false;
  /** The drawn path, and the one being drawn, in world tiles. */
  path: Point[] = [];
  drawing: Point[] = [];

  constructor(app: Application) {
    this.birdTex = makeBirdTexture(app, DARK, 0.0);
    this.strayTex = makeBirdTexture(app, 0x2a1640, 1.0);
    this.birdLayer = new ParticleContainer({ dynamicProperties: { position: true, rotation: true, vertex: true, color: false, uvs: false } });
    this.strayLayer = new ParticleContainer({ dynamicProperties: { position: true, rotation: true, vertex: true, color: false, uvs: false } });
    this.world.addChild(this.hazardLayer, this.dyn);
    this.root.addChild(this.bg, this.world, this.strayLayer, this.birdLayer, this.screenFx);
  }

  setSky(stops: string[]): void {
    this.skyStops = stops;
    this.drawBackground();
  }

  layout(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.scale = Math.min(w / TUNING.SKY_W, h / TUNING.SKY_H);
    this.offX = (w - TUNING.SKY_W * this.scale) / 2;
    this.drawBackground();
  }

  private drawBackground(): void {
    if (!this.skyStops.length) return;
    const g = new FillGradient({ type: 'linear', start: { x: 0, y: 1 }, end: { x: 0, y: 0 }, colorStops: this.skyStops.map((c, i) => ({ offset: i / (this.skyStops.length - 1), color: c })), textureSpace: 'local' });
    this.bg.clear().rect(0, 0, this.width, this.height).fill(g);
    // A faint sun low on the horizon.
    this.bg.circle(this.width * 0.72, this.height * 0.86, this.width * 0.22).fill({ color: 0xffd27a, alpha: 0.18 });
    this.bg.circle(this.width * 0.72, this.height * 0.86, this.width * 0.12).fill({ color: 0xffe7b0, alpha: 0.22 });
  }

  /** World tiles → screen px. */
  toScreen(p: Point, camY: number): Point {
    return { x: this.offX + p.x * this.scale, y: this.height - (p.y - camY) * this.scale };
  }

  toWorld(px: number, py: number, camY: number): Point {
    return { x: (px - this.offX) / this.scale, y: camY + (this.height - py) / this.scale };
  }

  reset(): void {
    for (const g of this.hazardGfx.values()) g.destroy();
    this.hazardGfx.clear();
    this.strayLayer.removeParticles();
    this.strayParticles.clear();
    this.birdLayer.removeParticles();
    this.particles = [];
    this.fx = [];
    this.turnHistory = [];
  }

  // ── Effects triggered by the game ─────────────────────────

  feathers(at: Point, count: number): void {
    for (let i = 0; i < Math.min(30, 4 + count * 3); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.5;
      this.fx.push({ kind: 'feather', x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.9 + Math.random() * 0.4, rot: a, colour: DARK });
    }
  }

  flash(at: Point, colour = 0xfff3c4): void {
    this.fx.push({ kind: 'ring', x: at.x, y: at.y, vx: 0, vy: 0, life: 0, max: 0.35, rot: 0, colour });
  }

  sparks(at: Point, colour = 0xffd166): void {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      this.fx.push({ kind: 'spark', x: at.x, y: at.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 0, max: 0.8, rot: 0, colour });
    }
  }

  // ── Every frame ───────────────────────────────────────────

  render(f: Flight, dt: number): void {
    this.time += dt;
    const s = this.scale;
    const camY = f.camY;
    this.world.position.set(this.offX, this.height + camY * s);
    this.world.scale.set(s, -s);
    this.syncHazards(f);
    this.drawDynamic(f);
    this.drawStrays(f);
    this.drawBirds(f, dt);
    this.drawFx(dt, camY);
  }

  private syncHazards(f: Flight): void {
    const alive = new Set<number>();
    for (const c of f.clouds) {
      alive.add(c.id);
      let g = this.hazardGfx.get(c.id);
      if (!g) {
        g = new Graphics();
        // A storm cloud: overlapping dark puffs inside the radius, with a warning edge.
        g.circle(0, 0, c.r).fill({ color: 0x2b2140, alpha: 0.92 }).stroke({ color: WARN, width: 0.08, alpha: 0.9 });
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + c.id;
          g.circle(Math.cos(a) * c.r * 0.45, Math.sin(a) * c.r * 0.45, c.r * 0.5).fill({ color: 0x3b2d58, alpha: 0.55 });
        }
        g.circle(-c.r * 0.25, c.r * 0.25, c.r * 0.35).fill({ color: 0x55467a, alpha: 0.35 });
        this.hazardLayer.addChild(g);
        this.hazardGfx.set(c.id, g);
      }
      g.position.set(cloudX(c, f.t), c.baseY + c.y);
    }
    for (const w of f.wires) {
      alive.add(w.id);
      if (this.hazardGfx.has(w.id)) continue;
      const g = new Graphics();
      for (const [a, b] of w.spans) {
        g.moveTo(a, w.y).lineTo(b, w.y).stroke({ color: WARN, width: 0.14, alpha: 0.55 });
        g.moveTo(a, w.y).lineTo(b, w.y).stroke({ color: DARK, width: 0.07 });
      }
      this.hazardLayer.addChild(g);
      this.hazardGfx.set(w.id, g);
    }
    for (const p of f.pylons) {
      alive.add(p.id);
      if (this.hazardGfx.has(p.id)) continue;
      const g = new Graphics();
      g.rect(p.x, p.y, p.w, p.h).fill({ color: DARK }).stroke({ color: WARN, width: 0.06 });
      g.moveTo(p.x + p.w / 2, p.y).lineTo(p.x + p.w / 2, p.y + p.h).stroke({ color: WARN, width: 0.03, alpha: 0.6 });
      this.hazardLayer.addChild(g);
      this.hazardGfx.set(p.id, g);
    }
    for (const t of f.thermals) {
      alive.add(t.id);
      if (this.hazardGfx.has(t.id)) continue;
      const g = new Graphics();
      g.roundRect(t.x, t.y, t.w, t.h, 0.6).fill({ color: 0xffe08a, alpha: 0.12 });
      for (let y = t.y + 1; y < t.y + t.h; y += 1.6) {
        const cx = t.x + t.w / 2;
        g.moveTo(cx - 0.35, y).lineTo(cx, y + 0.35).lineTo(cx + 0.35, y).stroke({ color: 0xffe08a, width: 0.06, alpha: 0.45 });
      }
      this.hazardLayer.addChildAt(g, 0);
      this.hazardGfx.set(t.id, g);
    }
    for (const [id, g] of this.hazardGfx) {
      if (alive.has(id)) continue;
      g.destroy();
      this.hazardGfx.delete(id);
    }
  }

  /** Trees, hawk shadows, the leader's trace and the drawn path: redrawn each frame. */
  private drawDynamic(f: Flight): void {
    const g = this.dyn.clear();
    // Roost trees.
    for (const t of f.trees) {
      const lit = t.banked;
      const inside = Math.hypot(f.leader.x - t.x, f.leader.y - t.y) <= TUNING.TREE_RADIUS;
      const dashes = 28;
      const spin = this.reducedMotion ? 0 : this.time * 0.4;
      for (let k = 0; k < dashes; k += 2) {
        const a0 = (k / dashes) * Math.PI * 2 + spin;
        const a1 = ((k + 1) / dashes) * Math.PI * 2 + spin;
        g.moveTo(t.x + Math.cos(a0) * TUNING.TREE_RADIUS, t.y + Math.sin(a0) * TUNING.TREE_RADIUS)
          .arc(t.x, t.y, TUNING.TREE_RADIUS, a0, a1)
          .stroke({ color: lit ? 0xffd166 : 0xfff0d0, width: 0.07, alpha: lit ? 0.9 : 0.45 });
      }
      if (inside && !lit && Math.abs(t.sum) > 0.05) {
        const a0 = t.last! - t.sum;
        g.moveTo(t.x + Math.cos(a0) * TUNING.TREE_RADIUS, t.y + Math.sin(a0) * TUNING.TREE_RADIUS)
          .arc(t.x, t.y, TUNING.TREE_RADIUS, a0, t.last!, t.sum < 0)
          .stroke({ color: 0x06ffff, width: 0.16, alpha: 0.9 });
      }
      // The tree: trunk and canopy, lit gold once banked.
      if (lit) g.circle(t.x, t.y + 0.6, 1.5).fill({ color: 0xffd166, alpha: 0.25 + 0.1 * Math.sin(this.time * 4) });
      g.rect(t.x - 0.12, t.y - 1, 0.24, 1.2).fill({ color: DARK });
      for (const [dx, dy, rr] of [
        [0, 0.6, 0.8],
        [-0.55, 0.3, 0.55],
        [0.55, 0.3, 0.55],
        [0, 1.15, 0.55],
      ])
        g.circle(t.x + dx, t.y + dy, rr).fill({ color: lit ? 0x5b3a12 : DARK });
      if (lit) for (let k = 0; k < 6; k++) g.circle(t.x + Math.cos(k) * 0.6, t.y + 0.6 + Math.sin(k * 1.7) * 0.5, 0.08).fill({ color: 0xffe7a0 });
      if (this.tutorialTreeArrow && !lit) {
        const r = TUNING.TREE_RADIUS + 0.6;
        const a0 = this.time * 1.5;
        g.moveTo(t.x + Math.cos(a0) * r, t.y + Math.sin(a0) * r).arc(t.x, t.y, r, a0, a0 + Math.PI * 1.5).stroke({ color: 0x06ffff, width: 0.14, alpha: 0.9 });
        const ah = a0 + Math.PI * 1.5;
        const hx = t.x + Math.cos(ah) * r;
        const hy = t.y + Math.sin(ah) * r;
        const tx = -Math.sin(ah);
        const ty = Math.cos(ah);
        g.poly([hx + tx * 0.5, hy + ty * 0.5, hx + Math.cos(ah) * 0.35, hy + Math.sin(ah) * 0.35, hx - Math.cos(ah) * 0.35, hy - Math.sin(ah) * 0.35]).fill({ color: 0x06ffff });
      }
    }
    // Hawk shadows: fixed to the sky, darkening as the dive comes.
    for (const h of f.hawks) {
      const k = 1 - h.left / h.total;
      g.ellipse(h.spot.x, h.spot.y, TUNING.HAWK_RADIUS, TUNING.HAWK_RADIUS * 0.8).fill({ color: 0x120018, alpha: 0.15 + 0.6 * k });
      g.circle(h.spot.x, h.spot.y, TUNING.HAWK_RADIUS).stroke({ color: 0xff4b4b, width: 0.06, alpha: 0.4 + 0.5 * k });
      // The hawk itself, closing in from above.
      const hy = h.spot.y + (1 - k) * 6;
      g.poly([h.spot.x, hy - 0.3, h.spot.x - 0.9, hy + 0.3, h.spot.x - 0.2, hy + 0.1, h.spot.x, hy + 0.5, h.spot.x + 0.2, hy + 0.1, h.spot.x + 0.9, hy + 0.3]).fill({ color: 0x120018, alpha: 0.3 + 0.6 * k });
    }
    // The leader's bright trace.
    const tr = f.trail;
    const head = tr.length - 1;
    for (let i = head; i > 0 && tr[head].s - tr[i].s < 3.5; i--) {
      const a = 1 - (tr[head].s - tr[i].s) / 3.5;
      g.moveTo(tr[i - 1].x, tr[i - 1].y).lineTo(tr[i].x, tr[i].y).stroke({ color: 0xfff6dc, width: 0.09, alpha: 0.55 * a });
    }
    // A drawn path: a faint dotted trail ahead of the leader.
    const dots = (pts: Point[], alpha: number) => {
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (acc >= 0.35) {
          acc = 0;
          g.circle(pts[i].x, pts[i].y, 0.07).fill({ color: 0xffffff, alpha });
        }
      }
    };
    dots(this.path, 0.6);
    dots(this.drawing, 0.9);
  }

  private drawStrays(f: Flight): void {
    const alive = new Set<number>();
    for (const st of f.strays) {
      alive.add(st.id);
      let p = this.strayParticles.get(st.id);
      if (!p) {
        p = new Particle({ texture: this.strayTex, anchorX: 0.5, anchorY: 0.5 });
        this.strayLayer.addParticle(p);
        this.strayParticles.set(st.id, p);
      }
      const sp = this.toScreen(st, f.camY);
      const bob = this.reducedMotion ? 0 : Math.sin(this.time * 3 + st.id) * 2;
      p.x = sp.x;
      p.y = sp.y + bob;
      const sc = (this.scale * 0.95) / 64;
      p.scaleX = sc * (0.8 + 0.25 * Math.sin(this.time * 9 + st.id));
      p.scaleY = sc;
    }
    for (const [id, p] of this.strayParticles) {
      if (alive.has(id)) continue;
      this.strayLayer.removeParticle(p);
      this.strayParticles.delete(id);
    }
  }

  private drawBirds(f: Flight, dt: number): void {
    const n = f.birds.length;
    while (this.particles.length < n) {
      const p = new Particle({ texture: this.birdTex, anchorX: 0.5, anchorY: 0.5 });
      this.particles.push(p);
      this.birdLayer.addParticle(p);
    }
    while (this.particles.length > n) this.birdLayer.removeParticle(this.particles.pop()!);
    // Turn rate history, for the ripple that runs down the ribbon.
    const heading = Math.atan2(f.vel.y, f.vel.x);
    let d = heading - this.lastHeading;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    this.lastHeading = heading;
    this.turnHistory.unshift(Math.max(-0.3, Math.min(0.3, d)));
    if (this.turnHistory.length > 240) this.turnHistory.pop();
    // Murmuration: the flock swirls into a ball.
    this.murmurBlend += ((f.murmuring ? 1 : 0) - this.murmurBlend) * Math.min(1, dt * 6);
    const s = this.scale;
    const sz = (s * 0.6) / 64;
    for (let i = 0; i < n; i++) {
      let b = f.birds[i];
      const next = i > 0 ? f.birds[i - 1] : { x: b.x, y: b.y + 1 };
      let rot = Math.atan2(-(next.y - b.y), next.x - b.x) + Math.PI / 2;
      if (!this.reducedMotion) {
        // Personal wobble, and a ripple travelling down the ribbon after a sharp turn.
        const ripple = (this.turnHistory[Math.min(this.turnHistory.length - 1, i * 2)] ?? 0) * 2.2;
        const wob = Math.sin(this.time * 2.3 + i * 1.7) * 0.05;
        b = { x: b.x + ripple + wob, y: b.y + Math.cos(this.time * 2.9 + i) * 0.04 };
      }
      if (this.murmurBlend > 0.01) {
        const a = this.time * 3 + i * 2.399;
        const rad = 0.3 + 1.2 * Math.sqrt((i % 37) / 37);
        const ball = { x: f.leader.x + Math.cos(a) * rad, y: f.leader.y - 1 + Math.sin(a * 1.3) * rad * 0.8 };
        b = { x: b.x + (ball.x - b.x) * this.murmurBlend, y: b.y + (ball.y - b.y) * this.murmurBlend };
        rot = a;
      }
      const p = this.particles[i];
      const sp = this.toScreen(b, f.camY);
      p.x = sp.x;
      p.y = sp.y;
      p.rotation = rot;
      const beat = this.reducedMotion ? 1 : 0.65 + 0.35 * Math.abs(Math.sin(this.time * 11 + i * 0.9));
      p.scaleX = sz * (i === 0 ? 1.25 : 1) * beat;
      p.scaleY = sz * (i === 0 ? 1.25 : 1);
    }
  }

  private drawFx(dt: number, camY: number): void {
    const g = this.screenFx.clear();
    const s = this.scale;
    this.fx = this.fx.filter((e) => (e.life += dt) < e.max);
    for (const e of this.fx) {
      const k = e.life / e.max;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.kind === 'feather') e.vy -= 1.5 * dt;
      const p = this.toScreen(e, camY);
      if (e.kind === 'ring') g.circle(p.x, p.y, s * (0.2 + 1.2 * k)).stroke({ color: e.colour, width: 2, alpha: 1 - k });
      else if (e.kind === 'spark') g.circle(p.x, p.y, 2.5 * (1 - k)).fill({ color: e.colour, alpha: 1 - k });
      else {
        const ang = e.rot + k * 6;
        g.ellipse(p.x, p.y, 4, 1.6).fill({ color: e.colour, alpha: 1 - k });
        void ang;
      }
    }
  }
}

/** A small bird silhouette, wings spread, pointing up. With glow > 0, a soft halo for strays. */
function makeBirdTexture(app: Application, colour: number, glow: number): Texture {
  const g = new Graphics();
  if (glow > 0) {
    for (let r = 30; r > 8; r -= 4) g.circle(32, 32, r).fill({ color: 0xfff1b8, alpha: 0.09 * glow });
    g.circle(32, 32, 10).fill({ color: 0xfff6d8, alpha: 0.35 * glow });
  }
  g.poly([32, 14, 36, 26, 60, 34, 38, 34, 34, 50, 32, 46, 30, 50, 26, 34, 4, 34, 28, 26]).fill({ color: colour });
  return app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, 64, 64), resolution: 2 });
}

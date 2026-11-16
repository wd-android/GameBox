import { SCREEN, TUNING } from '../../config/tuning';
import type { Mark, Pt, Wash } from '../../sim/types';

/**
 * Layer 3 (§15.2): claw marks and the bite wash, over the scene AND the interface.
 * Marks are bold cartoon slashes with a slight shadow — clearly a game effect, never a cracked screen.
 */
export class EffectsRenderer {
  ctx: CanvasRenderingContext2D;
  k = 1;
  /** Screen offset of the 390×800 design space inside the canvas (letterboxing) */
  ox = 0;
  oy = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssW: number, cssH: number, dpr: number, k: number, ox: number, oy: number) {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.k = k * dpr;
    this.ox = ox * dpr;
    this.oy = oy * dpr;
  }

  draw(now: number, marks: Mark[], wash: Wash | null, paw: { path: Pt[]; t: number } | null) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.k, 0, 0, this.k, this.ox, this.oy);
    for (const m of marks) this.drawMark(m, now);
    if (paw) this.drawPaw(paw);
    if (wash) this.drawWash(wash, now);
  }

  /** Four roughly parallel tapered strokes, 14 points apart, following the path */
  private drawMark(m: Mark, now: number) {
    const M = TUNING.marks;
    const age = now - m.born;
    let alpha = 1, fresh = 0;
    if (age < M.fresh) fresh = 1 - age / M.fresh;
    else if (age < M.fresh + M.settled) alpha = 0.8;
    else alpha = 0.8 * Math.max(0, 1 - (age - M.fresh - M.settled) / M.fading);
    if (age >= M.fresh && age < M.fresh + M.settled) alpha = 0.8;
    if (alpha <= 0) return;
    const ctx = this.ctx;
    const path = m.path;
    const normals = path.map((p, i) => {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      return { x: -dy / l, y: dx / l };
    });
    for (let line = 0; line < 4; line++) {
      const off = (line - 1.5) * M.spacing;
      const jitter = (line % 2 ? 1 : -1) * 2;
      const pts = path.map((p, i) => ({ x: p.x + normals[i].x * (off + jitter), y: p.y + normals[i].y * (off + jitter) }));
      // Tapered: draw segments with width rising then falling
      for (let i = 0; i < pts.length - 1; i++) {
        const u = i / (pts.length - 2);
        const w = Math.sin(Math.PI * Math.min(1, Math.max(0, u * 1.05))) * 7 + 0.8;
        // Soft shadow
        ctx.globalAlpha = alpha * 0.45;
        ctx.strokeStyle = '#1a0a05';
        ctx.lineWidth = w + 4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(pts[i].x + 2, pts[i].y + 3); ctx.lineTo(pts[i + 1].x + 2, pts[i + 1].y + 3); ctx.stroke();
        // Thin red edge while fresh
        if (fresh > 0) {
          ctx.globalAlpha = fresh;
          ctx.strokeStyle = '#ff2a3d';
          ctx.lineWidth = w + 2.5;
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke();
        }
        // The scratch: bright when fresh, pale when settled
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fresh > 0 ? '#ffffff' : '#f3e9df';
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The paw crossing the screen during the 0.15 s strike */
  private drawPaw(p: { path: Pt[]; t: number }) {
    const ctx = this.ctx;
    const i = Math.min(p.path.length - 1, Math.floor(p.t * (p.path.length - 1)));
    const pt = p.path[i];
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 38, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8a1f'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2a1a12'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(6, 8, 24, 18, -0.5, 0, Math.PI * 2); ctx.fillStyle = '#fff3df'; ctx.fill();
    ctx.restore();
  }

  /** A single saturated red spreading from the bite, holding, then draining from the top down (§9.3) */
  private drawWash(w: Wash, now: number) {
    const W = w.soft ? TUNING.wash.soft : TUNING.wash;
    const age = now - w.born;
    const ctx = this.ctx;
    const maxR = Math.hypot(SCREEN.w, SCREEN.h) + 40;
    ctx.save();
    ctx.globalAlpha = W.peak;
    ctx.fillStyle = TUNING.wash.colour;
    if (age < W.spread) {
      const r = maxR * (age / W.spread);
      ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2); ctx.fill();
    } else if (age < W.spread + W.hold) {
      ctx.fillRect(-50, -50, SCREEN.w + 100, SCREEN.h + 100);
    } else {
      const k = Math.min(1, (age - W.spread - W.hold) / W.drain);
      const top = -50 + (SCREEN.h + 100) * k;
      // Drains from the top downward; opacity eases out too, so there is no hard flash
      ctx.globalAlpha = W.peak * (1 - k * 0.5);
      ctx.fillRect(-50, top, SCREEN.w + 100, SCREEN.h + 100 - top);
    }
    ctx.restore();
  }
}

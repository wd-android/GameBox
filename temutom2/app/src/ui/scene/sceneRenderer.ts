import type { MomentState, SimEvent } from '../../sim/types';
import { SCREEN } from '../../config/tuning';
import { PLACES } from '../../content/places';
import { drawPlace } from './placeArt';
import { drawCat, C } from './catArt';
import { drawObject } from './objects';
import { treatPos } from '../../sim/hand';
import { pointAt } from '../../sim/util';
import { choreBlocked } from '../../sim/chores';
import { schemeTarget } from '../../sim/schemes';

const INK = '#2a1a12';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 6) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function fs(ctx: CanvasRenderingContext2D, fill: string, w = 3) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke(); }
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }

const GARMENT_COLOURS = ['#4fc3f7', '#ffca28', '#ab47bc', '#ef5350', '#5c6bc0', '#ffffff'];

/** Layer 1 (§15.2): background, objects, Temutom, the Houseguest's hand, chore highlights. */
export class SceneRenderer {
  ctx: CanvasRenderingContext2D;
  k = 1;
  doorAnim = 0;
  pops: { x: number; y: number; t: number }[] = [];

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.k = (cssW / SCREEN.w) * dpr;
  }

  onEvent(_s: MomentState, e: SimEvent) {
    if (e.type === 'choreStep' && e.x != null) this.pops.push({ x: e.x, y: e.y!, t: 0 });
  }

  draw(s: MomentState, t: number, dt: number, reduceMotion: boolean) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    // Head-butt: the whole scene nudges 6 points
    const nudge = s.time - s.nudgeAt < 0.35 && !reduceMotion ? Math.sin(((s.time - s.nudgeAt) / 0.35) * Math.PI) * 6 : 0;
    ctx.translate(0, -nudge);
    const pl = PLACES[s.def.place];
    const target = s.doorOpen ? 1 : 0;
    this.doorAnim += (target - this.doorAnim) * Math.min(1, dt * 6);
    const night = s.def.slot === 'dawn' || s.def.slot === 'night';
    drawPlace(ctx, s.def.place, { doorOpen: this.doorAnim, night, cupboardOpen: s.time < s.cupboardOpen, lidClosed: s.time < s.lidClosedUntil });

    const c = s.cat;
    // Scheme target glows faintly while he works it: the player can tap it to stop him
    if (c.scheme) this.schemeGlow(s, t);

    this.drawObjects(s);
    this.drawBowl(s);
    if (s.chore) this.drawChore(s, t);
    this.drawSources(s, t);
    if (c.treat && s.time < c.treat.until) { ell(ctx, c.treat.x, c.treat.y + 4, 9, 6); fs(ctx, '#8d5524', 2); }

    // The cat
    if (c.onScreen && c.display) {
      const inBox = c.lapse?.kind === 'box' && pl.box;
      drawCat(ctx, { x: c.x, y: c.y, scale: c.scale, facing: c.facing, display: c.display, t, reduceMotion, biteAt: s.hand.down ? s.hand : null });
      if (inBox && pl.box) { rr(ctx, pl.box.x - 46, pl.box.y - 30, 92, 40, 4); fs(ctx, '#c79a5b'); }
      if (c.lapse?.kind === 'prey' && !reduceMotion) this.lapseSwirl(c.x, c.y - 140 * c.scale, t);
    }
    if (s.guest && s.guest.phase !== 'out') this.drawGuestHand(s, t);
    if (s.hand.drag?.what === 'pouch') { rr(ctx, s.pouch.x - 22, s.pouch.y - 28, 44, 56, 8); fs(ctx, '#7e57c2'); }
    this.drawPops(dt);
  }

  private schemeGlow(s: MomentState, t: number) {
    const ctx = this.ctx;
    const pl = PLACES[s.def.place];
    const kind = schemeTarget(s.cat.scheme!.id);
    const r = kind === 'cupboard' ? pl.cupboard : kind === 'door' ? pl.door : pl.laptop;
    if (!r) return;
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 30;
    rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 10);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    ctx.restore();
    // Step pips
    for (let i = 0; i < 3; i++) {
      ell(this.ctx, r.x + r.w / 2 - 20 + i * 20, r.y - 16, 6, 6);
      fs(this.ctx, i < s.cat.scheme!.step ? '#00f5f5' : 'rgba(255,255,255,0.4)', 2);
    }
  }

  private drawObjects(s: MomentState) {
    const ctx = this.ctx;
    for (const o of s.objects) {
      if (o.knocked && o.t > 1.2) continue;
      ctx.save();
      const fall = o.knocked ? Math.min(1, o.t / 0.6) : 0;
      ctx.translate(o.x + fall * 30, o.y + fall * fall * 500);
      ctx.scale(4.2, 4.2);
      drawObject(ctx, o.kind, 0, 0, { rot: fall * 3 });
      ctx.restore();
    }
  }

  private drawBowl(s: MomentState) {
    const pl = PLACES[s.def.place];
    if (!pl.bowl) return;
    const ctx = this.ctx;
    const b = pl.bowl;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 6;
    ctx.beginPath(); ctx.moveTo(cx - 50, cy - 12); ctx.lineTo(cx + 50, cy - 12); ctx.lineTo(cx + 36, cy + 20); ctx.lineTo(cx - 36, cy + 20); ctx.closePath();
    fs(ctx, '#29b6f6');
    if (s.time < s.cat.eatUntil + 1) {
      ctx.fillStyle = '#8d5524';
      for (const fx of [-24, -8, 8, 24]) { ell(ctx, cx + fx, cy - 14, 9, 6); ctx.fill(); }
    }
  }

  private drawChore(s: MomentState, t: number) {
    const ctx = this.ctx;
    const ch = s.chore!;
    if (ch.hoover) {
      // Marked path, then the Hoover
      const hv = ch.hoover;
      ctx.save();
      ctx.setLineDash([2, 14]); ctx.lineCap = 'round';
      ctx.beginPath(); hv.path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke();
      ctx.restore();
      // Done part
      ctx.beginPath();
      for (let d = 0; d <= hv.s; d += 6) { const p = pointAt(hv.path, d); if (d === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
      ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
      const p = pointAt(hv.path, hv.s);
      const shake = hv.running ? Math.sin(t * 60) * 1.5 : 0;
      ctx.save(); ctx.translate(p.x + shake, p.y);
      rr(ctx, -30, -10, 60, 18, 6); fs(ctx, '#444');
      rr(ctx, -16, -60, 32, 52, 12); fs(ctx, '#e53935');
      rr(ctx, 4, -120, 8, 64, 4); fs(ctx, '#333');
      ell(ctx, 0, -2, 46, 46); ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(0,245,245,0.8)'; ctx.stroke(); ctx.setLineDash([]);
      if (hv.running) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { const r = 40 + ((t * 80 + i * 18) % 50); ctx.beginPath(); ctx.arc(0, -30, r, -0.5, 0.5); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -30, r, Math.PI - 0.5, Math.PI + 0.5); ctx.stroke(); }
      }
      ctx.restore();
      return;
    }
    const blocked = choreBlocked(s);
    ch.steps.forEach((st, i) => {
      if (ch.kind === 'washing' && st.done) return;
      this.choreItem(s, ch.kind, st.id, st.x, st.y, i, st.done);
      if (i === ch.current) {
        const pulse = 1 + Math.sin(t * 5) * 0.06;
        ctx.save();
        ctx.beginPath(); ctx.arc(st.x, st.y, 40 * pulse, 0, Math.PI * 2);
        ctx.lineWidth = 5; ctx.strokeStyle = blocked ? 'rgba(255,255,255,0.35)' : 'rgba(0,245,245,0.95)';
        if (!blocked) { ctx.shadowColor = '#00f5f5'; ctx.shadowBlur = 14; }
        ctx.setLineDash(blocked ? [6, 6] : []);
        ctx.stroke();
        ctx.restore();
        if (st.progress > 0) {
          ctx.beginPath(); ctx.arc(st.x, st.y, 40, -Math.PI / 2, -Math.PI / 2 + st.progress * Math.PI * 2);
          ctx.lineWidth = 9; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.stroke();
        }
      }
    });
    // Folded pile (washing): a place he may sleep
    if (ch.kind === 'washing') {
      const done = ch.steps.filter((x) => x.done).length;
      for (let i = 0; i < done; i++) { rr(ctx, 296, 650 - i * 9, 66, 12, 4); fs(ctx, GARMENT_COLOURS[i % 6], 2); }
    }
  }

  private choreItem(s: MomentState, kind: string, id: string, x: number, y: number, i: number, done: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'email') {
      rr(ctx, -40, -22, 80, 44, 10); fs(ctx, done ? '#c5e1a5' : id === 'send' ? '#1e88e5' : '#eceff1', 2.5);
      ctx.fillStyle = id === 'send' ? '#fff' : INK; ctx.font = '600 14px "Readex Pro", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const st = s.chore!.steps.find((q) => q.id === id)!;
      ctx.fillText(st.label, 0, 1);
    } else if (kind === 'washing') {
      ctx.rotate((i % 3 - 1) * 0.3);
      ctx.beginPath(); ctx.moveTo(-34, -6); ctx.quadraticCurveTo(-20, -30, 10, -20); ctx.quadraticCurveTo(38, -20, 30, 6); ctx.quadraticCurveTo(26, 28, -6, 22); ctx.quadraticCurveTo(-40, 20, -34, -6);
      fs(ctx, GARMENT_COLOURS[i % 6], 2.5);
    } else if (kind === 'tidy') {
      if (done) { ctx.restore(); return; }
      ctx.scale(4.4, 4.4);
      const k = { remote: 'remote', cup: 'mug', book: 'stapler', candle: 'candle', coaster: 'coaster' }[id] ?? 'mug';
      drawObject(ctx, k, 0, 4);
    } else if (kind === 'coffee') {
      if (id === 'kettle') { rr(ctx, -24, -34, 48, 52, 12); fs(ctx, '#90a4ae'); rr(ctx, 18, -24, 14, 8, 3); fs(ctx, '#90a4ae', 2); ctx.beginPath(); ctx.arc(0, -36, 12, Math.PI, 0); ctx.lineWidth = 4; ctx.stroke(); }
      else if (id === 'mug' || id === 'pour') {
        if (id === 'mug') { rr(ctx, -20, -22, 36, 40, 6); fs(ctx, '#fff3e0'); ctx.beginPath(); ctx.arc(18, -2, 9, -1.4, 1.4); ctx.lineWidth = 4; ctx.stroke(); if (s.chore!.steps[4].done) { ell(ctx, -2, -20, 15, 4); fs(ctx, '#6d4c41', 1.5); } }
      }
      else if (id === 'jar') { rr(ctx, -20, -30, 40, 50, 8); fs(ctx, '#8d6e63'); rr(ctx, -22, -36, 44, 10, 3); fs(ctx, '#5d4037', 2); }
      else if (id === 'spoon') { ctx.rotate(-0.5); rr(ctx, -3, -28, 6, 40, 3); fs(ctx, '#cfd8dc', 2); ell(ctx, 0, -32, 8, 11); fs(ctx, '#cfd8dc', 2); }
    }
    ctx.restore();
  }

  private drawSources(s: MomentState, t: number) {
    const ctx = this.ctx;
    const pl = PLACES[s.def.place];
    // Wand: in its drawer/basket, or in play
    if (s.wand) {
      const w = s.wand;
      const base = w.active ? { x: w.x + 40, y: w.y + 90 } : { x: w.x + 10, y: w.y + 20 };
      const tip = w.active ? { x: w.x, y: w.y } : { x: w.x - 18, y: w.y - 34 };
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#e1c699'; ctx.stroke();
      ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(Math.sin(t * 9) * 0.4);
      for (const [c2, a] of [['#e040fb', -0.4], ['#00f5f5', 0], ['#ffca28', 0.4]] as [string, number][]) {
        ctx.save(); ctx.rotate(a); ell(ctx, 0, -16, 6, 16); fs(ctx, c2, 2); ctx.restore();
      }
      ctx.restore();
      if (!w.active && s.cat.demand?.kind === 'play' && s.cat.display?.tell === 'play') this.hint(w.x, w.y);
    }
    if (pl.pouch && !s.pouch.carried) {
      rr(ctx, s.pouch.x - 20, s.pouch.y - 26, 40, 52, 8); fs(ctx, '#9575cd');
      ctx.fillStyle = '#fff'; ctx.font = '700 11px "Readex Pro", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FISH', s.pouch.x, s.pouch.y + 4);
    }
    // Treats at the bottom edge
    if (s.def.systems.treats) for (let i = 0; i < 2; i++) {
      const p = s.hand.drag?.what === `treat${i}` ? { x: s.hand.drag.x, y: s.hand.drag.y } : treatPos(s, i);
      if (i >= s.treatsLeft && s.hand.drag?.what !== `treat${i}`) { ell(ctx, p.x, p.y, 18, 18); ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke(); ctx.setLineDash([]); continue; }
      ell(ctx, p.x, p.y, 20, 20); fs(ctx, 'rgba(24,0,56,0.75)', 2);
      ell(ctx, p.x, p.y, 10, 7); fs(ctx, '#8d5524', 2);
    }
  }

  private hint(x: number, y: number) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke(); ctx.setLineDash([]);
  }

  private drawGuestHand(s: MomentState, t: number) {
    const ctx = this.ctx;
    const g = s.guest!;
    const side = g.side;
    const from = { x: side > 0 ? -40 : 430, y: g.y + 120 };
    // Sleeve
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(g.x - side * 30, g.y + 24);
    ctx.lineWidth = 50; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 44; ctx.strokeStyle = '#7cb342'; ctx.stroke();
    // A simple hand: the visitor is drawn simply
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(side > 0 ? -0.5 : 0.5 + Math.PI);
    if (g.phase === 'stroking') ctx.translate(Math.sin(t * 10) * 4, 0);
    rr(ctx, -26, -18, 46, 36, 16); fs(ctx, '#f1c7a5');
    for (let i = 0; i < 4; i++) { rr(ctx, 14, -16 + i * 9, 24, 9, 4.5); fs(ctx, '#f1c7a5', 2); }
    if (g.bitten > 0) {
      // A plaster for each strike
      for (let i = 0; i < g.bitten; i++) { ctx.save(); ctx.rotate(0.6 - i * 0.5); rr(ctx, -14, -5 + i * 10, 30, 10, 3); fs(ctx, '#f5c08a', 1.5); ctx.restore(); }
    }
    ctx.restore();
  }

  private lapseSwirl(x: number, y: number, t: number) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4);
    ctx.beginPath(); for (let i = 0; i < 30; i++) { const a = i * 0.5; ctx.lineTo(Math.cos(a) * i * 0.6, Math.sin(a) * i * 0.6); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  }

  private drawPops(dt: number) {
    const ctx = this.ctx;
    for (const p of this.pops) {
      p.t += dt;
      const k = p.t / 0.6;
      ctx.globalAlpha = 1 - k;
      ell(ctx, p.x, p.y - k * 20, 22, 22); ctx.fillStyle = '#00f5a0'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x - 9, p.y - k * 20); ctx.lineTo(p.x - 2, p.y + 7 - k * 20); ctx.lineTo(p.x + 11, p.y - 8 - k * 20); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.pops = this.pops.filter((p) => p.t < 0.6);
    void C;
  }
}

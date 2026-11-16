import type { ShiftState, SimEvent, StaffState, TargetRef } from '../sim/types';
import { STAFF } from '../content/staff';
import { drawRoomBack } from './art/rooms';
import { drawBox, drawBoxFront, drawCat } from './art/cat';
import { drawDog, drawHoover, drawPerson } from './art/people';
import { drawCrown, drawDemandIcon, drawObject } from './art/objects';
import { INK } from './art/palette';
import { matchingSpot } from '../sim/demands';
import { schemeSpots } from '../sim/shift';
import { activeSpots, dist, spot } from '../sim/util';
import { hooverData } from '../sim/threats/hoover';
import { dogData } from '../sim/threats/dog';
import { brainPresent } from '../sim/brainCell';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: 'spark' | 'drop' | 'confetti' | 'shard' | 'dust' | 'heart'; col: string; r: number }
interface Floater { x: number; y: number; text: string; life: number; col: string }

export interface RenderOpts {
  selected: TargetRef | null;
  reduceMotion: boolean;
  time: number;
  teach: string | null;
  tapRing: { x: number; y: number; t: number } | null;
}

const ROOM_W = 100;

export class RoomRenderer {
  ctx: CanvasRenderingContext2D;
  scale = 1;
  w = 0;
  h = 0;
  particles: Particle[] = [];
  floaters: Floater[] = [];
  shake = 0;
  crackles: { x: number; y: number; t: number; kind: string }[] = [];
  pops: { x: number; y: number; t: number }[] = [];
  crownDrop = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.w = cssW;
    this.h = cssH;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.scale = (cssW / ROOM_W) * dpr;
  }

  toRoom(px: number, py: number) {
    const s = this.w / ROOM_W;
    return { x: px / s, y: py / s };
  }

  // -------------------------------------------------------------------------
  // Hit testing (min. touch target 56 pt is respected by generous radii)

  hit(s: ShiftState, px: number, py: number): TargetRef | null {
    const p = this.toRoom(px, py);
    for (const o of s.objects) {
      if (o.knocked) continue;
      const sp = spot(s, o.spot);
      const ox = sp.x + (o.slot - ((sp.slots ?? 1) - 1) / 2) * 7;
      if (Math.hypot(p.x - ox, p.y - (sp.y - 3)) < 6.5) return { kind: 'object', id: o.id };
    }
    if (s.threat?.id === 'dog') {
      const d = dogData(s.threat);
      const dx = Math.min(80, Math.max(18, d.x));
      if (d.present && p.x > dx - 18 && p.x < dx + 18 && p.y > d.y - 30 && p.y < d.y + 3) return { kind: 'dog' };
    }
    for (const m of s.staff) {
      if (!m.present) continue;
      const seated = !!m.seatedAt;
      const box = seated ? { l: m.x - 10, r: m.x + 12, t: m.y - 34, b: m.y + 12 } : { l: m.x - 7, r: m.x + 7, t: m.y - 50, b: m.y + 2 };
      if (p.x > box.l && p.x < box.r && p.y > box.t && p.y < box.b) {
        // A tap right on a free spot inside a standing person still goes to the spot
        return { kind: 'staff', id: m.id };
      }
    }
    let best: string | null = null;
    let bd = 11;
    for (const sp of activeSpots(s)) {
      const d = Math.hypot(sp.x - p.x, sp.y - p.y);
      if (d < bd) { bd = d; best = sp.id; }
    }
    return best ? { kind: 'spot', id: best } : null;
  }

  // -------------------------------------------------------------------------
  // Effects

  onEvent(s: ShiftState, e: SimEvent) {
    const c = s.cat;
    const at = (m?: StaffState) => (m ? { x: m.x, y: m.y - (m.seatedAt ? 32 : 50) } : { x: c.x, y: c.y - 20 });
    const staff = e.staff ? s.staff.find((m) => m.id === e.staff) : undefined;
    switch (e.type) {
      case 'demandMet': this.pops.push({ x: c.x, y: c.y - 30, t: 0 }); this.burst(c.x, c.y - 28, 'spark', 14, '#00f5a0'); break;
      case 'demandExpired': this.crackles.push({ x: c.x, y: c.y - 30, t: 0, kind: e.kind ?? '' }); break;
      case 'outburst': this.shake = 0.5; this.burst(c.x, c.y - 8, 'dust', 18, '#ffb25a'); break;
      case 'bite': if (staff) this.float(at(staff), 'YELP!', '#ff4d6d'); break;
      case 'smack': this.shake = 0.2; if (staff) this.float(at(staff), 'smack', '#ffffff'); break;
      case 'knocked': this.shake = 0.25; break;
      case 'dogBroke': this.shake = 0.25; this.float({ x: e.x ?? c.x, y: (e.y ?? c.y) - 8 }, 'wag', '#ffffff'); break;
      case 'throneClaimed': this.crownDrop = 1; this.burst(c.x, c.y - 24, 'confetti', 40, ''); break;
      case 'sprayed': this.burst(c.x, c.y - 14, 'drop', 22, '#5fd0ff'); break;
      case 'lapse': this.burst(c.x, c.y - 24, 'spark', 6, '#ffffff'); break;
      case 'rewarded': if (staff) this.burst(staff.x, staff.y - 30, 'heart', 5, '#ff6f91'); break;
      case 'punished': if (staff) this.float(at(staff), 'noted', '#ffd54a'); break;
      case 'evicted': this.float({ x: c.x, y: c.y - 24 }, 'lifted', '#ffffff'); break;
      case 'dogAteIt': this.float({ x: c.x, y: c.y - 30 }, 'STOLEN', '#ff4d6d'); break;
      case 'dogYelp': this.float({ x: e.x ?? c.x, y: (e.y ?? c.y) - 30 }, 'yip!', '#ffffff'); break;
      case 'schemeStep': this.burst(c.x, c.y - 20, 'spark', 8, '#00f5f5'); break;
      case 'schemeDone': this.burst(c.x, c.y - 20, 'confetti', 20, ''); break;
      case 'guestWon': this.burst(c.x, c.y - 20, 'heart', 18, '#ff6f91'); break;
      case 'compliance': if (staff && e.value != null && s.def.systems.compliance) this.float({ x: staff.x + 6, y: staff.y - (staff.seatedAt ? 36 : 54) }, `${e.kind} ${Math.round(e.value)}`, '#00f5f5'); break;
      default:
    }
  }

  private float(p: { x: number; y: number }, text: string, col: string) {
    this.floaters.push({ x: p.x, y: p.y, text, life: 1.4, col });
  }

  private burst(x: number, y: number, kind: Particle['kind'], n: number, col: string) {
    const conf = ['#00f5f5', '#e040fb', '#ffca28', '#00f5a0', '#ff6f91'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'confetti' ? 20 + Math.random() * 30 : kind === 'drop' ? 15 + Math.random() * 20 : 10 + Math.random() * 18;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'confetti' ? 20 : 6),
        life: 0.9 + Math.random() * 0.5, max: 1.4, kind, col: col || conf[i % conf.length], r: kind === 'confetti' ? 1 : 0.8,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Draw

  draw(s: ShiftState, o: RenderOpts, dt: number) {
    const ctx = this.ctx;
    const t = o.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let sx = 0, sy = 0;
    if (this.shake > 0 && !o.reduceMotion) {
      sx = (Math.random() - 0.5) * this.shake * 3;
      sy = (Math.random() - 0.5) * this.shake * 3;
    }
    this.shake = Math.max(0, this.shake - dt * 1.5);
    ctx.setTransform(this.scale, 0, 0, this.scale, sx * this.scale, sy * this.scale);

    const seated = new Set(s.staff.filter((m) => m.seatedAt).map((m) => m.seatedAt!));
    const night = s.def.slot === 'night' || s.def.slot === 'dawn';
    drawRoomBack(ctx, s.room.id, { doors: s.doors, bowlFull: s.bowl.full > 0, night, seated });

    this.drawSpots(s, o, t);
    if (s.hasBox) { const b = spot(s, 'box'); drawBox(ctx, b.x, b.y); }
    this.drawBowl(s);
    this.drawObjects(s, t);

    // Entities sorted by depth
    type Ent = { y: number; draw: () => void };
    const ents: Ent[] = [];
    for (const m of s.staff) if (m.present) ents.push({ y: m.seatedAt ? m.y - 1 : m.y, draw: () => this.drawStaff(s, m, o, t) });
    const c = s.cat;
    const owner = c.sittingOn ? s.staff.find((m) => m.id === c.sittingOn) : null;
    const catY = owner ? owner.y + 0.5 : c.heldBy ? 200 : c.y;
    ents.push({ y: catY, draw: () => this.drawTheCat(s, o, t, owner ?? null) });
    if (s.threat?.id === 'dog') {
      const d = dogData(s.threat);
      if (d.present) ents.push({ y: d.y, draw: () => drawDog(ctx, Math.min(80, Math.max(18, d.x)), d.y, { facing: d.x > 70 ? -1 : d.x < 30 ? 1 : s.cat.x < d.x ? -1 : 1, mode: d.mode, t, walking: dist(d, spot(s, d.spot)) > 1, reduceMotion: o.reduceMotion }) });
    }
    if (s.threat?.id === 'hoover') {
      const h = hooverData(s.threat);
      if (h.state === 'running' || h.state === 'stopped') ents.push({ y: h.y, draw: () => drawHoover(ctx, h.x, h.y, h.state === 'running', t) });
    }
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();
    if (s.hasBox && c.lapse === 'box' && c.action === 'lapse') { const b = spot(s, 'box'); drawBoxFront(ctx, b.x, b.y); }

    this.drawStareBeam(s);
    this.drawBubbles(s, t);
    this.drawMarks(s);
    this.drawFx(dt, o.reduceMotion);
    if (o.tapRing) {
      const k = o.tapRing.t;
      ctx.beginPath();
      ctx.arc(o.tapRing.x, o.tapRing.y, 3 + k * 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,245,245,${1 - k})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    if (o.selected) this.drawSelection(s, o.selected, t);
  }

  private drawSpots(s: ShiftState, o: RenderOpts, t: number) {
    const ctx = this.ctx;
    const want = new Set(s.demands.flatMap((d) => matchingSpot(s, d)));
    const glow = new Set(schemeSpots(s));
    for (const sp of activeSpots(s)) {
      if (sp.kind === 'box') continue;
      const isThrone = sp.id === s.room.throne;
      if (glow.has(sp.id)) {
        const r = 6 + Math.sin(t * 6) * 1.2;
        const g = ctx.createRadialGradient(sp.x, sp.y - 2, 0, sp.x, sp.y - 2, r * 1.6);
        g.addColorStop(0, 'rgba(0,245,245,0.65)');
        g.addColorStop(1, 'rgba(0,245,245,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sp.x, sp.y - 2, r * 1.6, 0, Math.PI * 2); ctx.fill();
        // Sparkles
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 3; i++) {
          const a = t * 2 + i * 2.1;
          ctx.fillRect(sp.x + Math.cos(a) * 5, sp.y - 4 + Math.sin(a) * 3, 0.8, 0.8);
        }
      }
      if (want.has(sp.id)) {
        // Matching spot: dashed ring (shape, not only colour)
        ctx.save();
        ctx.setLineDash([1.6, 1.2]);
        ctx.lineDashOffset = -t * 4;
        ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 7, 2.6, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.restore();
      } else if (sp.kind === 'floor' || sp.kind === 'hide' || sp.kind === 'socket' || sp.kind === 'door' || sp.kind === 'bowl' || sp.kind === 'toy') {
        ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 2.2, 0.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
      }
      if (sp.kind === 'hide' && s.def.threat?.id === 'hoover') {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 3px "Readex Pro", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('hide', sp.x, sp.y + 4);
      }
      if (isThrone && s.def.systems.verbs.includes('sitOn')) {
        const claimed = s.throne.claimedBefore || s.throne.claimedNow;
        const lift = this.crownDrop > 0 ? this.crownDrop * 10 : 0;
        if (this.crownDrop > 0) this.crownDrop = Math.max(0, this.crownDrop - 0.02);
        drawCrown(ctx, sp.x + 9, sp.y - 6 - lift, 0.8, !claimed);
        if (!claimed && s.throne.progress > 0) {
          const k = Math.min(1, s.throne.progress / 12);
          ctx.beginPath(); ctx.arc(sp.x + 9, sp.y - 8, 5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
          ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 0.9; ctx.stroke();
        }
      }
    }
    void o;
  }

  private drawBowl(s: ShiftState) {
    const b = s.room.spots.find((p) => p.kind === 'bowl');
    if (!b) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(b.x + 5, b.y + 2);
    ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(5, -2); ctx.lineTo(3.6, 1.4); ctx.lineTo(-3.6, 1.4); ctx.closePath();
    ctx.fillStyle = '#29b6f6'; ctx.fill(); ctx.lineWidth = 0.6; ctx.strokeStyle = INK; ctx.stroke();
    if (s.bowl.full > 0) {
      ctx.fillStyle = '#8d5524';
      for (const fx of [-3, -1, 1, 3]) { ctx.beginPath(); ctx.ellipse(fx, -2.4, 1.2, 0.9, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  private drawObjects(s: ShiftState, t: number) {
    const ctx = this.ctx;
    for (const o of s.objects) {
      const sp = spot(s, o.spot);
      const ox = sp.x + (o.slot - ((sp.slots ?? 1) - 1) / 2) * 7;
      if (!o.knocked) {
        drawObject(ctx, o.kind, ox, sp.y);
        continue;
      }
      // Falling, then lying where it landed
      const floorY = Math.max(sp.y + 22, 60 + (o.id % 3) * 4);
      const k = Math.min(1, o.t / 0.5);
      const y = sp.y + (floorY - sp.y) * k * k;
      const x = ox + k * 6;
      if (o.t > 8) continue;
      ctx.save();
      if (o.t > 6) ctx.globalAlpha = 1 - (o.t - 6) / 2;
      drawObject(ctx, o.kind, x, y, { broken: k >= 1 && isBreakable(o.kind), rot: k < 1 ? k * 4 : 1.4 });
      ctx.restore();
      void t;
    }
  }

  private drawStaff(s: ShiftState, m: StaffState, o: RenderOpts, t: number) {
    const c = s.cat;
    const prof = STAFF[m.id];
    const seated = !!m.seatedAt;
    const facing: 1 | -1 = m.mode === 'routine' && !m.job ? m.facing : c.x < m.x ? -1 : 1;
    let reach: { x: number; y: number } | null = null;
    if (m.mode === 'stroking') reach = { x: Math.abs(c.x - m.x) - 2, y: c.y - m.y - 14 + Math.sin(t * 8) * 1.2 };
    if (m.mode === 'holding') reach = { x: Math.abs(c.x - m.x), y: c.y - m.y + 10 };
    if (m.mode === 'evicting') reach = { x: Math.abs(c.x - m.x), y: c.y - m.y - 6 };
    if (m.mode === 'fussingDog' && s.threat?.id === 'dog') { const d = dogData(s.threat); reach = { x: Math.abs(d.x - m.x) - 2, y: d.y - m.y - 22 + Math.sin(t * 8) }; }
    const over = s.def.systems.band && c.attention > s.band.centre + s.band.halfWidth;
    const highlight = (m.mode === 'stroking' || m.mode === 'holding') && (over || o.teach === 'smack');
    const step = m.routine[m.routineIdx];
    drawPerson(this.ctx, m.x, m.y, prof, {
      facing, seated, walking: m.mode !== 'routine' ? (m.job?.phase === 'walk') : !!step && dist(m, s.room.points[step.at] ?? s.dynPoints[step.at] ?? m) > 1,
      mode: m.mode, t, reach, highlightHand: highlight, sprayBottle: m.mode === 'spraying' || (s.def.systems.morale && s.morale < 25),
      task: m.mode === 'routine' ? step?.task : undefined, reduceMotion: o.reduceMotion,
    });
  }

  private drawTheCat(s: ShiftState, o: RenderOpts, t: number, owner: StaffState | null) {
    const c = s.cat;
    let x = c.x, y = c.y;
    if (owner) { x = owner.x + 1; y = owner.y - 3; }
    const outside = s.def.systems.band && !c.inBand;
    const ctx = this.ctx;
    // Outburst / zoomies: blur ring
    if (c.action === 'outburst' && c.outburst === 'zoomies' && !o.reduceMotion) {
      const a = t * 14;
      x += Math.cos(a) * 8; y += Math.sin(a) * 3;
    }
    drawCat(ctx, x, y, {
      facing: c.facing, action: c.action, t,
      eyesApart: s.def.systems.brainCell && !brainPresent(s),
      content: s.def.systems.band && c.inBand && (c.action === 'idle' || c.action === 'sitting'),
      lash: outside ? 1 : 0.15,
      mouthOpen: c.screaming ? 0.6 + Math.sin(t * 20) * 0.3 : c.action === 'outburst' ? 0.8 : 0,
      puffed: c.action === 'outburst',
      flat: c.action === 'stunned',
      inBox: c.lapse === 'box' && c.action === 'lapse',
      held: !!c.heldBy,
      reduceMotion: o.reduceMotion,
    }, c.heldBy ? 0.9 : 1);
    // Scream lines
    if (c.screaming) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      const hx = x + c.facing * 7, hy = y - 13;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 1.4 - Math.PI * 0.7 + (c.facing < 0 ? Math.PI : 0);
        const r0 = 7 + ((t * 30 + i * 3) % 6);
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0);
        ctx.lineTo(hx + Math.cos(a) * (r0 + 3), hy + Math.sin(a) * (r0 + 3));
        ctx.stroke();
      }
      ctx.restore();
    }
    // Lapse spiral
    if (c.action === 'lapse' || (c.lapse && c.action === 'moving')) {
      ctx.save();
      ctx.translate(x + c.facing * 5, y - 25);
      ctx.rotate(t * 4);
      ctx.beginPath();
      for (let i = 0; i < 30; i++) { const a = i * 0.5; ctx.lineTo(Math.cos(a) * i * 0.12, Math.sin(a) * i * 0.12); }
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.restore();
    }
    // Staring: wide eyes; draw nothing extra here (beam drawn separately)
  }

  private drawStareBeam(s: ShiftState) {
    const c = s.cat;
    if (c.action !== 'staring' || !c.stareTarget) return;
    const ctx = this.ctx;
    let tx: number, ty: number;
    if (c.stareTarget.kind === 'staff') {
      const id = c.stareTarget.id;
      const m = s.staff.find((x) => x.id === id);
      if (!m) return;
      tx = m.x; ty = m.y - (m.seatedAt ? 30 : 46);
    } else if (c.stareTarget.kind === 'dog' && s.threat?.id === 'dog') {
      const d = dogData(s.threat); tx = d.x + 10; ty = d.y - 22;
    } else return;
    const k = 1 - c.stareT / 2;
    ctx.save();
    ctx.setLineDash([1, 2]);
    ctx.beginPath(); ctx.moveTo(c.x + c.facing * 6, c.y - 15); ctx.lineTo(tx, ty);
    ctx.strokeStyle = `rgba(201,232,90,${0.4 + k * 0.5})`;
    ctx.lineWidth = 0.6 + k * 0.6;
    ctx.stroke();
    ctx.restore();
    // Progress ring around the target
    ctx.beginPath(); ctx.arc(tx, ty, 5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.strokeStyle = '#c9e85a'; ctx.lineWidth = 1; ctx.stroke();
  }

  private drawBubbles(s: ShiftState, t: number) {
    const ctx = this.ctx;
    const c = s.cat;
    const n = s.demands.length;
    s.demands.forEach((d, i) => {
      const bx = c.x + (n === 2 ? (i === 0 ? -9 : 9) : 0);
      const by = Math.max(14, c.y - 34) + Math.sin(t * 2 + i) * 0.6;
      const k = d.patience / d.maxPatience;
      // Thought dots
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
      for (const [dx, dy, r] of [[0, 9, 0.9], [-0.5, 6, 1.4]] as [number, number, number][]) {
        ctx.beginPath(); ctx.arc(c.x + (bx - c.x) * 0.4 + dx, by + dy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // Bubble
      const urgent = k < 0.3;
      ctx.beginPath(); ctx.arc(bx, by, 6.4, 0, Math.PI * 2);
      ctx.fillStyle = urgent ? '#ffe0e6' : '#ffffff'; ctx.fill(); ctx.lineWidth = 0.7; ctx.stroke();
      // Patience ring
      ctx.beginPath(); ctx.arc(bx, by, 7.6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.strokeStyle = urgent ? '#ff4d6d' : '#00c2c2'; ctx.lineWidth = 1.3; ctx.stroke();
      drawDemandIcon(ctx, d.kind, bx, by, 1);
      if (d.kind === 'door' && d.wantOpen !== undefined) {
        ctx.fillStyle = INK; ctx.font = 'bold 2.6px "Readex Pro", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(d.wantOpen ? 'OPEN' : 'SHUT', bx, by + 5.4);
      }
      if (d.need > 1) {
        ctx.fillStyle = INK; ctx.font = 'bold 3px "Readex Pro", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`×${d.need}`, bx + 5, by - 4);
      }
    });
  }

  private drawMarks(s: ShiftState) {
    const ctx = this.ctx;
    for (const m of s.staff) {
      if (!m.present || !m.mark) continue;
      const x = m.x + 1, y = m.y - (m.seatedAt ? 38 : 56);
      const k = Math.min(1, m.mark.t * 3);
      ctx.save();
      ctx.translate(x, y - (1 - k) * 3);
      ctx.globalAlpha = k;
      ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
      const kind = m.mark.kind;
      ctx.fillStyle = kind === 'tick' ? '#00f5a0' : kind === 'question' ? '#ffca28' : kind === 'heart' ? '#ff6f91' : kind === 'yelp' ? '#ff4d6d' : '#ffffff';
      ctx.fill(); ctx.lineWidth = 0.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
      if (kind === 'tick') { ctx.beginPath(); ctx.moveTo(-1.6, 0); ctx.lineTo(-0.4, 1.3); ctx.lineTo(1.8, -1.3); ctx.stroke(); }
      else {
        ctx.font = 'bold 5px "Readex Pro", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(kind === 'question' ? '?' : kind === 'heart' ? '♥' : kind === 'yelp' ? '!' : 'z', 0, 0.3);
      }
      ctx.restore();
    }
  }

  private drawSelection(s: ShiftState, sel: TargetRef, t: number) {
    const ctx = this.ctx;
    let x = 0, y = 0, r = 7;
    if (sel.kind === 'staff') { const m = s.staff.find((q) => q.id === sel.id); if (!m) return; x = m.x; y = m.y - (m.seatedAt ? 16 : 24); r = 14; }
    else if (sel.kind === 'object') { const ob = s.objects.find((q) => q.id === sel.id); if (!ob) return; const sp = spot(s, ob.spot); x = sp.x + (ob.slot - ((sp.slots ?? 1) - 1) / 2) * 7; y = sp.y - 3; r = 5; }
    else if (sel.kind === 'dog' && s.threat?.id === 'dog') { const d = dogData(s.threat); x = d.x; y = d.y - 14; r = 16; }
    else return;
    ctx.save();
    ctx.setLineDash([2, 1.4]);
    ctx.lineDashOffset = -t * 6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f5f5'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }

  private drawFx(dt: number, reduce: boolean) {
    const ctx = this.ctx;
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.kind === 'confetti' ? 40 : p.kind === 'drop' ? 60 : 20) * dt;
      p.vx *= 0.98;
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.min(1, p.life / 0.4);
      ctx.fillStyle = p.col;
      if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 10); ctx.fillRect(-0.8, -0.4, 1.6, 0.8); ctx.restore(); }
      else if (p.kind === 'heart') { ctx.font = '3.5px sans-serif'; ctx.fillText('♥', p.x, p.y); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'dust' ? 1.6 : p.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
    if (reduce) this.particles = this.particles.slice(-20);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= dt * 6;
      ctx.globalAlpha = Math.min(1, f.life / 0.5);
      ctx.font = 'bold 4px "Readex Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    this.floaters = this.floaters.filter((f) => f.life > 0);
    // Demand met: bubble bursts into a tick
    for (const p of this.pops) {
      p.t += dt;
      const k = p.t / 0.6;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6 + k * 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00f5a0'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x - 0.8, p.y + 2.4); ctx.lineTo(p.x + 3.4, p.y - 2.6); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.pops = this.pops.filter((p) => p.t < 0.6);
    // Demand expired: red bubble that cracks
    for (const cr of this.crackles) {
      cr.t += dt;
      const k = cr.t / 0.9;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.arc(cr.x, cr.y, 6.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4d6d'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cr.x - 1, cr.y - 6.4); ctx.lineTo(cr.x + 1, cr.y - 2); ctx.lineTo(cr.x - 1.4, cr.y + 1); ctx.lineTo(cr.x + 0.6, cr.y + 6.4);
      ctx.lineWidth = 0.8; ctx.stroke();
      drawDemandIcon(ctx, cr.kind, cr.x, cr.y + k * 6, 0.8);
    }
    ctx.globalAlpha = 1;
    this.crackles = this.crackles.filter((c) => c.t < 0.9);
  }
}

function isBreakable(kind: string) {
  return ['mug', 'egg', 'tomato', 'vase', 'photoFrame', 'snowGlobe', 'glasses', 'plantPot', 'perfume', 'figurine'].includes(kind);
}

import { DOG, INK, LINE } from './palette';
import type { StaffProfile } from '../../content/staff';

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}
function fs(ctx: CanvasRenderingContext2D, fill: string, w = LINE) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke();
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export interface PersonPose {
  facing: 1 | -1;
  seated: boolean;
  walking: boolean;
  mode: string;
  t: number;
  /** Where the hand reaches (relative), for stroking / holding */
  reach: { x: number; y: number } | null;
  highlightHand: boolean;
  sprayBottle: boolean;
  task?: string;
  reduceMotion: boolean;
}

/**
 * Staff are drawn simply: big legs and laps, hands and ankles, a small head near the top.
 * That is how he sees them. Anchor (x, y) is the feet (standing) or the seat (seated).
 */
export function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, prof: StaffProfile, p: PersonPose) {
  const c = prof.colour;
  const t = p.reduceMotion ? 0 : p.t;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.facing, 1);
  if (p.mode === 'recoiling') ctx.rotate(-0.12 * Math.sin(Math.min(1, t * 6) * Math.PI));

  if (p.seated) {
    // Lap: thighs horizontal, shins down
    ell(ctx, 0, 1, 10, 2.4);
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1;
    rr(ctx, -6, -4, 15, 5.5, 2.5); fs(ctx, c.legs);
    rr(ctx, 5.5, -1, 4.5, 12, 2); fs(ctx, c.legs);
    ell(ctx, 8.5, 11.5, 3.4, 1.6); fs(ctx, '#2f2a28', 0.6);
    // Torso, leaning back
    rr(ctx, -8, -24, 9, 22, 4); fs(ctx, c.top);
    drawHeadPerson(ctx, -3.5, -28.5, c, p, t);
    drawArm(ctx, -2.5, -19, p, c, true);
  } else {
    const stride = p.walking ? Math.sin(t * 9) * 3 : 0;
    ell(ctx, 0, 0.5, 7, 1.8);
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1;
    // Legs and ankles (what he mostly sees)
    rr(ctx, -4.6 + stride * 0.3, -20, 4.2, 20, 1.8); fs(ctx, c.legs);
    rr(ctx, 0.6 - stride * 0.3, -20, 4.2, 20, 1.8); fs(ctx, c.legs);
    ell(ctx, -2.2 + stride * 0.4, -0.6, 3, 1.4); fs(ctx, '#2f2a28', 0.6);
    ell(ctx, 3.2 - stride * 0.4, -0.6, 3, 1.4); fs(ctx, '#2f2a28', 0.6);
    // Torso
    rr(ctx, -5.5, -40, 11.5, 22, 4); fs(ctx, c.top);
    drawHeadPerson(ctx, 0.4, -44.5, c, p, t);
    drawArm(ctx, 3, -36, p, c, false);
  }
  ctx.restore();
}

function drawHeadPerson(ctx: CanvasRenderingContext2D, hx: number, hy: number, c: StaffProfile['colour'], p: PersonPose, t: number) {
  ell(ctx, hx, hy, 4.4, 4.8); fs(ctx, c.skin);
  // Hair
  ctx.beginPath();
  ctx.ellipse(hx - 0.4, hy - 2.2, 4.6, 3.2, 0, Math.PI, Math.PI * 2);
  ctx.fillStyle = c.hair; ctx.fill(); ctx.lineWidth = LINE; ctx.strokeStyle = INK; ctx.stroke();
  // Eyes: looking at him when attending
  ctx.fillStyle = INK;
  const look = p.mode === 'attending' || p.mode === 'asking' || p.mode === 'stroking' || p.mode === 'holding' || p.mode === 'evicting' ? 1.2 : 0.4;
  const blink = Math.sin(t * 0.9) > 0.97 ? 0.2 : 1;
  ell(ctx, hx + look, hy, 0.5, 0.7 * blink); ctx.fill();
  ell(ctx, hx + look + 2.2, hy, 0.5, 0.7 * blink); ctx.fill();
  // Mouth
  ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
  ctx.beginPath();
  if (p.mode === 'recoiling') { ell(ctx, hx + 2, hy + 2.6, 0.8, 1); ctx.stroke(); }
  else if (p.mode === 'asking') { ell(ctx, hx + 2, hy + 2.4, 0.7, 0.6 + Math.abs(Math.sin(t * 10)) * 0.5); ctx.stroke(); }
  else { ctx.moveTo(hx + 1, hy + 2.4); ctx.quadraticCurveTo(hx + 2, hy + (p.mode === 'stroking' ? 3.4 : 2.8), hx + 3, hy + 2.4); ctx.stroke(); }
}

function drawArm(ctx: CanvasRenderingContext2D, sx: number, sy: number, p: PersonPose, c: StaffProfile['colour'], seated: boolean) {
  let hx = sx + 3, hy = sy + 12;
  if (p.reach) { hx = p.reach.x * p.facing; hy = p.reach.y; }
  else if (p.task === 'phone' || p.task === 'read') { hx = sx + 5; hy = sy + 4; }
  else if (p.task === 'work') { hx = sx + 9; hy = sy + 6; }
  else if (p.task === 'cook' || p.task === 'tidy') { hx = sx + 8 + Math.sin(p.t * 5) * 1.5; hy = sy + 5; }
  if (seated && !p.reach && !p.task) { hx = sx + 6; hy = sy + 11; }
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + hx) / 2 + 2, (sy + hy) / 2 + 2, hx, hy);
  ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 2.2; ctx.strokeStyle = c.top; ctx.stroke();
  // Hand
  if (p.highlightHand) {
    ell(ctx, hx, hy, 4.4, 4.4);
    ctx.fillStyle = 'rgba(0,245,245,0.35)';
    ctx.fill();
    ctx.lineWidth = 0.7; ctx.strokeStyle = '#00f5f5'; ctx.stroke();
  }
  ell(ctx, hx, hy, 2, 1.7); fs(ctx, c.skin, 0.7);
  if (p.task === 'phone' && !p.reach) { rr(ctx, hx - 1, hy - 3.2, 2.2, 3.6, 0.5); fs(ctx, '#222', 0.4); }
  if (p.sprayBottle) {
    rr(ctx, hx - 1.4, hy - 6, 2.8, 5, 0.8); fs(ctx, '#5fd0ff', 0.5);
    rr(ctx, hx - 0.8, hy - 8, 2.4, 2, 0.4); fs(ctx, '#ffffff', 0.4);
  }
}

export interface DogPose {
  facing: 1 | -1;
  mode: string;
  t: number;
  walking: boolean;
  reduceMotion: boolean;
}

/**
 * Biscuit: a dopey, mischievous Doberman. Natural floppy ears (uncropped), a long whippy tail (undocked),
 * black and tan, tongue out, nothing behind the eyes.
 */
export function drawDog(ctx: CanvasRenderingContext2D, x: number, y: number, p: DogPose) {
  const t = p.reduceMotion ? 0 : p.t;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.facing, 1);
  ell(ctx, 0, 0.5, 13, 2.4);
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1;

  if (p.mode === 'sprawl') {
    // Flat out, legs everywhere, tail thumping
    const thump = Math.sin(t * 5) * 0.3;
    drawTail(ctx, -13, -4, 0.2 + thump, t, 6);
    rr(ctx, -14, -8, 26, 8, 4); fs(ctx, DOG.coat);
    ell(ctx, 10, -2, 4.2, 2); fs(ctx, DOG.tan, 0.6);
    for (const lx of [-10, -4, 4, 9]) { rr(ctx, lx, -2, 6, 2.4, 1.2); fs(ctx, DOG.coat, 0.6); ell(ctx, lx + 6, -0.8, 1.5, 1.1); fs(ctx, DOG.tan, 0.5); }
    drawDogHead(ctx, 15, -6, t, 0.25, p.mode);
    ctx.restore();
    return;
  }
  const gait = p.walking ? Math.sin(t * 12) : 0;
  const wag = Math.sin(t * (p.mode === 'dazed' ? 3 : 14));
  drawTail(ctx, -12, -15, wag, t, 11);
  // Legs: long and thin
  ctx.lineCap = 'round';
  for (const [lx, ph] of [[-9, 0], [-6, Math.PI], [7, Math.PI], [10, 0]] as [number, number][]) {
    const sw = gait * Math.cos(ph) * 2;
    ctx.beginPath();
    ctx.moveTo(lx, -10);
    ctx.lineTo(lx + sw, -1);
    ctx.lineWidth = 3.6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 2.4; ctx.strokeStyle = DOG.coat; ctx.stroke();
    ell(ctx, lx + sw + 0.6, -0.8, 1.7, 1); fs(ctx, DOG.tan, 0.5);
  }
  // Body: deep chest, tuck-up waist
  ctx.beginPath();
  ctx.moveTo(-12, -16);
  ctx.quadraticCurveTo(-2, -21, 9, -18);
  ctx.quadraticCurveTo(14, -15, 12, -9);
  ctx.quadraticCurveTo(4, -6, -2, -10);
  ctx.quadraticCurveTo(-8, -9, -12, -12);
  ctx.closePath();
  fs(ctx, DOG.coat);
  ctx.strokeStyle = DOG.sheen; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-8, -17); ctx.quadraticCurveTo(0, -20, 7, -18); ctx.stroke();
  // Tan chest patch
  ell(ctx, 11, -12, 2.2, 2.6); ctx.fillStyle = DOG.tan; ctx.fill();
  // Collar
  rr(ctx, 9.5, -20, 4, 2, 0.8); fs(ctx, DOG.collar, 0.5);
  const tilt = p.mode === 'tilt' ? 0.45 : p.mode === 'dazed' ? Math.sin(t * 4) * 0.2 : Math.sin(t * 1.5) * 0.05;
  drawDogHead(ctx, 13, -23, t, tilt, p.mode);
  ctx.restore();
}

function drawTail(ctx: CanvasRenderingContext2D, x: number, y: number, wag: number, _t: number, len: number) {
  ctx.beginPath();
  ctx.moveTo(x + 1, y);
  ctx.quadraticCurveTo(x - len * 0.6, y - 2 + wag * 4, x - len, y - len * 0.8 + wag * 6);
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 1.4; ctx.strokeStyle = DOG.coat; ctx.stroke();
}

function drawDogHead(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, tilt: number, mode: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // Skull and long muzzle
  ell(ctx, 0, 0, 4.4, 4); fs(ctx, DOG.coat);
  ctx.beginPath();
  ctx.moveTo(2, -1.8); ctx.lineTo(9.5, 0.2); ctx.quadraticCurveTo(10.6, 2.6, 8.6, 3.4); ctx.lineTo(2, 3.4); ctx.closePath();
  fs(ctx, DOG.coat);
  // Tan muzzle and brow dots
  ctx.beginPath();
  ctx.moveTo(3, 1.6); ctx.lineTo(9.6, 1.4); ctx.quadraticCurveTo(10.2, 3, 8.6, 3.4); ctx.lineTo(3, 3.4); ctx.closePath();
  ctx.fillStyle = DOG.tan; ctx.fill();
  ell(ctx, 1.4, -2.4, 0.8, 0.55); ctx.fill();
  ell(ctx, 10, 0.4, 0.9, 0.7); ctx.fillStyle = '#111'; ctx.fill();
  // Tongue out, always
  rr(ctx, 6, 3, 1.8, 2.8 + Math.abs(Math.sin(t * 7)) * 0.8, 0.9); fs(ctx, DOG.tongue, 0.4);
  // Eyes: dopey, mismatched gaze
  ell(ctx, 1.8, -0.8, 1.05, 1.05); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 0.4; ctx.strokeStyle = INK; ctx.stroke();
  ell(ctx, 2.1 + Math.sin(t * 0.8) * 0.3, -0.5, 0.5, 0.55); ctx.fillStyle = '#3b2412'; ctx.fill();
  // Floppy, natural ears
  const flap = Math.sin(t * 6) * 0.15;
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.quadraticCurveTo(-5.5, -2 + flap * 4, -5, 3.5 + flap * 2);
  ctx.quadraticCurveTo(-3, 3.6, -1, -0.5);
  ctx.closePath();
  fs(ctx, DOG.sheen, 0.7);
  if (mode === 'dazed') {
    ctx.fillStyle = '#ffd54a';
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      star(ctx, Math.cos(a) * 6, -7 + Math.sin(a) * 1.6, 1.2);
    }
  }
  if (mode === 'tilt') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
    ctx.font = 'bold 7px "Readex Pro", sans-serif';
    ctx.strokeText('?', 4, -6); ctx.fillText('?', 4, -6);
  }
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr2 = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
  ctx.fill();
}

/** The Hoover: upright, red, loud */
export function drawHoover(ctx: CanvasRenderingContext2D, x: number, y: number, running: boolean, t: number) {
  ctx.save();
  const shake = running ? Math.sin(t * 60) * 0.35 : 0;
  ctx.translate(x + shake, y);
  ell(ctx, 0, 0.5, 7, 1.6); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1;
  rr(ctx, -6, -3, 12, 3.4, 1.4); fs(ctx, '#444');
  rr(ctx, -3.5, -16, 7, 13, 3); fs(ctx, '#e53935');
  rr(ctx, -2, -13, 4, 6, 1.6); fs(ctx, '#ff8a80', 0.5);
  ctx.beginPath(); ctx.moveTo(1, -16); ctx.lineTo(3, -30);
  ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
  rr(ctx, 1, -32, 5, 2.4, 1); fs(ctx, '#333', 0.6);
  // Cable
  ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(-12, -2, -18, 0);
  ctx.lineWidth = 0.6; ctx.strokeStyle = '#222'; ctx.stroke();
  if (running) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) {
      const r = 8 + ((t * 18 + i * 4) % 10);
      ctx.beginPath(); ctx.arc(0, -8, r, -0.6, 0.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -8, r, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
    }
  }
  ctx.restore();
}

import type { Display, Pose, PawV } from '../../sim/types';
import { POSE_GEOMETRY, CLOSE_UP } from '../../sim/body';

/**
 * Temutom, assembled each frame from parts (A2, §15.3): body pose, head, ears, eyes, tail, paws.
 * The same orange cat as in Staff Management, with the markings of the real cat in the reference
 * photographs: rosette spots, white chin and whisker pads, dark eye-liner, green eyes, a ringed
 * tail with a black tip, and big ears.
 */
export const C = {
  ink: '#2a1a12',
  base: '#ff8a1f',
  light: '#ffb25a',
  dark: '#c9590d',
  spot: '#6b2f0b',
  spotIn: '#e2741a',
  white: '#fff3df',
  nose: '#d9776c',
  eye: '#9fd35a',
  eyeRim: '#4b6b1e',
  pupil: '#15100b',
  pink: '#f4a6a6',
};

const TAU = Math.PI * 2;

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
function fs(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, w = 3) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = w; ctx.strokeStyle = C.ink; ctx.stroke();
}

export interface CatDraw {
  x: number; y: number; scale: number; facing: 1 | -1;
  display: Display;
  t: number;
  reduceMotion: boolean;
  /** Screen-space point to turn the head towards (bites) */
  biteAt?: { x: number; y: number } | null;
}

/** Rosettes: a few dark open rings with lighter centres, clipped to the body */
function rosettes(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number) {
  ctx.save();
  ell(ctx, cx, cy, rx, ry);
  ctx.clip();
  let r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.92;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d * 0.9 - ry * 0.05;
    const s = 5 + rnd() * 6;
    ell(ctx, x, y, s * 1.25, s, rnd());
    ctx.fillStyle = C.spot; ctx.fill();
    ell(ctx, x + 0.5, y, s * 0.7, s * 0.5, rnd());
    ctx.fillStyle = C.spotIn; ctx.fill();
  }
  // Pale underside
  ell(ctx, cx, cy + ry * 0.75, rx * 0.8, ry * 0.4);
  ctx.fillStyle = 'rgba(255,226,184,0.55)'; ctx.fill();
  ctx.restore();
}

function tail(ctx: CanvasRenderingContext2D, ax: number, ay: number, kind: Display['tail'], t: number, pose: Pose) {
  let pts: [number, number][];
  const s = Math.sin;
  switch (kind) {
    case 'hooked': pts = [[ax, ay], [ax - 14, ay - 40], [ax - 6, ay - 88], [ax + 14 + s(t * 2) * 3, ay - 96]]; break;
    case 'flick': { const f = s(t * 16) * 12; pts = [[ax, ay], [ax - 36, ay + 6], [ax - 58, ay - 8], [ax - 66 + f * 0.3, ay - 26 + f]]; break; }
    case 'lash': { const l = s(t * 11); pts = [[ax, ay], [ax - 30 + l * 10, ay - 26 + l * 20], [ax - 52 - l * 26, ay - 50 + l * 30], [ax - 50 + l * 44, ay - 82]]; break; }
    case 'wave': { const w = s(t * 1.8) * 10; pts = [[ax, ay], [ax - 34, ay + 2], [ax - 56, ay - 14 + w], [ax - 60 + w, ay - 40]]; break; }
    default: pts = [[ax, ay], [ax - 30, ay + 8], [ax - 54, ay + 6], [ax - 70, ay - 4]];
  }
  if (pose === 'sleep') pts = [[ax, ay], [ax + 10, ay + 14], [ax + 50, ay + 14], [ax + 70, ay + 2]];
  if (pose === 'bellyUp') pts = [[ax, ay], [ax + 26, ay + 4], [ax + 44, ay - 4], [ax + 60, ay - 18]];
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
  };
  ctx.lineCap = 'round';
  path(); ctx.lineWidth = 19; ctx.strokeStyle = C.ink; ctx.stroke();
  path(); ctx.lineWidth = 13; ctx.strokeStyle = C.base; ctx.stroke();
  // Dark rings, and the black tip of the real cat
  ctx.setLineDash([5, 9]);
  path(); ctx.lineWidth = 13; ctx.strokeStyle = C.spot; ctx.stroke();
  ctx.setLineDash([]);
  const [ex, ey] = pts[3];
  ell(ctx, ex, ey, 8, 8); ctx.fillStyle = '#1a0f08'; ctx.fill();
}

function paw(ctx: CanvasRenderingContext2D, x: number, y: number, r = 10, claws = false) {
  ell(ctx, x, y, r * 1.2, r * 0.85);
  fs(ctx, C.white, 2.5);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
  for (const dx of [-0.45, 0, 0.45]) { ctx.beginPath(); ctx.moveTo(x + dx * r, y - r * 0.2); ctx.lineTo(x + dx * r, y + r * 0.5); ctx.stroke(); }
  if (claws) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    for (const dx of [-0.6, -0.2, 0.2, 0.6]) {
      ctx.beginPath(); ctx.moveTo(x + dx * r, y - r * 0.8); ctx.quadraticCurveTo(x + dx * r * 1.3, y - r * 1.6, x + dx * r * 1.1, y - r * 2); ctx.stroke();
    }
  }
}

/** The head, in head units (r = head radius), centred at (0, 0), facing right */
export function drawHead(ctx: CanvasRenderingContext2D, r: number, d: Display, t: number, gazeLocal: { x: number; y: number } | null) {
  const k = r / 30;
  const earRot = { forward: -0.05, relaxed: 0.18, sideways: 0.75, flat: 1.25 }[d.ears];
  const earLen = d.ears === 'flat' ? 0.6 : 1;
  // Ears: big, as in the photographs
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 15 * k, -20 * k);
    ctx.rotate(side * earRot + (d.ears === 'forward' ? Math.sin(t * 0.7 + side) * 0.03 : 0));
    ctx.beginPath();
    ctx.moveTo(-11 * k, 4 * k); ctx.lineTo(side * 2 * k, -30 * k * earLen); ctx.lineTo(11 * k, 4 * k); ctx.closePath();
    fs(ctx, C.base, 3 * k);
    ctx.beginPath();
    ctx.moveTo(-6 * k, 2 * k); ctx.lineTo(side * 1.5 * k, -21 * k * earLen); ctx.lineTo(6 * k, 2 * k); ctx.closePath();
    ctx.fillStyle = C.pink; ctx.fill();
    ctx.restore();
  }
  // Head
  ell(ctx, 0, 0, 31 * k, 27 * k);
  fs(ctx, C.base, 3 * k);
  // Forehead "M" and cheek stripes
  ctx.strokeStyle = C.spot; ctx.lineWidth = 2.6 * k; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9 * k, -22 * k); ctx.lineTo(-5 * k, -14 * k); ctx.lineTo(0, -21 * k); ctx.lineTo(5 * k, -14 * k); ctx.lineTo(9 * k, -22 * k);
  ctx.moveTo(-28 * k, 2 * k); ctx.quadraticCurveTo(-20 * k, 0, -16 * k, 6 * k);
  ctx.moveTo(28 * k, 2 * k); ctx.quadraticCurveTo(20 * k, 0, 16 * k, 6 * k);
  ctx.stroke();
  // White muzzle and chin
  ell(ctx, 0, 11 * k, 15 * k, 11 * k);
  ctx.fillStyle = C.white; ctx.fill();

  // Eyes
  const lid = { half: 0.55, open: 0.18, wide: 0.02, dilated: 0.04, slowBlink: 0.95, closed: 1 }[d.eyes];
  const pupilW = { half: 0.32, open: 0.3, wide: 0.24, dilated: 0.72, slowBlink: 0.3, closed: 0.3 }[d.eyes];
  const apart = (1 - d.align) * 3.2 * k;
  let gx = 0, gy = 0;
  if (gazeLocal) {
    const m = Math.hypot(gazeLocal.x, gazeLocal.y) || 1;
    gx = (gazeLocal.x / m) * 2.2 * k; gy = (gazeLocal.y / m) * 1.6 * k;
  }
  ([[-12, -4, -1], [12, -4, 1]] as [number, number, number][]).forEach(([ex, ey, side]) => {
    const x = ex * k, y = ey * k;
    ell(ctx, x, y, 7.5 * k, 6.5 * k);
    ctx.fillStyle = C.eye; ctx.fill();
    // Pupils: in line when the Brain Cell is his; very slightly adrift otherwise
    const px = x + gx + side * apart * 0.7, py = y + gy + side * apart * 0.4;
    ell(ctx, px, py, 6.5 * pupilW * k + 0.8 * k, 5.5 * k * (d.eyes === 'dilated' ? 0.95 : 0.85));
    ctx.fillStyle = C.pupil; ctx.fill();
    ell(ctx, px + 1.6 * k, py - 1.8 * k, 1.3 * k, 1.3 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    // Heavy upper lid: the fixed expression of contempt
    ctx.save();
    ell(ctx, x, y, 7.5 * k, 6.5 * k); ctx.clip();
    ctx.fillStyle = C.base;
    ctx.fillRect(x - 9 * k, y - 8 * k, 18 * k, 14 * k * lid + 1.2 * k);
    ctx.restore();
    // Dark eye-liner, as in the photographs
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6 * k;
    ell(ctx, x, y, 7.5 * k, 6.5 * k); ctx.stroke();
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    const ly = y - 6.5 * k + 13 * k * lid;
    ctx.moveTo(x - 8 * k, ly + side * 0.6 * k); ctx.lineTo(x + 8 * k, ly - side * 0.6 * k);
    ctx.stroke();
    // Mascara line
    ctx.lineWidth = 1.8 * k;
    ctx.beginPath(); ctx.moveTo(x + side * 7 * k, y + 1 * k); ctx.lineTo(x + side * 11 * k, y + 4 * k); ctx.stroke();
  });
  if (d.glint) {
    ctx.fillStyle = '#ffffff';
    const sx = 18 * k, sy = -14 * k;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const rr = i % 2 ? 1.2 * k : 4 * k; ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
    ctx.fill();
  }

  // Nose
  ctx.beginPath(); ctx.moveTo(-3.5 * k, 4 * k); ctx.lineTo(3.5 * k, 4 * k); ctx.lineTo(0, 8 * k); ctx.closePath();
  ctx.fillStyle = C.nose; ctx.fill(); ctx.lineWidth = 1.2 * k; ctx.strokeStyle = C.ink; ctx.stroke();
  // Mouth
  if (d.head === 'scream' || d.head === 'bite') {
    const open = d.head === 'scream' ? 9 + Math.sin(t * 22) * 2 : 8;
    ell(ctx, 0, 15 * k, 7 * k, open * k);
    ctx.fillStyle = '#5a1020'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const fx of [-4, 4]) { ctx.beginPath(); ctx.moveTo(fx * k - 1.5 * k, (15 - open + 2) * k); ctx.lineTo(fx * k + 1.5 * k, (15 - open + 2) * k); ctx.lineTo(fx * k, (15 - open + 6) * k); ctx.fill(); }
    ell(ctx, 0, (15 + open * 0.5) * k, 3.5 * k, 2 * k); ctx.fillStyle = C.pink; ctx.fill();
  } else if (d.head === 'eat' || d.head === 'groom') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8 * k;
    ctx.beginPath(); ctx.moveTo(-5 * k, 12 * k); ctx.quadraticCurveTo(0, 15 * k, 5 * k, 12 * k); ctx.stroke();
    ell(ctx, 0, 15 * k, 3 * k, 2.4 * k + Math.abs(Math.sin(t * 9)) * 1.4 * k); ctx.fillStyle = C.pink; ctx.fill();
  } else {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8 * k;
    ctx.beginPath(); ctx.moveTo(0, 8 * k); ctx.lineTo(0, 11 * k);
    ctx.moveTo(-6 * k, 14 * k); ctx.quadraticCurveTo(0, 10.5 * k, 6 * k, 14 * k); ctx.stroke();
  }
  // Whiskers (white, as in the photographs)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.1 * k;
  for (const side of [-1, 1]) for (const dy of [8, 11, 14]) {
    ctx.beginPath(); ctx.moveTo(side * 9 * k, dy * k); ctx.quadraticCurveTo(side * 26 * k, (dy - 3) * k, side * 40 * k, (dy - 2 + (dy - 11)) * k); ctx.stroke();
  }
  if (d.confused) {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2 * k;
    ctx.font = `bold ${22 * k}px "Readex Pro", sans-serif`; ctx.textAlign = 'center';
    ctx.strokeText('?', 0, -42 * k); ctx.fillText('?', 0, -42 * k);
  }
}

function drawPaws(ctx: CanvasRenderingContext2D, pose: Pose, paw: PawV, t: number, front: [number, number]) {
  const [fx, fy] = front;
  if (paw === 'swipeL' || paw === 'swipeR') { paw2(ctx, fx + 30, fy - 70, true); return; }
  if (paw === 'pat') { paw2(ctx, fx + 22, fy - 14 - Math.abs(Math.sin(t * 8)) * 12, false); paw2(ctx, fx - 4, fy, false); return; }
  if (paw === 'push') { paw2(ctx, fx + 36, fy - 26, false); paw2(ctx, fx - 4, fy, false); return; }
  if (paw === 'knead') {
    const a = Math.sin(t * 6);
    paw2(ctx, fx + 6, fy - Math.max(0, a) * 8, false);
    paw2(ctx, fx - 14, fy - Math.max(0, -a) * 8, false);
    return;
  }
  if (pose === 'bellyUp' || pose === 'carried' || pose === 'sleep' || pose === 'jump') return;
  paw2(ctx, fx + 6, fy, false);
  paw2(ctx, fx - 16, fy, false);
}
function paw2(ctx: CanvasRenderingContext2D, x: number, y: number, claws: boolean) { paw(ctx, x, y, 10, claws); }

/** Draw him. Coordinates are screen points; the body is laid out on the same shapes the touch zones use. */
export function drawCat(ctx: CanvasRenderingContext2D, o: CatDraw) {
  const d = o.display;
  const t = o.reduceMotion ? 0 : o.t;
  if (d.pose === 'closeUp') { drawCloseUp(ctx, d, t); return; }
  const g = POSE_GEOMETRY[d.pose];
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.scale * o.facing, o.scale);
  const [bx, by, brx, bry] = g.body;
  const [hx, hy, hr] = g.head;
  const pose = d.pose;
  const breathe = Math.sin(t * 2.2) * (d.rumble === 'purr' ? 1.6 : 0.8);
  const tremor = d.rumble === 'tremor' && !o.reduceMotion ? (Math.random() - 0.5) * 1.6 : 0;
  ctx.translate(tremor, 0);

  // Shadow
  ell(ctx, bx, 2, brx * 1.05, 9); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();

  // Tail, behind
  const ta: [number, number] = pose === 'bellyUp' ? [bx + brx * 0.9, by + bry * 0.5] : pose === 'carried' ? [bx + 8, by + bry * 0.9] : [bx - brx * 0.85, by + bry * 0.55];
  tail(ctx, ta[0], ta[1], d.tail, t, pose);

  // Hind legs / haunch for sitting
  if (pose === 'sit') { ell(ctx, bx - 14, by + 30, 32, 22); fs(ctx, C.base); }
  if (pose === 'stand' || pose === 'walk') {
    const w = pose === 'walk' ? Math.sin(t * 12) * 10 : 0;
    for (const [lx, ph] of [[-40, 1], [-24, -1], [32, -1], [48, 1]] as [number, number][]) {
      ctx.beginPath(); ctx.roundRect(lx - 7 + w * ph * 0.4, by + 10, 14, -by - 10 + 2, 7); fs(ctx, C.base, 2.5);
      paw(ctx, lx + w * ph * 0.4, -4, 8);
    }
  }
  if (pose === 'bellyUp') {
    for (const [lx, ly] of [[-14, -74], [8, -86], [30, -80]] as [number, number][]) {
      ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(lx + 2, ly + 6); ctx.lineWidth = 15; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.lineWidth = 11; ctx.strokeStyle = C.base; ctx.stroke();
      paw(ctx, lx + 2, ly, 9);
    }
  }
  if (pose === 'jump') {
    ctx.lineCap = 'round';
    for (const [x1, x2] of [[-40, -70], [40, 72]] as [number, number][]) {
      ctx.beginPath(); ctx.moveTo(x1, by + 6); ctx.lineTo(x2, by + 24); ctx.lineWidth = 15; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.lineWidth = 11; ctx.strokeStyle = C.base; ctx.stroke();
    }
  }
  if (pose === 'carried') {
    for (const lx of [-14, 14]) { ctx.beginPath(); ctx.roundRect(lx - 7, by + 30, 14, 34, 7); fs(ctx, C.base, 2.5); paw(ctx, lx, by + 66, 8); }
  }

  // Body
  const grad = ctx.createRadialGradient(bx - brx * 0.3, by - bry * 0.5, 4, bx, by, Math.max(brx, bry) * 1.1);
  grad.addColorStop(0, C.light); grad.addColorStop(1, C.base);
  ell(ctx, bx, by + breathe * 0.3, brx + breathe * 0.4, bry + breathe * 0.4);
  fs(ctx, grad);
  rosettes(ctx, bx, by, brx, bry, Math.round(brx * 7 + bry));
  ell(ctx, bx, by + breathe * 0.3, brx + breathe * 0.4, bry + breathe * 0.4); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  // Belly, when he shows it (a trap)
  if (pose === 'bellyUp' || pose === 'carried') {
    const bz = g.zones.find((z) => z.zone === 'belly')!;
    ell(ctx, bz.cx, bz.cy, bz.rx * 0.95, bz.ry * 0.95);
    fs(ctx, C.white, 2);
    ctx.fillStyle = 'rgba(107,47,11,0.35)';
    for (let i = 0; i < 5; i++) { ell(ctx, bz.cx - bz.rx * 0.6 + i * bz.rx * 0.3, bz.cy + (i % 2 ? 4 : -4), 3.5, 2.5); ctx.fill(); }
  } else if (pose === 'sit') {
    ell(ctx, bx + 18, by - 6, 16, 26); ctx.fillStyle = C.white; ctx.fill();
  }

  // Front paws
  const front: [number, number] = pose === 'sit' ? [24, -8] : pose === 'crouch' ? [50, -6] : [46, -6];
  if (pose !== 'stand' && pose !== 'walk') drawPaws(ctx, pose, d.paw, t, front);
  else if (d.paw) drawPaws(ctx, pose, d.paw, t, [60, -40]);

  // Head
  ctx.save();
  ctx.translate(hx, hy + (d.head === 'eat' ? 14 : 0));
  let tilt = d.head === 'eat' ? 0.35 : pose === 'bellyUp' ? -0.6 : 0;
  if (d.head === 'bite' && o.biteAt) tilt = Math.atan2(o.biteAt.y - (o.y + hy * o.scale), (o.biteAt.x - (o.x + hx * o.scale * o.facing)) * o.facing) * 0.5;
  if (d.wiggle) ctx.translate(0, Math.sin(t * 9) * 1.5);
  ctx.rotate(tilt);
  const gl = d.gaze ? { x: (d.gaze.x - (o.x + hx * o.scale * o.facing)) * o.facing, y: d.gaze.y - (o.y + hy * o.scale) } : null;
  drawHead(ctx, hr, d, t, gl);
  ctx.restore();
  if (d.paw === 'swipeL' || d.paw === 'swipeR') {
    // Wind-up: paw raised high, claws out — unmistakable
    paw(ctx, hx + 26, hy - 30, 13, true);
  }
  ctx.restore();
}

function drawCloseUp(ctx: CanvasRenderingContext2D, d: Display, t: number) {
  ctx.save();
  ctx.translate(CLOSE_UP.cx, CLOSE_UP.cy + Math.sin(t * 1.5) * 2);
  // Edge vignette so the face reads as pressed up against the glass
  const g = ctx.createRadialGradient(0, 0, 120, 0, 0, 520);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(-400, -500, 800, 1000);
  drawHead(ctx, 168, { ...d, gaze: { x: 0, y: 1 } }, t, { x: 0, y: 0.6 });
  ctx.restore();
}

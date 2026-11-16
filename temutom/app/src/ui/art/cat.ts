import { CAT, INK, LINE } from './palette';

export interface CatPose {
  facing: 1 | -1;
  action: string;
  t: number; // seconds, for animation
  eyesApart: boolean; // Brain Cell away
  content: boolean; // inside the band: half-closed eyes
  lash: number; // 0..1 tail lashing when outside the band
  mouthOpen: number; // 0..1 screaming
  puffed: boolean; // outburst
  flat: boolean; // stunned / sprayed
  inBox: boolean;
  held: boolean;
  reduceMotion: boolean;
}

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function stroke(ctx: CanvasRenderingContext2D, fill: string, w = LINE) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/**
 * Temutom: large, round, very orange, with a small head and a fixed expression of contempt.
 * Anchor (x, y) is the point he sits on.
 */
export function drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, p: CatPose, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.facing * scale, scale);
  const t = p.reduceMotion ? 0 : p.t;
  const moving = p.action === 'moving';
  const bob = moving ? Math.abs(Math.sin(t * 12)) * 1.2 : Math.sin(t * 1.6) * 0.25;
  let sy = 1, sx = 1;
  if (p.flat) { sy = 0.62; sx = 1.18; }
  if (p.held) { sy = 1.25; sx = 0.82; }
  if (p.action === 'smacking') sx = 1.06;
  ctx.translate(0, -bob);
  ctx.scale(sx, sy);

  if (p.inBox) {
    drawBoxedHead(ctx, p, t);
    ctx.restore();
    return;
  }

  // Shadow
  ctx.save();
  ctx.scale(1 / sx, 1 / sy);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ell(ctx, 0, 0.5, 9, 2.2);
  ctx.fill();
  ctx.restore();

  // Tail
  const lash = p.lash * Math.sin(t * 9);
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.bezierCurveTo(-14, -2 + lash * 2, -15 + lash * 3, -12 + lash * 2, -11 + lash * 5, -16 + Math.sin(t * 2) * 0.8);
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = CAT.base;
  ctx.stroke();
  // Tail stripes
  ctx.strokeStyle = CAT.stripe;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([1.2, 1.8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Body: one big round loaf
  const puff = p.puffed ? 1.12 : 1;
  ell(ctx, 0, -7, 9.5 * puff, 7.8 * puff);
  stroke(ctx, CAT.base);
  if (p.puffed) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10.4, -7 + Math.sin(a) * 8.6);
      ctx.lineTo(Math.cos(a) * 12, -7 + Math.sin(a) * 10);
      ctx.stroke();
    }
  }
  // Belly
  ell(ctx, 3.2, -5, 4.8, 5.2);
  ctx.fillStyle = CAT.belly;
  ctx.fill();
  // Tabby stripes on the back
  ctx.strokeStyle = CAT.stripe;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = -2.6 + i * 0.38;
    ctx.beginPath();
    ctx.arc(0, -7, 8.2, a, a + 0.22);
    ctx.lineTo(Math.cos(a + 0.11) * 5.2, -7 + Math.sin(a + 0.11) * 4.8);
    ctx.stroke();
  }
  // Front paws
  ell(ctx, 4.5, -0.6, 2.2, 1.3);
  stroke(ctx, CAT.light, 0.7);
  ell(ctx, 0.5, -0.6, 2.2, 1.3);
  stroke(ctx, CAT.light, 0.7);
  if (p.action === 'smacking') {
    ell(ctx, 10, -6, 2, 1.5, -0.4);
    stroke(ctx, CAT.light, 0.7);
  }

  drawHead(ctx, p, t);
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, p: CatPose, t: number) {
  // Small head, set forward
  const hx = 5.4, hy = -15.2;
  const tilt = p.action === 'staring' ? 0 : Math.sin(t * 0.7) * 0.03;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  // Ears
  for (const ex of [-2.6, 2.4]) {
    ctx.beginPath();
    ctx.moveTo(ex - 1.8, -2.2);
    ctx.lineTo(ex + 0.2, -6.4);
    ctx.lineTo(ex + 2, -2.4);
    ctx.closePath();
    stroke(ctx, CAT.base, 0.8);
    ctx.beginPath();
    ctx.moveTo(ex - 0.8, -2.6);
    ctx.lineTo(ex + 0.2, -5);
    ctx.lineTo(ex + 1.1, -2.7);
    ctx.closePath();
    ctx.fillStyle = CAT.nose;
    ctx.fill();
  }
  ell(ctx, 0, 0, 4.6, 4);
  stroke(ctx, CAT.base);
  // Forehead "M"
  ctx.strokeStyle = CAT.stripe;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-1.6, -3.4); ctx.lineTo(-0.8, -2.2); ctx.lineTo(0, -3.4); ctx.lineTo(0.8, -2.2); ctx.lineTo(1.6, -3.4);
  ctx.stroke();
  // Cheek fluff
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-4.4, 1); ctx.lineTo(-5.6, 1.8);
  ctx.moveTo(4.4, 1); ctx.lineTo(5.6, 1.8);
  ctx.stroke();
  // Muzzle
  ell(ctx, 1, 1.9, 2.2, 1.4);
  ctx.fillStyle = CAT.belly;
  ctx.fill();

  drawEyes(ctx, p, t);

  // Nose
  ctx.beginPath();
  ctx.moveTo(0.4, 0.9); ctx.lineTo(1.6, 0.9); ctx.lineTo(1, 1.6); ctx.closePath();
  ctx.fillStyle = CAT.nose;
  ctx.fill();
  // Mouth
  if (p.mouthOpen > 0.05) {
    const m = 0.8 + p.mouthOpen * 1.6;
    ell(ctx, 1, 2.9, 1.3, m * 0.8);
    ctx.fillStyle = '#5a1020';
    ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
    ell(ctx, 1, 3.4, 0.7, 0.35);
    ctx.fillStyle = CAT.nose; ctx.fill();
  } else {
    // Contemptuous flat mouth, very slightly down
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(1, 1.6); ctx.lineTo(1, 2.3);
    ctx.moveTo(-0.3, 2.8); ctx.quadraticCurveTo(1, 2.2, 2.3, 2.8);
    ctx.stroke();
  }
  // Whiskers
  ctx.strokeStyle = 'rgba(42,26,18,0.6)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  for (const dy of [1.6, 2.3]) {
    ctx.moveTo(2.8, dy); ctx.lineTo(6.5, dy - 0.6 + (dy - 1.6));
    ctx.moveTo(-0.8, dy); ctx.lineTo(-4.6, dy - 0.6 + (dy - 1.6));
  }
  ctx.stroke();
  ctx.restore();
}

function drawEyes(ctx: CanvasRenderingContext2D, p: CatPose, t: number) {
  const eyes: [number, number][] = [[-1.5, -0.6], [2.2, -0.6]];
  const lid = p.content ? 0.75 : p.action === 'staring' ? 0.05 : 0.42; // fraction of eye covered by the lid
  eyes.forEach(([ex, ey], i) => {
    ell(ctx, ex, ey, 1.25, 1.05);
    ctx.fillStyle = CAT.eye;
    ctx.fill();
    // Pupil: aligned, or drifting apart when the Brain Cell is away
    let px = 0.25, py = 0;
    if (p.eyesApart) {
      const wob = Math.sin(t * 1.3 + i) * 0.15;
      px = i === 0 ? -0.55 + wob : 0.7 - wob;
      py = i === 0 ? -0.35 : 0.35;
    }
    const pw = p.action === 'staring' ? 0.22 : 0.42;
    ell(ctx, ex + px, ey + py, pw, 0.85);
    ctx.fillStyle = CAT.pupil;
    ctx.fill();
    // Heavy, flat upper lid: the fixed expression of contempt
    ctx.save();
    ell(ctx, ex, ey, 1.25, 1.05);
    ctx.clip();
    ctx.fillStyle = CAT.base;
    ctx.fillRect(ex - 1.5, ey - 1.2, 3, 2.1 * lid + 0.05);
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    const ly = ey - 1.05 + 2.1 * lid;
    ctx.moveTo(ex - 1.35, ly + (i === 0 ? 0.25 : -0.1));
    ctx.lineTo(ex + 1.35, ly + (i === 0 ? -0.1 : 0.25));
    ctx.stroke();
    ell(ctx, ex, ey, 1.25, 1.05);
    ctx.lineWidth = 0.45;
    ctx.stroke();
  });
}

function drawBoxedHead(ctx: CanvasRenderingContext2D, p: CatPose, t: number) {
  // Box front
  ctx.save();
  ctx.translate(0, -2);
  drawHead(ctx, { ...p, eyesApart: true }, t);
  ctx.restore();
}

/** The box itself (drawn in the room where there is one) */
export function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(8, -9); ctx.lineTo(-8, -9); ctx.closePath();
  stroke(ctx, '#c79a5b');
  ctx.beginPath();
  ctx.moveTo(-8, -9); ctx.lineTo(-11, -13); ctx.lineTo(-3, -12); ctx.lineTo(-1, -9);
  stroke(ctx, '#d7ad70', 0.7);
  ctx.beginPath();
  ctx.moveTo(8, -9); ctx.lineTo(11, -13); ctx.lineTo(3, -12); ctx.lineTo(1, -9);
  stroke(ctx, '#d7ad70', 0.7);
  ctx.strokeStyle = '#8a6334';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(-2, -4.5); ctx.lineTo(2, -4.5); ctx.stroke();
  ctx.restore();
}

export function drawBoxFront(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(8, -7); ctx.lineTo(-8, -7); ctx.closePath();
  stroke(ctx, '#c79a5b');
  ctx.restore();
}

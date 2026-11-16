import type { PlaceId } from '../../sim/types';
import { PLACES } from '../../content/places';

/**
 * First-person backgrounds (§5.4): what the player sees from where they stand or sit.
 * Flat, boldly outlined and warm, and a touch duller than the cat so he is always the brightest thing.
 */
const INK = '#2a1a12';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 6) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function fs(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, w = 3) {
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke();
}
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function wall(ctx: CanvasRenderingContext2D, a: string, b: string, to: number) {
  ctx.fillStyle = a; ctx.fillRect(0, 0, 390, to);
  ctx.fillStyle = b;
  for (let x = 0; x < 390; x += 36) ctx.fillRect(x, 0, 16, to);
}

function windowAt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, night: boolean) {
  rr(ctx, x, y, w, h, 4);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (night) { g.addColorStop(0, '#0d1a3a'); g.addColorStop(1, '#2b3a67'); } else { g.addColorStop(0, '#8fd3ff'); g.addColorStop(1, '#d8f1ff'); }
  fs(ctx, g);
  if (night) { ctx.fillStyle = '#fff6c8'; ell(ctx, x + w * 0.75, y + h * 0.25, 9, 9); ctx.fill(); }
  ctx.strokeStyle = '#f5efe6'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  rr(ctx, x, y, w, h, 4); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  rr(ctx, x - 10, y + h, w + 20, 12, 3); fs(ctx, '#f5efe6');
}

export function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: number, colour: string, night: boolean) {
  rr(ctx, x - 6, y - 6, w + 12, h + 6, 4); fs(ctx, '#f5efe6');
  // The doorway beyond
  rr(ctx, x, y, w, h, 2); fs(ctx, night ? '#05060f' : '#3b2c24');
  if (open > 0.01) {
    ctx.fillStyle = night ? '#16203d' : '#9fd27a';
    ctx.fillRect(x + 3, y + h * 0.55, w - 6, h * 0.45 - 3);
  }
  // The door swings towards us as it opens
  const ww = w * (1 - open * 0.75);
  const lean = open * 18;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + ww, y - lean * 0.3); ctx.lineTo(x + ww, y + h + lean * 0.3); ctx.lineTo(x, y + h); ctx.closePath();
  fs(ctx, colour);
  if (open < 0.5) {
    rr(ctx, x + ww * 0.15, y + h * 0.08, ww * 0.7, h * 0.36, 4); ctx.lineWidth = 2; ctx.stroke();
    rr(ctx, x + ww * 0.15, y + h * 0.52, ww * 0.7, h * 0.38, 4); ctx.stroke();
    ell(ctx, x + ww - 12, y + h * 0.5, 6, 6); fs(ctx, '#ffd54f', 2);
  }
}

function knees(ctx: CanvasRenderingContext2D, colour: string) {
  // The player's own lap and knees, at the bottom of the screen
  for (const kx of [110, 280]) {
    ctx.beginPath();
    ctx.moveTo(kx - 92, 810); ctx.quadraticCurveTo(kx - 98, 700, kx, 690); ctx.quadraticCurveTo(kx + 98, 700, kx + 92, 810); ctx.closePath();
    fs(ctx, colour);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(kx - 50, 720); ctx.quadraticCurveTo(kx, 705, kx + 50, 720); ctx.stroke();
  }
}

export interface PlaceVisual { doorOpen: number; night: boolean; cupboardOpen: boolean; lidClosed: boolean }

export function drawPlace(ctx: CanvasRenderingContext2D, id: PlaceId, v: PlaceVisual) {
  const p = PLACES[id];
  switch (id) {
    case 'kitchen': {
      wall(ctx, '#efe1c4', '#e6d4b2', 440);
      // Tiles behind the worktop
      ctx.strokeStyle = 'rgba(42,26,18,0.1)'; ctx.lineWidth = 1.5;
      for (let y = 340; y < 440; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(296, y); ctx.stroke(); }
      windowAt(ctx, 180, 120, 104, 180, v.night);
      const cb = p.cupboard!;
      rr(ctx, cb.x, cb.y, cb.w, cb.h, 6); fs(ctx, v.cupboardOpen ? '#5b3b24' : '#d9b98a');
      if (v.cupboardOpen) {
        ctx.fillStyle = '#ffcf6b'; for (let i = 0; i < 3; i++) { rr(ctx, cb.x + 20 + i * 38, cb.y + 50, 28, 40, 4); fs(ctx, '#ffcf6b', 2); }
        rr(ctx, cb.x - 30, cb.y, 34, cb.h, 4); fs(ctx, '#d9b98a');
      } else {
        ctx.beginPath(); ctx.moveTo(cb.x + cb.w / 2, cb.y); ctx.lineTo(cb.x + cb.w / 2, cb.y + cb.h); ctx.lineWidth = 2; ctx.stroke();
        ell(ctx, cb.x + cb.w / 2 - 12, cb.y + cb.h / 2, 5, 5); fs(ctx, '#ffd54f', 2); ell(ctx, cb.x + cb.w / 2 + 12, cb.y + cb.h / 2, 5, 5); fs(ctx, '#ffd54f', 2);
      }
      const d = p.door!;
      drawDoor(ctx, d.x, d.y, d.w, d.h, v.doorOpen, '#a1735a', v.night);
      // Worktop, seen from above
      const g = ctx.createLinearGradient(0, 440, 0, 600);
      g.addColorStop(0, '#d9c3a0'); g.addColorStop(1, '#ecdcbf');
      ctx.fillStyle = g; ctx.fillRect(0, 440, 296, 160); ctx.fillRect(296, 472, 94, 128);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 440); ctx.lineTo(296, 440); ctx.lineTo(296, 472); ctx.lineTo(390, 472); ctx.stroke();
      rr(ctx, -4, 598, 398, 18, 2); fs(ctx, '#bfa37c');
      ctx.fillStyle = '#b48c62'; ctx.fillRect(0, 616, 390, 92);
      for (let x = 0; x < 390; x += 130) { rr(ctx, x + 6, 622, 118, 80, 4); fs(ctx, '#c9a074', 2); rr(ctx, x + 55, 632, 20, 5, 2); fs(ctx, '#7b5a3c', 1.5); }
      // Floor
      ctx.fillStyle = '#9c7e62'; ctx.fillRect(0, 708, 390, 100);
      ctx.strokeStyle = 'rgba(42,26,18,0.15)'; ctx.lineWidth = 2;
      for (let x = -40; x < 420; x += 60) { ctx.beginPath(); ctx.moveTo(x, 708); ctx.lineTo(x - 30, 800); ctx.stroke(); }
      // Pouch box
      rr(ctx, 18, 520, 70, 50, 6); fs(ctx, '#7e57c2');
      break;
    }
    case 'study': {
      wall(ctx, '#c4d8bf', '#b6cdb0', 430);
      rr(ctx, 70, 270, 230, 10, 2); fs(ctx, '#8d6e63');
      const d = p.door!;
      drawDoor(ctx, d.x, d.y, d.w, d.h, v.doorOpen, '#8d6e63', v.night);
      windowAt(ctx, 20, 60, 80, 150, v.night);
      // Socket
      rr(ctx, 20, 380, 30, 30, 4); fs(ctx, '#f5f5f5', 2);
      // Desk
      const g = ctx.createLinearGradient(0, 430, 0, 800);
      g.addColorStop(0, '#a37e5e'); g.addColorStop(1, '#8a6649');
      ctx.fillStyle = g; ctx.fillRect(0, 430, 390, 380);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 430); ctx.lineTo(296, 430); ctx.stroke();
      // Drawer
      rr(ctx, -4, 730, 140, 80, 4); fs(ctx, '#7c5a40');
      rr(ctx, 40, 744, 56, 8, 3); fs(ctx, '#3e2a1c', 2);
      // Laptop
      const L = p.laptop!;
      if (v.lidClosed) {
        rr(ctx, L.x, L.y + 170, L.w, 120, 14); fs(ctx, '#b0bec5');
        rr(ctx, L.x + 10, L.y + 180, L.w - 20, 100, 10); fs(ctx, '#90a4ae', 2);
      } else {
        rr(ctx, L.x + 10, L.y, L.w - 20, 170, 12); fs(ctx, '#37474f');
        rr(ctx, L.x + 22, L.y + 12, L.w - 44, 146, 6); fs(ctx, '#eef6ff', 2);
        rr(ctx, L.x, L.y + 166, L.w, 128, 12); fs(ctx, '#b0bec5');
        rr(ctx, L.x + 12, L.y + 176, L.w - 24, 108, 8); fs(ctx, '#90a4ae', 2);
      }
      break;
    }
    case 'sofa': {
      wall(ctx, '#d3c3e0', '#c7b6d6', 430);
      windowAt(ctx, 150, 50, 90, 130, v.night);
      rr(ctx, 80, 288, 230, 10, 2); fs(ctx, '#8d6e63');
      // Armchair across the room
      rr(ctx, 248, 380, 120, 90, 18); fs(ctx, '#c0504d');
      rr(ctx, 258, 430, 100, 50, 10); fs(ctx, '#d4706c');
      // Floor and rug
      ctx.fillStyle = '#9b7c5c'; ctx.fillRect(0, 430, 390, 380);
      ell(ctx, 195, 560, 210, 90); fs(ctx, '#4db6ac');
      // Box
      if (p.box) { rr(ctx, p.box.x - 44, p.box.y - 44, 88, 52, 4); fs(ctx, '#c79a5b'); }
      // Coffee table
      rr(ctx, 20, 520, 350, 100, 14); fs(ctx, '#a1735a');
      rr(ctx, 34, 530, 322, 80, 10); fs(ctx, '#b88a69', 2);
      // Toy basket
      rr(ctx, 300, 650, 86, 70, 14); fs(ctx, '#d7b377');
      ell(ctx, 320, 650, 12, 12); fs(ctx, '#ffca28', 2);
      knees(ctx, '#4f5f9e');
      break;
    }
    case 'bedroom': {
      wall(ctx, '#ecd2c0', '#e2c4b0', 440);
      windowAt(ctx, 170, 110, 130, 180, v.night);
      const d = p.door!;
      drawDoor(ctx, d.x, d.y, d.w, d.h, v.doorOpen, '#bcaaa4', v.night);
      // Wardrobe
      rr(ctx, 320, 120, 70, 330, 4); fs(ctx, '#bcaaa4');
      // The bed, from its edge
      const g = ctx.createLinearGradient(0, 440, 0, 800);
      g.addColorStop(0, '#f6c1d6'); g.addColorStop(1, '#f48fb1');
      ctx.fillStyle = g; ctx.fillRect(0, 440, 390, 380);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 440); ctx.lineTo(390, 440); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      for (let y = 480; y < 700; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(195, y + 18, 390, y); ctx.stroke(); }
      // Washing basket
      rr(ctx, 290, 600, 96, 60, 14); fs(ctx, '#e0e0e0');
      knees(ctx, '#6d6f86');
      break;
    }
    case 'hallway': {
      wall(ctx, '#e3d6b5', '#d8c9a4', 560);
      const d = p.door!;
      drawDoor(ctx, d.x, d.y, d.w, d.h, v.doorOpen, '#2e7d6b', v.night);
      // Stairs rising to the right
      for (let i = 0; i < 9; i++) {
        const y = 560 - i * 44;
        rr(ctx, 230 + i * 6, y - 44, 170 - i * 6, 44, 2); fs(ctx, i % 2 ? '#a1887f' : '#bcaaa4', 2);
      }
      rr(ctx, 226, 140, 8, 420, 3); fs(ctx, '#6d4c41');
      // Hall table
      rr(ctx, 215, 460, 90, 8, 2); fs(ctx, '#8d6e63');
      // Hoover cupboard under the stairs
      rr(ctx, 260, 470, 120, 140, 4); fs(ctx, '#d7ccc8');
      rr(ctx, 272, 482, 96, 116, 4); fs(ctx, '#bcaaa4', 2);
      // Floor
      ctx.fillStyle = '#8f6a48'; ctx.fillRect(0, 560, 390, 250);
      ctx.strokeStyle = 'rgba(42,26,18,0.15)'; ctx.lineWidth = 2;
      for (let y = 590; y < 800; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(390, y); ctx.stroke(); }
      rr(ctx, 60, 580, 130, 50, 10); fs(ctx, '#a1887f');
      break;
    }
  }
  if (v.night) {
    ctx.fillStyle = 'rgba(10,8,40,0.45)';
    ctx.fillRect(0, 0, 390, 810);
  }
}

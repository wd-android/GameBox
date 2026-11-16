import type { RoomId } from '../../sim/types';
import { INK, LINE, ROOMCOL } from './palette';

/**
 * Room backgrounds: a cutaway seen from slightly above. Flat, boldly outlined, warm, and a touch
 * less saturated than the cat so that he stays the brightest thing on screen.
 * Room space is 100 × 130; the back wall runs down to WALL.
 */
export const WALL = 46;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function fs(ctx: CanvasRenderingContext2D, fill: string, w = LINE) {
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke();
}
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function shell(ctx: CanvasRenderingContext2D, id: RoomId) {
  const c = ROOMCOL[id];
  // Wall with soft vertical stripes
  ctx.fillStyle = c.wall;
  ctx.fillRect(0, 0, 100, WALL);
  ctx.fillStyle = c.wall2;
  for (let x = 0; x < 100; x += 8) ctx.fillRect(x, 0, 4, WALL);
  // Floor with boards
  const g = ctx.createLinearGradient(0, WALL, 0, 130);
  g.addColorStop(0, c.floor2);
  g.addColorStop(1, c.floor);
  ctx.fillStyle = g;
  ctx.fillRect(0, WALL, 100, 84);
  ctx.strokeStyle = 'rgba(42,26,18,0.12)';
  ctx.lineWidth = 0.4;
  for (let y = WALL + 6; y < 130; y += 7) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(100, y); ctx.stroke(); }
  // Skirting
  ctx.fillStyle = c.trim;
  ctx.fillRect(0, WALL - 2, 100, 2.4);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(0, WALL + 0.4); ctx.lineTo(100, WALL + 0.4); ctx.stroke();
}

function windowAt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, night = false) {
  rr(ctx, x, y, w, h, 0.6);
  fs(ctx, night ? '#2b3a67' : '#bfe6ff');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  rr(ctx, x, y, w, h, 0.6); ctx.lineWidth = LINE; ctx.strokeStyle = INK; ctx.stroke();
  // Sill
  rr(ctx, x - 2, y + h, w + 4, 2.4, 0.5); fs(ctx, '#f5efe6');
}

export function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: boolean, colour = '#a1735a') {
  rr(ctx, x - 1, y - 1, w + 2, h + 1, 0.6); fs(ctx, '#f5efe6');
  if (open) {
    rr(ctx, x, y, w, h, 0.3); fs(ctx, '#3a2a22');
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w * 0.35, y + 2); ctx.lineTo(x + w * 0.35, y + h + 2); ctx.lineTo(x, y + h); ctx.closePath();
    fs(ctx, colour);
  } else {
    rr(ctx, x, y, w, h, 0.3); fs(ctx, colour);
    rr(ctx, x + 1.5, y + 2, w - 3, h * 0.38, 0.4); ctx.lineWidth = 0.4; ctx.stroke();
    rr(ctx, x + 1.5, y + h * 0.5, w - 3, h * 0.42, 0.4); ctx.stroke();
    ell(ctx, x + w - 2, y + h * 0.5, 0.8, 0.8); fs(ctx, '#ffd54f', 0.4);
  }
}

function socketPlate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  rr(ctx, x - 2.4, y - 2.4, 4.8, 4.8, 0.6); fs(ctx, '#f5f5f5', 0.5);
  ctx.fillStyle = INK; ctx.fillRect(x - 1.2, y - 1, 0.7, 1.4); ctx.fillRect(x + 0.5, y - 1, 0.7, 1.4);
}

function rug(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, col: string) {
  ell(ctx, x, y, rx, ry); fs(ctx, col, 0.6);
  ell(ctx, x, y, rx * 0.78, ry * 0.7); ctx.lineWidth = 0.4; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
}

function plant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath(); ctx.moveTo(x - 3, y - 6); ctx.lineTo(x + 3, y - 6); ctx.lineTo(x + 2.4, y); ctx.lineTo(x - 2.4, y); ctx.closePath(); fs(ctx, '#c0643a', 0.6);
  ctx.fillStyle = '#5b9e5a';
  for (const [dx, dy] of [[-3, -10], [0, -13], [3, -10], [-1.5, -8], [1.8, -8]]) { ell(ctx, x + dx, y + dy, 1.6, 3); ctx.fill(); ctx.lineWidth = 0.4; ctx.strokeStyle = INK; ctx.stroke(); }
}

export interface RoomVisualState { doors: Record<string, boolean>; bowlFull: boolean; night: boolean; seated: Set<string> }

export function drawRoomBack(ctx: CanvasRenderingContext2D, id: RoomId, v: RoomVisualState) {
  shell(ctx, id);
  switch (id) {
    case 'kitchen': {
      windowAt(ctx, 26, 8, 20, 16, v.night);
      // Wall cupboard with the treats
      rr(ctx, 8, 24, 24, 20, 0.6); fs(ctx, '#e0c49a');
      ctx.beginPath(); ctx.moveTo(20, 24); ctx.lineTo(20, 44); ctx.lineWidth = 0.5; ctx.stroke();
      ell(ctx, 17.5, 34, 0.7, 0.7); fs(ctx, '#ffd54f', 0.3); ell(ctx, 22.5, 34, 0.7, 0.7); fs(ctx, '#ffd54f', 0.3);
      // Fridge
      rr(ctx, 64, 20, 20, 38, 1.6); fs(ctx, '#eef2f4');
      ctx.beginPath(); ctx.moveTo(64, 34); ctx.lineTo(84, 34); ctx.lineWidth = 0.5; ctx.stroke();
      rr(ctx, 80, 26, 1.2, 5, 0.5); fs(ctx, '#90a4ae', 0.3); rr(ctx, 80, 38, 1.2, 8, 0.5); fs(ctx, '#90a4ae', 0.3);
      // Worktop with hob
      rr(ctx, 34, 44, 30, 14, 0.6); fs(ctx, '#c49a6c');
      rr(ctx, 33, 42, 32, 3, 0.6); fs(ctx, '#f3efe8');
      ell(ctx, 56, 43.5, 3, 0.8); fs(ctx, '#424242', 0.4);
      rr(ctx, 36, 47, 12, 9, 0.4); ctx.lineWidth = 0.4; ctx.stroke(); rr(ctx, 50, 47, 12, 9, 0.4); ctx.stroke();
      // Back door
      drawDoor(ctx, 82, 26, 13, 34, v.doors.back);
      rr(ctx, 85, 30, 7, 7, 0.3); fs(ctx, v.doors.back ? 'rgba(0,0,0,0)' : '#bfe6ff', 0.4);
      // Table and chair
      rr(ctx, 66, 84, 30, 4, 0.6); fs(ctx, '#a0714a');
      rr(ctx, 68, 88, 2, 26, 0.4); fs(ctx, '#8a5d3a', 0.5); rr(ctx, 92, 88, 2, 26, 0.4); fs(ctx, '#8a5d3a', 0.5);
      rr(ctx, 68, 98, 14, 3, 0.6); fs(ctx, '#c08a5a'); rr(ctx, 79, 88, 3, 12, 0.4); fs(ctx, '#c08a5a', 0.6);
      rug(ctx, 44, 118, 12, 4.2, '#d98c5f');
      break;
    }
    case 'living': {
      windowAt(ctx, 30, 6, 16, 18, v.night);
      // Ornament shelf
      rr(ctx, 8, 28, 22, 2.2, 0.4); fs(ctx, '#8d6e63');
      // TV on a stand
      rr(ctx, 44, 36, 24, 14, 1); fs(ctx, '#263238');
      rr(ctx, 46, 38, 20, 10, 0.6); fs(ctx, v.night ? '#4fc3f7' : '#37474f', 0.4);
      rr(ctx, 46, 50, 20, 6, 0.6); fs(ctx, '#795548');
      // Door
      drawDoor(ctx, 84, 14, 12, 34, v.doors.hall);
      // Sofa
      rr(ctx, 12, 60, 36, 12, 3); fs(ctx, '#7e57c2');
      rr(ctx, 12, 70, 36, 10, 2); fs(ctx, '#9575cd');
      rr(ctx, 9, 64, 6, 18, 2.5); fs(ctx, '#7e57c2'); rr(ctx, 45, 64, 6, 18, 2.5); fs(ctx, '#7e57c2');
      // Armchair (the throne)
      rr(ctx, 70, 60, 20, 14, 3); fs(ctx, '#c0504d');
      rr(ctx, 70, 72, 20, 10, 2); fs(ctx, '#d4706c');
      rr(ctx, 67, 66, 5, 17, 2.4); fs(ctx, '#c0504d'); rr(ctx, 88, 66, 5, 17, 2.4); fs(ctx, '#c0504d');
      rug(ctx, 52, 96, 26, 9, '#4db6ac');
      // Toy basket
      rr(ctx, 50, 114, 12, 7, 2); fs(ctx, '#d7b377');
      ell(ctx, 53, 113, 2.4, 2.4); fs(ctx, '#e040fb', 0.5); ell(ctx, 58, 112.5, 2, 2); fs(ctx, '#ffca28', 0.5);
      socketPlate(ctx, 28, 122);
      plant(ctx, 4, 112);
      break;
    }
    case 'study': {
      windowAt(ctx, 12, 8, 20, 16, v.night);
      // Bookshelf
      rr(ctx, 78, 6, 16, 40, 0.6); fs(ctx, '#8d6e63');
      for (let i = 0; i < 4; i++) {
        rr(ctx, 78, 14 + i * 9, 16, 1.4, 0.2); fs(ctx, '#6d4c41', 0.4);
        const cols = ['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8'];
        for (let b = 0; b < 5; b++) { rr(ctx, 79.5 + b * 2.8, 8 + i * 9, 2.2, 6, 0.2); fs(ctx, cols[(b + i) % 5], 0.3); }
      }
      drawDoor(ctx, 84, 48, 12, 28, v.doors.study);
      // Desk with laptop
      rr(ctx, 40, 52, 38, 3, 0.6); fs(ctx, '#a1887f');
      rr(ctx, 42, 55, 2.4, 20, 0.4); fs(ctx, '#8d6e63', 0.5); rr(ctx, 74, 55, 2.4, 20, 0.4); fs(ctx, '#8d6e63', 0.5);
      rr(ctx, 51, 44, 14, 8, 0.8); fs(ctx, '#90a4ae'); rr(ctx, 52, 45, 12, 6, 0.4); fs(ctx, '#e3f2fd', 0.3);
      rr(ctx, 50, 51.5, 16, 1.6, 0.4); fs(ctx, '#cfd8dc', 0.5);
      // Desk chair
      rr(ctx, 50, 78, 16, 3.4, 1); fs(ctx, '#455a64'); rr(ctx, 62, 64, 4, 16, 1); fs(ctx, '#455a64');
      rr(ctx, 57, 81, 2, 8, 0.4); fs(ctx, '#263238', 0.4);
      // Reading chair
      rr(ctx, 8, 56, 20, 12, 3); fs(ctx, '#558b6e'); rr(ctx, 8, 66, 20, 8, 2); fs(ctx, '#6fa588');
      rug(ctx, 34, 104, 20, 7, '#ffb74d');
      socketPlate(ctx, 10, 104);
      break;
    }
    case 'bedroom': {
      windowAt(ctx, 30, 4, 20, 14, v.night);
      // Wardrobe
      rr(ctx, 78, 18, 18, 42, 0.6); fs(ctx, '#bcaaa4');
      ctx.beginPath(); ctx.moveTo(87, 18); ctx.lineTo(87, 60); ctx.lineWidth = 0.5; ctx.stroke();
      // Dressing table
      rr(ctx, 58, 34, 16, 2.4, 0.4); fs(ctx, '#d7ccc8');
      rr(ctx, 60, 36, 12, 10, 0.4); fs(ctx, '#bcaaa4');
      rr(ctx, 61, 22, 10, 11, 4); fs(ctx, '#e1f5fe', 0.6);
      drawDoor(ctx, 2, 34, 12, 34, v.doors.bed);
      // Bed
      rr(ctx, 20, 40, 5, 30, 1.2); fs(ctx, '#8d6e63');
      rr(ctx, 22, 48, 52, 32, 3); fs(ctx, '#f8bbd0');
      rr(ctx, 40, 54, 34, 26, 3); fs(ctx, '#f48fb1');
      ell(ctx, 32, 52, 7, 4); fs(ctx, '#ffffff');
      rr(ctx, 22, 80, 52, 4, 0.6); fs(ctx, '#d7a3b8');
      rr(ctx, 26, 84, 44, 10, 0.4); ctx.fillStyle = 'rgba(30,15,10,0.55)'; ctx.fill();
      // Washing basket
      rr(ctx, 72, 94, 16, 10, 2); fs(ctx, '#e0e0e0');
      ell(ctx, 76, 93, 3.4, 2); fs(ctx, '#90caf9', 0.5); ell(ctx, 82, 92.6, 3.6, 2.2); fs(ctx, '#fff59d', 0.5);
      rug(ctx, 18, 118, 12, 4, '#9fa8da');
      break;
    }
    case 'hallway': {
      drawDoor(ctx, 4, 16, 18, 40, v.doors.front, '#2e7d6b');
      rr(ctx, 9, 20, 8, 6, 2); fs(ctx, '#bfe6ff', 0.4);
      // Hall table
      rr(ctx, 30, 46, 20, 2.4, 0.4); fs(ctx, '#8d6e63');
      rr(ctx, 31, 48, 2, 14, 0.3); fs(ctx, '#6d4c41', 0.4); rr(ctx, 47, 48, 2, 14, 0.3); fs(ctx, '#6d4c41', 0.4);
      rr(ctx, 32, 28, 16, 14, 1); fs(ctx, '#ffe0b2');
      // Staircase rising to the back
      for (let i = 0; i < 9; i++) {
        const y = 96 - i * 9;
        rr(ctx, 66 + i * 0.8, y, 30 - i * 0.8, 9, 0.3); fs(ctx, i % 2 ? '#a1887f' : '#bcaaa4', 0.5);
      }
      rr(ctx, 64, 14, 2, 86, 0.6); fs(ctx, '#6d4c41');
      // Under-stairs cupboard
      rr(ctx, 46, 84, 20, 22, 0.6); fs(ctx, '#d7ccc8');
      rr(ctx, 48, 86, 16, 18, 0.4); ctx.fillStyle = 'rgba(30,15,10,0.55)'; ctx.fill();
      // Shoe rack
      rr(ctx, 16, 102, 20, 2, 0.3); fs(ctx, '#795548', 0.5);
      rr(ctx, 16, 108, 20, 2, 0.3); fs(ctx, '#795548', 0.5);
      rug(ctx, 20, 80, 11, 5, '#a1887f');
      socketPlate(ctx, 92, 122);
      plant(ctx, 52, 62);
      break;
    }
  }
}

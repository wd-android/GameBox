import { INK } from './palette';

function fs(ctx: CanvasRenderingContext2D, fill: string, w = 0.6) {
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke();
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

/**
 * One small, readable drawing per knock-off-able object. (x, y) is the base; about 6 units tall.
 * `broken` draws it in pieces.
 */
export function drawObject(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, opts: { broken?: boolean; outline?: boolean; rot?: number } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.outline) {
    ctx.globalAlpha = 0.35;
  }
  if (opts.broken) {
    ctx.fillStyle = colourOf(kind);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
    const shards: [number, number, number][] = [[-3, -0.5, 0.4], [0.5, -1, -0.7], [3, -0.3, 1.2], [-1, -1.6, 2]];
    for (const [sx, sy, r] of shards) {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(r);
      ctx.beginPath(); ctx.moveTo(-1.2, 0.6); ctx.lineTo(0, -1); ctx.lineTo(1.3, 0.7); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    return;
  }
  switch (kind) {
    case 'mug':
      rr(ctx, -2.6, -5, 5, 5, 0.8); fs(ctx, '#f4f1ea');
      ctx.beginPath(); ctx.arc(2.6, -2.6, 1.4, -Math.PI / 2, Math.PI / 2); ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke();
      rr(ctx, -1.6, -3.6, 3, 1.6, 0.5); fs(ctx, '#e86a9a', 0.3);
      break;
    case 'egg': ell(ctx, 0, -2.8, 2, 2.8); fs(ctx, '#fff6e0'); break;
    case 'saltShaker': rr(ctx, -1.6, -6, 3.2, 6, 1); fs(ctx, '#ffffff'); rr(ctx, -1.6, -6.6, 3.2, 1.4, 0.6); fs(ctx, '#bdbdbd'); break;
    case 'spoon': ctx.save(); ctx.rotate(-0.6); rr(ctx, -0.4, -6, 0.8, 5, 0.3); fs(ctx, '#cfd8dc'); ell(ctx, 0, -6.4, 1.2, 1.6); fs(ctx, '#cfd8dc'); ctx.restore(); break;
    case 'tomato': ell(ctx, 0, -2.4, 2.8, 2.4); fs(ctx, '#e53935'); ctx.fillStyle = '#43a047'; ell(ctx, 0, -4.8, 1.2, 0.5); ctx.fill(); break;
    case 'vase':
      ctx.beginPath(); ctx.moveTo(-1.4, 0); ctx.quadraticCurveTo(-3.6, -3, -1.2, -6); ctx.lineTo(-1, -7.5); ctx.lineTo(1, -7.5); ctx.lineTo(1.2, -6); ctx.quadraticCurveTo(3.6, -3, 1.4, 0); ctx.closePath(); fs(ctx, '#4fc3f7');
      ctx.fillStyle = '#ff7043'; ell(ctx, -1, -8.6, 1.1, 1.1); ctx.fill(); ell(ctx, 1.2, -9, 1.1, 1.1); ctx.fill();
      break;
    case 'remote': rr(ctx, -1.3, -6, 2.6, 6, 0.8); fs(ctx, '#37474f'); ctx.fillStyle = '#ef5350'; ell(ctx, 0, -5, 0.5, 0.5); ctx.fill(); break;
    case 'photoFrame': rr(ctx, -3, -6, 6, 6, 0.4); fs(ctx, '#8d6e63'); rr(ctx, -2, -5, 4, 4, 0.2); fs(ctx, '#ffcc80', 0.3); break;
    case 'candle': rr(ctx, -1.2, -5, 2.4, 5, 0.4); fs(ctx, '#fff9c4'); ctx.fillStyle = '#ffb300'; ell(ctx, 0, -6.2, 0.7, 1.1); ctx.fill(); break;
    case 'snowGlobe': ell(ctx, 0, -4, 2.8, 2.8); fs(ctx, 'rgba(179,229,252,0.9)'); rr(ctx, -2.4, -1.4, 4.8, 1.6, 0.4); fs(ctx, '#6d4c41'); break;
    case 'pen': ctx.save(); ctx.rotate(-0.4); rr(ctx, -0.5, -6.5, 1, 6, 0.3); fs(ctx, '#1e88e5'); ctx.restore(); break;
    case 'glasses':
      ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
      ell(ctx, -1.8, -1.6, 1.5, 1.2); fs(ctx, 'rgba(200,230,255,0.7)');
      ell(ctx, 1.8, -1.6, 1.5, 1.2); fs(ctx, 'rgba(200,230,255,0.7)');
      break;
    case 'headphones':
      ctx.beginPath(); ctx.arc(0, -3, 3, Math.PI, 0); ctx.lineWidth = 0.9; ctx.strokeStyle = INK; ctx.stroke();
      rr(ctx, -3.8, -3.2, 1.8, 3, 0.6); fs(ctx, '#7e57c2'); rr(ctx, 2, -3.2, 1.8, 3, 0.6); fs(ctx, '#7e57c2');
      break;
    case 'stapler': rr(ctx, -3, -2.4, 6, 2.4, 0.6); fs(ctx, '#c62828'); rr(ctx, -3, -3.4, 5.6, 1.2, 0.5); fs(ctx, '#e53935'); break;
    case 'plantPot':
      ctx.beginPath(); ctx.moveTo(-2.2, -3); ctx.lineTo(2.2, -3); ctx.lineTo(1.6, 0); ctx.lineTo(-1.6, 0); ctx.closePath(); fs(ctx, '#d84315');
      ctx.fillStyle = '#43a047'; for (const a of [-0.6, 0, 0.6]) { ell(ctx, Math.sin(a) * 2.2, -5, 0.9, 2.2, a); ctx.fill(); }
      break;
    case 'perfume': rr(ctx, -2, -4, 4, 4, 1); fs(ctx, '#f8bbd0'); rr(ctx, -0.6, -5.4, 1.2, 1.4, 0.3); fs(ctx, '#ffd54f'); break;
    case 'lipstick': rr(ctx, -1, -3, 2, 3, 0.3); fs(ctx, '#212121'); rr(ctx, -0.7, -5, 1.4, 2, 0.6); fs(ctx, '#d81b60'); break;
    case 'earring': ctx.beginPath(); ctx.arc(0, -2, 1.6, 0, Math.PI * 2); ctx.lineWidth = 0.7; ctx.strokeStyle = '#ffca28'; ctx.stroke(); ell(ctx, 0, -0.4, 0.7, 0.7); fs(ctx, '#29b6f6', 0.3); break;
    case 'alarmClock': ell(ctx, 0, -3, 2.8, 2.8); fs(ctx, '#ffee58'); ell(ctx, 0, -3, 2, 2); fs(ctx, '#ffffff', 0.3); ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, -4.4); ctx.moveTo(0, -3); ctx.lineTo(1, -3); ctx.strokeStyle = INK; ctx.stroke(); break;
    case 'sock': ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(1.4, -6); ctx.lineTo(1.4, -2); ctx.quadraticCurveTo(4, -1.5, 3.4, 0); ctx.lineTo(-1, 0); ctx.closePath(); fs(ctx, '#ab47bc'); break;
    case 'keys': ell(ctx, -1.4, -2.4, 1.4, 1.4); fs(ctx, '#ffd54f'); rr(ctx, -0.2, -2.8, 4, 0.9, 0.3); fs(ctx, '#ffd54f', 0.4); break;
    case 'figurine': ell(ctx, 0, -5.6, 1.3, 1.3); fs(ctx, '#fafafa'); ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(0, -4.6); ctx.lineTo(2, 0); ctx.closePath(); fs(ctx, '#90caf9'); break;
    case 'coaster': ell(ctx, 0, -0.6, 3, 1); fs(ctx, '#a1887f'); break;
    case 'glove': rr(ctx, -2, -5, 4, 5, 1.2); fs(ctx, '#ef5350'); rr(ctx, 1.6, -4, 1.6, 2.4, 0.8); fs(ctx, '#ef5350', 0.4); break;
    default: rr(ctx, -2, -4, 4, 4, 1); fs(ctx, '#9e9e9e');
  }
  ctx.restore();
}

function colourOf(kind: string) {
  const m: Record<string, string> = {
    mug: '#f4f1ea', egg: '#fff6e0', tomato: '#e53935', vase: '#4fc3f7', photoFrame: '#ffcc80', snowGlobe: '#b3e5fc',
    glasses: '#c8e6ff', plantPot: '#d84315', perfume: '#f8bbd0', figurine: '#90caf9',
  };
  return m[kind] ?? '#bdbdbd';
}

/** Demand icons: each has its own shape, not just a colour (concept §15) */
export function drawDemandIcon(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  switch (kind) {
    case 'food':
      ctx.beginPath(); ctx.moveTo(-4, -1); ctx.lineTo(4, -1); ctx.lineTo(3, 2); ctx.lineTo(-3, 2); ctx.closePath(); fs(ctx, '#ff7043');
      ctx.fillStyle = '#8d5524'; for (const fx of [-2, 0, 2]) { ell(ctx, fx, -1.6, 1, 0.8); ctx.fill(); }
      break;
    case 'door':
      rr(ctx, -2.6, -4, 5.2, 7.6, 0.4); fs(ctx, '#a1887f');
      ctx.fillStyle = '#ffd54f'; ell(ctx, 1.4, 0, 0.6, 0.6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(5.6, 0); ctx.lineTo(4, 1); ctx.fillStyle = INK; ctx.fill();
      break;
    case 'lap':
      rr(ctx, -4.6, -1, 7, 2.6, 1.2); fs(ctx, '#5b6fb0');
      rr(ctx, 1.6, -1, 2.4, 5, 1); fs(ctx, '#5b6fb0');
      ctx.fillStyle = '#ff8a1f'; ell(ctx, -1.6, -2.6, 2.6, 1.6); ctx.fill(); ctx.stroke();
      break;
    case 'play':
      ell(ctx, 0, 0, 3.2, 3.2); fs(ctx, '#e040fb');
      ctx.strokeStyle = '#7b1fa2'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(-3, -1); ctx.quadraticCurveTo(0, 1, 3, -1); ctx.moveTo(-2.4, 1.6); ctx.quadraticCurveTo(0, 3, 2.6, 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, 1); ctx.quadraticCurveTo(6, 2, 5, 5); ctx.strokeStyle = INK; ctx.lineWidth = 0.4; ctx.stroke();
      break;
  }
  ctx.restore();
}

export function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1, ghost = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-4, 0); ctx.lineTo(-4, -3.4); ctx.lineTo(-2, -1.6); ctx.lineTo(0, -4.4); ctx.lineTo(2, -1.6); ctx.lineTo(4, -3.4); ctx.lineTo(4, 0); ctx.closePath();
  if (ghost) {
    ctx.setLineDash([0.8, 0.8]); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(); ctx.setLineDash([]);
  } else {
    fs(ctx, '#ffca28', 0.6);
    ctx.fillStyle = '#e53935'; ell(ctx, 0, -1.2, 0.7, 0.7); ctx.fill();
  }
  ctx.restore();
}

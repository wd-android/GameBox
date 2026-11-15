import type { Cube } from '../maze/generator';
import { Face, cellFace } from '../maze/topology';

/** The six faces unfolded (§8): visited faces marked, the current face lit, the finish flagged. */
const NET: Record<number, [number, number]> = {
  [Face.NZ]: [1, 0],
  [Face.NX]: [0, 1],
  [Face.PY]: [1, 1],
  [Face.PX]: [2, 1],
  [Face.PZ]: [1, 2],
  [Face.NY]: [1, 3],
};

export class Minimap {
  readonly canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private key = '';

  constructor(private n: number) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = 3 * 22 * dpr;
    this.canvas.height = 4 * 22 * dpr;
    this.canvas.style.width = '66px';
    this.canvas.style.height = '88px';
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  draw(cube: Cube, face: number, visited: Set<number>): void {
    const key = `${face}|${[...visited].join(',')}`;
    if (key === this.key) return;
    this.key = key;
    const ctx = this.ctx;
    const s = 22;
    ctx.clearRect(0, 0, 66, 88);
    const finishFace = cellFace(this.n, cube.finish);
    for (let f = 0; f < 6; f++) {
      const [cx, cy] = NET[f];
      const x = cx * s + 1;
      const y = cy * s + 1;
      ctx.fillStyle = f === face ? '#06ffff' : visited.has(f) ? 'rgba(146,89,254,0.85)' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, s - 2, s - 2, 4);
      ctx.fill();
      ctx.stroke();
      if (f === finishFace) {
        ctx.fillStyle = f === face ? '#1b043b' : '#ffc93c';
        ctx.beginPath();
        ctx.arc(x + s / 2 - 1, y + s / 2 - 1, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

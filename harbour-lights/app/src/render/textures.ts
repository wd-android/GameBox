import { Texture } from 'pixi.js';

/** Soft radial textures made once from a canvas (fog, glows, lantern halos). */
const cache = new Map<string, Texture>();

export function radial(colour: string, stops: [number, number][] = [[0, 1], [1, 0]], size = 128): Texture {
  const key = colour + JSON.stringify(stops) + size;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const [r, gr, b] = hexRgb(colour);
  for (const [o, a] of stops) grad.addColorStop(o, `rgba(${r},${gr},${b},${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = Texture.from(c);
  cache.set(key, t);
  return t;
}

function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

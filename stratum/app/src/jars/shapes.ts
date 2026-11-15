import { buildMask, type JarMask } from '../sand/grid';
import { TUNING } from '../config/tuning';

/** The three v1 jar shapes (§8.1). Each is a mask plus a glass outline. */
export type ShapeId = 'straight' | 'round-bottle' | 'tall-vase';

export interface ShapeDef {
  id: ShapeId;
  name: string;
  unlockJar: number;
  top: number;
  bottom: number;
  fill: number;
  halfWidth: (y: number) => number;
}

const H = TUNING.GRID_H;
const BOTTOM = H - 3;

function roundedBottom(hw: number, r: number, y: number): number {
  const fromBottom = BOTTOM - y;
  if (fromBottom >= r) return hw;
  const dy = r - fromBottom - 0.5;
  return hw - r + Math.sqrt(Math.max(0, r * r - dy * dy));
}

export const SHAPES: Record<ShapeId, ShapeDef> = {
  straight: {
    id: 'straight',
    name: 'Straight jar',
    unlockJar: 1,
    top: 6,
    bottom: BOTTOM,
    fill: 14,
    halfWidth: (y) => roundedBottom(45, 6, y),
  },
  'round-bottle': {
    id: 'round-bottle',
    name: 'Round bottle',
    unlockJar: 26,
    top: 6,
    bottom: BOTTOM,
    fill: 14,
    halfWidth: (y) => {
      const neck = 13;
      const body = 45;
      const neckEnd = 26;
      const shoulderEnd = 52;
      if (y < neckEnd) return neck;
      if (y < shoulderEnd) {
        // Elliptical shoulder from neck to body.
        const t = (y - neckEnd) / (shoulderEnd - neckEnd);
        return neck + (body - neck) * Math.sqrt(1 - (1 - t) * (1 - t));
      }
      return roundedBottom(body, 16, y);
    },
  },
  'tall-vase': {
    id: 'tall-vase',
    name: 'Tall vase',
    unlockJar: 51,
    top: 6,
    bottom: BOTTOM,
    fill: 14,
    halfWidth: (y) => {
      const waist = 21;
      const lip = 38;
      const flareEnd = 40;
      if (y < flareEnd) {
        const t = (flareEnd - y) / (flareEnd - 6);
        return waist + (lip - waist) * t * t;
      }
      // Gentle belly towards the base.
      const t = (y - flareEnd) / (BOTTOM - flareEnd);
      const u = t * 0.85;
      return roundedBottom(waist + 16 * u * (1 - u), 5, y);
    },
  },
};

const cache = new Map<ShapeId, JarMask>();

export function maskFor(shape: ShapeId): JarMask {
  let m = cache.get(shape);
  if (!m) {
    const s = SHAPES[shape];
    m = buildMask(s.halfWidth, s.top, s.bottom, s.fill);
    cache.set(shape, m);
  }
  return m;
}

export const SHAPE_ORDER: ShapeId[] = ['straight', 'round-bottle', 'tall-vase'];

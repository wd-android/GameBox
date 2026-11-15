import { decodeGrid } from '../sand/rle';
import { maskFor } from './shapes';
import type { JarDef } from './types';

/** The target picture of a jar as a grid. */
export function targetGrid(def: JarDef): Uint8Array {
  const m = maskFor(def.shape);
  return decodeGrid(def.target, m.w * m.h);
}

import { TUNING } from '../config/tuning';
import type { JarMask } from './grid';

/**
 * For every cell, a bitmask of the colours the target holds within the
 * tolerance distance (§6.7). Bit (c-1) is set for colour c.
 */
export function toleranceMap(target: Uint8Array, mask: JarMask, tol = TUNING.SCORE_TOLERANCE): Uint8Array {
  const { w, h } = mask;
  // Horizontal pass then vertical pass (separable square dilation).
  const horiz = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let bits = 0;
      for (let dx = -tol; dx <= tol; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const c = target[y * w + xx];
        if (c) bits |= 1 << (c - 1);
      }
      horiz[y * w + x] = bits;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let bits = 0;
      for (let dy = -tol; dy <= tol; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        bits |= horiz[yy * w + x];
      }
      out[y * w + x] = bits;
    }
  }
  return out;
}

/**
 * Share of the cells inside the jar, up to the fill line, that match the target.
 * Empty cells count as wrong, except where the target itself is empty in that
 * exact cell (pockets such as a bottle's shoulders that the designer's pour
 * also left empty) – otherwise the designer's own pour could not reach 97%.
 */
export function accuracy(cells: Uint8Array, tolMap: Uint8Array, mask: JarMask, target?: Uint8Array): number {
  const { w, h, inside, fillRow } = mask;
  let total = 0;
  let correct = 0;
  for (let i = fillRow * w; i < w * h; i++) {
    if (!inside[i]) continue;
    total++;
    const c = cells[i];
    if (c) {
      if (tolMap[i] & (1 << (c - 1))) correct++;
    } else if (target && target[i] === 0) {
      correct++;
    }
  }
  return total ? correct / total : 0;
}

export function starsFor(acc: number): number {
  if (acc >= TUNING.STAR_3) return 3;
  if (acc >= TUNING.STAR_2) return 2;
  if (acc >= TUNING.STAR_1) return 1;
  return 0;
}

/**
 * Boundaries between colours in the target, for the guide lines on the glass
 * (§6.9). Returns a 0/1 map of cells that sit on a colour change.
 */
export function guideLines(target: Uint8Array, mask: JarMask): Uint8Array {
  const { w, h, inside } = mask;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      if (!inside[i]) continue;
      const c = target[i];
      const r = target[i + 1];
      const d = target[i + w];
      if ((inside[i + w] && d !== c && d && c) || (inside[i + 1] && r !== c && r && c)) out[i] = 1;
    }
  }
  return out;
}

import type { Vec3 } from '../maze/topology';

/**
 * Cube orientation (§7.8): a 3 × 3 matrix of whole numbers (row-major) that
 * converts cube axes to world axes. World axes: X = screen right, Y = up
 * (towards the camera above), Z = towards the player (screen down).
 */
export type Mat3 = number[];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/** Transpose (= inverse for a rotation): world → cube. */
export function applyT(m: Mat3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
}

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const r: Mat3 = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

/** +90° rotation about a whole-number unit axis k: I + K + K² (Rodrigues with sin = 1, 1 − cos = 1). */
export function quarterTurn(k: Vec3): Mat3 {
  const K: Mat3 = [0, -k[2], k[1], k[2], 0, -k[0], -k[1], k[0], 0];
  const K2 = multiply(K, K);
  return IDENTITY.map((v, i) => v + K[i] + K2[i]);
}

/**
 * The orientation after the cube rolls so that the face whose normal is the
 * cube-axis direction `d` comes to the top (§7.7).
 */
export function rollTowards(m: Mat3, d: Vec3): Mat3 {
  const D = apply(m, d);
  // Axis = D × up.
  const k: Vec3 = [D[1] * 0 - D[2] * 1, D[2] * 0 - D[0] * 0, D[0] * 1 - D[1] * 0];
  return multiply(quarterTurn(k), m);
}

export function determinant(m: Mat3): number {
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
}

/** One of the 24 cube rotations: a signed permutation matrix with determinant +1. */
export function isValidOrientation(m: Mat3): boolean {
  if (m.length !== 9 || determinant(m) !== 1) return false;
  for (let r = 0; r < 3; r++) {
    let nz = 0;
    for (let c = 0; c < 3; c++) {
      const v = m[r * 3 + c];
      if (v !== 0 && v !== 1 && v !== -1) return false;
      if (v !== 0) nz++;
    }
    if (nz !== 1) return false;
  }
  return true;
}

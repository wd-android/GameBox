import { clamp } from './band';

/** Attention is kept between 0 and 100. */
export function addAttention(a: number, v: number) {
  return clamp(a + v, 0, 100);
}

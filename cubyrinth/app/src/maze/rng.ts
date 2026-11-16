/** mulberry32 – whole-number arithmetic only, identical on every device (§6.3). */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  float(): number {
    return this.next() / 4294967296;
  }

  int(k: number): number {
    return Math.floor(this.float() * k);
  }

  pick<T>(list: readonly T[]): T {
    return list[this.int(list.length)];
  }
}

/** Mixes several whole numbers into one 32-bit seed. */
export function hash(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h ^= h >>> 12;
  }
  return h >>> 0;
}

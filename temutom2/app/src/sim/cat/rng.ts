/** Seeded generator (mulberry32). The state lives in the shift so a shift is fully reproducible. */
export interface Rng { s: number }

export function makeRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

export function next(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(r: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * next(r);
}

export function chance(r: Rng, p: number): boolean {
  return next(r) < p;
}

export function pick<T>(r: Rng, items: readonly T[]): T {
  return items[Math.floor(next(r) * items.length) % items.length];
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

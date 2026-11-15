import { TUNING } from '../config/tuning';
import type { Chunk } from './chunk';

/** Seeded generator (mulberry32) so a run's sky follows from its seed. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
}

export function tierAt(seconds: number): number {
  let tier = 1;
  TUNING.TIER_FROM_S.forEach((from, i) => {
    if (seconds >= from) tier = i + 1;
  });
  return tier;
}

/**
 * Choosing chunks (§7.2): at random from the current tier and the one below,
 * never repeating either of the last two. A roost-tree chunk is forced once
 * 35 seconds have passed without one, and avoided for 25 seconds after one.
 */
export class Spawner {
  private recent: string[] = [];
  lastTreeAt = 0;
  /** Scripted chunks to use first (the first-launch run). */
  queue: Chunk[] = [];

  constructor(
    private chunks: Chunk[],
    private rng: Rng,
  ) {}

  next(seconds: number): Chunk {
    const scripted = this.queue.shift();
    if (scripted) {
      if (scripted.tree) this.lastTreeAt = seconds;
      return scripted;
    }
    const tier = tierAt(seconds);
    let pool = this.chunks.filter((c) => (c.tier === tier || c.tier === tier - 1) && !this.recent.includes(c.id));
    const sinceTree = seconds - this.lastTreeAt;
    if (sinceTree >= TUNING.TREE_FORCE_S) {
      const trees = pool.filter((c) => c.tree);
      const anyTrees = this.chunks.filter((c) => c.tree && c.tier <= tier && !this.recent.includes(c.id));
      pool = trees.length ? trees : anyTrees.length ? anyTrees : pool;
    } else if (sinceTree < TUNING.TREE_EVERY_MIN_S) {
      const noTrees = pool.filter((c) => !c.tree);
      if (noTrees.length) pool = noTrees;
    }
    if (!pool.length) pool = this.chunks.filter((c) => c.tier <= tier);
    const chunk = this.rng.pick(pool);
    if (chunk.tree) this.lastTreeAt = seconds;
    this.recent.push(chunk.id);
    if (this.recent.length > 2) this.recent.shift();
    return chunk;
  }
}

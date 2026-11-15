/** Every tuning constant (spec: "lives in one configuration file"). */
export const TUNING = {
  // ── Fairness (§5.2) ────────────────────────────────────────
  MAX_ATTEMPTS: 100,
  /** "Suppose this, then…" steps the deduction solver may take, by chapter (risk §17). */
  DEDUCTION_DEPTH: { 1: 0, 2: 1 } as Record<number, number>,

  // ── Padlock (§6.1) ─────────────────────────────────────────
  PADLOCK_MAX_CLUES_TRIED: 8,
  PADLOCK_CLUES_MIN: 3,
  PADLOCK_CLUES_MAX: 6,

  // ── Bottles (§6.2) ─────────────────────────────────────────
  /** Allowed clue counts by number of bottles. */
  BOTTLE_CLUE_BAND: { 3: [2, 3], 4: [2, 4], 5: [3, 6], 6: [4, 7], 7: [5, 9], 8: [6, 10] } as Record<number, [number, number]>,

  // ── Rings (§6.3) ───────────────────────────────────────────
  RING_SCRAMBLE_TURNS: 20,
  /** Shortest-solution bands by number of rings. */
  RING_SHORTEST_BAND: { 2: [3, 8], 3: [4, 10], 4: [5, 12], 5: [6, 14] } as Record<number, [number, number]>,

  // ── Bolts (§6.4) ───────────────────────────────────────────
  /** Shortest-solution bands by bolt count. */
  BOLT_SHORTEST_BAND: { 4: [2, 5], 5: [3, 6], 6: [3, 8], 7: [4, 9], 8: [5, 10], 9: [5, 12], 10: [6, 14], 11: [6, 16], 12: [7, 18] } as Record<number, [number, number]>,

  // ── Locksmith limits (§8.2) ────────────────────────────────
  LIMIT_DEDUCED: 3,
  LIMIT_PADLOCK_FEEDBACK: { 3: 7, 4: 8, 5: 10 } as Record<number, number>,
  LIMIT_BOTTLES_FEEDBACK: { 3: 6, 4: 6, 5: 8, 6: 8, 7: 10, 8: 10 } as Record<number, number>,
  LIMIT_RINGS_FACTOR: 3,
  LIMIT_BOLTS_FACTOR: 2.5,

  // ── Stars (§8.3) ───────────────────────────────────────────
  MOVES_3_STARS: 1.25,
  MOVES_2_STARS: 2,
  PAR_EXTRA_2_STARS: 2,

  // ── Hints (§10) ────────────────────────────────────────────
  NUDGE_COST: 30,
  CLUE_COST: 20,
  HINTS_PER_LOCK: 2,
  CLUE_MIN_CUT: 0.25,

  // ── Rewards (§9.2, §11) ────────────────────────────────────
  REPLAY_COIN_FACTOR: 0.2,
  SET_REWARD: 100,
  CHAPTER2_UNLOCK: 24,
  RANKS: [
    ['Apprentice', 0],
    ['Journeyman', 30],
    ['Locksmith', 75],
    ['Safecracker', 120],
    ['Master', 165],
  ] as [string, number][],

  // ── Calibration (§8.3) ─────────────────────────────────────
  CALIBRATION_SAMPLES: 1000,
} as const;

export type Tier = 'wooden' | 'iron' | 'silver' | 'gold';

export const TIER_REWARDS: Record<Tier, { coins: [number, number]; trinket: number; rare: number }> = {
  wooden: { coins: [10, 25], trinket: 0.4, rare: 0 },
  iron: { coins: [20, 50], trinket: 0.6, rare: 0.05 },
  silver: { coins: [40, 90], trinket: 0.8, rare: 0.1 },
  gold: { coins: [80, 160], trinket: 1, rare: 0.2 },
};

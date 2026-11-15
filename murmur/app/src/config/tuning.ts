/** Every tuning constant (spec: "lives in one configuration file"). */
export type SpeciesId = 'starlings' | 'swallows' | 'geese';

export interface Species {
  id: SpeciesId;
  name: string;
  leaderSpeed: number;
  spacing: number;
  spreadMax: number;
  pointsPerBird: number;
  /** Total birds gathered needed to unlock. */
  unlockGathered: number;
  vShape: boolean;
}

export const SPECIES: Record<SpeciesId, Species> = {
  starlings: { id: 'starlings', name: 'Starlings', leaderSpeed: 9, spacing: 0.12, spreadMax: 1.2, pointsPerBird: 1.0, unlockGathered: 0, vShape: false },
  swallows: { id: 'swallows', name: 'Swallows', leaderSpeed: 12, spacing: 0.1, spreadMax: 0.7, pointsPerBird: 0.8, unlockGathered: 500, vShape: false },
  geese: { id: 'geese', name: 'Geese', leaderSpeed: 6.5, spacing: 0.22, spreadMax: 2.0, pointsPerBird: 1.6, unlockGathered: 2000, vShape: true },
};
export const SPECIES_ORDER: SpeciesId[] = ['starlings', 'swallows', 'geese'];

export const TUNING = {
  // ── Sky (§5, §6.1) ─────────────────────────────────────────
  SKY_W: 12,
  SKY_H: 20,
  TICK_HZ: 60,
  SCROLL_START: 3,
  SCROLL_END: 6,
  SCROLL_RAMP_S: 120,

  // ── Leader and flock (§6.2–6.4) ────────────────────────────
  THUMB_OFFSET: 2.5,
  MAX_BIRDS: 300,
  SPREAD_BASE: 0.2,
  SPREAD_PER_BIRD: 0.01,
  GATHER_DIST: 0.6,
  BIRD_RADIUS: 0.08,
  START_BIRDS: 8,
  /** Geese: sideways offset per tile behind the leader (the V). */
  V_SLOPE: 0.55,

  // ── Hazards (§6.5) ─────────────────────────────────────────
  HAWK_WARNING_S: 1.2,
  HAWK_FIRST_SLOW_S: 2.0,
  HAWK_SLOW_RUNS: 3,
  HAWK_RADIUS: 0.8,
  HAWK_INTERVAL_START: 14,
  HAWK_INTERVAL_END: 6,
  HAWK_INTERVAL_RAMP_S: 150,
  NEAR_MISS: 0.4,

  // ── Trees, murmurations, thermals (§6.6–6.8) ───────────────
  TREE_RADIUS: 3,
  TREE_EVERY_MIN_S: 25,
  TREE_FORCE_S: 35,
  MURMUR_WINDOW: 8,
  MURMUR_DURATION_S: 1.5,
  MURMUR_COOLDOWN_S: 4,
  MURMUR_GATHER_FACTOR: 3,
  THERMAL_FACTOR: 1.5,

  // ── Scoring (§6.9–6.10) ────────────────────────────────────
  NEAR_MISS_POINTS: 2,
  MURMUR_POINTS_PER_BIRD: 5,
  FEATHERS_PER_POINT: 1 / 50,
  REVIVE_COST: 50,
  REVIVE_BIRDS: 10,
  REVIVE_OFFER_S: 3,

  // ── Chunks (§7) ────────────────────────────────────────────
  TIER_FROM_S: [0, 20, 45, 80, 120],
  TIER_LANE: [6, 4.5, 3.5, 2.5, 2],

  // ── Missions (§7.3) ────────────────────────────────────────
  MISSIONS_PER_RANK: 5,

  // ── First launch (§9) ──────────────────────────────────────
  FIRST_TREE_S: 12,
  FIRST_HAWK_S: 20,
} as const;

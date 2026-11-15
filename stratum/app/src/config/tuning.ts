/**
 * Every tuning constant in the game (spec: "Every number marked as a tuning
 * constant lives in one configuration file").
 */
export const TUNING = {
  // ── Grid (§5) ──────────────────────────────────────────────
  GRID_W: 96,
  GRID_H: 128,
  TICK_HZ: 60,

  // ── Falling rules (§6.2) ───────────────────────────────────
  /** Below this absolute tilt (degrees) the jar counts as level. */
  TILT_SLIGHT_DEG: 8,
  /** At or above this absolute tilt the "steep" rules apply. */
  TILT_STEEP_DEG: 20,
  TILT_MAX_DEG: 30,
  /** Slight tilt: a grain only rolls to the high side if the drop there is at least this deep. */
  SLIGHT_HIGH_SIDE_DROP: 2,
  /** Steep tilt: grains slide sideways only while the slope rises no more than 1 cell per this many columns. */
  STEEP_SLOPE_RUN: 2,

  // ── Settled rows (§6.3) ────────────────────────────────────
  ROW_SETTLE_TICKS: 30,

  // ── Pouring (§6.4) ─────────────────────────────────────────
  POUR_RATE: 5,
  POUR_SCATTER: 1,
  /** Rows at the opening in which new grains appear (the head of the stream). */
  POUR_DROP_ROWS: 2,

  // ── Scoring (§6.7) ─────────────────────────────────────────
  SCORE_TOLERANCE: 2,
  STAR_3: 0.95,
  STAR_2: 0.85,
  STAR_1: 0.7,
  DESIGNER_MIN_SELF_SCORE: 0.97,
  /** A jar counts as full when this share of the capacity below the fill line holds sand and all is settled. */
  FULL_FRACTION: 0.985,

  // ── Undo (§6.8) ────────────────────────────────────────────
  UNDOS_PER_JAR: 3,

  // ── Guide lines (§6.9) ─────────────────────────────────────
  GUIDES_FORCED_UNTIL_JAR: 15,
  TARGET_PEEK_MS: 2000,

  // ── Corks (§8.5, §9) ───────────────────────────────────────
  CORKS_PER_JAR: 5,
  CORKS_PER_STAR: 5,
  CORKS_FREEHAND: 5,
  CORKS_DAILY: 20,
  CORKS_SET_COMPLETE: 100,
  SET_COMPLETE_MIN_STARS: 2,

  // ── Modes ──────────────────────────────────────────────────
  FREE_POUR_UNLOCK_AFTER_JAR: 5,
  FREE_POUR_KEEP_MAX: 20,
  DAILY_JAR_COUNT: 30,
  MATCH_JAR_COUNT: 80,

  // ── Editor ─────────────────────────────────────────────────
  LIMIT_MARGIN: 0.15,

  // ── Look and feel ──────────────────────────────────────────
  GRAIN_LIGHTNESS_JITTER: 0.1,
  HAPTIC_POUR_INTERVAL_MS: 70,
  /** Stream grains drawn above the jar. */
  STREAM_PARTICLES: 40,
} as const;

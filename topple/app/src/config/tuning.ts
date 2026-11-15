/** Every tuning constant (spec: "lives in one configuration file"). */
export const TUNING = {
  // ── Chain (§6.1) ───────────────────────────────────────────
  DELAY_START_MS: 100,
  DELAY_PER_DEPTH_MS: 1.5,
  DELAY_MIN_MS: 55,
  TALL_BRIDGE_EXTRA_MS: 40,

  // ── Board and pieces (§5.4, §10) ───────────────────────────
  BOARD_W: 9,
  BOARD_H: 14,
  SLOT_SPACING: 0.72,
  MAX_SLOTS: 150,
  MIN_GAPS: 4,
  MAX_GAPS: 12,
  TRAY_SIZE: 3,
  DOMINO_HEIGHT: 1.0,
  TALL_HEIGHT: 1.6,
  DOMINO_WIDTH: 0.5,
  DOMINO_THICK: 0.18,
  FALL_MS: 180,
  SNAP_DISTANCE: 0.6,
  DRAG_LIFT_PX: 70,

  // ── Play (§8) ──────────────────────────────────────────────
  STOP_HOLD_MS: 1500,
  RESET_MS: 600,
  HINT_COST: 20,
  STARTER_TOKENS: 20,

  // ── Tokens (§9.5) ──────────────────────────────────────────
  TOKENS_DAILY: 10,
  TOKENS_DAILY_GOLD: 5,
  TOKENS_PACK: 5,
  TOKENS_ARCHIVE: 5,
  TOKENS_STREAK_7: 20,

  // ── Schedule (§9) ──────────────────────────────────────────
  DAILY_COUNT: 120,
  PACK_COUNT: 30,
  SPECIAL_MIN_SLOTS: 120,
  SPECIAL_MAX_SLOTS: 150,

  // ── Camera (§10) ───────────────────────────────────────────
  PLAN_CAMERA_DEG: 55,
} as const;

import { STRINGS } from './strings';

/**
 * Every tuning constant (spec: "Every number marked as a tuning constant lives
 * in one configuration file").
 */
export type BallId = 'bronze' | 'silver' | 'gold';

export interface BallSpec {
  id: BallId;
  name: string;
  speedFactor: number;
  /** Full-tilt acceleration, cells/s². */
  accel: number;
  /** Speed cap, cells/s. */
  vMax: number;
  scoreFactor: number;
}

const BASE_ACCEL = 12;
const BASE_VMAX = 6;

function ball(id: BallId, name: string, speedFactor: number, scoreFactor: number): BallSpec {
  return { id, name, speedFactor, accel: BASE_ACCEL * speedFactor, vMax: BASE_VMAX * speedFactor, scoreFactor };
}

export const BALLS: Record<BallId, BallSpec> = {
  bronze: ball('bronze', STRINGS.balls.bronze, 1.0, 1),
  silver: ball('silver', STRINGS.balls.silver, 1.4, 1.5),
  gold: ball('gold', STRINGS.balls.gold, 1.8, 2),
};
export const BALL_ORDER: BallId[] = ['bronze', 'silver', 'gold'];

export const TUNING = {
  // ── Generator (§6) ─────────────────────────────────────────
  GENERATOR_VERSION: 1,
  MAX_ATTEMPTS: 200,
  MIN_FACE_CROSSING: 2,
  HOLE_MIN_GATE_DISTANCE: 2,

  // ── Dimensions (§7.2) ──────────────────────────────────────
  BALL_RADIUS: 0.25,
  WALL_THICKNESS: 0.12,
  HOLE_RADIUS: 0.3,
  HOLE_CAPTURE_MARGIN: 0.08,
  FINISH_RADIUS: 0.3,
  WALL_HEIGHT: 0.42,

  // ── Time (§7.3) ────────────────────────────────────────────
  TICK_HZ: 120,
  MAX_TICKS_PER_FRAME: 8,

  // ── Input to acceleration (§7.4) ───────────────────────────
  DEAD_ZONE: 0.06,
  /** 1 - exp(-(1/120) / 0.06): tilt smoothing with a 60 ms time constant. A literal, so every device uses the same bits. */
  TILT_SMOOTHING: 0.1296752741666095,
  INPUT_QUANTUM: 256,
  CUBE_TILT_DEG: 15,

  // ── Motion (§7.5) ──────────────────────────────────────────
  C_DRAG: 1.2,
  C_FRICTION: 0.6,
  REST_SPEED: 0.02,

  // ── Collisions (§7.6) ──────────────────────────────────────
  RESTITUTION: 0.3,
  BOUNCE_MIN_SPEED: 0.5,
  WALL_FRICTION: 0.02,
  COLLISION_PASSES: 4,
  SILENT_IMPACT: 0.5,

  // ── Gates (§7.7) ───────────────────────────────────────────
  TURN_SECONDS: 0.45,
  TURN_SECONDS_REDUCED: 0.2,
  V_ENTRY: 2,
  REARM_DISTANCE: 0.6,

  // ── Holes (§7.10) ──────────────────────────────────────────
  FALL_SECONDS: 0.3,
  RESPAWN_PAUSE_SECONDS: 0.5,

  // ── Step mode (§7.11) ──────────────────────────────────────
  STEP_SPEED: 8,

  // ── Thumb tilt (§7.12) ─────────────────────────────────────
  TILT_RADIUS_DEFAULT: 80,
  TILT_RADIUS_MIN: 50,
  TILT_RADIUS_MAX: 120,

  // ── Scoring (§9.4) ─────────────────────────────────────────
  PAR_SPEED_FACTOR: 0.45,
  PAR_TURN_SECONDS: 0.45,

  // ── Rewards ────────────────────────────────────────────────
  COINS_PER_STAR: 10,
  COINS_FIRST_MEDAL: 10,
  COINS_DAILY: 30,
  MATERIAL_PRICE: 300,

  // ── Look ───────────────────────────────────────────────────
  TRAIL_POINTS: 48,
  CAMERA_ANGLE_DEG: 20,
} as const;

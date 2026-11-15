import { TUNING } from '../config/tuning';

/** Lighthouse upgrade levels, 0 to 2 each (§9.3). */
export interface Upgrades {
  width: number;
  reach: number;
  turn: number;
}

export const NO_UPGRADES: Upgrades = { width: 0, reach: 0, turn: 0 };

/**
 * The beam (§6.1): a wedge from the lighthouse at the bottom centre. Angles are
 * in degrees, 0 = straight up, positive to the right, limited to ±80.
 */
export class Beam {
  angle = 0;
  target = 0;
  halfWidth: number;
  reach: number;
  turnSpeed: number;

  constructor(up: Upgrades = NO_UPGRADES) {
    this.halfWidth = TUNING.BEAM_HALF_WIDTH[up.width];
    this.reach = TUNING.BEAM_REACH[up.reach];
    this.turnSpeed = TUNING.BEAM_TURN[up.turn];
  }

  setTarget(deg: number): void {
    this.target = clampAngle(deg);
  }

  /** Turns towards the target at no more than the turning speed. Returns degrees turned. */
  step(dt: number): number {
    const max = this.turnSpeed * dt;
    const d = Math.max(-max, Math.min(max, this.target - this.angle));
    this.angle += d;
    return d;
  }

  /** Is a point lit? `fogged` reduces the reach to 60% (§6.2). */
  lights(x: number, y: number, fogged: boolean): boolean {
    const L = TUNING.LIGHTHOUSE;
    const dist = Math.hypot(x - L.x, y - L.y);
    const reach = fogged ? this.reach * TUNING.FOG_REACH_SHARE : this.reach;
    if (dist > reach) return false;
    return Math.abs(angleTo(x, y) - this.angle) <= this.halfWidth;
  }
}

export function clampAngle(deg: number): number {
  return Math.max(-TUNING.BEAM_LIMIT, Math.min(TUNING.BEAM_LIMIT, deg));
}

/** The beam angle that points at (x, y). */
export function angleTo(x: number, y: number): number {
  const L = TUNING.LIGHTHOUSE;
  return (Math.atan2(x - L.x, L.y - y) * 180) / Math.PI;
}

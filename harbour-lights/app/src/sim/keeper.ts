import { TUNING } from '../config/tuning';
import { angleTo } from './beam';
import type { Boat, NightSim } from './night';

/**
 * The automatic keeper (§8.3): always turn towards the boat that will come to
 * harm soonest if left dark. Used to accept night seeds and in tests.
 */
export class Keeper {
  private focus: Boat | null = null;
  private every = 3;

  /** Sets the beam's target for this tick. */
  act(sim: NightSim): void {
    if (sim.ticks % this.every === 0) this.focus = this.choose(sim);
    const b = this.focus;
    if (b && b.outcome === 'sailing') {
      // Lead slightly along the boat's heading.
      const lead = 0.25 * TUNING.BOATS[b.kind].speed;
      sim.beam.setTarget(angleTo(b.x + Math.cos(b.heading) * lead, b.y + Math.sin(b.heading) * lead));
    }
  }

  private choose(sim: NightSim): Boat | null {
    let best: Boat | null = null;
    let bestScore = Infinity;
    for (const b of sim.boats) {
      if (b.outcome !== 'sailing') continue;
      const harm = b.alert + sim.harmIn(b, 14, 0.1);
      if (!Number.isFinite(harm)) continue;
      // A boat beyond the beam's reach cannot be lit yet; deal with reachable boats first.
      const L = TUNING.LIGHTHOUSE;
      const reach = b.fogged ? sim.beam.reach * TUNING.FOG_REACH_SHARE : sim.beam.reach;
      const beyond = Math.max(0, Math.hypot(b.x - L.x, b.y - L.y) - reach + 0.2);
      // Time to swing the beam over counts against a far-off boat.
      const swing = Math.abs(angleTo(b.x, b.y) - sim.beam.angle) / sim.beam.turnSpeed;
      const score = harm - (b === this.focus && b.alert < 0.4 ? 0.5 : 0) + swing * 0.5 + (beyond > 0 ? 3 + beyond : 0);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }
}

/** Plays a whole night with the keeper; returns the result. */
export function keeperPlay(sim: NightSim, maxSeconds = 600): ReturnType<NightSim['result']> {
  const k = new Keeper();
  const limit = maxSeconds / TUNING.TICK;
  while (!sim.over && sim.ticks < limit) {
    k.act(sim);
    sim.step();
  }
  return sim.result();
}

import { U_AXES, V_AXES, cellCol, cellFace, cellRow, type Vec3 } from '../maze/topology';
import { apply } from '../physics/orientation';
import type { BallSim } from '../physics/sim';

/**
 * A simple automatic player that steers along the solution (§11: "Every
 * Journey level can be completed by a simple automatic player"). It produces
 * the same kind of input a thumb does: a screen tilt within the unit circle.
 * Also used to measure how long a level takes.
 */
export class Autopilot {
  private index = 0;

  constructor(private sim: BallSim) {}

  /** The tilt to apply this tick. */
  input(): { x: number; y: number } {
    const sim = this.sim;
    if (sim.state !== 'ROLLING' && sim.state !== 'READY') return { x: 0, y: 0 };
    const n = sim.n;
    const path = sim.cube.solution;
    const col = Math.max(0, Math.min(n - 1, Math.floor(sim.p.x)));
    const row = Math.max(0, Math.min(n - 1, Math.floor(sim.p.y)));
    const here = sim.face * n * n + row * n + col;
    // Follow the route from the furthest matching position near the last one.
    for (let i = Math.max(0, this.index - 2); i < Math.min(path.length, this.index + 4); i++) if (path[i] === here) this.index = i;
    const next = path[Math.min(path.length - 1, this.index + 1)];

    let tx: number;
    let ty: number;
    let corner = false;
    if (cellFace(n, next) === sim.face) {
      tx = cellCol(n, next) + 0.5;
      ty = cellRow(n, next) + 0.5;
      const after = path[this.index + 2];
      if (after === undefined || cellFace(n, after) !== sim.face) corner = after === undefined;
      else {
        const straight = cellCol(n, after) - cellCol(n, next) === cellCol(n, next) - col && cellRow(n, after) - cellRow(n, next) === cellRow(n, next) - row;
        corner = !straight;
      }
    } else {
      // Across a gate: aim past the edge, through the middle of the opening.
      const cx = col + 0.5;
      const cy = row + 0.5;
      tx = cx + (cx < 1 && col === 0 ? -1 : col === n - 1 && cx > n - 1 ? 1 : 0);
      ty = cy + (cy < 1 && row === 0 ? -1 : row === n - 1 && cy > n - 1 ? 1 : 0);
      // Pick the right side if the cell is in a corner of the face.
      const g = sim.cube.gates.find((gg) => (gg.cellA === here && gg.cellB === next) || (gg.cellB === here && gg.cellA === next));
      if (g) {
        const side = g.cellA === here ? g.sideA : g.sideB;
        tx = cx + [1, 0, -1, 0][side];
        ty = cy + [0, 1, 0, -1][side];
      }
    }

    const dx = tx - sim.p.x;
    const dy = ty - sim.p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const vmax = sim.ball.vMax;
    const want = corner ? Math.min(vmax * 0.55, 0.9 + 3.2 * dist) : Math.min(vmax * 0.8, 2 + 4 * dist);
    const lx = (dx / dist) * want - sim.v.x;
    const ly = (dy / dist) * want - sim.v.y;
    // Face-local → cube → world (screen x = world X, screen y = world Z).
    const u = U_AXES[sim.face];
    const v = V_AXES[sim.face];
    const c: Vec3 = [lx * u[0] + ly * v[0], lx * u[1] + ly * v[1], lx * u[2] + ly * v[2]];
    const w = apply(sim.R, c);
    let sx = w[0] * 0.6;
    let sy = w[2] * 0.6;
    const len = Math.sqrt(sx * sx + sy * sy);
    if (len > 1) {
      sx /= len;
      sy /= len;
    }
    if (len < 0.08 && sim.state === 'READY') {
      sx = 0.1;
    }
    return { x: sx, y: sy };
  }
}

/** Runs the autopilot until the level finishes or time runs out. Returns seconds taken, or null. */
export function autoplay(sim: BallSim, maxSeconds = 300): number | null {
  const pilot = new Autopilot(sim);
  const maxTicks = maxSeconds * 120;
  for (let i = 0; i < maxTicks; i++) {
    const t = pilot.input();
    sim.step(t.x, t.y);
    if (sim.state === 'FINISHED') return sim.seconds;
  }
  return null;
}

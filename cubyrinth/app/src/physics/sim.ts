import { TUNING, type BallSpec } from '../config/tuning';
import type { Cube, Gate } from '../maze/generator';
import { NORMALS, U_AXES, V_AXES, cellCol, cellFace, cellIndex, cellRow, faceOfNormal, sideDirection, sideOfDirection, type Vec3 } from '../maze/topology';
import { IDENTITY, applyT, rollTowards, type Mat3 } from './orientation';
import { buildFaceWalls, type FaceWalls } from './walls';

/**
 * Ball simulation (§7). Two-dimensional: the ball is always on one face with
 * position p and velocity v in face-local cells. Fixed 1/120 s ticks, and
 * only + − × ÷ and square root, so a run is identical on every device (§7.9).
 * Reports events; never draws or plays anything.
 */

export type State = 'READY' | 'ROLLING' | 'TURNING' | 'FALLING' | 'FINISHED';
export type ControlMode = 'tilt' | 'step';

export type SimEvent =
  | { type: 'impact'; strength: number }
  | { type: 'gate'; gate: number }
  | { type: 'turned'; face: number }
  | { type: 'fell' }
  | { type: 'respawned' }
  | { type: 'finished' }
  | { type: 'started' };

export interface Turn {
  fromFace: number;
  toFace: number;
  fromR: Mat3;
  toR: Mat3;
  /** Where the ball crossed the edge, in cube coordinates (cells, cube centred on 0). */
  edge: Vec3;
  /** Old face normal and the direction of travel (new face normal). */
  N: Vec3;
  d: Vec3;
  /** Arrival on the new face. */
  p: { x: number; y: number };
  v: { x: number; y: number };
  gate: number;
}

const DT = 1 / TUNING.TICK_HZ;
const CONTACT = TUNING.BALL_RADIUS + TUNING.WALL_THICKNESS / 2;

export interface SimOptions {
  ball: BallSpec;
  mode?: ControlMode;
  reducedMotion?: boolean;
}

export class BallSim {
  readonly cube: Cube;
  readonly n: number;
  ball: BallSpec;
  mode: ControlMode;

  state: State = 'READY';
  face: number;
  p = { x: 0.5, y: 0.5 };
  v = { x: 0, y: 0 };
  /** Previous tick's position, for drawing interpolation. */
  prev = { x: 0.5, y: 0.5 };
  /** Smoothed tilt, screen axes. */
  t = { x: 0, y: 0 };
  R: Mat3 = IDENTITY.slice();

  tick = 0;
  /** Ticks counted by the level timer (ROLLING and FALLING only). */
  timerTicks = 0;
  falls = 0;
  turn: Turn | null = null;
  turnTick = 0;
  readonly turnTicks: number;
  fallTick = 0;
  /** The gate just used, disarmed until the ball is clear of the edge. */
  disarmed = -1;
  checkpoint: { face: number; p: { x: number; y: number }; R: Mat3; disarmed: number };
  events: SimEvent[] = [];
  /** The last tick's speed, for sound. */
  speed = 0;
  /** Inputs, one entry per tick, for replays (§7.9). */
  readonly inputs: number[] = [];

  private walls: FaceWalls[];
  private holes: { face: number; x: number; y: number }[];
  private finishPos: { face: number; x: number; y: number };
  // Step mode
  private stepTarget: { x: number; y: number } | null = null;
  private stepSide = -1;
  private stepQueued = -1;

  constructor(cube: Cube, opts: SimOptions) {
    this.cube = cube;
    this.n = cube.n;
    this.ball = opts.ball;
    this.mode = opts.mode ?? 'tilt';
    this.turnTicks = Math.round((opts.reducedMotion ? TUNING.TURN_SECONDS_REDUCED : TUNING.TURN_SECONDS) * TUNING.TICK_HZ);
    this.walls = [0, 1, 2, 3, 4, 5].map((f) => buildFaceWalls(cube, f));
    this.holes = cube.holes.map((c) => ({ face: cellFace(this.n, c), x: cellCol(this.n, c) + 0.5, y: cellRow(this.n, c) + 0.5 }));
    this.finishPos = { face: cellFace(this.n, cube.finish), x: cellCol(this.n, cube.finish) + 0.5, y: cellRow(this.n, cube.finish) + 0.5 };
    this.face = cellFace(this.n, cube.start);
    this.p = { x: cellCol(this.n, cube.start) + 0.5, y: cellRow(this.n, cube.start) + 0.5 };
    this.prev = { ...this.p };
    this.checkpoint = { face: this.face, p: { ...this.p }, R: this.R.slice(), disarmed: -1 };
  }

  get finishFace(): number {
    return this.finishPos.face;
  }

  get seconds(): number {
    return this.timerTicks / TUNING.TICK_HZ;
  }

  /** Puts the ball at a saved checkpoint (resuming a closed app). */
  restore(cp: { face: number; p: { x: number; y: number }; R: Mat3; disarmed: number }, timerTicks: number, falls: number): void {
    this.face = cp.face;
    this.p = { ...cp.p };
    this.prev = { ...cp.p };
    this.R = cp.R.slice();
    // Step mode never disarms a gate (see finishTurn).
    const disarmed = this.mode === 'step' ? -1 : cp.disarmed;
    this.disarmed = disarmed;
    this.checkpoint = { face: cp.face, p: { ...cp.p }, R: cp.R.slice(), disarmed };
    this.timerTicks = timerTicks;
    this.falls = falls;
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ── Conversions ───────────────────────────────────────────

  /** Screen-axis vector → face-local (u, v) components, via the orientation. */
  screenToLocal(x: number, y: number): { x: number; y: number } {
    const c = applyT(this.R, [x, 0, y]);
    const u = U_AXES[this.face];
    const v = V_AXES[this.face];
    return { x: c[0] * u[0] + c[1] * u[1] + c[2] * u[2], y: c[0] * v[0] + c[1] * v[1] + c[2] * v[2] };
  }

  /** Face-local point → cube coordinates (cells, cube centred on the origin). */
  toCube(face: number, x: number, y: number): Vec3 {
    const h = this.n / 2;
    const N = NORMALS[face];
    const u = U_AXES[face];
    const v = V_AXES[face];
    const a = x - h;
    const b = y - h;
    return [N[0] * h + u[0] * a + v[0] * b, N[1] * h + u[1] * a + v[1] * b, N[2] * h + u[2] * a + v[2] * b];
  }

  // ── Stepping ──────────────────────────────────────────────

  /** One tick. `ix`, `iy`: the raw tilt input in screen axes, within the unit circle. */
  step(ix = 0, iy = 0): void {
    // Rounded to steps of 1/256 before use (§7.9).
    const q = TUNING.INPUT_QUANTUM;
    const rx = Math.round(ix * q) / q;
    const ry = Math.round(iy * q) / q;
    this.inputs.push(rx, ry);
    this.tick++;
    this.prev = { ...this.p };

    switch (this.state) {
      case 'READY':
        if (rx !== 0 || ry !== 0 || this.stepQueued >= 0) {
          this.state = 'ROLLING';
          this.events.push({ type: 'started' });
        } else return;
        break;
      case 'TURNING':
        this.turnTick++;
        if (this.turnTick >= this.turnTicks) this.finishTurn();
        return;
      case 'FALLING':
        this.timerTicks++;
        this.fallTick++;
        if (this.fallTick >= Math.round((TUNING.FALL_SECONDS + TUNING.RESPAWN_PAUSE_SECONDS) * TUNING.TICK_HZ)) this.respawn();
        return;
      case 'FINISHED':
        return;
    }

    this.timerTicks++;
    if (this.mode === 'step') this.stepSlide();
    else this.roll(rx, ry);
  }

  private roll(rx: number, ry: number): void {
    // Dead zone removed and rescaled (§7.4).
    let tx = rx;
    let ty = ry;
    let len = Math.sqrt(tx * tx + ty * ty);
    if (len > 1) {
      tx /= len;
      ty /= len;
      len = 1;
    }
    if (len < TUNING.DEAD_ZONE) {
      tx = 0;
      ty = 0;
    } else {
      const k = (len - TUNING.DEAD_ZONE) / (1 - TUNING.DEAD_ZONE) / len;
      tx *= k;
      ty *= k;
    }
    const s = TUNING.TILT_SMOOTHING;
    this.t.x += (tx - this.t.x) * s;
    this.t.y += (ty - this.t.y) * s;
    const level = tx === 0 && ty === 0;
    if (level && this.t.x * this.t.x + this.t.y * this.t.y < 1 / (512 * 512)) this.t = { x: 0, y: 0 };

    const a = this.screenToLocal(this.t.x, this.t.y);
    const v = this.v;
    v.x += a.x * this.ball.accel * DT;
    v.y += a.y * this.ball.accel * DT;
    const drag = 1 - TUNING.C_DRAG * DT;
    v.x *= drag;
    v.y *= drag;
    let sp = Math.sqrt(v.x * v.x + v.y * v.y);
    if (sp > 0) {
      const reduced = Math.max(0, sp - TUNING.C_FRICTION * DT);
      v.x *= reduced / sp;
      v.y *= reduced / sp;
      sp = reduced;
    }
    if (sp > this.ball.vMax) {
      v.x *= this.ball.vMax / sp;
      v.y *= this.ball.vMax / sp;
    }
    this.p.x += v.x * DT;
    this.p.y += v.y * DT;
    this.collide();
    if (this.checkEdges()) return;
    this.checkRearm();
    if (this.checkHoleAndFinish()) return;
    sp = Math.sqrt(v.x * v.x + v.y * v.y);
    if (sp < TUNING.REST_SPEED && this.t.x === 0 && this.t.y === 0) {
      v.x = 0;
      v.y = 0;
      sp = 0;
    }
    this.speed = sp;
  }

  private collide(): void {
    const n = this.n;
    const w = this.walls[this.face];
    const col = Math.max(0, Math.min(n - 1, Math.floor(this.p.x)));
    const row = Math.max(0, Math.min(n - 1, Math.floor(this.p.y)));
    const list = w.nearby[row * n + col];
    for (let pass = 0; pass < TUNING.COLLISION_PASSES; pass++) {
      let touched = false;
      for (const i of list) {
        const s = w.segments[i];
        const dx = s.bx - s.ax;
        const dy = s.by - s.ay;
        const L2 = dx * dx + dy * dy;
        let k = ((this.p.x - s.ax) * dx + (this.p.y - s.ay) * dy) / L2;
        if (k < 0) k = 0;
        else if (k > 1) k = 1;
        const cx = s.ax + dx * k;
        const cy = s.ay + dy * k;
        const ox = this.p.x - cx;
        const oy = this.p.y - cy;
        const d2 = ox * ox + oy * oy;
        if (d2 >= CONTACT * CONTACT) continue;
        touched = true;
        const d = Math.sqrt(d2);
        let nx: number;
        let ny: number;
        if (d > 1e-9) {
          nx = ox / d;
          ny = oy / d;
        } else {
          // Exactly on the wall line: push back against the velocity.
          const vs = Math.sqrt(this.v.x * this.v.x + this.v.y * this.v.y) || 1;
          nx = -this.v.x / vs;
          ny = -this.v.y / vs;
        }
        const pen = CONTACT - d;
        this.p.x += nx * pen;
        this.p.y += ny * pen;
        const vn = this.v.x * nx + this.v.y * ny;
        if (vn < 0) {
          const bounce = -vn < TUNING.BOUNCE_MIN_SPEED ? 0 : TUNING.RESTITUTION;
          this.v.x -= (1 + bounce) * vn * nx;
          this.v.y -= (1 + bounce) * vn * ny;
          const tn = this.v.x * nx + this.v.y * ny;
          const tx = this.v.x - tn * nx;
          const ty = this.v.y - tn * ny;
          this.v.x -= TUNING.WALL_FRICTION * tx;
          this.v.y -= TUNING.WALL_FRICTION * ty;
          this.events.push({ type: 'impact', strength: -vn });
        }
      }
      if (!touched) break;
    }
  }

  /** Returns true if a turn began. */
  private checkEdges(): boolean {
    const n = this.n;
    let side = -1;
    if (this.p.x > n) side = 0;
    else if (this.p.y > n) side = 1;
    else if (this.p.x < 0) side = 2;
    else if (this.p.y < 0) side = 3;
    if (side < 0) return false;
    const along = side === 0 || side === 2 ? this.p.y : this.p.x;
    const k = Math.max(0, Math.min(n - 1, Math.floor(along)));
    const col = side === 0 ? n - 1 : side === 2 ? 0 : k;
    const row = side === 1 ? n - 1 : side === 3 ? 0 : k;
    const cell = cellIndex(n, this.face, col, row);
    const gi = this.cube.gates.findIndex((g) => (g.cellA === cell && g.sideA === side) || (g.cellB === cell && g.sideB === side));
    if (gi >= 0 && gi !== this.disarmed) {
      this.beginTurn(gi, cell, side);
      return true;
    }
    // Not an armed gate: hold the ball at the edge line.
    if (side === 0) {
      this.p.x = n;
      if (this.v.x > 0) this.v.x = 0;
    } else if (side === 2) {
      this.p.x = 0;
      if (this.v.x < 0) this.v.x = 0;
    } else if (side === 1) {
      this.p.y = n;
      if (this.v.y > 0) this.v.y = 0;
    } else {
      this.p.y = 0;
      if (this.v.y < 0) this.v.y = 0;
    }
    return false;
  }

  private checkRearm(): void {
    if (this.disarmed < 0) return;
    const n = this.n;
    const g = this.cube.gates[this.disarmed];
    const onA = cellFace(n, g.cellA) === this.face;
    const side = onA ? g.sideA : g.sideB;
    const dist = side === 0 ? n - this.p.x : side === 1 ? n - this.p.y : side === 2 ? this.p.x : this.p.y;
    if (dist > TUNING.REARM_DISTANCE) this.disarmed = -1;
  }

  /** Returns true if the ball fell or finished. */
  private checkHoleAndFinish(): boolean {
    const capture = TUNING.HOLE_RADIUS - TUNING.HOLE_CAPTURE_MARGIN;
    for (const h of this.holes) {
      if (h.face !== this.face) continue;
      const dx = this.p.x - h.x;
      const dy = this.p.y - h.y;
      if (dx * dx + dy * dy < capture * capture) {
        this.state = 'FALLING';
        this.fallTick = 0;
        this.falls++;
        this.p = { x: h.x, y: h.y };
        this.v = { x: 0, y: 0 };
        this.speed = 0;
        this.events.push({ type: 'fell' });
        return true;
      }
    }
    const f = this.finishPos;
    if (f.face === this.face) {
      const dx = this.p.x - f.x;
      const dy = this.p.y - f.y;
      if (dx * dx + dy * dy < TUNING.FINISH_RADIUS * TUNING.FINISH_RADIUS) {
        this.state = 'FINISHED';
        this.speed = 0;
        this.events.push({ type: 'finished' });
        return true;
      }
    }
    return false;
  }

  private respawn(): void {
    const cp = this.checkpoint;
    this.face = cp.face;
    this.p = { ...cp.p };
    this.prev = { ...cp.p };
    this.R = cp.R.slice();
    this.disarmed = cp.disarmed;
    this.v = { x: 0, y: 0 };
    this.t = { x: 0, y: 0 };
    this.stepTarget = null;
    this.stepQueued = -1;
    this.state = 'ROLLING';
    this.events.push({ type: 'respawned' });
  }

  // ── Gates and the automatic turn (§7.7) ───────────────────

  private beginTurn(gi: number, cell: number, side: number): void {
    const n = this.n;
    const g: Gate = this.cube.gates[gi];
    const onA = g.cellA === cell;
    const toCell = onA ? g.cellB : g.cellA;
    const toSide = onA ? g.sideB : g.sideA;
    const N = NORMALS[this.face];
    const d = sideDirection(this.face, side);
    const toFace = faceOfNormal(d);

    // Exit point on the edge line.
    const ex = side === 0 ? n : side === 2 ? 0 : this.p.x;
    const ey = side === 1 ? n : side === 3 ? 0 : this.p.y;
    const edge = this.toCube(this.face, ex, ey);
    const h = n / 2;
    const u2 = U_AXES[toFace];
    const v2 = V_AXES[toFace];
    let nx = edge[0] * u2[0] + edge[1] * u2[1] + edge[2] * u2[2] + h;
    let ny = edge[0] * v2[0] + edge[1] * v2[1] + edge[2] * v2[2] + h;
    // At least r + w/2 from each gate post.
    const tcol = cellCol(n, toCell);
    const trow = cellRow(n, toCell);
    const lo = CONTACT;
    const hi = 1 - CONTACT;
    if (toSide === 0 || toSide === 2) {
      ny = Math.max(trow + lo, Math.min(trow + hi, ny));
      nx = toSide === 0 ? n : 0;
    } else {
      nx = Math.max(tcol + lo, Math.min(tcol + hi, nx));
      ny = toSide === 1 ? n : 0;
    }

    // Velocity carried round the corner: v = a·d + b·e  →  a·(−N) + b·e.
    const u = U_AXES[this.face];
    const v = V_AXES[this.face];
    const v3: Vec3 = [this.v.x * u[0] + this.v.y * v[0], this.v.x * u[1] + this.v.y * v[1], this.v.x * u[2] + this.v.y * v[2]];
    const a = v3[0] * d[0] + v3[1] * d[1] + v3[2] * d[2];
    const nv: Vec3 = [v3[0] - a * d[0] - a * N[0], v3[1] - a * d[1] - a * N[1], v3[2] - a * d[2] - a * N[2]];
    let vx = nv[0] * u2[0] + nv[1] * u2[1] + nv[2] * u2[2];
    let vy = nv[0] * v2[0] + nv[1] * v2[1] + nv[2] * v2[2];
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > TUNING.V_ENTRY) {
      vx *= TUNING.V_ENTRY / sp;
      vy *= TUNING.V_ENTRY / sp;
    }

    this.turn = {
      fromFace: this.face,
      toFace,
      fromR: this.R.slice(),
      toR: rollTowards(this.R, d),
      edge,
      N,
      d,
      p: { x: nx, y: ny },
      v: { x: vx, y: vy },
      gate: gi,
    };
    this.state = 'TURNING';
    this.turnTick = 0;
    this.speed = 0;
    this.events.push({ type: 'gate', gate: gi });
  }

  private finishTurn(): void {
    const t = this.turn!;
    this.face = t.toFace;
    this.R = t.toR;
    this.p = { ...t.p };
    this.prev = { ...t.p };
    this.v = { ...t.v };
    this.t = { x: 0, y: 0 };
    this.disarmed = t.gate;
    this.checkpoint = { face: this.face, p: { ...t.p }, R: this.R.slice(), disarmed: t.gate };
    this.turn = null;
    this.state = 'ROLLING';
    if (this.mode === 'step') {
      // Step mode: stop in the entry cell.
      const g = this.cube.gates[t.gate];
      const entry = cellFace(this.n, g.cellA) === this.face ? g.cellA : g.cellB;
      this.p = { x: cellCol(this.n, entry) + 0.5, y: cellRow(this.n, entry) + 0.5 };
      this.prev = { ...this.p };
      this.v = { x: 0, y: 0 };
      this.checkpoint.p = { ...this.p };
      this.stepTarget = null;
      // The ball has stopped clear of the edge, so the gate needs no disarming: it cannot flip
      // back by itself, and a dead-end face can only be left through the gate it was entered by.
      this.disarmed = -1;
      this.checkpoint.disarmed = -1;
    }
    this.events.push({ type: 'turned', face: this.face });
  }

  /** Progress through the current turn, 0..1. */
  get turnProgress(): number {
    return this.turn ? Math.min(1, this.turnTick / this.turnTicks) : 0;
  }

  // ── Step mode (§7.11) ─────────────────────────────────────

  /** A swipe in screen direction 0 = right, 1 = down, 2 = left, 3 = up. */
  swipe(dir: number): void {
    if (this.mode !== 'step' || this.state === 'FINISHED') return;
    if (this.state === 'READY') {
      this.state = 'ROLLING';
      this.events.push({ type: 'started' });
    }
    if (this.stepTarget || this.state !== 'ROLLING') {
      this.stepQueued = dir; // one swipe remembered, as a screen direction
      return;
    }
    const side = this.screenDirToSide(dir);
    if (side >= 0) this.startSlide(side);
  }

  private screenDirToSide(dir: number): number {
    const world = ([
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
      [0, 0, -1],
    ] as Vec3[])[dir];
    return sideOfDirection(this.face, applyT(this.R, world));
  }

  private currentCell(): number {
    const n = this.n;
    const col = Math.max(0, Math.min(n - 1, Math.floor(this.p.x)));
    const row = Math.max(0, Math.min(n - 1, Math.floor(this.p.y)));
    return cellIndex(n, this.face, col, row);
  }

  private startSlide(side: number): boolean {
    const cell = this.currentCell();
    if (!(this.cube.open[cell] & (1 << side))) {
      this.events.push({ type: 'impact', strength: 0.6 });
      return false;
    }
    const n = this.n;
    const col = cellCol(n, cell);
    const row = cellRow(n, cell);
    const dc = [1, 0, -1, 0][side];
    const dr = [0, 1, 0, -1][side];
    const ncol = col + dc;
    const nrow = row + dr;
    this.stepSide = side;
    if (ncol < 0 || ncol >= n || nrow < 0 || nrow >= n) {
      // Through a gate: slide to the edge line.
      this.stepTarget = { x: side === 0 ? n + 0.001 : side === 2 ? -0.001 : col + 0.5, y: side === 1 ? n + 0.001 : side === 3 ? -0.001 : row + 0.5 };
    } else {
      this.stepTarget = { x: ncol + 0.5, y: nrow + 0.5 };
    }
    return true;
  }

  private stepSlide(): void {
    if (!this.stepTarget) {
      this.speed = 0;
      if (this.stepQueued >= 0) {
        const s = this.screenDirToSide(this.stepQueued);
        this.stepQueued = -1;
        if (s >= 0) this.startSlide(s);
      }
      this.v = { x: 0, y: 0 };
      return;
    }
    const dx = this.stepTarget.x - this.p.x;
    const dy = this.stepTarget.y - this.p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const stepLen = TUNING.STEP_SPEED * DT;
    if (dist > stepLen) {
      this.v = { x: (dx / dist) * TUNING.STEP_SPEED, y: (dy / dist) * TUNING.STEP_SPEED };
      this.p.x += (dx / dist) * stepLen;
      this.p.y += (dy / dist) * stepLen;
      this.speed = TUNING.STEP_SPEED;
      if (this.checkEdges()) {
        this.stepTarget = null;
        return;
      }
      return;
    }
    this.p = { ...this.stepTarget };
    if (this.checkEdges()) {
      this.stepTarget = null;
      return;
    }
    this.stepTarget = null;
    if (this.checkHoleAndFinish()) return;
    // Keep sliding until the next cell is blocked; a queued swipe takes over at each stop.
    const side = this.stepSide;
    const cell = this.currentCell();
    const queued = this.stepQueued >= 0 ? this.screenDirToSide(this.stepQueued) : -1;
    if (queued >= 0 && queued !== side && this.cube.open[cell] & (1 << queued)) {
      this.stepQueued = -1;
      this.startSlide(queued);
      return;
    }
    if (this.cube.open[cell] & (1 << side)) {
      this.startSlide(side);
      return;
    }
    this.v = { x: 0, y: 0 };
    this.speed = 0;
    this.events.push({ type: 'impact', strength: 0.8 });
  }
}

/** Replays a recorded run (§7.9). */
export function replayRun(cube: Cube, opts: SimOptions, inputs: number[]): BallSim {
  const sim = new BallSim(cube, opts);
  for (let i = 0; i < inputs.length; i += 2) sim.step(inputs[i], inputs[i + 1]);
  return sim;
}

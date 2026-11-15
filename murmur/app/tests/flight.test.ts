import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_ORDER, TUNING } from '../src/config/tuning';
import { Flight, type Point } from '../src/sim/flight';
import type { Chunk } from '../src/world/chunk';
import chunks from '../src/world/chunks/chunks.json';
import { checkLane } from '../src/world/lane';
import { autofly } from '../src/game/autopilot';

const EMPTY: Chunk = { id: 'empty', tier: 1, clouds: [], wires: [], pylons: [], strays: [], thermals: [] };
const empty = (opts: Partial<ConstructorParameters<typeof Flight>[0]> = {}) => new Flight({ species: 'starlings', seed: 1, chunks: [EMPTY], runsPlayed: 9, hawks: false, ...opts });
const hold = (f: Flight, ticks: number, target: (f: Flight) => Point | null = () => null) => {
  for (let i = 0; i < ticks && !f.over; i++) f.step(target(f));
};

describe('flock', () => {
  it('bird i is i × SPACING behind the leader along the trail', () => {
    for (const sp of SPECIES_ORDER) {
      const f = empty({ species: sp, startBirds: 40 });
      hold(f, 120); // flying straight up the sky
      const s = SPECIES[sp].spacing;
      for (let i = 1; i < 40; i++) {
        const b = f.birds[i];
        expect(f.leader.y - b.y).toBeCloseTo(i * s, 4);
      }
    }
  });

  it('flock width follows the formula and never exceeds the species limit', () => {
    for (const sp of SPECIES_ORDER) {
      for (const n of [1, 10, 50, 120, 300]) {
        const f = empty({ species: sp, startBirds: n });
        hold(f, 60);
        expect(f.spread).toBeCloseTo(Math.min(TUNING.SPREAD_BASE + TUNING.SPREAD_PER_BIRD * n, SPECIES[sp].spreadMax), 9);
        const maxOff = Math.max(...f.birds.map((b) => Math.abs(b.x - f.leader.x)));
        expect(maxOff).toBeLessThanOrEqual(SPECIES[sp].spreadMax + 1e-9);
      }
    }
  });

  it('a bird touching a hazard is lost; one that passes outside is not', () => {
    const f = empty({ startBirds: 5 });
    // A cloud just ahead of the flock, to its right; a wire right across with a gap at the flock.
    // The cloud's edge passes 0.3 tiles outside the widest bird: a near miss, no loss.
    f.place({ id: 'c', tier: 1, clouds: [{ x: 6 + f.spread + TUNING.BIRD_RADIUS + 0.3 + 1.5, y: 3, r: 1.5 }], wires: [], pylons: [], strays: [], thermals: [] }, f.leader.y);
    const before = f.unbanked;
    hold(f, 200);
    expect(f.n).toBe(5);
    expect(f.unbanked - before).toBeGreaterThan(200 / 60 * 5); // includes the +2 near miss
    f.place({ id: 'c2', tier: 1, clouds: [{ x: 6, y: 3, r: 1.0 }], wires: [], pylons: [], strays: [], thermals: [] }, f.leader.y);
    hold(f, 200);
    expect(f.over).toBe(true); // straight through a cloud: every bird is lost
  });

  it('gathers strays within reach and adds them to the back', () => {
    const f = empty({ startBirds: 3 });
    f.place({ id: 's', tier: 1, clouds: [], wires: [], pylons: [], strays: [{ x: 6.4, y: 4 }, { x: 8, y: 4 }], thermals: [] }, f.leader.y);
    hold(f, 120);
    expect(f.n).toBe(4);
    expect(f.stats.gathered).toBe(1);
  });
});

describe('hawks', () => {
  it("a hawk's spot does not move once shown, and the run ends only if the leader is inside when it lands", () => {
    const f = new Flight({ species: 'starlings', seed: 3, chunks: [EMPTY], runsPlayed: 9, startBirds: 30 });
    let spot: Point | null = null;
    while (!spot) {
      f.step(null);
      const e = f.events.find((x) => x.type === 'hawkWarn');
      if (e && e.type === 'hawkWarn') spot = e.spot;
    }
    const hawk = f.hawks[0];
    // Steer hard to the left; the spot stays put.
    for (let i = 0; i < 30; i++) {
      f.step({ x: 1, y: f.leader.y });
      expect(hawk.spot).toEqual(spot);
    }
    hold(f, 60, () => ({ x: 1, y: f.leader.y }));
    expect(f.over).toBe(false);
    expect(f.stats.hawksPassed).toBe(1);

    // Now hold still under the next hawk: the leader is taken and the run ends.
    const g = new Flight({ species: 'starlings', seed: 3, chunks: [EMPTY], runsPlayed: 9, startBirds: 30 });
    hold(g, 60 * 20);
    expect(g.over).toBe(true);
    expect(g.overCause).toBe('hawk');
  });
});

describe('roost trees', () => {
  const circle = (f: Flight, cx: number, cy: number, rad: number, turns: number, ticksPerTurn = 120) => {
    for (let i = 0; i < turns * ticksPerTurn && !f.over; i++) {
      const a = (i / ticksPerTurn) * Math.PI * 2;
      // Target in world coordinates, moving round the tree as the sky scrolls past.
      f.step({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }
  };

  it('banking requires a complete circuit, and each tree banks once', () => {
    const f = empty({ startBirds: 10, species: 'swallows' });
    hold(f, 60);
    const ty = f.camY + 10;
    f.place({ id: 'tree', tier: 1, clouds: [], wires: [], pylons: [], strays: [], thermals: [], tree: { x: 6, y: 0 } }, ty);
    // Fly to the tree and go half way round: nothing banked.
    const tree = f.trees[f.trees.length - 1];
    let banked = 0;
    for (let i = 0; i < 600 && !tree.banked; i++) {
      const a = (i / 90) * Math.PI * 2;
      f.step({ x: tree.x + Math.cos(a) * 1.8, y: tree.y + Math.sin(a) * 1.8 });
      if (i === 45) banked = f.banked;
    }
    expect(banked).toBe(0);
    expect(tree.banked).toBe(true);
    expect(f.banked).toBeGreaterThan(0);
    expect(f.unbanked).toBeLessThan(1);
    const after = f.banked;
    circle(f, tree.x, tree.y, 1.8, 2, 90);
    expect(f.banked).toBe(after);
  });
});

describe('murmurations', () => {
  it('a path that crosses itself within 8 tiles triggers one; a wide curve does not', () => {
    const f = empty({ startBirds: 20, species: 'swallows' });
    hold(f, 30);
    // A loop fixed in the sky, 1 tile in radius (6.3 tiles round), flown one and a bit times: it crosses itself.
    const c = { x: 6, y: f.leader.y + 1 };
    for (let i = 0; i < 110; i++) {
      const a = -Math.PI / 2 + (i / 90) * Math.PI * 2;
      f.step({ x: c.x + Math.cos(a), y: c.y + Math.sin(a) });
    }
    expect(f.stats.murmurations).toBeGreaterThanOrEqual(1);

    const g = empty({ startBirds: 20, species: 'swallows' });
    hold(g, 30);
    for (let i = 0; i < 300; i++) {
      const a = (i / 300) * Math.PI;
      g.step({ x: 6 + Math.cos(a) * 4, y: g.camY + 10 });
    }
    expect(g.stats.murmurations).toBe(0);
  });
});

describe('scoring', () => {
  it('unbanked score is lost when a run ends without a revive', () => {
    const f = empty({ startBirds: 10 });
    hold(f, 600);
    expect(f.unbanked).toBeGreaterThan(50);
    expect(f.score).toBe(0);
    f.place({ id: 'c', tier: 1, clouds: [{ x: 6, y: 2, r: 2.5 }], wires: [], pylons: [], strays: [], thermals: [] }, f.leader.y);
    hold(f, 200);
    expect(f.over).toBe(true);
    expect(f.score).toBe(0);
    expect(f.feathers).toBe(0);
  });

  it('a revive restarts with 10 birds, clears hazards on screen and keeps the unbanked score', () => {
    const f = empty({ startBirds: 10 });
    hold(f, 300);
    f.place({ id: 'c', tier: 1, clouds: [{ x: 6, y: 2, r: 2.5 }], wires: [], pylons: [], strays: [], thermals: [] }, f.leader.y);
    hold(f, 200);
    const keep = f.unbanked;
    f.revive();
    expect(f.over).toBe(false);
    expect(f.n).toBe(TUNING.REVIVE_BIRDS);
    expect(f.unbanked).toBe(keep);
    expect(f.clouds.filter((c) => c.baseY + c.y > f.camY && c.baseY + c.y < f.camY + 20).length).toBe(0);
    f.revive();
    expect(f.revived).toBe(true);
  });
});

describe('chunks', () => {
  it('every chunk has a clear lane of its tier width', () => {
    expect((chunks as Chunk[]).length).toBe(40);
    for (const c of chunks as Chunk[]) expect(checkLane(c, TUNING.TIER_LANE[c.tier - 1]).ok, c.id).toBe(true);
  });

  it('an automatic pilot following the clear lane survives three minutes (hawks excluded)', () => {
    // `npm run autopilot` runs the full 500; the test suite flies a sample.
    const runs = Number(process.env.RUNS ?? 30);
    for (let i = 0; i < runs; i++) {
      const f = new Flight({ species: SPECIES_ORDER[i % 3], seed: 1 + i * 7919, chunks: chunks as Chunk[], runsPlayed: 5, hawks: false });
      expect(autofly(f, 180), `run ${i}`).toBeGreaterThanOrEqual(180 - 1e-6);
    }
  });
});

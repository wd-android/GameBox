import { describe, expect, it } from 'vitest';
import { TUNING, type BoatKind } from '../src/config/tuning';
import { Beam, NO_UPGRADES, angleTo } from '../src/sim/beam';
import { NightSim, type Boat } from '../src/sim/night';
import { keeperPlay } from '../src/sim/keeper';
import { NIGHT_COUNT, night, arrivals, fogBanks, fogAllowed, type NightDef } from '../src/nights/nights';
import { CHARTS } from '../src/charts/charts';
import { BeamInput } from '../src/input/control';
import { edgePoints, runAlert } from '../tools/routes-check';

const L = TUNING.LIGHTHOUSE;
const single = (kind: BoatKind, x: number, y: number, heading: number, extra: Partial<NightDef> = {}): NightDef => ({
  n: 0, chart: 'bay', seed: 0, boats: 1, mix: [kind], interval: 0, fog: 0, currentStrength: 0, maxOnSea: 1, scripted: [{ t: 0, kind, x, y, heading }], ...extra,
});

describe('the beam (§6.1, §6.2)', () => {
  it('lights a boat exactly inside its angle and reach', () => {
    const beam = new Beam();
    beam.angle = 20;
    for (let a = -79.87; a <= 80; a += 0.5)
      for (const d of [2, 6, 12.9, 13.1]) {
        const rad = (a * Math.PI) / 180;
        const x = L.x + Math.sin(rad) * d;
        const y = L.y - Math.cos(rad) * d;
        const inside = Math.abs(a - 20) <= beam.halfWidth && d <= beam.reach;
        expect(beam.lights(x, y, false)).toBe(inside);
        expect(beam.lights(x, y, true)).toBe(Math.abs(a - 20) <= beam.halfWidth && d <= beam.reach * 0.6);
      }
  });

  it('never turns faster than its turning speed, in either control option', () => {
    for (const mode of ['drag', 'touch'] as const)
      for (const up of [0, 1, 2]) {
        const beam = new Beam({ ...NO_UPGRADES, turn: up });
        const input = new BeamInput(beam, (x, y) => ({ x: x / 30, y: y / 30 }));
        input.mode = mode;
        input.down(1, 0, 300);
        let maxStep = 0;
        for (let t = 0; t < 120; t++) {
          // Wild input: big jumps either side.
          input.move(1, t % 2 ? 900 : -900, t % 3 ? 30 : 300);
          maxStep = Math.max(maxStep, Math.abs(beam.step(TUNING.TICK)));
        }
        expect(maxStep).toBeLessThanOrEqual(TUNING.BEAM_TURN[up] * TUNING.TICK + 1e-9);
        expect(Math.abs(beam.angle)).toBeLessThanOrEqual(80);
      }
  });

  it('touch to aim ignores touches on the harbour strip', () => {
    const beam = new Beam();
    const input = new BeamInput(beam, (x, y) => ({ x, y }));
    input.mode = 'touch';
    input.down(1, 2, 17);
    expect(beam.target).toBe(0);
    input.move(1, 2, 8);
    expect(beam.target).toBeCloseTo(angleTo(2, 8));
  });

  it('lifting the thumb leaves the beam where it is', () => {
    const beam = new Beam();
    const input = new BeamInput(beam, (x, y) => ({ x, y }));
    input.down(1, 100, 500);
    input.move(1, 140, 500);
    input.up(1);
    const t = beam.target;
    expect(t).toBeCloseTo(40 * TUNING.DRAG_SENSITIVITY.default);
    for (let k = 0; k < 120; k++) beam.step(TUNING.TICK);
    expect(beam.angle).toBeCloseTo(t);
  });
});

describe('boats (§6.4, §6.5)', () => {
  it('stays alert for one second after the beam leaves it, and no longer', () => {
    const sim = new NightSim(single('fishing', 6, 9, Math.PI / 2), NO_UPGRADES);
    sim.beam.angle = sim.beam.target = 0;
    sim.step();
    const b = sim.boats[0];
    expect(b.lit).toBe(true);
    sim.beam.angle = sim.beam.target = 60;
    let alertTicks = 0;
    while (b.alert > 0 && alertTicks < 200) {
      sim.step();
      alertTicks++;
    }
    expect(alertTicks * TUNING.TICK).toBeGreaterThanOrEqual(TUNING.ALERT_SECONDS - TUNING.TICK);
    expect(alertTicks * TUNING.TICK).toBeLessThanOrEqual(TUNING.ALERT_SECONDS + TUNING.TICK);
  });

  it('a boat kept alert from arrival reaches the harbour from every edge position on every chart', () => {
    for (const chart of ['bay', 'skerries'] as const)
      for (const kind of ['fishing', 'dinghy', 'trawler'] as const)
        for (const p of edgePoints(chart)) for (const s of [-25, 0, 25]) expect(runAlert(chart, kind, p.x, p.y, s), `${chart} ${kind} ${p.x},${p.y} ${s}`).toBe('landed');
  });

  it('a dark boat holds its heading and drifts only inside a current', () => {
    const def = single('dinghy', 0.5, 6, 0.6, { n: 10, currentStrength: 0.5 });
    def.scripted![0].y = 5.6;
    const sim = new NightSim(def, NO_UPGRADES);
    sim.beam.angle = sim.beam.target = -80; // well away
    sim.step();
    const b: Boat = sim.boats[0];
    let sawDrift = false;
    for (let t = 0; t < 300 && b.outcome === 'sailing'; t++) {
      const { x, y, heading } = b;
      sim.step();
      if (b.outcome !== 'sailing' || b.alert > 0) break;
      expect(b.heading).toBe(heading);
      const dx = b.x - x - Math.cos(heading) * 1.6 * TUNING.TICK;
      const dy = b.y - y - Math.sin(heading) * 1.6 * TUNING.TICK;
      const c = sim.currentAt(x, y);
      if (c.x === 0 && c.y === 0) expect(Math.hypot(dx, dy)).toBeLessThan(1e-9);
      else {
        sawDrift = true;
        expect(dx).toBeCloseTo(c.x * 2 * TUNING.TICK, 9);
      }
    }
    expect(sawDrift).toBe(true);
  });
});

describe('a night (§6.6, §8)', () => {
  it('ends at the third wreck or loss', () => {
    // Three boats sailing straight off the side with the beam elsewhere.
    const def: NightDef = {
      n: 0, chart: 'bay', seed: 0, boats: 5, mix: ['dinghy'], interval: 0, fog: 0, currentStrength: 0, maxOnSea: 5,
      scripted: [0, 0.2, 0.4, 0.6, 0.8].map((t, i) => ({ t, kind: 'dinghy' as const, x: 11.5, y: 1 + i, heading: 0 })),
    };
    const sim = new NightSim(def, NO_UPGRADES);
    sim.beam.angle = sim.beam.target = -80;
    while (!sim.over) sim.step();
    expect(sim.strikes).toBe(3);
    const r = sim.result();
    expect(r.failed).toBe(true);
    expect(r.stars).toBe(0);
    expect(sim.boats.filter((b) => b.outcome === 'lost').length).toBe(3);
  });

  it('every accepted night earns three stars under the automatic keeper with the starting lighthouse', () => {
    for (let n = 1; n <= NIGHT_COUNT; n++) expect(keeperPlay(new NightSim(night(n), NO_UPGRADES)).stars, `night ${n}`).toBe(3);
  });

  it('arrivals follow the recipe: count, spacing, kinds, at most N on the sea', () => {
    for (let n = 1; n <= NIGHT_COUNT; n++) {
      const def = night(n);
      const list = arrivals(def);
      expect(list.length).toBe(def.boats);
      for (let i = 1; i < list.length; i++) expect(list[i].t - list[i - 1].t).toBeGreaterThanOrEqual(TUNING.MIN_ARRIVAL_GAP - 1e-9);
      for (const a of list) expect(def.mix).toContain(a.kind);
      if (n >= 8) expect(new Set(list.map((a) => a.kind)).size).toBe(3);
      // Played by the keeper, the sea never holds more than maxOnSea boats.
      const sim = new NightSim(def, NO_UPGRADES);
      const k = new (class {
        max = 0;
      })();
      while (!sim.over) {
        sim.step();
        k.max = Math.max(k.max, sim.boats.filter((b) => b.outcome === 'sailing').length);
      }
      expect(k.max, `night ${n}`).toBeLessThanOrEqual(def.maxOnSea);
    }
  });

  it('is deterministic: the same night and inputs play the same way', () => {
    const a = keeperPlay(new NightSim(night(23), NO_UPGRADES));
    const b = keeperPlay(new NightSim(night(23), NO_UPGRADES));
    expect(a).toEqual(b);
  });

  it('fog never settles over rocks the fogged beam cannot reach', () => {
    for (let n = 15; n <= NIGHT_COUNT; n++) {
      const def = night(n);
      expect(fogBanks(def).length).toBeGreaterThan(0);
      const sim = new NightSim(def, NO_UPGRADES);
      for (let t = 0; t < 60 * 60; t++) {
        sim.step();
        for (const f of sim.fog) expect(fogAllowed(CHARTS[def.chart], f.x, f.y, f.r)).toBe(true);
        if (sim.over) break;
      }
    }
  });

  it('stars: 3 clean, 2 with one strike, 1 with two; clean bonus is 25%', () => {
    const sim = new NightSim(night(1), NO_UPGRADES);
    const r = keeperPlay(sim);
    expect(r.stars).toBe(3);
    expect(r.bonus).toBe(Math.round(r.catch * 0.25));
    sim.strikes = 1;
    expect(sim.result().stars).toBe(2);
    sim.strikes = 2;
    expect(sim.result().stars).toBe(1);
  });
});

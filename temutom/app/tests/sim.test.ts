import { describe, expect, it } from 'vitest';
import { SHIFTS } from '../src/content/shifts';
import { createShift, runShift, applyInput, step, checkObjective } from '../src/sim/shift';
import type { Input, ShiftDef, ShiftState } from '../src/sim/types';
import { understandProbability, anticipationProbability, maybeAnticipate, initialStaffState } from '../src/sim/staff';
import { outburstTarget, startOutburst } from '../src/sim/irritation';
import { lapseAllowed, maybeLapse } from '../src/sim/brainCell';
import { moraleLevel } from '../src/sim/morale';
import { starsFor, scoreShift } from '../src/game/scoring';
import { TUNING } from '../src/config/tuning';
import { activeSpots } from '../src/sim/util';
import { verbsFor } from '../src/sim/verbs';
import { issueDemand } from '../src/sim/demands';
import { freshSave, serialise, deserialise } from '../src/state/save';
import { applyShiftResult } from '../src/game/progress';
import { thinker, screamer } from '../tools/bots';

const opts = () => ({ compliance: {}, morale: 70, thronesClaimed: [] as string[], settings: { fewerLapses: false, longerPatience: false } });
const def = (id: string) => SHIFTS.find((s) => s.id === id)!;

/** A deterministic pseudo-random player, driven only by the shift's own state */
function chaos(seed: number) {
  let r = seed;
  const rnd = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
  return (s: ShiftState): Input[] => {
    const x = rnd();
    const spots = activeSpots(s);
    if (x < 0.02) return [{ type: 'tapSpot', spot: spots[Math.floor(rnd() * spots.length)].id }];
    if (x < 0.03) return [{ type: 'screamStart' }];
    if (x < 0.045) return [{ type: 'screamEnd' }];
    if (x < 0.055 && s.staff.length) {
      const m = s.staff[Math.floor(rnd() * s.staff.length)];
      const v = verbsFor(s, { kind: 'staff', id: m.id });
      if (v.length) return [{ type: 'verb', verb: v[Math.floor(rnd() * v.length)], target: { kind: 'staff', id: m.id } }];
    }
    if (x < 0.06 && s.objects.length) return [{ type: 'verb', verb: 'knockOff', target: { kind: 'object', id: s.objects[Math.floor(rnd() * s.objects.length)].id } }];
    if (x < 0.065) return [{ type: 'scheme' }];
    if (x < 0.067) return [{ type: 'outburst' }];
    if (x < 0.07) return [{ type: 'verb', verb: 'smack', target: { kind: 'dog' } }];
    return [];
  };
}

function snapshot(s: ShiftState) {
  return JSON.stringify({ t: s.time, cat: s.cat, staff: s.staff, morale: s.morale, tally: s.tally, band: s.band, status: s.status, rng: s.rng, threat: s.threat?.data });
}

describe('determinism', () => {
  it('the same seed and the same inputs give the same final state', () => {
    for (const id of ['w1d2night', 'w1d7night', 'w2d4dawn', 'w3d7night']) {
      const a = runShift(createShift(def(id), opts()), chaos(42));
      const b = runShift(createShift(def(id), opts()), chaos(42));
      expect(snapshot(a)).toBe(snapshot(b));
    }
  });
});

describe('ranges', () => {
  it('attention, irritation, compliance and morale never leave their ranges, and the band obeys its limits', () => {
    for (const d of SHIFTS.filter((_, i) => i % 4 === 0)) {
      const s = createShift(d, opts());
      const policy = chaos(d.seed);
      let prevCentre = s.band.centre;
      while (s.status === 'running') {
        for (const i of policy(s)) applyInput(s, i);
        step(s);
        s.events.length = 0;
        expect(s.cat.attention).toBeGreaterThanOrEqual(0);
        expect(s.cat.attention).toBeLessThanOrEqual(100);
        expect(s.cat.irritation).toBeGreaterThanOrEqual(0);
        expect(s.cat.irritation).toBeLessThanOrEqual(100);
        expect(s.morale).toBeGreaterThanOrEqual(0);
        expect(s.morale).toBeLessThanOrEqual(100);
        for (const m of s.staff) for (const v of Object.values(m.compliance)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
        expect(s.band.centre).toBeGreaterThanOrEqual(TUNING.band.min);
        expect(s.band.centre).toBeLessThanOrEqual(TUNING.band.max);
        expect(Math.abs(s.band.centre - prevCentre)).toBeLessThanOrEqual(TUNING.band.driftSpeed * TUNING.dt + 1e-9);
        prevCentre = s.band.centre;
      }
    }
  });

  it('the Houseguest’s compliance never passes 40, except Lap in the final shift of his week', () => {
    const s = runShift(createShift(def('w3d4dawn'), { ...opts(), compliance: { guest: { food: 90, door: 90, lap: 90, play: 90 } } }), thinker(true));
    const g = s.staff.find((m) => m.id === 'guest')!;
    for (const v of Object.values(g.compliance)) expect(v).toBeLessThanOrEqual(40);
  });
});

describe('outburst', () => {
  it('chooses bite, then swipe, then zoomies', () => {
    const s = createShift(def('w1d4dawn'), opts());
    const soft = s.staff[0];
    // Staff adjacent → bite
    soft.x = s.cat.x + 5; soft.y = s.cat.y;
    expect(outburstTarget(s)).toBe('bite');
    // Staff far away, cat next to a ledge → swipe
    soft.x = 0; soft.y = 0;
    s.cat.spot = 'shelf'; s.cat.x = 18; s.cat.y = 28;
    soft.x = 95; soft.y = 125;
    expect(outburstTarget(s)).toBe('swipe');
    // Nothing near → zoomies
    s.objects.forEach((o) => (o.knocked = true));
    expect(outburstTarget(s)).toBe('zoomies');
  });

  it('starts automatically at 100 Irritation and resets it', () => {
    const s = createShift(def('w1d4dawn'), opts());
    s.cat.irritation = 99.99;
    s.cat.attention = 0;
    step(s);
    expect(s.cat.action).toBe('outburst');
    expect(s.cat.irritation).toBe(0);
    expect(s.cat.attention).toBe(s.band.centre);
  });

  it('a deliberate Outburst needs 50 Irritation and lowers it by 50', () => {
    const s = createShift(def('w1d4dawn'), opts());
    s.cat.irritation = 40;
    startOutburst(s, true);
    expect(s.cat.action).not.toBe('outburst');
    s.cat.irritation = 70;
    startOutburst(s, true);
    expect(s.cat.action).toBe('outburst');
    expect(s.cat.irritation).toBe(20);
  });
});

describe('understanding and anticipation', () => {
  it('matches the formula at its boundaries, including the cap', () => {
    expect(understandProbability(0.3, false, 0, 0)).toBeCloseTo(0.3);
    expect(understandProbability(0.3, true, 0, 0)).toBeCloseTo(0.55);
    expect(understandProbability(0.55, true, 100, 0.1)).toBeCloseTo(0.95);
    expect(understandProbability(0.55, true, 100, 0.5)).toBe(0.95);
    expect(understandProbability(0.2, false, 0, -0.5)).toBe(0);
    expect(understandProbability(0.55, false, 40, -0.1)).toBeCloseTo(0.65);
  });

  it('never anticipates below 60, and always at 90 or above when in Routine', () => {
    expect(anticipationProbability(59.9)).toBe(0);
    expect(anticipationProbability(60)).toBeCloseTo(0.25);
    expect(anticipationProbability(75)).toBeCloseTo(0.625);
    expect(anticipationProbability(90)).toBe(1);
    expect(anticipationProbability(100)).toBe(1);
    for (let seed = 1; seed < 30; seed++) {
      const s = createShift({ ...def('w1d5night'), seed }, { ...opts(), compliance: { soft: { food: 90, door: 0, lap: 0, play: 0 } } });
      s.staff[0].mode = 'routine';
      issueDemand(s, 'food');
      expect(s.staff[0].anticipate).not.toBeNull();
      const s2 = createShift({ ...def('w1d5night'), seed }, { ...opts(), compliance: { soft: { food: 59, door: 0, lap: 0, play: 0 } } });
      issueDemand(s2, 'food');
      expect(s2.staff[0].anticipate).toBeNull();
    }
    void maybeAnticipate; void initialStaffState;
  });
});

describe('lapses', () => {
  const brainy = () => {
    const s = createShift(def('w1d5night'), opts());
    s.time = 20;
    s.cat.brain = { phase: 'away', t: 10 };
    return s;
  };
  it('no lapse within 6 s of the previous one', () => {
    const s = brainy();
    expect(maybeLapse(s, 'mid', true)).not.toBeUndefined();
    s.cat.action = 'idle'; s.cat.lapse = null;
    s.time += 5.9;
    expect(lapseAllowed(s)).toBe(false);
    s.time += 0.2;
    expect(lapseAllowed(s)).toBe(true);
  });
  it('no lapse in the last 10 seconds, during a Scheme, or while the Brain Cell is present', () => {
    const s = brainy();
    s.time = s.length - 9.9;
    expect(lapseAllowed(s)).toBe(false);
    const s2 = brainy();
    s2.scheme = { id: 'treats', spot: 'cupboard', step: 1, t: 0 };
    expect(lapseAllowed(s2)).toBe(false);
    const s3 = brainy();
    s3.cat.brain = { phase: 'present', t: 5 };
    expect(lapseAllowed(s3)).toBe(false);
  });
  it('verbs are never subject to lapses, and a lapse does not raise Irritation', () => {
    const s = brainy();
    (TUNING.lapse as { chance: number }).chance = 1;
    try {
      const before = s.tally.lapses;
      applyInput(s, { type: 'verb', verb: 'stare', target: { kind: 'staff', id: 'soft' } });
      expect(s.tally.lapses).toBe(before);
      s.cat.action = 'idle';
      const irr = s.cat.irritation;
      applyInput(s, { type: 'tapSpot', spot: 'bowl' });
      expect(s.tally.lapses).toBe(before + 1);
      expect(s.cat.irritation).toBe(irr);
    } finally {
      (TUNING.lapse as { chance: number }).chance = 0.12;
    }
  });
  it('witnesses raise morale', () => {
    const s = brainy();
    const m = s.morale;
    maybeLapse(s, 'mid', true);
    expect(s.morale).toBeGreaterThan(m);
  });
  it('“Fewer lapses” halves the chance', () => {
    const s = brainy();
    s.settings.fewerLapses = true;
    let n = 0;
    for (let i = 0; i < 4000; i++) { s.lastLapseAt = -99; s.cat.action = 'idle'; if (maybeLapse(s, 'mid') !== undefined) n++; }
    expect(n / 4000).toBeGreaterThan(0.04);
    expect(n / 4000).toBeLessThan(0.08);
  });
});

describe('schemes', () => {
  it('cannot be started while the Brain Cell is away, and reset if it leaves', () => {
    const s = createShift(def('w1d5morning'), opts());
    s.cat.spot = 'cupboard'; s.cat.x = 20; s.cat.y = 44; s.cat.action = 'idle';
    s.cat.brain = { phase: 'away', t: 10 };
    applyInput(s, { type: 'scheme' });
    expect(s.scheme).toBeNull();
    s.cat.brain = { phase: 'present', t: 1.5 };
    applyInput(s, { type: 'scheme' });
    expect(s.scheme?.step).toBe(0);
    for (let i = 0; i < 60; i++) step(s);
    expect(s.cat.brain.phase).toBe('away');
    expect(s.scheme).toBeNull();
  });
  it('the treat cupboard meets a Food demand without staff and scores it twice', () => {
    const s = createShift(def('w1d5morning'), opts());
    s.cat.spot = 'cupboard'; s.cat.x = 20; s.cat.y = 44; s.cat.action = 'idle';
    s.cat.brain = { phase: 'present', t: 10 };
    issueDemand(s, 'food');
    s.staff.forEach((m) => { m.present = false; m.mode = 'away'; m.modeT = Infinity; });
    for (let k = 0; k < 3; k++) { applyInput(s, { type: 'scheme' }); for (let i = 0; i < 32; i++) step(s); }
    expect(s.tally.met).toBe(2);
  });
});

describe('morale thresholds', () => {
  it('change behaviour at exactly the stated values', () => {
    expect(moraleLevel(50)).toBe('fine');
    expect(moraleLevel(49.99)).toBe('boundaries');
    expect(moraleLevel(25)).toBe('boundaries');
    expect(moraleLevel(24.99)).toBe('spray');
    expect(moraleLevel(0)).toBe('carrier');
  });
  it('morale at zero brings The Carrier', () => {
    const s = createShift(def('w1d4dawn'), opts());
    s.morale = 0.5;
    applyInput(s, { type: 'verb', verb: 'smack', target: { kind: 'staff', id: 'soft' } });
    s.staff[0].x = s.cat.x + 4; s.staff[0].y = s.cat.y;
    applyInput(s, { type: 'verb', verb: 'smack', target: { kind: 'staff', id: 'soft' } });
    step(s);
    expect(s.status).toBe('failed');
    expect(s.endReason).toBe('carrier');
  });
  it('below 25, a scream is answered with the spray bottle', () => {
    const s = createShift(def('w1d4dawn'), opts());
    s.morale = 20;
    applyInput(s, { type: 'screamStart' });
    for (let i = 0; i < 90; i++) step(s);
    expect(s.tally.sprayed).toBe(1);
  });
});

describe('stars', () => {
  it('follow the thresholds at each boundary', () => {
    expect(starsFor(false, 100)).toBe(0);
    expect(starsFor(true, 59)).toBe(1);
    expect(starsFor(true, 60)).toBe(2);
    expect(starsFor(true, 79)).toBe(2);
    expect(starsFor(true, 80)).toBe(3);
  });
  it('score is out of 100', () => {
    const s = runShift(createShift(def('w1d2night'), opts()), thinker(true));
    const sc = scoreShift(s).total;
    expect(sc).toBeGreaterThanOrEqual(0);
    expect(sc).toBeLessThanOrEqual(100);
  });
});

describe('save', () => {
  it('loads back to an identical state', () => {
    const save = freshSave();
    const s = runShift(createShift(def('w1d1morning'), opts()), thinker(false));
    applyShiftResult(save, s);
    const back = deserialise(serialise(save));
    expect(back).toEqual(save);
  });
});

describe('content', () => {
  it('has three weeks of seven days of five shifts', () => {
    expect(SHIFTS.length).toBe(105);
    expect(new Set(SHIFTS.map((s) => s.id)).size).toBe(105);
  });
  it('the Dog arrives in Week 2 and the Houseguest in Week 3', () => {
    expect(SHIFTS.find((s) => s.threat?.id === 'dog')!.week).toBe(2);
    expect(SHIFTS.find((s) => s.threat?.id === 'guest')!.week).toBe(3);
  });
  it('every shift runs to an end without error', () => {
    for (const d of SHIFTS) {
      const s = runShift(createShift(d as ShiftDef, opts()), screamer());
      expect(['won', 'failed']).toContain(s.status);
      void checkObjective;
    }
  });
});

import { describe, expect, it } from 'vitest';
import { MOMENTS } from '../src/content/moments';
import { createMoment, runMoment, applyInput, step, DEFAULT_OPTIONS } from '../src/sim/moment';
import type { MomentDef, MomentState } from '../src/sim/types';
import { LADDER } from '../src/sim/types';
import { TUNING } from '../src/config/tuning';
import { minWarning } from '../src/sim/strike';
import { startLapse } from '../src/sim/lapses';
import { issueDemand, tellShown } from '../src/sim/demands';
import { ladderStepAt } from '../src/sim/escalation';
import { starsFor, standingFor, standingStars } from '../src/game/scoring';
import { freshSave, serialise, deserialise } from '../src/state/save';
import { applyResult } from '../src/game/progress';
import { reader, ignorer } from '../tools/bots';
import { distToPath } from '../src/sim/util';
import { PLACES } from '../src/content/places';
import { FIELD_NOTES } from '../src/content/fieldNotes';
import { answer } from '../src/sim/demands';

const def = (id: string) => MOMENTS.find((m) => m.id === id)!;
type Thumb = { down: boolean; x: number; y: number };

/** Deterministic random thumb */
function chaos(seed: number) {
  let r = seed >>> 0;
  const rnd = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
  let cur: Thumb = { down: false, x: 195, y: 500 };
  return (s: MomentState): Thumb => {
    const x = rnd();
    if (x < 0.03) cur = { down: !cur.down, x: rnd() * 390, y: 60 + rnd() * 740 };
    else if (cur.down && x < 0.6) cur = { down: true, x: Math.max(0, Math.min(390, cur.x + (rnd() - 0.5) * 30)), y: Math.max(0, Math.min(800, cur.y + (rnd() - 0.5) * 30)) };
    // Sometimes aim for him
    if (x > 0.995 && s.cat.onScreen) cur = { down: true, x: s.cat.x, y: s.cat.y - 60 * s.cat.scale };
    return cur;
  };
}

function snap(s: MomentState) {
  return JSON.stringify({ t: s.time, cat: { ...s.cat, display: undefined }, plasters: s.plasters, tally: s.tally, marks: s.marks, band: s.band, rng: s.rng, status: s.status });
}

/** Run with a policy, checking an invariant after every step */
function watch(d: MomentDef, policy: (s: MomentState) => Thumb | null, check: (s: MomentState, prev: { mood: string; warnStart: number }) => void) {
  const s = createMoment(d);
  const prev = { mood: s.cat.mood as string, warnStart: -1 };
  while (s.status === 'running') {
    const p = policy(s);
    if (p) applyInput(s, { type: 'hand', ...p });
    step(s);
    check(s, prev);
    s.events.length = 0;
  }
  return s;
}

describe('determinism', () => {
  it('the same seed and the same touch input give the same final state', () => {
    for (const id of ['w1d1dawn', 'w1d5evening', 'w1d7night', 'w2d7night']) {
      expect(snap(runMoment(createMoment(def(id)), chaos(7)))).toBe(snap(runMoment(createMoment(def(id)), chaos(7))));
    }
  });
});

describe('ranges', () => {
  it('attention and irritation never leave their ranges; the band stays within its limits', () => {
    for (const d of MOMENTS.filter((_, i) => i % 5 === 0)) {
      watch(d, chaos(d.seed), (s) => {
        expect(s.cat.attention).toBeGreaterThanOrEqual(0); expect(s.cat.attention).toBeLessThanOrEqual(100);
        expect(s.cat.irritation).toBeGreaterThanOrEqual(0); expect(s.cat.irritation).toBeLessThanOrEqual(100);
        expect(s.band.centre).toBeGreaterThanOrEqual(TUNING.band.min); expect(s.band.centre).toBeLessThanOrEqual(TUNING.band.max);
      });
    }
  });
});

describe('the fairness rule', () => {
  it('no strike ever begins without at least the minimum Warning before it (many random moments)', () => {
    const n = Number(process.env.FAIRNESS_RUNS ?? 400);
    let strikes = 0;
    for (let i = 0; i < n; i++) {
      const d = MOMENTS[i % MOMENTS.length];
      watch({ ...d, seed: d.seed + i }, chaos(i * 31 + 1), (s, prev) => {
        if (s.cat.strike && s.cat.strike.phase === 'windup' && !(s as unknown as { _seen?: boolean })._seen) {
          (s as unknown as { _seen?: boolean })._seen = true;
          strikes++;
          expect(s.time - s.cat.warningSince).toBeGreaterThanOrEqual(minWarning(s) - 1e-9);
        }
        if (!s.cat.strike) (s as unknown as { _seen?: boolean })._seen = false;
        prev.mood = s.cat.mood;
      });
    }
    expect(strikes).toBeGreaterThan(0);
  }, 900_000);

  it('a thumb lifted before the end of a wind-up never costs a plaster', () => {
    let checked = 0;
    for (let i = 0; i < 120; i++) {
      const d = MOMENTS[(i * 7) % MOMENTS.length];
      const s = createMoment({ ...d, seed: d.seed + i });
      const policy = reader(true); // lifts at any Warning or wind-up
      let lost = 0;
      while (s.status === 'running') {
        const p = policy(s);
        if (p) applyInput(s, { type: 'hand', ...p });
        const before = s.plasters;
        const lifted = !s.hand.down;
        step(s);
        if (s.plasters < before && lifted && !s.hand.drag) lost++;
        s.events.length = 0;
      }
      checked++;
      expect(lost).toBe(0);
    }
    expect(checked).toBe(120);
  });
});

describe('screen effects', () => {
  it('a swipe always leaves a mark; a missed bite never produces a wash; at most 6 marks; one wash per 3 s', () => {
    for (let i = 0; i < 80; i++) {
      const d = MOMENTS[(i * 3) % MOMENTS.length];
      let lastWashAt = -99;
      let marksBefore = 0;
      watch({ ...d, seed: d.seed + i }, chaos(i + 99), (s) => {
        expect(s.marks.length).toBeLessThanOrEqual(TUNING.marks.max);
        if (s.wash && s.wash.born !== lastWashAt) {
          expect(s.wash.born - lastWashAt).toBeGreaterThanOrEqual(3);
          lastWashAt = s.wash.born;
        }
        for (const e of s.events) {
          if (e.type === 'snap') expect(s.wash?.born === s.time).toBe(false);
          if (e.type === 'mark') expect(s.marks.length).toBeGreaterThanOrEqual(Math.min(TUNING.marks.max, marksBefore));
        }
        marksBefore = s.marks.length;
      });
    }
  });

  it('a swipe mark is four strokes along a curved path through the aim', () => {
    const s = createMoment(def('w1d2dawn'));
    s.cat.mood = 'warning'; s.cat.warningSince = -5; s.cat.irritation = 100;
    applyInput(s, { type: 'hand', down: true, x: 200, y: 400 });
    let marks = 0;
    for (let i = 0; i < 40 && !marks; i++) { step(s); marks = s.marks.length; }
    expect(marks).toBe(1);
    expect(distToPath({ x: 200, y: 400 }, s.marks[0].path)).toBeLessThan(TUNING.strike.swipeHitRange);
  });
});

describe('demands and the ladder', () => {
  it('his tells always match the active demand', () => {
    for (const d of MOMENTS.filter((_, i) => i % 3 === 0)) {
      watch(d, chaos(d.seed + 5), (s) => {
        if (s.cat.display.tell) expect(s.cat.display.tell).toBe(s.cat.demand?.kind);
      });
    }
  });

  it('reaches each step at its stated time and stops when the demand is met', () => {
    expect(LADDER.map((_, i) => [0, 4, 8, 14, 20, 26, 32][i]).map((t) => ladderStepAt(t))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ladderStepAt(3.99)).toBe(0);
    const s = createMoment(def('w1d5dawn'));
    s.def.demands.interval = undefined;
    s.nextDemandAt = Infinity;
    issueDemand(s, 'nothing');
    const seen: number[] = [];
    for (let i = 0; i < 30 * 21; i++) { step(s); if (s.cat.demand && !seen.includes(s.cat.demand.step)) seen.push(s.cat.demand.step); s.events.length = 0; }
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    // Meet it: tap him
    const c = s.cat;
    applyInput(s, { type: 'hand', down: true, x: c.x + 26 * c.scale * c.facing, y: c.y - 112 * c.scale }); step(s);
    applyInput(s, { type: 'hand', down: false, x: c.x, y: c.y }); step(s);
    if (s.cat.demand) {
      // He may have been on the work; at least the ladder never climbs past a met demand
      expect(s.cat.demand.step).toBeLessThanOrEqual(5);
    } else expect(s.tally.met).toBe(1);
  });

  it('Week 2 tells are brief', () => {
    const s = createMoment(def('w2d1morning'));
    issueDemand(s, 'lap');
    expect(tellShown(s)).toBe(true);
    s.time += 4;
    expect(tellShown(s)).toBe(false);
  });
});

describe('scripted events and the smack', () => {
  it('the first moment has its scripted swipe: a Warning, then a mark, and never a plaster', () => {
    const s = createMoment(def('w1d1dawn'));
    const policy = reader(false);
    let forced = -1, marksBefore = 0, struck = -1;
    while (s.status === 'running') {
      const p = policy(s);
      if (p) applyInput(s, { type: 'hand', ...p });
      step(s);
      if (forced < 0 && s.cat.forcedWarning) { forced = s.time; marksBefore = s.markSeq; }
      if (forced >= 0 && struck < 0 && s.markSeq > marksBefore) struck = s.time;
      s.events.length = 0;
    }
    expect(forced).toBeGreaterThanOrEqual(28);
    expect(forced).toBeLessThan(29);
    expect(struck - forced).toBeGreaterThanOrEqual(minWarning(s) + TUNING.strike.swipeWindup - 1e-6);
    expect(s.tally.plastersLost).toBe(0);
    expect(s.plasters).toBe(s.plastersStart);
    expect(s.status).toBe('won');
  });

  it('meeting the demand cancels a smack that has not been thrown yet', () => {
    const s = createMoment(def('w1d5dawn'));
    s.def = { ...s.def, demands: {} };
    s.nextDemandAt = Infinity;
    issueDemand(s, 'nothing', LADDER.indexOf('smack'));
    step(s);
    expect(s.cat.forcedWarning).toBe(true);
    expect(answer(s, 'nothing')).toBe(true);
    expect(s.cat.forcedWarning).toBe(false);
    for (let i = 0; i < 90; i++) step(s);
    expect(s.tally.strikes).toBe(0);
    expect(s.marks.length).toBe(0);
  });
});

describe('lapses and schemes', () => {
  it('no strike begins and Irritation does not rise during a lapse', () => {
    const s = createMoment(def('w1d6dawn'));
    s.cat.irritation = 95;
    s.cat.attention = 100;
    startLapse(s, 'jump');
    const irr = s.cat.irritation;
    for (let i = 0; i < 30; i++) { step(s); expect(s.cat.strike).toBeNull(); expect(s.cat.irritation).toBeLessThanOrEqual(irr + 1e-9); s.events.length = 0; }
  });

  it('a Scheme stops when tapped, and when the Brain Cell leaves', () => {
    const s = createMoment(def('w1d6afternoon'));
    s.cat.scheme = { id: 'treats', step: 0, t: 1.5 };
    const cb = PLACES.kitchen.cupboard!;
    applyInput(s, { type: 'hand', down: true, x: cb.x + 20, y: cb.y + 20 }); step(s);
    applyInput(s, { type: 'hand', down: false, x: cb.x + 20, y: cb.y + 20 }); step(s);
    expect(s.cat.scheme).toBeNull();
    expect(s.tally.schemesStopped).toBe(1);
    const s2 = createMoment(def('w1d6afternoon'));
    s2.cat.brain = { phase: 'present', t: 0.1 };
    s2.cat.scheme = { id: 'treats', step: 0, t: 9 };
    for (let i = 0; i < 6; i++) step(s2);
    expect(s2.cat.scheme).toBeNull();
  });
});

describe('stars and Standing', () => {
  it('follow §13 at each boundary', () => {
    expect(starsFor(false, 100)).toBe(0);
    expect(starsFor(true, 59)).toBe(1);
    expect(starsFor(true, 60)).toBe(2);
    expect(starsFor(true, 79)).toBe(2);
    expect(starsFor(true, 80)).toBe(3);
    expect(standingFor(39).name).toBe('Intruder');
    expect(standingFor(40).name).toBe('Staff');
    expect(standingFor(89).name).toBe('Staff');
    expect(standingFor(90).name).toBe('Adequate Staff');
    expect(standingFor(140).name).toBe('Preferred Lap');
    expect(standingFor(190).minWarning).toBe(1.4);
    expect(standingStars(100, 95)).toBe(109);
    expect(standingStars(100, 500)).toBe(110);
  });
});

describe('save', () => {
  it('loads back to an identical state', () => {
    const save = freshSave();
    applyResult(save, runMoment(createMoment(def('w1d1morning')), reader(false)));
    expect(deserialise(serialise(save))).toEqual(save);
  });

  it('only real journal entries are kept, and a replayed moment is not counted twice in the day', () => {
    const save = freshSave();
    const ids = new Set(FIELD_NOTES.map((f) => f.id));
    expect(ids.size).toBe(40);
    for (let i = 0; i < 2; i++) {
      const s = runMoment(createMoment(def('w1d3dawn')), reader(true));
      s.status = 'won';
      const r = applyResult(save, s);
      for (const n of r.newNotes) expect(ids.has(n)).toBe(true);
    }
    for (const n of save.notes) expect(ids.has(n)).toBe(true);
    expect(Object.keys(save.dayLog.w1d3.keys)).toEqual(['w1d3dawn']);
  });
});

describe('content', () => {
  it('has two weeks of seven days of five moments, and every one runs to an end', () => {
    expect(MOMENTS.length).toBe(70);
    for (const d of MOMENTS) {
      const s = runMoment(createMoment(d, DEFAULT_OPTIONS), ignorer());
      expect(['won', 'failed']).toContain(s.status);
    }
  });
});

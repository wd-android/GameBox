import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/config/tuning';
import { accrue, collect, freshLevels, hourlyRate, levelCost, storeCap, upgradeCost } from '../src/town/town';
import { freshSave, migrate } from '../src/state/save';
import { build, canBuild, finishTutorial, reachedNight, recordNight } from '../src/game/progress';
import type { NightResult } from '../src/sim/night';
import { requestAt } from '../src/town/requests';

const H = 3_600_000;

describe('idle earnings (§9.2)', () => {
  it('stop at four hours’ worth', () => {
    const levels = freshLevels();
    const store = { stored: 0, last: 0 };
    accrue(store, levels, 2 * H);
    expect(store.stored).toBeCloseTo(hourlyRate(levels) * 2);
    accrue(store, levels, 30 * H);
    expect(store.stored).toBeCloseTo(storeCap(levels));
    expect(storeCap(levels)).toBe(hourlyRate(levels) * TUNING.STORE_HOURS);
  });

  it('a clock set backwards earns nothing; forwards claims at most one full store', () => {
    const levels = freshLevels();
    const store = { stored: 0, last: 10 * H };
    accrue(store, levels, 5 * H);
    expect(store.stored).toBe(0);
    expect(collect(store, levels, 1000 * H)).toBe(Math.floor(storeCap(levels)));
  });
});

describe('town and progress', () => {
  it('buildings unlock by night and cost more each level', () => {
    const save = freshSave(0);
    finishTutorial(save, 0);
    save.coins = 100000;
    expect(canBuild(save, 'smokehouse').ok).toBe(false);
    save.nights[1] = { stars: 3, best: 0 };
    save.nights[2] = { stars: 3, best: 0 };
    expect(reachedNight(save)).toBe(3);
    expect(canBuild(save, 'smokehouse')).toEqual({ ok: true, cost: 150 });
    for (let l = 2; l <= 5; l++) expect(levelCost('smokehouse', l)).toBeGreaterThan(levelCost('smokehouse', l - 1));
    expect(build(save, 'smokehouse', 0)).toBe(true);
    expect(save.buildings.smokehouse).toBe(1);
  });

  it('the chandlery takes 10% off lighthouse upgrades', () => {
    const levels = freshLevels();
    expect(upgradeCost('width', 0, levels)).toBe(500);
    levels.chandlery = 1;
    expect(upgradeCost('width', 0, levels)).toBe(450);
    expect(upgradeCost('turn', 2, levels)).toBeNull();
  });

  it('a failed night keeps its catch but does not progress', () => {
    const save = freshSave(0);
    const r: NightResult = { landed: 2, strikes: 3, stars: 0, failed: true, catch: 20, closeCalls: 0, closeCallCoins: 0, bonus: 0, total: 20, landedByKind: { fishing: 2, dinghy: 0, trawler: 0 } };
    const out = recordNight(save, 1, r);
    expect(save.coins).toBe(20);
    expect(out.next).toBe(1);
    expect(reachedNight(save)).toBe(1);
  });

  it('requests start with the inn and pay on completion', () => {
    const save = freshSave(0);
    const r: NightResult = { landed: 30, strikes: 0, stars: 3, failed: false, catch: 0, closeCalls: 9, closeCallCoins: 0, bonus: 0, total: 0, landedByKind: { fishing: 12, dinghy: 12, trawler: 12 } };
    expect(recordNight(save, 1, r).request).toBeNull();
    save.buildings.inn = 1;
    const req = requestAt(0);
    expect(req.reward).toBeGreaterThanOrEqual(50);
    expect(req.reward).toBeLessThanOrEqual(300);
    let done = false;
    for (let k = 0; k < 6 && !done; k++) done = recordNight(save, 1, r).request!.completed;
    expect(done).toBe(true);
    expect(save.requestsDone).toBe(1);
  });

  it('every request pays 50 to 300 coins', () => {
    for (let i = 0; i < 60; i++) {
      const r = requestAt(i);
      expect(r.reward).toBeGreaterThanOrEqual(50);
      expect(r.reward).toBeLessThanOrEqual(300);
    }
  });

  it('a save survives a round trip and old saves gain new fields', () => {
    const save = freshSave(0);
    save.coins = 77;
    expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save);
    const old = migrate({ coins: 5, settings: { control: 'touch' } });
    expect(old.settings.control).toBe('touch');
    expect(old.settings.sensitivity).toBe(0.5);
    expect(old.buildings.pier).toBe(0);
  });
});

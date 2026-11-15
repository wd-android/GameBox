import { describe, expect, it } from 'vitest';
import { freshSave, migrate } from '../src/state/save';
import { applyDailyResult, applyMatchResult, buy, corkValue, currentStreak, highestUnlocked, SHOP } from '../src/game/progress';
import { dailyJarFor, dateKey, previousDay } from '../src/jars/jars';

const res = (acc: number, stars: number, freehand = false) => ({ acc, stars, freehand, grid: `g${acc}` });

describe('corks', () => {
  it('5 per jar, 5 per star, 5 for freehand', () => {
    expect(corkValue(3, true)).toBe(25);
    expect(corkValue(1, false)).toBe(10);
    expect(corkValue(0, true)).toBe(0);
  });

  it('replays pay only for improvement', () => {
    const s = freshSave();
    expect(applyMatchResult(s, 4, res(0.8, 1), true).earned).toBe(10);
    expect(applyMatchResult(s, 4, res(0.75, 1), false).earned).toBe(0);
    expect(applyMatchResult(s, 4, res(0.96, 3, true), true).earned).toBe(15);
    expect(s.corks).toBe(25);
  });
});

describe('unlocking', () => {
  it('a jar below 70% is kept but does not unlock the next', () => {
    const s = freshSave();
    applyMatchResult(s, 1, res(0.5, 0), true);
    expect(s.jars[1].kept).toBe('g0.5');
    expect(highestUnlocked(s)).toBe(1);
    applyMatchResult(s, 1, res(0.72, 1), true);
    expect(highestUnlocked(s)).toBe(2);
  });

  it('re-pouring replaces the kept jar only if chosen', () => {
    const s = freshSave();
    applyMatchResult(s, 2, res(0.9, 2), true);
    applyMatchResult(s, 2, res(0.95, 3), false);
    expect(s.jars[2].kept).toBe('g0.9');
    expect(s.jars[2].stars).toBe(3);
  });

  it('completing a set at two stars awards 100 corks and a decoration once', () => {
    const s = freshSave();
    for (let id = 1; id <= 9; id++) applyMatchResult(s, id, res(0.9, 2), true);
    expect(s.setsDone).toEqual([]);
    const out = applyMatchResult(s, 10, res(0.9, 2), true);
    expect(out.setCompleted?.name).toBe('Stripes');
    expect(s.decorations.length).toBe(1);
    const again = applyMatchResult(s, 10, res(0.99, 3), true);
    expect(again.setCompleted).toBeNull();
  });
});

describe('daily jar', () => {
  it('is the same jar for everyone on a date and rotates through 30', () => {
    const a = dailyJarFor('2026-11-15');
    expect(dailyJarFor('2026-11-15').id).toBe(a.id);
    expect(dailyJarFor('2026-12-15').id).toBe(a.id);
    expect(dailyJarFor('2026-11-16').id).not.toBe(a.id);
  });

  it('allows one scored attempt per day and counts a streak of consecutive days', () => {
    const s = freshSave();
    const d1 = '2026-11-13';
    const d2 = '2026-11-14';
    const d3 = '2026-11-15';
    expect(applyDailyResult(s, d1, 1001, res(0.9, 2)).earned).toBe(20);
    expect(applyDailyResult(s, d1, 1001, res(0.99, 3)).earned).toBe(0);
    applyDailyResult(s, d2, 1002, res(0.9, 2));
    expect(applyDailyResult(s, d3, 1003, res(0.5, 0)).streak).toBe(3);
    expect(currentStreak(s, '2026-11-17')).toBe(0);
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('save', () => {
  it('migrates partial or missing saves', () => {
    const m = migrate({ corks: 12, settings: { pouring: 'fixed' } });
    expect(m.corks).toBe(12);
    expect(m.settings.pouring).toBe('fixed');
    expect(m.settings.sfx).toBe(true);
    expect(migrate(null).version).toBe(1);
  });

  it('corks are spent in the shop', () => {
    const s = freshSave();
    const item = SHOP.find((i) => i.price === 60)!;
    expect(buy(s, item)).toBe(false);
    s.corks = 100;
    expect(buy(s, item)).toBe(true);
    expect(s.corks).toBe(40);
  });
});

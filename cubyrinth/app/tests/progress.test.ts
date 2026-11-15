import { describe, expect, it } from 'vitest';
import { freshSave, migrate } from '../src/state/save';
import { ballUnlocked, buyMaterial, currentStreak, highestUnlocked, recordDaily, recordLevel } from '../src/game/progress';
import { dailyFor } from '../src/game/levels';
import { parseCubeCode, cubeCode } from '../src/maze/generator';

const r = (time: number, stars: number) => ({ time, stars, falls: 0, score: 500 });

describe('progress', () => {
  it('unlocks the next level and the balls at their stages', () => {
    const s = freshSave();
    expect(highestUnlocked(s)).toBe(1);
    recordLevel(s, 1, 'step', r(30, 0));
    expect(highestUnlocked(s)).toBe(2);
    for (let i = 1; i <= 10; i++) recordLevel(s, i, 'bronze', r(10, 2));
    expect(ballUnlocked(s, 'silver')).toBe(true);
    expect(ballUnlocked(s, 'gold')).toBe(false);
  });

  it('pays coins for a first medal and for new stars only', () => {
    const s = freshSave();
    expect(recordLevel(s, 3, 'bronze', r(20, 1)).coins).toBe(20);
    expect(recordLevel(s, 3, 'bronze', r(25, 1)).coins).toBe(0);
    expect(recordLevel(s, 3, 'bronze', r(10, 3)).coins).toBe(20);
    expect(recordLevel(s, 3, 'silver', r(10, 3)).coins).toBe(40);
    expect(s.levels[3].bronze!.time).toBe(10);
  });

  it('keeps the best Daily Cube time and a streak of consecutive days', () => {
    const s = freshSave();
    expect(recordDaily(s, '2026-11-14', '1-4-20261114', 40).coins).toBe(30);
    expect(recordDaily(s, '2026-11-14', '1-4-20261114', 30).best).toBe(true);
    expect(recordDaily(s, '2026-11-15', '1-5-20261115', 50).streak).toBe(2);
    expect(currentStreak(s, '2026-11-17')).toBe(0);
    expect(s.daily.history['2026-11-14'].best).toBe(30);
  });

  it('daily seed is the date and size cycles 4, 5, 6', () => {
    expect(dailyFor('2026-11-15').seed).toBe(20261115);
    const sizes = ['2026-11-15', '2026-11-16', '2026-11-17'].map((d) => dailyFor(d).n).sort();
    expect(sizes).toEqual([4, 5, 6]);
  });

  it('cube codes round-trip', () => {
    expect(parseCubeCode(cubeCode(5, 48213))).toEqual({ version: 1, n: 5, seed: 48213 });
    expect(parseCubeCode('nonsense')).toBeNull();
  });

  it('materials cost coins; saves migrate', () => {
    const s = freshSave();
    expect(buyMaterial(s, 'neon')).toBe(false);
    s.coins = 400;
    expect(buyMaterial(s, 'neon')).toBe(true);
    expect(s.coins).toBe(100);
    expect(migrate({ coins: 5, settings: { control: 'step' } }).settings.sensitivity).toBe(80);
  });
});

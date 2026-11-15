import { describe, expect, it } from 'vitest';
import { starsFor, detailFor, locksmithLimit } from '../src/game/rules';
import { ChestSession } from '../src/game/session';
import { CHAPTERS, dailyChest } from '../src/chest/chest';
import { freshSave, migrate } from '../src/state/save';
import { recordOpen, recordDaily, rank, chapterUnlocked, currentStreak, dailyText } from '../src/game/progress';
import type { LockSpec } from '../src/locks/types';
import { TUNING } from '../src/config/tuning';

const clued: LockSpec = { type: 'padlock', parts: 3, information: 'clued' };
const fb: LockSpec = { type: 'padlock', parts: 4, information: 'feedback' };
const rings: LockSpec = { type: 'rings', parts: 3, information: 'full', steps: 8 };

describe('stars (§8.3)', () => {
  it('follow the table at each boundary', () => {
    expect([1, 2, 3, 9].map((t) => starsFor(clued, t, 1, false))).toEqual([3, 2, 1, 1]);
    expect([6, 7, 8, 9, 10].map((t) => starsFor(fb, t, 7, false))).toEqual([3, 3, 2, 2, 1]);
    // Move-based: shortest 8 → 3 stars up to 10 moves, 2 stars up to 16.
    expect([8, 10, 11, 16, 17].map((m) => starsFor(rings, m, 8, false))).toEqual([3, 3, 2, 2, 1]);
  });

  it('a hint limits the lock to two stars', () => {
    expect(starsFor(clued, 1, 1, true)).toBe(2);
  });
});

describe('feedback detail', () => {
  it('Locksmith and the Daily Safe always use "How many"; Relaxed uses the setting', () => {
    expect(detailFor('locksmith', 'which')).toBe('howMany');
    expect(detailFor('daily', 'which')).toBe('howMany');
    expect(detailFor('relaxed', 'which')).toBe('which');
    expect(detailFor('relaxed', 'howMany')).toBe('howMany');
  });

  it('changing the setting takes effect on the next try in Relaxed, and has no effect in Locksmith', () => {
    const chest = CHAPTERS[0].chests[12]; // padlock feedback
    const relaxed = new ChestSession(chest, 'relaxed');
    expect(relaxed.attempt(0, 'howMany').which).toBeUndefined();
    expect(relaxed.attempt(0, 'which').which).toBeDefined();
    const smith = new ChestSession(chest, 'locksmith');
    expect(smith.attempt(0, 'which').which).toBeUndefined();
  });

  it('each option has its own par; "Which" never has more', () => {
    const chest = CHAPTERS[0].chests[13];
    const s = new ChestSession(chest, 'relaxed');
    expect(s.par(0, 'which')).toBeLessThanOrEqual(s.par(0, 'howMany'));
  });
});

describe('Locksmith', () => {
  it('limits follow §8.2 and the lock jams; a retry brings a fresh puzzle', () => {
    expect(locksmithLimit(clued, 0)).toBe(3);
    expect(locksmithLimit(fb, 0)).toBe(8);
    expect(locksmithLimit(rings, 6)).toBe(18);
    expect(locksmithLimit({ type: 'bolts', parts: 6, information: 'full' }, 5)).toBe(13);
    const s = new ChestSession(CHAPTERS[0].chests[0], 'locksmith');
    // The wheels start at 0 0 0, which is never a code with three different digits.
    for (let i = 0; i < 3; i++) s.attempt(0, 'which');
    expect(s.jammed).toBe(true);
    expect(s.attempt(0, 'which').solved).toBe(false);
    s.retryFresh();
    expect(s.retry).toBe(1);
    expect(s.jammed).toBe(false);
    expect(s.locks[0].count).toBe(0);
  });
});

describe('save', () => {
  it('a save written mid-lock loads back to an identical state', () => {
    const chest = CHAPTERS[1].chests[22];
    const s = new ChestSession(chest, 'relaxed');
    s.move(0, s.chest.locks[0].type === 'padlock' ? { kind: 'turn', wheel: 0, delta: 3 } : s.chest.locks[0].type === 'bottles' ? { kind: 'swap', i: 0, j: 1 } : s.chest.locks[0].type === 'rings' ? { kind: 'turn', ring: 0, dir: 1 } : { kind: 'slide', bolt: 1, to: 0 });
    const save = freshSave();
    save.inProgress = s.serialize();
    const loaded = migrate(JSON.parse(JSON.stringify(save)));
    const s2 = new ChestSession(chest, 'relaxed', loaded.inProgress!);
    expect(s2.serialize()).toEqual(s.serialize());
    expect(JSON.stringify(s2.puzzles)).toBe(JSON.stringify(s.puzzles));
  });
});

describe('progress', () => {
  it('full reward the first time, a fifth of the coins on replays; gold stars make rank', () => {
    const save = freshSave();
    const chest = CHAPTERS[0].chests[29];
    const a = recordOpen(save, chest, 'locksmith', 3);
    expect(a.first).toBe(true);
    const b = recordOpen(save, chest, 'relaxed', 3);
    expect(b.first).toBe(false);
    expect(b.coins).toBe(Math.round(a.reward.coins / 5));
    expect(rank(save).stars).toBe(3);
    expect(rank(save).name).toBe('Apprentice');
  });

  it('chapter 2 unlocks on opening 24 chests in chapter 1', () => {
    const save = freshSave();
    for (let i = 0; i < 23; i++) recordOpen(save, CHAPTERS[0].chests[i], 'relaxed', 2);
    expect(chapterUnlocked(save, 2)).toBe(false);
    recordOpen(save, CHAPTERS[0].chests[23], 'relaxed', 2);
    expect(chapterUnlocked(save, 2)).toBe(true);
  });

  it('daily safe: two different lock types, one completion a day, a streak and a text result', () => {
    const d = dailyChest('2026-11-15');
    expect(d.locks.length).toBe(2);
    expect(d.locks[0].type).not.toBe(d.locks[1].type);
    const save = freshSave();
    expect(recordDaily(save, '2026-11-14', 9).streak).toBe(1);
    expect(recordDaily(save, '2026-11-15', 7).streak).toBe(2);
    expect(recordDaily(save, '2026-11-15', 3).first).toBe(false);
    expect(currentStreak(save, '2026-11-17')).toBe(0);
    expect(dailyText('2026-11-15', 7)).toBe('Lockbox Daily 15 Nov – opened in 7 tries.');
    expect(new ChestSession(d, 'daily').canHint(0, 'nudge')).toBe(false);
    expect(TUNING.CHAPTER2_UNLOCK).toBe(24);
  });
});

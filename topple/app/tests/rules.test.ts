import { describe, expect, it } from 'vitest';
import { freshSave, migrate } from '../src/state/save';
import { PuzzleSession } from '../src/game/session';
import { DAILY, PACK } from '../src/game/puzzles';
import { failureText, hintText, parLabel, shareText, ordinal, toppleCounter } from '../src/game/texts';
import { recordSolve, recordTopple, statistics, streakInfo, dayColour } from '../src/game/results';
import { computeStreak } from '../src/game/streak';
import { dateForNumber, isLastDayOfMonth, puzzleNumber, weekdayDifficulty, bundledIndex } from '../src/game/schedule';
import { solve } from '../src/chain/solver';
import { calculate } from '../src/chain/chain';

describe('par setting', () => {
  it('with "Show par" off, par appears in no text before the puzzle is solved', () => {
    for (const p of [...DAILY.slice(0, 20), ...PACK]) {
      const s = new PuzzleSession(p);
      const texts: string[] = [parLabel(p.par, false, s.solved), toppleCounter(s.topples)];
      const r = s.topple();
      if (!r.won) texts.push(failureText(r));
      texts.push(hintText('essential'), hintText('decoy'));
      for (const t of texts) {
        expect(t).not.toMatch(/\bpar\b/i);
        if (!r.won) expect(t).not.toContain(`${p.par} domino`);
      }
    }
  });

  it('with it on, par shows beside the tray from the start; after solving it always shows', () => {
    expect(parLabel(2, true, false)).toBe('Par: 2 dominoes');
    expect(parLabel(1, false, true)).toBe('Par: 1 domino');
  });

  it('does not change topples, the gold mark, tokens or streak', () => {
    const p = DAILY[0];
    const run = () => {
      const save = freshSave();
      const s = new PuzzleSession(p);
      for (const [g, k] of solve(p).parSolution!) s.place(g, k);
      recordTopple(save, { kind: 'daily', n: 1 });
      s.topple();
      const out = recordSolve(save, { kind: 'daily', n: 1 }, { used: s.placement.size, gold: s.isGold(), hint: false, today: 1, todayDate: dateForNumber(1) });
      return { save, out };
    };
    const a = run();
    const b = run();
    b.save.settings.showPar = true;
    expect(a.out).toEqual(b.out);
    expect(a.save.daily).toEqual(b.save.daily);
    expect(a.save.tokens).toBe(b.save.tokens);
  });
});

describe('streaks', () => {
  it('survive one missed day per calendar month and break on the second', () => {
    // Launch 15 Nov 2026: puzzle numbers 1–16 are 15–30 Nov.
    const solved = new Set([1, 2, 3, 5, 6, 7, 9, 10]);
    const s1 = computeStreak((n) => solved.has(n), 8);
    expect(s1.current).toBe(6);
    expect(s1.shields).toEqual([dateForNumber(4)]);
    const s2 = computeStreak((n) => solved.has(n), 11);
    expect(s2.current).toBe(2); // the second miss in November (day 8) breaks it
    // A new month brings new protection: 30 Nov missed is the first miss in... still November.
    const dec = new Set<number>();
    for (let n = 1; n <= 40; n++) if (n !== 4 && n !== 20) dec.add(n); // 18 Nov and 4 Dec
    expect(computeStreak((n) => dec.has(n), 40).current).toBe(38);
  });

  it('today unsolved does not break the streak yet; archive solves do not repair it', () => {
    const save = freshSave();
    save.daily[1] = { topples: 1, solved: true, onTime: true, gold: false, hint: false };
    save.daily[2] = { topples: 1, solved: true, onTime: true, gold: false, hint: false };
    expect(streakInfo(save, 3).current).toBe(2);
    save.daily[3] = { topples: 2, solved: true, onTime: false, gold: false, hint: false };
    save.daily[4] = { topples: 1, solved: false, onTime: false, gold: false, hint: false };
    expect(streakInfo(save, 5).current).toBe(0);
  });
});

describe('schedule', () => {
  it('puzzle number and weekday difficulty follow from the date', () => {
    expect(puzzleNumber('2026-11-15')).toBe(1);
    expect(puzzleNumber('2027-01-01')).toBe(48);
    expect(weekdayDifficulty('2026-11-16')).toBe(1); // Monday
    expect(weekdayDifficulty('2026-11-15')).toBe(7); // Sunday
    expect(isLastDayOfMonth('2026-11-30')).toBe(true);
    expect(isLastDayOfMonth('2027-02-28')).toBe(true);
    for (let n = 1; n <= DAILY.length; n++) {
      const d = dateForNumber(n);
      if (isLastDayOfMonth(d)) expect(DAILY[n - 1].slots.length).toBeGreaterThanOrEqual(120);
      else expect(DAILY[n - 1].difficulty).toBe(weekdayDifficulty(d));
    }
  });

  it('replays early puzzles if the supply runs out', () => {
    expect(bundledIndex(121, 120)).toEqual({ index: 0, replay: true });
  });
});

describe('results', () => {
  it('pays tokens as §9.5 and keeps the original topples on replay', () => {
    const save = freshSave();
    const start = save.tokens;
    recordTopple(save, { kind: 'daily', n: 1 });
    recordTopple(save, { kind: 'daily', n: 1 });
    const o = recordSolve(save, { kind: 'daily', n: 1 }, { used: 2, gold: true, hint: false, today: 1, todayDate: dateForNumber(1) });
    expect(o.tokens).toBe(15);
    expect(save.tokens).toBe(start + 15);
    recordTopple(save, { kind: 'daily', n: 1 });
    recordSolve(save, { kind: 'daily', n: 1 }, { used: 3, gold: false, hint: false, today: 1, todayDate: dateForNumber(1) });
    expect(save.daily[1].topples).toBe(2);
    expect(dayColour(save.daily[1])).toBe('gold');
    const st = statistics(save, 1);
    expect(st.byTopples[1]).toBe(1);
  });

  it('a 7-day streak pays a 20-token milestone once', () => {
    const save = freshSave();
    for (let n = 1; n <= 7; n++) {
      recordTopple(save, { kind: 'daily', n });
      recordSolve(save, { kind: 'daily', n }, { used: 3, gold: false, hint: false, today: n, todayDate: dateForNumber(n) });
    }
    expect(save.streakMilestonesPaid).toBe(1);
    expect(save.tokens).toBe(20 + 7 * 10 + 20);
  });

  it('a new streak after a break earns its own 7-day milestone', () => {
    const save = freshSave();
    const solve1 = (n: number) => {
      recordTopple(save, { kind: 'daily', n });
      return recordSolve(save, { kind: 'daily', n }, { used: 3, gold: false, hint: false, today: n, todayDate: dateForNumber(n) });
    };
    for (let n = 1; n <= 14; n++) solve1(n);
    expect(save.streakMilestonesPaid).toBe(2);
    // Days 15 to 17 missed: one is forgiven, the next breaks the streak.
    let paid = 0;
    for (let n = 18; n <= 24; n++) paid += solve1(n).milestone ? 1 : 0;
    expect(streakInfo(save, 24).current).toBe(7);
    expect(paid).toBe(1);
    expect(save.tokens).toBe(20 + 21 * 10 + 3 * 20);
  });
});

describe('save', () => {
  it('a save written mid-puzzle loads back to an identical state', () => {
    const p = DAILY[3];
    const s = new PuzzleSession(p);
    const sol = solve(p);
    const [g, k] = [...sol.parSolution!][0];
    s.place(g, k);
    s.topple();
    s.takeHint('decoy');
    const save = freshSave();
    save.inProgress = { key: 'daily:4', state: s.serialize() };
    const loaded = migrate(JSON.parse(JSON.stringify(save)));
    const s2 = new PuzzleSession(p, loaded.inProgress!.state);
    expect(s2.serialize()).toEqual(s.serialize());
    expect(calculate(p, s2.placement)).toEqual(calculate(p, s.placement));
  });
});

describe('texts', () => {
  it('shares the result as plain text without revealing gaps', () => {
    expect(shareText({ number: 142, topples: 2, used: 2, par: 2, gold: true, hint: false })).toBe('Topple #142\nSolved on the 2nd topple with 2 dominoes (par 2) ★');
    expect(shareText({ number: 9, topples: 1, used: 3, par: 2, gold: false, hint: true })).toBe('Topple #9\nSolved on the 1st topple with 3 dominoes (par 2) with a hint');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
  });
});

describe('bundled puzzles', () => {
  it('every bundled puzzle passes §6.3', () => {
    for (const p of [...DAILY, ...PACK]) {
      const r = solve(p);
      expect(r.problems, p.id).toEqual([]);
      expect(r.par, p.id).toBe(p.par);
    }
  });
});

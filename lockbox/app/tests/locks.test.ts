import { describe, expect, it } from 'vitest';
import { Padlock, allCodes, consistent, deduce, score, type PadlockPuzzle } from '../src/locks/padlock/padlock';
import { Bottles, allPositions, consistentCount, deduceBottles, holds, type BottlesPuzzle } from '../src/locks/bottles/bottles';
import { Rings, shortestFrom, turn, distances } from '../src/locks/rings/rings';
import { BoltsLock, search, slideRange } from '../src/locks/bolts/bolts';
import { rollReward, CHAPTERS } from '../src/chest/chest';
import type { LockSpec } from '../src/locks/types';

const SEEDS = Number(process.env.SEEDS ?? 120);

describe('padlock', () => {
  for (const parts of [3, 4, 5])
    for (const depth of parts === 5 ? [1] : [0, 1])
      it(`clued ${parts} wheels (depth ${depth}): unique, deducible, minimal, not trivial`, () => {
        for (let s = 1; s <= SEEDS / (parts === 5 ? 3 : 1); s++) {
          const p = Padlock.generate({ type: 'padlock', parts, information: 'clued', depth }, s * 7) as PadlockPuzzle;
          const sols = allCodes(parts).filter((c) => consistent(c, p.clues));
          expect(sols).toEqual([p.secret]);
          expect(deduce(parts, p.clues, depth).solved).toBe(true);
          for (let i = 0; i < p.clues.length; i++) expect(allCodes(parts).filter((c) => consistent(c, p.clues.filter((_, k) => k !== i))).length).toBeGreaterThan(1);
          for (const c of p.clues) expect(allCodes(parts).filter((x) => consistent(x, [c])).length).toBeGreaterThan(1);
          expect(p.clues.length).toBeGreaterThanOrEqual(3);
          expect(p.clues.length).toBeLessThanOrEqual(6);
        }
      });

  it('"How many" and "Which" agree with each other and with the secret', () => {
    for (let s = 1; s <= SEEDS; s++) {
      const p = Padlock.generate({ type: 'padlock', parts: 4, information: 'feedback' }, s);
      const st = { ...Padlock.initialState(p), wheels: allCodes(4)[s * 37 % 5040] };
      const a = Padlock.check(p, st, 'howMany');
      const b = Padlock.check(p, st, 'which');
      const truth = score(p.secret, st.wheels);
      expect(a.right).toBe(truth.right);
      expect(b.right).toBe(truth.right);
      expect(a.wrong).toBe(truth.wrong);
      expect(b.which!.filter(Boolean).length).toBe(truth.right);
      b.which!.forEach((w, i) => expect(w).toBe(st.wheels[i] === p.secret[i]));
    }
  });

  it('a Nudge never contradicts the solution; a Clue is true and narrows the possibilities', () => {
    for (let s = 1; s <= 40; s++) {
      const p = Padlock.generate({ type: 'padlock', parts: 4, information: 'feedback' }, s);
      let st = Padlock.initialState(p);
      const n = Padlock.hint(p, st, 'nudge')!;
      const k = n.state!.fixed.indexOf(true);
      expect(n.state!.wheels[k]).toBe(p.secret[k]);
      st = n.state!;
      const before = allCodes(4).filter((c) => c[k] === p.secret[k]).length;
      const c = Padlock.hint(p, st, 'clue');
      if (c) {
        const clue = c.state!.extraClues[0];
        expect(consistent(p.secret, [clue])).toBe(true);
        const after = allCodes(4).filter((x) => x[k] === p.secret[k] && consistent(x, [clue])).length;
        expect(after).toBeLessThan(before);
      }
    }
  });
});

describe('bottles', () => {
  for (const parts of [3, 4, 5, 6, 7])
    it(`clued ${parts} bottles: unique, deducible, minimal, not trivial`, () => {
      for (let s = 1; s <= SEEDS / (parts >= 7 ? 4 : 1); s++) {
        const depth = parts >= 5 ? 1 : 0;
        const p = Bottles.generate({ type: 'bottles', parts, information: 'clued', depth }, s * 13) as BottlesPuzzle;
        expect(consistentCount(parts, p.clues)).toBe(1);
        const pos = new Array(parts);
        p.secret.forEach((b, i) => (pos[b] = i));
        expect(p.clues.every((c) => holds(c, pos, parts))).toBe(true);
        expect(deduceBottles(parts, p.clues, depth)).toBe(true);
        for (let i = 0; i < p.clues.length; i++) expect(consistentCount(parts, p.clues.filter((_, k) => k !== i))).toBeGreaterThan(1);
        expect(p.clues.filter((c) => c.kind === 'position').length).toBeLessThanOrEqual(1);
        if (parts >= 5) expect(new Set(p.clues.map((c) => c.kind)).size).toBeGreaterThanOrEqual(3);
      }
    });

  it('"How many" and "Which" agree', () => {
    for (let s = 1; s <= SEEDS; s++) {
      const p = Bottles.generate({ type: 'bottles', parts: 5, information: 'feedback' }, s);
      const st = Bottles.initialState(p);
      const a = Bottles.check(p, st, 'howMany');
      const b = Bottles.check(p, st, 'which');
      expect(a.right).toBe(b.which!.filter(Boolean).length);
      expect(allPositions(5).length).toBe(120);
    }
  });
});

describe('rings', () => {
  it('are solvable and the recorded shortest really is the shortest', () => {
    for (let s = 1; s <= SEEDS / 2; s++) {
      const spec: LockSpec = { type: 'rings', parts: 2 + (s % 3), information: s % 2 ? 'clued' : 'full', steps: 8, linkages: s % 3 };
      const p = Rings.generate(spec, s);
      expect(p.shortest).toBeGreaterThanOrEqual(1);
      expect(shortestFrom(p, p.start)).toBe(p.shortest);
      // Independent check: breadth-first search from the start must reach solved in exactly `shortest`.
      let frontier = [p.start.join(',')];
      const seen = new Set(frontier);
      let d = 0;
      while (!frontier.includes(new Array(spec.parts).fill(0).join(','))) {
        const next: string[] = [];
        for (const f of frontier) {
          const o = f.split(',').map(Number);
          for (let r = 0; r < spec.parts; r++)
            for (const dir of [1, -1]) {
              const k = turn(p, o, r, dir).join(',');
              if (!seen.has(k)) {
                seen.add(k);
                next.push(k);
              }
            }
        }
        frontier = next;
        d++;
      }
      expect(d).toBe(p.shortest);
      // Following hints solves it in exactly `shortest` turns.
      let st = Rings.initialState(p);
      for (let k = 0; k < p.shortest; k++) {
        const h = Rings.hint(p, st, 'nudge')!;
        st = Rings.applyMove(p, st, { kind: 'turn', ...(h.move as { ring: number; dir: 1 | -1 }) });
      }
      expect(Rings.isSolved(p, st)).toBe(true);
      void distances;
    }
  });
});

describe('bolts', () => {
  it('are solvable; following the solver frees the latch in exactly the shortest number of slides', () => {
    for (let s = 1; s <= SEEDS / 3; s++) {
      const count = 4 + (s % 5);
      const p = BoltsLock.generate({ type: 'bolts', parts: count, information: 'full', size: count >= 8 ? 6 : 5 }, s);
      expect(p.shortest).toBeGreaterThanOrEqual(1);
      let st = BoltsLock.initialState(p);
      for (let k = 0; k < p.shortest; k++) {
        const h = BoltsLock.hint(p, st, 'nudge')!;
        st = BoltsLock.applyMove(p, st, h.move as never);
      }
      expect(BoltsLock.isSolved(p, st)).toBe(true);
      expect(search(p, p.start).shortest).toBe(p.shortest);
      // Bolts never overlap and stay in the frame.
      const [lo, hi] = slideRange(p, p.start, 0);
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi + p.bolts[0].len).toBeLessThanOrEqual(p.size);
    }
  });
});

describe('determinism and speed', () => {
  it('the same seed gives the same puzzle and the same reward', () => {
    const specs: LockSpec[] = [
      { type: 'padlock', parts: 4, information: 'clued' },
      { type: 'bottles', parts: 5, information: 'clued', depth: 1 },
      { type: 'rings', parts: 3, information: 'clued', steps: 8, linkages: 2 },
      { type: 'bolts', parts: 6, information: 'full', size: 5 },
    ];
    const gens = { padlock: Padlock, bottles: Bottles, rings: Rings, bolts: BoltsLock } as const;
    for (const spec of specs) expect(JSON.stringify(gens[spec.type].generate(spec, 4242))).toBe(JSON.stringify(gens[spec.type].generate(spec, 4242)));
    const chest = CHAPTERS[1].chests[25];
    expect(rollReward(chest, [])).toEqual(rollReward(chest, []));
  });

  it('every chapter lock generates within 200 ms', () => {
    const gens = { padlock: Padlock, bottles: Bottles, rings: Rings, bolts: BoltsLock } as const;
    let worst = 0;
    for (const ch of CHAPTERS)
      for (const chest of ch.chests)
        chest.locks.forEach((spec, i) => {
          const t = performance.now();
          gens[spec.type].generate(spec, chest.seed + i);
          worst = Math.max(worst, performance.now() - t);
        });
    expect(worst).toBeLessThan(200);
  });
});

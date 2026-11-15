import { Rng, hash } from './rng';
import { allCodes, score } from './padlock/padlock';
import { allPositions } from './bottles/bottles';
import type { Detail, LockTypeId } from './types';

/**
 * A competent reference solver for feedback-level locks (§8.3): each try is
 * a candidate consistent with everything learned so far. Used to calibrate
 * par and in the tests.
 */
export function referenceTries(type: LockTypeId, parts: number, detail: Detail, seed: number): number {
  const rng = new Rng(hash(seed, parts, detail === 'which' ? 1 : 0));
  if (type === 'padlock') {
    const codes = allCodes(parts);
    const secret = codes[rng.int(codes.length)];
    let cands = codes;
    for (let tries = 1; tries < 100; tries++) {
      const guess = cands[rng.int(cands.length)];
      const s = score(secret, guess);
      if (s.right === parts) return tries;
      if (detail === 'howMany') cands = cands.filter((c) => {
        const t = score(c, guess);
        return t.right === s.right && t.wrong === s.wrong;
      });
      else {
        const lit = guess.map((d, i) => d === secret[i]);
        cands = cands.filter((c) => {
          const t = score(c, guess);
          return t.wrong === s.wrong && c.every((d, i) => (lit[i] ? d === guess[i] : d !== guess[i]));
        });
      }
    }
    return 100;
  }
  // Bottles: positions arrays pos[bottle] = place.
  const all = allPositions(parts);
  const secret = all[rng.int(all.length)];
  let cands = all;
  for (let tries = 1; tries < 100; tries++) {
    const guess = cands[rng.int(cands.length)];
    let right = 0;
    for (let b = 0; b < parts; b++) if (guess[b] === secret[b]) right++;
    if (right === parts) return tries;
    if (detail === 'howMany') cands = cands.filter((c) => {
      let r = 0;
      for (let b = 0; b < parts; b++) if (c[b] === guess[b]) r++;
      return r === right;
    });
    else {
      const lit = guess.map((p, b) => p === secret[b]);
      cands = cands.filter((c) => c.every((p, b) => (lit[b] ? p === guess[b] : p !== guess[b])));
    }
  }
  return 100;
}

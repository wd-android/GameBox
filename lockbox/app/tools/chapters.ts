/**
 * Writes the fixed chest lists for both chapters (§9.3) to
 * src/chest/chapters.json, following the progression tables. Every new lock
 * type and information level first appears alone on a single-lock chest.
 *
 *   npm run chests
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rng, hash } from '../src/locks/rng';
import type { LockSpec, LockTypeId } from '../src/locks/types';
import type { Tier } from '../src/config/tuning';
import type { ChestDef } from '../src/chest/chest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function tier(i: number): Tier {
  return i <= 8 ? 'wooden' : i <= 18 ? 'iron' : i <= 26 ? 'silver' : 'gold';
}

const P = (parts: number, information: LockSpec['information'], depth = 0): LockSpec => ({ type: 'padlock', parts, information, depth });
const B = (parts: number, information: LockSpec['information'], depth = 0): LockSpec => ({ type: 'bottles', parts, information, depth });
const R = (parts: number, information: LockSpec['information'], linkages = 0, steps = 8): LockSpec => ({ type: 'rings', parts, information, linkages, steps });
const L = (parts: number, size = 5): LockSpec => ({ type: 'bolts', parts, information: 'full', size });

function chapter1(): LockSpec[][] {
  const rng = new Rng(1001);
  const out: LockSpec[][] = [];
  for (let i = 1; i <= 30; i++) {
    if (i <= 3) out.push([P(3, 'full')]);
    else if (i <= 6) out.push([B(3, 'full')]);
    else if (i === 7) out.push([P(3, 'clued')]);
    else if (i === 8) out.push([B(3, 'clued')]);
    else if (i <= 12) out.push([rng.int(2) ? P(rng.range(3, 4), 'clued') : B(rng.range(3, 4), 'clued')]);
    else if (i === 13) out.push([P(3, 'feedback')]);
    else if (i === 14) out.push([B(3, 'feedback')]);
    else if (i <= 18) out.push([rng.int(2) ? P(rng.range(3, 4), 'feedback') : B(rng.range(3, 4), 'feedback')]);
    else if (i <= 24) {
      const first = rng.int(2);
      out.push([first ? P(4, 'clued') : B(4, 'clued'), first ? B(4, 'feedback') : P(4, 'feedback')]);
    } else {
      // Mixed, 4–5 parts. A five-wheel clued padlock waits for chapter 2.
      const lock = (): LockSpec => {
        const info = rng.pick(['clued', 'feedback'] as const);
        if (rng.int(2)) return P(info === 'clued' ? 4 : rng.range(4, 5), info);
        return B(rng.range(4, 5), info);
      };
      out.push([lock(), lock()]);
    }
  }
  return out;
}

function chapter2(): LockSpec[][] {
  const rng = new Rng(2002);
  const out: LockSpec[][] = [];
  const any = (types: LockTypeId[], upper: boolean): LockSpec => {
    const t = rng.pick(types);
    const hi = upper ? 1 : 0;
    if (t === 'padlock') return P(rng.range(4, 4 + hi), rng.pick(['clued', 'feedback'] as const), 1);
    if (t === 'bottles') return B(rng.range(4 + hi, 5 + hi), rng.pick(['clued', 'feedback'] as const), 1);
    if (t === 'rings') return R(rng.range(3, 3 + hi), upper ? rng.pick(['clued', 'feedback'] as const) : 'clued', rng.range(1, 2 + hi));
    const n = rng.range(6 + hi, 8 + hi);
    return L(n, n >= 8 ? 6 : 5);
  };
  for (let i = 1; i <= 30; i++) {
    if (i <= 4) out.push([R(i <= 2 ? 2 : 3, 'full')]);
    else if (i <= 8) out.push([R(3, 'clued', i <= 6 ? 1 : 2)]);
    else if (i <= 12) out.push([L(3 + i - 8 > 6 ? 6 : 3 + i - 8 < 4 ? 4 : 3 + i - 8)]);
    else if (i <= 20) {
      const types = rng.shuffle(['padlock', 'bottles', 'rings', 'bolts'] as LockTypeId[]).slice(0, 2);
      out.push(types.map((t) => any([t], false)));
    } else if (i === 21) out.push([R(3, 'feedback', 2)]);
    else if (i <= 26) {
      const n = rng.range(2, 3);
      const types = rng.shuffle(['padlock', 'bottles', 'rings', 'bolts'] as LockTypeId[]).slice(0, n);
      out.push(types.map((t) => any([t], i >= 24)));
    } else {
      const types = rng.shuffle(['padlock', 'bottles', 'rings', 'bolts'] as LockTypeId[]).slice(0, 3);
      out.push(types.map((t) => any([t], true)));
    }
  }
  return out;
}

const chapters: ChestDef[][] = [chapter1(), chapter2()].map((list, ci) =>
  list.map((locks, k) => ({ id: `c${ci + 1}-${k + 1}`, chapter: ci + 1, index: k + 1, tier: tier(k + 1), seed: hash(ci + 1, k + 1, 0x10c4), locks })),
);
writeFileSync(resolve(root, 'src/chest/chapters.json'), JSON.stringify({ chapters }, null, 1));
for (const ch of chapters) for (const c of ch) console.log(c.id, c.tier, c.locks.map((l) => `${l.type}:${l.parts}:${l.information}${l.linkages ? `:L${l.linkages}` : ''}${l.size ? `:${l.size}x${l.size}` : ''}`).join(' + '));

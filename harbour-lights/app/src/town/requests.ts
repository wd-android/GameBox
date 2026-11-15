import type { BoatKind } from '../config/tuning';
import type { NightResult } from '../sim/night';
import { Rng } from '../sim/rng';

/**
 * Townspeople's requests (§9.4): once the inn is built, one request is active at
 * a time. Completing it pays 50 to 300 coins and brings the next.
 */
export type RequestKind = 'landKind' | 'land' | 'clean' | 'noClose' | 'closeCalls' | 'nights';

export interface Request {
  index: number;
  kind: RequestKind;
  boat?: BoatKind;
  target: number;
  reward: number;
  who: string;
  text: string;
}

const PEOPLE = ['Mrs Pengelly at the inn', 'Old Tom the netmaker', 'Young Ellie', 'The harbourmaster', 'Mr Tregear the smoker', 'Agnes from the chandlery', 'Father Hosking', 'The pier-master'];

const BOAT_WORDS: Record<BoatKind, [string, string]> = { fishing: ['fishing boat', 'fishing boats'], dinghy: ['dinghy', 'dinghies'], trawler: ['trawler', 'trawlers'] };

/** The i-th request, the same for every player. */
export function requestAt(index: number): Request {
  const rng = new Rng(9001 + index * 37);
  const who = rng.pick(PEOPLE);
  const kinds: RequestKind[] = ['landKind', 'land', 'clean', 'noClose', 'closeCalls', 'nights'];
  const kind = kinds[(index + rng.int(2)) % kinds.length];
  const grow = 1 + Math.floor(index / 6);
  switch (kind) {
    case 'landKind': {
      const boat = rng.pick(['fishing', 'dinghy', 'trawler'] as BoatKind[]);
      const target = (boat === 'trawler' ? 3 : 6) + 2 * grow;
      return { index, kind, boat, target, reward: Math.min(300, 60 + 20 * target), who, text: `Land ${target} ${BOAT_WORDS[boat][1]}` };
    }
    case 'land': {
      const target = 15 + 10 * grow;
      return { index, kind, target, reward: Math.min(300, 40 + 6 * target), who, text: `Land ${target} boats` };
    }
    case 'clean': {
      const target = Math.min(4, 1 + grow);
      return { index, kind, target, reward: Math.min(300, 70 * target), who, text: `Finish ${target} night${target > 1 ? 's' : ''} with three stars` };
    }
    case 'noClose':
      return { index, kind, target: 1, reward: 50 + 10 * Math.min(10, grow), who, text: 'Finish a night with no close calls' };
    case 'closeCalls': {
      const target = 3 + 2 * grow;
      return { index, kind, target, reward: Math.min(300, 40 + 25 * target), who, text: `Earn ${target} close calls` };
    }
    case 'nights': {
      const target = 2 + grow;
      return { index, kind, target, reward: Math.min(300, 40 * target), who, text: `Keep the light for ${target} nights` };
    }
  }
}

/** Progress made towards a request by one night. */
export function progressFrom(req: Request, r: NightResult): number {
  switch (req.kind) {
    case 'landKind':
      return r.landedByKind[req.boat!];
    case 'land':
      return r.landed;
    case 'clean':
      return r.stars === 3 ? 1 : 0;
    case 'noClose':
      return !r.failed && r.closeCalls === 0 ? 1 : 0;
    case 'closeCalls':
      return r.closeCalls;
    case 'nights':
      return r.failed ? 0 : 1;
  }
}

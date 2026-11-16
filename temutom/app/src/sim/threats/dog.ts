import { TUNING } from '../../config/tuning';
import { chance, pick, range } from '../rng';
import type { ShiftState, Spot, ThreatState } from '../types';
import { changeMorale, clamp, dist, emit, point, spot } from '../util';
import type { ThreatModule } from './index';
import { startJobPublic } from '../staff';

const G = TUNING.dog;

/**
 * Week 2: The Dog. Biscuit is a dopey, mischievous Doberman with floppy ears and a long,
 * very busy tail. He competes for staff attention, eats food meant for management,
 * sprawls on thrones and clears ledges with his tail.
 */
export interface DogData {
  present: boolean;
  enterAt: number;
  x: number; y: number;
  spot: string;
  mode: 'wander' | 'sprawl' | 'eat' | 'fussed' | 'dazed' | 'tilt' | 'flee' | 'toy';
  modeT: number;
  nextWander: number;
  nextTail: number;
  favour: number;
  wag: number;
  [k: string]: unknown;
}

export function dogData(t: ThreatState) {
  return t.data as DogData;
}

function roamSpots(s: ShiftState): Spot[] {
  return s.room.spots.filter((p) => p.kind === 'floor' || p.kind === 'toy' || p.kind === 'lap' || p.kind === 'throne' || p.kind === 'bowl');
}

function goTo(d: DogData, sp: Spot) {
  d.spot = sp.id;
}

function farthest(s: ShiftState, from: { x: number; y: number }): Spot {
  return roamSpots(s).filter((p) => p.kind !== 'throne').sort((a, b) => dist(b, from) - dist(a, from))[0];
}

export const dog: ThreatModule = {
  id: 'dog',
  start(s, t) {
    const e = point(s, s.room.entry);
    const d: DogData = {
      present: false, enterAt: t.spec.startAt ?? 3, x: e.x, y: e.y, spot: roamSpots(s)[0].id,
      mode: 'wander', modeT: 0, nextWander: 0, nextTail: range(s.rng, G.tailEvery[0], G.tailEvery[1]),
      favour: 0, wag: 0,
    };
    t.data = d;
  },
  step(s, t, dt) {
    const d = dogData(t);
    const c = s.cat;
    if (!d.present) {
      if (s.time >= d.enterAt) { d.present = true; emit(s, { type: 'dogEnters' }); d.nextWander = s.time + 1; }
      return 0;
    }
    d.wag += dt;
    // Movement
    const target = spot(s, d.spot);
    const dd = dist(d, target);
    const speed = (d.mode === 'flee' ? 1.6 : 1) * G.speed * dt;
    if (dd > speed) { d.x += ((target.x - d.x) / dd) * speed; d.y += ((target.y - d.y) / dd) * speed; } else { d.x = target.x; d.y = target.y; }

    if (d.modeT > 0) {
      d.modeT -= dt;
      if (d.modeT <= 0) {
        if (d.mode === 'sprawl') emit(s, { type: 'dogGetsUp' });
        d.mode = 'wander';
        d.nextWander = s.time + range(s.rng, 1, 3);
      }
    }
    if (d.mode === 'fussed' && !s.staff.some((m) => m.mode === 'fussingDog' || (m.job?.kind === 'fussDog'))) {
      d.mode = 'wander';
    }

    if (d.mode === 'wander' && s.time >= d.nextWander) {
      d.nextWander = s.time + range(s.rng, G.wanderEvery[0], G.wanderEvery[1]);
      const throneFree = c.spot !== s.room.throne || c.action === 'moving';
      if (throneFree && chance(s.rng, G.sprawlChance)) {
        goTo(d, spot(s, s.room.throne));
        d.mode = 'sprawl';
        d.modeT = range(s.rng, G.sprawlTime[0], G.sprawlTime[1]);
        emit(s, { type: 'dogSprawl' });
      } else {
        const opts = roamSpots(s).filter((p) => p.id !== d.spot && p.id !== c.spot && p.kind !== 'throne');
        if (opts.length) goTo(d, pick(s.rng, opts));
      }
    }

    // Tail: clears ledges near where he stands
    if (s.time >= d.nextTail) {
      d.nextTail = s.time + range(s.rng, G.tailEvery[0], G.tailEvery[1]);
      const here = spot(s, d.spot);
      const near = new Set([here.id, ...here.adjacentTo]);
      const o = s.objects.find((ob) => !ob.knocked && near.has(ob.spot));
      if (o && dist(d, here) < 4 && chance(s.rng, G.tailChance)) {
        o.knocked = true;
        o.t = 0;
        (o as { byDog?: boolean }).byDog = true;
        changeMorale(s, G.tailMorale);
        emit(s, { type: 'dogBroke', kind: o.kind, x: spot(s, o.spot).x, y: spot(s, o.spot).y });
      }
    }

    // Sniffing him is irritating
    if (d.mode !== 'dazed' && d.mode !== 'flee' && dist(d, c) < G.sniffRange) return G.sniffIrritation;
    return 0;
  },
  respond(s, t, verb) {
    const d = dogData(t);
    if (verb === 'dogPos') return d.present ? { x: d.x, y: d.y } : null;
    if (!d.present) return null;
    if (verb === 'smack') {
      d.mode = 'dazed';
      d.modeT = G.smackDaze;
      goTo(d, farthest(s, s.cat));
      d.favour = clamp(d.favour + G.smackFavour, 0, 100);
      changeMorale(s, G.smackMorale, 'room');
      emit(s, { type: 'dogYelp', x: d.x, y: d.y });
      for (const m of s.staff) if (m.mode === 'fussingDog') { m.job = null; m.mode = 'routine'; }
    } else if (verb === 'stare') {
      // He tilts his head, gets confused, and wanders off the throne.
      d.mode = 'tilt';
      d.modeT = G.stareTilt;
      if (d.spot === s.room.throne) goTo(d, farthest(s, spot(s, s.room.throne)));
      emit(s, { type: 'dogTilt' });
    } else if (verb === 'scream') {
      if (d.mode === 'dazed') return null;
      d.mode = 'flee';
      d.modeT = G.screamFlee;
      goTo(d, farthest(s, s.cat));
      emit(s, { type: 'dogFlee' });
    }
    return null;
  },
  isDefeated(s, t) {
    return s.throne.claimedNow && dogData(t).favour < 100;
  },
  blocksSpot(s, t, spotId) {
    const d = dogData(t);
    return d.present && d.mode === 'sprawl' && d.spot === spotId && spotId === s.room.throne;
  },
  hook(s, t, name, m, dt) {
    const d = dogData(t);
    if (!d.present) return null;
    switch (name) {
      case 'dogDistracts': return true;
      case 'dogPos': return { x: d.x, y: d.y };
      case 'fussing':
        d.favour = clamp(d.favour + G.fussFavourPerSecond * (dt ?? 0), 0, 100);
        if (d.mode !== 'sprawl') { d.mode = 'fussed'; d.modeT = 1; }
        return null;
      case 'softStroke':
        if (chance(s.rng, G.softGoesToDog)) {
          startJobPublic(m, 'fussDog', { x: d.x, y: d.y });
          emit(s, { type: 'dogFussed', staff: m.id });
          return true;
        }
        return false;
      case 'bowlFilled': {
        const bowl = s.room.spots.find((p) => p.kind === 'bowl');
        if (!bowl) return false;
        const catGuarding = s.cat.action !== 'moving' && s.cat.spot === bowl.id;
        if (!catGuarding && d.mode !== 'dazed' && dist(d, bowl) < dist(s.cat, bowl) + 10) {
          goTo(d, bowl);
          d.mode = 'eat';
          d.modeT = 4;
          d.favour = clamp(d.favour + G.ateFavour, 0, 100);
          emit(s, { type: 'dogAteIt', staff: m.id });
          return true;
        }
        return false;
      }
      case 'toyFetched':
        if (d.mode === 'wander' && dist(d, m) < 30 && chance(s.rng, 0.3)) {
          d.mode = 'toy';
          d.modeT = 5;
          goTo(d, farthest(s, m));
          emit(s, { type: 'dogStoleToy' });
          return true;
        }
        return false;
    }
    return null;
  },
};

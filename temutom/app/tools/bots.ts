/**
 * Scripted players for the balance script (spec §16): one that only screams,
 * one that plays sensibly and one that plays near-perfectly.
 */
import type { Input, ShiftState, StaffState } from '../src/sim/types';
import { matchingSpot } from '../src/sim/demands';
import { brainPresent } from '../src/sim/brainCell';
import { schemeSpots, schemeAvailable } from '../src/sim/shift';
import { dist, spot } from '../src/sim/util';
import { canAct } from '../src/sim/verbs';
import { hooverData } from '../src/sim/threats/hoover';
import { dogData } from '../src/sim/threats/dog';

export type Bot = (s: ShiftState) => Input[];

export function screamer(): Bot {
  let holding = false;
  let t = 0;
  return (s) => {
    t += 1 / 30;
    if (!holding && t > 3) { holding = true; t = 0; return [{ type: 'screamStart' }]; }
    if (holding && t > 1.2) { holding = false; t = 0; return [{ type: 'screamEnd' }]; }
    void s;
    return [];
  };
}

function seatedStaff(s: ShiftState): StaffState | undefined {
  return s.staff.find((m) => m.present && m.seatedAt && m.mode !== 'recoiling' && !(m.id === 'guest' && m.compliance.lap < 60) && !(m.id === 'busy' && m.compliance.lap < 30 && m.mode === 'routine' && m.routine[m.routineIdx]?.task === 'work'));
}

function nearestPresent(s: ShiftState): StaffState | undefined {
  return s.staff.filter((m) => m.present && m.mode !== 'recoiling').sort((a, b) => dist(a, s.cat) - dist(b, s.cat))[0];
}

export function thinker(perfect: boolean): Bot {
  let nextThink = 0;
  let screamUntil = -1;
  let lastScream = -99;
  return (s) => {
    const out: Input[] = [];
    const c = s.cat;
    if (screamUntil > 0 && s.time >= screamUntil) { screamUntil = -1; out.push({ type: 'screamEnd' }); }
    if (s.time < nextThink) return out;
    nextThink = s.time + (perfect ? 0.2 : 0.45);
    if (!canAct(s)) return out;
    if (c.action === 'staring' || c.action === 'moving' && c.pending) return out;

    const above = s.def.systems.band && c.attention > s.band.centre + s.band.halfWidth * 0.7;
    const below = s.def.systems.band && c.attention < s.band.centre - s.band.halfWidth * 0.7;
    const handler = s.staff.find((m) => (m.mode === 'stroking' || m.mode === 'holding') && m.present);

    // Correct over-attention or a wrong response
    if (handler && (above || (handler.job && !handler.job.correct && handler.job.demandId != null)) && s.def.systems.verbs.includes('smack')) {
      out.push({ type: 'verb', verb: 'smack', target: { kind: 'staff', id: handler.id } });
      return out;
    }
    const asker = s.staff.find((m) => m.mode === 'asking' && m.job?.demandId != null);
    if (perfect && asker && s.def.systems.verbs.includes('smack') && above) {
      out.push({ type: 'verb', verb: 'smack', target: { kind: 'staff', id: asker.id } });
      return out;
    }

    // Schemes
    if (perfect && brainPresent(s)) {
      if (schemeAvailable(s) && (s.demands.some((d) => d.kind === 'food' || d.kind === 'door') || s.scheme || spot(s, c.spot).schemeId === 'plug')) {
        out.push({ type: 'scheme' });
        return out;
      }
      const ss = schemeSpots(s).filter((id) => {
        const sid = spot(s, id).schemeId;
        if (sid === 'treats') return s.demands.some((d) => d.kind === 'food');
        if (sid === 'doorHandle') return s.demands.some((d) => d.kind === 'door' && spot(s, id).doorId === d.door);
        return sid === 'plug';
      });
      if (ss.length && s.cat.brain.t > 3.5 && c.spot !== ss[0]) { out.push({ type: 'tapSpot', spot: ss[0] }); return out; }
    }
    if (s.scheme && c.spot === s.scheme.spot && brainPresent(s)) { out.push({ type: 'scheme' }); return out; }

    // Threats
    if (s.threat?.id === 'hoover') {
      const h = hooverData(s.threat);
      if (h.state === 'running') {
        const hide = s.room.spots.find((p) => p.kind === 'hide');
        if (perfect && s.def.threat?.boss) {
          if (c.spot !== h.spot) { out.push({ type: 'tapSpot', spot: h.spot }); return out; }
          return out;
        }
        if (hide && c.spot !== hide.id && !s.demands.length) { out.push({ type: 'tapSpot', spot: hide.id }); return out; }
      }
    }
    if (s.threat?.id === 'dog') {
      const d = dogData(s.threat);
      if (d.present && d.mode !== 'dazed' && dist(d, c) < 30 && (perfect || d.mode === 'sprawl')) {
        out.push({ type: 'verb', verb: perfect ? 'stare' : 'smack', target: { kind: 'dog' } });
        return out;
      }
      if (d.present && d.mode === 'sprawl' && d.spot === s.room.throne && (s.def.objective.kind === 'claim' || s.def.objective.kind === 'boss')) {
        out.push({ type: 'verb', verb: 'stare', target: { kind: 'dog' } });
        return out;
      }
    }

    // Demands
    const d = s.demands.find((x) => x.kind !== 'lap') ?? s.demands[0];
    if (d) {
      const serving = s.staff.some((m) => m.job?.correct && m.job.demandId === d.id);
      if (d.kind === 'lap') {
        const lapOwner = seatedStaff(s);
        if (lapOwner && lapOwner.seatedAt) {
          if (c.spot !== lapOwner.seatedAt) out.push({ type: 'tapSpot', spot: lapOwner.seatedAt });
          return out;
        }
      }
      const spots = matchingSpot(s, d);
      if (d.kind === 'food' && s.threat?.id === 'dog' && spots[0] && c.spot !== spots[0]) { out.push({ type: 'tapSpot', spot: spots[0] }); return out; }
      if (serving) return out;
      if (spots.length && !spots.includes(c.spot) && d.kind !== 'lap') {
        const target = spots.sort((a, b) => dist(spot(s, a), c) - dist(spot(s, b), c))[0];
        out.push({ type: 'tapSpot', spot: target });
        return out;
      }
      const away = s.staff.every((m) => !m.present);
      const st = nearestPresent(s);
      if (away || !st || (!s.def.systems.verbs.includes('stare'))) {
        if (s.time - lastScream > 4 && screamUntil < 0) { lastScream = s.time; screamUntil = s.time + 1.1; out.push({ type: 'screamStart' }); }
        return out;
      }
      if (st.mode === 'routine' || st.mode === 'attending' || st.mode === 'asking' || st.mode === 'fussingDog') {
        out.push({ type: 'verb', verb: 'stare', target: { kind: 'staff', id: st.id } });
      }
      return out;
    }

    // Reward
    if (perfect && s.def.systems.verbs.includes('sitOn')) {
      const recent = s.staff.find((m) => m.present && m.lastCorrect && s.time - m.lastCorrect.t < 5 && m.mode !== 'recoiling');
      if (recent && c.sittingOn !== recent.id && c.action !== 'sitting') {
        out.push({ type: 'verb', verb: 'sitOn', target: { kind: 'staff', id: recent.id } });
        return out;
      }
    }

    // Throne
    const throneObj = s.def.objective.kind === 'claim' || (s.def.objective.kind === 'boss' && s.threat?.id === 'dog');
    if (s.def.systems.verbs.includes('sitOn') && (throneObj || perfect) && !s.throne.claimedNow) {
      if (c.spot !== s.room.throne) { out.push({ type: 'tapSpot', spot: s.room.throne }); return out; }
      if (below) {
        const st = nearestPresent(s);
        if (st && st.mode === 'routine') out.push({ type: 'verb', verb: 'stare', target: { kind: 'staff', id: st.id } });
      }
      return out;
    }

    // Attention management
    if (below) {
      const lapOwner = seatedStaff(s);
      if (lapOwner?.seatedAt && c.spot !== lapOwner.seatedAt) { out.push({ type: 'tapSpot', spot: lapOwner.seatedAt }); return out; }
      const st = nearestPresent(s);
      if (st && st.mode === 'routine' && s.def.systems.verbs.includes('stare')) out.push({ type: 'verb', verb: 'stare', target: { kind: 'staff', id: st.id } });
    } else if (above && !handler) {
      const hide = s.room.spots.find((p) => p.kind === 'hide');
      if (hide && c.spot !== hide.id) out.push({ type: 'tapSpot', spot: hide.id });
    } else if (perfect && s.cat.irritation > 70 && s.def.systems.irritation) {
      // nothing; let the band settle
    }
    return out;
  };
}

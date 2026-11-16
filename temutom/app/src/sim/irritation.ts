import { TUNING } from '../config/tuning';
import type { ShiftState } from './types';
import { bandDistance, inBand } from './attention';
import { changeMorale, clamp, dist, emit, nearestStaff, present, spot } from './util';
import { complianceAll } from './staff';
import { knockObject } from './verbs';
import { threatRespond } from './threats';
import { range } from './rng';

const I = TUNING.irritation;
const O = TUNING.outburst;

export function addIrritation(s: ShiftState, v: number) {
  if (!s.def.systems.irritation) return;
  s.cat.irritation = clamp(s.cat.irritation + v, 0, 100);
}

export function stepIrritation(s: ShiftState, dt: number, threatRate: number) {
  if (!s.def.systems.irritation) return;
  let rate: number;
  if (inBand(s)) {
    rate = I.inBand;
    if (s.throne.claimedBefore && s.cat.spot === s.room.throne && s.cat.action !== 'moving') {
      rate *= TUNING.throne.claimedIrritationFactor;
    }
  } else {
    rate = I.outBase + I.outPerPoint * bandDistance(s);
  }
  rate += threatRate;
  addIrritation(s, rate * dt);
  if (s.cat.irritation >= 100 && s.cat.action !== 'outburst') startOutburst(s, false);
}

/** Choose the target in the order of spec §6.4 */
export function outburstTarget(s: ShiftState): 'bite' | 'swipe' | 'zoomies' {
  const c = s.cat;
  const bitable = nearestStaff(s, c, (m) => m.mode !== 'recoiling');
  if (bitable && (dist(bitable, c) <= TUNING.cat.adjacent || c.heldBy === bitable.id)) return 'bite';
  if (swipeable(s) !== null) return 'swipe';
  return 'zoomies';
}

function swipeable(s: ShiftState): number | null {
  const here = spot(s, s.cat.spot);
  const near = new Set([here.id, ...here.adjacentTo]);
  const o = s.objects.find((ob) => !ob.knocked && near.has(ob.spot));
  return o ? o.id : null;
}

export function startOutburst(s: ShiftState, deliberate: boolean) {
  const c = s.cat;
  if (deliberate && c.irritation < I.deliberateMin) return;
  const kind = outburstTarget(s);
  s.tally.outbursts++;
  c.outburst = kind;
  c.action = 'outburst';
  c.actionT = O.duration;
  c.dest = null;
  c.pending = null;
  c.screaming = false;
  c.irritation = deliberate ? Math.max(0, c.irritation - I.deliberateDrop) : 0;
  c.attention = s.band.centre;
  emit(s, { type: 'outburst', kind, x: c.x, y: c.y });
  if (kind === 'bite') {
    const m = nearestStaff(s, c, (x) => x.mode !== 'recoiling')!;
    changeMorale(s, O.bite, m.id);
    m.stats.bitten++;
    complianceAll(s, m, O.biteCompliance);
    if (c.heldBy === m.id) c.heldBy = null;
    m.job = null;
    m.mode = 'recoiling';
    m.modeT = O.biteRecoil;
    m.mark = { kind: 'yelp', t: 1.5 };
    emit(s, { type: 'bite', staff: m.id, x: m.x, y: m.y });
    threatRespond(s, 'bite', { kind: 'staff', id: m.id });
  } else if (kind === 'swipe') {
    const id = swipeable(s)!;
    knockObject(s, id, true);
    changeMorale(s, O.swipe, 'room');
  } else {
    changeMorale(s, O.zoomies, 'room');
  }
  // Holding staff drop him
  for (const m of present(s)) if (m.mode === 'holding' || m.mode === 'stroking') { m.mode = 'recoiling'; m.modeT = 2; m.job = null; }
  c.heldBy = null;
  void range;
}

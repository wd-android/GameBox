import { SHIFTS } from '../src/content/shifts';
import { createShift, runShift } from '../src/sim/shift';
import { activeSpots } from '../src/sim/util';
import type { Input, ShiftState } from '../src/sim/types';
import { verbsFor } from '../src/sim/verbs';

let r = 1;
const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const random = (s: ShiftState): Input[] => {
  const out: Input[] = [];
  const x = rnd();
  if (x < 0.02) out.push({ type: 'tapSpot', spot: activeSpots(s)[Math.floor(rnd() * activeSpots(s).length)].id });
  else if (x < 0.03) out.push({ type: 'screamStart' });
  else if (x < 0.05) out.push({ type: 'screamEnd' });
  else if (x < 0.06 && s.staff.length) { const m = s.staff[Math.floor(rnd() * s.staff.length)]; const v = verbsFor(s, { kind: 'staff', id: m.id }); if (v.length) out.push({ type: 'verb', verb: v[Math.floor(rnd() * v.length)], target: { kind: 'staff', id: m.id } }); }
  else if (x < 0.065 && s.objects.length) out.push({ type: 'verb', verb: 'knockOff', target: { kind: 'object', id: s.objects[0].id } });
  else if (x < 0.07) out.push({ type: 'scheme' });
  else if (x < 0.072) out.push({ type: 'verb', verb: 'smack', target: { kind: 'dog' } });
  return out;
};
const res: Record<string, number> = {};
for (const def of SHIFTS) {
  const s = createShift(def, { compliance: {}, morale: 70, thronesClaimed: [], settings: { fewerLapses: false, longerPatience: false } });
  runShift(s, random);
  res[s.status + ':' + s.endReason] = (res[s.status + ':' + s.endReason] ?? 0) + 1;
}
console.log(SHIFTS.length, res);

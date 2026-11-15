/**
 * Checks §13: a boat kept alert from arrival always reaches the harbour, from
 * every edge position on every chart, for every kind. Prints any failures.
 */
import { TUNING, type BoatKind } from '../src/config/tuning';
import { CHARTS, nearestRockGap } from '../src/charts/charts';
import { NightSim } from '../src/sim/night';
import { NO_UPGRADES } from '../src/sim/beam';
import type { NightDef } from '../src/nights/nights';

/** Edge points where boats may arrive (clear of rocks, as in nights.ts). */
export function edgePoints(chart: 'bay' | 'skerries'): { x: number; y: number }[] {
  return allEdgePoints().filter((p) => nearestRockGap(CHARTS[chart], p.x, p.y) > 1.4);
}

function allEdgePoints(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let x = 0.6; x <= 11.4 + 1e-9; x += 0.4) pts.push({ x, y: 0.05 });
  for (let y = 0.6; y <= 9.5 + 1e-9; y += 0.4) {
    pts.push({ x: 0.05, y });
    pts.push({ x: 11.95, y });
  }
  return pts;
}

export function runAlert(chart: 'bay' | 'skerries', kind: BoatKind, x: number, y: number, spread: number): string {
  const h = CHARTS[chart].harbour;
  const heading = Math.atan2(h.y - y, h.x - x) + (spread * Math.PI) / 180;
  const def: NightDef = { n: 0, chart, seed: 0, boats: 1, mix: [kind], interval: 0, fog: 0, currentStrength: 0, maxOnSea: 1, scripted: [{ t: 0, kind, x, y, heading }] };
  const sim = new NightSim(def, NO_UPGRADES);
  while (!sim.over && sim.time < 120) {
    for (const b of sim.boats) b.alert = TUNING.ALERT_SECONDS; // kept alert
    sim.step();
  }
  return sim.boats[0]?.outcome ?? 'none';
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('routes-check.ts')) {
  let fails = 0;
  let total = 0;
  for (const chart of ['bay', 'skerries'] as const)
    for (const kind of ['fishing', 'dinghy', 'trawler'] as const)
      for (const p of edgePoints(chart))
        for (const s of [-25, 0, 25]) {
          total++;
          const o = runAlert(chart, kind, p.x, p.y, s);
          if (o !== 'landed') {
            fails++;
            console.log(chart, kind, p.x.toFixed(2), p.y.toFixed(2), s, o);
          }
        }
  console.log(`${total - fails}/${total} landed`);
}

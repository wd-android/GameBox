import { TUNING } from '../../config/tuning';
import type { DifficultyModule } from './index';
import { dist, emit, note, pointAt, projectOnPath } from '../util';
import { choreDone } from '../chores';

/**
 * Week 1: The Hoover (§12.1). Drag it along a marked path; it runs only while the thumb is on it.
 * While it runs he cannot be Content and Irritation climbs, so the player hoovers in bursts.
 */
export const hoover: DifficultyModule = {
  id: 'hoover',
  start(s) {
    s.difficulty!.data = { areaDone: 0 };
  },
  step(s, dt) {
    const hv = s.chore?.hoover;
    if (!hv) return { irritation: 0, suspend: false };
    const h = s.hand;
    const at = pointAt(hv.path, hv.s);
    const driving = h.down && h.drag?.what === 'hoover';
    hv.running = false;
    if (driving) {
      if (dist(h, at) < 90) {
        const target = projectOnPath(hv.path, { x: h.x, y: h.y }, hv.s, hv.s + 90);
        const maxStep = 340 * dt;
        const ns = Math.min(hv.length, hv.s + Math.min(maxStep, Math.max(0, target - hv.s)));
        if (ns > hv.s + 0.01) hv.lastMove = s.time;
        hv.s = ns;
      }
      hv.running = s.time - hv.lastMove < 0.35 || h.speed > 30;
    }
    const d = s.difficulty!.data as { areaDone: number };
    while (d.areaDone < hv.areaEnds.length && hv.s >= hv.areaEnds[d.areaDone] - 1) {
      d.areaDone++;
      emit(s, { type: 'hooverArea', value: d.areaDone });
    }
    if (hv.running) {
      note(s, 'week-hoover');
      return { irritation: TUNING.hoover.irritation, suspend: true };
    }
    return { irritation: 0, suspend: false };
  },
  onPlayerAction() {},
  objectiveMet(s) {
    return choreDone(s.chore);
  },
};

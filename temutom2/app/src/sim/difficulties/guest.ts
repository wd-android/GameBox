import { TUNING } from '../../config/tuning';
import { range, chance } from '../cat';
import type { DifficultyModule } from './index';
import { POSE_GEOMETRY } from '../body';
import { dist, emit, note } from '../util';
import { choreDone } from '../chores';
import type { GuestState, MomentState } from '../types';

const G = TUNING.guest;

function reachPoint(s: MomentState, g: GuestState) {
  const c = s.cat;
  if (c.pose === 'closeUp' || c.pose === 'carried') return null;
  const geo = POSE_GEOMETRY[c.pose as Exclude<typeof c.pose, 'closeUp'>];
  const z = geo.zones.find((q) => q.zone === g.zone) ?? geo.zones[geo.zones.length - 1];
  return { x: c.x + z.cx * c.scale * c.facing, y: c.y + z.cy * c.scale };
}

/** Can the guest reach him? Not on the player's own lap, and not while he is off following a treat. */
function reachable(s: MomentState) {
  const c = s.cat;
  return c.onScreen && c.activity !== 'onLap' && c.activity !== 'following' && c.activity !== 'carried' && c.pose !== 'closeUp' && !c.lapse;
}

/**
 * Week 2: The Houseguest (§12.2). A second hand reaches in at intervals and strokes him, badly:
 * it ignores every warning and goes for the belly when it is shown.
 */
export const guest: DifficultyModule = {
  id: 'guest',
  start(s) {
    s.guest = { phase: 'out', x: -60, y: 520, t: 0, next: s.time + (s.difficulty!.boss ? 3 : 6), zone: 'back', plasters: G.plasters, bitten: 0, side: 1 };
  },
  step(s, dt) {
    const g = s.guest;
    if (!g) return { irritation: 0, suspend: false };
    const speed = 420 * dt;
    const home = { x: g.side > 0 ? -70 : 460, y: 520 };
    const every = s.difficulty!.boss ? [G.bossEvery, G.bossEvery] : G.every;
    switch (g.phase) {
      case 'out':
        g.x = home.x; g.y = home.y;
        if (s.time >= g.next && g.plasters > 0 && reachable(s)) {
          g.phase = 'reaching';
          g.side = s.cat.x > 195 ? -1 : 1;
          g.zone = s.cat.pose === 'bellyUp' ? 'belly' : chance(s.rng, 0.5) ? 'back' : 'head';
          note(s, 'week-guest');
          emit(s, { type: 'guestReach' });
        }
        break;
      case 'reaching': {
        const tgt = reachable(s) ? reachPoint(s, g) : null;
        if (!tgt) { g.phase = 'withdrawing'; break; }
        const d = dist(g, tgt);
        if (d < speed) { g.x = tgt.x; g.y = tgt.y; g.phase = 'stroking'; g.t = range(s.rng, G.strokeFor[0], G.strokeFor[1]); }
        else { g.x += ((tgt.x - g.x) / d) * speed; g.y += ((tgt.y - g.y) / d) * speed; }
        break;
      }
      case 'stroking': {
        // It goes for the belly the moment it is shown
        if (s.cat.pose === 'bellyUp') g.zone = 'belly';
        const tgt = reachable(s) ? reachPoint(s, g) : null;
        if (!tgt) { g.phase = 'withdrawing'; break; }
        g.x = tgt.x + Math.sin(s.time * 9) * 10; g.y = tgt.y;
        g.t -= dt;
        if (g.t <= 0) g.phase = 'withdrawing';
        break;
      }
      case 'withdrawing': {
        const d = dist(g, home);
        if (d < speed * 1.5) { g.phase = 'out'; g.next = s.time + range(s.rng, every[0], every[1]); }
        else { g.x += ((home.x - g.x) / d) * speed * 1.5; g.y += ((home.y - g.y) / d) * speed * 1.5; }
        break;
      }
    }
    return { irritation: 0, suspend: false };
  },
  onPlayerAction(s, action) {
    const g = s.guest;
    if (!g) return;
    if (action === 'pushGuest' && (g.phase === 'reaching' || g.phase === 'stroking')) {
      g.phase = 'withdrawing';
      emit(s, { type: 'guestPushed' });
    }
  },
  objectiveMet(s) {
    return choreDone(s.chore) && (s.guest?.bitten ?? 0) === 0;
  },
};

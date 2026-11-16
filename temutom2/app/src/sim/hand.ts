import { TUNING } from '../config/tuning';
import type { Hand, MomentState, Over, SourceId, Zone } from './types';
import { zoneAt } from './body';
import { dist, inRect, place } from './util';
import { pointAt } from './util';

const H = TUNING.hand;

export function makeHand(): Hand {
  return {
    down: false, x: -100, y: -100, px: -100, py: -100, speed: 0, downAt: -1, downX: 0, downY: 0, heldFor: 0, stillFor: 0,
    upAt: -99, over: { kind: 'empty' }, drag: null, liftArmed: false, travelX: 0, overDoorAtDown: false,
    lapHold: 0, blinkHold: 0, locked: 0, stareHold: 0, moved: 0,
  };
}

/** Treats sit at the bottom edge (mirrored for a left-handed layout) */
export function treatPos(s: MomentState, i: number) {
  const left = s.settings.leftHanded;
  const x = left ? 40 + i * 52 : 350 - i * 52;
  return { x, y: 768 };
}

export function sourcePos(s: MomentState, id: SourceId) {
  const p = place(s);
  if (id === 'pouch') return s.pouch;
  if (id === 'wand') return s.wand && s.wand.active ? s.wand : p.wand!;
  return treatPos(s, id === 'treat0' ? 0 : 1);
}

export function bellyShown(s: MomentState) {
  return s.cat.pose === 'bellyUp' || s.cat.pose === 'carried';
}

/** What is under a point (§5.2 "over") */
export function overAt(s: MomentState, x: number, y: number): Over {
  const p = { x, y };
  const c = s.cat;
  const pl = place(s);
  if (c.onScreen && c.pose === 'closeUp') return zoneAt(c, c.pose, p, false) ? { kind: 'cat', zone: 'head' } : { kind: 'empty' };
  if (s.guest && s.guest.phase !== 'out' && dist(p, s.guest) < 46) return { kind: 'guest' };
  if (s.chore?.hoover && s.difficulty?.id === 'hoover') {
    const hp = pointAt(s.chore.hoover.path, s.chore.hoover.s);
    if (dist(p, hp) < 58) return { kind: 'hoover' };
  }
  if (s.def.systems.treats) for (let i = 0; i < 2; i++) {
    if (i < s.treatsLeft && dist(p, treatPos(s, i)) < 34) return { kind: 'source', id: (i === 0 ? 'treat0' : 'treat1') as SourceId };
  }
  if (pl.pouch && dist(p, s.pouch) < 40) return { kind: 'source', id: 'pouch' };
  if (pl.wand && dist(p, sourcePos(s, 'wand')) < 40) return { kind: 'source', id: 'wand' };
  if (c.onScreen) {
    const z = zoneAt(c, c.pose, p, bellyShown(s));
    if (z) return { kind: 'cat', zone: z };
  }
  if (s.chore && !s.chore.hoover) {
    const st = s.chore.steps[s.chore.current];
    if (st && dist(p, st) < 44) return { kind: 'chore', step: s.chore.current };
  }
  for (const o of s.objects) if (!o.knocked && dist(p, o) < 26) return { kind: 'object', id: o.id };
  if (inRect(p, pl.cupboard)) return { kind: 'cupboard' };
  if (inRect(p, pl.door)) return { kind: 'door' };
  if (inRect(p, pl.bowl)) return { kind: 'bowl' };
  if (inRect(p, pl.laptop)) return { kind: 'laptop' };
  if (inRect(p, pl.lap)) return { kind: 'lap' };
  return { kind: 'empty' };
}

export interface HandFrame {
  action: 'nothing' | 'rest' | 'stroke' | 'held' | 'work';
  zone: Zone | null;
  pressed: boolean;
  released: boolean;
  tap: Over | null;
}

/** Apply this step's raw touch to the hand and classify what the player is doing (§5.2). */
export function updateHand(s: MomentState, raw: { down: boolean; x: number; y: number }, dt: number): HandFrame {
  const h = s.hand;
  const f: HandFrame = { action: 'nothing', zone: null, pressed: false, released: false, tap: null };
  if (h.locked > 0) {
    h.locked -= dt;
    if (h.down) { h.down = false; h.upAt = s.time; h.drag = null; }
    return f;
  }
  const wasDown = h.down;
  h.px = h.x; h.py = h.y;
  if (raw.down) { h.x = raw.x; h.y = raw.y; }
  h.down = raw.down;
  if (h.down && !wasDown) {
    f.pressed = true;
    h.downAt = s.time; h.downX = h.x; h.downY = h.y; h.px = h.x; h.py = h.y;
    h.heldFor = 0; h.stillFor = 0; h.speed = 0; h.moved = 0; h.travelX = 0;
    h.liftArmed = false; h.lapHold = 0; h.blinkHold = 0; h.stareHold = 0;
    h.over = overAt(s, h.x, h.y);
    h.overDoorAtDown = h.over.kind === 'door';
  }
  if (h.down) {
    const d = Math.hypot(h.x - h.px, h.y - h.py);
    const inst = dt > 0 ? d / dt : 0;
    h.speed = h.speed * 0.7 + inst * 0.3;
    h.moved += d;
    h.travelX = h.x - h.downX;
    h.heldFor += dt;
    h.stillFor = h.speed < H.stillBelow ? h.stillFor + dt : 0;
    if (!f.pressed) h.over = overAt(s, h.x, h.y);
    if (h.drag) {
      h.drag.x = h.x; h.drag.y = h.y; h.drag.t += dt;
      f.action = h.drag.what === 'cat' ? 'held' : 'nothing';
      return f;
    }
    if (h.over.kind === 'cat') {
      f.zone = h.over.zone;
      if (h.speed >= H.strokeMin && h.speed <= H.strokeMax) f.action = 'stroke';
      else if (h.speed < H.strokeMin) f.action = 'rest';
    } else if (h.over.kind === 'chore') {
      f.action = 'work';
    }
  } else if (wasDown) {
    f.released = true;
    h.upAt = s.time;
    if (h.heldFor <= H.tapMax && h.moved < 24) f.tap = h.over;
  }
  return f;
}

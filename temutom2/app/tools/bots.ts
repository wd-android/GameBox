/**
 * Scripted players for the balance script (spec §17): one that only works and ignores him,
 * one that reads him sensibly, and one that reads him near-perfectly.
 * They see only what a player sees: his display (body language), the scene and the interface.
 */
import type { DemandKind, MomentState, Pt } from '../src/sim/types';
import { PLACES } from '../src/content/places';
import { treatPos } from '../src/sim/hand';
import { POSE_GEOMETRY, CLOSE_UP } from '../src/sim/body';
import { pointAt } from '../src/sim/util';

type Thumb = { down: boolean; x: number; y: number };
export type Bot = (s: MomentState) => Thumb | null;

const UP: Thumb = { down: false, x: 0, y: 0 };

function zonePoint(s: MomentState, zone: 'head' | 'back'): Pt {
  const c = s.cat;
  if (c.pose === 'closeUp') return { x: CLOSE_UP.cx, y: CLOSE_UP.cy };
  const g = POSE_GEOMETRY[c.pose as Exclude<typeof c.pose, 'closeUp'>];
  const z = g.zones.find((q) => q.zone === zone) ?? g.zones[0];
  return { x: c.x + z.cx * c.scale * c.facing, y: c.y + z.cy * c.scale };
}

export function ignorer(): Bot {
  return (s) => {
    if (s.chore?.hoover) {
      const p = pointAt(s.chore.hoover.path, Math.min(s.chore.hoover.length, s.chore.hoover.s + 30));
      return { down: true, x: p.x, y: p.y };
    }
    const st = s.chore?.steps[s.chore.current];
    if (st) return { down: true, x: st.x, y: st.y };
    return UP;
  };
}

/** A queue of thumb frames: gestures take several steps */
class Gestures {
  q: Thumb[] = [];
  busy() { return this.q.length > 0; }
  next(): Thumb | null { return this.q.shift() ?? null; }
  clear() { this.q = []; }
  tap(p: Pt) { this.q.push({ down: true, ...p }, { down: true, ...p }, UP, UP); }
  drag(from: Pt, to: Pt, frames = 14) {
    this.q.push({ down: true, ...from }, { down: true, ...from });
    for (let i = 1; i <= frames; i++) this.q.push({ down: true, x: from.x + ((to.x - from.x) * i) / frames, y: from.y + ((to.y - from.y) * i) / frames });
    this.q.push(UP, UP);
  }
  hold(p: Pt, frames: number) { for (let i = 0; i < frames; i++) this.q.push({ down: true, ...p }); this.q.push(UP); }
  wiggle(p: Pt, frames: number, r = 40) { for (let i = 0; i < frames; i++) this.q.push({ down: true, x: p.x + Math.sin(i / 3) * r, y: p.y + Math.cos(i / 4) * r * 0.6 }); this.q.push(UP, UP); }
}

export function reader(perfect: boolean): Bot {
  const g = new Gestures();
  let lastTell: DemandKind | null = null;
  let strokePhase = 0;
  // People react late: the bot sees his body language as it was a moment ago.
  const lag = Math.round((perfect ? 0.25 : 0.5) * 30);
  const seen: MomentState['cat']['display'][] = [];
  let rnd = 12345;
  const random = () => ((rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0) / 4294967296);
  return (s) => {
    const c = s.cat;
    seen.push(c.display);
    if (seen.length > lag + 1) seen.shift();
    const d = seen[0];
    // A sensible player sometimes misses a brief tell, and keeps stroking a little too long
    if (!perfect && d.tell && random() < 0.02) lastTell = null;
    const pl = PLACES[s.def.place];
    // Danger first: lift the thumb at any Warning or wind-up
    if (d.mood === 'warning' || d.mood === 'striking') { g.clear(); return UP; }
    if (g.busy()) return g.next();
    if (d.tell) lastTell = d.tell;
    if (!s.cat.demand && !d.tell) lastTell = perfect ? null : lastTell;
    // Fallen interface: (handled by UI taps; the sim has a restore input) – ignored here
    if (c.pose === 'closeUp') { g.tap({ x: CLOSE_UP.cx, y: CLOSE_UP.cy }); return g.next(); }
    if (perfect && d.mood === 'lapsing') { g.tap(zonePoint(s, 'head')); return g.next(); }
    // The guest's hand: push it away
    if (s.guest && (s.guest.phase === 'stroking' || s.guest.phase === 'reaching') && (perfect || s.guest.phase === 'stroking')) {
      g.drag({ x: s.guest.x, y: s.guest.y }, { x: s.guest.x + (s.guest.side > 0 ? -90 : 90), y: s.guest.y }, 6);
      return g.next();
    }
    // Answer a demand we have read
    const want = perfect ? (s.cat.demand && (d.tell ?? lastTell)) || null : lastTell;
    if (s.cat.demand && want) {
      lastTell = null;
      switch (want) {
        case 'food': if (pl.pouch && pl.bowl) g.drag(pl.pouch, { x: pl.bowl.x + 55, y: pl.bowl.y + 30 }); break;
        case 'door': if (pl.door) g.drag({ x: pl.door.x + 10, y: pl.door.y + pl.door.h / 2 }, { x: pl.door.x + pl.door.w - 5, y: pl.door.y + pl.door.h / 2 }, 8); break;
        case 'lap': if (pl.lap) g.hold({ x: pl.lap.x + 30, y: pl.lap.y + pl.lap.h - 20 }, 130); break;
        case 'play': if (pl.wand) { g.q.push({ down: true, ...pl.wand }); g.wiggle({ x: pl.wand.x - 80, y: pl.wand.y - 120 }, 110, 60); } break;
        case 'nothing': g.tap(zonePoint(s, 'head')); break;
      }
      if (g.busy()) return g.next();
    }
    // He is sitting on the work: a treat moves him
    if (c.sitOn?.what === 'chore' && s.treatsLeft > 0) {
      const t = treatPos(s, 2 - s.treatsLeft);
      g.drag(t, { x: pl.floor.x + 30, y: pl.floor.y + pl.floor.h / 2 });
      return g.next();
    }
    // Answer a slow blink
    if (perfect && d.eyes === 'slowBlink') { g.hold({ x: 30, y: 300 }, 36); return g.next(); }
    const hv = s.chore?.hoover;
    // Seeking: stroke his head
    if ((d.mood === 'seeking' || (!perfect && d.mood === 'tolerating' && random() < 0.3)) && c.onScreen && c.activity !== 'away') {
      const p = zonePoint(s, 'head');
      strokePhase += 1;
      return { down: true, x: p.x + Math.sin(strokePhase / 2.5) * 14, y: p.y + Math.cos(strokePhase / 3) * 6 };
    }
    // Content or tolerating: get on with the work (not while he's tolerating the hoover)
    if (hv) {
      if (d.mood === 'content' || (d.mood === 'tolerating' && !perfect) || d.mood === 'seeking') {
        const p = pointAt(hv.path, Math.min(hv.length, hv.s + 25));
        return { down: true, x: p.x, y: p.y };
      }
      return UP;
    }
    const st = s.chore?.steps[s.chore.current];
    if (st && !(c.sitOn?.what === 'chore' && c.sitOn.step === s.chore!.current)) return { down: true, x: st.x, y: st.y };
    if (d.mood === 'content' && perfect && c.onScreen) {
      // Rest a hand on him, gently
      const p = zonePoint(s, 'head');
      return { down: true, x: p.x, y: p.y };
    }
    return UP;
  };
}

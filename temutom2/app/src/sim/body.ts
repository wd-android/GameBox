import type { CatState, Pose, Pt, Zone } from './types';

/**
 * Where each touch zone lies for each body pose (§6.5, §15.3). Units are the cat's local units,
 * facing right, origin on the ground under him; screen points = local × scale.
 * The renderer draws the parts on these same shapes, so what you see is what you touch.
 */
export interface ZoneShape { zone: Zone; cx: number; cy: number; rx: number; ry: number }

const Z = (zone: Zone, cx: number, cy: number, rx: number, ry: number): ZoneShape => ({ zone, cx, cy, rx, ry });

export const POSE_GEOMETRY: Record<Exclude<Pose, 'closeUp'>, { body: [number, number, number, number]; head: [number, number, number]; zones: ZoneShape[] }> = {
  sit: { body: [-4, -52, 46, 50], head: [26, -112, 30], zones: [Z('head', 26, -112, 32, 30), Z('paws', 18, -7, 30, 10), Z('tail', -64, -26, 24, 16), Z('back', -4, -55, 46, 48)] },
  loaf: { body: [0, -34, 62, 34], head: [48, -70, 28], zones: [Z('head', 48, -70, 30, 28), Z('paws', 44, -6, 22, 8), Z('tail', -64, -10, 26, 10), Z('back', 0, -36, 62, 32)] },
  stand: { body: [0, -62, 60, 30], head: [56, -96, 27], zones: [Z('head', 56, -96, 30, 27), Z('tail', -74, -86, 16, 34), Z('paws', 0, -12, 56, 12), Z('back', 0, -64, 60, 28)] },
  walk: { body: [0, -62, 60, 30], head: [56, -96, 27], zones: [Z('head', 56, -96, 30, 27), Z('tail', -74, -86, 16, 34), Z('paws', 0, -12, 56, 12), Z('back', 0, -64, 60, 28)] },
  crouch: { body: [-2, -34, 58, 27], head: [54, -44, 26], zones: [Z('head', 54, -44, 28, 26), Z('paws', 46, -7, 20, 8), Z('tail', -72, -18, 28, 9), Z('back', -2, -36, 58, 26)] },
  bellyUp: { body: [0, -34, 66, 30], head: [-62, -38, 27], zones: [Z('head', -62, -38, 29, 27), Z('paws', 8, -82, 38, 15), Z('tail', 72, -18, 28, 9), Z('belly', 4, -46, 42, 18), Z('back', 0, -26, 66, 22)] },
  onLap: { body: [0, -34, 64, 34], head: [50, -72, 29], zones: [Z('head', 50, -72, 31, 29), Z('paws', 46, -6, 22, 8), Z('tail', -66, -10, 26, 10), Z('back', 0, -36, 64, 32)] },
  sitOn: { body: [0, -34, 62, 34], head: [48, -70, 28], zones: [Z('head', 48, -70, 30, 28), Z('paws', 44, -6, 22, 8), Z('tail', -64, -10, 26, 10), Z('back', 0, -36, 62, 32)] },
  sleep: { body: [0, -28, 56, 28], head: [34, -32, 22], zones: [Z('head', 34, -32, 24, 22), Z('tail', -4, -6, 52, 8), Z('back', 0, -30, 56, 27)] },
  jump: { body: [0, -70, 56, 24], head: [52, -88, 24], zones: [Z('head', 52, -88, 26, 24), Z('back', 0, -70, 56, 24)] },
  carried: { body: [0, -62, 32, 56], head: [0, -132, 26], zones: [Z('head', 0, -132, 28, 26), Z('paws', 0, -6, 30, 10), Z('tail', 18, 12, 9, 30), Z('belly', 0, -58, 22, 34), Z('back', 0, -62, 32, 56)] },
};

/** Close-up: his face fills the screen. Screen coordinates. */
export const CLOSE_UP = { cx: 195, cy: 430, rx: 190, ry: 210 };

export function toLocal(c: Pick<CatState, 'x' | 'y' | 'scale' | 'facing'>, p: Pt): Pt {
  return { x: ((p.x - c.x) / c.scale) * c.facing, y: (p.y - c.y) / c.scale };
}

function inEll(p: Pt, z: ZoneShape, pad = 1) {
  const dx = (p.x - z.cx) / (z.rx * pad);
  const dy = (p.y - z.cy) / (z.ry * pad);
  return dx * dx + dy * dy <= 1;
}

/** The zone of his body under a screen point, or null. */
export function zoneAt(c: Pick<CatState, 'x' | 'y' | 'scale' | 'facing' | 'onScreen'>, pose: Pose, p: Pt, bellyShown: boolean): Zone | null {
  if (!c.onScreen) return null;
  if (pose === 'closeUp') {
    const dx = (p.x - CLOSE_UP.cx) / CLOSE_UP.rx;
    const dy = (p.y - CLOSE_UP.cy) / CLOSE_UP.ry;
    return dx * dx + dy * dy <= 1 ? 'head' : null;
  }
  const g = POSE_GEOMETRY[pose];
  const l = toLocal(c, p);
  for (const z of g.zones) {
    if (z.zone === 'belly' && !bellyShown && pose !== 'carried') continue;
    // A little extra margin so a thumb on the edge still counts (min. touch target)
    if (inEll(l, z, 1.08)) return z.zone;
  }
  return null;
}

/** Bounding box of him on screen */
export function catBounds(c: Pick<CatState, 'x' | 'y' | 'scale' | 'facing'>, pose: Pose) {
  if (pose === 'closeUp') return { x: CLOSE_UP.cx - CLOSE_UP.rx, y: CLOSE_UP.cy - CLOSE_UP.ry, w: CLOSE_UP.rx * 2, h: CLOSE_UP.ry * 2 };
  const s = c.scale;
  return { x: c.x - 90 * s, y: c.y - 160 * s, w: 180 * s, h: 165 * s };
}

/** Where his head is on screen (for gaze, bites, close stares) */
export function headPos(c: Pick<CatState, 'x' | 'y' | 'scale' | 'facing'>, pose: Pose): Pt {
  if (pose === 'closeUp') return { x: CLOSE_UP.cx, y: CLOSE_UP.cy };
  const h = POSE_GEOMETRY[pose].head;
  return { x: c.x + h[0] * c.scale * c.facing, y: c.y + h[1] * c.scale };
}

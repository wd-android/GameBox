import type { InputEvent } from './sim';

/**
 * Run-length compression for grids (§8.2, §9 storage). Each run is written as
 * the count in base 36 followed by an upper-case letter for the value
 * (A = empty, B = colour 1 … I = colour 8).
 */
export function encodeGrid(cells: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < cells.length) {
    const v = cells[i];
    let n = 1;
    while (i + n < cells.length && cells[i + n] === v) n++;
    out += n.toString(36) + String.fromCharCode(65 + v);
    i += n;
  }
  return out;
}

export function decodeGrid(s: string, size: number): Uint8Array {
  const cells = new Uint8Array(size);
  let i = 0;
  let num = '';
  for (let k = 0; k < s.length; k++) {
    const ch = s.charCodeAt(k);
    if (ch >= 65 && ch <= 90) {
      const n = parseInt(num, 36);
      cells.fill(ch - 65, i, Math.min(size, i + n));
      i += n;
      num = '';
    } else {
      num += s[k];
    }
  }
  return cells;
}

/**
 * Compact text form for recordings: events separated by '.', each as
 * tick-delta (base 36), event code (P/O/C/K/T/U), value (base 36, may be negative).
 */
const CODES = 'POCKTU';

export function encodeRecording(events: InputEvent[]): string {
  let last = 0;
  return events
    .map(([t, e, v]) => {
      const s = (t - last).toString(36) + CODES[e] + (v === 0 ? '' : v.toString(36));
      last = t;
      return s;
    })
    .join('.');
}

export function decodeRecording(s: string): InputEvent[] {
  if (!s) return [];
  let tick = 0;
  return s.split('.').map((part) => {
    const m = /^([0-9a-z]+)([POCKTU])(-?[0-9a-z]*)$/.exec(part);
    if (!m) throw new Error('Bad recording: ' + part);
    tick += parseInt(m[1], 36);
    return [tick, CODES.indexOf(m[2]), m[3] ? parseInt(m[3], 36) : 0] as InputEvent;
  });
}

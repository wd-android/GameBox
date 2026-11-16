import { APP } from '../config/app';
import type { ChainResult } from '../chain/chain';

/**
 * Every piece of text the puzzle screen shows. Kept in one place, without
 * drawing code, so a test can prove par never leaks before solving when
 * "Show par before solving" is off (§7).
 */

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Beside the tray: only when the setting is on, or once solved. */
export function parLabel(par: number, showPar: boolean, solved: boolean): string {
  return showPar || solved ? `Par: ${dominoes(par)}` : '';
}

export function toppleCounter(topples: number): string {
  return topples === 0 ? 'Not toppled yet' : `${plural(topples, 'topple')}`;
}

/** After a chain stops short. Never mentions par. */
export function failureText(r: ChainResult): string {
  if (r.nearMisses.length) return 'So close – the chain stopped at a gap.';
  if (r.stops.length) return 'The chain ran out of dominoes.';
  return 'Not this time.';
}

/** The hint's label. Never mentions par. */
export function hintText(kind: 'essential' | 'decoy'): string {
  return kind === 'essential' ? 'This gap is part of the best answer.' : 'This gap is a decoy – leave it empty.';
}

export function dominoes(n: number): string {
  return n === 1 ? '1 domino' : `${n} dominoes`;
}

/** The shared result (§8.4). Always states par: it is sent after solving. Never reveals which gaps. */
export function shareText(o: { number: number | null; title?: string; topples: number; used: number; par: number; gold: boolean; hint: boolean }): string {
  const head = o.number !== null ? `${APP.DISPLAY_NAME} #${o.number}` : `${APP.DISPLAY_NAME} · ${o.title ?? ''}`.trim();
  const line = `Solved on the ${ordinal(o.topples)} topple with ${dominoes(o.used)} (par ${o.par})${o.hint ? ' with a hint' : ''}${o.gold ? ' ★' : ''}`;
  return `${head}\n${line}`;
}

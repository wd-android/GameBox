import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { recordSolve } from '../game/results';
import { todayNumber } from '../game/puzzles';
import { dominoes, ordinal, shareText } from '../game/texts';
import { PACK } from '../game/puzzles';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import type { App } from './app';
import { h, toast } from './dom';
import type { PlayScreen } from './playScreen';

/** Result (§12): topples, dominoes used, par (now revealed), gold mark, tokens, streak. Share, Replay, Home. */
export function showResult(app: App, screen: PlayScreen): void {
  const s = screen.session;
  const key = screen.key;
  const used = s.usedWhenSolved;
  const par = s.puzzle.par;
  const gold = used === par;
  const save = app.save;
  const out = recordSolve(save, key, { used, gold, hint: s.hintUsed, today: todayNumber() });
  if (key.kind === 'tutorial') save.tutorialDone = Math.max(save.tutorialDone, key.n);
  save.inProgress = null;
  app.persist();

  const text = shareText({ number: key.kind === 'daily' ? key.n : null, title: s.puzzle.title, topples: s.topples, used, par, gold, hint: s.hintUsed });
  const stat = (label: string, value: string) => h('div', { class: 'stat' }, h('small', {}, label), h('b', {}, value));
  const overlay = h('div', { class: 'overlay' });
  const actions = h('div', { class: 'result-actions' });
  const btn = (label: string, cls: string, fn: () => void) => {
    const b = h('button', { class: `btn ${cls}` }, label);
    b.addEventListener('click', () => {
      sound.tap();
      fn();
    });
    return b;
  };

  if (key.kind === 'tutorial') {
    actions.append(
      btn('Continue', 'primary', () => {
        overlay.remove();
        if (key.n === 1) app.play({ kind: 'tutorial', n: 2 });
        else app.play({ kind: 'daily', n: todayNumber() });
      }),
    );
  } else {
    actions.append(
      btn('Share', 'primary', async () => {
        try {
          if (Capacitor.isNativePlatform()) await Share.share({ text });
          else if (navigator.share) await navigator.share({ text });
          else {
            await navigator.clipboard.writeText(text);
            toast('Result copied');
          }
        } catch {
          /* cancelled */
        }
      }),
      btn('Replay', 'secondary', () => {
        overlay.remove();
        app.play(key, true);
      }),
    );
    if (key.kind === 'pack' && key.n < PACK.length) actions.append(btn('Next', 'secondary', () => (overlay.remove(), app.play({ kind: 'pack', n: key.n + 1 }))));
    actions.append(btn('Home', 'ghost', () => (overlay.remove(), app.goHome())));
  }

  const heading = key.kind === 'daily' ? `Topple #${key.n}` : (s.puzzle.title ?? 'Solved');
  overlay.append(
    h(
      'div',
      { class: 'sheet card result' },
      h('h2', { class: 'title' }, heading),
      h('div', { class: `gold-mark${gold ? ' on' : ''}` }, gold ? '★' : '✓'),
      h('div', { class: 'subtitle' }, `Solved on the ${ordinal(s.topples)} topple`),
      h('div', { class: 'stats' }, stat('Topples', String(s.topples)), stat('Used', dominoes(used)), stat('Par', String(par)), out.tokens ? stat('Tokens', `+${out.tokens}`) : null, key.kind === 'daily' ? stat('Streak', `${out.streak} 🔥`) : null),
      h('div', { class: 'subtitle' }, gold ? 'Gold mark – you matched par!' : `Par was ${dominoes(par)}. ${key.kind === 'daily' ? 'Replay it any time from the Archive' : 'Replay it'} to find the best answer.`),
      s.hintUsed ? h('div', { class: 'subtitle', style: 'font-size:12px' }, 'Hint used') : null,
      key.kind !== 'tutorial' ? h('pre', { class: 'share-preview' }, text) : null,
      actions,
    ),
  );
  app.ui.append(overlay);
  if (gold) {
    sound.star();
    haptic.medium();
  }
}

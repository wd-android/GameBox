import { sound } from '../audio/sound';
import { PACK } from '../game/puzzles';
import { packProgress, packUnlocked } from '../game/results';
import type { App, Screen } from './app';
import { h, ICONS, iconButton } from './dom';

const SECTIONS = [
  { from: 1, to: 6, name: 'Gaps, decoys and forks' },
  { from: 7, to: 16, name: 'The tall domino' },
  { from: 17, to: 24, name: 'Ramp and ball' },
  { from: 25, to: 30, name: 'Everything together' },
];

/** Pack 1, "First Tricks" (§9.4): 30 puzzles that unlock in order. */
export class PackScreen implements Screen {
  el: HTMLElement;

  constructor(app: App) {
    const save = app.save;
    const pp = packProgress(save);
    const list = h('div', { class: 'list' });
    for (const sec of SECTIONS) {
      const grid = h('div', { class: 'level-grid' });
      for (let n = sec.from; n <= sec.to; n++) {
        const rec = save.pack[n];
        const open = packUnlocked(save, n);
        const cell = h('button', { class: `level-cell${open ? '' : ' locked'}${rec?.solved ? ' solved' : ''}`, 'aria-label': `Puzzle ${n}` }, h('span', { class: 'n' }, open ? String(n) : '🔒'), h('span', { class: 'mini-stars' }, rec?.gold ? '★' : rec?.solved ? '✓' : ''));
        if (open)
          cell.addEventListener('click', () => {
            sound.unlock();
            sound.tap();
            app.play({ kind: 'pack', n });
          });
        grid.append(cell);
      }
      list.append(h('div', { class: 'card' }, h('b', {}, `${sec.from}–${sec.to} · ${sec.name}`), grid));
    }
    const top = h('div', { class: 'topbar' }, iconButton(ICONS.back, 'Back', () => app.goHome()), h('h1', { class: 'title', style: 'font-size:24px' }, 'First Tricks'), h('div', { class: 'spacer' }), h('div', { class: 'chip' }, `${pp.solved}/${PACK.length}`));
    this.el = h('div', { class: 'screen scroll' }, top, list);
  }

  destroy(): void {
    this.el.remove();
  }
}

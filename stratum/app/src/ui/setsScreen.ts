import { sound } from '../audio/sound';
import { highestUnlocked, setProgress } from '../game/progress';
import { matchJar } from '../jars/jars';
import { maskFor } from '../jars/shapes';
import { SETS } from '../jars/sets';
import { targetGrid } from '../jars/target';
import { decodeGrid } from '../sand/rle';
import { jarThumb } from '../render/outline';
import type { App, Screen } from './app';
import { h, ICONS, iconButton } from './dom';

/** Sets (§10): progress through each themed set; any unlocked jar can be replayed from here. */
export class SetsScreen implements Screen {
  el: HTMLElement;

  constructor(app: App) {
    const save = app.save;
    const unlocked = highestUnlocked(save);
    const list = h('div', { class: 'list' });
    for (const set of SETS) {
      const p = setProgress(save, set);
      const grid = h('div', { class: 'jar-grid' });
      for (let id = set.first; id <= set.last; id++) {
        const jar = matchJar(id);
        const rec = save.jars[id];
        const open = id <= unlocked;
        const m = maskFor(jar.shape);
        const cells = rec?.kept ? decodeGrid(rec.kept, m.w * m.h) : open ? targetGrid(jar) : null;
        const thumb = jarThumb(jar.shape, cells, 30, { patterns: save.settings.patterns, cork: !!rec?.kept });
        if (!rec?.kept && open) thumb.style.opacity = '0.45';
        const cell = h(
          'button',
          { class: `jar-cell${open ? '' : ' locked'}`, 'aria-label': `Jar ${id}${open ? '' : ', locked'}` },
          thumb,
          h('span', { class: 'n' }, String(id)),
          h('span', { style: 'color:#ffd166;font-size:10px;height:12px' }, rec ? '★'.repeat(rec.stars) : open ? '' : '🔒'),
        );
        if (open)
          cell.addEventListener('click', () => {
            sound.unlock();
            sound.tap();
            app.save.inProgress = app.save.inProgress?.jarId === id ? app.save.inProgress : null;
            app.playMatch(id);
          });
        grid.append(cell);
      }
      const done = save.setsDone.includes(set.name);
      list.append(
        h(
          'div',
          { class: 'card set-card' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('b', { style: 'font-size:18px' }, `${done ? set.decoration + ' ' : ''}${set.name}`), h('span', { class: 'subtitle' }, `${p.done}/${p.total} at ★★ · ${p.stars} ★`)),
          h('div', { class: 'bar' }, h('div', { style: `width:${(p.done / p.total) * 100}%` })),
          grid,
        ),
      );
    }
    const top = h('div', { class: 'topbar' }, iconButton(ICONS.back, 'Back', () => app.goHomeKeepingProgress()), h('h1', { class: 'title', style: 'font-size:24px' }, 'Sets'));
    this.el = h('div', { class: 'screen scroll' }, top, h('div', { class: 'subtitle', style: 'margin:4px 0 12px' }, 'Finish every jar in a set at two stars for 100 corks and a shelf decoration.'), list);
  }

  destroy(): void {
    this.el.remove();
  }
}

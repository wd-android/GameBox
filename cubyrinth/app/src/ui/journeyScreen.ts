import { sound } from '../audio/sound';
import { LEVELS, STAGES } from '../game/levels';
import { bestStars, highestUnlocked, medals } from '../game/progress';
import type { App, Screen } from './app';
import { h, ICONS, iconButton } from './dom';

/** Journey (§9.2): four stages, 80 levels, with stars and per-ball medals. */
export class JourneyScreen implements Screen {
  el: HTMLElement;

  constructor(app: App) {
    const save = app.save;
    const unlocked = highestUnlocked(save);
    const list = h('div', { class: 'list' });
    for (const st of STAGES) {
      const levels = LEVELS.filter((l) => l.stage === st.stage);
      const done = levels.filter((l) => medals(save, l.id).length).length;
      const grid = h('div', { class: 'level-grid' });
      for (const l of levels) {
        const open = l.id <= unlocked;
        const stars = bestStars(save, l.id);
        const m = medals(save, l.id);
        const cell = h(
          'button',
          { class: `level-cell${open ? '' : ' locked'}${l.id === unlocked && !m.length ? ' current' : ''}`, 'aria-label': `Level ${l.id}${open ? '' : ', locked'}` },
          h('span', { class: 'n' }, open ? String(l.id) : '🔒'),
          h('span', { class: 'mini-stars' }, '★'.repeat(stars) + '☆'.repeat(m.length && stars < 3 ? 3 - stars : 0)),
          h('span', { class: 'medals' }, ...m.map((k) => h('span', { class: `ball-dot tiny ${k}` }))),
        );
        if (open)
          cell.addEventListener('click', () => {
            sound.unlock();
            sound.tap();
            app.playLevel(l.id);
          });
        grid.append(cell);
      }
      list.append(
        h(
          'div',
          { class: 'card stage-card' },
          h('div', { class: 'stage-head' }, h('b', {}, `${st.stage}. ${st.name}`), h('span', { class: 'subtitle' }, `${st.n}×${st.n} · ${done}/${levels.length}`)),
          h('div', { class: 'subtitle', style: 'font-size:12px' }, st.introduces),
          h('div', { class: 'bar' }, h('div', { style: `width:${(done / levels.length) * 100}%` })),
          grid,
        ),
      );
    }
    const top = h('div', { class: 'topbar' }, iconButton(ICONS.back, 'Back', () => app.goHome()), h('h1', { class: 'title', style: 'font-size:24px' }, 'Journey'));
    this.el = h('div', { class: 'screen scroll' }, top, list);
    requestAnimationFrame(() => this.el.querySelector('.level-cell.current')?.scrollIntoView({ block: 'center' }));
  }

  destroy(): void {
    this.el.remove();
  }
}

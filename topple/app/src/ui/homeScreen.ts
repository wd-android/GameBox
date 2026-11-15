import { APP } from '../config/app';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { todayNumber } from '../game/puzzles';
import { dateForNumber, WEEKDAYS, weekday } from '../game/schedule';
import { packProgress, streakInfo } from '../game/results';
import { DOMINO_STYLES, TABLE_STYLES } from '../render/styles';
import type { App, Screen } from './app';
import { h, ICONS, iconButton, toast } from './dom';
import { openSettings } from './settingsSheet';

export function tokenIcon(): string {
  return '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="6" y="2" width="8" height="16" rx="2" fill="#06ffff"/><circle cx="10" cy="6.5" r="1.4" fill="#1b043b"/><circle cx="10" cy="13.5" r="1.4" fill="#1b043b"/><rect x="6" y="9.4" width="8" height="1.2" fill="#1b043b"/></svg>';
}

/** Home (§12): today's puzzle, Archive, Pack, Styles, Statistics, Settings; streak and tokens. */
export class HomeScreen implements Screen {
  el: HTMLElement;

  constructor(private app: App) {
    const save = app.save;
    const n = todayNumber();
    const date = dateForNumber(n);
    const rec = save.daily[n];
    const streak = streakInfo(save, n);
    const top = h(
      'div',
      { class: 'topbar' },
      h('div', { class: 'chip', 'aria-label': `${save.tokens} tokens` }, h('span', { html: tokenIcon() }), String(save.tokens)),
      h('div', { class: 'chip', 'aria-label': `Streak ${streak.current}` }, '🔥', String(streak.current), streak.protectionUsedThisMonth ? '' : h('span', { class: 'shield', title: 'Streak protection ready' }, '🛡')),
      h('div', { class: 'spacer' }),
      iconButton(ICONS.gear, 'Settings', () => openSettings(app, () => app.goHome())),
    );
    const hero = h('div', { class: 'hero' }, h('div', { class: 'hero-art', html: dominoArt() }), h('h1', { class: 'title hero-title' }, APP.DISPLAY_NAME));

    const today = h(
      'button',
      { class: `today-card${rec?.solved ? ' solved' : ''}` },
      h('small', {}, `${WEEKDAYS[weekday(date)]} · Daily Topple`),
      h('b', {}, `#${n}`),
      h('span', {}, rec?.solved ? `Solved on topple ${rec.topples}${rec.gold ? ' · ★ gold' : ''}` : rec?.topples ? `${rec.topples} topples so far` : 'Tap to play'),
    );
    today.addEventListener('click', () => {
      sound.unlock();
      sound.tap();
      app.playToday();
    });

    const pp = packProgress(save);
    const tile = (title: string, sub: string, fn: () => void) => {
      const b = h('button', { class: 'tile' }, title, h('small', {}, sub));
      b.addEventListener('click', () => {
        sound.unlock();
        sound.tap();
        fn();
      });
      return b;
    };
    this.el = h(
      'div',
      { class: 'screen' },
      top,
      hero,
      h(
        'div',
        { class: 'home-actions' },
        today,
        tile('Archive', `${n} puzzles so far`, () => app.openArchive()),
        tile('First Tricks', `${pp.solved}/${pp.total} solved`, () => app.openPack()),
        tile('Styles', 'Dominoes and tables', () => this.openStyles()),
        tile('Statistics', `Longest streak ${streak.longest}`, () => app.openStats()),
      ),
    );
  }

  private openStyles(): void {
    const save = this.app.save;
    const overlay = h('div', { class: 'overlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    const render = () => {
      overlay.innerHTML = '';
      const grid = (kind: 'domino' | 'table') => {
        const list = kind === 'domino' ? DOMINO_STYLES : TABLE_STYLES;
        const g = h('div', { class: 'shop-grid' });
        for (const s of list) {
          const key = `${kind}:${s.id}`;
          const owned = save.styles.owned.includes(key);
          const inUse = save.styles[kind] === s.id;
          const b = h('button', { class: `shop-item${inUse ? ' equipped' : ''}` }, h('div', { class: 'swatch', style: `background:${s.swatch}` }), h('b', {}, s.name), h('span', { class: 'price' }, inUse ? 'In use' : owned ? 'Use' : `${s.price} tokens`));
          b.addEventListener('click', () => {
            if (!owned) {
              if (save.tokens < s.price) {
                haptic.light();
                toast(`Need ${s.price - save.tokens} more tokens`);
                return;
              }
              save.tokens -= s.price;
              save.styles.owned.push(key);
              sound.star();
            } else sound.tap();
            save.styles[kind] = s.id;
            this.app.persist();
            render();
          });
          g.append(b);
        }
        return g;
      };
      const done = h('button', { class: 'btn primary wide' }, 'Done');
      done.addEventListener('click', () => {
        overlay.remove();
        this.app.goHome();
      });
      overlay.append(
        h(
          'div',
          { class: 'sheet card' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('h2', { class: 'title' }, 'Styles'), h('div', { class: 'chip' }, h('span', { html: tokenIcon() }), String(save.tokens))),
          h('div', { class: 'subtitle' }, 'Cosmetic only – puzzles never change.'),
          h('h3', { class: 'section' }, 'Dominoes'),
          grid('domino'),
          h('h3', { class: 'section' }, 'Tables'),
          grid('table'),
          done,
        ),
      );
    };
    render();
    this.app.ui.append(overlay);
  }

  destroy(): void {
    this.el.remove();
  }
}

function dominoArt(): string {
  const cols = ['#ff4b4b', '#ffc93c', '#3d7bff', '#34c759', '#06ffff'];
  let s = '<svg viewBox="0 0 220 110" width="220" height="110" aria-hidden="true">';
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 38;
    const rot = i < 3 ? 0 : i === 3 ? 28 : 62;
    s += `<g transform="translate(${x} 96) rotate(${rot})"><rect x="0" y="-70" width="20" height="70" rx="5" fill="${cols[i]}"/><circle cx="10" cy="-55" r="3" fill="#1b043b" opacity=".6"/><circle cx="10" cy="-20" r="3" fill="#1b043b" opacity=".6"/></g>`;
  }
  s += '<rect x="8" y="96" width="204" height="6" rx="3" fill="#9259fe" opacity=".6"/></svg>';
  return s;
}

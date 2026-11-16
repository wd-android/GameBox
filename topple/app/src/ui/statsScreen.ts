import { todayNumber } from '../game/puzzles';
import { statistics } from '../game/results';
import type { App, Screen } from './app';
import { h, ICONS, iconButton } from './dom';

/** Statistics (§12): played, solved, streaks, solves by topple number, gold marks. */
export class StatsScreen implements Screen {
  el: HTMLElement;

  constructor(app: App) {
    const s = statistics(app.save, todayNumber());
    const stat = (label: string, value: string | number) => h('div', { class: 'stat big' }, h('b', {}, String(value)), h('small', {}, label));
    const max = Math.max(1, ...s.byTopples);
    const chart = h('div', { class: 'chart' });
    s.byTopples.forEach((v, i) => {
      chart.append(
        h(
          'div',
          { class: 'bar-row' },
          h('span', { class: 'bar-label' }, i === 5 ? '6+' : String(i + 1)),
          h('div', { class: 'bar-track' }, h('div', { class: `bar-fill${i === 0 ? ' first' : ''}`, style: v ? `width:${Math.max(8, (v / max) * 100)}%` : 'width:0;padding:0' }, v ? String(v) : '')),
        ),
      );
    });
    const top = h('div', { class: 'topbar' }, iconButton(ICONS.back, 'Back', () => app.goHome()), h('h1', { class: 'title', style: 'font-size:24px' }, 'Statistics'));
    this.el = h(
      'div',
      { class: 'screen scroll' },
      top,
      h('div', { class: 'card stats-grid' }, stat('Played', s.played), stat('Solved', s.solved), stat('Current streak', s.current), stat('Longest streak', s.longest), stat('Gold marks', s.gold)),
      h('div', { class: 'card' }, h('b', {}, 'Daily puzzles solved, by topple'), chart),
    );
  }

  destroy(): void {
    this.el.remove();
  }
}

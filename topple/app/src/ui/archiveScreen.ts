import { sound } from '../audio/sound';
import { todayNumber } from '../game/puzzles';
import { dateForNumber, weekday } from '../game/schedule';
import { dayColour, streakInfo } from '../game/results';
import type { App, Screen } from './app';
import { h, ICONS, iconButton } from './dom';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Archive (§9.3): every daily puzzle from #1 to today, as a calendar by month, coloured by result. */
export class ArchiveScreen implements Screen {
  el: HTMLElement;

  constructor(app: App) {
    const save = app.save;
    const today = todayNumber();
    const shields = new Set(streakInfo(save, today).shields);
    const months = new Map<string, number[]>();
    for (let n = 1; n <= today; n++) {
      const m = dateForNumber(n).slice(0, 7);
      if (!months.has(m)) months.set(m, []);
      months.get(m)!.push(n);
    }
    const list = h('div', { class: 'list' });
    for (const [month, nums] of [...months].reverse()) {
      const [y, m] = month.split('-').map(Number);
      const grid = h('div', { class: 'calendar' });
      for (const d of ['M', 'T', 'W', 'T', 'F', 'S', 'S']) grid.append(h('div', { class: 'cal-head' }, d));
      // Offset so Monday is the first column.
      const firstDate = `${month}-01`;
      const lead = (weekday(firstDate) + 6) % 7;
      for (let i = 0; i < lead; i++) grid.append(h('div', {}));
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const n = nums.find((k) => dateForNumber(k) === date);
        if (!n) {
          grid.append(h('div', { class: 'cal-day out' }, String(day)));
          continue;
        }
        const colour = dayColour(save.daily[n]);
        const cell = h('button', { class: `cal-day ${colour}${n === today ? ' today' : ''}`, 'aria-label': `Topple #${n}, ${date}` }, String(day), shields.has(date) ? h('span', { class: 'cal-shield' }, '🛡') : null);
        cell.addEventListener('click', () => {
          sound.unlock();
          sound.tap();
          app.play({ kind: 'daily', n });
        });
        grid.append(cell);
      }
      list.append(h('div', { class: 'card' }, h('b', { style: 'font-size:18px' }, `${MONTHS[m - 1]} ${y}`), grid));
    }
    const legend = h(
      'div',
      { class: 'legend' },
      ...(
        [
          ['gold', 'Matched par'],
          ['green', '1st topple'],
          ['amber', '2nd–3rd'],
          ['grey', '4 or more'],
        ] as const
      ).map(([c, t]) => h('span', {}, h('i', { class: `dot ${c}` }), t)),
    );
    const top = h('div', { class: 'topbar' }, iconButton(ICONS.back, 'Back', () => app.goHome()), h('h1', { class: 'title', style: 'font-size:24px' }, 'Archive'));
    this.el = h('div', { class: 'screen scroll' }, top, legend, list);
  }

  destroy(): void {
    this.el.remove();
  }
}

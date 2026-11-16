import { sound } from '../audio/sound';
import type { App } from './app';
import { h, toggle } from './dom';

/** Pause menu (§13): the par setting takes effect immediately on the puzzle in progress. */
export function openPause(app: App, o: { onChange: () => void; onRestart: () => void; onHome: () => void }): void {
  const s = app.save.settings;
  const change = () => {
    app.applySettings();
    app.persist();
    o.onChange();
  };
  const overlay = h('div', { class: 'overlay' });
  const close = (fn: () => void) => {
    overlay.remove();
    sound.tap();
    fn();
  };
  const resume = h('button', { class: 'btn primary wide' }, 'Resume');
  resume.addEventListener('click', () => close(() => {}));
  const restart = h('button', { class: 'btn secondary' }, 'Clear pieces');
  restart.addEventListener('click', () => close(o.onRestart));
  const home = h('button', { class: 'btn ghost' }, 'Home');
  home.addEventListener('click', () => close(o.onHome));
  overlay.append(
    h(
      'div',
      { class: 'sheet card' },
      h('h2', { class: 'title', style: 'text-align:center' }, 'Paused'),
      h('div', { class: 'row' }, h('span', {}, 'Show par before solving', h('small', {}, 'Changes only what you are told in advance')), toggle(s.showPar, (v) => ((s.showPar = v), change()))),
      h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), change()))),
      h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), change()))),
      h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), change()))),
      h('div', { class: 'row' }, h('span', {}, 'Reduce motion', h('small', {}, 'Camera stays still during the topple')), toggle(s.reduceMotion, (v) => ((s.reduceMotion = v), change()))),
      resume,
      h('div', { class: 'result-actions' }, restart, home),
    ),
  );
  app.ui.append(overlay);
}

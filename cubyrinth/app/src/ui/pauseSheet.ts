import { sound } from '../audio/sound';
import type { App } from './app';
import { h, toggle } from './dom';

export interface PauseOptions {
  faceName: string;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** PAUSED (§7.13): entered from ROLLING and returns to it. */
export function openPause(app: App, o: PauseOptions): void {
  const s = app.save.settings;
  const save = () => {
    app.applySettings();
    app.persist();
  };
  const overlay = h('div', { class: 'overlay' });
  const close = (fn: () => void) => {
    overlay.remove();
    sound.tap();
    fn();
  };
  const resume = h('button', { class: 'btn primary wide' }, 'Resume');
  resume.addEventListener('click', () => close(o.onResume));
  const restart = h('button', { class: 'btn secondary' }, 'Restart');
  restart.addEventListener('click', () => close(o.onRestart));
  const quit = h('button', { class: 'btn ghost' }, 'Home');
  quit.addEventListener('click', () => close(o.onQuit));

  const sens = h('input', { type: 'range', min: '50', max: '120', value: String(s.sensitivity), class: 'slider', 'aria-label': 'Tilt sensitivity' }) as HTMLInputElement;
  sens.addEventListener('input', () => {
    s.sensitivity = Number(sens.value);
    save();
  });

  overlay.append(
    h(
      'div',
      { class: 'sheet card' },
      h('h2', { class: 'title', style: 'text-align:center' }, 'Paused'),
      h('div', { class: 'row' }, h('span', {}, 'Tilt radius', h('small', {}, 'Smaller is more sensitive')), sens),
      h('div', { class: 'row' }, h('span', {}, 'Mini-map', h('small', {}, 'Applies from the next cube')), toggle(s.minimap, (v) => ((s.minimap = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Ball trail'), toggle(s.trail, (v) => ((s.trail = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
      resume,
      h('div', { class: 'result-actions' }, restart, quit),
    ),
  );
  app.ui.append(overlay);
}

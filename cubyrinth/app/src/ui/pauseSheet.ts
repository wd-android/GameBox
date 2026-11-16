import { STRINGS as S } from '../config/strings';
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
  const resume = h('button', { class: 'btn primary wide' }, S.pause.resume);
  resume.addEventListener('click', () => close(o.onResume));
  // Android back button: the same as Resume.
  overlay.addEventListener('back', (e) => {
    e.preventDefault();
    close(o.onResume);
  });
  const restart = h('button', { class: 'btn secondary' }, S.pause.restart);
  restart.addEventListener('click', () => close(o.onRestart));
  const quit = h('button', { class: 'btn ghost' }, S.common.home);
  quit.addEventListener('click', () => close(o.onQuit));

  const sens = h('input', { type: 'range', min: '50', max: '120', value: String(s.sensitivity), class: 'slider', 'aria-label': S.settings.sensitivity }) as HTMLInputElement;
  sens.addEventListener('input', () => {
    s.sensitivity = Number(sens.value);
    save();
  });

  overlay.append(
    h(
      'div',
      { class: 'sheet card' },
      h('h2', { class: 'title', style: 'text-align:center' }, S.pause.title),
      h('div', { class: 'row' }, h('span', {}, S.pause.tiltRadius, h('small', {}, S.pause.tiltRadiusSub)), sens),
      h('div', { class: 'row' }, h('span', {}, S.settings.minimap, h('small', {}, S.pause.minimapSub)), toggle(s.minimap, (v) => ((s.minimap = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.trail), toggle(s.trail, (v) => ((s.trail = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.music), toggle(s.music, (v) => ((s.music = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.sfx), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.vibration), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
      resume,
      h('div', { class: 'result-actions' }, restart, quit),
    ),
  );
  app.ui.append(overlay);
}

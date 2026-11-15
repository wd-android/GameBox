import { sound } from '../audio/sound';
import type { App } from './app';
import { h, segmented, toggle } from './dom';
import type { PourMode } from '../input/pourControl';

export interface PauseOptions {
  canGuides: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** Pause menu: resume, the Pouring setting (takes effect at once, §7), guides, sound, restart, shelf. */
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
  const quit = h('button', { class: 'btn ghost' }, 'Shelf');
  quit.addEventListener('click', () => close(o.onQuit));

  const sheet = h(
    'div',
    { class: 'sheet card' },
    h('h2', { class: 'title', style: 'text-align:center' }, 'Paused'),
    h(
      'div',
      { class: 'row' },
      h('span', {}, 'Pouring'),
      segmented<PourMode>(
        [
          ['thumb', 'Follow thumb'],
          ['fixed', 'Fixed spout'],
        ],
        s.pouring,
        (v) => {
          s.pouring = v;
          save();
        },
      ),
    ),
    o.canGuides ? h('div', { class: 'row' }, h('span', {}, 'Guide lines', h('small', {}, 'Off earns a freehand mark')), toggle(s.guides, (v) => ((s.guides = v), save()))) : null,
    h('div', { class: 'row' }, h('span', {}, 'Colour patterns'), toggle(s.patterns, (v) => ((s.patterns = v), save()))),
    h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), save()))),
    h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
    h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
    resume,
    h('div', { class: 'result-actions' }, restart, quit),
  );
  overlay.append(sheet);
  app.ui.append(overlay);
}

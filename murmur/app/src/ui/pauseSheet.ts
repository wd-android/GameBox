import { sound } from '../audio/sound';
import type { Steering } from '../state/save';
import type { App } from './app';
import { h, segmented, toggle } from './dom';

/** Pause: the steering setting can be changed here and takes effect from the next run (§8). */
export function openPause(app: App, o: { onResume: () => void; onQuit: () => void }): void {
  const s = app.save.settings;
  const save = () => {
    app.applySettings();
    app.persist();
  };
  const overlay = h('div', { class: 'overlay' });
  const resume = h('button', { class: 'btn primary wide' }, 'Resume');
  resume.addEventListener('click', () => {
    overlay.remove();
    sound.tap();
    o.onResume();
  });
  // Android back button: the same as Resume (removing the sheet alone left the run paused for good).
  overlay.addEventListener('back', (e) => {
    e.preventDefault();
    overlay.remove();
    o.onResume();
  });
  const quit = h('button', { class: 'btn ghost' }, 'End run');
  quit.addEventListener('click', () => {
    overlay.remove();
    o.onQuit();
  });
  overlay.append(
    h(
      'div',
      { class: 'sheet card' },
      h('h2', { class: 'title', style: 'text-align:center' }, 'Paused'),
      h(
        'div',
        { class: 'row' },
        h('span', {}, 'Steering', h('small', {}, 'From the next run')),
        segmented<Steering>(
          [
            ['thumb', 'Follow thumb'],
            ['draw', 'Draw a path'],
          ],
          s.steering,
          (v) => ((s.steering = v), save()),
        ),
      ),
      h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Reduce motion'), toggle(s.reduceMotion, (v) => ((s.reduceMotion = v), save()))),
      resume,
      quit,
    ),
  );
  app.ui.append(overlay);
}

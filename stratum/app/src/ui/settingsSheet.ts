import { APP } from '../config/app';
import { sound } from '../audio/sound';
import { freshSave } from '../state/save';
import type { PourMode } from '../input/pourControl';
import type { App } from './app';
import { h, segmented, toggle } from './dom';

/** Settings (§12). Every change applies at once and is saved. */
export function openSettings(app: App, onClose?: () => void): void {
  const s = app.save.settings;
  const save = () => {
    app.applySettings();
    app.persist();
  };
  const overlay = h('div', { class: 'overlay' });
  const done = h('button', { class: 'btn primary wide' }, 'Done');
  done.addEventListener('click', () => {
    sound.tap();
    overlay.remove();
    onClose?.();
  });

  const reset = h('button', { class: 'btn ghost' }, 'Reset progress');
  reset.addEventListener('click', () => {
    if (reset.dataset.confirm) {
      const keep = app.save.settings;
      app.save = freshSave();
      app.save.settings = keep;
      app.save.firstLaunchDone = true;
      app.persist();
      app.applySettings();
      overlay.remove();
      app.goHome();
      return;
    }
    reset.dataset.confirm = '1';
    reset.textContent = 'Tap again to erase everything';
    reset.style.borderColor = '#ff5454';
    reset.style.color = '#ff8080';
  });

  overlay.append(
    h(
      'div',
      { class: 'sheet card' },
      h('h2', { class: 'title', style: 'text-align:center' }, 'Settings'),
      h(
        'div',
        { class: 'row' },
        h('span', {}, 'Pouring', h('small', {}, 'Where the sand falls from')),
        segmented<PourMode>(
          [
            ['thumb', 'Follow thumb'],
            ['fixed', 'Fixed spout'],
          ],
          s.pouring,
          (v) => ((s.pouring = v), save()),
        ),
      ),
      h('div', { class: 'row' }, h('span', {}, 'Guide lines', h('small', {}, 'Always on for jars 1–15')), toggle(s.guides, (v) => ((s.guides = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Colour patterns', h('small', {}, 'Dots, stripes… for each colour')), toggle(s.patterns, (v) => ((s.patterns = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Reduce motion'), toggle(s.reduceMotion, (v) => ((s.reduceMotion = v), save()))),
      done,
      reset,
      h('div', { class: 'subtitle', style: 'text-align:center;font-size:11px' }, `${APP.DISPLAY_NAME} · v0.1 · saved on this device only`),
    ),
  );
  app.ui.append(overlay);
}

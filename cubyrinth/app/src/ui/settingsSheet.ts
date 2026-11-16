import { APP } from '../config/app';
import { sound } from '../audio/sound';
import { freshSave } from '../state/save';
import type { App } from './app';
import { h, segmented, toggle } from './dom';

/** Settings (§10). Every change applies at once and is saved. */
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
      app.save.seenTutorial = true;
      app.persist();
      overlay.remove();
      app.goHome();
      return;
    }
    reset.dataset.confirm = '1';
    reset.textContent = 'Tap again to erase everything';
    reset.style.borderColor = '#ff5454';
    reset.style.color = '#ff8080';
  });
  const sens = h('input', { type: 'range', min: '50', max: '120', value: String(s.sensitivity), class: 'slider', 'aria-label': 'Tilt sensitivity' }) as HTMLInputElement;
  const sensLabel = h('small', {}, `${s.sensitivity} points for full tilt`);
  sens.addEventListener('input', () => {
    s.sensitivity = Number(sens.value);
    sensLabel.textContent = `${s.sensitivity} points for full tilt`;
    save();
  });

  overlay.append(
    h(
      'div',
      { class: 'sheet card' },
      h('h2', { class: 'title', style: 'text-align:center' }, 'Settings'),
      h(
        'div',
        { class: 'row' },
        h('span', {}, 'Control', h('small', {}, 'Step mode earns its own medal')),
        segmented<'tilt' | 'step'>(
          [
            ['tilt', 'Thumb tilt'],
            ['step', 'Step'],
          ],
          s.control,
          (v) => ((s.control = v), save()),
        ),
      ),
      h('div', { class: 'row' }, h('span', {}, 'Tilt sensitivity', sensLabel), sens),
      h('div', { class: 'row' }, h('span', {}, 'Mini-map'), toggle(s.minimap, (v) => ((s.minimap = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Ball trail'), toggle(s.trail, (v) => ((s.trail = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Reduce motion', h('small', {}, 'Turns become a short cross-fade')), toggle(s.reduceMotion, (v) => ((s.reduceMotion = v), save()))),
      done,
      reset,
      h('div', { class: 'subtitle', style: 'text-align:center;font-size:11px' }, `${APP.DISPLAY_NAME} · v0.1 · saved on this device only`),
    ),
  );
  app.ui.append(overlay);
}

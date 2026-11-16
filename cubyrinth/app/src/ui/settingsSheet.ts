import { STRINGS as S } from '../config/strings';
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
  const done = h('button', { class: 'btn primary wide' }, S.settings.done);
  done.addEventListener('click', () => {
    sound.tap();
    overlay.remove();
    onClose?.();
  });
  const reset = h('button', { class: 'btn ghost' }, S.settings.reset);
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
    reset.textContent = S.settings.resetConfirm;
    reset.style.borderColor = '#ff5454';
    reset.style.color = '#ff8080';
  });
  const sens = h('input', { type: 'range', min: '50', max: '120', value: String(s.sensitivity), class: 'slider', 'aria-label': S.settings.sensitivity }) as HTMLInputElement;
  const sensLabel = h('small', {}, S.settings.sensitivityValue(s.sensitivity));
  sens.addEventListener('input', () => {
    s.sensitivity = Number(sens.value);
    sensLabel.textContent = S.settings.sensitivityValue(s.sensitivity);
    save();
  });

  overlay.append(
    h(
      'div',
      { class: 'sheet card' },
      h('h2', { class: 'title', style: 'text-align:center' }, S.common.settings),
      h(
        'div',
        { class: 'row' },
        h('span', {}, S.settings.control, h('small', {}, S.settings.controlSub)),
        segmented<'tilt' | 'step'>(
          [
            ['tilt', S.settings.thumbTilt],
            ['step', S.settings.step],
          ],
          s.control,
          (v) => ((s.control = v), save()),
        ),
      ),
      h('div', { class: 'row' }, h('span', {}, S.settings.sensitivity, sensLabel), sens),
      h('div', { class: 'row' }, h('span', {}, S.settings.minimap), toggle(s.minimap, (v) => ((s.minimap = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.trail), toggle(s.trail, (v) => ((s.trail = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.music), toggle(s.music, (v) => ((s.music = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.sfx), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.vibration), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
      h('div', { class: 'row' }, h('span', {}, S.settings.reduceMotion, h('small', {}, S.settings.reduceMotionSub)), toggle(s.reduceMotion, (v) => ((s.reduceMotion = v), save()))),
      done,
      reset,
      h('div', { class: 'subtitle', style: 'text-align:center;font-size:11px' }, S.settings.footer(APP.DISPLAY_NAME, APP.VERSION)),
    ),
  );
  app.ui.append(overlay);
}

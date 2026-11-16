import { APP } from '../config/app';
import { sound } from '../audio/sound';
import { freshSave } from '../state/save';
import { scheduleReminder } from '../game/reminder';
import type { App } from './app';
import { h, toggle, toast } from './dom';

/** Settings (§13). Every change applies at once and is saved. */
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
      app.save.tutorialDone = 2;
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
  const time = h('input', { type: 'time', value: s.reminderTime, class: 'time-input', 'aria-label': 'Reminder time' }) as HTMLInputElement;
  time.disabled = !s.reminder;
  time.addEventListener('change', () => {
    s.reminderTime = time.value || '09:00';
    save();
    void scheduleReminder(s.reminder, s.reminderTime);
  });
  const reminder = toggle(s.reminder, async (v) => {
    s.reminder = v;
    time.disabled = !v;
    save();
    const ok = await scheduleReminder(v, s.reminderTime);
    if (v && !ok) toast('Notifications are not available here');
  });

  overlay.append(
    h(
      'div',
      { class: 'sheet card' },
      h('h2', { class: 'title', style: 'text-align:center' }, 'Settings'),
      h('div', { class: 'row' }, h('span', {}, 'Show par before solving', h('small', {}, 'Off: par is revealed after you solve')), toggle(s.showPar, (v) => ((s.showPar = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Daily reminder', time), reminder),
      h('div', { class: 'row' }, h('span', {}, 'Reduce motion', h('small', {}, 'Camera stays still during the topple')), toggle(s.reduceMotion, (v) => ((s.reduceMotion = v), save()))),
      done,
      reset,
      h('div', { class: 'subtitle', style: 'text-align:center;font-size:11px' }, `${APP.DISPLAY_NAME} · v${APP.VERSION} · no personal data · nothing leaves this device`),
    ),
  );
  app.ui.append(overlay);
}

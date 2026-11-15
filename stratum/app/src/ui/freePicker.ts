import { sound } from '../audio/sound';
import { unlockedShapes } from '../game/progress';
import { SHAPES } from '../jars/shapes';
import { jarThumb } from '../render/outline';
import type { App } from './app';
import { h } from './dom';

/** Free Pour: pick any unlocked shape; all eight colours, no target, unlimited undo (§8.4). */
export function openFreePicker(app: App): void {
  const overlay = h('div', { class: 'overlay' });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  const row = h('div', { class: 'shapes-pick' });
  for (const shape of unlockedShapes(app.save)) {
    const b = h('button', { class: 'shape-btn' }, jarThumb(shape, null, 60, { patterns: false }), SHAPES[shape].name);
    b.addEventListener('click', () => {
      sound.tap();
      overlay.remove();
      app.playFree(shape);
    });
    row.append(b);
  }
  const cancel = h('button', { class: 'btn ghost' }, 'Cancel');
  cancel.addEventListener('click', () => overlay.remove());
  overlay.append(h('div', { class: 'sheet card result' }, h('h2', { class: 'title' }, 'Free Pour'), h('div', { class: 'subtitle' }, 'Choose a jar'), row, cancel));
  app.ui.append(overlay);
}

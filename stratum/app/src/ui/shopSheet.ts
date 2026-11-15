import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { buy, SHOP, type ShopKind } from '../game/progress';
import type { App } from './app';
import { corkIcon, h, toast } from './dom';

/** Spend corks on shelf backdrops, lighting and labels (§8.5). */
export function openShop(app: App, onClose?: () => void): void {
  const overlay = h('div', { class: 'overlay' });
  const render = () => {
    overlay.innerHTML = '';
    const save = app.save;
    const sections: [ShopKind, string][] = [
      ['backdrop', 'Backdrops'],
      ['lighting', 'Lighting'],
      ['label', 'Labels'],
    ];
    const sheet = h(
      'div',
      { class: 'sheet card' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('h2', { class: 'title' }, 'Decorate'), h('div', { class: 'chip' }, h('span', { html: corkIcon() }), String(save.corks))),
    );
    for (const [kind, title] of sections) {
      const grid = h('div', { class: 'shop-grid' });
      for (const item of SHOP.filter((i) => i.kind === kind)) {
        const key = `${item.kind}:${item.id}`;
        const owned = save.owned.includes(key);
        const equipped = save.equipped[kind] === item.id;
        const swatch =
          kind === 'backdrop'
            ? h('div', { class: 'swatch', style: `background:${item.css}` })
            : kind === 'lighting'
              ? h('div', { class: 'swatch', style: `background:#1b043b;box-shadow:inset 0 0 26px ${item.css}` })
              : h('div', { class: 'swatch', style: `background:#1b043b;display:flex;align-items:center;justify-content:center` }, h('div', { style: `width:44px;height:20px;border-radius:4px;background:${item.css}` }));
        const b = h(
          'button',
          { class: `shop-item${equipped ? ' equipped' : ''}` },
          swatch,
          h('b', {}, item.name),
          h('span', { class: 'price' }, equipped ? 'In use' : owned ? 'Use' : `${item.price} corks`),
        );
        b.addEventListener('click', () => {
          if (!owned) {
            if (!buy(save, item)) {
              sound.hollow();
              haptic.double();
              toast(`Need ${item.price - save.corks} more corks`);
              return;
            }
            sound.pop();
            haptic.firm();
          } else sound.tap();
          save.equipped[kind] = item.id;
          app.applySettings();
          app.persist();
          render();
        });
        grid.append(b);
      }
      sheet.append(h('h3', { style: 'font-size:15px;color:var(--text-dim);font-weight:500' }, title), grid);
    }
    const done = h('button', { class: 'btn primary wide' }, 'Done');
    done.addEventListener('click', () => {
      overlay.remove();
      onClose?.();
    });
    sheet.append(done);
    overlay.append(sheet);
  };
  render();
  app.ui.append(overlay);
}

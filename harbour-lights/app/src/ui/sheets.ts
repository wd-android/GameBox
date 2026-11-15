import { BUILDINGS, TUNING } from '../config/tuning';
import { sound } from '../audio/sound';
import { freshSave, type BeamControl } from '../state/save';
import { build, canBuild, canUpgrade, nightUnlocked, reachedNight, upgrade } from '../game/progress';
import { buildingRate, levelCost, UPGRADE_NAMES, type UpgradeId } from '../town/town';
import { NIGHT_COUNT } from '../nights/nights';
import type { App } from './app';
import { h, ICONS, iconButton, segmented, toast, toggle } from './dom';

function sheet(app: App, title: string, ...body: (HTMLElement | null)[]): HTMLElement {
  const overlay = h('div', { class: 'overlay' });
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  overlay.append(h('div', { class: 'sheet card' }, h('div', { class: 'sheet-head' }, h('h2', {}, title), iconButton(ICONS.close, 'Close', close)), ...body));
  app.ui.append(overlay);
  return overlay;
}

/** Settings rows (§12). Changes take effect at once, mid-night included. */
function settingsRows(app: App, withReset: boolean): HTMLElement {
  const s = app.save.settings;
  const save = () => {
    app.applySettings();
    app.persist();
  };
  const sens = h('input', { type: 'range', min: TUNING.DRAG_SENSITIVITY.min, max: TUNING.DRAG_SENSITIVITY.max, step: 0.05, value: s.sensitivity, 'aria-label': 'Drag sensitivity' });
  const sensLabel = h('b', {}, s.sensitivity.toFixed(2));
  sens.addEventListener('input', () => {
    s.sensitivity = Number(sens.value);
    sensLabel.textContent = s.sensitivity.toFixed(2);
    save();
  });
  const wrap = h(
    'div',
    { class: 'settings' },
    h(
      'div',
      { class: 'setting-block' },
      h('span', {}, 'Beam control'),
      segmented<BeamControl>(
        [
          ['drag', 'Drag to turn'],
          ['touch', 'Touch to aim'],
        ],
        s.control,
        (v) => ((s.control = v), save()),
      ),
      h('small', { class: 'subtitle' }, 'Drag sideways anywhere, thumb low and clear of the sea (default) – or touch the sea where the light should point. Touching is quicker between far boats, but the thumb covers part of the sea.'),
    ),
    h('div', { class: 'row' }, h('span', {}, 'Drag sensitivity'), h('span', { class: 'range' }, sens, sensLabel)),
    h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), save()))),
    h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
    h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
    h('div', { class: 'row' }, h('span', {}, 'Reduce motion'), toggle(s.reduceMotion, (v) => ((s.reduceMotion = v), save()))),
  );
  if (withReset) {
    const reset = h('button', { class: 'btn ghost wide' }, 'Reset progress');
    reset.addEventListener('click', () => {
      if (reset.dataset.armed) {
        const fresh = freshSave();
        fresh.settings = { ...s };
        app.save = fresh;
        app.persist();
        document.querySelectorAll('.overlay').forEach((o) => o.remove());
        app.playTutorial();
        return;
      }
      reset.dataset.armed = '1';
      reset.textContent = 'Tap again to erase everything';
      reset.classList.add('danger');
    });
    wrap.append(reset);
  }
  return wrap;
}

export function openSettings(app: App): void {
  sheet(app, 'Settings', settingsRows(app, true));
}

/** Pause: the beam-control setting can be changed here and takes effect at once (§7). */
export function openPause(app: App, o: { onResume: () => void; onQuit: () => void }): void {
  const overlay = h('div', { class: 'overlay' });
  const resume = h('button', { class: 'btn primary wide' }, 'Resume');
  resume.addEventListener('click', () => {
    overlay.remove();
    sound.tap();
    o.onResume();
  });
  const quit = h('button', { class: 'btn ghost wide' }, 'Back to town (the night is not kept)');
  quit.addEventListener('click', () => {
    overlay.remove();
    o.onQuit();
  });
  overlay.append(h('div', { class: 'sheet card' }, h('h2', { class: 'title center' }, 'Paused'), resume, settingsRows(app, false), quit));
  app.ui.append(overlay);
}

/** Buildings (§9.1): cards with level, earnings and upgrade cost. */
export function openBuildings(app: App, onChange: () => void): void {
  const list = h('div', { class: 'cards' });
  const render = () => {
    list.replaceChildren();
    const save = app.save;
    for (const b of BUILDINGS) {
      const level = save.buildings[b.id];
      const c = canBuild(save, b.id);
      const next = Math.min(TUNING.MAX_LEVEL, level + 1);
      const locked = !nightUnlocked(save, b.unlock) && reachedNight(save) < b.unlock;
      const btn = h('button', { class: `btn ${c.ok ? 'primary' : 'secondary'} buy`, disabled: !c.ok }, level >= TUNING.MAX_LEVEL ? 'Full' : locked ? `Night ${b.unlock}` : h('span', {}, level ? 'Upgrade ' : 'Build ', h('span', { class: 'coin' }), String(levelCost(b.id, next))));
      btn.addEventListener('click', () => {
        if (build(save, b.id)) {
          sound.coin();
          app.persist();
          toast(level ? `${b.name} is now level ${level + 1}` : `${b.name} built!`);
          render();
          onChange();
        }
      });
      list.append(
        h(
          'div',
          { class: `card shop-card${locked ? ' locked' : ''}` },
          h('div', { class: 'shop-info' }, h('b', {}, b.name), h('span', { class: 'subtitle' }, level ? `Level ${level} · ${buildingRate(b.id, level)} coins an hour` : locked ? `Unlocks at night ${b.unlock}` : `Earns ${buildingRate(b.id, 1)} coins an hour`), b.also ? h('small', { class: 'also' }, b.also) : null, levelDots(level)),
          btn,
        ),
      );
    }
  };
  render();
  sheet(app, 'Buildings', h('p', { class: 'subtitle' }, `Buildings earn while you are away, up to ${TUNING.STORE_HOURS} hours’ worth.`), list);
}

/** Lighthouse upgrades (§9.3). Never needed to finish a night, but they make nights more comfortable. */
export function openLighthouse(app: App): void {
  const list = h('div', { class: 'cards' });
  const render = () => {
    list.replaceChildren();
    const save = app.save;
    for (const id of ['width', 'reach', 'turn'] as UpgradeId[]) {
      const u = UPGRADE_NAMES[id];
      const lvl = save.upgrades[id];
      const c = canUpgrade(save, id);
      const btn = h('button', { class: `btn ${c.ok ? 'primary' : 'secondary'} buy`, disabled: !c.ok }, c.ok || c.cost !== undefined ? h('span', {}, h('span', { class: 'coin' }), String(c.cost)) : 'Full');
      btn.addEventListener('click', () => {
        if (upgrade(save, id)) {
          sound.coin();
          app.persist();
          toast(`${u.name}: ${u.values[lvl + 1]}${u.unit}`);
          render();
        }
      });
      list.append(
        h(
          'div',
          { class: 'card shop-card' },
          h('div', { class: 'shop-info' }, h('b', {}, u.name), h('span', { class: 'subtitle' }, `${u.stat}: ${u.values[lvl]}${u.unit}${lvl < 2 ? ` → ${u.values[lvl + 1]}${u.unit}` : ''}`), levelDots(lvl, 2)),
          btn,
        ),
      );
    }
  };
  render();
  sheet(app, 'Lighthouse', h('p', { class: 'subtitle' }, app.save.buildings.chandlery ? 'The chandlery takes 10% off.' : 'Every night can be kept without upgrades.'), list);
}

/** All 40 nights with their stars; replay any night already reached. */
export function openNights(app: App): void {
  const grid = h('div', { class: 'night-grid' });
  for (let n = 1; n <= NIGHT_COUNT; n++) {
    const rec = app.save.nights[n];
    const open = nightUnlocked(app.save, n);
    const b = h('button', { class: `night-cell${open ? '' : ' locked'}${n === 21 ? ' chart2' : ''}`, disabled: !open, 'aria-label': `Night ${n}` }, h('b', {}, String(n)), h('span', { class: 'cell-stars' }, '★'.repeat(rec?.stars ?? 0) + '☆'.repeat(3 - (rec?.stars ?? 0))));
    b.addEventListener('click', () => app.playNight(n));
    grid.append(b);
  }
  sheet(app, 'Nights', h('p', { class: 'subtitle' }, 'Home Bay: nights 1–20 · The Skerries: nights 21–40'), grid);
}

function levelDots(level: number, max: number = TUNING.MAX_LEVEL): HTMLElement {
  const d = h('div', { class: 'dots' });
  for (let k = 0; k < max; k++) d.append(h('span', { class: k < level ? 'on' : '' }));
  return d;
}

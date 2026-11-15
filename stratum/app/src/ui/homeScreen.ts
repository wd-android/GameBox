import { APP } from '../config/app';
import { TUNING } from '../config/tuning';
import { sound } from '../audio/sound';
import { currentStreak, dailyPlayed, freePourUnlocked, highestUnlocked } from '../game/progress';
import { dateKey, dailyJarFor, matchJar } from '../jars/jars';
import { maskFor, SHAPES, type ShapeId } from '../jars/shapes';
import { decodeGrid } from '../sand/rle';
import { jarThumb } from '../render/outline';
import type { App, Screen } from './app';
import { corkIcon, h, ICONS, iconButton } from './dom';

/** Home is the shelf (§9, §10): kept jars, Next jar, Daily Jar, Free Pour, Sets, Settings. */
export class HomeScreen implements Screen {
  el: HTMLElement;

  constructor(private app: App) {
    this.el = this.build();
  }

  private build(): HTMLElement {
    const app = this.app;
    const save = app.save;
    const today = dateKey();
    const streak = currentStreak(save, today);

    const top = h(
      'div',
      { class: 'topbar' },
      h('h1', { class: 'title' }, APP.DISPLAY_NAME),
      h('div', { class: 'spacer' }),
      h('div', { class: 'chip', 'aria-label': `${save.corks} corks` }, h('span', { html: corkIcon() }), String(save.corks)),
      h('div', { class: 'chip', 'aria-label': `Streak ${streak}` }, '🔥', String(streak)),
      iconButton(ICONS.gear, 'Settings', () => app.openSettings(() => app.goHomeKeepingProgress())),
    );

    const shelf = h('div', { class: 'shelf' });
    const label = getComputedStyle(document.documentElement).getPropertyValue('--label').trim() || '#fff';
    const jarW = Math.max(36, Math.min(52, (window.innerWidth - 60) / 7));

    const kept = Object.entries(save.jars)
      .filter(([, r]) => r.kept)
      .map(([id, r]) => ({ id: Number(id), rec: r }))
      .sort((a, b) => a.id - b.id);

    if (save.decorations.length) shelf.append(h('div', { style: 'font-size:22px;text-align:center;margin-bottom:6px' }, save.decorations.join(' ')));
    shelf.append(h('h3', {}, `Your jars · ${kept.length}/${TUNING.MATCH_JAR_COUNT}`));
    if (!kept.length) shelf.append(h('div', { class: 'empty-shelf' }, 'Finished jars are corked and kept here.'));
    const perRow = Math.max(4, Math.floor((window.innerWidth - 56) / (jarW + 6)));
    for (let i = 0; i < kept.length; i += perRow) {
      const plank = h('div', { class: 'plank' });
      for (const { id, rec } of kept.slice(i, i + perRow)) {
        const jar = matchJar(id);
        const m = maskFor(jar.shape);
        const c = jarThumb(jar.shape, decodeGrid(rec.kept, m.w * m.h), jarW, { patterns: save.settings.patterns, cork: true, label });
        const item = h('button', { class: 'shelf-jar', 'aria-label': `${jar.title}, ${rec.stars} stars` }, h('div', { class: 'mini-stars' }, '★'.repeat(rec.stars) + (rec.freehand ? '✎' : '')), c, h('span', {}, String(id)));
        item.addEventListener('click', () => {
          sound.tap();
          this.openJar(id);
        });
        plank.append(item);
      }
      shelf.append(plank, h('div', { class: 'plank-board' }));
    }

    if (save.free.length) {
      shelf.append(h('h3', {}, `Free Pour · ${save.free.length}/${TUNING.FREE_POUR_KEEP_MAX}`));
      for (let i = 0; i < save.free.length; i += perRow) {
        const plank = h('div', { class: 'plank' });
        save.free.slice(i, i + perRow).forEach((f, k) => {
          const m = maskFor(f.shape);
          const c = jarThumb(f.shape, decodeGrid(f.grid, m.w * m.h), jarW, { patterns: save.settings.patterns, cork: true, label });
          const item = h('button', { class: 'shelf-jar', 'aria-label': 'Free Pour jar' }, h('div', { class: 'mini-stars' }), c, h('span', {}, '✦'));
          item.addEventListener('click', () => this.openFree(i + k));
          plank.append(item);
        });
        shelf.append(plank, h('div', { class: 'plank-board' }));
      }
    }

    const next = highestUnlocked(save);
    const allDone = Object.keys(save.jars).length >= TUNING.MATCH_JAR_COUNT && (save.jars[TUNING.MATCH_JAR_COUNT]?.stars ?? 0) > 0;
    const p = save.inProgress;
    const resumeLabel = p && p.mode === 'match' ? `Continue jar ${p.jarId}` : allDone ? 'Replay a jar' : `Next jar · ${next}`;
    const nextBtn = h('button', { class: 'btn primary' }, resumeLabel);
    nextBtn.addEventListener('click', () => {
      sound.unlock();
      sound.tap();
      if (p && p.mode === 'match') app.playMatch(p.jarId);
      else if (allDone) app.openSets();
      else app.playMatch(next);
    });

    const played = dailyPlayed(save, today);
    const daily = this.tile('Daily Jar', played ? 'Done today ✓' : streak ? `Keep your ${streak}-day streak` : 'A new jar every day', () => {
      if (played) this.openDaily();
      else app.playDaily();
    });
    if (!played) daily.classList.add('glow');

    const freeOk = freePourUnlocked(save);
    const free = this.tile('Free Pour', freeOk ? 'No target, all colours' : `Unlocks after jar ${TUNING.FREE_POUR_UNLOCK_AFTER_JAR}`, () => {
      if (freeOk) app.openFreePicker();
    });
    if (!freeOk) free.classList.add('locked');

    const sets = this.tile('Sets', `${save.setsDone.length} of 8 complete`, () => app.openSets());
    const shop = this.tile('Decorate', 'Backdrops, lights, labels', () => app.openShop(() => app.goHomeKeepingProgress()));

    return h(
      'div',
      { class: 'screen' },
      top,
      h('div', { class: 'shelf-wrap' }, shelf),
      h('div', { class: 'home-actions' }, nextBtn, daily, free, sets, shop),
    );
  }

  private tile(title: string, sub: string, fn: () => void): HTMLButtonElement {
    const b = h('button', { class: 'tile' }, title, h('small', {}, sub));
    b.addEventListener('click', () => {
      sound.unlock();
      sound.tap();
      fn();
    });
    return b;
  }

  private sheet(content: HTMLElement[], actions: HTMLElement[]): HTMLElement {
    const overlay = h('div', { class: 'overlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.append(h('div', { class: 'sheet card result' }, ...content, h('div', { class: 'result-actions' }, ...actions)));
    this.app.ui.append(overlay);
    return overlay;
  }

  private bigJar(shape: ShapeId, grid: string): HTMLCanvasElement {
    const m = maskFor(shape);
    const label = getComputedStyle(document.documentElement).getPropertyValue('--label').trim() || '#fff';
    return jarThumb(shape, decodeGrid(grid, m.w * m.h), Math.min(150, window.innerWidth * 0.38), { patterns: this.app.save.settings.patterns, cork: true, label });
  }

  private openJar(id: number): void {
    const rec = this.app.save.jars[id];
    const jar = matchJar(id);
    let overlay: HTMLElement | null = null;
    const again = h('button', { class: 'btn primary' }, 'Pour again');
    again.addEventListener('click', () => {
      overlay?.remove();
      this.app.save.inProgress = null;
      this.app.playMatch(id);
    });
    const close = h('button', { class: 'btn ghost' }, 'Close');
    close.addEventListener('click', () => overlay?.remove());
    overlay = this.sheet(
      [
        h('h2', { class: 'title', style: 'font-size:24px' }, jar.title, rec.freehand ? h('span', { class: 'freehand' }, 'FREEHAND') : null),
        this.bigJar(jar.shape, rec.kept),
        h('div', { class: 'big-number', style: 'font-size:34px' }, `${Math.round(rec.best * 100)}%`),
        h('div', { class: 'stars', style: 'font-size:28px' }, ...[0, 1, 2].map((i) => h('span', { class: `star${i < rec.stars ? ' lit' : ''}` }, '★'))),
        h('div', { class: 'subtitle' }, `Jar ${id} · ${SHAPES[jar.shape].name}`),
      ],
      [again, close],
    );
  }

  private openFree(index: number): void {
    const f = this.app.save.free[index];
    let overlay: HTMLElement | null = null;
    const remove = h('button', { class: 'btn secondary' }, 'Remove');
    remove.addEventListener('click', () => {
      this.app.save.free.splice(index, 1);
      this.app.persist();
      overlay?.remove();
      this.app.goHomeKeepingProgress();
    });
    const close = h('button', { class: 'btn ghost' }, 'Close');
    close.addEventListener('click', () => overlay?.remove());
    overlay = this.sheet([h('h2', { class: 'title', style: 'font-size:24px' }, 'Free Pour'), this.bigJar(f.shape, f.grid), h('div', { class: 'subtitle' }, new Date(f.made).toLocaleDateString())], [remove, close]);
  }

  private openDaily(): void {
    const today = dateKey();
    const rec = this.app.save.daily.history[today];
    const jar = dailyJarFor(today);
    let overlay: HTMLElement | null = null;
    const close = h('button', { class: 'btn primary' }, 'See you tomorrow');
    close.addEventListener('click', () => overlay?.remove());
    overlay = this.sheet(
      [
        h('h2', { class: 'title', style: 'font-size:24px' }, 'Daily Jar'),
        this.bigJar(jar.shape, rec.grid),
        h('div', { class: 'big-number', style: 'font-size:34px' }, `${Math.round(rec.acc * 100)}%`),
        h('div', { class: 'stars', style: 'font-size:28px' }, ...[0, 1, 2].map((i) => h('span', { class: `star${i < rec.stars ? ' lit' : ''}` }, '★'))),
        h('div', { class: 'subtitle' }, `Streak: ${this.app.save.daily.streak} 🔥 · one scored pour per day`),
      ],
      [close],
    );
  }

  destroy(): void {
    this.el.remove();
  }
}

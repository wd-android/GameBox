import { APP } from '../config/app';
import { BALLS, BALL_ORDER } from '../config/tuning';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { LEVELS, BALL_UNLOCK_LEVEL, dailyFor } from '../game/levels';
import { ballUnlocked, buyMaterial, currentStreak, dateKey, highestUnlocked, levelDone, totalStars, unlockedSizes } from '../game/progress';
import { cubeCode, parseCubeCode } from '../maze/generator';
import { MATERIALS, MATERIAL_ORDER } from '../render/materials';
import type { App, Screen } from './app';
import { h, ICONS, iconButton, toast } from './dom';
import { openSettings } from './settingsSheet';
import { formatTime } from './playScreen';

function coinIcon(): string {
  return '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="#ffc93c"/><circle cx="10" cy="10" r="5.5" fill="none" stroke="#c98a10" stroke-width="1.6"/></svg>';
}

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
      h('div', { class: 'chip', 'aria-label': `${save.coins} coins` }, h('span', { html: coinIcon() }), String(save.coins)),
      h('div', { class: 'chip', 'aria-label': 'Stars' }, '★', String(totalStars(save))),
      h('div', { class: 'chip', 'aria-label': 'Streak' }, '🔥', String(streak)),
      h('div', { class: 'spacer' }),
      iconButton(ICONS.gear, 'Settings', () => openSettings(app, () => app.goHome())),
    );

    const hero = h('div', { class: 'hero' }, h('div', { class: 'hero-cube', html: cubeArt() }), h('h1', { class: 'title hero-title' }, APP.DISPLAY_NAME), h('div', { class: 'subtitle' }, 'Roll the ball across all six faces'));

    const next = highestUnlocked(save);
    const p = save.inProgress;
    const allDone = levelDone(save, LEVELS.length);
    const label = p && p.kind === 'journey' ? `Continue level ${p.levelId}` : allDone ? 'Journey complete' : `Play · Level ${next}`;
    const play = h('button', { class: 'btn primary' }, label);
    play.addEventListener('click', () => {
      sound.unlock();
      sound.tap();
      if (p && p.kind === 'journey') app.playLevel(p.levelId!);
      else if (allDone) app.openJourney();
      else app.playLevel(next);
    });

    const d = dailyFor(today);
    const dRec = save.daily.history[today];
    const daily = this.tile('Daily Cube', dRec ? `Best ${formatTime(dRec.best)} · ${d.n}×${d.n}` : `Today: ${d.n}×${d.n} · new every day`, () => app.playDaily());
    if (!dRec) daily.classList.add('glow');
    const journey = this.tile('Journey', `${Math.min(next, LEVELS.length)} of ${LEVELS.length} levels`, () => app.openJourney());
    const explore = this.tile('Explore', 'Any size · no timer · no holes', () => this.openExplore());
    const ball = this.tile('Ball', `${BALLS[save.ball].name}`, () => this.openBalls());
    ball.prepend(h('span', { class: `ball-dot ${save.ball}`, style: 'margin-bottom:4px' }));
    const mat = this.tile('Cube', MATERIALS[save.material].name, () => this.openMaterials());

    return h('div', { class: 'screen' }, top, hero, h('div', { class: 'home-actions' }, play, journey, daily, explore, ball, mat));
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

  private sheet(...content: (HTMLElement | null)[]): HTMLElement {
    const overlay = h('div', { class: 'overlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.append(h('div', { class: 'sheet card' }, ...content));
    this.app.ui.append(overlay);
    return overlay;
  }

  private openBalls(): void {
    const save = this.app.save;
    let overlay: HTMLElement;
    const list = h('div', { class: 'choice-list' });
    for (const id of BALL_ORDER) {
      const b = BALLS[id];
      const open = ballUnlocked(save, id);
      const btn = h(
        'button',
        { class: `choice${save.ball === id ? ' selected' : ''}${open ? '' : ' locked'}` },
        h('span', { class: `ball-dot big ${id}` }),
        h('span', { class: 'choice-text' }, h('b', {}, `${b.name} ball`), h('small', {}, open ? `Speed ×${b.speedFactor} · score ×${b.scoreFactor}` : `Unlocks at level ${BALL_UNLOCK_LEVEL[id]}`)),
      );
      btn.addEventListener('click', () => {
        if (!open) {
          sound.tap();
          haptic.double();
          return;
        }
        save.ball = id;
        this.app.persist();
        overlay.remove();
        this.app.goHome();
      });
      list.append(btn);
    }
    overlay = this.sheet(h('h2', { class: 'title', style: 'text-align:center' }, 'Choose a ball'), h('div', { class: 'subtitle', style: 'text-align:center' }, 'Faster balls score more and have shorter par times. Every ball earns its own medal.'), list);
  }

  private openMaterials(): void {
    const save = this.app.save;
    let overlay: HTMLElement;
    const list = h('div', { class: 'choice-list' });
    for (const id of MATERIAL_ORDER) {
      const m = MATERIALS[id];
      const owned = save.materials.includes(id);
      const btn = h(
        'button',
        { class: `choice${save.material === id ? ' selected' : ''}` },
        h('span', { class: 'swatch-sq', style: `background:${m.swatch}` }),
        h('span', { class: 'choice-text' }, h('b', {}, m.name), h('small', {}, owned ? (save.material === id ? 'In use' : 'Owned') : `${m.price} coins`)),
      );
      btn.addEventListener('click', () => {
        if (!buyMaterial(save, id)) {
          haptic.double();
          toast(`Need ${m.price - save.coins} more coins`);
          return;
        }
        save.material = id;
        sound.tap();
        this.app.persist();
        overlay.remove();
        this.app.goHome();
      });
      list.append(btn);
    }
    overlay = this.sheet(h('h2', { class: 'title', style: 'text-align:center' }, 'Cube material'), list);
  }

  private openExplore(): void {
    const save = this.app.save;
    let overlay: HTMLElement;
    const sizes = h('div', { class: 'size-row' });
    for (const n of unlockedSizes(save)) {
      const b = h('button', { class: 'btn secondary size-btn' }, `${n}×${n}`);
      b.addEventListener('click', () => {
        overlay.remove();
        this.app.playExplore(n, (Math.random() * 1e6) | 0);
      });
      sizes.append(b);
    }
    const input = h('input', { class: 'code-input', placeholder: 'e.g. 1-5-48213', inputmode: 'numeric', 'aria-label': 'Cube code' }) as HTMLInputElement;
    const go = h('button', { class: 'btn primary' }, 'Play code');
    go.addEventListener('click', () => {
      const c = parseCubeCode(input.value);
      if (!c) {
        toast('That is not a cube code');
        return;
      }
      overlay.remove();
      this.app.playExplore(c.n, c.seed);
    });
    overlay = this.sheet(
      h('h2', { class: 'title', style: 'text-align:center' }, 'Explore'),
      h('div', { class: 'subtitle', style: 'text-align:center' }, 'A random cube in any unlocked size. No timer, no holes.'),
      sizes,
      h('div', { class: 'row' }, input, go),
      h('div', { class: 'subtitle', style: 'text-align:center;font-size:12px' }, `Every cube has a code like ${cubeCode(5, 48213)} to share.`),
    );
  }

  destroy(): void {
    this.el.remove();
  }
}

function cubeArt(): string {
  return `<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
  <defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9259fe"/><stop offset="1" stop-color="#5b33a0"/></linearGradient>
  <linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#482585"/><stop offset="1" stop-color="#270951"/></linearGradient>
  <linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b33a0"/><stop offset="1" stop-color="#1b043b"/></linearGradient></defs>
  <path d="M60 10 104 34 60 58 16 34Z" fill="url(#t)"/><path d="M16 34 60 58v52L16 86Z" fill="url(#l)"/><path d="M104 34 60 58v52l44-24Z" fill="url(#r)"/>
  <path d="M38 22 82 46M27 28l44 24M49 16l22 12M60 22 38 34m33-6L49 40" stroke="#f1ecff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".9"/>
  <path d="M16 52l22 12M38 64v22M60 76 82 64v22M82 64l22-12" stroke="#f1ecff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>
  <circle cx="66" cy="36" r="5" fill="#ffc93c"/><path d="M93 40 104 34" stroke="#06ffff" stroke-width="4" stroke-linecap="round"/></svg>`;
}

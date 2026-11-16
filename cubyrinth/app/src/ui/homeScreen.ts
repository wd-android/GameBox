import { STRINGS as S } from '../config/strings';
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
      h('div', { class: 'chip', 'aria-label': S.home.coinsLabel(save.coins) }, h('span', { html: coinIcon() }), String(save.coins)),
      h('div', { class: 'chip', 'aria-label': S.home.starsLabel }, '★', String(totalStars(save))),
      h('div', { class: 'chip', 'aria-label': S.home.streakLabel }, '🔥', String(streak)),
      h('div', { class: 'spacer' }),
      iconButton(ICONS.gear, S.common.settings, () => openSettings(app, () => app.goHome())),
    );

    const hero = h('div', { class: 'hero' }, h('div', { class: 'hero-cube', html: cubeArt() }), h('h1', { class: 'title hero-title' }, APP.DISPLAY_NAME), h('div', { class: 'subtitle' }, S.home.tagline));

    const next = highestUnlocked(save);
    const p = save.inProgress;
    const allDone = levelDone(save, LEVELS.length);
    const label = p && p.kind === 'journey' ? S.home.continueLevel(p.levelId!) : allDone ? S.home.journeyComplete : S.home.playLevel(next);
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
    const daily = this.tile(S.common.dailyCube, dRec ? S.home.dailyBest(formatTime(dRec.best), d.n) : S.home.dailyToday(d.n), () => app.playDaily());
    if (!dRec) daily.classList.add('glow');
    const journey = this.tile(S.common.journey, S.home.journeyProgress(LEVELS.filter((l) => levelDone(save, l.id)).length, LEVELS.length), () => app.openJourney());
    const explore = this.tile(S.common.explore, S.home.exploreSub, () => this.openExplore());
    const ball = this.tile(S.home.ballTile, BALLS[save.ball].name, () => this.openBalls());
    ball.prepend(h('span', { class: `ball-dot ${save.ball}`, style: 'margin-bottom:4px' }));
    const mat = this.tile(S.home.cubeTile, MATERIALS[save.material].name, () => this.openMaterials());

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
        h('span', { class: 'choice-text' }, h('b', {}, S.ballSheet.ballName(b.name)), h('small', {}, open ? S.ballSheet.stats(b.speedFactor, b.scoreFactor) : S.ballSheet.unlocksAt(BALL_UNLOCK_LEVEL[id]))),
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
    overlay = this.sheet(h('h2', { class: 'title', style: 'text-align:center' }, S.ballSheet.title), h('div', { class: 'subtitle', style: 'text-align:center' }, S.ballSheet.intro), list);
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
        h('span', { class: 'choice-text' }, h('b', {}, m.name), h('small', {}, owned ? (save.material === id ? S.materialSheet.inUse : S.materialSheet.owned) : S.materialSheet.price(m.price))),
      );
      btn.addEventListener('click', () => {
        if (!buyMaterial(save, id)) {
          haptic.double();
          toast(S.materialSheet.needCoins(m.price - save.coins));
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
    overlay = this.sheet(h('h2', { class: 'title', style: 'text-align:center' }, S.materialSheet.title), list);
  }

  private openExplore(): void {
    const save = this.app.save;
    let overlay: HTMLElement;
    const sizes = h('div', { class: 'size-row' });
    for (const n of unlockedSizes(save)) {
      const b = h('button', { class: 'btn secondary size-btn' }, S.size(n));
      b.addEventListener('click', () => {
        overlay.remove();
        this.app.playExplore(n, (Math.random() * 1e6) | 0);
      });
      sizes.append(b);
    }
    const input = h('input', { class: 'code-input', placeholder: S.explore.codePlaceholder(cubeCode(5, 48213)), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': S.explore.codeLabel }) as HTMLInputElement;
    const go = h('button', { class: 'btn primary' }, S.explore.playCode);
    go.addEventListener('click', () => {
      const c = parseCubeCode(input.value);
      if (!c) {
        toast(S.explore.notACode);
        return;
      }
      // Explore is for unlocked sizes only (§9.3), codes included.
      if (!unlockedSizes(save).includes(c.n)) {
        toast(c.n > 6 ? S.explore.sizeNotInVersion(c.n) : S.explore.sizeLocked(c.n));
        return;
      }
      overlay.remove();
      this.app.playExplore(c.n, c.seed);
    });
    overlay = this.sheet(
      h('h2', { class: 'title', style: 'text-align:center' }, S.common.explore),
      h('div', { class: 'subtitle', style: 'text-align:center' }, S.explore.intro),
      sizes,
      h('div', { class: 'row' }, input, go),
      h('div', { class: 'subtitle', style: 'text-align:center;font-size:12px' }, S.explore.shareHint(cubeCode(5, 48213))),
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

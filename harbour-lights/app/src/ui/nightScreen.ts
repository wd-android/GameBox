import { TUNING } from '../config/tuning';
import { NightSim, type NightResult } from '../sim/night';
import { BeamInput } from '../input/control';
import { SeaView } from '../render/seaView';
import { finishTutorial, recordNight, type NightOutcome } from '../game/progress';
import { NIGHT_COUNT, type NightDef } from '../nights/nights';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import type { App, Screen } from './app';
import { h, ICONS, iconButton, toast } from './dom';
import { openPause } from './sheets';

const STEP = 1000 * TUNING.TICK;

/** A night (§10): the sea fills the screen; night number, boats remaining, strikes and pause at the top. */
export class NightScreen implements Screen {
  el: HTMLElement;
  private sim: NightSim;
  private view: SeaView;
  private input: BeamInput;
  private accum = 0;
  private paused = false;
  private ended = false;
  private endTimer = 0;
  private hand: HTMLElement | null = null;
  private remainingEl!: HTMLElement;
  private strikeEls: HTMLElement[] = [];
  private onFrame = () => this.frame();
  private onResize = () => this.layout();
  private listeners: [string, EventListener][] = [];
  private tutorial: boolean;

  constructor(
    private app: App,
    private def: NightDef,
  ) {
    this.tutorial = def.n === 0;
    this.sim = new NightSim(def, app.save.upgrades);
    this.view = new SeaView(this.sim);
    app.pixi.stage.removeChildren();
    app.pixi.stage.addChild(this.view.root);
    this.input = new BeamInput(this.sim.beam, (x, y) => this.view.toWorld(x, y));
    this.applySettings();
    this.layout();
    this.el = this.buildHud();
    this.bindInput();
    window.addEventListener('resize', this.onResize);
    app.pixi.ticker.add(this.onFrame);
    app.pixi.ticker.start();
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { night: NightScreen }).night = this;
  }

  /** The beam-control setting takes effect at once (§7, acceptance 2). */
  applySettings(): void {
    const s = this.app.save.settings;
    this.input.mode = s.control;
    this.input.sensitivity = s.sensitivity;
    this.view.reducedMotion = s.reduceMotion;
    if (this.hand) this.hand.querySelector('.hand-text')!.textContent = this.handText();
    this.hand?.classList.toggle('touch', s.control === 'touch');
  }

  private safeBottom(): number {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
  }

  private layout(): void {
    this.view.layout(window.innerWidth, window.innerHeight, this.safeBottom());
  }

  private handText(): string {
    return this.app.save.settings.control === 'drag' ? 'Drag sideways to turn the light' : 'Touch the sea to aim the light';
  }

  private buildHud(): HTMLElement {
    this.remainingEl = h('span', {}, String(this.sim.remaining));
    const strikes = h('div', { class: 'strikes', 'aria-label': 'Boats lost' });
    for (let k = 0; k < TUNING.STRIKES; k++) {
      const s = h('span', { class: 'strike' });
      this.strikeEls.push(s);
      strikes.append(s);
    }
    const title = this.tutorial ? this.def.title ?? 'First light' : `Night ${this.def.n}`;
    const top = h(
      'div',
      { class: 'topbar hit' },
      iconButton(ICONS.pause, 'Pause', () => this.pause()),
      h('div', { class: 'chip night-chip' }, title),
      h('div', { class: 'spacer' }),
      h('div', { class: 'chip', 'aria-label': 'Boats remaining' }, boatIcon(), this.remainingEl),
      strikes,
    );
    const el = h('div', { class: 'screen passthrough night' }, top);
    if (this.tutorial || this.def.n === 1) {
      this.hand = h('div', { class: 'hand-hint sideways' }, h('div', { class: 'hand-icon' }, '👆'), h('div', { class: 'hand-text' }, this.handText()));
      el.append(this.hand);
    }
    return el;
  }

  private bindInput(): void {
    const c = this.app.pixi.canvas;
    const on = (type: string, fn: (e: PointerEvent) => void) => {
      const l = fn as EventListener;
      c.addEventListener(type, l);
      this.listeners.push([type, l]);
    };
    on('pointerdown', (e) => {
      sound.unlock();
      if (this.paused || this.ended) return;
      c.setPointerCapture?.(e.pointerId);
      this.input.down(e.pointerId, e.clientX, e.clientY);
    });
    on('pointermove', (e) => this.input.move(e.pointerId, e.clientX, e.clientY));
    on('pointerup', (e) => this.input.up(e.pointerId));
    on('pointercancel', (e) => this.input.up(e.pointerId));
  }

  private frame(): void {
    const dt = Math.min(100, this.app.pixi.ticker.deltaMS);
    const sim = this.sim;
    let turned = 0;
    if (!this.paused && !sim.over) {
      this.accum += dt;
      let n = 0;
      const before = sim.beam.angle;
      while (this.accum >= STEP && n < 8 && !sim.over) {
        sim.step();
        this.handleEvents();
        this.accum -= STEP;
        n++;
      }
      if (n === 8) this.accum = 0;
      turned = Math.abs(sim.beam.angle - before) / (dt / 1000 || 1);
    }
    sound.setBeam(turned, !this.paused && !sim.over);
    if (this.hand && this.input.moved) {
      this.hand.classList.add('gone');
      const hand = this.hand;
      this.hand = null;
      window.setTimeout(() => hand.remove(), 400);
    }
    this.remainingEl.textContent = String(sim.remaining);
    this.strikeEls.forEach((s, i) => s.classList.toggle('on', i < sim.strikes));
    if (sim.over && !this.ended) {
      this.ended = true;
      this.endTimer = 0;
    }
    if (this.ended) {
      this.endTimer += dt / 1000;
      this.view.dawnAmount = Math.min(1, this.endTimer / 1.6);
      if (this.endTimer >= 1.6 && this.endTimer - dt / 1000 < 1.6) this.finish();
    }
    this.view.render(dt / 1000);
  }

  private handleEvents(): void {
    for (const e of this.sim.events) {
      switch (e.type) {
        case 'warning':
          sound.arrive();
          break;
        case 'lit':
          sound.bell();
          haptic.tick();
          break;
        case 'danger':
          sound.foghorn();
          haptic.double();
          break;
        case 'close':
          sound.splash();
          haptic.tick();
          break;
        case 'landed':
          sound.landed();
          haptic.tick();
          break;
        case 'wrecked':
        case 'lost':
          sound.wrecked();
          haptic.firm();
          break;
      }
    }
    this.view.onEvents(this.sim.events);
  }

  private finish(): void {
    const r = this.sim.result();
    sound.setBeam(0, false);
    sound.dawn(r.stars);
    for (let k = 0; k < Math.max(1, r.stars); k++) window.setTimeout(() => haptic.tick(), 250 * k);
    const save = this.app.save;
    if (this.tutorial) {
      save.coins += r.total;
      if (r.landed < this.sim.schedule.length) {
        toast('Keep the light on a boat until it turns for home. Try again!', 2600);
        window.setTimeout(() => this.app.playTutorial(), 1200);
        return;
      }
      if (save.tutorial === 0) {
        save.tutorial = 1;
        this.app.persist();
        toast('Well done! Now two boats at once.', 2200);
        window.setTimeout(() => this.app.playTutorial(), 1400);
        return;
      }
      finishTutorial(save);
      this.app.persist();
      this.app.goHome();
      window.setTimeout(() => toast('Your first catch built the fish market!', 3200), 300);
      return;
    }
    const outcome = recordNight(save, this.def.n, r);
    this.app.persist();
    this.showResult(r, outcome);
  }

  private showResult(r: NightResult, o: NightOutcome): void {
    const stars = h('div', { class: 'stars', 'aria-label': `${r.stars} stars` });
    for (let k = 0; k < 3; k++) {
      const s = h('span', { class: 'star' }, '★');
      stars.append(s);
      window.setTimeout(() => s.classList.toggle('lit', k < r.stars), 300 + 250 * k);
    }
    const rows: [string, string][] = [
      ['Boats landed', `${r.landed} of ${this.sim.schedule.length}`],
      ['Catch', `${r.catch}`],
    ];
    if (r.closeCalls) rows.push([`Close calls (${r.closeCalls})`, `+${r.closeCallCoins}`]);
    if (r.bonus) rows.push(['Clean night bonus', `+${r.bonus}`]);
    const table = h('div', { class: 'result-table' }, ...rows.map(([a, b]) => h('div', { class: 'row' }, h('span', {}, a), h('b', {}, b))));
    const total = h('div', { class: 'total' }, coinIcon(), `+${r.total}`);
    const overlay = h('div', { class: 'overlay' });
    const btn = (label: string, cls: string, fn: () => void) => {
      const b = h('button', { class: `btn ${cls}` }, label);
      b.addEventListener('click', () => {
        sound.tap();
        fn();
      });
      return b;
    };
    let req: HTMLElement | null = null;
    if (o.request) {
      const q = o.request;
      req = h(
        'div',
        { class: `request-card${q.completed ? ' done' : ''}` },
        h('small', {}, q.request.who),
        h('b', {}, q.request.text),
        h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${(100 * q.progress) / q.request.target}%` })),
        h('span', { class: 'subtitle' }, q.completed ? `Done! +${q.request.reward} coins` : `${q.progress} of ${q.request.target}`),
      );
    }
    const actions = h('div', { class: 'result-actions' });
    if (!r.failed && this.def.n < NIGHT_COUNT) actions.append(btn(`Night ${this.def.n + 1}`, 'primary wide', () => this.app.playNight(this.def.n + 1)));
    actions.append(btn(r.failed ? 'Try again' : 'Replay', r.failed ? 'primary wide' : 'secondary', () => this.app.playNight(this.def.n)));
    actions.append(btn('Town', 'ghost', () => this.app.goHome()));
    overlay.append(
      h(
        'div',
        { class: 'sheet card result' },
        h('h2', { class: 'title' }, r.failed ? 'The night was lost' : 'Dawn breaks'),
        h('p', { class: 'subtitle' }, r.failed ? 'Three boats were lost. The catch landed is kept; play again to go on.' : `Night ${this.def.n} kept${o.newBest ? ' · new best' : ''}`),
        stars,
        table,
        total,
        req,
        actions,
      ),
    );
    this.app.ui.append(overlay);
  }

  private pause(): void {
    if (this.ended) return;
    this.paused = true;
    openPause(this.app, {
      onResume: () => {
        this.paused = false;
        this.accum = 0;
      },
      onQuit: () => this.app.goHome(),
    });
  }

  background(): void {
    if (!this.ended && !this.paused) this.pause();
  }

  destroy(): void {
    this.app.pixi.ticker.remove(this.onFrame);
    window.removeEventListener('resize', this.onResize);
    for (const [t, l] of this.listeners) this.app.pixi.canvas.removeEventListener(t, l);
    sound.setBeam(0, false);
    sound.resetStreak();
    this.view.destroy();
    this.el.remove();
  }
}

export function coinIcon(): HTMLElement {
  return h('span', { class: 'coin', 'aria-hidden': 'true' });
}

function boatIcon(): HTMLElement {
  return h('span', { class: 'boat-icon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 20 14" width="20" height="14"><path d="M1 7h18l-3 6H4z" fill="#ffd27a"/><path d="M9 1v6h6z" fill="#fff"/></svg>' });
}

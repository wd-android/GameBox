import { TUNING } from '../config/tuning';
import { Flight } from '../sim/flight';
import { SteeringInput } from '../input/steering';
import { SkyView } from '../render/skyView';
import { SKIES, recordRun } from '../game/progress';
import { activeMissions, describe as describeMission, progress } from '../game/missions';
import type { Chunk } from '../world/chunk';
import chunksData from '../world/chunks/chunks.json';
import firstLaunchData from '../world/chunks/first-launch.json';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import type { App, Screen } from './app';
import { h, ICONS, iconButton, toast } from './dom';
import { openPause } from './pauseSheet';

const CHUNKS = chunksData as Chunk[];
const FIRST = firstLaunchData as Chunk[];
const STEP = 1000 / TUNING.TICK_HZ;

/** Flight (§9): the sky fills the screen; scores and flock size at the top; nothing in the lower third. */
export class FlightScreen implements Screen {
  el: HTMLElement;
  private flight: Flight;
  private view: SkyView;
  private steer: SteeringInput;
  private bankedEl!: HTMLElement;
  private unbankedEl!: HTMLElement;
  private flockEl!: HTMLElement;
  private hand: HTMLElement | null = null;
  private accum = 0;
  private paused = false;
  private ended = false;
  private firstLaunch: boolean;
  private shownTreeTip = false;
  private onFrame = () => this.frame();
  private onResize = () => this.view.layout(window.innerWidth, window.innerHeight);

  constructor(private app: App) {
    const save = app.save;
    this.firstLaunch = !save.firstLaunchDone;
    this.flight = new Flight({
      species: save.species,
      seed: (Math.random() * 2 ** 31) | 0,
      chunks: CHUNKS,
      runsPlayed: save.runsPlayed,
      firstLaunch: this.firstLaunch,
      scripted: this.firstLaunch ? FIRST : undefined,
    });
    this.view = new SkyView(app.pixi);
    this.view.reducedMotion = save.settings.reduceMotion;
    this.view.setSky((SKIES.find((s) => s.id === save.sky) ?? SKIES[0]).stops);
    this.view.layout(window.innerWidth, window.innerHeight);
    this.view.tutorialTreeArrow = this.firstLaunch;
    app.pixi.stage.removeChildren();
    app.pixi.stage.addChild(this.view.root);

    // The steering setting takes effect when a run starts (§8).
    this.steer = new SteeringInput(save.settings.steering, app.pixi.canvas, (x, y) => this.view.toWorld(x, y, this.flight.camY), () => this.flight.leader);
    this.steer.onFirstTouch = () => {
      sound.unlock();
      this.hand?.remove();
      this.hand = null;
    };

    this.el = this.buildHud();
    window.addEventListener('resize', this.onResize);
    app.pixi.ticker.add(this.onFrame);
    app.pixi.ticker.start();
  }

  private buildHud(): HTMLElement {
    this.bankedEl = h('div', { class: 'banked' }, '0');
    this.unbankedEl = h('div', { class: 'unbanked' }, '+0');
    this.flockEl = h('div', { class: 'chip flock-chip' }, '🐦 8');
    const top = h(
      'div',
      { class: 'topbar hit' },
      iconButton(ICONS.pause, 'Pause', () => this.pause()),
      h('div', { class: 'scores' }, this.bankedEl, this.unbankedEl),
      h('div', { class: 'spacer' }),
      this.flockEl,
    );
    const el = h('div', { class: 'screen passthrough' }, top);
    if (this.firstLaunch || this.app.save.runsPlayed < 1) {
      const draw = this.app.save.settings.steering === 'draw';
      this.hand = h('div', { class: 'hand-hint' }, h('div', { class: 'hand-icon' }, '👆'), h('div', { class: 'hand-text' }, draw ? 'Draw a path for the flock' : 'Touch and steer'));
      el.append(this.hand);
    }
    return el;
  }

  private frame(): void {
    const dt = Math.min(100, this.app.pixi.ticker.deltaMS);
    const f = this.flight;
    if (!this.paused && !f.over) {
      this.accum += dt;
      let n = 0;
      while (this.accum >= STEP && n < 6 && !f.over) {
        f.step(this.steer.target());
        this.handleEvents();
        this.accum -= STEP;
        n++;
      }
      if (n === 6) this.accum = 0;
    }
    this.view.path = this.steer.path;
    this.view.drawing = this.steer.drawing;
    this.view.render(f, dt / 1000);
    sound.setFlock(f.n, !f.over && !this.paused);
    this.bankedEl.textContent = String(f.score);
    this.unbankedEl.textContent = `+${Math.floor(f.unbanked)}`;
    this.flockEl.textContent = `🐦 ${f.n}`;
    if (this.firstLaunch && !this.shownTreeTip && f.trees.some((t) => t.y - f.camY < TUNING.SKY_H - 2)) {
      this.shownTreeTip = true;
      toast('Circle the tree to bank your score', 3200);
    }
    if (f.over && !this.ended) this.runOver();
  }

  private handleEvents(): void {
    for (const e of this.flight.events) {
      switch (e.type) {
        case 'gathered':
          this.view.flash(e.at);
          sound.gather();
          haptic.tick();
          break;
        case 'lost':
          this.view.feathers(e.at, e.count);
          sound.flutter();
          haptic.firm();
          break;
        case 'hawkWarn':
          sound.hawkCry();
          haptic.double();
          break;
        case 'hawkLand':
          if (e.taken) sound.hawkStrike();
          break;
        case 'banked':
          this.view.sparks(e.tree);
          sound.bankChord();
          haptic.long();
          this.unbankedEl.classList.remove('fly');
          void this.unbankedEl.offsetWidth;
          this.unbankedEl.classList.add('fly');
          this.view.tutorialTreeArrow = false;
          break;
        case 'murmuration':
          sound.murmuration();
          haptic.rolling();
          toast(`Murmuration! +${e.birds * TUNING.MURMUR_POINTS_PER_BIRD}`, 1400);
          break;
        case 'nearMiss':
          break;
        case 'over':
          break;
      }
    }
  }

  // ── Run over and revive (§6.10) ───────────────────────────

  private runOver(): void {
    this.ended = true;
    const f = this.flight;
    sound.over();
    haptic.single();
    for (const b of f.birds) this.view.feathers(b, 1);
    const save = this.app.save;
    if (!f.revived && save.feathers >= TUNING.REVIVE_COST) this.offerRevive();
    else window.setTimeout(() => this.showResult(), 700);
  }

  private offerRevive(): void {
    const save = this.app.save;
    const overlay = h('div', { class: 'overlay revive' });
    const ring = h('div', { class: 'countdown' }, String(TUNING.REVIVE_OFFER_S));
    const yes = h('button', { class: 'btn primary wide' }, `Revive · ${TUNING.REVIVE_COST} 🪶`);
    const no = h('button', { class: 'btn ghost' }, 'No thanks');
    let left = TUNING.REVIVE_OFFER_S;
    const timer = window.setInterval(() => {
      left--;
      ring.textContent = String(left);
      if (left <= 0) close(false);
    }, 1000);
    const close = (revive: boolean) => {
      window.clearInterval(timer);
      overlay.remove();
      if (revive) {
        save.feathers -= TUNING.REVIVE_COST;
        this.app.persist();
        this.flight.revive();
        this.ended = false;
        this.view.reset();
        sound.tap();
      } else this.showResult();
    };
    yes.addEventListener('click', () => close(true));
    no.addEventListener('click', () => close(false));
    overlay.append(h('div', { class: 'sheet card result' }, h('h2', { class: 'title' }, 'Keep flying?'), ring, h('div', { class: 'subtitle' }, `Your unbanked +${Math.floor(this.flight.unbanked)} is kept. You have ${save.feathers} feathers.`), yes, no));
    this.app.ui.append(overlay);
  }

  private showResult(): void {
    const f = this.flight;
    const save = this.app.save;
    const before = activeMissions(save.completed);
    const report = { species: f.species.id, score: f.score, maxFlock: f.stats.maxFlock, hawksPassed: f.stats.hawksPassed, murmurations: f.stats.murmurations, gathered: f.stats.gathered, banks: f.stats.banks, seconds: f.t };
    const out = recordRun(save, report);
    save.firstLaunchDone = true;
    this.app.persist();

    const stat = (label: string, value: string) => h('div', { class: 'stat' }, h('small', {}, label), h('b', {}, value));
    const missions = h('div', { class: 'missions' });
    for (const m of before) {
      const done = out.completed.some((c) => c.id === m.id);
      const p = Math.min(m.goal, progress(m, report, save.totalGathered));
      missions.append(
        h(
          'div',
          { class: `mission${done ? ' done' : ''}` },
          h('span', {}, done ? '✓ ' : '', describeMission(m)),
          h('div', { class: 'bar' }, h('div', { style: `width:${(p / m.goal) * 100}%` })),
          done ? h('small', {}, `+${m.reward} 🪶`) : h('small', {}, `${p}/${m.goal}`),
        ),
      );
    }
    const again = h('button', { class: 'btn primary wide' }, 'Fly again');
    again.addEventListener('click', () => {
      sound.tap();
      this.app.fly();
    });
    const home = h('button', { class: 'btn ghost' }, 'Home');
    home.addEventListener('click', () => this.app.goHome());
    const notes: string[] = [];
    if (out.unlockedSpecies.length) notes.push(`New species: ${out.unlockedSpecies.join(', ')}!`);
    if (out.rankUp) notes.push('Rank up!');
    if (out.skyUnlocked) notes.push('A new sky is open: Northern lights');
    const lost = Math.floor(f.unbanked);
    const overlay = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'sheet card result' },
        h('h2', { class: 'title' }, f.overCause === 'hawk' ? 'Taken by a hawk' : 'The flock is gone'),
        h('div', { class: 'big-number' }, String(f.score)),
        out.newBest && f.score > 0 ? h('div', { class: 'subtitle best' }, 'New best!') : h('div', { class: 'subtitle' }, `Best ${save.best}`),
        lost > 0 ? h('div', { class: 'subtitle', style: 'font-size:12px' }, `${lost} unbanked points were lost – circle a roost tree to bank them.`) : null,
        h('div', { class: 'stats' }, stat('Gathered', String(f.stats.gathered)), stat('Biggest flock', String(f.stats.maxFlock)), stat('Feathers', `+${out.feathers + out.missionFeathers}`)),
        missions,
        ...notes.map((n) => h('div', { class: 'subtitle best' }, n)),
        again,
        home,
      ),
    );
    this.app.ui.append(overlay);
  }

  /** A run is not saved (§11), but leaving the app pauses it. */
  background(): void {
    if (!this.paused) this.pause();
  }

  private pause(): void {
    if (this.flight.over || this.paused) return;
    this.paused = true;
    openPause(this.app, {
      onResume: () => {
        this.paused = false;
        this.view.reducedMotion = this.app.save.settings.reduceMotion;
      },
      onQuit: () => {
        this.app.goHome();
      },
    });
  }

  destroy(): void {
    this.app.pixi.ticker.remove(this.onFrame);
    window.removeEventListener('resize', this.onResize);
    this.steer.dispose();
    sound.setFlock(0, false);
    this.view.reset();
    this.app.pixi.stage.removeChildren();
    this.el.remove();
  }
}

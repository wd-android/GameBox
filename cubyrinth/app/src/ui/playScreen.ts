import { STRINGS as S } from '../config/strings';
import { BALLS, TUNING } from '../config/tuning';
import { cubeCode, type Cube } from '../maze/generator';
import { FACE_NAMES } from '../maze/topology';
import { BallSim } from '../physics/sim';
import { CubeView } from '../render/cubeView';
import { ThumbInput } from '../input/thumb';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { codeCube, levelCube, type LevelDef } from '../game/levels';
import { Autopilot } from '../game/autopilot';
import type { InProgress, PlayKind } from '../state/save';
import type { App, Screen } from './app';
import { h, ICONS, iconButton } from './dom';
import { Minimap } from './minimap';
import { showResult } from './resultSheet';
import { openPause } from './pauseSheet';

export interface PlayConfig {
  kind: PlayKind;
  level?: LevelDef;
  n?: number;
  seed?: number;
  date?: string;
  resume?: InProgress;
}

const DT_MS = 1000 / TUNING.TICK_HZ;

/** Developer aid: `?autoplay` lets the automatic player steer, for demos and screenshots. */
const AUTOPLAY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('autoplay');

export function formatTime(s: number): string {
  // Whole tenths first, so 59.96 s reads 1:00.0 and not 0:60.0.
  const tenths = Math.round(s * 10);
  const m = Math.floor(tenths / 600);
  return `${m}:${((tenths - m * 600) / 10).toFixed(1).padStart(4, '0')}`;
}

/** Game states (§7.13) are kept by the simulation; this screen drives it, draws it and shows the HUD. */
export class PlayScreen implements Screen {
  el: HTMLElement;
  private cube: Cube;
  private sim: BallSim;
  private view: CubeView;
  private input: ThumbInput;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private accum = 0;
  private paused = false;
  private finishedAt = 0;
  private resultShown = false;
  private timerEl!: HTMLElement;
  private fallsEl!: HTMLElement;
  private hint: HTMLElement | null = null;
  private ring: HTMLElement;
  private ringDot: HTMLElement;
  private minimap: Minimap | null = null;
  private visited = new Set<number>();
  private onResize = () => this.view.resize();
  private pilot: Autopilot | null = null;

  constructor(
    private app: App,
    readonly cfg: PlayConfig,
  ) {
    const save = app.save;
    const ball = cfg.resume?.ball ?? save.ball;
    const control = cfg.resume?.control ?? save.settings.control;
    if (cfg.kind === 'journey') this.cube = levelCube(cfg.level!);
    else this.cube = codeCube(cfg.n!, cfg.seed!, cfg.kind !== 'explore');
    this.sim = new BallSim(this.cube, { ball: BALLS[ball], mode: control, reducedMotion: save.settings.reduceMotion });
    if (cfg.resume) this.sim.restore(cfg.resume.checkpoint, cfg.resume.timerTicks, cfg.resume.falls);
    this.visited.add(this.sim.face);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cube-canvas';
    app.stageEl.append(this.canvas);
    this.view = new CubeView(this.canvas);
    this.view.reducedMotion = save.settings.reduceMotion;
    this.view.showTrail = save.settings.trail;
    this.view.setBall(ball);
    this.view.build(this.cube, save.material);

    this.input = new ThumbInput(this.canvas);
    this.input.mode = control;
    this.input.radius = save.settings.sensitivity;
    this.input.onSwipe = (dir) => this.sim.swipe(dir);
    this.input.onTouch = () => {
      sound.unlock();
      this.hideHint();
    };

    this.ring = h('div', { class: 'tilt-ring' });
    this.ringDot = h('div', { class: 'tilt-dot' });
    this.el = this.buildHud();
    this.el.append(this.ring, this.ringDot);

    if (AUTOPLAY && control === 'tilt') this.pilot = new Autopilot(this.sim);
    window.addEventListener('resize', this.onResize);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private title(): string {
    const n = this.cube.n;
    if (this.cfg.kind === 'journey') return S.play.levelTitle(this.cfg.level!.id, n);
    if (this.cfg.kind === 'daily') return S.play.dailyTitle(n);
    return S.play.exploreTitle(cubeCode(n, this.cube.seed));
  }

  private buildHud(): HTMLElement {
    const ball = this.sim.ball;
    this.timerEl = h('div', { class: 'chip timer' }, '0:00.0');
    if (this.cfg.kind === 'explore') this.timerEl.style.display = 'none';
    this.fallsEl = h('div', { class: 'chip', style: 'display:none' });
    const top = h(
      'div',
      { class: 'topbar hit' },
      iconButton(ICONS.pause, S.play.pause, () => this.pause()),
      h('div', { class: 'chip' }, h('span', { class: `ball-dot ${ball.id}` }), this.title()),
      h('div', { class: 'spacer' }),
      this.fallsEl,
      this.timerEl,
    );
    const el = h('div', { class: 'screen passthrough' }, top);
    if (this.app.save.settings.minimap) {
      this.minimap = new Minimap(this.cube.n);
      const wrap = h('div', { class: 'minimap hit' }, this.minimap.canvas);
      el.append(wrap);
    }
    if (this.sim.state === 'READY') {
      const text = this.sim.mode === 'step' ? S.play.hintStep : S.play.hintTilt;
      this.hint = h('div', { class: 'hint' }, h('div', { class: 'hint-hand' }, '👆'), text, h('small', {}, S.play.hintGoal));
      el.append(this.hint);
    }
    return el;
  }

  private hideHint(): void {
    if (!this.hint) return;
    this.hint.classList.add('gone');
    const hEl = this.hint;
    window.setTimeout(() => hEl.remove(), 300);
    this.hint = null;
  }

  // ── Loop ─────────────────────────────────────────────────

  private frame(now: number): void {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dtMs = Math.min(250, now - this.last);
    this.last = now;
    if (!this.paused && this.sim.state !== 'FINISHED') {
      this.accum += dtMs;
      let ticks = 0;
      while (this.accum >= DT_MS && ticks < TUNING.MAX_TICKS_PER_FRAME) {
        const t = this.pilot ? this.pilot.input() : this.input.tilt;
        this.sim.step(t.x, t.y);
        this.accum -= DT_MS;
        ticks++;
        this.handleEvents();
        if ((this.sim.state as string) === 'FINISHED') break;
      }
      if (ticks === TUNING.MAX_TICKS_PER_FRAME) this.accum = 0;
    }
    const alpha = Math.min(1, this.accum / DT_MS);
    if (this.sim.state === 'FINISHED') {
      const k = Math.min(1, (now - this.finishedAt) / 700);
      this.view.render(this.sim, 1, dtMs / 1000, k);
      if (k >= 1 && !this.resultShown) this.showResult();
    } else this.view.render(this.sim, alpha, dtMs / 1000);

    sound.setRolling(this.sim.state === 'ROLLING' ? this.sim.speed : 0, this.sim.ball.vMax);
    this.timerEl.textContent = formatTime(this.sim.seconds);
    if (this.sim.falls) {
      this.fallsEl.style.display = '';
      this.fallsEl.textContent = S.play.falls(this.sim.falls);
    }
    this.drawRing();
    this.minimap?.draw(this.cube, this.sim.face, this.visited);
  }

  private drawRing(): void {
    const n = this.input.neutral;
    const c = this.input.current;
    const show = !!n && this.input.mode === 'tilt' && !this.paused;
    this.ring.style.display = show ? 'block' : 'none';
    this.ringDot.style.display = show ? 'block' : 'none';
    if (!show || !n || !c) return;
    const r = this.input.radius;
    this.ring.style.width = this.ring.style.height = `${r * 2}px`;
    this.ring.style.transform = `translate(${n.x - r}px, ${n.y - r}px)`;
    const t = this.input.tilt;
    this.ringDot.style.transform = `translate(${n.x + t.x * r - 14}px, ${n.y + t.y * r - 14}px)`;
  }

  private handleEvents(): void {
    for (const e of this.sim.drainEvents()) {
      switch (e.type) {
        case 'impact':
          if (e.strength >= TUNING.SILENT_IMPACT) {
            sound.knock(e.strength);
            if (e.strength > 3) haptic.medium();
            else haptic.light();
          }
          break;
        case 'gate':
          sound.clunk();
          haptic.firm();
          break;
        case 'turned':
          // The current touch becomes the new neutral point (§7.7).
          this.input.resetNeutral();
          this.visited.add(e.face);
          break;
        case 'fell':
          sound.whistle();
          haptic.medium();
          break;
        case 'respawned':
          sound.respawn();
          haptic.light();
          break;
        case 'finished':
          this.finishedAt = performance.now();
          sound.chime();
          haptic.firm();
          this.app.save.inProgress = null;
          break;
        case 'started':
          this.hideHint();
          break;
      }
    }
  }

  private showResult(): void {
    this.resultShown = true;
    this.input.release();
    showResult(this.app, {
      cfg: this.cfg,
      cube: this.cube,
      ball: this.sim.ball.id,
      control: this.sim.mode,
      seconds: this.sim.seconds,
      falls: this.sim.falls,
    });
  }

  private pause(): void {
    if (this.sim.state === 'FINISHED') return;
    this.paused = true;
    this.input.release();
    sound.setRolling(0, 1);
    openPause(this.app, {
      faceName: FACE_NAMES[this.sim.face],
      onResume: () => {
        this.paused = false;
        this.last = performance.now();
        const s = this.app.save.settings;
        this.view.showTrail = s.trail;
        this.input.radius = s.sensitivity;
      },
      onRestart: () => this.app.restart(this.cfg),
      onQuit: () => {
        this.saveProgress();
        this.app.goHome();
      },
    });
  }

  saveProgress(): void {
    const s = this.sim;
    if (s.state === 'FINISHED' || s.state === 'READY') {
      if (s.state === 'FINISHED') this.app.save.inProgress = null;
      return;
    }
    // A closed app resumes at the last checkpoint (§10).
    this.app.save.inProgress = {
      kind: this.cfg.kind,
      levelId: this.cfg.level?.id,
      code: cubeCode(this.cube.n, this.cube.seed),
      date: this.cfg.date,
      ball: s.ball.id,
      control: s.mode,
      checkpoint: { face: s.checkpoint.face, p: { ...s.checkpoint.p }, R: s.checkpoint.R.slice(), disarmed: s.checkpoint.disarmed },
      timerTicks: s.timerTicks,
      falls: s.falls,
    };
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    sound.setRolling(0, 1);
    this.input.dispose();
    this.view.dispose();
    this.canvas.remove();
    this.el.remove();
  }
}

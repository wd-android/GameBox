import { TUNING } from '../config/tuning';
import { SAND_COLOURS } from '../config/theme';
import { SandSim, tiltClass } from '../sand/sim';
import { accuracy, guideLines, starsFor, toleranceMap } from '../sand/scoring';
import { decodeGrid, encodeGrid } from '../sand/rle';
import { maskFor, SHAPES, type ShapeId } from '../jars/shapes';
import type { JarDef } from '../jars/types';
import { targetGrid } from '../jars/target';
import { JarView } from '../render/jarView';
import { jarThumb } from '../render/outline';
import { gridCanvas } from '../render/painter';
import { PourControl } from '../input/pourControl';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { guidesForced } from '../game/progress';
import type { InProgress } from '../state/save';
import type { App, Screen } from './app';
import { h, ICONS, iconButton } from './dom';
import { showResult } from './resultSheet';
import { openPause } from './pauseSheet';

export interface PourConfig {
  mode: 'match' | 'daily' | 'free';
  jar: JarDef | null;
  shape: ShapeId;
  date?: string;
  resume?: InProgress;
}

const STEP_MS = 1000 / TUNING.TICK_HZ;
/** The simulation is cheap, so slow frames catch up in full down to 7.5 fps. */
const MAX_STEPS_PER_FRAME = 8;

/** Frame and tick counters, readable from the console as `stratumStats` for performance checks. */
const stats = { frames: 0, ticks: 0, grains: 0 };
(globalThis as unknown as { stratumStats: typeof stats }).stratumStats = stats;

/** Tips shown the first time a technique or shape appears (icons and a few words only). */
const TIPS: Record<number, string> = {
  1: 'Hold to pour · match the picture',
  16: 'Hold still to build a mound',
  25: 'Drag the rim to tilt the jar',
  26: 'A round bottle: tilt to fill the shoulders',
  30: 'Sand is limited now – watch the pots',
  41: 'Tilt one way, then the other, for zigzags',
  51: 'A tall vase: slopes look steeper',
  66: 'Pictures! Mounds make hills and suns',
};

/**
 * The pouring screen (§10): jar in the centre, target top-left, palette pots
 * along the bottom, undo and done in the bottom corners, pause top right.
 */
export class PourScreen implements Screen {
  el: HTMLElement;
  private sim: SandSim;
  private view: JarView;
  private control: PourControl;
  private mask;
  private target: Uint8Array | null = null;
  private tolMap: Uint8Array | null = null;
  private acc = 0;
  private tilt = 0;
  private tiltAnim: number | null = null;
  private pointerId: number | null = null;
  private gesture: 'none' | 'pour' | 'tilt' = 'none';
  private tiltStartX = 0;
  private tiltStart = 0;
  private lastRimTap = 0;
  private undosUsed = 0;
  private peekUntil = 0;
  private finishing = false;
  private done = false;
  private paused = false;
  private showHand: boolean;
  private slideCued = false;
  private wasRanOut = false;
  private pots = new Map<number, HTMLButtonElement>();
  private potLevels = new Map<number, HTMLElement>();
  private undoBtn!: HTMLButtonElement;
  private undoBadge!: HTMLElement;
  private tiltLabel!: HTMLElement;
  private colours: number[];
  private limits: Record<number, number> | null;
  private onFrame = () => this.frame();
  private onResize = () => this.layout();
  private down = (e: PointerEvent) => this.pointerDown(e);
  private move = (e: PointerEvent) => this.pointerMove(e);
  private up = (e: PointerEvent) => this.pointerUp(e);

  constructor(
    private app: App,
    private cfg: PourConfig,
  ) {
    this.mask = maskFor(cfg.shape);
    const jar = cfg.jar;
    this.limits = jar?.limits ? Object.fromEntries(Object.entries(jar.limits).map(([k, v]) => [Number(k), v])) : null;
    this.sim = new SandSim(this.mask, jar?.seed ?? Date.now() % 100000, this.limits);
    this.colours = jar ? jar.palette : [1, 2, 3, 4, 5, 6, 7, 8];
    this.sim.setColour(this.colours[0]);

    if (jar) {
      this.target = targetGrid(jar);
      this.tolMap = toleranceMap(this.target, this.mask);
    }
    if (cfg.resume) {
      const r = cfg.resume;
      this.sim.restore(decodeGrid(r.cells, this.mask.w * this.mask.h), r.remaining, r.tick, r.rng);
      this.tilt = r.tilt;
      this.sim.setTilt(r.tilt);
      this.sim.setColour(r.colour);
      this.undosUsed = r.undosUsed;
    }

    this.view = new JarView(this.mask, cfg.shape);
    this.control = new PourControl(this.mask, { cell: 4, jarLeft: 0, spoutX: 0 }, app.save.settings.pouring);
    this.showHand = !cfg.resume && cfg.mode === 'match' && jar?.id === 1 && !app.save.firstLaunchDone;

    this.el = this.buildHud();
    this.applyGuides();
    this.view.setTarget(this.target, app.save.settings.patterns);

    app.pixi.stage.removeChildren();
    app.pixi.stage.addChild(this.view.root);
    // The HUD must be in the page before the jar can be fitted between its bands.
    requestAnimationFrame(() => this.layout());
    void document.fonts?.ready.then(() => this.layout());
    app.pixi.ticker.add(this.onFrame);
    app.pixi.ticker.start();
    window.addEventListener('resize', this.onResize);
    const canvas = app.pixi.canvas;
    canvas.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);

    const tip = jar && cfg.mode === 'match' ? TIPS[jar.id] : null;
    if (tip && !cfg.resume) this.showTip(tip);
  }

  // ── HUD ─────────────────────────────────────────────────

  private buildHud(): HTMLElement {
    const jar = this.cfg.jar;
    const firstLaunch = this.showHand;

    const top = h('div', { class: 'hud-top' });
    if (jar && this.target) {
      const thumb = jarThumb(jar.shape, this.target, 40, { patterns: this.app.save.settings.patterns });
      const label = this.cfg.mode === 'daily' ? 'Daily Jar' : jar.title;
      const sub = this.cfg.mode === 'daily' ? 'One scored pour today' : `Jar ${jar.id} · tap to peek`;
      const card = h('button', { class: 'target-card hit', 'aria-label': 'Show target on the glass' }, thumb, h('div', { class: 'meta' }, h('b', {}, label), h('span', {}, sub)));
      card.addEventListener('click', () => {
        this.peekUntil = performance.now() + TUNING.TARGET_PEEK_MS;
        sound.tap();
        haptic.light();
      });
      top.append(card);
    } else {
      top.append(h('div', { class: 'target-card hit' }, h('div', { class: 'meta' }, h('b', {}, 'Free Pour'), h('span', {}, SHAPES[this.cfg.shape].name))));
    }
    top.append(h('div', { style: 'flex:1' }));
    if (!firstLaunch) top.append(iconButton(ICONS.pause, 'Pause', () => this.pause(), 'hit'));

    const palette = h('div', { class: 'palette hit' });
    for (const c of this.colours) {
      const pot = h('button', { class: 'pot', 'aria-label': SAND_COLOURS[c].name });
      const sw = gridCanvas(this.potCells(c), { w: 14, h: 14, inside: new Uint8Array(196).fill(1), topRow: 0, openLeft: 0, openRight: 13, fillRow: 0, capacity: 196 }, { patterns: this.app.save.settings.patterns });
      sw.style.imageRendering = 'pixelated';
      const level = h('div', { class: 'level' });
      if (this.limits) {
        level.style.background = 'rgba(27,4,59,0.72)';
        level.style.top = '0';
        level.style.bottom = 'auto';
        level.style.height = '0%';
        this.potLevels.set(c, level);
      }
      pot.append(sw, level);
      pot.addEventListener('click', () => this.chooseColour(c));
      this.pots.set(c, pot);
      palette.append(pot);
    }

    this.undoBadge = h('span', { class: 'undo-count' });
    this.undoBtn = iconButton(ICONS.undo, 'Undo', () => this.undo());
    this.undoBtn.style.position = 'relative';
    this.undoBtn.append(this.undoBadge);
    const doneBtn = h('button', { class: 'btn primary' }, h('span', { html: ICONS.check, style: 'display:inline-flex;width:20px' }), 'Done');
    doneBtn.querySelector('svg')?.setAttribute('style', 'width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:3');
    doneBtn.addEventListener('click', () => this.finish());
    this.tiltLabel = h('div', { class: 'tilt-badge' });
    const actions = h('div', { class: 'hud-actions hit' }, this.undoBtn, this.tiltLabel, doneBtn);

    const bottom = h('div', { class: 'hud-bottom' }, palette, actions);
    const el = h('div', { class: 'screen passthrough' }, top, bottom);
    this.refreshPots();
    this.refreshUndo();
    return el;
  }

  private potCells(c: number): Uint8Array {
    return new Uint8Array(196).fill(c);
  }

  private chooseColour(c: number): void {
    sound.unlock();
    if (this.sim.remaining && this.sim.remaining[c] <= 0) {
      sound.hollow();
      haptic.double();
      this.shakePot(c);
      return;
    }
    this.sim.setColour(c);
    this.wasRanOut = false;
    sound.tap();
    haptic.light();
    this.refreshPots();
  }

  private shakePot(c: number): void {
    const p = this.pots.get(c);
    if (!p) return;
    p.classList.remove('shake');
    void p.offsetWidth;
    p.classList.add('shake');
  }

  private refreshPots(): void {
    for (const [c, pot] of this.pots) {
      pot.classList.toggle('selected', c === this.sim.colour);
      const rem = this.sim.remaining;
      if (rem && this.limits) {
        const frac = Math.max(0, rem[c]) / Math.max(1, this.limits[c] ?? 1);
        this.potLevels.get(c)!.style.height = `${(1 - frac) * 100}%`;
        pot.classList.toggle('empty', rem[c] <= 0);
      }
    }
  }

  private undosAllowed(): number {
    return this.cfg.mode === 'free' ? Infinity : TUNING.UNDOS_PER_JAR;
  }

  private refreshUndo(): void {
    const left = this.undosAllowed() - this.undosUsed;
    this.undoBadge.textContent = Number.isFinite(left) ? String(left) : '∞';
    this.undoBtn.disabled = left <= 0 || this.sim.undoCount === 0;
    this.undoBtn.style.opacity = this.undoBtn.disabled ? '0.4' : '1';
  }

  private showTip(text: string): void {
    const t = h('div', { class: 'tip', style: 'top: calc(var(--safe-top) + 84px)' }, text);
    this.el.append(t);
    window.setTimeout(() => t.remove(), 4200);
  }

  private applyGuides(): void {
    const jar = this.cfg.jar;
    const on = !!this.target && (guidesForced(jar?.id ?? 0) && this.cfg.mode === 'match' ? true : this.app.save.settings.guides);
    this.view.setGuides(on && this.target ? guideLines(this.target, this.mask) : null);
  }

  private guidesOn(): boolean {
    const jar = this.cfg.jar;
    if (!this.target) return false;
    if (this.cfg.mode === 'match' && guidesForced(jar?.id ?? 0)) return true;
    return this.app.save.settings.guides;
  }

  // ── Layout and geometry ─────────────────────────────────

  private destroyed = false;

  private layout(): void {
    if (this.destroyed) return;
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    // offsetTop is unaffected by the screen's entry animation (a transform).
    const topEl = this.el.querySelector('.hud-top') as HTMLElement | null;
    const botEl = this.el.querySelector('.hud-bottom') as HTMLElement | null;
    const topBand = topEl ? topEl.offsetTop + topEl.offsetHeight : 90;
    const bottomBand = botEl ? botEl.offsetTop : hgt - 160;
    // Leave room for a selected pot, which lifts by 8px.
    this.view.layout(w, topBand + 4, bottomBand - 14);
    this.updateGeometry();
  }

  private updateGeometry(): void {
    const rad = (this.tilt * Math.PI) / 180;
    const cellEff = this.view.cell * Math.cos(rad);
    // Where the middle of the opening is on screen with the jar not slid.
    const p = this.view.jar.toGlobal({ x: this.mask.w / 2, y: this.mask.topRow });
    this.control.geom = {
      cell: cellEff,
      jarLeft: p.x - this.control.offset - (this.mask.w / 2) * cellEff,
      spoutX: window.innerWidth / 2,
    };
  }

  // ── Input ───────────────────────────────────────────────

  private pointerDown(e: PointerEvent): void {
    sound.unlock();
    if (this.pointerId !== null || this.done || this.finishing || this.paused) return;
    this.pointerId = e.pointerId;
    const g = this.view.toGrid(e.clientX, e.clientY);
    const s = SHAPES[this.cfg.shape];
    const hw = s.halfWidth(s.top);
    const onRim = g.y > s.top - 10 && g.y < s.top + 8 && Math.abs(g.x - this.mask.w / 2) < hw + 10;
    if (onRim) {
      const now = performance.now();
      if (now - this.lastRimTap < 320) {
        this.levelJar();
        this.lastRimTap = 0;
        this.gesture = 'none';
        return;
      }
      this.lastRimTap = now;
      this.gesture = 'tilt';
      this.tiltAnim = null;
      this.tiltStartX = e.clientX;
      this.tiltStart = this.tilt;
      this.slideCued = false;
      haptic.light();
      return;
    }
    this.gesture = 'pour';
    this.updateGeometry();
    this.sim.setColumn(this.control.begin(e.clientX));
    if (this.sim.remaining && this.sim.remaining[this.sim.colour] <= 0) {
      sound.hollow();
      haptic.double();
      this.shakePot(this.sim.colour);
    }
    this.sim.setPouring(true);
    haptic.setPouring(true);
    this.showHand = false;
    this.refreshUndo();
  }

  private pointerMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    if (this.gesture === 'tilt') {
      const k = 30 / Math.max(80, this.view.cell * 40);
      this.tilt = Math.max(-TUNING.TILT_MAX_DEG, Math.min(TUNING.TILT_MAX_DEG, this.tiltStart + (e.clientX - this.tiltStartX) * k));
    } else if (this.gesture === 'pour') {
      this.updateGeometry();
      this.sim.setColumn(this.control.move(e.clientX));
    }
  }

  private pointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.gesture === 'pour') {
      this.sim.setPouring(false);
      haptic.setPouring(false);
    }
    this.gesture = 'none';
  }

  private levelJar(): void {
    this.tiltAnim = 0;
    haptic.light();
  }

  private undo(): void {
    if (this.undosUsed >= this.undosAllowed() || this.done || this.finishing) return;
    if (this.sim.undo()) {
      this.undosUsed++;
      sound.undo();
      haptic.light();
      this.refreshPots();
      this.refreshUndo();
    }
  }

  // ── Frame loop ──────────────────────────────────────────

  private accum = 0;

  private laidOut = false;

  private frame(): void {
    if (!this.laidOut && this.el.isConnected) {
      this.laidOut = true;
      this.layout();
    }
    const dt = Math.min(100, this.app.pixi.ticker.deltaMS);
    if (!this.paused) {
      if (this.tiltAnim !== null) {
        const d = this.tiltAnim - this.tilt;
        this.tilt += Math.sign(d) * Math.min(Math.abs(d), (dt / 1000) * 90);
        if (Math.abs(this.tiltAnim - this.tilt) < 0.01) {
          this.tilt = this.tiltAnim;
          this.tiltAnim = null;
        }
      }
      this.accum += dt;
      let steps = 0;
      let moved = 0;
      while (this.accum >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        this.sim.setTilt(this.tilt);
        this.sim.step();
        moved += this.sim.movedThisTick;
        stats.grains += this.sim.addedThisTick;
        this.accum -= STEP_MS;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accum = 0;
      stats.frames++;
      stats.ticks += steps;
      this.feedback(moved);
    }

    const pouring = this.sim.pouring;
    this.updateGeometry();
    this.view.update(
      this.sim,
      {
        tilt: this.tilt,
        offset: this.control.mode === 'fixed' ? this.control.offset : 0,
        pouring,
        streamX: this.control.streamX(this.sim.column),
        colour: this.sim.colour,
        patterns: this.app.save.settings.patterns,
        fixedSpout: this.control.mode === 'fixed',
        spoutX: window.innerWidth / 2,
        peek: performance.now() < this.peekUntil ? 1 : 0,
        showHand: this.showHand,
        rimActive: this.gesture === 'tilt' ? 1 : 0,
      },
      dt,
    );

    if (this.finishing && this.sim.settled) this.complete();
    else if (!this.finishing && !this.done && this.gesture !== 'pour' && this.sim.settled && this.sim.openingFull) this.finish();
  }

  private lastPotRefresh = 0;

  private feedback(moved: number): void {
    const s = this.sim;
    const flowing = s.pouring && s.addedThisTick > 0;
    sound.setPour(flowing, s.filledBelowLine() / this.mask.capacity, s.colour);
    if (s.pouring && !flowing) haptic.setPouring(false);
    else if (flowing) haptic.setPouring(true);

    const tilting = tiltClass(this.tilt) !== 0 || this.tiltAnim !== null;
    const sliding = tilting && !s.pouring && moved > 0;
    sound.setRustle(sliding ? Math.min(1, moved / 120) : 0);
    if (sliding && !this.slideCued) {
      this.slideCued = true;
      haptic.light();
    }
    const deg = Math.round(this.tilt);
    this.tiltLabel.textContent = deg === 0 ? '' : `${deg > 0 ? '↘' : '↙'} ${Math.abs(deg)}°  · double-tap rim to level`;

    if (s.ranOut && !this.wasRanOut) {
      this.wasRanOut = true;
      sound.hollow();
      haptic.double();
      this.shakePot(s.colour);
    }
    const now = performance.now();
    if (this.limits && now - this.lastPotRefresh > 120) {
      this.lastPotRefresh = now;
      this.refreshPots();
    }
  }

  // ── Finishing ───────────────────────────────────────────

  private finish(): void {
    if (this.finishing || this.done) return;
    this.finishing = true;
    this.sim.setPouring(false);
    haptic.setPouring(false);
    sound.setPour(false, 0, 1);
    this.tiltAnim = 0;
  }

  private complete(): void {
    if (this.done || this.tilt !== 0) return;
    this.done = true;
    this.finishing = false;
    sound.setRustle(0);
    this.app.pixi.ticker.remove(this.onFrame);
    const grid = encodeGrid(this.sim.cells);
    let acc = 0;
    let stars = 0;
    if (this.target && this.tolMap) {
      acc = accuracy(this.sim.cells, this.tolMap, this.mask, this.target);
      stars = starsFor(acc);
    }
    this.acc = acc;
    const freehand = this.cfg.mode !== 'free' && !this.guidesOn() && stars > 0;
    this.app.save.inProgress = null;
    showResult(this.app, {
      mode: this.cfg.mode,
      jar: this.cfg.jar,
      shape: this.cfg.shape,
      date: this.cfg.date,
      cells: this.sim.cells.slice(),
      result: { acc, stars, freehand, grid },
      onAgain: () => this.again(),
    });
  }

  private again(): void {
    this.app.save.inProgress = null;
    if (this.cfg.mode === 'match' && this.cfg.jar) this.app.playMatch(this.cfg.jar.id);
    else if (this.cfg.mode === 'free') this.app.playFree(this.cfg.shape);
    else this.app.goHome();
  }

  private pause(): void {
    if (this.done) return;
    this.paused = true;
    this.sim.setPouring(false);
    haptic.setPouring(false);
    sound.setPour(false, 0, 1);
    sound.setRustle(0);
    openPause(this.app, {
      canGuides: !!this.target && !(this.cfg.mode === 'match' && guidesForced(this.cfg.jar?.id ?? 0)),
      onResume: () => {
        this.paused = false;
        this.control.setMode(this.app.save.settings.pouring);
        this.applyGuides();
        this.view.setTarget(this.target, this.app.save.settings.patterns);
      },
      onRestart: () => this.again(),
      onQuit: () => {
        this.saveProgress();
        this.app.goHomeKeepingProgress();
      },
    });
  }

  saveProgress(): void {
    if (this.done) return;
    this.sim.setPouring(false);
    haptic.setPouring(false);
    this.app.save.inProgress = {
      mode: this.cfg.mode,
      jarId: this.cfg.jar?.id ?? 0,
      shape: this.cfg.shape,
      cells: encodeGrid(this.sim.cells),
      remaining: this.sim.remaining ? Array.from(this.sim.remaining) : null,
      tilt: Math.round(this.tilt),
      colour: this.sim.colour,
      undosUsed: this.undosUsed,
      tick: this.sim.tick,
      rng: this.sim.rng.state,
      date: this.cfg.date,
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.app.pixi.ticker.remove(this.onFrame);
    this.app.pixi.ticker.stop();
    window.removeEventListener('resize', this.onResize);
    this.app.pixi.canvas.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
    haptic.setPouring(false);
    sound.setPour(false, 0, 1);
    sound.setRustle(0);
    this.app.pixi.stage.removeChildren();
    this.view.destroy();
    this.app.pixi.render();
    this.el.remove();
    void this.acc;
  }
}

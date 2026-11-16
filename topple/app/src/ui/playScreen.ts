import { TUNING } from '../config/tuning';
import type { PieceKind } from '../chain/model';
import type { ChainResult } from '../chain/chain';
import { BoardView } from '../render/boardView';
import { PuzzleSession, type SessionState } from '../game/session';
import { keyString, puzzleFor, todayNumber, type PuzzleKey } from '../game/puzzles';
import { failureText, hintText, parLabel, toppleCounter } from '../game/texts';
import { recordTopple } from '../game/results';
import { dateForNumber, WEEKDAYS, weekday } from '../game/schedule';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import type { App, Screen } from './app';
import { h, ICONS, iconButton, toast } from './dom';
import { showResult } from './resultSheet';
import { openPause } from './pauseSheet';

/** The puzzle screen (§12): board fills the screen, tray bottom centre, hint bottom left. */
export class PlayScreen implements Screen {
  el: HTMLElement;
  readonly session: PuzzleSession;
  private view: BoardView;
  private canvas: HTMLCanvasElement;
  private trayEl!: HTMLElement;
  private parEl!: HTMLElement;
  private counterEl!: HTMLElement;
  private hintBtn!: HTMLButtonElement;
  private coach: HTMLElement | null = null;
  private busy = false;
  private drag: { kind: PieceKind; from: number | null; pointer: number; startX: number; startY: number; moved: boolean } | null = null;
  private onResize = () => this.layout();
  private onMove = (e: PointerEvent) => this.dragMove(e);
  private onUp = (e: PointerEvent) => this.dragEnd(e);

  constructor(
    private app: App,
    readonly key: PuzzleKey,
    state?: SessionState,
  ) {
    const { puzzle, replay } = puzzleFor(key);
    this.session = new PuzzleSession(puzzle, state);
    this.canvas = h('canvas', { class: 'board-canvas' });
    app.stageEl.append(this.canvas);
    this.view = new BoardView(this.canvas);
    this.view.reducedMotion = app.save.settings.reduceMotion;
    this.view.load(puzzle, this.session.placement, app.save.styles.domino, app.save.styles.table);
    this.view.setHint(this.session.hint);
    this.view.onFall = (e) => {
      const tall = this.session.placement.get(e.slot) === 'tall' || puzzle.slots[e.slot].holds === 'tall';
      sound.clack(e.slot, tall || e.cause === 'bridge');
      haptic.clack(tall);
      if (e.slot === puzzle.flag) haptic.firm();
    };
    this.view.onBall = (ramp, phase) => {
      if (phase === 'launch') sound.roll(puzzle.ramps[ramp].travelMs);
      else {
        sound.knock();
        haptic.medium();
      }
    };
    this.view.onChainEnd = (r) => this.chainEnded(r);
    this.view.onResetDone = () => {
      this.busy = false;
      sound.setPlanning(true);
      this.refresh();
    };

    this.el = this.buildHud(replay);
    this.canvas.addEventListener('pointerdown', (e) => this.boardDown(e));
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    requestAnimationFrame(() => this.layout());
    this.refresh();
    this.showCoach();
  }

  private title(): string {
    const k = this.key;
    if (k.kind === 'daily') {
      const date = dateForNumber(k.n);
      return `Topple #${k.n} · ${WEEKDAYS[weekday(date)]}`;
    }
    return this.session.puzzle.title ?? 'Puzzle';
  }

  private buildHud(replay: boolean): HTMLElement {
    this.counterEl = h('div', { class: 'chip' });
    const top = h(
      'div',
      { class: 'topbar hit' },
      this.app.save.tutorialDone >= 2 ? iconButton(ICONS.pause, 'Pause', () => this.pause()) : null,
      h('div', { class: 'chip title-chip' }, this.title()),
      h('div', { class: 'spacer' }),
      this.counterEl,
    );
    this.trayEl = h('div', { class: 'tray hit' });
    this.parEl = h('div', { class: 'par-label' });
    this.hintBtn = h('button', { class: 'btn ghost hint-btn hit' }, '💡 Hint');
    this.hintBtn.addEventListener('click', () => this.openHint());
    if (this.key.kind === 'tutorial') this.hintBtn.style.visibility = 'hidden';
    const bottom = h('div', { class: 'play-bottom' }, this.hintBtn, h('div', { class: 'tray-wrap' }, this.trayEl, this.parEl), h('div', { class: 'hint-btn-spacer' }));
    const el = h('div', { class: 'screen passthrough' }, top, replay ? h('div', { class: 'note hit' }, 'The bundled puzzles have run out – replaying an early one.') : null, bottom);
    return el;
  }

  private layout(): void {
    const top = (this.el.querySelector('.topbar') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 70;
    const bottomEl = this.el.querySelector('.play-bottom') as HTMLElement | null;
    const bottom = bottomEl ? window.innerHeight - bottomEl.offsetTop : 150;
    this.view.setPadding(top + 6, bottom + 6);
  }

  /** Updates tray, counters and par label from the session. */
  refresh(): void {
    const s = this.session;
    this.counterEl.textContent = toppleCounter(s.topples);
    // Par beside the tray only if the setting is on (or once solved) – §7.
    this.parEl.textContent = parLabel(s.puzzle.par, this.app.save.settings.showPar, s.solved);
    this.trayEl.innerHTML = '';
    const tray = s.tray();
    for (const kind of tray) {
      const piece = h('button', { class: `piece ${kind}`, 'aria-label': kind === 'tall' ? 'Tall domino' : 'Domino' }, h('span', { class: 'piece-body' }));
      piece.addEventListener('pointerdown', (e) => this.dragStart(e, kind, null));
      this.trayEl.append(piece);
    }
    for (let i = tray.length; i < s.puzzle.tray.length; i++) this.trayEl.append(h('div', { class: 'piece empty' }));
    this.hintBtn.disabled = s.hintUsed;
    this.view.startPulse = s.placement.size > 0;
  }

  // ── Placing pieces (§8.1) ─────────────────────────────────

  private dragStart(e: PointerEvent, kind: PieceKind, from: number | null): void {
    if (this.busy) return;
    e.preventDefault();
    sound.unlock();
    sound.lift();
    haptic.light();
    this.drag = { kind, from, pointer: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
    this.dragMove(e);
  }

  private liftedPoint(e: PointerEvent): { x: number; y: number } | null {
    // The dragged piece is drawn above the finger so the thumb does not hide the gap.
    return this.view.screenToBoard(e.clientX, e.clientY - TUNING.DRAG_LIFT_PX);
  }

  private dragMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointer) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.moved = true;
    const p = this.liftedPoint(e);
    const gap = p ? this.view.nearestSlot(p, TUNING.SNAP_DISTANCE, (s) => this.session.puzzle.slots[s].holds === 'gap' && !this.session.placement.has(s)) : null;
    this.view.setGapHighlight(gap);
    const facing = gap !== null ? this.session.puzzle.slots[gap].facing : 90;
    this.view.showGhost(d.kind, gap !== null ? { x: this.session.puzzle.slots[gap].x, y: this.session.puzzle.slots[gap].y } : p, facing);
  }

  private dragEnd(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointer) return;
    this.drag = null;
    this.view.showGhost(d.kind, null);
    this.view.setGapHighlight(null);
    const p = this.liftedPoint(e);
    const gap = p ? this.view.nearestSlot(p, TUNING.SNAP_DISTANCE, (s) => this.session.puzzle.slots[s].holds === 'gap' && !this.session.placement.has(s)) : null;
    if (gap !== null && this.session.place(gap, d.kind)) {
      sound.click();
      haptic.light();
      this.view.setPlacement(this.session.placement);
      this.persist();
      this.nextCoach();
    } else if (d.from !== null) {
      // A placed piece dragged away and dropped elsewhere goes back to the tray.
      this.view.setPlacement(this.session.placement);
    }
    this.refresh();
  }

  /** Tap a placed piece to return it to the tray; tap the start domino to topple. */
  private boardDown(e: PointerEvent): void {
    if (this.busy) return;
    sound.unlock();
    const p = this.view.screenToBoard(e.clientX, e.clientY);
    if (!p) return;
    const puzzle = this.session.puzzle;
    const slot = this.view.nearestSlot(p, 0.75);
    if (slot === null) return;
    if (slot === puzzle.start) {
      this.topple();
      return;
    }
    if (this.session.placement.has(slot)) {
      const kind = this.session.remove(slot)!;
      sound.lift();
      haptic.light();
      this.view.setPlacement(this.session.placement);
      this.persist();
      this.refresh();
      // Allow dragging it straight to another gap.
      this.dragStart(e, kind, slot);
    }
  }

  private topple(): void {
    this.busy = true;
    this.hideCoach();
    sound.setPlanning(false);
    haptic.light();
    const r = this.session.topple();
    recordTopple(this.app.save, this.key);
    this.persist();
    this.refresh();
    this.view.play(r);
  }

  private chainEnded(r: ChainResult): void {
    if (r.won) {
      sound.fanfare();
      haptic.firm();
      this.view.celebrate();
      this.app.save.inProgress = null;
      window.setTimeout(() => showResult(this.app, this), 1500);
      return;
    }
    sound.stopped();
    haptic.soft();
    toast(failureText(r), 1800);
    window.setTimeout(() => this.view.reset(), TUNING.STOP_HOLD_MS);
  }

  // ── Hint (§8.3) ───────────────────────────────────────────

  private openHint(): void {
    if (this.session.hintUsed || this.busy) return;
    const save = this.app.save;
    const overlay = h('div', { class: 'overlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    const choose = (kind: 'essential' | 'decoy') => {
      if (save.tokens < TUNING.HINT_COST) {
        toast(`A hint costs ${TUNING.HINT_COST} tokens`);
        return;
      }
      const hint = this.session.takeHint(kind);
      if (!hint) return;
      save.tokens -= TUNING.HINT_COST;
      overlay.remove();
      this.view.setHint(hint);
      toast(hintText(kind), 2400);
      sound.star();
      this.persist();
      this.refresh();
    };
    const a = h('button', { class: 'btn primary wide' }, '✦ Show an essential gap');
    a.addEventListener('click', () => choose('essential'));
    const b = h('button', { class: 'btn secondary wide' }, '✕ Show a decoy gap');
    b.addEventListener('click', () => choose('decoy'));
    overlay.append(h('div', { class: 'sheet card result' }, h('h2', { class: 'title' }, 'Hint'), h('div', { class: 'subtitle' }, `One hint per puzzle · ${TUNING.HINT_COST} tokens · you have ${save.tokens}`), a, b));
    this.app.ui.append(overlay);
  }

  // ── First launch coaching (§12) ───────────────────────────

  private coachStep = 0;

  private showCoach(): void {
    if (this.key.kind !== 'tutorial') return;
    this.coachStep = this.session.placement.size ? 1 : 0;
    this.setCoach(this.coachStep === 0 ? 'Drag the domino into a gap' : 'Tap the start domino ▼');
  }

  private nextCoach(): void {
    if (this.key.kind !== 'tutorial') return;
    this.setCoach(this.key.n === 2 && this.session.placement.size === 0 ? 'Which gap keeps the chain going?' : 'Tap the start domino to topple');
  }

  private setCoach(text: string): void {
    if (!this.coach) {
      this.coach = h('div', { class: 'coach' });
      this.el.append(this.coach);
    }
    this.coach.textContent = text;
  }

  private hideCoach(): void {
    this.coach?.remove();
    this.coach = null;
  }

  // ── Pause and saving ──────────────────────────────────────

  private pause(): void {
    if (this.busy) return;
    openPause(this.app, {
      onChange: () => {
        // "Show par" takes effect at once on the puzzle in progress (acceptance 3).
        this.view.reducedMotion = this.app.save.settings.reduceMotion;
        this.refresh();
      },
      onRestart: () => {
        for (const g of [...this.session.placement.keys()]) this.session.remove(g);
        this.view.setPlacement(this.session.placement);
        this.persist();
        this.refresh();
      },
      onHome: () => {
        this.persist();
        this.app.goHome();
      },
    });
  }

  /** Saved after every change, so closing the app mid-puzzle loses nothing. */
  persist(): void {
    if (!this.session.solved) this.app.save.inProgress = { key: keyString(this.key), state: this.session.serialize() };
    this.app.persist();
  }

  saveProgress(): void {
    this.persist();
  }

  isToday(): boolean {
    return this.key.kind === 'daily' && this.key.n === todayNumber();
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    sound.setPlanning(true);
    this.view.dispose();
    this.canvas.remove();
    this.el.remove();
  }
}

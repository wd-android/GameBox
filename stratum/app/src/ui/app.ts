import type { Application } from 'pixi.js';
import { writeSave, type SaveData } from '../state/save';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { dailyJarFor, dateKey, matchJar } from '../jars/jars';
import type { ShapeId } from '../jars/shapes';
import { shopItem } from '../game/progress';
import { PourScreen } from './pourScreen';
import { HomeScreen } from './homeScreen';
import { SetsScreen } from './setsScreen';
import { openSettings } from './settingsSheet';
import { openShop } from './shopSheet';
import { openFreePicker } from './freePicker';

export interface Screen {
  el: HTMLElement;
  destroy(): void;
  /** Called when the app goes to the background. */
  saveProgress?(): void;
}

/** Owns the save, the PixiJS stage and which screen is showing. */
export class App {
  current: Screen | null = null;
  readonly ui: HTMLElement;
  readonly stageEl: HTMLElement;

  constructor(
    public save: SaveData,
    public pixi: Application,
  ) {
    this.ui = document.getElementById('ui')!;
    this.stageEl = document.getElementById('stage')!;
    this.applySettings();
  }

  persist(): void {
    void writeSave(this.save);
  }

  applySettings(): void {
    const s = this.save.settings;
    sound.sfx = s.sfx;
    sound.setMusic(s.music);
    haptic.enabled = s.vibration;
    document.body.classList.toggle('reduce-motion', s.reduceMotion);
    const root = document.documentElement.style;
    root.setProperty('--backdrop', shopItem('backdrop', this.save.equipped.backdrop).css);
    root.setProperty('--glow', shopItem('lighting', this.save.equipped.lighting).css);
    root.setProperty('--label', shopItem('label', this.save.equipped.label).css);
  }

  private show(screen: Screen): void {
    this.current?.destroy();
    this.ui.querySelectorAll('.overlay').forEach((o) => o.remove());
    this.current = screen;
    this.ui.append(screen.el);
  }

  goHome(): void {
    this.save.inProgress = null;
    this.persist();
    this.show(new HomeScreen(this));
  }

  /** Back to the shelf, keeping the jar in progress so it can be resumed. */
  goHomeKeepingProgress(): void {
    this.persist();
    this.show(new HomeScreen(this));
  }

  playMatch(id: number): void {
    const p = this.save.inProgress;
    if (p && p.mode === 'match' && p.jarId === id && this.resume()) return;
    this.show(new PourScreen(this, { mode: 'match', jar: matchJar(id), shape: matchJar(id).shape }));
  }

  playDaily(): void {
    const key = dateKey();
    const p = this.save.inProgress;
    if (p && p.mode === 'daily' && p.date === key && this.resume()) return;
    const jar = dailyJarFor(key);
    this.show(new PourScreen(this, { mode: 'daily', jar, shape: jar.shape, date: key }));
  }

  playFree(shape: ShapeId): void {
    this.show(new PourScreen(this, { mode: 'free', jar: null, shape }));
  }

  resume(): boolean {
    const p = this.save.inProgress;
    if (!p) return false;
    if (p.mode === 'daily' && p.date !== dateKey()) return false;
    const jar = p.mode === 'match' ? matchJar(p.jarId) : p.mode === 'daily' ? dailyJarFor(p.date!) : null;
    this.show(new PourScreen(this, { mode: p.mode, jar, shape: p.shape, date: p.date, resume: p }));
    return true;
  }

  openSets(): void {
    this.show(new SetsScreen(this));
  }

  openSettings(onClose?: () => void): void {
    openSettings(this, onClose);
  }

  openShop(onClose?: () => void): void {
    openShop(this, onClose);
  }

  openFreePicker(): void {
    openFreePicker(this);
  }

  /** The app is going to the background: keep the jar in progress (§12). */
  background(): void {
    this.current?.saveProgress?.();
    this.persist();
    sound.suspend();
  }

  foreground(): void {
    sound.resume();
  }
}

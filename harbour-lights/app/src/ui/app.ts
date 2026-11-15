import type { Application } from 'pixi.js';
import { writeSave, type SaveData } from '../state/save';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { NightScreen } from './nightScreen';
import { HomeScreen } from './homeScreen';
import { TUTORIAL, night } from '../nights/nights';

export interface Screen {
  el: HTMLElement;
  destroy(): void;
  background?(): void;
}

export class App {
  current: Screen | null = null;
  readonly ui = document.getElementById('ui')!;

  constructor(
    public save: SaveData,
    public pixi: Application,
  ) {
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
    if (this.current instanceof NightScreen) this.current.applySettings();
  }

  private show(screen: Screen): void {
    this.current?.destroy();
    this.ui.querySelectorAll('.overlay').forEach((o) => o.remove());
    this.current = screen;
    this.ui.append(screen.el);
  }

  goHome(): void {
    this.persist();
    this.pixi.stage.removeChildren();
    this.show(new HomeScreen(this));
  }

  /** Plays night n (1–40). */
  playNight(n: number): void {
    this.show(new NightScreen(this, night(n)));
  }

  /** First launch: the tutorial nights, then the town (§10). */
  playTutorial(): void {
    this.show(new NightScreen(this, TUTORIAL[Math.min(1, this.save.tutorial)]));
  }

  background(): void {
    this.current?.background?.();
    this.persist();
    sound.suspend();
  }

  foreground(): void {
    sound.resume();
  }
}

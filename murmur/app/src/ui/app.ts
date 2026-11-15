import type { Application } from 'pixi.js';
import { writeSave, type SaveData } from '../state/save';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { FlightScreen } from './flightScreen';
import { HomeScreen } from './homeScreen';

export interface Screen {
  el: HTMLElement;
  destroy(): void;
  /** The app is going to the background. */
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
  }

  private show(screen: Screen): void {
    this.current?.destroy();
    this.ui.querySelectorAll('.overlay').forEach((o) => o.remove());
    this.current = screen;
    this.ui.append(screen.el);
  }

  goHome(): void {
    this.persist();
    this.pixi.ticker.stop();
    this.pixi.stage.removeChildren();
    this.pixi.render();
    this.show(new HomeScreen(this));
  }

  /** One tap, straight into a new run (acceptance 4). */
  fly(): void {
    this.show(new FlightScreen(this));
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

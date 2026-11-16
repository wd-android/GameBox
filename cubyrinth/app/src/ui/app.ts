import { writeSave, type SaveData } from '../state/save';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { LEVELS, dailyFor } from '../game/levels';
import { dateKey } from '../game/progress';
import { parseCubeCode } from '../maze/generator';
import { PlayScreen, type PlayConfig } from './playScreen';
import { HomeScreen } from './homeScreen';
import { JourneyScreen } from './journeyScreen';

export interface Screen {
  el: HTMLElement;
  destroy(): void;
  saveProgress?(): void;
}

/** Owns the save and which screen is showing. */
export class App {
  current: Screen | null = null;
  readonly ui = document.getElementById('ui')!;
  readonly stageEl = document.getElementById('stage')!;

  constructor(public save: SaveData) {
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
    this.show(new HomeScreen(this));
  }

  openJourney(): void {
    this.show(new JourneyScreen(this));
  }

  playLevel(id: number): void {
    const p = this.save.inProgress;
    if (p && p.kind === 'journey' && p.levelId === id && this.resume()) return;
    this.save.inProgress = null;
    this.show(new PlayScreen(this, { kind: 'journey', level: LEVELS[id - 1] }));
  }

  playDaily(): void {
    const key = dateKey();
    const p = this.save.inProgress;
    if (p && p.kind === 'daily' && p.date === key && this.resume()) return;
    const d = dailyFor(key);
    this.save.inProgress = null;
    this.show(new PlayScreen(this, { kind: 'daily', n: d.n, seed: d.seed, date: key }));
  }

  playExplore(n: number, seed: number): void {
    this.save.inProgress = null;
    this.show(new PlayScreen(this, { kind: 'explore', n, seed }));
  }

  restart(cfg: PlayConfig): void {
    this.save.inProgress = null;
    this.show(new PlayScreen(this, { ...cfg, resume: undefined }));
  }

  /** Resumes the level in progress at its last checkpoint. */
  resume(): boolean {
    const p = this.save.inProgress;
    if (!p) return false;
    if (p.kind === 'journey' && p.levelId) {
      this.show(new PlayScreen(this, { kind: 'journey', level: LEVELS[p.levelId - 1], resume: p }));
      return true;
    }
    if (p.kind === 'daily' && p.date !== dateKey()) return false;
    const c = p.code ? parseCubeCode(p.code) : null;
    if (!c) return false;
    this.show(new PlayScreen(this, { kind: p.kind, n: c.n, seed: c.seed, date: p.date, resume: p }));
    return true;
  }

  background(): void {
    this.current?.saveProgress?.();
    this.persist();
    sound.suspend();
  }

  foreground(): void {
    sound.resume();
  }
}

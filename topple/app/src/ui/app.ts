import { writeSave, type SaveData } from '../state/save';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { parseKey, todayNumber, type PuzzleKey, keyString } from '../game/puzzles';
import { PlayScreen } from './playScreen';
import { HomeScreen } from './homeScreen';
import { ArchiveScreen } from './archiveScreen';
import { PackScreen } from './packScreen';
import { StatsScreen } from './statsScreen';

export interface Screen {
  el: HTMLElement;
  destroy(): void;
  saveProgress?(): void;
}

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

  /** First launch (§12): two short puzzles, then today's Daily Topple; no menu until done. */
  start(): void {
    const p = this.save.inProgress;
    if (this.save.tutorialDone < 2) {
      const n = this.save.tutorialDone + 1;
      const resume = p && p.key === `tutorial:${n}` ? p.state : undefined;
      this.show(new PlayScreen(this, { kind: 'tutorial', n }, resume));
      return;
    }
    if (p) {
      const k = parseKey(p.key);
      if (k) {
        this.show(new PlayScreen(this, k, p.state));
        return;
      }
    }
    this.goHome();
  }

  goHome(): void {
    this.persist();
    this.show(new HomeScreen(this));
  }

  /** Opens a puzzle, resuming it if it is the one in progress. */
  play(key: PuzzleKey, fresh = false): void {
    const p = this.save.inProgress;
    const resume = !fresh && p && p.key === keyString(key) ? p.state : undefined;
    if (!resume) this.save.inProgress = null;
    this.show(new PlayScreen(this, key, resume));
  }

  playToday(): void {
    this.play({ kind: 'daily', n: todayNumber() });
  }

  openArchive(): void {
    this.show(new ArchiveScreen(this));
  }

  openPack(): void {
    this.show(new PackScreen(this));
  }

  openStats(): void {
    this.show(new StatsScreen(this));
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

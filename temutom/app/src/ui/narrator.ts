import { NARRATOR } from '../content/lines';
import { TUNING } from '../config/tuning';

/**
 * One line on screen at a time, for 2.5 s, with at least 6 s between lines (spec §13.1).
 * A line is not repeated until the others for that event have been used.
 */
export class Narrator {
  private bags: Record<string, string[]> = {};
  private lastShown = -999;
  current: { text: string; until: number; teach: boolean } | null = null;

  private draw(key: string): string | null {
    const all = NARRATOR[key];
    if (!all?.length) return null;
    if (!this.bags[key]?.length) this.bags[key] = [...all].sort(() => Math.random() - 0.5);
    return this.bags[key].pop()!;
  }

  say(key: string, now: number, force = false) {
    if (!force && now - this.lastShown < TUNING.narrator.gap) return;
    const line = this.draw(key);
    if (!line) return;
    this.lastShown = now;
    this.current = { text: line, until: now + TUNING.narrator.showFor, teach: false };
  }

  teach(text: string, now: number, secs = 4.5) {
    this.lastShown = now;
    this.current = { text, until: now + secs, teach: true };
  }

  text(now: number) {
    if (this.current && now > this.current.until) this.current = null;
    return this.current;
  }
}

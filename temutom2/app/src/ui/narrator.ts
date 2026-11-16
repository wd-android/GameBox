import { NARRATOR } from '../content/lines';
import { TUNING } from '../config/tuning';

/** One caption at a time for 2.5 s, at least 5 s apart, except that a line always follows a strike (§14.2). */
export class Narrator {
  private bags: Record<string, string[]> = {};
  private last = -99;
  current: { text: string; until: number; teach: boolean } | null = null;

  private draw(key: string) {
    const all = NARRATOR[key];
    if (!all?.length) return null;
    if (!this.bags[key]?.length) this.bags[key] = [...all].sort(() => Math.random() - 0.5);
    return this.bags[key].pop()!;
  }
  say(key: string, now: number, force = false) {
    if (!force && now - this.last < TUNING.narrator.gap) return;
    const line = this.draw(key);
    if (!line) return;
    this.last = now;
    this.current = { text: line, until: now + TUNING.narrator.showFor, teach: false };
  }
  teach(text: string, now: number, secs = 5) {
    this.last = now;
    this.current = { text, until: now + secs, teach: true };
  }
  text(now: number) {
    if (this.current && now > this.current.until) this.current = null;
    return this.current;
  }
}

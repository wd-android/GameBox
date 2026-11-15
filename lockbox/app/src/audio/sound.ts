/**
 * Synthesised sound (§13), no audio files: crisp ticks for wheels and rings,
 * glass clinks, a wooden slide and knock, a dull rattle for a wrong try, a
 * warm click for a correct part, a bright snap when a lock opens, a heavy
 * thunk, creak and shimmer for the chest, and a chime for each reward.
 */
class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  sfx = true;
  music = true;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.music) this.startMusic();
  }
  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, when = 0, slide?: number, music = false): void {
    if (!this.ctx || (!this.sfx && !music)) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f * (music ? 1 : 0.98 + Math.random() * 0.04), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private burst(f: number, q: number, dur: number, vol: number, when = 0, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const fl = this.ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  tick(): void {
    this.burst(4200, 10, 0.025, 0.35);
  }
  clink(): void {
    this.tone(2200, 0.25, 'sine', 0.12);
    this.tone(3300, 0.18, 'sine', 0.06, 0.02);
  }
  slide(): void {
    this.burst(500, 1.2, 0.18, 0.25);
  }
  knock(): void {
    this.burst(260, 2, 0.1, 0.6);
    this.tone(140, 0.08, 'sine', 0.2);
  }
  rattle(): void {
    for (let i = 0; i < 4; i++) this.burst(900, 4, 0.05, 0.4, i * 0.05);
  }
  warm(): void {
    this.tone(660, 0.14, 'triangle', 0.12);
  }
  snap(): void {
    this.burst(5000, 6, 0.05, 0.6);
    this.tone(1760, 0.2, 'triangle', 0.15, 0.02);
    this.tone(2637, 0.25, 'sine', 0.08, 0.05);
  }
  chestOpen(): void {
    this.burst(120, 1.5, 0.25, 0.9);
    this.tone(90, 0.3, 'sine', 0.3);
    this.burst(700, 8, 0.6, 0.15, 0.2, 'bandpass');
    [1318.5, 1567.98, 2093, 2637].forEach((f, i) => this.tone(f, 0.8, 'sine', 0.06, 0.45 + i * 0.07));
  }
  chime(): void {
    this.tone(1568, 0.5, 'triangle', 0.14);
    this.tone(2093, 0.4, 'sine', 0.06, 0.05);
  }
  tap(): void {
    this.tone(880, 0.05, 'sine', 0.1);
  }

  setMusic(on: boolean): void {
    this.music = on;
    if (on) this.startMusic();
    else if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
  /** A quiet music-box loop. */
  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 587.33, 493.88];
    let i = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.music) return;
      this.tone(notes[i % notes.length], 0.9, 'sine', 0.03, 0, undefined, true);
      if (i % 4 === 0) this.tone(notes[i % notes.length] / 4, 1.8, 'triangle', 0.025, 0, undefined, true);
      i++;
    }, 520);
  }
}

export const sound = new Sound();

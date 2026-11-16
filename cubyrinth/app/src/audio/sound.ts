/**
 * Synthesised sound (§7.14): no audio files. Rolling noise follows the ball's
 * speed; knocks are scaled to impact strength; a clunk for each turn, a
 * whistle for a fall, a chime at the finish. Every cue also has a visual and
 * haptic twin, so the game is fully playable in silence.
 */
class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private roll: { filter: BiquadFilterNode; gain: GainNode } | null = null;
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
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    // Brown-ish noise: a rumble rather than a hiss.
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.roll = { filter, gain };
    if (this.music) this.startMusic();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  /** Rolling sound pitch and volume follow the speed (cells per second). */
  setRolling(speed: number, vMax: number): void {
    if (!this.ctx || !this.roll) return;
    const k = Math.min(1, speed / vMax);
    const t = this.ctx.currentTime;
    this.roll.gain.gain.setTargetAtTime(this.sfx ? k * 0.5 : 0, t, 0.04);
    this.roll.filter.frequency.setTargetAtTime(250 + 1400 * k, t, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq * (0.98 + Math.random() * 0.04), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private thump(vol: number, freq: number, dur: number): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  /** Impacts below 0.5 are silent. */
  knock(strength: number): void {
    if (strength < 0.5) return;
    const k = Math.min(1, strength / 6);
    this.thump(0.25 + 0.75 * k, 900 + 700 * k, 0.08);
    this.tone(180 + 120 * k, 0.06, 'triangle', 0.08 + 0.2 * k);
  }

  clunk(): void {
    this.thump(0.9, 300, 0.18);
    this.tone(110, 0.2, 'sine', 0.35, 0, 70);
  }

  whistle(): void {
    this.tone(1400, 0.45, 'sine', 0.18, 0, 260);
  }

  respawn(): void {
    this.tone(660, 0.12, 'sine', 0.15);
    this.tone(990, 0.16, 'sine', 0.12, 0.08);
  }

  chime(): void {
    [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.16, i * 0.08));
  }

  star(i: number): void {
    const notes = [523.25, 659.25, 783.99];
    this.tone(notes[i] ?? 1046.5, 0.35, 'triangle', 0.2);
  }

  tap(): void {
    this.tone(880, 0.06, 'sine', 0.14);
  }

  // ── Music: calm generative arpeggio ──

  setMusic(on: boolean): void {
    this.music = on;
    if (on) this.startMusic();
    else if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const scale = [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37];
    let step = 0;
    const play = () => {
      // While suspended the clock stands still, so notes would pile up and all sound at once on return.
      if (!this.ctx || !this.music || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const root = [0, 5, 3, 4][Math.floor(step / 8) % 4];
      const note = scale[(root + [0, 2, 4, 7, 4, 2, 4, 5][step % 8]) % scale.length];
      this.pad(note, t, 1.2, 0.03);
      if (step % 8 === 0) this.pad(scale[root] / 2, t, 4.2, 0.045);
      step++;
    };
    play();
    this.musicTimer = window.setInterval(play, 520);
  }

  private pad(freq: number, t: number, dur: number, vol: number): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

export const sound = new Sound();

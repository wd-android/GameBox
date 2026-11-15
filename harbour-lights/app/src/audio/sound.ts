/**
 * Synthesised sound (§11), no audio files: a low mechanical hum that rises with
 * the beam's speed, a soft bell when a boat is lit, a low foghorn for danger, a
 * splash for a close call, a warm chime that climbs with each landing in a row,
 * a creak and splash for a wreck, and a gentle folk phrase at dawn. Music is a
 * quiet sea-wash with a slow tune. Every cue has a visual twin.
 */
const SCALE = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77];
const TUNE = [0, 2, 3, 4, 3, 2, 0, -1, 0, 2, 4, 5, 4, 3, 2, 0];

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hum: { osc: OscillatorNode; gain: GainNode } | null = null;
  private wash: GainNode | null = null;
  private musicTimer: number | null = null;
  private streak = 0;
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
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.music ? 1 : 0;
    this.musicBus.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Beam hum
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(lp).connect(gain).connect(this.master);
    osc.start();
    this.hum = { osc, gain };
    // Sea-wash under the music
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 420;
    this.wash = ctx.createGain();
    this.wash.gain.value = 0.05;
    src.connect(bp).connect(this.wash).connect(this.musicBus);
    src.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(this.wash.gain);
    lfo.start();
    this.startMusic();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }

  /** Beam hum: louder and higher as the beam turns faster (degrees per second). */
  setBeam(speed: number, active: boolean): void {
    if (!this.ctx || !this.hum) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, speed / 200);
    this.hum.gain.gain.setTargetAtTime(this.sfx && active && k > 0.02 ? 0.025 + 0.06 * k : 0, t, 0.08);
    this.hum.osc.frequency.setTargetAtTime(50 + 50 * k, t, 0.1);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, bus?: GainNode): void {
    if (!this.ctx || !this.master || (!this.sfx && !bus)) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(dur: number, vol: number, freq: number, when = 0, q = 1): void {
    if (!this.ctx || !this.master || !this.noise || !this.sfx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** A boat becomes lit: a soft bell. */
  bell(): void {
    this.tone(1318.5, 0.9, 'sine', 0.07);
    this.tone(2637, 0.5, 'sine', 0.02);
  }

  /** Danger ahead: a low foghorn. */
  foghorn(): void {
    this.tone(98, 1.1, 'sawtooth', 0.05);
    this.tone(97, 1.1, 'square', 0.025);
  }

  splash(): void {
    this.hiss(0.45, 0.25, 1800, 0, 0.7);
  }

  /** A warm chime that climbs with each landing in a row. */
  landed(): void {
    const n = SCALE[Math.min(SCALE.length - 1, this.streak++)];
    this.tone(n, 0.7, 'triangle', 0.12);
    this.tone(n * 1.5, 0.5, 'sine', 0.05, 0.06);
  }

  /** Creak and splash. Breaks the landing streak. */
  wrecked(): void {
    this.streak = 0;
    this.tone(180, 0.5, 'sawtooth', 0.04, 0, 120);
    this.tone(150, 0.4, 'sawtooth', 0.03, 0.15, 90);
    this.hiss(0.7, 0.3, 700, 0.25, 0.6);
  }

  arrive(): void {
    this.tone(880, 0.12, 'sine', 0.025);
  }

  coin(): void {
    this.tone(1567.98, 0.12, 'square', 0.035);
    this.tone(2093, 0.18, 'square', 0.03, 0.06);
  }

  tap(): void {
    this.tone(660, 0.06, 'sine', 0.04);
  }

  /** Dawn: a gentle folk phrase. */
  dawn(stars: number): void {
    this.streak = 0;
    const phrase = stars >= 3 ? [0, 2, 4, 5, 4, 7] : stars > 0 ? [0, 2, 4, 2, 0] : [4, 2, 0, -1];
    phrase.forEach((k, i) => this.tone(SCALE[Math.max(0, k)] * (k < 0 ? 0.75 : 1), 0.6, 'triangle', 0.09, i * 0.28));
  }

  resetStreak(): void {
    this.streak = 0;
  }

  setMusic(on: boolean): void {
    this.music = on;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.3);
  }

  private startMusic(): void {
    if (this.musicTimer !== null) return;
    let step = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicBus || !this.music || this.ctx.state !== 'running') return;
      const k = TUNE[step % TUNE.length];
      const f = k < 0 ? SCALE[0] * 0.89 : SCALE[k];
      if (step % 2 === 0 || step % 7 === 3) this.tone(f / 2, 1.6, 'sine', 0.035, 0, undefined, this.musicBus);
      if (step % 8 === 0) this.tone(SCALE[0] / 4, 3.2, 'sine', 0.03, 0, undefined, this.musicBus);
      step++;
    }, 900);
  }
}

export const sound = new Sound();

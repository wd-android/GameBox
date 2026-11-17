/**
 * Synthesised sound (§10), no audio files: a rush of wings that fills out as
 * the flock grows; rising notes for gathered birds that climb a scale; a
 * flutter for losses; the hawk's cry; a warm chord for banking; a swell and
 * chime for a murmuration; music in layers that build with the flock.
 * Every cue has a visual twin.
 */
const SCALE = [392, 440, 493.88, 587.33, 659.25, 783.99, 880, 987.77, 1174.66, 1318.51];

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private wings: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private musicBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private layers = 1;
  private climb = 0;
  private lastGather = 0;
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
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.wings = { gain, filter };
    if (this.music) this.startMusic();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  /** The rush of wings, fuller as the flock grows; music layers follow the flock size. */
  setFlock(n: number, flying: boolean): void {
    if (!this.ctx || !this.wings) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, n / 200);
    this.wings.gain.gain.setTargetAtTime(this.sfx && flying ? 0.05 + 0.22 * k : 0, t, 0.3);
    this.wings.filter.frequency.setTargetAtTime(500 + 900 * k, t, 0.5);
    this.layers = n >= 150 ? 4 : n >= 60 ? 3 : n >= 20 ? 2 : 1;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, bus?: GainNode): void {
    if (!this.ctx || (!this.sfx && !bus)) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(freq: number, dur: number, vol: number, when = 0): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  /** A rising note; consecutive joins climb the scale. */
  gather(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.climb = now - this.lastGather < 1.2 ? Math.min(SCALE.length - 1, this.climb + 1) : 0;
    this.lastGather = now;
    this.tone(SCALE[this.climb], 0.18, 'sine', 0.14);
    this.tone(SCALE[this.climb] * 2, 0.12, 'sine', 0.04);
  }

  flutter(): void {
    for (let i = 0; i < 5; i++) this.burst(1800 + i * 200, 0.05, 0.25, i * 0.035);
  }

  hawkCry(): void {
    this.tone(2400, 0.5, 'sawtooth', 0.06, 0, 1300);
    this.tone(2600, 0.35, 'sine', 0.08, 0.05, 1500);
  }

  hawkStrike(): void {
    this.burst(600, 0.2, 0.6);
  }

  bankChord(): void {
    [261.63, 329.63, 392, 523.25].forEach((f, i) => this.tone(f, 1.2, 'triangle', 0.1, i * 0.04));
  }

  murmuration(): void {
    if (!this.ctx || !this.noise || !this.sfx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1600, t + 1.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 1.6);
    this.tone(1567.98, 1.2, 'sine', 0.1, 0.5);
    this.tone(2093, 1.0, 'sine', 0.06, 0.6);
  }

  over(): void {
    if (!this.ctx || !this.wings) return;
    this.wings.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
    this.tone(220, 0.8, 'sine', 0.1, 0, 140);
  }

  tap(): void {
    this.tone(880, 0.05, 'sine', 0.12);
  }

  // ── Music in layers ──

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
    const chords = [
      [196, 246.94, 293.66],
      [174.61, 220, 261.63],
      [164.81, 196, 246.94],
      [174.61, 220, 293.66],
    ];
    let step = 0;
    const bus = () => this.musicBus!;
    const play = () => {
      // While suspended the clock stands still, so notes would pile up and all sound at once on return.
      if (!this.ctx || !this.music || this.ctx.state !== 'running') return;
      const chord = chords[Math.floor(step / 8) % 4];
      if (step % 8 === 0) chord.forEach((f) => this.tone(f, 3.6, 'triangle', 0.025, 0, undefined, bus()));
      if (this.layers >= 2 && step % 2 === 0) this.tone(chord[(step / 2) % 3] * 2, 0.5, 'sine', 0.03, 0, undefined, bus());
      if (this.layers >= 3) this.tone(chord[0] / 2, 0.35, 'sine', 0.05, 0, undefined, bus());
      if (this.layers >= 4 && step % 2 === 1) this.tone(chord[2] * 4, 0.12, 'sine', 0.018, 0, undefined, bus());
      step++;
    };
    play();
    this.musicTimer = window.setInterval(play, 460);
  }
}

export const sound = new Sound();

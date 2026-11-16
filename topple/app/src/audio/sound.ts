/**
 * Synthesised sound (§11), no audio files. A clack per domino with slightly
 * varied pitch, deeper for a tall domino; wooden lift and click; the ball's
 * roll and knock; a held silence when the chain stops short; a short
 * fanfare. Quiet music while planning, none during the topple.
 */
class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  sfx = true;
  music = true;
  private planning = true;

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
    this.musicBus.gain.value = 1;
    this.musicBus.connect(this.master);
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

  private burst(freq: number, q: number, dur: number, vol: number, when = 0): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
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
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** One domino strikes the table: pitch varied slightly per domino. */
  clack(slot: number, tall: boolean): void {
    const v = ((Math.imul(slot + 1, 2654435761) >>> 0) % 1000) / 1000;
    const f = (tall ? 1300 : 2300) * (0.9 + v * 0.2);
    this.burst(f, 6, tall ? 0.09 : 0.05, tall ? 0.7 : 0.5);
    this.tone(f / (tall ? 3.2 : 2.6), 0.04, 'triangle', tall ? 0.18 : 0.1);
  }

  lift(): void {
    this.burst(900, 2, 0.08, 0.25);
  }

  click(): void {
    this.burst(3200, 8, 0.03, 0.5);
    this.tone(1400, 0.03, 'square', 0.04);
  }

  roll(ms: number): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(900, t + ms / 1000);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.1);
    g.gain.linearRampToValueAtTime(0.5, t + ms / 1000);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000 + 0.05);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + ms / 1000 + 0.1);
  }

  knock(): void {
    this.burst(600, 3, 0.12, 0.8);
    this.tone(160, 0.15, 'sine', 0.3);
  }

  /** The chain stopped short: a soft low thud, then silence. */
  stopped(): void {
    this.tone(110, 0.3, 'sine', 0.18);
  }

  fanfare(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.16, 0.08 + i * 0.09));
    this.tone(1046.5, 0.9, 'sine', 0.08, 0.55);
  }

  tap(): void {
    this.tone(880, 0.05, 'sine', 0.12);
  }

  star(): void {
    this.tone(1318.5, 0.5, 'triangle', 0.18);
    this.tone(1975.5, 0.5, 'sine', 0.06, 0.05);
  }

  // ── Music: quiet while planning, none during the topple ──

  setPlanning(on: boolean): void {
    this.planning = on;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, on ? 0.6 : 0.08);
  }

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
    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25];
    let step = 0;
    const play = () => {
      // While suspended the clock stands still, so notes would pile up and all sound at once on return.
      if (!this.ctx || !this.music || !this.planning || this.ctx.state !== 'running') {
        step++;
        return;
      }
      const chord = [0, 3, 4, 2][Math.floor(step / 8) % 4];
      if (step % 2 === 0) this.tone(scale[(chord + [0, 2, 4, 2][(step / 2) % 4]) % scale.length], 1.4, 'sine', 0.035, 0, undefined, this.musicBus!);
      if (step % 8 === 0) this.tone(scale[chord] / 2, 3.6, 'triangle', 0.03, 0, undefined, this.musicBus!);
      step++;
    };
    play();
    this.musicTimer = window.setInterval(play, 450);
  }
}

export const sound = new Sound();

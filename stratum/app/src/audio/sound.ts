import { SAND_COLOURS } from '../config/theme';

/**
 * All sound is synthesised with Web Audio, so there are no audio files to
 * ship. Every cue has a visual twin and the game is fully playable in
 * silence (§11). The context is created lazily on the first touch.
 */
class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hiss: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private rustle: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private musicTimer: number | null = null;
  sfx = true;
  music = true;

  /** Call from a user gesture. */
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
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.hiss = this.loopNoise('bandpass', 3000, 1.2);
    this.rustle = this.loopNoise('lowpass', 700, 0.7);
    if (this.music) this.startMusic();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  private loopNoise(type: BiquadFilterType, freq: number, q: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    return { src, filter, gain };
  }

  /**
   * The pouring hiss: on while pouring, falling in pitch as the jar fills,
   * with a slightly different tone for each colour.
   */
  setPour(on: boolean, fill01: number, colour: number): void {
    if (!this.ctx || !this.hiss) return;
    const t = this.ctx.currentTime;
    const target = on && this.sfx ? 0.22 : 0;
    this.hiss.gain.gain.setTargetAtTime(target, t, on ? 0.015 : 0.03);
    if (on) {
      const tone = SAND_COLOURS[colour]?.tone ?? 0;
      const f = (4200 - 2600 * fill01) * Math.pow(2, tone / 24);
      this.hiss.filter.frequency.setTargetAtTime(f, t, 0.05);
    }
  }

  /** Soft rustle while sand shifts as the jar is tilted. */
  setRustle(level01: number): void {
    if (!this.ctx || !this.rustle) return;
    const v = this.sfx ? Math.min(0.25, level01 * 0.25) : 0;
    this.rustle.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.06);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    // Vary repeated sounds slightly so they never grate.
    o.frequency.setValueAtTime(freq * (0.98 + Math.random() * 0.04), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, from: number, to: number, vol: number, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  tap(): void {
    this.tone(880, 0.07, 'sine', 0.18);
  }

  hollow(): void {
    this.tone(220, 0.12, 'triangle', 0.22);
    this.tone(180, 0.12, 'triangle', 0.18, 0.13);
  }

  undo(): void {
    this.burst(0.35, 400, 3000, 0.35);
  }

  pop(): void {
    this.tone(620, 0.12, 'sine', 0.35, 0, 140);
    this.burst(0.06, 2000, 1500, 0.25, 'highpass');
  }

  star(i: number): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    this.tone(notes[i] ?? 1046.5, 0.35, 'triangle', 0.22);
    this.tone((notes[i] ?? 1046.5) * 2, 0.25, 'sine', 0.06);
  }

  fanfare(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.16, i * 0.09));
  }

  // ── Music: a calm, generative pentatonic loop ──

  setMusic(on: boolean): void {
    this.music = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    let step = 0;
    const play = () => {
      if (!this.ctx || !this.music) return;
      const t = this.ctx.currentTime;
      const chordRoot = [0, 3, 4, 2][Math.floor(step / 8) % 4];
      const n = scale[(chordRoot + [0, 2, 4, 2, 5, 4, 2, 4][step % 8]) % scale.length];
      this.pad(n / 2, t, 1.6, 0.035);
      if (step % 8 === 0) this.pad(scale[chordRoot] / 4, t, 4.5, 0.05);
      step++;
    };
    play();
    this.musicTimer = window.setInterval(play, 600);
  }

  private pad(freq: number, t: number, dur: number, vol: number): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const sound = new Sound();

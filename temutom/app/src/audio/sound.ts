/**
 * All sound is synthesised with Web Audio, so the download stays tiny and nothing needs licensing.
 * Every sound here has a visual equivalent in the UI (spec §14.1); the game is fully playable muted.
 */

type Ctx = AudioContext;

class SoundEngine {
  ctx: Ctx | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxOn = true;
  musicOn = true;
  private noiseBuf: AudioBuffer | null = null;
  private scream: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filt: BiquadFilterNode; start: number } | null = null;
  private purr: { gain: GainNode; src: AudioBufferSourceNode; lfo: OscillatorNode } | null = null;
  private growl: { gain: GainNode; osc: OscillatorNode } | null = null;
  private hoover: { gain: GainNode; src: AudioBufferSourceNode; hum: OscillatorNode } | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicTense = false;
  private chainPitch = 0;
  private lastChain = 0;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    // Mix with the player's own music and respect the silent switch (report §7)
    try { const as = (navigator as unknown as { audioSession?: { type: string } }).audioSession; if (as) as.type = 'ambient'; } catch { /* unsupported */ }
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.22 : 0;
    this.musicBus.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxBus) this.sfxBus.gain.value = on ? 1 : 0;
    if (!on) { this.screamStop(); this.setPurr(0); this.setGrowl(0); this.setHoover(false); }
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.value = on ? 0.22 : 0;
  }

  suspend() { void this.ctx?.suspend(); }
  resume() { void this.ctx?.resume(); }

  private vary(v: number, amount = 0.06) {
    return v * (1 + (Math.random() * 2 - 1) * amount);
  }

  private env(g: GainNode, t: number, a: number, peak: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, glideTo?: number) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    this.env(g, t, 0.01, vol, dur);
    o.connect(g).connect(this.sfxBus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass', delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxOn || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.005, vol, dur);
    src.connect(f).connect(g).connect(this.sfxBus!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ---- The signature scream: long, rising and indignant, lasting as long as the thumb is held
  screamStart() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxOn || this.scream) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    osc.type = 'sawtooth';
    osc2.type = 'square';
    const base = this.vary(420, 0.08);
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.9, t + 2.5);
    osc2.frequency.setValueAtTime(base * 1.005, t);
    osc2.frequency.linearRampToValueAtTime(base * 1.92, t + 2.5);
    vib.frequency.value = 6.5;
    vibG.gain.value = 14;
    vib.connect(vibG);
    vibG.connect(osc.frequency);
    vibG.connect(osc2.frequency);
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(900, t);
    filt.frequency.linearRampToValueAtTime(1800, t + 0.4);
    filt.Q.value = 3;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + 0.12);
    const o2g = ctx.createGain();
    o2g.gain.value = 0.25;
    osc.connect(filt);
    osc2.connect(o2g).connect(filt);
    filt.connect(gain).connect(this.sfxBus!);
    osc.start(t); osc2.start(t); vib.start(t);
    this.scream = { osc, osc2, gain, filt, start: t };
    (this.scream as unknown as { vib: OscillatorNode }).vib = vib;
  }

  screamStop() {
    const ctx = this.ctx;
    const sc = this.scream;
    if (!ctx || !sc) return;
    const t = ctx.currentTime;
    sc.gain.gain.cancelScheduledValues(t);
    sc.gain.gain.setValueAtTime(Math.max(0.0001, sc.gain.gain.value), t);
    sc.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    sc.osc.frequency.cancelScheduledValues(t);
    sc.osc.frequency.setValueAtTime(sc.osc.frequency.value, t);
    sc.osc.frequency.exponentialRampToValueAtTime(sc.osc.frequency.value * 0.7, t + 0.18);
    sc.osc.stop(t + 0.2); sc.osc2.stop(t + 0.2);
    (sc as unknown as { vib: OscillatorNode }).vib.stop(t + 0.2);
    this.scream = null;
  }

  // ---- Continuous layers
  setPurr(level: number) {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuf) return;
    if (!this.purr) {
      if (level <= 0 || !this.sfxOn) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 2;
      const am = ctx.createGain(); am.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 24;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
      lfo.connect(lfoG).connect(am.gain);
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(lp).connect(am).connect(gain).connect(this.sfxBus!);
      src.start(); lfo.start();
      this.purr = { gain, src, lfo };
    }
    this.purr.gain.gain.setTargetAtTime(this.sfxOn ? level * 0.9 : 0, ctx.currentTime, 0.25);
  }

  setGrowl(level: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.growl) {
      if (level <= 0 || !this.sfxOn) return;
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 72;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
      const lfoG = ctx.createGain(); lfoG.gain.value = 9;
      lfo.connect(lfoG).connect(osc.frequency);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const gain = ctx.createGain(); gain.gain.value = 0;
      osc.connect(lp).connect(gain).connect(this.sfxBus!);
      osc.start(); lfo.start();
      this.growl = { gain, osc };
    }
    this.growl.osc.frequency.setTargetAtTime(70 + level * 40, ctx.currentTime, 0.2);
    this.growl.gain.gain.setTargetAtTime(this.sfxOn ? level * level * 0.16 : 0, ctx.currentTime, 0.2);
  }

  setHoover(on: boolean) {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuf) return;
    if (!this.hoover) {
      if (!on || !this.sfxOn) return;
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
      const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 110;
      const humG = ctx.createGain(); humG.gain.value = 0.05;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(bp).connect(gain);
      hum.connect(humG).connect(gain);
      gain.connect(this.sfxBus!);
      src.start(); hum.start();
      this.hoover = { gain, src, hum };
    }
    this.hoover.gain.gain.setTargetAtTime(on && this.sfxOn ? 0.12 : 0, ctx.currentTime, 0.3);
  }

  stopLayers() {
    this.screamStop();
    this.setPurr(0);
    this.setGrowl(0);
    this.setHoover(false);
  }

  // ---- One-shots
  play(name: string, value = 0) {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    switch (name) {
      case 'oh': this.tone(this.vary(330), 0.18, 'triangle', 0.18, 0, this.vary(520)); break;
      case 'hm': this.tone(this.vary(300), 0.22, 'triangle', 0.15, 0, 230); break;
      case 'chime': {
        const now = ctx.currentTime;
        this.chainPitch = now - this.lastChain < 6 ? Math.min(this.chainPitch + 1, 6) : 0;
        this.lastChain = now;
        const k = Math.pow(2, (this.chainPitch * 2) / 12);
        this.tone(660 * k, 0.35, 'sine', 0.22);
        this.tone(990 * k, 0.45, 'sine', 0.16, 0.08);
        break;
      }
      case 'hiss': this.noise(0.6, 5000, 0.8, 0.25, 'highpass'); break;
      case 'yowl': this.tone(this.vary(500), 0.5, 'sawtooth', 0.12, 0, 260); break;
      case 'yelp': this.tone(this.vary(700), 0.16, 'square', 0.1, 0.05, 1100); break;
      case 'crash':
        if (value) { this.noise(0.4, 4200, 1.2, 0.35); this.tone(this.vary(2200), 0.25, 'triangle', 0.08, 0.02); this.tone(this.vary(3100), 0.2, 'triangle', 0.06, 0.05); }
        else { this.noise(0.18, 300, 1, 0.4, 'lowpass'); this.tone(this.vary(120), 0.15, 'sine', 0.25, 0, 60); }
        break;
      case 'bonk': this.tone(this.vary(380), 0.25, 'sine', 0.25, 0, 140); break;
      case 'slide': this.tone(400, 0.25, 'sine', 0.18, 0, 1200); this.tone(1200, 0.3, 'sine', 0.15, 0.25, 500); break;
      case 'ding': this.tone(1318, 0.6, 'sine', 0.14); this.tone(1976, 0.5, 'sine', 0.07, 0.02); break;
      case 'fanfare': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, i * 0.11)); break;
      case 'spritz': this.noise(0.35, 7000, 0.5, 0.3, 'highpass'); this.tone(1400, 0.2, 'square', 0.06, 0.25, 1900); break;
      case 'smack': this.noise(0.08, 1800, 1, 0.4); break;
      case 'tick': this.tone(1800, 0.04, 'square', 0.05); break;
      case 'woof': this.tone(this.vary(180), 0.18, 'sawtooth', 0.18, 0, 110); this.noise(0.12, 600, 1, 0.15); break;
      case 'whine': this.tone(900, 0.45, 'sine', 0.08, 0, 600); break;
      case 'door': this.tone(this.vary(210), 0.12, 'triangle', 0.18, 0, 160); break;
      case 'pour': for (let i = 0; i < 6; i++) this.noise(0.05, 2400 + Math.random() * 1500, 4, 0.12, 'bandpass', i * 0.06); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.15, i * 0.1)); break;
      case 'fail': this.tone(392, 0.35, 'triangle', 0.13); this.tone(330, 0.5, 'triangle', 0.12, 0.25); break;
      case 'ui': this.tone(900, 0.05, 'sine', 0.08); break;
      case 'scheme': this.tone(600 + value * 200, 0.12, 'triangle', 0.14); break;
      default:
    }
  }

  // ---- Light, loopable music. Becomes slightly more intense when time is short.
  musicStart() {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer != null) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const bass = [0, 0, 5, 5, 7, 7, 3, 4];
    const tick = () => {
      if (!this.ctx || !this.musicBus) return;
      const t = this.ctx.currentTime + 0.05;
      const st = this.musicStep++;
      const root = 196;
      if (st % 4 === 0) {
        const b = bass[Math.floor(st / 4) % bass.length];
        this.mtone(root / 2 * Math.pow(2, b / 12), 0.6, 'triangle', 0.4, t);
      }
      if (Math.random() < (this.musicTense ? 0.85 : 0.55)) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        this.mtone(root * 2 * Math.pow(2, n / 12), 0.22, 'sine', 0.22, t);
      }
      if (this.musicTense && st % 2 === 0) this.mnoise(t);
    };
    this.musicTimer = window.setInterval(tick, 250);
  }

  musicTension(on: boolean) { this.musicTense = on; }

  musicStop() {
    if (this.musicTimer != null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private mtone(freq: number, dur: number, type: OscillatorType, vol: number, t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    this.env(g, t, 0.01, vol, dur);
    o.connect(g).connect(this.musicBus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private mnoise(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ctx.createGain();
    this.env(g, t, 0.002, 0.08, 0.05);
    src.connect(f).connect(g).connect(this.musicBus!);
    src.start(t, Math.random());
    src.stop(t + 0.1);
  }
}

export const sound = new SoundEngine();

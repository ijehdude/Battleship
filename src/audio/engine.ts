// ARMADA audio — everything synthesized with the Web Audio API.
// No asset files, no licensing concerns. Respects autoplay policy: the context
// is created/resumed only after the first user gesture (see ensure()).

export type SfxName =
  | "click"
  | "pickup"
  | "place"
  | "error"
  | "ready"
  | "fire"
  | "hit"
  | "miss"
  | "sunk"
  | "victory"
  | "defeat";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  private _muted = false;
  private _volume = 0.7;
  private _musicOn = false;

  get muted() {
    return this._muted;
  }
  get volume() {
    return this._volume;
  }

  /** Create or resume the context. Must be called from a user gesture. */
  ensure(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : this._volume;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);

      this.noiseBuffer = this.makeNoise();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : this._volume, this.ctx.currentTime, 0.02);
    }
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this._muted) {
      this.master.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.02);
    }
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private now() {
    return this.ctx!.currentTime;
  }

  private osc(
    type: OscillatorType,
    freq: number,
    t0: number,
    dur: number,
    gain: number,
    dest: AudioNode,
    glideTo?: number,
  ) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noiseHit(t0: number, dur: number, gain: number, freq: number, q: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(freq, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.25), t0 + dur);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name: SfxName) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.now();
    const out = this.sfxGain;
    switch (name) {
      case "click":
        this.osc("triangle", 660, t, 0.07, 0.18, out, 880);
        break;
      case "pickup":
        this.osc("sine", 420, t, 0.12, 0.2, out, 720);
        break;
      case "place":
        this.osc("sine", 180, t, 0.14, 0.3, out, 90);
        this.noiseHit(t, 0.12, 0.18, 1200, 1, out);
        break;
      case "error":
        this.osc("sawtooth", 150, t, 0.18, 0.22, out, 90);
        break;
      case "ready":
        [392, 523, 659, 784].forEach((f, i) =>
          this.osc("triangle", f, t + i * 0.06, 0.3, 0.18, out),
        );
        break;
      case "fire":
        // laser/cannon: bright descending zap + body
        this.osc("sawtooth", 1400, t, 0.22, 0.22, out, 180);
        this.osc("square", 700, t, 0.12, 0.12, out, 120);
        this.noiseHit(t, 0.1, 0.12, 2400, 0.7, out);
        break;
      case "miss":
        // water splash — filtered noise plop
        this.noiseHit(t, 0.32, 0.35, 900, 0.6, out);
        this.osc("sine", 320, t, 0.18, 0.12, out, 120);
        break;
      case "hit":
        // explosion impact
        this.noiseHit(t, 0.45, 0.6, 1800, 0.8, out);
        this.osc("sine", 120, t, 0.4, 0.5, out, 40);
        this.osc("sawtooth", 260, t, 0.16, 0.18, out, 60);
        break;
      case "sunk":
        // big explosion + klaxon
        this.noiseHit(t, 0.7, 0.7, 2200, 0.9, out);
        this.osc("sine", 90, t, 0.7, 0.6, out, 30);
        [0, 0.18, 0.36].forEach((d) => {
          this.osc("square", 440, t + 0.1 + d, 0.12, 0.16, out, 360);
        });
        break;
      case "victory":
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          this.osc("triangle", f, t + i * 0.12, 0.5, 0.2, out),
        );
        break;
      case "defeat":
        [440, 392, 311, 220].forEach((f, i) =>
          this.osc("sawtooth", f, t + i * 0.16, 0.5, 0.18, out, f * 0.8),
        );
        break;
    }
  }

  // ---- ambient / dynamic music: slow evolving naval drone + arpeggio ----
  startMusic() {
    if (!this.ctx || !this.musicGain || this._musicOn) return;
    this._musicOn = true;
    const ctx = this.ctx;

    // sustained sub drone
    const drone = ctx.createOscillator();
    const droneG = ctx.createGain();
    drone.type = "sine";
    drone.frequency.value = 55;
    droneG.gain.value = 0.18;
    drone.connect(droneG);
    droneG.connect(this.musicGain);
    drone.start();

    const pad = ctx.createOscillator();
    const padG = ctx.createGain();
    pad.type = "sawtooth";
    pad.frequency.value = 110;
    const padFilt = ctx.createBiquadFilter();
    padFilt.type = "lowpass";
    padFilt.frequency.value = 400;
    padG.gain.value = 0.05;
    pad.connect(padFilt);
    padFilt.connect(padG);
    padG.connect(this.musicGain);
    pad.start();

    // slow LFO on pad filter for movement
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoG.gain.value = 220;
    lfo.connect(lfoG);
    lfoG.connect(padFilt.frequency);
    lfo.start();

    // gentle arpeggio sequence
    const scale = [220, 261.6, 329.6, 392, 440, 392, 329.6, 261.6];
    const stepMs = 1100;
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const f = scale[this.musicStep % scale.length];
      this.osc("triangle", f, this.now(), 1.4, 0.04, this.musicGain);
      this.musicStep++;
    };
    tick();
    this.musicTimer = window.setInterval(tick, stepMs);
  }
}

let engine: AudioEngine | null = null;
export function getAudio(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}

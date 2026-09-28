// Tiny procedural sound engine: every effect is synthesised with WebAudio, no assets.
import { G } from './ctx.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.noiseBuf = null;
    this.musicTimer = 0;
    this.step = 0;
    this.mood = 'explore'; // explore | battle | dungeon | victory
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = G.settings.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  _env(node, t, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  tone(freq, dur = 0.2, type = 'sine', vol = 0.3, slide = 0, delay = 0, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    this._env(g, t, 0.01, vol, dur);
    o.connect(g).connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur = 0.2, freq = 1200, q = 1, vol = 0.3, type = 'bandpass', slideTo = 0, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, vol, dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  play(name, vol = 1) {
    if (!this.ctx) return;
    switch (name) {
      case 'swing': this.noise(0.18, 900, 0.8, 0.25 * vol, 'bandpass', 3000); break;
      case 'spin': this.noise(0.45, 500, 0.7, 0.3 * vol, 'bandpass', 2500); break;
      case 'hit': this.tone(160, 0.12, 'square', 0.18 * vol, 0.5); this.noise(0.1, 2000, 1, 0.25 * vol); break;
      case 'crit': this.tone(520, 0.2, 'triangle', 0.2 * vol, 1.8); this.noise(0.15, 3000, 1, 0.2 * vol); break;
      case 'splat': this.noise(0.14, 600, 2, 0.25 * vol, 'lowpass', 150); this.tone(300, 0.08, 'sine', 0.1 * vol, 0.4); break;
      case 'flick': this.tone(700, 0.1, 'sine', 0.15 * vol, 1.6); break;
      case 'fire': this.noise(0.5, 400, 0.5, 0.25 * vol, 'lowpass', 1500); break;
      case 'ice': this.tone(1800, 0.25, 'triangle', 0.1 * vol, 1.5); this.tone(2400, 0.3, 'sine', 0.07 * vol, 1.2, 0.05); break;
      case 'bounce': this.tone(180, 0.3, 'sine', 0.3 * vol, 3.5); break;
      case 'vine': this.noise(0.4, 300, 3, 0.2 * vol, 'bandpass', 900); this.tone(220, 0.35, 'triangle', 0.08 * vol, 1.5); break;
      case 'jump': this.tone(300, 0.12, 'sine', 0.12 * vol, 1.8); break;
      case 'land': this.noise(0.1, 250, 1, 0.18 * vol, 'lowpass'); break;
      case 'glide': this.noise(0.4, 800, 0.4, 0.15 * vol, 'bandpass', 400); break;
      case 'ride': this.tone(220, 0.4, 'sawtooth', 0.06 * vol, 2); this.noise(0.4, 1500, 0.5, 0.12 * vol, 'bandpass', 500); break;
      case 'hurt': this.tone(220, 0.25, 'sawtooth', 0.2 * vol, 0.5); break;
      case 'enemyDie': this.tone(400, 0.4, 'triangle', 0.2 * vol, 0.25); this.noise(0.3, 800, 1, 0.2 * vol, 'lowpass', 100); break;
      case 'pickup': [0, 4, 7].forEach((n, i) => this.tone(660 * Math.pow(2, n / 12), 0.15, 'triangle', 0.15 * vol, 1, i * 0.06)); break;
      case 'switch': this.tone(440, 0.1, 'square', 0.1 * vol); this.tone(660, 0.2, 'square', 0.1 * vol, 1, 0.1); break;
      case 'door': this.noise(1.2, 120, 0.8, 0.35 * vol, 'lowpass', 60); this.tone(55, 1.2, 'sawtooth', 0.12 * vol, 0.8); break;
      case 'solve': [0, 4, 7, 12, 16].forEach((n, i) => this.tone(523 * Math.pow(2, n / 12), 0.35, 'triangle', 0.14 * vol, 1, i * 0.09)); break;
      case 'shard': [0, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), 0.6, 'sine', 0.16 * vol, 1, i * 0.12)); break;
      case 'bossRoar': this.tone(70, 1.1, 'sawtooth', 0.3 * vol, 0.6); this.noise(1.1, 300, 0.6, 0.3 * vol, 'lowpass', 80); break;
      case 'slam': this.tone(60, 0.6, 'sine', 0.5 * vol, 0.5); this.noise(0.5, 200, 0.7, 0.4 * vol, 'lowpass', 50); break;
      case 'shield': this.tone(880, 0.3, 'square', 0.08 * vol, 0.5); this.tone(660, 0.3, 'square', 0.08 * vol, 0.5, 0.08); break;
      case 'break': this.noise(0.6, 2500, 0.6, 0.35 * vol, 'highpass', 600); this.tone(990, 0.5, 'triangle', 0.15 * vol, 0.4); break;
      case 'shoot': this.tone(500, 0.18, 'square', 0.08 * vol, 0.5); break;
      case 'chat': this.tone(880, 0.08, 'sine', 0.1 * vol); break;
      case 'waypoint': [0, 5, 9, 12].forEach((n, i) => this.tone(440 * Math.pow(2, n / 12), 0.5, 'sine', 0.12 * vol, 1, i * 0.1)); break;
      default: break;
    }
  }

  // Gentle generative pentatonic music. Called every frame.
  update(dt) {
    if (!this.ctx || !G.settings.music) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const scales = {
      explore: [0, 2, 4, 7, 9, 12, 14, 16],
      dungeon: [0, 3, 5, 7, 10, 12, 15],
      battle: [0, 1, 5, 7, 8, 12, 13],
      victory: [0, 4, 7, 11, 12, 16, 19],
    };
    const base = { explore: 220, dungeon: 196, battle: 164.8, victory: 261.6 }[this.mood];
    const scale = scales[this.mood];
    const tempo = this.mood === 'battle' ? 0.22 : 0.42;
    this.musicTimer = tempo;
    this.step++;
    const bar = this.step % 16;
    if (bar === 0 || bar === 8) {
      const root = scale[[0, 3, 4, 2][(this.step >> 4) % 4] % scale.length];
      [0, 7, 12].forEach((iv) => this.tone(base * 0.5 * Math.pow(2, (root + iv) / 12), tempo * 7, 'sine', 0.12, 1, 0, this.musicGain));
    }
    if (Math.random() < (this.mood === 'battle' ? 0.8 : 0.55)) {
      const n = scale[Math.floor(Math.random() * scale.length)];
      this.tone(base * Math.pow(2, n / 12), tempo * 2.5, this.mood === 'battle' ? 'square' : 'triangle',
        this.mood === 'battle' ? 0.05 : 0.09, 1, 0, this.musicGain);
    }
    if (this.mood === 'battle' && bar % 4 === 0) this.tone(55, 0.2, 'sine', 0.4, 0.5, 0, this.musicGain);
  }
}

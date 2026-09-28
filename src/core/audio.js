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
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Shared reverb (generated impulse response); music always sends to it, effects more in dungeons
    const irLen = Math.floor(this.ctx.sampleRate * 2.8);
    const ir = this.ctx.createBuffer(2, irLen, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.6);
    }
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = ir;
    this.reverbOut = this.ctx.createGain();
    this.reverbOut.gain.value = 0.5;
    this.reverb.connect(this.reverbOut).connect(this.master);
    this.musicSend = this.ctx.createGain();
    this.musicSend.gain.value = 0.55;
    this.musicGain.connect(this.musicSend).connect(this.reverb);
    this.fxSend = this.ctx.createGain();
    this.fxSend.gain.value = 0.08;
    this.fxSend.connect(this.reverb);
    this.nextNote = 0;
    this.amb = {};
  }

  // Continuous rain bed; level 0..1
  setRain(level) {
    if (!this.ctx) return;
    if (!this.rainNode) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2200;
      f.Q.value = 0.4;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(f).connect(this.rainGain).connect(this.master);
      src.start();
      this.rainNode = src;
    }
    this.rainGain.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.5);
  }

  setVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  _env(node, t, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  // Wordless speech blip for dialogue (Animal Crossing style babble)
  voice(pitch) {
    if (!this.ctx) return;
    const f = pitch * (0.85 + Math.random() * 0.35);
    this.tone(f, 0.06, 'triangle', 0.07, 0.8 + Math.random() * 0.5);
    this.tone(f * 2.01, 0.04, 'sine', 0.025, 1);
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
    if (!dest && this.fxSend) g.connect(this.fxSend);
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
    if (this.fxSend) g.connect(this.fxSend);
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
      case 'glint': this.tone(2400, 0.18, 'sine', 0.08 * vol, 1.3); this.tone(3600, 0.12, 'sine', 0.05 * vol, 1, 0.04); break;
      case 'sprite': [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => this.tone(784 * Math.pow(2, n / 12), 0.18, 'triangle', 0.13 * vol, 1, i * 0.07)); break;
      case 'thunder': this.noise(2.5, 90, 0.5, 0.55 * vol, 'lowpass', 40); this.noise(0.5, 400, 0.5, 0.25 * vol, 'lowpass', 80); break;
      case 'flurry': this.tone(1200, 0.6, 'sine', 0.15 * vol, 0.4); this.noise(0.6, 3000, 0.5, 0.2 * vol, 'highpass', 800); break;
      case 'chat': this.tone(880, 0.08, 'sine', 0.1 * vol); break;
      case 'quest': [0, 4, 7, 12].forEach((n, i) => this.tone(523 * Math.pow(2, n / 12), 0.3, 'triangle', 0.14 * vol, 1, i * 0.1)); [7, 12, 16].forEach((n) => this.tone(523 * Math.pow(2, n / 12), 0.9, 'sine', 0.1 * vol, 1, 0.45)); break;
      case 'waypoint': [0, 5, 9, 12].forEach((n, i) => this.tone(440 * Math.pow(2, n / 12), 0.5, 'sine', 0.12 * vol, 1, i * 0.1)); break;
      default: break;
    }
  }

  // Soft piano-like voice: a few decaying partials
  piano(freq, t, vel = 0.5, dur = 2.4) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.16, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(9000, freq * 7), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), t + dur);
    g.connect(f).connect(this.musicGain);
    [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine'], [4.02, 0.05, 'sine']].forEach(([m, a, type]) => {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq * m;
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  pad(freq, t, dur, vol = 0.05) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(this.musicGain);
    for (const det of [-6, 6]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      o.connect(f).connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  drum(t, kind, vol = 1) {
    if (kind === 'kick') {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      g.gain.setValueAtTime(0.5 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(this.musicGain);
      o.start(t); o.stop(t + 0.32);
    } else {
      const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      s.buffer = this.noiseBuf;
      f.type = kind === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = kind === 'hat' ? 7000 : 1800;
      g.gain.setValueAtTime((kind === 'hat' ? 0.06 : 0.22) * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hat' ? 0.05 : 0.16));
      s.connect(f).connect(g).connect(this.musicGain);
      s.start(t, Math.random() * 0.5); s.stop(t + 0.2);
    }
  }

  // Look-ahead scheduled generative score. Moods: explore, night, dungeon, battle, boss, victory
  update(dt) {
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(G.settings.music ? 0.22 : 0, this.ctx.currentTime, 0.4);
    this.fxSend.gain.setTargetAtTime(G.player && G.player.inDungeon ? 0.35 : 0.08, this.ctx.currentTime, 0.5);
    this._ambience(dt);
    const now = this.ctx.currentTime;
    if (this.nextNote < now) this.nextNote = now + 0.05;
    let mood = this.mood;
    if (mood === 'explore' && G.sky && G.sky.night > 0.6) mood = 'night';
    if (mood === 'battle' && G.enemies && G.enemies.bossActive) mood = 'boss';
    const cfg = {
      explore: { root: 261.6, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19], step: 0.34, prog: [0, 5, 3, 4], density: 0.42 },
      night: { root: 220, scale: [0, 3, 5, 7, 10, 12, 15], step: 0.48, prog: [0, 3, 5, 4], density: 0.3 },
      dungeon: { root: 196, scale: [0, 1, 5, 7, 8, 12], step: 0.52, prog: [0, 1, 0, 5], density: 0.22 },
      battle: { root: 164.8, scale: [0, 3, 5, 7, 10, 12], step: 0.18, prog: [0, 0, 3, 5], density: 0.7 },
      boss: { root: 146.8, scale: [0, 1, 3, 6, 7, 10, 12], step: 0.17, prog: [0, 1, 0, 6], density: 0.75 },
      victory: { root: 293.7, scale: [0, 4, 7, 11, 12, 16, 19], step: 0.22, prog: [0, 5, 7, 5], density: 0.6 },
    }[mood];
    const semis = (n) => cfg.root * Math.pow(2, n / 12);
    while (this.nextNote < now + 0.3) {
      const t = this.nextNote;
      const st = this.step++;
      const bar = Math.floor(st / 16);
      const beat = st % 16;
      const chord = cfg.prog[bar % 4];
      if (beat === 0) {
        // Chord bed
        if (mood === 'battle' || mood === 'boss') this.pad(semis(chord - 12), t, cfg.step * 16, 0.035);
        else {
          this.piano(semis(chord - 12), t, 0.5, 4);
          this.piano(semis(chord - 5), t + 0.02, 0.35, 4);
        }
      }
      if ((mood === 'battle' || mood === 'boss') && beat % 2 === 0) {
        const pat = mood === 'boss' ? [1, 0, 0, 1, 0, 0, 1, 0] : [1, 0, 1, 0, 1, 0, 1, 1];
        if (pat[(beat / 2) % 8]) this.drum(t, 'kick', 0.8);
        if (beat % 8 === 4) this.drum(t, 'snare');
        this.drum(t, 'hat');
        // Driving bass ostinato
        this.tone(semis(chord - 24 + (beat % 4 === 2 ? 7 : 0)), cfg.step * 1.6, 'sawtooth', 0.05, 1, t - this.ctx.currentTime, this.musicGain);
      }
      if (mood === 'dungeon' && beat === 8) this.pad(semis(chord - 24), t, cfg.step * 8, 0.03);
      if (Math.random() < cfg.density && !(beat % 2 && mood !== 'battle' && mood !== 'boss')) {
        const n = cfg.scale[Math.floor(Math.random() * cfg.scale.length)] + chord;
        const vel = 0.25 + Math.random() * 0.35 + (beat % 4 === 0 ? 0.15 : 0);
        if (mood === 'battle' || mood === 'boss') this.tone(semis(n), cfg.step * 1.5, 'square', 0.035, 1, t - this.ctx.currentTime, this.musicGain);
        else this.piano(semis(n + 12), t, vel, mood === 'night' ? 3.5 : 2.4);
      }
      this.nextNote += cfg.step;
    }
  }

  _loopNoise(key, type, freq, q) {
    if (this.amb[key]) return this.amb[key];
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.amb[key] = { g, f };
    return this.amb[key];
  }

  // Wind (altitude & speed), surf near the shore, birds by day, crickets by night
  _ambience(dt) {
    const p = G.player;
    if (!p) return;
    const now = this.ctx.currentTime;
    const speed = Math.hypot(p.vel.x, p.vel.y, p.vel.z);
    const under = p.inDungeon;
    const wind = this._loopNoise('wind', 'lowpass', 500, 0.7);
    const wl = under ? 0.01 : 0.025 + Math.min(0.09, Math.max(0, p.pos.y - 40) * 0.0006) + (p.state === 'ride' || p.state === 'glide' ? Math.min(0.12, speed * 0.004) : 0);
    wind.g.gain.setTargetAtTime(wl, now, 0.5);
    wind.f.frequency.setTargetAtTime(400 + speed * 25, now, 0.5);
    const surf = this._loopNoise('surf', 'lowpass', 700, 0.5);
    const coast = !under && G.terrain ? G.terrain.heightAt(p.pos.x, p.pos.z) < 4 && p.pos.y < 20 : false;
    surf.g.gain.setTargetAtTime(coast ? 0.05 + Math.sin(now * 0.6) * 0.03 : 0, now, 0.8);
    this.ambT = (this.ambT || 0) - dt;
    if (this.ambT <= 0 && !under) {
      this.ambT = 0.6 + Math.random() * 2.5;
      const night = G.sky ? G.sky.night : 0;
      const raining = G.weather && G.weather.raining;
      if (!raining && night < 0.4 && p.pos.y < 90 && Math.random() < 0.6) {
        // Bird chirp: quick rising sine blips
        const base = 2200 + Math.random() * 1600;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.tone(base * (1 + i * 0.08), 0.07, 'sine', 0.025, 1.3, i * 0.09 + Math.random() * 0.02);
      } else if (night > 0.6 && !raining) {
        for (let i = 0; i < 6; i++) this.tone(4200, 0.03, 'square', 0.006, 1, i * 0.05);
      }
    }
  }

  // Footstep keyed to the surface under the player
  footstep(surface = 'grass') {
    if (!this.ctx) return;
    const cfg = {
      grass: [1800, 0.8, 0.05, 'bandpass'], stone: [3200, 2, 0.06, 'bandpass'], snow: [900, 0.6, 0.07, 'lowpass'],
      sand: [2600, 0.5, 0.04, 'highpass'], wood: [700, 3, 0.07, 'bandpass'], water: [1200, 0.6, 0.09, 'lowpass'],
    }[surface] || [1800, 0.8, 0.05, 'bandpass'];
    this.noise(0.06, cfg[0] * (0.9 + Math.random() * 0.2), cfg[1], cfg[2], cfg[3]);
  }
}

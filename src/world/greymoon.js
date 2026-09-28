// The Grey Moon: some nights a violet moon rises, the Hueless King's ink stirs, every camp and chest
// refreshes, enemies hit harder and ink wisps roam until dawn. The host decides; clients follow.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { damp } from '../core/math.js';

export class GreyMoon {
  constructor() {
    this.active = false;
    this.pending = false;
    this.w = 0;
    this.prevT = null;
    this.spawnT = 20;
  }

  get host() { return !G.net || G.net.isHost; }

  force() { this.pending = true; if (G.sky) G.sky.setTime(0.995); }

  sync(v) {
    const on = !!v;
    if (on && !this.active) this._rise();
    if (!on && this.active) this._set(false);
    this.active = on;
  }

  _set(on) {
    this.active = on;
    if (!on) G.hud.toast('Dawn breaks. The Grey Moon fades.', '#e0c8ff', 3);
  }

  _rise() {
    this.active = true;
    G.hud.banner('The Grey Moon Rises', 'Ink stirs across the land... camps and chests have returned', '#c8a8ff');
    G.audio.play('bossRoar', 0.6);
    const p = G.player;
    if (p) for (let i = 0; i < 6; i++) setTimeout(() => G.particles.burst(p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, 0.5, (Math.random() - 0.5) * 30)), { count: 40, color: 0x3a2a4a, speed: 3, up: 6, life: 2.5, size: 1.1, gravity: -2, alpha: 0.8 }), i * 250);
    if (this.host) {
      // Respawn every camp and reset their chests
      for (const c of G.enemies.camps) { c.respawn = 0; if (c.active) { for (const m of c.members) if (m.alive) G.enemies.remove(m); c.members = []; c.active = false; } }
      for (const it of G.enemies.decor.items) if (G.flags[it.flag]) G.trials._setFlag(it.flag, false);
    }
  }

  update(dt) {
    const sky = G.sky;
    if (!sky) return;
    const t = sky.dayT;
    if (this.host && this.prevT !== null) {
      const p = this.prevT;
      const crossed = (a) => (p <= t ? p < a && t >= a : a > p || a <= t); // handles the 1 -> 0 wrap
      if (crossed(0.78) && !this.pending && Math.random() < 0.3) this.pending = true;
      if (crossed(0.0) && this.pending) { this.pending = false; this._rise(); }
      if (crossed(0.25) && this.active) this._set(false);
    }
    this.prevT = t;
    this.w = damp(this.w, this.active ? 1 : 0, 0.6, dt);
    // Roaming ink wisps near players during the Grey Moon
    if (this.host && this.active) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 25;
        const roaming = G.enemies.list.filter((e) => e.roamer && e.alive).length;
        for (const pl of G.enemies.players()) {
          if (roaming >= 6 || !pl.alive || pl.pos.y < -200) continue;
          const a = Math.random() * Math.PI * 2;
          const pos = pl.pos.clone().add(new THREE.Vector3(Math.cos(a) * 28, 0, Math.sin(a) * 28));
          pos.y = G.terrain.heightAt(pos.x, pos.z);
          if (pos.y < 1) continue;
          const e = G.enemies.spawn(Math.random() < 0.5 ? 'inkling' : 'bounder', pos, {});
          e.roamer = true;
          e.dmgMul = (e.dmgMul || 1) * 1.25;
          G.enemies.fx('summon', pos);
        }
      }
    }
    if (this.host && !this.active) for (const e of G.enemies.list) if (e.roamer && e.alive && e.pos.distanceTo(G.player.pos) > 150) G.enemies.remove(e);
  }

  // Violet tint over the night palette
  tint(k) {
    const w = this.w;
    if (w < 0.001) return k;
    const out = { ...k };
    out.top = k.top.clone().lerp(new THREE.Color(0x24122e), w * 0.8);
    out.hor = k.hor.clone().lerp(new THREE.Color(0x5a3868), w * 0.7);
    out.fog = k.fog.clone().lerp(new THREE.Color(0x3e2a4e), w * 0.7);
    out.sun = k.sun.clone().lerp(new THREE.Color(0xc8a0ff), w * 0.8);
    out.hemiS = k.hemiS.clone().lerp(new THREE.Color(0x7a5aa0), w * 0.6);
    return out;
  }
}

// Shooting stars: on clear nights the host sends a star streaking down near a player. It leaves a
// glowing Star Fragment pickup (with a light beam) worth a pile of Pigment to whoever grabs it.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

export const STAR_PIGMENT = 20;

export class Stars {
  constructor() {
    this.t = 40;
    this.streaks = [];
  }

  // Visual streak from high in the sky down to the landing spot
  streak(pos) {
    const from = pos.clone().add(new THREE.Vector3(70, 160, -40));
    this.streaks.push({ from, to: pos.clone(), t: 0 });
    G.audio.play('glint', 1);
    G.hud.caption('A shooting star whistles down', pos);
    if (G.player && G.player.pos.distanceTo(pos) < 200) G.hud.toast('A shooting star! It landed nearby...', '#fff4c0', 3);
  }

  update(dt) {
    for (const s of [...this.streaks]) {
      s.t += dt / 1.4;
      const k = Math.min(1, s.t);
      const p = s.from.clone().lerp(s.to, k * k);
      G.particles.burst(p, { count: 3, color: 0xfff4c0, speed: 0.4, life: 0.9, size: 1.1, pool: 'glow', gravity: 0 });
      if (s.t >= 1) {
        this.streaks.splice(this.streaks.indexOf(s), 1);
        G.particles.burst(s.to.clone().setY(s.to.y + 1), { count: 70, color: 0xfff0a0, speed: 9, up: 5, life: 1.2, size: 0.6, pool: 'glow', gravity: 6 });
        G.audio.play('slam', 0.4);
      }
    }
    const sky = G.sky;
    if (!sky || !G.enemies.isHost) return;
    const clear = !G.weather || G.weather.w < 0.3;
    if (sky.night < 0.7 || !clear || G.greyMoon?.active) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 70 + Math.random() * 70;
    const cand = G.enemies.players().filter((p) => p.alive && p.pos.y > -200);
    if (!cand.length || G.enemies.pickups.some((k) => k.kind === 'star')) return;
    const pl = cand[Math.floor(Math.random() * cand.length)];
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 80;
      const x = pl.pos.x + Math.cos(a) * d, z = pl.pos.z + Math.sin(a) * d;
      const h = G.terrain.heightAt(x, z);
      if (h < 2) continue;
      const pos = new THREE.Vector3(x, h, z);
      G.enemies.fx('star', pos);
      setTimeout(() => { const k = G.enemies.spawnPickup('star', pos.clone().setY(h + 0.8)); k.life = 300; }, 1400);
      return;
    }
  }
}

// The Colour Festival: once Mira has her dyes, Palette Hollow celebrates every night with
// fireworks in the four colours over the village square, and paper lanterns strung round the plaza.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { VILLAGE } from './layout.js';

export const festivalOn = (flags, night) => !!flags.q_mira_done && night > 0.55;

export class Festival {
  constructor(scene) {
    this.t = 2;
    this.announced = false;
    // A ring of lanterns round the plaza, lit only during the festival
    const n = 18, R = 17;
    const geo = new THREE.SphereGeometry(0.28, 10, 8).scale(1, 1.3, 1);
    this.lanterns = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = VILLAGE.x + Math.cos(a) * R, z = VILLAGE.z + Math.sin(a) * R;
      m.makeTranslation(x, G.terrain.heightAt(x, z) + 3.6 + Math.sin(i * 1.7) * 0.3, z);
      this.lanterns.setMatrixAt(i, m);
      this.lanterns.setColorAt(i, new THREE.Color(COLORS[i % 4].hex).multiplyScalar(1.6));
    }
    this.lanterns.visible = false;
    scene.add(this.lanterns);
  }

  _firework() {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 25;
    const x = VILLAGE.x + Math.cos(a) * r, z = VILLAGE.z + Math.sin(a) * r;
    const y = G.terrain.heightAt(VILLAGE.x, VILLAGE.z) + 45 + Math.random() * 25;
    const c = COLORS[Math.floor(Math.random() * 4)];
    const pos = new THREE.Vector3(x, y, z);
    G.particles.burst(pos, { count: 70, color: c.hex, speed: 14, life: 1.6, size: 0.9, pool: 'glow', gravity: 3 });
    G.particles.burst(pos, { count: 20, color: 0xffffff, speed: 6, life: 0.8, size: 0.6, pool: 'glow', gravity: 2 });
    const d = G.player ? G.player.pos.distanceTo(pos) : 999;
    if (d < 250) {
      const v = Math.max(0.15, 1 - d / 250);
      G.audio.noise?.(0.5, 300, 0.6, 0.25 * v, 'lowpass', 80);
      G.audio.tone?.(1800 + Math.random() * 600, 0.4, 'sine', 0.03 * v, 0.4, 0.05);
    }
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    const on = festivalOn(G.flags, G.sky?.night ?? 0) && !p.inDungeon;
    this.lanterns.visible = on;
    if (!on) return;
    if (!this.announced && Math.hypot(p.pos.x - VILLAGE.x, p.pos.z - VILLAGE.z) < 200) {
      this.announced = true;
      G.hud.toast('The Colour Festival lights up Palette Hollow!', '#ffe08a', 4);
    }
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1.2 + Math.random() * 2.5;
      if (Math.hypot(p.pos.x - VILLAGE.x, p.pos.z - VILLAGE.z) < 600) this._firework();
    }
  }
}

// Horde night: under the Grey Moon, if anyone is in Palette Hollow the ink marches on the village in
// three waves. The villagers take shelter indoors; hold the plaza to earn Pigment. The host runs the
// waves and shares progress through the 'siege' flag, so every player sees the same count.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { VILLAGE } from './layout.js';

export const SIEGE_PIGMENT = 25;
export const WAVES = [
  ['inkling', 'inkling', 'bounder', 'inkling', 'bounder'],
  ['bounder', 'bounder', 'inkling', 'inkling', 'bounder', 'bounder', 'inkling'],
  ['knight', 'bounder', 'bounder', 'inkling', 'inkling', 'knight', 'bounder', 'inkling', 'bounder'],
];

// Is anyone close enough to the village for the ink to march?
export const nearVillage = (pos, r = 90) => Math.hypot(pos.x - VILLAGE.x, pos.z - VILLAGE.z) < r;

export class Siege {
  constructor() {
    this.run = null;
    this.done = false; // one siege per Grey Moon
    this.syncT = 0;
    this.center = new THREE.Vector3(VILLAGE.x, G.terrain.heightAt(VILLAGE.x, VILLAGE.z), VILLAGE.z);
  }

  get host() { return !G.net || G.net.isHost; }

  _spawnWave(i) {
    const types = WAVES[i];
    types.forEach((t, k) => {
      const a = (k / types.length) * Math.PI * 2 + i;
      const x = VILLAGE.x + Math.cos(a) * 70, z = VILLAGE.z + Math.sin(a) * 70;
      const pos = new THREE.Vector3(x, G.terrain.heightAt(x, z), z);
      const e = G.enemies.spawn(t, pos, {});
      e.siege = true;
      e.home = this.center.clone(); // they march on the plaza, then fight whoever they find
      e.dmgMul = (e.dmgMul || 1) * 1.15;
      G.enemies.fx('summon', pos);
    });
  }

  _sync(force = false) {
    const r = this.run;
    const left = r ? G.enemies.list.filter((e) => e.siege && e.alive).length : 0;
    const v = r ? { w: r.wave, left } : null;
    if (force || JSON.stringify(v) !== JSON.stringify(G.flags.siege ?? null)) G.trials._setFlag('siege', v);
  }

  // Everyone reacts to the shared flag (host included)
  onFlag(k, v) {
    if (k !== 'siege') return;
    const p = G.player;
    if (v && v.w === 1 && !this.announced && p && nearVillage(p.pos, 200)) {
      this.announced = true;
      G.hud.banner('The Ink Marches on Palette Hollow', 'The villagers have taken shelter. Hold the plaza!', '#c8a8ff');
      G.audio.play('bossRoar', 0.7);
    }
    if (v && v.done) {
      this.announced = false;
      if (p && nearVillage(p.pos, 150)) {
        p.pigment += SIEGE_PIGMENT;
        G.audio.play('shard');
        G.hud.banner('Palette Hollow Holds!', `The ink retreats · +${SIEGE_PIGMENT} Pigment`, '#ffe08a');
        G.honours?.event('siege');
      }
    }
  }

  get sheltering() { const v = G.flags.siege; return !!v && !v.done; }

  update(dt) {
    const p = G.player;
    if (!p) return;
    // Villagers shelter indoors while the siege runs
    const shelter = this.sheltering;
    if (shelter !== this._shelter && G.quests) for (const n of G.quests.npcs) { n.c.group.visible = !shelter; n.mark.visible = !shelter; }
    this._shelter = shelter;
    const v = G.flags.siege;
    if (v && !v.done && nearVillage(p.pos, 200)) G.hud.setRush?.(`Wave ${v.w} / ${WAVES.length} · ${v.left} ink creatures left`, 'Horde night');
    else if (this._rushShown) G.hud.setRush?.(null);
    this._rushShown = !!(v && !v.done);
    if (!this.host) return;
    const moon = G.greyMoon?.active;
    if (!moon) {
      if (this.run || this.done) {
        for (const e of G.enemies.list.filter((q) => q.siege)) G.enemies.remove(e);
        this.run = null;
        this.done = false;
        if (G.flags.siege) G.trials._setFlag('siege', null);
      }
      return;
    }
    const players = G.enemies.players().filter((q) => q.alive && q.pos.y > -200);
    if (!this.run && !this.done) {
      if (players.some((q) => nearVillage(q.pos))) { this.run = { wave: 0, t: 4, away: 0 }; }
      return;
    }
    const r = this.run;
    if (!r) return;
    // Everyone left: the ink wanders off and the siege is over for tonight
    r.away = players.some((q) => nearVillage(q.pos, 160)) ? 0 : r.away + dt;
    if (r.away > 60) {
      for (const e of G.enemies.list.filter((q) => q.siege)) G.enemies.remove(e);
      this.run = null;
      this.done = true;
      G.trials._setFlag('siege', null);
      return;
    }
    const alive = G.enemies.list.some((e) => e.siege && e.alive);
    if (!alive) {
      r.t -= dt;
      if (r.t <= 0) {
        if (r.wave >= WAVES.length) {
          this.run = null;
          this.done = true;
          G.trials._setFlag('siege', { w: WAVES.length, left: 0, done: true });
          return;
        }
        this._spawnWave(r.wave);
        r.wave++;
        r.t = 5;
        this._sync(true);
      }
    }
    this.syncT -= dt;
    if (this.syncT <= 0) { this.syncT = 1; this._sync(); }
  }
}

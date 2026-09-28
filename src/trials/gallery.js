// Gallery of Echoes: a post-game boss rush far beneath Palette Hollow. Once the Hueless King falls,
// the village statue opens a way down. Echoes of the four trial bosses (at 60% strength) come one
// after another; the host runs the gauntlet and the fastest clear is kept as a room record.
import * as THREE from 'three';
import { makePortal } from './portal.js';
import { G, COLORS, DUNGEON_Y } from '../core/ctx.js';
import { VILLAGE } from '../world/layout.js';
import { MAT } from '../world/props.js';
import { fmtTime } from '../world/races.js';

export const GALLERY = { x: 0, y: DUNGEON_Y - 320, z: 0, r: 30 };
export const RUSH = ['frostmaw', 'magmaw', 'shellback', 'galewing'];

export class Gallery {
  constructor(parent) {
    this.arena = { ...GALLERY };
    this.run = null;
    this.spawn = new THREE.Vector3(GALLERY.x, GALLERY.y + 0.5, GALLERY.z + GALLERY.r - 5);
    this._build(parent);
    const vy = G.terrain.heightAt(VILLAGE.x, VILLAGE.z);
    G.world.interactables.push({
      pos: new THREE.Vector3(VILLAGE.x, vy + 1, VILLAGE.z + 3.4), radius: 3,
      enabled: () => !!G.flags.final,
      prompt: () => {
        const b = G.flags.rush_best;
        return `Descend to the Gallery of Echoes${b ? ` (record ${fmtTime(b.t)})` : ''}`;
      },
      action: () => this.enter(),
    });
    G.world.interactables.push({
      pos: new THREE.Vector3(GALLERY.x, GALLERY.y + 1, GALLERY.z + GALLERY.r - 2), radius: 3,
      prompt: () => 'Return to Palette Hollow',
      action: () => this.leave(),
    });
  }

  _build(parent) {
    const { x, y, z, r } = GALLERY;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(r + 2, r + 2, 1, 40), MAT.dungeonFloor);
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    g.add(floor);
    G.collision.addBox(x, y - 0.5, z, (r + 2) * 2, 1, (r + 2) * 2);
    // Ring wall with tall arches
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const wx = Math.cos(a) * (r + 1.5), wz = Math.sin(a) * (r + 1.5);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(7, 12, 1.4), MAT.dungeon);
      seg.position.set(wx, 6, wz);
      seg.rotation.y = -a + Math.PI / 2;
      g.add(seg);
      G.collision.addBox(x + wx, y + 6, z + wz, 3.4, 12, 3.4);
    }
    // Four echo pillars, one per colour, their crystals lighting up as each echo falls
    this.crystals = COLORS.map((c, i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(a) * (r - 6), pz = Math.sin(a) * (r - 6);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 7, 8), MAT.stoneDark);
      pillar.position.set(px, 3.5, pz);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1), new THREE.MeshLambertMaterial({ color: c.hex, emissive: c.hex, emissiveIntensity: 0.15 }));
      crystal.position.set(px, 8, pz);
      g.add(pillar, crystal);
      G.collision.addCylinder(x + px, z + pz, 1.1, y, y + 7);
      return crystal;
    });
    const light = new THREE.PointLight(0xffe8c0, 2.5, 90, 1.2);
    light.position.set(0, 18, 0);
    g.add(light);
    // Return portal
    const portal = makePortal(0xc8a8ff, 1.6);
    portal.position.set(0, 2, r - 2);
    g.add(portal);
    this.group = g;
  }

  enter() {
    const p = G.player;
    p.state = 'air';
    p.pos.copy(this.spawn);
    p.vel.set(0, 0, 0);
    p.checkpoint.copy(this.spawn);
    p.lastSafe.copy(this.spawn);
    p.camYaw = 0;
    p.yaw = Math.PI;
    p.camPos.copy(this.spawn).add(new THREE.Vector3(0, 3, 5));
    G.audio.play('waypoint');
    G.audio.mood = 'dungeon';
    G.hud.banner('Gallery of Echoes', 'Four echoes wait in the dark. Defeat them all, as fast as you can.', '#c8a8ff');
  }

  leave() {
    const p = G.player;
    const y = G.terrain.heightAt(VILLAGE.x, VILLAGE.z + 6) + 0.5;
    p.pos.set(VILLAGE.x, y, VILLAGE.z + 6);
    p.vel.set(0, 0, 0);
    p.state = 'air';
    p.checkpoint.copy(p.pos);
    p.lastSafe.copy(p.pos);
    p.camPos.copy(p.pos).add(new THREE.Vector3(0, 3, 6));
    G.audio.mood = 'explore';
    G.audio.play('waypoint');
  }

  inside(pos) { return Math.hypot(pos.x - GALLERY.x, pos.z - GALLERY.z) < GALLERY.r + 2 && Math.abs(pos.y - GALLERY.y) < 25; }

  _spawnEcho(stage) {
    const type = RUSH[stage];
    const e = G.enemies.spawn(type, new THREE.Vector3(GALLERY.x, GALLERY.y + (type === 'galewing' ? 8 : 0.5), GALLERY.z - 8), { arena: this.arena });
    e.rush = true;
    e.maxHp = e.hp = Math.round(e.def.hp * 0.6);
    e.yaw = 0;
    G.enemies.fx('roar', e.pos);
  }

  update(dt) {
    const time = G.time;
    this.crystals.forEach((c, i) => {
      const lit = this.run ? i < this.run.stage : false;
      c.material.emissiveIntensity = lit ? 1.2 : 0.15 + Math.sin(time * 2 + i) * 0.05;
      c.rotation.y = time * 0.6 + i;
    });
    const p = G.player;
    if (p && this.inside(p.pos)) {
      const r = this.run;
      const b = G.flags.rush_best;
      G.hud.setRush?.(this.cleared && !r ? 'The echoes are stilled. Return through the portal.' : r ? `Echo ${Math.min(r.stage + 1, RUSH.length)} / ${RUSH.length} · ${fmtTime(r.t)}${b ? ` · record ${fmtTime(b.t)}` : ''}` : 'Step into the light to begin');
    } else if (!G.targets?.run) G.hud.setRush?.(null);
    if (!G.enemies.isHost) return;
    const pls = G.enemies.players().filter((q) => q.alive && this.inside(q.pos));
    const echo = G.enemies.list.find((e) => e.rush && e.alive);
    if (!this.run) {
      // After a clear, wait until everyone has left before the echoes return
      if (this.cleared) { if (!pls.length) this.cleared = false; return; }
      // Begin once someone walks into the middle of the gallery
      if (pls.some((q) => Math.hypot(q.pos.x - GALLERY.x, q.pos.z - GALLERY.z) < GALLERY.r - 10)) {
        this.run = { stage: 0, t: 0, cd: 2 };
        G.audio.play('bossRoar', 0.6);
      }
      return;
    }
    const run = this.run;
    if (!pls.length) {
      // Everyone left or fell: the echoes fade
      for (const e of G.enemies.list.filter((q) => q.rush)) G.enemies.remove(e);
      this.run = null;
      return;
    }
    run.t += dt;
    if (echo) return;
    run.cd -= dt;
    if (run.cd > 0) return;
    if (run.spawned === run.stage) {
      // The current echo has fallen
      run.stage++;
      run.cd = 3;
      if (run.stage >= RUSH.length) {
        const best = G.flags.rush_best;
        const names = pls.map((q) => (q.local ? G.player.name : G.peers.get(q.id)?.name) || 'Painter').join(' & ');
        if (!best || run.t < best.t) G.trials._setFlag('rush_best', { t: Math.round(run.t * 10) / 10, n: names.slice(0, 60) });
        G.enemies.fx('rushClear', new THREE.Vector3(GALLERY.x, GALLERY.y + 2, GALLERY.z));
        this.run = null;
        this.cleared = true;
      }
      return;
    }
    this._spawnEcho(run.stage);
    run.spawned = run.stage;
  }
}

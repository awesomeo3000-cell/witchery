// Critters: butterflies flutter over the grass by day and fireflies drift about at night. They spook
// if you rush at them, so sneak up to catch one. Sunwings (butterflies) restore stamina and
// Glowbugs (fireflies) make meals that hush your footsteps. Critters are per player.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

export const MAX_FLIES = 8;
export const MAX_BUGS = 16;
export const SPOOK_R = 3.4;
export const CATCH_R = 1.3;
const WING_COLORS = [0xffb040, 0xf2c229, 0x9ee0ff, 0xf0a8ec, 0xffffff];

// Would a critter at this distance take fright? Sneaking lets you get close; riding never does.
export const spooked = (d, sneaking, riding) => (riding ? d < SPOOK_R * 2.5 : !sneaking && d < SPOOK_R);

export class Critters {
  constructor(scene) {
    const wing = new THREE.CircleGeometry(0.22, 6).scale(1, 1.4, 1).translate(0.19, 0.07, 0).rotateX(-Math.PI / 2);
    this.wings = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), MAX_FLIES * 2);
    this.wings.frustumCulled = false;
    const bug = new THREE.SphereGeometry(0.1, 6, 4);
    this.bugs = new THREE.InstancedMesh(bug, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8ff7a).multiplyScalar(2.2) }), MAX_BUGS);
    this.bugs.frustumCulled = false;
    scene.add(this.wings, this.bugs);
    this.list = [];
    this.spawnT = 0;
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_FLIES * 2; i++) this.wings.setMatrixAt(i, this.zero);
    for (let i = 0; i < MAX_BUGS; i++) this.bugs.setMatrixAt(i, this.zero);
  }

  _free(kind) {
    const used = new Set(this.list.filter((c) => c.kind === kind).map((c) => c.slot));
    const max = kind === 'fly' ? MAX_FLIES : MAX_BUGS;
    for (let i = 0; i < max; i++) if (!used.has(i)) return i;
    return -1;
  }

  _spawn(kind, p) {
    const slot = this._free(kind);
    if (slot < 0) return;
    const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 34;
    const x = p.pos.x + Math.cos(a) * d, z = p.pos.z + Math.sin(a) * d;
    const h = G.terrain.heightAt(x, z);
    if (h < 1.5 || h > 120) return;
    const w = G.terrain.biome(x, z);
    const dom = Object.entries(w).sort((m, n) => n[1] - m[1])[0][0];
    if (kind === 'fly' && !['meadow', 'bloom', 'spring'].includes(dom)) return;
    if (kind === 'bug' && ['ember', 'sky'].includes(dom)) return;
    const c = { kind, slot, home: new THREE.Vector3(x, h, z), pos: new THREE.Vector3(x, h + 1, z), phase: Math.random() * 10, flee: 0, fleeDir: new THREE.Vector3(), age: 0 };
    if (kind === 'fly') {
      const col = new THREE.Color(WING_COLORS[Math.floor(Math.random() * WING_COLORS.length)]);
      this.wings.setColorAt(slot * 2, col);
      this.wings.setColorAt(slot * 2 + 1, col);
      this.wings.instanceColor.needsUpdate = true;
    }
    this.list.push(c);
  }

  _remove(c) {
    this.list.splice(this.list.indexOf(c), 1);
    if (c.kind === 'fly') { this.wings.setMatrixAt(c.slot * 2, this.zero); this.wings.setMatrixAt(c.slot * 2 + 1, this.zero); } else this.bugs.setMatrixAt(c.slot, this.zero);
  }

  _catch(c) {
    const key = c.kind === 'fly' ? 'sunwing' : 'glowbug';
    G.forage.inv[key] = (G.forage.inv[key] || 0) + 1;
    G.audio.play('critter');
    G.hud.toast(`${c.kind === 'fly' ? '🦋 Sunwing' : '✨ Glowbug'} (${G.forage.inv[key]})`, c.kind === 'fly' ? '#ffd890' : '#e0ff9a', 1.4);
    G.particles.burst(c.pos, { count: 10, color: c.kind === 'fly' ? 0xffd890 : 0xd8ff7a, speed: 1.5, life: 0.6, size: 0.25, pool: 'glow', gravity: -0.5 });
    G.honours?.event('critter');
    this._remove(c);
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    const out = p.inDungeon;
    const night = G.sky?.night ?? 0;
    const raining = G.weather?.rain?.visible;
    // Top up the swarm around the player
    this.spawnT -= dt;
    if (!out && this.spawnT <= 0) {
      this.spawnT = 0.8;
      const flies = this.list.filter((c) => c.kind === 'fly').length;
      const bugs = this.list.length - flies;
      if (night < 0.3 && !raining && flies < MAX_FLIES) this._spawn('fly', p);
      if (night > 0.6 && bugs < MAX_BUGS) this._spawn('bug', p);
    }
    const t = G.time;
    const riding = p.state === 'ride';
    for (const c of [...this.list]) {
      c.age += dt;
      const dp = c.pos.distanceTo(p.pos.clone().setY(p.pos.y + 0.9));
      const wrongTime = c.kind === 'fly' ? night > 0.45 || raining : night < 0.45;
      if (out || dp > 80 || (wrongTime && c.flee <= 0)) { if (out || dp > 80) { this._remove(c); continue; } c.flee = 3; c.fleeDir.set(Math.random() - 0.5, 0.8, Math.random() - 0.5).normalize(); }
      if (c.flee > 0) {
        c.flee -= dt;
        c.pos.addScaledVector(c.fleeDir, dt * 5);
        if (c.flee <= 0) { this._remove(c); continue; }
      } else {
        // Lazy wandering around the spot it was born
        const k = t * (c.kind === 'fly' ? 0.6 : 0.35) + c.phase;
        const want = c.home.clone().add(new THREE.Vector3(Math.sin(k * 1.3) * 2.2, (c.kind === 'fly' ? 0.9 : 1.3) + Math.sin(k * 2.1) * 0.5, Math.cos(k * 0.9) * 2.2));
        c.pos.lerp(want, Math.min(1, dt * 2));
        if (p.alive && dp < CATCH_R) { this._catch(c); continue; }
        if (p.alive && spooked(dp, p.sneaking, riding)) {
          c.flee = 2.5;
          c.fleeDir.copy(c.pos).sub(p.pos).setY(0).normalize().setY(0.9).normalize();
        }
      }
      if (c.kind === 'fly') {
        const flap = Math.sin(t * 22 + c.phase) * 1.1;
        const yaw = Math.atan2(Math.cos((t * 0.6 + c.phase) * 1.3), -Math.sin((t * 0.6 + c.phase) * 0.9));
        for (const s of [0, 1]) {
          this.e.set(0, yaw + (s ? Math.PI : 0), flap, 'YXZ');
          this.q.setFromEuler(this.e);
          this.m4.compose(c.pos, this.q, new THREE.Vector3(1, 1, 1));
          this.wings.setMatrixAt(c.slot * 2 + s, this.m4);
        }
      } else {
        const glow = 0.4 + Math.max(0, Math.sin(t * 2.5 + c.phase * 3)) * 0.9;
        this.m4.makeScale(glow, glow, glow).setPosition(c.pos);
        this.bugs.setMatrixAt(c.slot, this.m4);
      }
    }
    this.wings.instanceMatrix.needsUpdate = true;
    this.bugs.instanceMatrix.needsUpdate = true;
  }
}

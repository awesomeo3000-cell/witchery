// Fishing: schools of fish circle in the lake and the coastal shallows. Paint a Frost floe over a
// school and the fish under it freeze into the ice; walk (or swim) up to pick them out. Most are
// Glimmerfish, a few are rare Prismfin. Fish are per player and return a few minutes later.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAKE } from './layout.js';

export const SCHOOLS = 12;
export const PER_SCHOOL = 5;
export const PRISM_CHANCE = 0.15;
export const RESPAWN = 180;
const FREEZE_R = 2.6;

// Shallow water: deep enough to swim in, shallow enough to see the fish
export const fishSpot = (h) => h < -1.2 && h > -5.5;

export function fishSites(terrain, n = SCHOOLS, seed = 5151) {
  const rand = mulberry32(seed);
  const out = [];
  const far = (x, z) => out.every((q) => Math.hypot(q.x - x, q.z - z) > 55);
  // A few in the lake first, then the coast
  for (let i = 0; i < 400 && out.length < 3; i++) {
    const a = rand() * Math.PI * 2, d = rand() * LAKE.r * 0.8;
    const x = LAKE.x + Math.cos(a) * d, z = LAKE.z + Math.sin(a) * d;
    if (fishSpot(terrain.heightAt(x, z)) && far(x, z)) out.push({ x, z, lake: true });
  }
  for (let i = 0; i < 6000 && out.length < n; i++) {
    const a = rand() * Math.PI * 2, d = 200 + rand() * 700;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (fishSpot(terrain.heightAt(x, z)) && far(x, z)) out.push({ x, z, lake: false });
  }
  return out;
}

export class Fishing {
  constructor(scene) {
    const body = new THREE.SphereGeometry(1, 10, 6).scale(0.24, 0.19, 0.62);
    const tail = new THREE.ConeGeometry(0.24, 0.45, 4).rotateX(-Math.PI / 2).scale(0.3, 1, 1).translate(0, 0, -0.74);
    const fin = new THREE.ConeGeometry(0.09, 0.27, 3).translate(0, 0.24, 0.03);
    const geo = mergeGeometries([body, tail, fin]);
    this.sites = fishSites(G.terrain);
    const count = this.sites.length * PER_SCHOOL;
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x223344 }), Math.max(1, count));
    this.mesh.frustumCulled = false;
    this.mesh.count = count;
    scene.add(this.mesh);
    const rand = mulberry32(99);
    this.fish = [];
    this.sites.forEach((s, si) => {
      for (let k = 0; k < PER_SCHOOL; k++) {
        const f = {
          idx: this.fish.length, site: s, si,
          r: 1.2 + rand() * 2.2, a: rand() * Math.PI * 2, speed: (0.5 + rand() * 0.5) * (rand() < 0.5 ? -1 : 1),
          depth: 0.18 + rand() * 0.2, jump: 3 + rand() * 10,
          prism: rand() < PRISM_CHANCE,
          state: 'swim', t: 0, pos: new THREE.Vector3(), yaw: 0, flee: 0,
        };
        this.mesh.setColorAt(f.idx, new THREE.Color(f.prism ? 0xe86ad8 : 0x8ad0f0));
        f.pos.set(s.x + Math.cos(f.a) * f.r, -f.depth, s.z + Math.sin(f.a) * f.r);
        this.mesh.setMatrixAt(f.idx, new THREE.Matrix4().setPosition(f.pos));
        this.fish.push(f);
      }
    });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.checked = new WeakSet();
  }

  // A Frost splat on the water freezes every swimming fish beneath it
  _checkFloes() {
    for (const s of G.paint.splats) {
      if (this.checked.has(s)) continue;
      this.checked.add(s);
      if (!s.onWater || s.element !== 'ice' || s.life <= 0) continue;
      let n = 0;
      for (const f of this.fish) {
        if (f.state !== 'swim') continue;
        if (Math.hypot(f.pos.x - s.pos.x, f.pos.z - s.pos.z) > FREEZE_R) continue;
        f.state = 'frozen';
        f.t = 0;
        f.pos.set(s.pos.x + (f.pos.x - s.pos.x) * 0.6, s.pos.y + 0.28, s.pos.z + (f.pos.z - s.pos.z) * 0.6);
        n++;
      }
      if (n) {
        G.audio.play('ice', 0.6);
        G.particles.burst(s.pos.clone().setY(s.pos.y + 0.4), { count: 12, color: 0xd8f4ff, speed: 2, up: 2, life: 0.8, size: 0.35, pool: 'glow' });
        if (!G.guide?.seen.has('fish')) { G.guide?.seen.add('fish'); G.hud.toast('Fish frozen in the ice! Walk over to pick them up.', '#9ee0ff', 3); }
      }
    }
  }

  _catch(f) {
    const key = f.prism ? 'prismfin' : 'fish';
    G.forage.inv[key] = (G.forage.inv[key] || 0) + 1;
    f.state = 'gone';
    f.t = RESPAWN;
    G.audio.play('pickup', 0.6);
    G.hud.toast(`${f.prism ? '🐠 Prismfin' : '🐟 Glimmerfish'} (${G.forage.inv[key]})`, f.prism ? '#f0a8ec' : '#b8e8ff', 1.4);
    G.honours?.event('fish');
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    const show = !p.inDungeon;
    this.mesh.visible = show;
    if (!show) return;
    this._checkFloes();
    const t = G.time;
    let dirty = false;
    for (const f of this.fish) {
      const s = f.site;
      const near = Math.abs(s.x - p.pos.x) < 140 && Math.abs(s.z - p.pos.z) < 140;
      if (f.state === 'gone') {
        f.t -= dt;
        if (f.t <= 0) { f.state = 'swim'; f.prism = Math.random() < PRISM_CHANCE; this.mesh.setColorAt(f.idx, new THREE.Color(f.prism ? 0xe86ad8 : 0x8ad0f0)); this.mesh.instanceColor.needsUpdate = true; }
        else { this.m4.makeScale(0, 0, 0); this.mesh.setMatrixAt(f.idx, this.m4); dirty = true; continue; }
      }
      if (!near && f.state === 'swim') continue;
      if (f.state === 'swim') {
        // Dart away from a swimmer or someone wading close
        const dp = Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z);
        if (dp < 3.5 && p.pos.y < 1.5) f.flee = 1.2;
        f.flee = Math.max(0, f.flee - dt);
        f.a += f.speed * dt * (1 + f.flee * 3) / f.r * 1.4;
        const wob = Math.sin(t * 0.7 + f.idx) * 0.6;
        const x = s.x + Math.cos(f.a) * (f.r + wob), z = s.z + Math.sin(f.a) * (f.r + wob);
        f.yaw = Math.atan2(-Math.sin(f.a) * Math.sign(f.speed), Math.cos(f.a) * Math.sign(f.speed));
        f.pos.set(x, -f.depth + Math.sin(t * 2 + f.idx) * 0.05, z);
        let pitch = 0;
        // Now and then a fish leaps clear of the water, so schools are easy to spot
        f.jump -= dt;
        if (f.jump < 0) {
          const k = -f.jump / 0.7;
          if (k >= 1) {
            f.jump = 6 + Math.random() * 12;
            G.water?.ripple(x, z, 0.5);
          } else {
            if (k < dt / 0.7 + 0.001) { G.water?.ripple(x, z, 0.4); if (Math.hypot(x - p.pos.x, z - p.pos.z) < 40) G.audio.play('fishSplash', 0.6); }
            f.pos.y = Math.sin(k * Math.PI) * 0.9 - 0.1;
            pitch = (k - 0.5) * 1.6;
          }
        }
        this.q.setFromEuler(new THREE.Euler(pitch, f.yaw, Math.sin(t * 9 + f.idx) * 0.15, 'YXZ'));
      } else if (f.state === 'frozen') {
        f.t += dt;
        // Thawed once the floe melts
        const floe = G.paint.splats.find((q) => q.onWater && q.element === 'ice' && q.life > 0 && Math.hypot(q.pos.x - f.pos.x, q.pos.z - f.pos.z) < FREEZE_R);
        if (!floe && f.t > 0.5) { f.state = 'swim'; continue; }
        this.q.setFromEuler(new THREE.Euler(0, f.yaw, Math.PI / 2));
        if (p.alive && p.pos.distanceTo(f.pos) < 1.8) { this._catch(f); continue; }
        if (Math.random() < dt * 2) G.particles.burst(f.pos, { count: 1, color: f.prism ? 0xf0a8ec : 0xd8f4ff, speed: 0.3, up: 0.8, life: 0.8, size: 0.3, pool: 'glow', gravity: -0.5 });
      }
      this.m4.compose(f.pos, this.q, new THREE.Vector3(1, 1, 1));
      this.mesh.setMatrixAt(f.idx, this.m4);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

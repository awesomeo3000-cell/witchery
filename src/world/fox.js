// The Paint Fox: a little companion that trots after you, sits when you rest, fetches nearby
// Pigment, and now and then catches the scent of an unsolved puzzle or a hidden Paint Sprite.
// It's local to each player (friends have their own).
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { damp, dampAngle } from '../core/math.js';
import { softLit } from './props.js';

const lam = (c, o = {}) => softLit(new THREE.MeshLambertMaterial({ color: c, ...o }), { rim: 0.45, wrap: 0.3 });

export function buildFox() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.42;
  g.add(body);
  const orange = lam(0xe8782e), cream = lam(0xfff0dc), dark = lam(0x3a2418);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 12).rotateX(Math.PI / 2), orange);
  torso.castShadow = true;
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 4, 10).rotateX(Math.PI / 2), cream);
  belly.position.set(0, -0.07, 0.02);
  body.add(torso, belly);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.36);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), orange);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 10).rotateX(Math.PI / 2), cream);
  snout.position.set(0, -0.04, 0.17);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), dark);
  nose.position.set(0, -0.03, 0.29);
  head.add(skull, snout, nose);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.17, 4), orange);
    ear.position.set(s * 0.09, 0.16, -0.01);
    ear.rotation.z = -s * 0.25;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), dark);
    eye.position.set(s * 0.07, 0.03, 0.14);
    head.add(ear, eye);
  }
  body.add(head);
  const legs = [];
  for (const [x, z] of [[-0.11, 0.22], [0.11, 0.22], [-0.11, -0.2], [0.11, -0.2]]) {
    const leg = new THREE.Group();
    leg.position.set(x, -0.08, z);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 8), dark);
    m.position.y = -0.16;
    leg.add(m);
    body.add(leg);
    legs.push(leg);
  }
  // Bushy tail with a paint-dipped tip
  const tail = new THREE.Group();
  tail.position.set(0, 0.05, -0.34);
  const brush = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.34, 6, 10), orange);
  brush.position.set(0, 0.05, -0.2);
  brush.rotation.x = -1.1;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lam(0xe8442e, { emissive: 0x401008 }));
  tip.position.set(0, 0.16, -0.38);
  tail.add(brush, tip);
  body.add(tail);
  return { group: g, body, head, legs, tail, tip };
}

export class Fox {
  constructor(scene) {
    this.m = buildFox();
    scene.add(this.m.group);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.phase = 0;
    this.sniffT = 20;
    this.goal = null; // { pos, kind }
    this.carry = null;
    this.placed = false;
  }

  _ground(x, z, y) {
    const g = G.collision.groundAt(x, z, 0.2, y + 2);
    return g.y > -Infinity ? g.y : G.terrain.heightAt(x, z);
  }

  // Nearest unsolved puzzle or unfound Paint Sprite within range
  _scent(p) {
    let best = null, bd = 130;
    for (const pz of G.puzzles?.list || []) {
      if (G.flags[`pz_${pz.id}`]) continue;
      const d = pz.pos.distanceTo(p.pos);
      if (d < bd) { bd = d; best = pz.pos; }
    }
    for (const s of G.sprites?.list || []) {
      if (G.flags[s.flag] || s.kind === 'hoop') continue;
      const d = s.pos.distanceTo(p.pos);
      if (d < bd) { bd = d; best = s.pos; }
    }
    return best;
  }

  update(dt) {
    const p = G.player;
    const m = this.m;
    const on = G.settings.fox !== false && p && !p.inDungeon && p.alive;
    m.group.visible = !!on && p.state !== 'ride';
    if (!on) return;
    if (!this.placed || this.pos.distanceTo(p.pos) > 45 || p.state === 'ride') {
      // Catch up out of sight (or wait while you fly)
      const back = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)).multiplyScalar(3);
      this.pos.copy(p.pos).add(back);
      this.pos.y = this._ground(this.pos.x, this.pos.z, p.pos.y);
      this.placed = true;
      this.goal = null;
      if (this.carry) this.carry = null;
      m.group.position.copy(this.pos);
      if (p.state === 'ride') return;
    }
    // Pick a job: carry Pigment home, fetch nearby Pigment, chase a scent, or follow
    let target = null, speed = 0, mode = 'follow';
    if (this.carry) {
      if (!G.enemies.pickups.includes(this.carry)) this.carry = null;
      else { target = p.pos; mode = 'carry'; }
    }
    if (!target) {
      const k = G.enemies.pickups.find((q) => q.kind === 'pigment' && q.pos.distanceTo(p.pos) < 14 && q.pos.distanceTo(p.pos) > 2.2);
      if (k) { target = k.pos; mode = 'fetch'; if (this.pos.distanceTo(k.pos) < 0.8) this.carry = k; }
    }
    this.sniffT -= dt;
    if (!target && this.sniffT <= 0 && !this.goal) {
      this.sniffT = 25 + Math.random() * 15;
      const s = this._scent(p);
      if (s) {
        const dir = s.clone().sub(p.pos).setY(0).normalize();
        this.goal = { pos: p.pos.clone().addScaledVector(dir, 9), look: s, t: 7 };
        G.audio.play('glint', 0.6);
        if (!G.guide.seen.has('fox')) { G.guide.seen.add('fox'); G.hud.toast('Your Paint Fox has caught a scent! Follow where it points.', '#ffb070', 4); }
      }
    }
    if (!target && this.goal) {
      this.goal.t -= dt;
      if (this.goal.t <= 0 || p.pos.distanceTo(this.goal.pos) < 3) this.goal = null;
      else { target = this.goal.pos; mode = 'scent'; }
    }
    if (!target) target = p.pos;
    const to = target.clone().sub(this.pos).setY(0);
    const d = to.length();
    const stop = mode === 'follow' ? 2.4 : mode === 'carry' ? 1.2 : 0.4;
    if (d > stop) {
      speed = Math.min(d * 2, mode === 'follow' ? Math.min(14, Math.max(4, Math.hypot(p.vel.x, p.vel.z) * 1.1, d > 8 ? d * 0.6 : 0)) : 8);
      this.pos.addScaledVector(to.normalize(), speed * dt);
      this.yaw = dampAngle(this.yaw, Math.atan2(to.x, to.z), 10, dt);
    } else if (mode === 'scent') {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.goal.look.x - this.pos.x, this.goal.look.z - this.pos.z), 6, dt);
      if (Math.random() < dt * 6) G.particles.burst(this.pos.clone().setY(this.pos.y + 0.8), { count: 1, color: 0xffb070, speed: 1, life: 0.8, size: 0.25, pool: 'glow', gravity: -1 });
    } else {
      this.yaw = dampAngle(this.yaw, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z), 4, dt);
    }
    this.pos.y = damp(this.pos.y, this._ground(this.pos.x, this.pos.z, this.pos.y), 12, dt);
    if (this.carry) this.carry.pos.set(this.pos.x + Math.sin(this.yaw) * 0.55, this.pos.y + 0.55, this.pos.z + Math.cos(this.yaw) * 0.55);
    // Animate: trot, sit, wag
    const moving = speed > 0.3;
    this.phase += dt * (moving ? 6 + speed * 1.2 : 2);
    const s = Math.sin(this.phase);
    m.legs.forEach((l, i) => { l.rotation.x = moving ? s * 0.8 * (i % 2 ? 1 : -1) * (i < 2 ? 1 : -1) : i >= 2 ? -1.1 : 0; });
    m.body.position.y = moving ? 0.42 + Math.abs(s) * 0.05 : 0.34;
    m.body.rotation.x = moving ? 0 : -0.35;
    m.head.rotation.x = moving ? 0 : 0.3;
    m.tail.rotation.y = Math.sin(G.time * (mode === 'scent' ? 14 : 5)) * 0.5;
    m.group.position.copy(this.pos);
    m.group.rotation.y = this.yaw;
  }
}

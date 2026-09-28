// Target Gallery: a village booth where you have 45 seconds to splash pop-up targets with paint.
// Hitting a target with its own colour scores 3, any other colour 1. Your score pays Pigment, and
// the best score is kept as a room record.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { VILLAGE } from './layout.js';
import { MAT } from './props.js';

export const GAME_TIME = 45;
export const scoreFor = (targetColor, globColor) => (targetColor === globColor ? 3 : 1);
export const payout = (score) => Math.floor(score / 2);

export class TargetGallery {
  constructor(scene) {
    const a = Math.atan2(35, 40);
    this.origin = new THREE.Vector3(VILLAGE.x + Math.cos(a) * 52, 0, VILLAGE.z + Math.sin(a) * 52);
    this.origin.y = G.terrain.heightAt(this.origin.x, this.origin.z);
    this.out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); // facing out of the village
    this.root = new THREE.Group();
    scene.add(this.root);
    this._booth();
    this.targets = [];
    this.run = null;
    this.boardGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.12, 24).rotateX(Math.PI / 2);
    this.ringGeo = new THREE.TorusGeometry(0.62, 0.12, 8, 24);
    this.postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6).translate(0, -0.8, 0);
  }

  _booth() {
    const o = this.origin, g = new THREE.Group();
    g.position.copy(o);
    g.rotation.y = Math.atan2(this.out.x, this.out.z);
    // You stand inside the booth: a low counter in front, the roof and sign overhead and behind
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.6), MAT.wood);
    counter.position.set(0, 0.45, 1.1);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 2.6), new THREE.MeshLambertMaterial({ color: 0xe8442e }));
    roof.position.set(0, 3.1, 0);
    roof.rotation.x = 0.12;
    for (const [x, z] of [[-1.7, -1.1], [1.7, -1.1], [-1.7, 1.1], [1.7, 1.1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.1, 6), MAT.woodDark);
      post.position.set(x, 1.55, z);
      g.add(post);
    }
    // Striped sign facing the village
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.08), new THREE.MeshLambertMaterial({ color: 0xf2c229 }));
    sign.position.set(0, 3.5, -1.2);
    g.add(counter, roof, sign);
    this.root.add(g);
    const c = o.clone().addScaledVector(this.out, 1.1);
    G.collision.addBox(c.x, o.y + 0.45, c.z, 1.4, 0.9, 1.4);
    G.world.interactables.push({
      pos: o.clone().setY(o.y + 1), radius: 3,
      enabled: () => !this.run,
      prompt: () => {
        const b = G.flags.tg_best;
        return `Play the Target Gallery (${GAME_TIME}s)${b ? ` · record ${b.s} by ${b.n}` : ''}`;
      },
      action: () => this.start(),
    });
  }

  start() {
    this.run = { t: GAME_TIME, score: 0, spawn: 0.3, hits: 0 };
    G.audio.play('waypoint');
    G.hud.banner('Target Gallery', 'Splash the targets with paint! Matching colours score triple.', '#f2c229');
    G.hud.toast('Aim with RMB and flick paint with LMB', '#ffe9a0', 3);
  }

  _spawnTarget() {
    const side = new THREE.Vector3(-this.out.z, 0, this.out.x);
    const pos = this.origin.clone().addScaledVector(this.out, 10 + Math.random() * 16).addScaledVector(side, (Math.random() - 0.5) * 22);
    pos.y = G.terrain.heightAt(pos.x, pos.z) + 1.6 + Math.random() * 2.5;
    const color = Math.floor(Math.random() * 4);
    const g = new THREE.Group();
    const board = new THREE.Mesh(this.boardGeo, new THREE.MeshLambertMaterial({ color: 0xfff4e0 }));
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS[color].hex).multiplyScalar(1.3) }));
    ring.position.z = 0.08;
    const bull = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), ring.material);
    bull.position.z = 0.08;
    const post = new THREE.Mesh(this.postGeo, MAT.woodDark);
    g.add(board, ring, bull, post);
    g.position.copy(pos);
    g.lookAt(this.origin.x, pos.y, this.origin.z);
    g.scale.setScalar(0.01);
    this.root.add(g);
    this.targets.push({ g, pos, color, life: 3.2, age: 0 });
  }

  _remove(t, hit) {
    this.root.remove(t.g);
    t.g.traverse((m) => { if (m.material && m.material !== MAT.woodDark) m.material.dispose(); });
    this.targets.splice(this.targets.indexOf(t), 1);
    if (hit) G.particles.burst(t.pos, { count: 30, color: COLORS[t.color].hex, speed: 6, life: 0.7, size: 0.45, pool: 'glow', gravity: 6 });
  }

  _finish() {
    const { score } = this.run;
    const p = G.player;
    const pig = payout(score);
    p.pigment += pig;
    const best = G.flags.tg_best;
    const record = score > 0 && (!best || score > best.s);
    if (record) { G.trials._setFlag('tg_best', { s: score, n: p.name || 'You' }); G.honours?.event('targets'); }
    G.audio.play(record ? 'shard' : 'solve');
    G.hud.banner(record ? 'New Gallery Record!' : 'Time!', `${score} points · +${pig} Pigment${best && !record ? ` · record ${best.s}` : ''}`, '#f2c229');
    for (const t of [...this.targets]) this._remove(t, false);
    this.run = null;
    G.hud.setRush?.(null);
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.root.visible = !p.inDungeon;
    const r = this.run;
    if (!r) return;
    if (p.pos.distanceTo(this.origin) > 60 || p.inDungeon) { G.hud.toast('You left the Target Gallery.', '#dddddd', 2); r.t = 0; }
    r.t -= dt;
    r.spawn -= dt;
    if (r.spawn <= 0 && this.targets.length < 5) { r.spawn = 0.6 + Math.random() * 0.7; this._spawnTarget(); }
    for (const t of [...this.targets]) {
      t.age += dt;
      t.g.scale.setScalar(Math.min(1, t.age * 5) * (t.age > t.life - 0.3 ? Math.max(0.01, (t.life - t.age) / 0.3) : 1));
      if (t.age >= t.life) { this._remove(t, false); continue; }
      // Only your own globs count
      for (const gl of G.paint.globs) {
        if (gl.cosmetic || gl.life <= 0 || gl.pos.distanceTo(t.pos) > 1) continue;
        gl.life = 0;
        const pts = scoreFor(t.color, gl.color);
        r.score += pts;
        r.hits++;
        G.hud.damageNumber(t.pos.clone().setY(t.pos.y + 1), `+${pts}`, pts === 3 ? '#ffe066' : '#ffffff', pts === 3);
        G.audio.play(pts === 3 ? 'crit' : 'hit');
        this._remove(t, true);
        break;
      }
    }
    G.hud.setRush?.(`${Math.max(0, Math.ceil(r.t))}s · ${r.score} pts`, 'Target Gallery');
    if (r.t <= 0) this._finish();
  }
}

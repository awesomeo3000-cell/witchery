// Overworld paint puzzles, small riddles scattered across the island:
//  - Colour Totems: a plinth shows a row of colours; paint the three pillars to match, in order.
//  - Brazier Rings: light one brazier with Ember and the rest must follow before the flames die.
// Solving sets a shared flag (pz_<id>) and pays Pigment to every player nearby.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';
import { VILLAGE, TRIALS, CITADEL } from './layout.js';
import { MAT } from './props.js';

const ELS = COLORS.map((c) => c.element);
const RING_TIME = 14;
const REWARD = 10;

// Deterministic, flat, dry spots away from the village, trials and each other
export function puzzleSites(terrain, n, seed = 4242, taken = []) {
  const rand = mulberry32(seed);
  const out = [];
  const avoid = [{ x: VILLAGE.x, z: VILLAGE.z, r: VILLAGE.r + 30 }, ...TRIALS.map((t) => ({ x: t.x, z: t.z, r: 60 })), { x: CITADEL.x, z: CITADEL.z, r: 40 }];
  for (let i = 0; i < 4000 && out.length < n; i++) {
    const a = rand() * Math.PI * 2, d = 120 + rand() * 520;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = terrain.heightAt(x, z);
    if (h < 4 || h > 90) continue;
    let flat = true;
    for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) if (Math.abs(terrain.heightAt(x + dx, z + dz) - h) > 1.6) flat = false;
    if (!flat) continue;
    if (avoid.some((q) => Math.hypot(q.x - x, q.z - z) < q.r)) continue;
    if ([...out, ...taken].some((q) => Math.hypot(q.x - x, q.z - z) < 110)) continue;
    out.push({ x, z, y: h });
  }
  return out;
}

export class Puzzles {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.list = [];
    const totems = puzzleSites(G.terrain, 6, 4242);
    const rings = puzzleSites(G.terrain, 4, 777, totems);
    totems.forEach((s, i) => this._totem(`t${i}`, s, i));
    rings.forEach((s, i) => this._ring(`r${i}`, s));
  }

  get total() { return this.list.length; }
  solvedCount() { return this.list.filter((p) => G.flags[`pz_${p.id}`]).length; }

  _react(pos, radius, onPaint) {
    const r = { active: true, pos, radius, hitbox: radius, onPaint };
    G.world.reactives.push(r);
    return r;
  }

  _totem(id, s, i) {
    const rand = mulberry32(99 + i * 7);
    const key = [0, 1, 2].map(() => Math.floor(rand() * 4));
    if (key[0] === key[1] && key[1] === key[2]) key[2] = (key[2] + 1) % 4;
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = rand() * Math.PI * 2;
    this.root.add(g);
    // Plinth with the colour key
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.2, 7), MAT.stoneDark);
    plinth.position.set(0, 0.6, -3.2);
    g.add(plinth);
    key.forEach((c, k) => {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.45), new THREE.MeshLambertMaterial({ color: COLORS[c].hex, emissive: COLORS[c].hex, emissiveIntensity: 0.35 }));
      tile.position.set(-0.55 + k * 0.55, 1.26, -3.2);
      g.add(tile);
    });
    const pillars = [0, 1, 2].map((k) => {
      const mat = MAT.stone.clone();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 2.6, 8), mat);
      m.position.set(-2.4 + k * 2.4, 1.3, 0);
      m.castShadow = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat);
      cap.position.y = 1.45;
      m.add(cap);
      g.add(m);
      g.updateMatrixWorld(true);
      const wp = m.getWorldPosition(new THREE.Vector3());
      G.collision.addCylinder(wp.x, wp.z, 0.55, s.y, s.y + 2.8);
      return { m, mat, pos: wp.setY(s.y + 1.4), color: -1 };
    });
    const pp = plinth.getWorldPosition(new THREE.Vector3());
    G.collision.addCylinder(pp.x, pp.z, 1.2, s.y, s.y + 1.3);
    const pz = { id, kind: 'totem', pos: new THREE.Vector3(s.x, s.y, s.z), key, pillars, g };
    for (const [k, p] of pillars.entries()) {
      this._react(p.pos, 1.2, (el) => {
        if (G.flags[`pz_${id}`]) return;
        const c = ELS.indexOf(el);
        if (c < 0 || p.color === c) return;
        p.color = c;
        p.mat.color.setHex(COLORS[c].hex).lerp(new THREE.Color(0xffffff), 0.15);
        G.audio.play('switch', 0.6);
        if (pillars.every((q, j) => q.color === key[j])) this._solve(pz);
        else if (k === 2 && pillars.every((q) => q.color >= 0)) G.hud.toast('The totems hum... but something is out of order.', '#ffe9a0', 2.5);
      });
    }
    this.list.push(pz);
  }

  _ring(id, s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    this.root.add(g);
    const braziers = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const bx = Math.cos(a) * 7, bz = Math.sin(a) * 7;
      const y = G.terrain.heightAt(s.x + bx, s.z + bz) - s.y;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.3, 6), MAT.stoneDark);
      leg.position.set(bx, y + 0.65, bz);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.35, 0.5, 10, 1, true), MAT.stoneDark);
      bowl.position.set(bx, y + 1.5, bz);
      const coal = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2020 }));
      coal.position.set(bx, y + 1.6, bz);
      g.add(leg, bowl, coal);
      const pos = new THREE.Vector3(s.x + bx, s.y + y + 1.6, s.z + bz);
      G.collision.addCylinder(pos.x, pos.z, 0.6, s.y + y, s.y + y + 1.7);
      braziers.push({ pos, coal, lit: false });
    }
    // A worn rune stone in the middle hints at the rule
    const rune = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), MAT.stone);
    rune.position.y = 0.5;
    rune.scale.set(1, 0.6, 1);
    g.add(rune);
    const pz = { id, kind: 'ring', pos: new THREE.Vector3(s.x, s.y, s.z), braziers, timer: 0 };
    for (const b of braziers) {
      this._react(b.pos, 1.3, (el) => {
        if (el !== 'fire' || b.lit || G.flags[`pz_${id}`]) return;
        b.lit = true;
        b.coal.material.color.setHex(0xff7a2a);
        G.audio.play('fire', 0.8);
        if (pz.timer <= 0) { pz.timer = RING_TIME; G.hud.toast(`Light the other braziers! (${RING_TIME}s)`, '#ffb070', 2.5); }
        if (braziers.every((q) => q.lit)) this._solve(pz);
      });
    }
    this.list.push(pz);
  }

  _solve(pz) {
    G.trials._setFlag(`pz_${pz.id}`);
  }

  onFlag(k, v) {
    if (!v || !k.startsWith('pz_')) return;
    const pz = this.list.find((p) => `pz_${p.id}` === k);
    if (!pz) return;
    this._showSolved(pz);
    const p = G.player;
    if (p && p.pos.distanceTo(pz.pos) < 70) {
      p.pigment += REWARD;
      G.audio.play('sprite');
      G.hud.banner('Puzzle Solved', `+${REWARD} Pigment · ${this.solvedCount()} / ${this.total} island puzzles`, '#ffd84a');
      G.particles.burst(pz.pos.clone().setY(pz.pos.y + 2), { count: 60, color: 0xffd84a, speed: 7, up: 4, life: 1.4, size: 0.5, pool: 'glow', gravity: 2 });
    }
  }

  _showSolved(pz) {
    if (pz.kind === 'totem') pz.key.forEach((c, j) => { pz.pillars[j].color = c; pz.pillars[j].mat.color.setHex(COLORS[c].hex).lerp(new THREE.Color(0xffffff), 0.15); pz.pillars[j].mat.emissive?.setHex(COLORS[c].hex).multiplyScalar(0.2); });
    else for (const b of pz.braziers) { b.lit = true; b.coal.material.color.setHex(0xff7a2a); }
  }

  mapMarkers(add) {
    if (!G.fog) return;
    for (const pz of this.list) {
      const solved = !!G.flags[`pz_${pz.id}`];
      const i = Math.floor((pz.pos.x + 800) / 25), j = Math.floor((pz.pos.z + 800) / 25);
      if (!solved && !G.fog.cells[j * 64 + i]) continue;
      add(pz.pos.x, pz.pos.z, 'mpz', solved ? '#ffd84a' : '#aaa', solved ? '✓' : '?');
    }
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.root.visible = !p.inDungeon;
    if (p.inDungeon) return;
    for (const pz of this.list) {
      const solved = !!G.flags[`pz_${pz.id}`];
      if (solved && !pz.shown) { pz.shown = true; this._showSolved(pz); }
      if (pz.kind !== 'ring') continue;
      const near = pz.pos.distanceTo(p.pos) < 140;
      for (const b of pz.braziers) if (b.lit && near && Math.random() < dt * 20) G.particles.flames(b.pos, 0.35, 1, 0.8);
      if (!solved && pz.timer > 0) {
        pz.timer -= dt;
        if (pz.timer <= 0) {
          for (const b of pz.braziers) { b.lit = false; b.coal.material.color.setHex(0x2a2020); }
          G.hud.toast('The braziers sputter out...', '#cccccc', 2);
          G.particles.burst(pz.pos.clone().setY(pz.pos.y + 2), { count: 20, color: 0x777777, speed: 2, up: 2, life: 1.5, size: 1, gravity: -0.5, alpha: 0.5 });
        }
      }
    }
  }
}

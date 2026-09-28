// Enemy camp dressing (tents, campfire, banner, lookout tower) and loot chests that open once the
// camp is cleared. Chest rewards are BotW-style temporary buffs.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';
import { MAT, mergeColored, T, jitter } from '../world/props.js';

const BUFFS = [
  { key: 'tonic', name: 'Prism Tonic', desc: '+3 golden hearts', color: '#ffd84a' },
  { key: 'power', name: 'Bold Pigment', desc: 'Strikes hit 50% harder for 2 minutes', color: '#ff9d6b' },
  { key: 'ink', name: 'Bottomless Ink', desc: 'Ink refills rapidly for 2 minutes', color: '#9ee0ff' },
  { key: 'swift', name: 'Featherfoot', desc: 'Move faster and tire slower for 2 minutes', color: '#a8f08c' },
];

export class CampDecor {
  constructor(scene, camps) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.items = [];
    this.chestMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2e, flatShading: true });
    this.trimMat = new THREE.MeshLambertMaterial({ color: 0xe8c46a, flatShading: true, emissive: 0x402a00 });
    for (const c of camps) if (!c.sky && !c.field) this._build(c);
  }

  _build(c) {
    const rand = mulberry32(c.id * 97 + 5);
    const h = (x, z) => G.terrain.heightAt(x, z);
    const cy = h(c.x, c.z);
    const parts = [];
    const tentCols = c.variant === 'fire' ? [0x5a2a2a, 0x7a3a2a] : c.variant === 'ice' ? [0x3a4a6a, 0x5a6a8a] : [0x4a3a5a, 0x6a4a3a];
    // Tents
    const nt = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < nt; i++) {
      const a = (i / nt) * Math.PI * 2 + rand();
      const tx = Math.cos(a) * 9, tz = Math.sin(a) * 9;
      const ty = h(c.x + tx, c.z + tz) - cy;
      const tent = new THREE.ConeGeometry(2.6, 3.4, 4 + (i % 2) * 2);
      parts.push([T(tent, tx, ty + 1.6, tz, 1, 1, 1, a), tentCols[i % 2]]);
      parts.push([T(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 3), tx, ty + 2.1, tz), 0x5a3a20]);
      G.collision.addCylinder(c.x + tx, c.z + tz, 2, cy + ty, cy + ty + 2.5);
    }
    // Campfire ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push([T(jitter(new THREE.DodecahedronGeometry(0.3, 0), 0.08, i), Math.cos(a) * 1.1, h(c.x + Math.cos(a), c.z + Math.sin(a)) - cy + 0.1, Math.sin(a) * 1.1), 0x6a6660]);
    }
    for (let i = 0; i < 3; i++) parts.push([T(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 5), 0, 0.25, 0, 1, 1, 1, (i / 3) * Math.PI, 0, Math.PI / 2 - 0.2), 0x4a2e1a]);
    // Banner pole
    const bx = -4, bz = 3;
    parts.push([T(new THREE.CylinderGeometry(0.08, 0.1, 6, 4), bx, h(c.x + bx, c.z + bz) - cy + 3, bz), 0x3a2a1a]);
    parts.push([T(new THREE.BoxGeometry(1.6, 1.1, 0.05), bx + 0.85, h(c.x + bx, c.z + bz) - cy + 5.2, bz), 0x2a2433]);
    // Lookout tower
    if (c.tower) {
      const tx = c.towerPos.x - c.x, tz = c.towerPos.z - c.z;
      const base = h(c.towerPos.x, c.towerPos.z) - cy;
      const top = c.towerPos.y - cy;
      for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
        parts.push([T(new THREE.CylinderGeometry(0.14, 0.18, top - base, 4), tx + lx, base + (top - base) / 2, tz + lz), 0x5a3a20]);
        G.collision.addCylinder(c.towerPos.x + lx, c.towerPos.z + lz, 0.25, cy + base, cy + top - 0.4);
      }
      parts.push([T(new THREE.BoxGeometry(3.4, 0.35, 3.4), tx, top - 0.18, tz), 0x7a5230]);
      parts.push([T(new THREE.BoxGeometry(3.4, 0.9, 0.12), tx, top + 0.45, tz + 1.65), 0x6a4428]);
      parts.push([T(new THREE.BoxGeometry(3.4, 0.9, 0.12), tx, top + 0.45, tz - 1.65), 0x6a4428]);
      parts.push([T(new THREE.ConeGeometry(2.6, 1.6, 4), tx, top + 2.9, tz, 1, 1, 1, Math.PI / 4), tentCols[0]]);
      G.collision.addBox(c.towerPos.x, cy + top - 0.18, c.towerPos.z, 3.4, 0.36, 3.4, { tags: ['mossy'] });
    }
    const mesh = new THREE.Mesh(mergeColored(parts), MAT.vertex);
    mesh.position.set(c.x, cy, c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);

    // Chest (lid animates, so it stays separate)
    const chest = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), this.chestMat);
    bodyM.position.y = 0.35;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.12, 0.84), this.trimMat);
    band.position.y = 0.55;
    const lid = new THREE.Group();
    lid.position.set(0, 0.7, -0.4);
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8, 1, false, 0, Math.PI), this.chestMat);
    lidM.rotation.z = Math.PI / 2;
    lidM.position.z = 0.4;
    lid.add(lidM);
    chest.add(bodyM, band, lid);
    const chx = 3.2, chz = -2.2;
    chest.position.set(c.x + chx, h(c.x + chx, c.z + chz), c.z + chz);
    chest.rotation.y = rand() * Math.PI;
    this.root.add(chest);
    G.collision.addBox(chest.position.x, chest.position.y + 0.35, chest.position.z, 1.1, 0.7, 1.1);
    const item = { camp: c, mesh, chest, lid, flag: `chest_${c.id}`, pos: chest.position.clone(), fire: new THREE.Vector3(c.x, cy + 0.3, c.z) };
    this.items.push(item);
    G.world.interactables.push({
      pos: chest.position.clone().setY(chest.position.y + 0.6), radius: 2.4,
      enabled: () => !G.flags[item.flag],
      prompt: () => (this._cleared(item) ? 'Open the chest' : 'The chest is guarded... defeat the camp first'),
      action: (player) => this._open(item, player),
    });
  }

  _cleared(item) {
    return !G.enemies.list.some((e) => e.alive && !e.boss && e.pos.distanceTo(item.pos) < 32);
  }

  _open(item, player) {
    if (G.flags[item.flag]) return;
    if (!this._cleared(item)) { G.hud.toast('Enemies still guard this camp!', '#ffb0b0', 2); return; }
    G.trials._setFlag(item.flag);
    const b = BUFFS[Math.floor(Math.random() * BUFFS.length)];
    player.applyBuff(b.key);
    G.audio.play('pickup');
    G.audio.play('solve');
    G.hud.banner(b.name, b.desc, b.color);
    for (let c = 0; c < 4; c++) player.ink[c] = 100;
    G.particles.burst(item.pos.clone().setY(item.pos.y + 1), { count: 50, color: 0xffe08a, speed: 6, life: 1, size: 0.4, pool: 'glow', gravity: 2 });
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    const cam = G.camera.position;
    this.root.visible = !p.inDungeon;
    for (const it of this.items) {
      const d = it.fire.distanceTo(cam);
      it.mesh.visible = it.chest.visible = d < 450;
      const open = !!G.flags[it.flag];
      it.lid.rotation.x += ((open ? -1.9 : 0) - it.lid.rotation.x) * Math.min(1, dt * 4);
      if (d < 120 && Math.random() < dt * 14) G.particles.flames(it.fire, 0.5, 1, 1.1);
      if (d < 120 && Math.random() < dt * 3) G.particles.burst(it.fire.clone().setY(it.fire.y + 1.5), { count: 1, color: 0x777777, speed: 0.5, up: 2, life: 2.5, size: 1.2, gravity: -0.5, alpha: 0.35, grow: 2 });
      if (!open && d < 60 && this._cleared(it) && Math.random() < dt * 4) {
        G.particles.burst(it.pos.clone().setY(it.pos.y + 1), { count: 1, color: 0xffe08a, speed: 1, life: 0.8, size: 0.3, pool: 'glow', gravity: -1 });
      }
    }
  }
}

export { BUFFS };

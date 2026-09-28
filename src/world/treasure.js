// Treasure maps: Tinker sells a pencil sketch of a hidden spot somewhere on the island, drawn from the
// real place with a red X where the treasure is buried, plus a rough hint of where to look. Find the
// spot, dig it up, and the map is spent. One map at a time; kept in your local save.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';
import { VILLAGE, WAYPOINTS, TRIALS, LAKE } from './layout.js';
import { drawSketch } from './memories.js';

export const MAP_COST = 18;
export const DIG_R = 3;
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

// Compass word for the direction from a to b (north is -z, east is +x)
export const dirWord = (dx, dz) => DIRS[((Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) % 8) + 8) % 8];

// A dry, fairly gentle spot away from the village, the lake and the trial shrines
export function treasureSpot(terrain, seed) {
  const rand = mulberry32(seed);
  for (let i = 0; i < 500; i++) {
    const a = rand() * Math.PI * 2, d = 140 + rand() * 520;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = terrain.heightAt(x, z);
    if (h < 3 || h > 70) continue;
    const slope = Math.abs(terrain.heightAt(x + 3, z) - h) + Math.abs(terrain.heightAt(x, z + 3) - h);
    if (slope > 2.2) continue;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 40) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 15) continue;
    if (TRIALS.some((t) => Math.hypot(x - t.x, z - t.z) < 45)) continue;
    return { x, z };
  }
  return { x: 200, z: 150 };
}

// "Somewhere north-east of Cinder Steps"
export function hintFor(x, z) {
  const w = WAYPOINTS.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a));
  const d = Math.hypot(w.x - x, w.z - z);
  return d < 60 ? `close to ${w.name}` : `${d > 220 ? 'far ' : ''}${dirWord(x - w.x, z - w.z)} of ${w.name}`;
}

export class Treasure {
  constructor(scene) {
    this.map = null; // { seed, x, z }
    this.found = 0;
    this.sketch = null;
    // A small heap of freshly turned earth with a painted red X
    const g = new THREE.Group();
    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
    const red = new THREE.MeshBasicMaterial({ color: 0xd8322e });
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.2), red);
      bar.position.y = 0.3;
      bar.rotation.y = s * Math.PI / 4;
      g.add(bar);
    }
    g.add(heap);
    g.visible = false;
    scene.add(g);
    this.mound = g;
    this.pos = new THREE.Vector3();
    G.world.interactables.push({
      pos: this.pos, radius: DIG_R,
      enabled: () => !!this.map && this.mound.visible,
      prompt: () => 'Dig up the treasure',
      action: () => this.dig(),
    });
  }

  get hint() { return this.map ? hintFor(this.map.x, this.map.z) : ''; }

  // Tinker's ware: false if you already carry a map
  buy() {
    if (this.map) { G.hud.toast('You already carry a treasure map. Find that one first!', '#ffb0b0', 2.5); return false; }
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this._set({ seed, ...treasureSpot(G.terrain, seed) });
    setTimeout(() => this.show(), 300);
    return true;
  }

  _set(m) {
    this.map = m;
    this.sketch = null;
    const y = G.terrain.heightAt(m.x, m.z);
    this.pos.set(m.x, y + 0.6, m.z);
    this.mound.position.set(m.x, y - 0.05, m.z);
  }

  // The drawing: from a spot on the way in from the nearest easel, looking at the X
  _draw() {
    if (this.sketch !== null || !this.map) return this.sketch;
    const { x, z } = this.map;
    const w = WAYPOINTS.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a));
    const dir = new THREE.Vector3(x - w.x, 0, z - w.z).normalize();
    // Stand well back and look past the spot, so the skyline and landmarks are in the picture
    const at = new THREE.Vector3(x, 0, z).addScaledVector(dir, -42);
    at.y = Math.max(G.terrain.heightAt(at.x, at.z), G.terrain.heightAt(x, z)) + 14;
    const target = new THREE.Vector3(x, G.terrain.heightAt(x, z), z);
    const look = target.clone().addScaledVector(dir, 80);
    look.y = target.y + 6;
    const out = drawSketch(at, look, 260, 170);
    if (!out) { this.sketch = ''; return ''; }
    // Mark the spot with a painted red X
    const v = target.clone().project(out.cam);
    const cx = (v.x + 1) / 2 * out.canvas.width, cy = (1 - v.y) / 2 * out.canvas.height;
    const ctx = out.canvas.getContext('2d');
    ctx.strokeStyle = 'rgba(200,40,30,0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 9, cy + 9);
    ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx - 9, cy + 9);
    ctx.stroke();
    this.sketch = out.canvas.toDataURL('image/jpeg', 0.82);
    return this.sketch;
  }

  show() {
    if (!this.map) return;
    const src = this._draw();
    const wrap = document.createElement('div');
    wrap.className = 'tmap';
    wrap.innerHTML = `${src ? `<img src="${src}" alt="Treasure map sketch">` : ''}<p>Somewhere ${this.hint}. Look for the red X.</p>`;
    G.hud.choice('Treasure Map', wrap, ['Fold it away'], () => {});
  }

  // A card at the top of the Painted Memories page in the satchel
  renderCard(el) {
    if (!this.map) return;
    const src = this._draw();
    const d = document.createElement('div');
    d.className = 'mem got tcard';
    d.innerHTML = `${src ? `<img src="${src}" alt="">` : '<div class="blank"></div>'}<b>Treasure map</b><small>Somewhere ${this.hint}</small>`;
    d.onclick = () => { G.forage.closeUI(); this.show(); };
    el.prepend(d);
  }

  dig() {
    const p = G.player;
    const pig = 20 + (this.map.seed % 11);
    const rand = mulberry32(this.map.seed);
    const keys = Object.keys(G.forage.inv).filter((k) => !['prismfin', 'fish'].includes(k));
    const got = [];
    for (let i = 0; i < 3; i++) {
      const k = keys[Math.floor(rand() * keys.length)];
      G.forage.inv[k] = (G.forage.inv[k] || 0) + 1;
      got.push(k);
    }
    p.pigment += pig;
    G.particles.burst(this.pos, { count: 30, color: 0xffe08a, speed: 4, up: 5, life: 1.2, size: 0.5, pool: 'glow', gravity: 3 });
    G.particles.burst(this.pos, { count: 20, color: 0x7a5a3a, speed: 3, up: 4, life: 0.8, size: 0.5, gravity: 8 });
    G.audio.play('shard');
    G.hud.itemGet('✗', 'You dug up the treasure!', `+${pig} Pigment and a bundle of ingredients.`, '#d8a040');
    this.map = null;
    this.sketch = null;
    this.mound.visible = false;
    this.found++;
    G.honours?.event('treasure');
  }

  mapMarkers(add) {
    if (!this.map) return;
    // Only a rough area: the hint circle is centred a little off the real spot
    const r = mulberry32(this.map.seed + 1);
    const ox = this.map.x + (r() - 0.5) * 60, oz = this.map.z + (r() - 0.5) * 60;
    add(ox, oz, 'mq', '#d8322e', `✗ Treasure somewhere ${this.hint}`);
  }

  update() {
    const p = G.player;
    if (!p || !this.map) return;
    // The heap only shows up close; the sketch is how you find it
    this.mound.visible = !p.inDungeon && Math.hypot(p.pos.x - this.map.x, p.pos.z - this.map.z) < 30;
  }

  serialize() { return { map: this.map, found: this.found }; }
  load(d) {
    if (!d || typeof d !== 'object') return;
    this.found = Number(d.found) || 0;
    const m = d.map;
    if (m && Number.isFinite(m.x) && Number.isFinite(m.z) && Number.isFinite(m.seed)) this._set({ seed: m.seed, x: m.x, z: m.z });
  }
}

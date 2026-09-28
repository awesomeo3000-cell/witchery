// Foraging & cooking: ingredients grow around the island (per player, respawning), the inventory
// lets you eat them raw, and cooking pots turn up to three into a stronger meal.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';
import { VILLAGE } from './layout.js';
import { renderAdventureLog } from '../ui/advlog.js';

const $ = (id) => document.getElementById(id);

export const INGREDIENTS = {
  apple: { name: 'Hearty Apple', glyph: '🍎', color: 0xd8322e, heal: 2, biome: ['meadow', 'bloom'] },
  shroom: { name: 'Sunshroom', glyph: '🍄', color: 0xf2a23a, heal: 1, stamina: 35, biome: ['bloom', 'meadow'] },
  mint: { name: 'Swiftmint', glyph: '🌿', color: 0x5fd06a, heal: 1, buff: 'swift', biome: ['meadow', 'spring'] },
  pepper: { name: 'Emberpepper', glyph: '🌶', color: 0xff5a1f, heal: 1, buff: 'power', biome: ['ember', 'spring'] },
  lily: { name: 'Frostlily', glyph: '❄', color: 0x9ee0ff, heal: 1, buff: 'ink', biome: ['frost'] },
  goldpetal: { name: 'Goldpetal', glyph: '✿', color: 0xffd84a, heal: 2, tonic: 2, biome: ['sky'] },
  // Caught rather than picked (fishing and critters), so they have no biome to grow in
  fish: { name: 'Glimmerfish', glyph: '🐟', color: 0x7ac8e8, heal: 3, biome: [] },
  prismfin: { name: 'Prismfin', glyph: '🐠', color: 0xe86ad8, heal: 2, buff: 'ink', biome: [] },
};
const KEYS = Object.keys(INGREDIENTS);
const BUFF_NAMES = { swift: 'Swift', power: 'Bold', ink: 'Inky' };
const MEAL_PREFIX = { swift: 'Zippy', power: 'Spicy', ink: 'Inky' };
const MEAL_BASE = { apple: 'Apple', shroom: 'Mushroom', mint: 'Mint', pepper: 'Pepper', lily: 'Lily', goldpetal: 'Petal', fish: 'Fish', prismfin: 'Prismfin' };

export class Forage {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];
    this.inv = Object.fromEntries(KEYS.map((k) => [k, 0]));
    this.meals = [];
    this.pot = [];
    this.open = false;
    this.cooking = false;
    this._place();
    this._build();
    this._pots();
    this._ui();
  }

  _place() {
    const rand = mulberry32(777);
    const T = G.terrain;
    for (let i = 0; i < 2600 && this.nodes.length < 260; i++) {
      const a = rand() * Math.PI * 2, d = 40 + rand() * 640;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = T.heightAt(x, z);
      if (h < 3 || h > 110 || T.normalAt(x, z).y < 0.8) continue;
      const w = T.biome(x, z);
      const dom = Object.entries(w).sort((p, q) => q[1] - p[1])[0][0];
      const options = KEYS.filter((k) => INGREDIENTS[k].biome.includes(dom));
      if (!options.length) continue;
      const kind = options[Math.floor(rand() * options.length)];
      this.nodes.push({ kind, pos: new THREE.Vector3(x, h, z), regrow: 0 });
    }
    // Goldpetals on the floating islets
    for (const s of G.world.islets) {
      for (let k = 0; k < 2; k++) {
        const a = rand() * Math.PI * 2, d = rand() * s.r * 0.5;
        this.nodes.push({ kind: 'goldpetal', pos: new THREE.Vector3(s.x + Math.cos(a) * d, s.y, s.z + Math.sin(a) * d), regrow: 0 });
      }
    }
  }

  _build() {
    const geos = {
      apple: new THREE.SphereGeometry(0.22, 8, 6).translate(0, 0.22, 0),
      shroom: new THREE.CylinderGeometry(0.28, 0.06, 0.18, 8).translate(0, 0.42, 0),
      mint: new THREE.ConeGeometry(0.22, 0.55, 5).translate(0, 0.28, 0),
      pepper: new THREE.ConeGeometry(0.1, 0.4, 6).rotateZ(Math.PI).translate(0, 0.22, 0),
      lily: new THREE.OctahedronGeometry(0.22).translate(0, 0.35, 0),
      goldpetal: new THREE.OctahedronGeometry(0.25).translate(0, 0.45, 0),
    };
    this.meshes = {};
    const m4 = new THREE.Matrix4();
    for (const k of KEYS) {
      const list = this.nodes.filter((n) => n.kind === k);
      const mat = new THREE.MeshLambertMaterial({ color: INGREDIENTS[k].color, emissive: INGREDIENTS[k].color, emissiveIntensity: k === 'goldpetal' || k === 'lily' ? 0.5 : 0.15, flatShading: true });
      const mesh = new THREE.InstancedMesh(geos[k], mat, Math.max(1, list.length));
      mesh.count = list.length;
      list.forEach((n, i) => {
        n.mesh = mesh;
        n.idx = i;
        m4.makeRotationY(i * 1.7).setPosition(n.pos);
        mesh.setMatrixAt(i, m4);
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.meshes[k] = mesh;
    }
  }

  _pots() {
    this.potSpots = [];
    const add = (x, z, fire = true) => {
      const y = G.terrain.heightAt(x, z);
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), new THREE.MeshLambertMaterial({ color: 0x2a2a30, side: THREE.DoubleSide }));
      pot.position.y = 0.9;
      const stew = new THREE.Mesh(new THREE.CircleGeometry(0.48, 12), new THREE.MeshLambertMaterial({ color: 0xc8843a, emissive: 0x402000 }));
      stew.rotation.x = -Math.PI / 2;
      stew.position.y = 1.18;
      g.add(pot, stew);
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0x4a3a2a }));
        const a = (i / 3) * Math.PI * 2;
        leg.position.set(Math.cos(a) * 0.55, 0.75, Math.sin(a) * 0.55);
        leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        g.add(leg);
      }
      g.position.set(x, y, z);
      this.scene.add(g);
      const spot = { pos: new THREE.Vector3(x, y, z), fire, group: g };
      this.potSpots.push(spot);
      G.world.interactables.push({
        pos: spot.pos.clone().setY(y + 1), radius: 2.6, prompt: 'Cook at the pot',
        enabled: () => !G.player.inDungeon,
        action: () => this.openUI(true),
      });
    };
    add(VILLAGE.x + 9, VILLAGE.z - 6);
    // One beside every camp fire
    if (G.enemies) for (const it of G.enemies.decor.items) add(it.fire.x + 1.6, it.fire.z + 1.2);
  }

  _ui() {
    $('inv-close').onclick = () => this.closeUI();
    $('inv-cook').onclick = () => this.cook();
    $('inv-clear').onclick = () => { for (const k of this.pot) this.inv[k]++; this.pot = []; this.render(); };
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'Escape' || G.input.logical(e.code) === 'KeyI') { e.preventDefault(); this.closeUI(); }
    });
  }

  openUI(cooking = false) {
    this.open = true;
    this.cooking = cooking;
    this.pot = [];
    $('inventory').classList.remove('hidden');
    $('inv-pot').classList.toggle('hidden', !cooking);
    $('inv-title').innerHTML = cooking ? 'Cooking Pot' : `Satchel <span class="pig">● ${G.player.pigment} Pigment</span>`;
    G.input.enabled = false;
    G.input.unlock();
    this.render();
  }

  closeUI() {
    if (!this.open) return;
    for (const k of this.pot) this.inv[k]++;
    this.pot = [];
    this.open = false;
    $('inventory').classList.add('hidden');
    G.input.enabled = true;
    G.game._showPause(false);
    G.input.lock();
  }

  render() {
    const ing = $('inv-ing');
    ing.innerHTML = '';
    for (const k of KEYS) {
      const d = INGREDIENTS[k];
      const n = this.inv[k];
      const el = document.createElement('div');
      el.className = 'card' + (n ? '' : ' empty');
      el.innerHTML = `<div class="g" style="color:#${d.color.toString(16).padStart(6, '0')}">${d.glyph}</div><div class="n">${d.name}</div><div class="c">×${n}</div><div class="e">${this._desc(d)}</div>`;
      el.onclick = () => {
        if (!n) return;
        if (this.cooking) {
          if (this.pot.length >= 3) return;
          this.inv[k]--;
          this.pot.push(k);
        } else {
          this.inv[k]--;
          this._apply({ heal: d.heal, stamina: d.stamina, buff: d.buff, dur: 40, tonic: d.tonic }, d.name);
        }
        this.render();
      };
      ing.appendChild(el);
    }
    const meals = $('inv-meals');
    meals.innerHTML = this.meals.length ? '' : '<div class="none">No meals yet. Cook at a pot!</div>';
    this.meals.forEach((m, i) => {
      const el = document.createElement('div');
      el.className = 'card meal';
      el.innerHTML = `<div class="g">🍲</div><div class="n">${m.name}</div><div class="e">${this._desc(m)}</div>`;
      el.onclick = () => { this.meals.splice(i, 1); this._apply(m, m.name); this.render(); };
      meals.appendChild(el);
    });
    $('inv-slots').innerHTML = [0, 1, 2].map((i) => {
      const k = this.pot[i];
      return `<div class="slot">${k ? INGREDIENTS[k].glyph : ''}</div>`;
    }).join('');
    $('inv-cook').disabled = !this.pot.length;
    $('inv-qh').classList.toggle('hidden', this.cooking);
    $('inv-quests').classList.toggle('hidden', this.cooking);
    if (G.quests) G.quests.renderLog($('inv-quests'));
    $('inv-lh').classList.toggle('hidden', this.cooking);
    $('inv-log').classList.toggle('hidden', this.cooking);
    if (!this.cooking) renderAdventureLog($('inv-log'));
    $('inv-jh').classList.toggle('hidden', this.cooking);
    $('inv-jour').classList.toggle('hidden', this.cooking);
    if (!this.cooking && G.tablets) { G.tablets.render($('inv-jour')); $('inv-jc').textContent = `(${G.tablets.read.size}/12 tablets)`; }
    $('inv-hh').classList.toggle('hidden', this.cooking);
    $('inv-hon').classList.toggle('hidden', this.cooking);
    if (!this.cooking && G.honours) { G.honours.render($('inv-hon')); $('inv-hc').textContent = `(${G.honours.got.size})`; }
  }

  _desc(d) {
    const out = [];
    if (d.heal) out.push(`♥ ${d.heal / 2}`);
    if (d.stamina) out.push('⟳ stamina');
    if (d.tonic) out.push(`+${d.tonic / 2} gold ♥`);
    if (d.buff) out.push(`${BUFF_NAMES[d.buff]}${d.dur ? ` ${Math.round(d.dur)}s` : ''}`);
    return out.join(' · ');
  }

  // Combine the pot: heal x1.5, strongest buff with duration per matching ingredient
  cook() {
    if (!this.pot.length) return;
    const parts = this.pot.map((k) => INGREDIENTS[k]);
    const meal = { heal: Math.round(parts.reduce((s, p) => s + p.heal, 0) * 1.5), stamina: 0, tonic: 0 };
    const buffs = {};
    for (const p of parts) {
      if (p.stamina) meal.stamina += p.stamina;
      if (p.tonic) meal.tonic += p.tonic;
      if (p.buff) buffs[p.buff] = (buffs[p.buff] || 0) + 1;
    }
    const best = Object.entries(buffs).sort((a, b) => b[1] - a[1])[0];
    if (best) { meal.buff = best[0]; meal.dur = 60 + best[1] * 60; }
    const mainKey = [...this.pot].sort((a, b) => (INGREDIENTS[b].buff ? 1 : 0) - (INGREDIENTS[a].buff ? 1 : 0))[0];
    meal.name = `${best ? MEAL_PREFIX[best[0]] : meal.tonic ? 'Golden' : 'Hearty'} ${MEAL_BASE[mainKey]} ${this.pot.length > 2 ? 'Feast' : this.pot.length > 1 ? 'Stew' : 'Skewer'}`;
    this.pot = [];
    if (this.meals.length >= 12) this.meals.shift();
    this.meals.push(meal);
    G.audio.play('solve');
    G.hud.toast(`Cooked: ${meal.name}!`, '#ffe08a', 2.5);
    const spot = this.potSpots.reduce((a, b) => (a.pos.distanceTo(G.player.pos) < b.pos.distanceTo(G.player.pos) ? a : b));
    G.particles.burst(spot.pos.clone().setY(spot.pos.y + 1.4), { count: 30, color: 0xffe0a0, speed: 3, up: 3, life: 1.2, size: 0.5, pool: 'glow', gravity: -1 });
    this.render();
  }

  _apply(e, name) {
    const p = G.player;
    if (e.heal) p.heal(e.heal);
    if (e.stamina) { p.stamina = Math.min(p.maxStamina, p.stamina + e.stamina); p.exhausted = false; }
    if (e.tonic) p.bonusHp = Math.max(p.bonusHp, e.tonic);
    if (e.buff) p.buffs[e.buff] = Math.max(p.buffs[e.buff], e.dur || 40);
    G.audio.play('pickup');
    G.hud.toast(`Ate ${name}`, '#ffd0a0', 1.5);
  }

  // G key / R3: eat the best available healing item when hurt
  quickEat() {
    const p = G.player;
    let best = null;
    const need = p.maxHp - p.hp;
    this.meals.forEach((m, i) => { if (m.heal && (!best || Math.abs(m.heal - need) < Math.abs(best.m.heal - need))) best = { m, i, meal: true }; });
    if (!best) for (const k of KEYS) if (this.inv[k] && INGREDIENTS[k].heal >= 2) { best = { k }; break; }
    if (!best) for (const k of KEYS) if (this.inv[k]) { best = { k }; break; }
    if (!best) { G.hud.toast('Nothing to eat!', '#dddddd', 1.2); return; }
    if (best.meal) { this.meals.splice(best.i, 1); this._apply(best.m, best.m.name); }
    else { const d = INGREDIENTS[best.k]; this.inv[best.k]--; this._apply({ heal: d.heal, stamina: d.stamina, buff: d.buff, dur: 40, tonic: d.tonic }, d.name); }
  }

  serialize() { return { inv: this.inv, meals: this.meals }; }
  load(d) {
    if (!d) return;
    if (d.inv) for (const k of KEYS) this.inv[k] = d.inv[k] || 0;
    if (Array.isArray(d.meals)) this.meals = d.meals.slice(0, 12);
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    const m4 = new THREE.Matrix4();
    const dirty = new Set();
    for (const n of this.nodes) {
      if (n.regrow > 0) {
        n.regrow -= dt;
        if (n.regrow <= 0) { m4.makeRotationY(n.idx * 1.7).setPosition(n.pos); n.mesh.setMatrixAt(n.idx, m4); dirty.add(n.mesh); }
        continue;
      }
      if (Math.abs(n.pos.x - p.pos.x) > 2 || Math.abs(n.pos.z - p.pos.z) > 2) continue;
      if (n.pos.distanceTo(p.pos) < 1.5) {
        n.regrow = 240;
        this.inv[n.kind]++;
        m4.makeScale(0, 0, 0).setPosition(n.pos);
        n.mesh.setMatrixAt(n.idx, m4);
        dirty.add(n.mesh);
        G.audio.play('pickup', 0.5);
        G.hud.toast(`${INGREDIENTS[n.kind].glyph} ${INGREDIENTS[n.kind].name} (${this.inv[n.kind]})`, '#ffffff', 1.2);
        if (!G.guide.seen.has('cook')) G.hud.toast('Press I to open your satchel. Cook at pots for stronger meals!', '#ffe08a', 4);
        G.guide.seen.add('cook');
      }
    }
    for (const m of dirty) m.instanceMatrix.needsUpdate = true;
    for (const m of Object.values(this.meshes)) m.visible = !p.inDungeon;
    for (const s of this.potSpots) {
      s.group.visible = !p.inDungeon && s.pos.distanceTo(G.camera.position) < 250;
      if (s.group.visible && s.pos.distanceTo(p.pos) < 60 && Math.random() < dt * 3) {
        G.particles.burst(s.pos.clone().setY(s.pos.y + 1.3), { count: 1, color: 0xeeeeee, speed: 0.4, up: 1.5, life: 1.8, size: 0.6, gravity: -0.3, alpha: 0.35, grow: 1.5 });
      }
    }
    if (G.input.hit('KeyI') && !this.open) this.openUI(false);
    if (G.input.hit('KeyG')) this.quickEat();
  }
}

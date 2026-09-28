// Tinker the wandering merchant: every few minutes he packs up his cart and moves to another easel.
// His stop is worked out from the wall clock, so every player in a room finds him in the same place.
// He trades Pigment for rare ingredients, a ready-made feast and a stamina tonic.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { WAYPOINTS } from './layout.js';
import { makeCharacter } from '../player/character.js';
import { MAT } from './props.js';

export const STAY_MS = 4 * 60 * 1000;
export const stopIndex = (now = Date.now()) => Math.floor(now / STAY_MS) % WAYPOINTS.length;

export const WARES = [
  { id: 'petals', name: '3 Goldpetals', cost: 15, give: () => { G.forage.inv.goldpetal += 3; } },
  { id: 'lilies', name: '2 Frostlilies + 2 Emberpeppers', cost: 14, give: () => { G.forage.inv.lily += 2; G.forage.inv.pepper += 2; } },
  { id: 'feast', name: 'Hearty Traveller\'s Feast', cost: 20, give: () => { G.forage.meals.push({ name: "Traveller's Feast", heal: 12, stamina: 60, tonic: 2, dur: 0 }); } },
  { id: 'tonic', name: 'Stamina Tonic (drink now)', cost: 12, give: (p) => { p.stamina = p.maxStamina; p.exhausted = false; p.buffs.swift = Math.max(p.buffs.swift, 120); } },
];

export class Merchant {
  constructor(scene) {
    this.npc = makeCharacter({ hood: 0x7a5a2a, scarf: 0x3fb54a, skin: 0xd8b090, tunic: 0x4a5a3a });
    this.npc.brush.visible = false;
    this.group = new THREE.Group();
    this.group.add(this.npc.group);
    // Hand cart piled with goods
    const cart = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1), MAT.wood);
    bed.position.y = 0.7;
    for (const s of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 16), MAT.woodDark);
      wheel.position.set(s * 0.85, 0.42, 0);
      wheel.rotation.y = Math.PI / 2;
      cart.add(wheel);
    }
    const colors = [0xe8442e, 0x3a9ae8, 0xf2c229, 0x3fb54a, 0xe8e2d4];
    for (let i = 0; i < 6; i++) {
      const sack = new THREE.Mesh(new THREE.SphereGeometry(0.22 + (i % 3) * 0.04, 8, 6), new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
      sack.position.set(-0.55 + (i % 3) * 0.55, 1.02 + Math.floor(i / 3) * 0.25, -0.2 + Math.floor(i / 3) * 0.3);
      cart.add(sack);
    }
    cart.add(bed);
    cart.position.set(1.6, 0, 0.3);
    this.group.add(cart);
    scene.add(this.group);
    this.stop = -1;
    this.pos = new THREE.Vector3();
    this.ipos = new THREE.Vector3();
    G.world.interactables.push({
      pos: this.ipos, radius: 3.2,
      enabled: () => this.group.visible,
      prompt: () => 'Trade with Tinker',
      action: () => this.open(),
    });
    this.marker = G.hud.addMarker('<div class="ic" style="background:#7a5a2a">⚖</div>', () => this.pos, () => this.group.visible && this.pos.distanceTo(G.player.pos) < 350);
  }

  _move(i) {
    this.stop = i;
    const w = WAYPOINTS[i];
    const x = w.x - 5, z = w.z + 4;
    this.pos.set(x, G.terrain.heightAt(x, z), z);
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(w.x - x, w.z - z);
    this.ipos.set(x, this.pos.y + 1, z);
  }

  open() {
    const p = G.player;
    const opts = WARES.map((w) => `${w.name} · ${w.cost} pigment`);
    opts.push('Just browsing');
    const left = Math.ceil((STAY_MS - (Date.now() % STAY_MS)) / 60000);
    G.hud.choice('Tinker the Merchant', `Fine wares from all over the island! I move on in about ${left} minute${left === 1 ? '' : 's'}. You carry ${p.pigment} Pigment.`, opts, (i) => {
      if (i >= WARES.length) { G.hud.dialog('Tinker the Merchant', 'Safe travels! Look for my cart by the easels.'); return; }
      const w = WARES[i];
      if (p.pigment < w.cost) { G.hud.dialog('Tinker the Merchant', `Ah, that one's ${w.cost} Pigment. Come back when your pockets are heavier!`); return; }
      p.pigment -= w.cost;
      w.give(p);
      G.audio.play('pickup');
      G.hud.toast(`Bought ${w.name}`, '#ffd84a', 2);
      this.open();
    });
  }

  mapMarkers(add) {
    if (this.stop >= 0) add(this.pos.x, this.pos.z, 'mq', '#7a5a2a', 'Tinker the Merchant');
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    const i = stopIndex();
    if (i !== this.stop) this._move(i);
    const d = this.pos.distanceTo(p.pos);
    this.group.visible = !p.inDungeon && d < 400;
    this.npc.setLod(d > 28);
    if (this.group.visible && d <= 28) {
      this.npc.animate({ state: 'idle', speed: 0 }, dt);
      this.npc.setShadow(d < 30);
    }
  }
}

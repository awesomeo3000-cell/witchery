// Pigment & the Brushwright: defeated ink creatures drop Pigment, which Sable the Brushwright in
// Palette Hollow turns into permanent brush upgrades. Pigment and upgrades belong to each player
// and are kept in their local save.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { VILLAGE } from './layout.js';
import { makeCharacter } from '../player/character.js';

export const UPGRADES = [
  { key: 'bristle', name: 'Stiff Bristles', desc: 'Strikes and globs hit 12% harder per level', costs: [30, 70, 140] },
  { key: 'reservoir', name: 'Deep Reservoir', desc: 'Ink refills 25% faster per level', costs: [25, 60, 120] },
  { key: 'lacquer', name: 'Wind Lacquer', desc: 'Flying costs 15% less stamina per level', costs: [30, 70, 140] },
];

// Multipliers derived from a player's upgrade levels
export const brushStats = (upg = {}) => ({
  damage: 1 + 0.12 * (upg.bristle || 0),
  inkRegen: 1 + 0.25 * (upg.reservoir || 0),
  flightCost: 1 - 0.15 * (upg.lacquer || 0),
});

// Buy the next level of an upgrade; returns false if maxed or unaffordable
export function purchase(wallet, key) {
  const u = UPGRADES.find((x) => x.key === key);
  const lvl = wallet.upg[key] || 0;
  if (!u || lvl >= u.costs.length || wallet.pigment < u.costs[lvl]) return false;
  wallet.pigment -= u.costs[lvl];
  wallet.upg[key] = lvl + 1;
  return true;
}

export class Shop {
  constructor(scene) {
    const a = Math.PI / 4;
    const x = VILLAGE.x + Math.cos(a) * 23.6, z = VILLAGE.z + Math.sin(a) * 23.6;
    const y = G.terrain.heightAt(x, z);
    this.npc = makeCharacter({ hood: 0x3a3a46, scarf: 0xe8c46a, skin: 0xd8a882, tunic: 0x5a4a3a });
    this.npc.group.position.set(x, y, z);
    this.npc.group.rotation.y = Math.atan2(VILLAGE.x - x, VILLAGE.z - z);
    scene.add(this.npc.group);
    this.pos = new THREE.Vector3(x, y, z);
    G.collision.addCylinder(x, z, 0.5, y, y + 1.8);
    G.world.interactables.push({
      pos: this.pos.clone().setY(y + 1), radius: 4.2,
      prompt: () => 'Talk to Sable the Brushwright',
      action: () => this.open(),
    });
  }

  open() {
    const p = G.player;
    const opts = UPGRADES.map((u) => {
      const lvl = p.upg[u.key] || 0;
      return lvl >= u.costs.length ? `${u.name} (max)` : `${u.name} ${'I'.repeat(lvl + 1)} · ${u.costs[lvl]} pigment`;
    });
    opts.push('Leave');
    G.hud.choice('Sable the Brushwright', `Bring me Pigment from the ink creatures and I'll rework that brush. You carry ${p.pigment} Pigment.`, opts, (i) => {
      if (i >= UPGRADES.length) { G.hud.dialog('Sable the Brushwright', 'Mind the bristles out there.'); return; }
      const u = UPGRADES[i];
      if (purchase(p, u.key)) {
        G.audio.play('solve');
        G.hud.banner(`${u.name} ${'I'.repeat(p.upg[u.key])}`, u.desc, '#ffd84a');
        G.particles.burst(p.pos.clone().setY(p.pos.y + 1.2), { count: 40, color: 0xffd84a, speed: 5, life: 1, size: 0.4, pool: 'glow', gravity: 2 });
        this.open();
      } else {
        const lvl = p.upg[u.key] || 0;
        G.hud.dialog('Sable the Brushwright', lvl >= u.costs.length ? "That's as good as it gets, friend." : `You'll need ${u.costs[lvl] - p.pigment} more Pigment for that.`);
      }
    });
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.npc.group.visible = !p.inDungeon;
    this.npc.setShadow(this.pos.distanceTo(p.pos) < 30);
    if (!p.inDungeon && this.pos.distanceTo(p.pos) < 60) this.npc.animate({ state: 'idle', speed: 0 }, dt);
  }
}

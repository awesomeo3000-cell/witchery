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

// Brush tips change how the brush handles; bought once, then swapped freely at Sable's stall
export const TIPS = [
  { key: 'round', name: 'Round Tip', desc: 'Balanced, as the old Painters made it', cost: 0 },
  { key: 'broad', name: 'Broad Tip', desc: 'Longer, wider, harder strikes, but slower swings', cost: 35, reach: 1.3, arc: 1.25, dmg: 1.2, swing: 1.2 },
  { key: 'fine', name: 'Fine Tip', desc: 'Flicks cost 40% less ink and fly faster; strikes are lighter', cost: 35, dmg: 0.85, swing: 0.9, flickCost: 0.6, flickSpeed: 1.3 },
  { key: 'splatter', name: 'Splatter Tip', desc: 'Each flick bursts into three globs, for more ink', cost: 50, flickCost: 1.6, spread: 3 },
];
export const tipStats = (key) => ({ reach: 1, arc: 1, dmg: 1, swing: 1, flickCost: 1, flickSpeed: 1, spread: 1, ...(TIPS.find((t) => t.key === key) || {}) });

// Buy (if needed) and equip a tip; returns 'equipped', 'bought' or false
export function takeTip(wallet, key) {
  const t = TIPS.find((x) => x.key === key);
  if (!t) return false;
  if (!wallet.tips.includes(key)) {
    if (wallet.pigment < t.cost) return false;
    wallet.pigment -= t.cost;
    wallet.tips.push(key);
    wallet.tip = key;
    return 'bought';
  }
  wallet.tip = key;
  return 'equipped';
}

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
    opts.push('Brush tips…', 'Leave');
    G.hud.choice('Sable the Brushwright', `Bring me Pigment from the ink creatures and I'll rework that brush. You carry ${p.pigment} Pigment.`, opts, (i) => {
      if (i === UPGRADES.length) { this.tips(); return; }
      if (i > UPGRADES.length) { G.hud.dialog('Sable the Brushwright', 'Mind the bristles out there.'); return; }
      const u = UPGRADES[i];
      if (purchase(p, u.key)) {
        G.audio.play('solve');
        G.hud.itemGet('🖌', `${u.name} ${'I'.repeat(p.upg[u.key])}`, u.desc, '#ffd84a');
        G.particles.burst(p.pos.clone().setY(p.pos.y + 1.2), { count: 40, color: 0xffd84a, speed: 5, life: 1, size: 0.4, pool: 'glow', gravity: 2 });
        this.open();
      } else {
        const lvl = p.upg[u.key] || 0;
        G.hud.dialog('Sable the Brushwright', lvl >= u.costs.length ? "That's as good as it gets, friend." : `You'll need ${u.costs[lvl] - p.pigment} more Pigment for that.`);
      }
    });
  }

  tips() {
    const p = G.player;
    const opts = TIPS.map((t) => (p.tip === t.key ? `${t.name} (in use)` : p.tips.includes(t.key) ? `Use ${t.name}` : `${t.name} · ${t.cost} pigment`));
    G.hud.choice('Sable the Brushwright', `A new tip changes how the brush handles. ${TIPS.map((t) => `${t.name}: ${t.desc}.`).join(' ')}`, opts, (i) => {
      const t = TIPS[i];
      const r = takeTip(p, t.key);
      if (!r) { G.hud.dialog('Sable the Brushwright', `The ${t.name} costs ${t.cost} Pigment. You're ${t.cost - p.pigment} short.`); return; }
      p.char.setTipShape(p.tip);
      G.audio.play(r === 'bought' ? 'solve' : 'pickup');
      G.hud.toast(`${r === 'bought' ? 'Bought and fitted' : 'Fitted'} the ${t.name}`, '#ffd84a', 2);
    });
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.npc.group.visible = !p.inDungeon;
    const d = this.pos.distanceTo(p.pos);
    this.npc.setShadow(d < 30);
    this.npc.setLod(d > 28);
    if (!p.inDungeon && d <= 28) this.npc.animate({ state: 'idle', speed: 0 }, dt);
  }
}

// Painter's Honours: achievements earned by playing, kept per player in the local save.
import { G } from '../core/ctx.js';
import { shardCount } from '../core/progress.js';
import { QUESTS } from '../world/quests.js';
import { UPGRADES } from '../world/shop.js';

// check(ctx) is polled; event honours are granted from game code through Honours.event()
export const HONOURS = [
  { id: 'flight', name: 'First Flight', desc: 'Ride your brush into the sky', check: () => G.player?.state === 'ride' },
  { id: 'skyhigh', name: 'Head in the Clouds', desc: 'Fly 150 m above the ground', check: () => { const p = G.player; return p?.state === 'ride' && p.pos.y - G.terrain.heightAt(p.pos.x, p.pos.z) > 150; } },
  { id: 'sneak', name: 'Soft Bristles', desc: 'Land a sneak strike', event: 'sneakStrike' },
  { id: 'flurry', name: 'Flurry of Colour', desc: 'Trigger Flurry Rush 5 times', event: 'flurry', count: 5 },
  { id: 'shard', name: 'Prism Seeker', desc: 'Restore your first Prism Shard', check: () => shardCount() >= 1 },
  { id: 'shards', name: 'Prism Hero', desc: 'Restore all four Prism Shards', check: () => shardCount() >= 4 },
  { id: 'final', name: 'Colour Restored', desc: 'Defeat the Hueless King', check: () => !!G.flags.final },
  { id: 'quest', name: 'Helping Hand', desc: 'Finish a villager quest', check: () => QUESTS.some((q) => G.flags[`q_${q.id}_done`]) },
  { id: 'quests', name: 'Pillar of Palette Hollow', desc: 'Finish every villager quest', check: () => QUESTS.every((q) => G.flags[`q_${q.id}_done`]) },
  { id: 'puzzle', name: 'Riddle Painter', desc: 'Solve an island puzzle', check: () => (G.puzzles?.solvedCount() || 0) >= 1 },
  { id: 'puzzles', name: 'Island Riddler', desc: 'Solve every island puzzle', check: () => G.puzzles && G.puzzles.solvedCount() >= G.puzzles.total },
  { id: 'rainmane', name: 'Storm Tamer', desc: 'Defeat Rainmane, Lord of the Painted Plains', check: () => !!G.flags.slain_rainmane },
  { id: 'giants', name: 'Giant Slayer', desc: 'Fell a Blot Giant and a Stone Sentinel', check: () => G.flags.slain_blotgiant && G.flags.slain_sentinel },
  { id: 'race', name: 'Record Breaker', desc: 'Set a Sky Race record', event: 'raceRecord' },
  { id: 'map50', name: 'Wayfarer', desc: 'Map half the island', check: () => G.fog && G.fog.explored() >= 0.5 },
  { id: 'map90', name: 'Cartographer', desc: 'Map 90% of the island', check: () => G.fog && G.fog.explored() >= 0.9 },
  { id: 'brush', name: 'Master Brushwright', desc: 'Max out a brush upgrade', check: () => G.player && UPGRADES.some((u) => (G.player.upg[u.key] || 0) >= u.costs.length) },
  { id: 'wyrm', name: 'Scale of the Wyrm', desc: 'Catch a Chroma Scale from the Chroma Wyrm', event: 'wyrm' },
  { id: 'targets', name: 'Sharpshooter', desc: 'Set a Target Gallery record', event: 'targets' },
  { id: 'lore', name: 'Loremaster', desc: 'Read all twelve Painted Tablets', event: 'lore' },
  { id: 'star', name: 'Star Catcher', desc: 'Pick up a Star Fragment', event: 'star' },
  { id: 'bat', name: 'Night Watch', desc: 'Pop an Inkbat', event: 'inkbat' },
  { id: 'revive', name: 'Good Samaritan', desc: 'Pick up a fainted friend', event: 'revive' },
  { id: 'angler', name: 'Angler', desc: 'Catch 10 fish from the ice', event: 'fish', count: 10 },
  { id: 'critter', name: 'Soft Steps', desc: 'Sneak up on and catch 5 critters', event: 'critter', count: 5 },
  { id: 'tame', name: 'Buck Whisperer', desc: 'Tame a wild Brushbuck', event: 'tame' },
  { id: 'shrines', name: 'Shrine Seeker', desc: 'Clear all three Paint Shrines', check: () => G.shrines && G.shrines.clearedCount() >= G.shrines.list.length },
  { id: 'echoes', name: 'Echo Breaker', desc: 'Clear the Gallery of Echoes', check: () => !!G.flags.rush_best },
];

export class Honours {
  constructor() {
    this.got = new Set();
    this.counts = {};
    this.t = 0;
    this.ready = false; // don't celebrate honours restored from a save
  }

  serialize() { return { got: [...this.got], counts: this.counts }; }
  load(d) {
    if (!d) return;
    for (const id of d.got || []) this.got.add(id);
    Object.assign(this.counts, d.counts || {});
  }

  grant(h) {
    if (this.got.has(h.id)) return;
    this.got.add(h.id);
    if (!this.ready) return;
    G.audio.play('sprite');
    G.hud.toast(`🏅 Honour earned: ${h.name}`, '#ffd84a', 3.5);
  }

  event(name) {
    for (const h of HONOURS) {
      if (h.event !== name || this.got.has(h.id)) continue;
      this.counts[h.id] = (this.counts[h.id] || 0) + 1;
      if (this.counts[h.id] >= (h.count || 1)) this.grant(h);
    }
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0 || !G.player) return;
    this.t = 1;
    for (const h of HONOURS) if (h.check && !this.got.has(h.id) && h.check()) this.grant(h);
    this.ready = true;
  }

  render(el) {
    el.innerHTML = HONOURS.map((h) => {
      const got = this.got.has(h.id);
      const prog = h.count && !got ? ` (${this.counts[h.id] || 0}/${h.count})` : '';
      return `<div class="honour${got ? ' got' : ''}" title="${h.desc}"><span class="m">${got ? '🏅' : '◯'}</span><b>${h.name}</b><small>${h.desc}${prog}</small></div>`;
    }).join('');
  }
}

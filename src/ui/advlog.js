// Adventure Log: a completion summary shown in the satchel.
import { G } from '../core/ctx.js';
import { shardCount, spriteCount, upgradeCount } from '../core/progress.js';
import { QUESTS } from '../world/quests.js';
import { UPGRADES } from '../world/shop.js';
import { fmtTime } from '../world/races.js';

export function adventureStats() {
  const f = G.flags;
  const races = G.races ? G.races.courses : [];
  const stats = [
    { label: 'Prism Shards', value: `${shardCount()} / 4`, done: shardCount() >= 4 },
    { label: 'Hueless King', value: f.final ? 'Defeated' : 'Awaits', done: !!f.final },
    { label: 'Paint Sprites', value: `${spriteCount()} / ${G.sprites ? G.sprites.total : '?'}`, done: G.sprites && spriteCount() >= G.sprites.total },
    { label: 'Villager quests', value: `${QUESTS.filter((q) => f[`q_${q.id}_done`]).length} / ${QUESTS.length}`, done: QUESTS.every((q) => f[`q_${q.id}_done`]) },
    { label: 'Island puzzles', value: G.puzzles ? `${G.puzzles.solvedCount()} / ${G.puzzles.total}` : '-', done: G.puzzles && G.puzzles.solvedCount() >= G.puzzles.total },
    { label: 'Paint Shrines', value: G.shrines ? `${G.shrines.clearedCount()} / ${G.shrines.list.length}` : '-', done: G.shrines && G.shrines.clearedCount() >= G.shrines.list.length },
    { label: 'Field giants felled', value: `${['blotgiant', 'sentinel', 'rainmane'].filter((t) => f[`slain_${t}`]).length} / 3`, done: f.slain_blotgiant && f.slain_sentinel && f.slain_rainmane },
    { label: 'Map explored', value: G.fog ? `${Math.round(G.fog.explored() * 100)}%` : '-', done: G.fog && G.fog.explored() > 0.9 },
    { label: 'Hearts · stamina found', value: `${upgradeCount('heart')} · ${upgradeCount('stamina')}` },
    { label: 'Brush (bristle · ink · wind)', value: G.player ? UPGRADES.map((u) => G.player.upg[u.key] || 0).join(' · ') : '-' },
    { label: 'Pigment', value: G.player ? `${G.player.pigment}` : '0' },
  ];
  for (const c of races) {
    const b = f[`race_${c.id}`];
    stats.push({ label: `${c.name} record`, value: b ? `${fmtTime(b.t)} (${b.n})` : 'None yet', done: !!b });
  }
  if (G.tablets) stats.push({ label: 'Painted Tablets read', value: `${G.tablets.read.size} / 12`, done: G.tablets.read.size >= 12 });
  stats.push({ label: 'Target Gallery record', value: f.tg_best ? `${f.tg_best.s} pts (${f.tg_best.n})` : 'None yet', done: !!f.tg_best });
  if (f.final) stats.push({ label: 'Gallery of Echoes', value: f.rush_best ? `${fmtTime(f.rush_best.t)} (${f.rush_best.n})` : 'Uncleared', done: !!f.rush_best });
  return stats;
}

export function renderAdventureLog(el) {
  el.innerHTML = adventureStats().map((s) => `<div class="stat${s.done ? ' done' : ''}"><span>${s.label}</span><b>${s.value}</b></div>`).join('');
}

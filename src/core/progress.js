// Derived player stats from shared progress flags.
import { G } from './ctx.js';
import { TRIALS } from '../world/layout.js';

export const shardCount = () => TRIALS.filter((t) => G.flags[`trial_${t.key}`]).length;
export const upgradeCount = (kind) => Object.keys(G.flags).filter((k) => k.startsWith(`upg_${kind}_`) && G.flags[k]).length;
export const spriteCount = () => Object.keys(G.flags).filter((k) => k.startsWith('sprite_') && G.flags[k]).length;

export function applyStats(refill = false) {
  const p = G.player;
  if (!p) return;
  const maxHp = 12 + shardCount() * 2 + upgradeCount('heart') * 2;
  const maxSt = 100 + upgradeCount('stamina') * 25;
  const gainedHp = maxHp > p.maxHp;
  p.maxHp = maxHp;
  p.maxStamina = maxSt;
  if (refill || gainedHp) p.hp = maxHp;
  p.hp = Math.min(p.hp, maxHp);
  if (refill) p.stamina = maxSt;
}

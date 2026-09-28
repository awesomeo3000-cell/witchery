// Local save: remembers where you were and (in solo) all world progress.
import { G } from './ctx.js';

const key = () => `witchery.save.${G.net && G.net.connected ? `room.${G.net.room}` : 'solo'}`;

export function loadSave() {
  try { return JSON.parse(localStorage.getItem(key()) || 'null'); } catch (_) { return null; }
}

export function writeSave() {
  const p = G.player;
  if (!p) return;
  const data = {
    v: 1,
    pos: p.inDungeon ? null : [p.pos.x, p.pos.y, p.pos.z],
    color: p.color,
    ink: p.ink.map((v) => Math.round(v)),
    dayT: G.sky ? G.sky.dayT : 0.33,
    forage: G.forage ? G.forage.serialize() : undefined,
    pigment: p.pigment,
    upg: p.upg,
    fog: G.fog ? G.fog.serialize() : undefined,
    honours: G.honours ? G.honours.serialize() : undefined,
    tablets: G.tablets ? G.tablets.serialize() : undefined,
    steed: G.steeds ? G.steeds.serialize() : undefined,
    memories: G.memories ? G.memories.serialize() : undefined,
    // Online, progress lives on the server; solo keeps it here
    flags: G.net && G.net.connected ? undefined : G.flags,
    t: Date.now(),
  };
  try { localStorage.setItem(key(), JSON.stringify(data)); } catch (_) { /* storage full or blocked */ }
}

export function clearSave() {
  try { localStorage.removeItem(key()); } catch (_) { /* ignore */ }
}

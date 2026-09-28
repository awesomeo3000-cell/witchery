// Journey statistics: a few running totals kept in your local save and shown in the adventure log.
import { G } from '../core/ctx.js';

export const fmtDuration = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};

export class Tally {
  constructor() {
    this.v = { time: 0, walked: 0, flown: 0, ridden: 0, swum: 0, foes: 0, globs: 0, deaths: 0 };
    this.last = null;
  }

  add(k, n = 1) { this.v[k] = (this.v[k] || 0) + n; }

  update(dt) {
    const p = G.player;
    if (!p || !G.game?.running) return;
    this.v.time += dt;
    if (this.last && !p.inDungeon) {
      const d = Math.hypot(p.pos.x - this.last.x, p.pos.z - this.last.z);
      if (d < 50) { // ignore teleports
        if (p.state === 'ride') this.v.flown += d;
        else if (p.mounted) this.v.ridden += d;
        else if (p.state === 'swim') this.v.swum += d;
        else this.v.walked += d;
      }
    }
    this.last = { x: p.pos.x, z: p.pos.z };
  }

  stats() {
    const v = this.v, km = (m) => `${(m / 1000).toFixed(1)} km`;
    return [
      { label: 'Time painting', value: fmtDuration(v.time) },
      { label: 'Walked · flown', value: `${km(v.walked)} · ${km(v.flown)}` },
      { label: 'Ridden · swum', value: `${km(v.ridden)} · ${km(v.swum)}` },
      { label: 'Ink creatures defeated', value: `${v.foes}` },
      { label: 'Paint globs flicked', value: `${v.globs}` },
      { label: 'Times fainted', value: `${v.deaths}` },
    ];
  }

  serialize() { return this.v; }
  load(d) { if (d && typeof d === 'object') for (const k of Object.keys(this.v)) if (Number.isFinite(d[k])) this.v[k] = d[k]; }
}

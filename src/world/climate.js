// Cold and heat: the snowy peaks chill you and the volcano's upper slopes scorch you, slowly
// costing hearts. A Bold (spicy) meal keeps you warm and an Inky meal keeps you cool. The screen
// edge frosts over or shimmers red as a warning.
import { G } from '../core/ctx.js';
import { VOLCANO, WAYPOINTS, TRIALS } from './layout.js';

export const GRACE = 5; // seconds of exposure before it starts to hurt
export const TICK = 8; // then half a heart this often

// -1 freezing, +1 scorching, 0 comfortable
export function climateAt(terrain, x, y, z, night = 0) {
  if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 95 && y > 70) return 1;
  const w = terrain.biome(x, z);
  if (w.frost > 0.5 && y > (night > 0.5 ? 28 : 42)) return -1;
  return 0;
}

// Easels and trial doorways have warming braziers, so they're always a safe place to stand
export const nearShelter = (x, z) => [...WAYPOINTS, ...TRIALS].some((s) => Math.hypot(s.x - x, s.z - z) < 16);

// Does the player's current buff protect them?
export const protectedFrom = (clim, buffs) => (clim < 0 ? buffs.power > 0 : clim > 0 ? buffs.ink > 0 : true);

export class Climate {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'climate';
    document.getElementById('labels').appendChild(this.el);
    this.exposure = 0;
    this.tick = 0;
    this.kind = 0;
    this.checkT = 0;
    this.warned = new Set();
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.5;
      this.kind = p.inDungeon || !p.alive || nearShelter(p.pos.x, p.pos.z) ? 0 : climateAt(G.terrain, p.pos.x, p.pos.y, p.pos.z, G.sky?.night ?? 0);
    }
    const bad = this.kind !== 0 && !protectedFrom(this.kind, p.buffs);
    this.exposure = bad ? this.exposure + dt : Math.max(0, this.exposure - dt * 2);
    if (bad && !this.warned.has(this.kind)) {
      this.warned.add(this.kind);
      G.hud.toast(this.kind < 0 ? 'Brr! It\'s freezing up here. Eat a Bold (spicy) meal to keep warm.' : 'The heat is scorching! Eat an Inky meal to keep cool.', this.kind < 0 ? '#bfe6ff' : '#ffb080', 4);
    }
    if (bad && this.exposure > GRACE) {
      this.tick -= dt;
      if (this.tick <= 0) {
        this.tick = TICK;
        p.takeDamage(1, null, { element: this.kind < 0 ? 'ice' : 'fire', silent: true });
      }
    } else this.tick = 1.5;
    // Screen-edge warning
    const k = Math.min(1, this.exposure / GRACE);
    this.el.className = this.kind < 0 ? 'cold' : this.kind > 0 ? 'hot' : '';
    this.el.style.opacity = bad || this.exposure > 0 ? (0.25 + k * 0.6).toFixed(2) : '0';
  }
}

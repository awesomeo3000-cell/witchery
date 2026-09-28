// Gamepad cursor for the map: the left stick moves a cursor over the parchment, A clicks whatever
// is under it (fast travel, remove a pin) or drops a pin on empty ground, and B closes the map.
import { G } from '../core/ctx.js';

export class MapCursor {
  constructor() {
    this.u = 0.5;
    this.v = 0.5;
    this.el = document.createElement('div');
    this.el.id = 'map-cursor';
    this.el.className = 'hidden';
    document.querySelector('#map .map-inner').appendChild(this.el);
    this.prevA = true;
    this.prevB = true;
  }

  update(dt, open) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    const show = open && !!gp && G.input.usingPad;
    this.el.classList.toggle('hidden', !show);
    if (!show) { this.prevA = this.prevB = true; return; }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    // Start the cursor on yourself when the map opens
    if (!this.wasOpen) {
      const p = G.player;
      this.u = Math.min(1, Math.max(0, p.pos.x / 1600 + 0.5));
      this.v = Math.min(1, Math.max(0, p.pos.z / 1600 + 0.5));
    }
    this.wasOpen = open;
    this.u = Math.min(1, Math.max(0, this.u + dz(gp.axes[0] || 0) * dt * 0.45));
    this.v = Math.min(1, Math.max(0, this.v + dz(gp.axes[1] || 0) * dt * 0.45));
    this.el.style.left = `${this.u * 100}%`;
    this.el.style.top = `${this.v * 100}%`;
    const a = btn(0), b = btn(1);
    if (a && !this.prevA) this.click();
    if (b && !this.prevB) G.game.toggleMap();
    this.prevA = a;
    this.prevB = b;
  }

  click() {
    const box = document.getElementById('map-markers').getBoundingClientRect();
    const x = box.left + this.u * box.width, y = box.top + this.v * box.height;
    // Prefer a marker within a few pixels of the cursor
    let best = null, bd = 22;
    for (const m of document.querySelectorAll('#map-markers .mm')) {
      const r = m.querySelector('.dot')?.getBoundingClientRect();
      if (!r) continue;
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) best.click();
    else G.pins?.add({ x: (this.u - 0.5) * 1600, z: (this.v - 0.5) * 1600 });
  }
}

// Co-op revives: in a room with friends, fainting leaves you down for a while instead of
// respawning at once. A friend holding Interact beside you picks you back up on the spot.
import { G } from '../core/ctx.js';
import { keyFor } from './access.js';

export const DOWN_TIME = 12;
export const REVIVE_HOLD = 1.5;

export class Revive {
  constructor() {
    this.target = null;
    this.hold = 0;
    this.el = document.createElement('div');
    this.el.className = 'revive hidden';
    this.el.innerHTML = '<div class="t"></div><div class="bar"><div></div></div>';
    document.getElementById('labels').appendChild(this.el);
  }

  // Someone revived us
  onNet(m) {
    const p = G.player;
    if (!p || m.to !== G.net?.id || p.state !== 'dead') return;
    const who = G.peers.get(m.from);
    p.hp = Math.ceil(p.maxHp / 2);
    p.state = 'air';
    p.deadT = 0;
    p.invuln = 2.5;
    G.audio.play('solve');
    G.hud.toast(`${who ? who.name : 'A friend'} picked you up!`, '#a8f08c', 2.5);
    G.particles.burst(p.pos.clone().setY(p.pos.y + 1), { count: 40, color: 0xa8f08c, speed: 5, up: 3, life: 1, size: 0.5, pool: 'glow', gravity: 1 });
  }

  update(dt) {
    const p = G.player;
    let best = null, bd = 2.8;
    if (p && p.alive && G.peers) {
      for (const peer of G.peers.values()) {
        if (peer.state !== 'dead') continue;
        const d = peer.pos.distanceTo(p.pos);
        if (d < bd) { bd = d; best = peer; }
      }
    }
    if (best !== this.target) { this.target = best; this.hold = 0; }
    if (!best) { this.el.classList.add('hidden'); return; }
    if (G.input.down('KeyF')) this.hold += dt; else this.hold = Math.max(0, this.hold - dt * 2);
    const s = G.hud.project(best.pos.clone().setY(best.pos.y + 1.6));
    this.el.classList.toggle('hidden', !s);
    if (s) {
      this.el.style.left = `${s.x}px`;
      this.el.style.top = `${s.y}px`;
      this.el.querySelector('.t').textContent = `Hold ${G.input.usingPad ? 'A' : keyFor('KeyF')} to revive ${best.name}`;
      this.el.querySelector('.bar div').style.width = `${Math.min(100, (this.hold / REVIVE_HOLD) * 100)}%`;
    }
    if (this.hold >= REVIVE_HOLD) {
      G.net?.send({ t: 'revive', to: best.id });
      G.audio.play('pickup');
      G.hud.toast(`You picked up ${best.name}!`, '#a8f08c', 2);
      best.state = 'idle';
      this.hold = 0;
      this.target = null;
      this.el.classList.add('hidden');
    }
  }
}

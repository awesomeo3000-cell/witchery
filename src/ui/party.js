// Party panel: in co-op, a small list under your hearts showing each friend's health, how far away
// they are and which way, plus whether they're down or riding. Also quick-chat phrases (T).
import { G } from '../core/ctx.js';

export const PHRASES = ['Over here!', 'Help!', 'Nice one!', 'Follow me', 'Wait for me'];

// Screen-relative arrow toward a point: 0 = straight ahead, clockwise in radians
export function bearing(camYaw, dx, dz) {
  const a = Math.atan2(dx, dz) - (camYaw + Math.PI);
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export class Party {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'party';
    document.getElementById('hud').appendChild(this.el);
    this.t = 0;
  }

  quickChat() {
    if (G.hud.choiceCb) return;
    G.hud.choice('Quick chat', 'Say something to your friends:', [...PHRASES.slice(0, 4), 'Cancel'], (i) => {
      if (i >= 4) return;
      const text = PHRASES[i];
      G.net?.send({ t: 'chat', text, name: G.player.name });
      G.hud.chat(G.player.name, text, '#ffe08a');
      G.audio.play('chat');
    });
  }

  update(dt) {
    if (G.input.hit('KeyT')) this.quickChat();
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.25;
    const p = G.player;
    const peers = G.peers ? [...G.peers.values()] : [];
    if (!p || !peers.length) { if (this.el.innerHTML) this.el.innerHTML = ''; return; }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    this.el.innerHTML = peers.map((q) => {
      const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      const hp = Math.max(0, q.hp ?? 0), mhp = Math.max(2, q.mhp || 12);
      const pct = Math.round((hp / mhp) * 100);
      const down = q.state === 'dead';
      const rot = bearing(p.camYaw, dx, dz);
      const tag = down ? '<b class="down">DOWN</b>' : q.state === 'mount' ? '🦌' : q.state === 'ride' ? '🖌' : '';
      return `<div class="pm${down ? ' isdown' : ''}"><i style="background:#${q.look.hood.toString(16).padStart(6, '0')}"></i><span class="n">${esc(q.name)}</span>${tag}<span class="hp"><s style="width:${pct}%"></s></span><span class="d">${d < 8 ? 'here' : `${Math.round(d)} m`}</span>${d >= 8 ? `<span class="arr" style="transform:rotate(${rot.toFixed(2)}rad)">▲</span>` : ''}</div>`;
    }).join('');
  }
}

// On-screen controls for phones/tablets: left stick, drag-to-look, action buttons.
import { G } from '../core/ctx.js';

const $ = (id) => document.getElementById(id);

const BUTTONS = [
  { id: 'jump', label: 'A', title: 'Jump', key: 'Space', context: true },
  { id: 'atk', label: '⚔', title: 'Strike', mouse: 0 },
  { id: 'aim', label: '◎', title: 'Aim', mouse: 2, toggle: true },
  { id: 'ride', label: '🖌', title: 'Ride', key: 'KeyR' },
  { id: 'lock', label: '◇', title: 'Lock', key: 'KeyQ' },
  { id: 'col', label: '🎨', title: 'Colour', key: 'KeyE' },
  { id: 'sprint', label: '»', title: 'Sprint', key: 'ShiftLeft' },
  { id: 'down', label: '⇩', title: 'Sneak', key: 'KeyC' },
  { mini: true, id: 'ping', label: '📍', title: 'Ping', key: 'KeyV' },
  { mini: true, id: 'emote', label: '☺', title: 'Emote', key: 'KeyB' },
  { mini: true, id: 'eat', label: '🍎', title: 'Eat', key: 'KeyG' },
  { mini: true, id: 'whistle', label: '♪', title: 'Whistle', key: 'KeyX' },
  { mini: true, id: 'qchat', label: '💬', title: 'Quick chat', key: 'KeyT' },
  { mini: true, id: 'map', label: '🗺', title: 'Map', key: 'KeyM' },
  { mini: true, id: 'menu', label: '☰', title: 'Menu', menu: true },
];

export class TouchControls {
  constructor() {
    this.enabled = false;
    this.stickId = null;
    this.lookId = null;
    this.origin = { x: 0, y: 0 };
    this.last = { x: 0, y: 0 };
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse || navigator.maxTouchPoints > 0) window.addEventListener('touchstart', () => this.enable(), { once: true, passive: true });
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    G.input.touch = true;
    const root = $('touch');
    root.classList.remove('hidden');
    document.body.classList.add('touch');
    const btns = $('touch-buttons');
    // Secondary actions live in a slim column on the left so the main cluster stays thumb-sized
    const mini = document.createElement('div');
    mini.id = 'touch-mini';
    root.appendChild(mini);
    for (const b of BUTTONS) {
      const el = document.createElement('div');
      el.className = `tbtn t-${b.id}`;
      el.innerHTML = `<span>${b.label}</span><small>${b.title}</small>`;
      const press = (on) => {
        const inp = G.input;
        if (b.menu) { if (on && G.input.onPadStart) G.input.onPadStart(); return; }
        if (b.mouse !== undefined) {
          if (b.toggle) {
            if (!on) return;
            const held = inp.mouse.buttons.has(b.mouse);
            if (held) { inp.mouse.buttons.delete(b.mouse); inp.mouse.up.add(b.mouse); el.classList.remove('on'); } else { inp.mouse.buttons.add(b.mouse); inp.mouse.down.add(b.mouse); el.classList.add('on'); }
            return;
          }
          if (on) { inp.mouse.buttons.add(b.mouse); inp.mouse.down.add(b.mouse); } else { inp.mouse.buttons.delete(b.mouse); inp.mouse.up.add(b.mouse); }
          return;
        }
        const key = b.context && inp.contextA ? 'KeyF' : b.key;
        if (on) { inp.keys.add(key); inp.pressed.add(key); el.dataset.key = key; } else { const k = el.dataset.key || key; inp.keys.delete(k); inp.released.add(k); }
      };
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); press(true); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('down'); press(false); }, { passive: false });
      (b.mini ? mini : btns).appendChild(el);
    }
    const zone = $('touch-zone');
    zone.addEventListener('touchstart', (e) => this._start(e), { passive: false });
    zone.addEventListener('touchmove', (e) => this._move(e), { passive: false });
    zone.addEventListener('touchend', (e) => this._end(e), { passive: false });
    zone.addEventListener('touchcancel', (e) => this._end(e), { passive: false });
  }

  _start(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.4 && this.stickId === null) {
        this.stickId = t.identifier;
        this.origin = { x: t.clientX, y: t.clientY };
        const s = $('touch-stick');
        s.style.left = `${t.clientX}px`; s.style.top = `${t.clientY}px`;
        s.classList.add('on');
      } else if (this.lookId === null) {
        this.lookId = t.identifier;
        this.last = { x: t.clientX, y: t.clientY };
      }
    }
  }

  _move(e) {
    e.preventDefault();
    const inp = G.input;
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickId) {
        let dx = (t.clientX - this.origin.x) / 55, dy = (t.clientY - this.origin.y) / 55;
        const l = Math.hypot(dx, dy);
        if (l > 1) { dx /= l; dy /= l; }
        inp.usingPad = true;
        inp.stick.x = dx; inp.stick.z = -dy;
        $('touch-knob').style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      } else if (t.identifier === this.lookId) {
        inp.mouse.dx += (t.clientX - this.last.x) * 1.6;
        inp.mouse.dy += (t.clientY - this.last.y) * 1.6;
        this.last = { x: t.clientX, y: t.clientY };
      }
    }
  }

  _end(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickId) {
        this.stickId = null;
        G.input.stick.x = G.input.stick.z = 0;
        $('touch-stick').classList.remove('on');
        $('touch-knob').style.transform = '';
      }
      if (t.identifier === this.lookId) this.lookId = null;
    }
  }
}

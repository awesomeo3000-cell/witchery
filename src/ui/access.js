// Accessibility & controls: key rebinding, toggle sprint, HUD scale, colour symbols for colour-blind
// players, and switches that tone down motion effects and screen flashes. Settings persist with the
// rest of the options in localStorage.
import { G } from '../core/ctx.js';

const $ = (id) => document.getElementById(id);

// Rebindable keyboard actions; `code` is the logical code the game reads
export const ACTIONS = [
  { id: 'fwd', label: 'Move forward', code: 'KeyW' },
  { id: 'back', label: 'Move back', code: 'KeyS' },
  { id: 'left', label: 'Move left', code: 'KeyA' },
  { id: 'right', label: 'Move right', code: 'KeyD' },
  { id: 'jump', label: 'Jump / Glide / Dodge', code: 'Space' },
  { id: 'sprint', label: 'Sprint / Boost', code: 'ShiftLeft' },
  { id: 'interact', label: 'Interact', code: 'KeyF' },
  { id: 'lock', label: 'Lock on', code: 'KeyQ' },
  { id: 'cycle', label: 'Next colour', code: 'KeyE' },
  { id: 'wheel', label: 'Colour wheel', code: 'Tab' },
  { id: 'ride', label: 'Ride the brush', code: 'KeyR' },
  { id: 'descend', label: 'Sneak / descend (riding)', code: 'KeyC' },
  { id: 'map', label: 'Map', code: 'KeyM' },
  { id: 'satchel', label: 'Satchel', code: 'KeyI' },
  { id: 'eat', label: 'Quick eat', code: 'KeyG' },
  { id: 'photo', label: 'Photo mode', code: 'KeyP' },
  { id: 'ping', label: 'Ping a spot', code: 'KeyV' },
  { id: 'emote', label: 'Emote', code: 'KeyB' },
  { id: 'hide', label: 'Hide controls', code: 'KeyH' },
];

export const SYMBOLS = ['▲', '❄', '●', '✿']; // Ember, Frost, Spring, Bloom

const NAMES = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', AltRight: 'R-Alt', Tab: 'Tab', Enter: 'Enter', Backspace: 'Bksp', CapsLock: 'Caps', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
export function keyLabel(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num${code.slice(6)}`;
  return code;
}

// Physical key currently bound to a logical action code
export function physKey(logicalCode) {
  const a = ACTIONS.find((x) => x.code === logicalCode);
  if (!a) return logicalCode;
  return (G.settings.binds || {})[a.id] ?? a.code;
}
export const keyFor = (logicalCode) => keyLabel(physKey(logicalCode));

export function applyBindings() {
  const binds = G.settings.binds || {};
  const map = {};
  const used = new Set();
  for (const a of ACTIONS) {
    const phys = binds[a.id] ?? a.code;
    used.add(phys);
    if (phys !== a.code) map[phys] = a.code;
  }
  // A default key that now belongs to nobody stops doing its old job
  for (const a of ACTIONS) if (!used.has(a.code) && !(a.code in map)) map[a.code] = '';
  G.input.map = map;
  G.input.toggleCodes = new Set(G.settings.toggleSprint ? ['ShiftLeft'] : []);
  G.input.keys.clear();
  G.hud?.renderControls();
}

export function applyAccess() {
  const s = G.settings;
  document.documentElement.style.setProperty('--hud-scale', String(s.hudScale || 1));
  document.body.classList.toggle('symbols', !!s.colorSymbols);
  document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
}

export class AccessUI {
  constructor(save) {
    this.save = save;
    this.capture = null;
    const s = G.settings;
    s.hudScale ??= 1;
    s.fov ??= 65;
    s.camDist ??= 1;
    s.fox ??= true;
    s.minimap ??= true;
    s.binds ??= {};
    const bind = (id, key, parse) => {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = !!s[key]; else el.value = s[key];
      el.addEventListener('input', () => {
        s[key] = el.type === 'checkbox' ? el.checked : parse(el.value);
        applyAccess();
        if (key === 'toggleSprint') applyBindings();
        this.save();
      });
    };
    bind('set-hudscale', 'hudScale', parseFloat);
    bind('set-fov', 'fov', parseFloat);
    bind('set-camdist', 'camDist', parseFloat);
    bind('set-symbols', 'colorSymbols');
    bind('set-motion', 'reduceMotion');
    bind('set-flash', 'reduceFlash');
    bind('set-togglesprint', 'toggleSprint');
    bind('set-fox', 'fox');
    bind('set-minimap', 'minimap');
    $('binds-reset').onclick = () => { s.binds = {}; applyBindings(); this.render(); this.save(); };
    // Capture the next key press while rebinding
    window.addEventListener('keydown', (e) => {
      if (!this.capture) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== 'Escape') this.rebind(this.capture, e.code);
      this.capture = null;
      this.render();
    }, true);
    applyAccess();
    applyBindings();
    this.render();
  }

  // Bind an action to a physical key; the action that owned that key takes over the old one
  rebind(id, phys) {
    const binds = G.settings.binds;
    const a = ACTIONS.find((x) => x.id === id);
    const old = binds[id] ?? a.code;
    const other = ACTIONS.find((x) => x.id !== id && (binds[x.id] ?? x.code) === phys);
    if (other) binds[other.id] = old;
    binds[id] = phys;
    for (const x of ACTIONS) if (binds[x.id] === x.code) delete binds[x.id];
    applyBindings();
    this.save();
  }

  render() {
    const box = $('binds');
    box.innerHTML = '';
    for (const a of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'bind';
      const b = document.createElement('button');
      b.className = 'secondary';
      b.textContent = this.capture === a.id ? 'Press a key…' : keyLabel(physKey(a.code));
      b.onclick = (e) => { e.preventDefault(); this.capture = a.id; this.render(); };
      row.append(a.label, b);
      box.appendChild(row);
    }
  }
}

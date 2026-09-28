// Keyboard + mouse input with pointer lock. Tracks "pressed this frame" edges.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, x: 0, y: 0, buttons: new Set(), down: new Set(), up: new Set(), wheel: 0 };
    this.locked = false;
    this.enabled = true; // false while typing in chat / menus
    this.onLockChange = null;
    // Gamepad state
    this.usingPad = false;
    this.padHeld = new Set(); // virtual codes currently held by the pad
    this.stick = { x: 0, z: 0 };
    this.contextA = false; // set by the player when an interaction is available
    this.onPadStart = null;
    this.onPadBack = null;
    window.addEventListener('gamepadconnected', () => { this.usingPad = true; });

    // Key remapping: physical code -> logical code the game reads ('' = unbound)
    this.map = {};
    // Logical codes that toggle on press instead of being held (e.g. toggle sprint)
    this.toggleCodes = new Set();
    window.addEventListener('keydown', (e) => {
      this.usingPad = false;
      if (!this.enabled) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      const code = this.logical(e.code);
      if (!code) return;
      if (this.toggleCodes.has(code)) {
        if (e.repeat) return;
        if (this.keys.has(code)) { this.keys.delete(code); this.released.add(code); } else { this.keys.add(code); this.pressed.add(code); }
        return;
      }
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
    });
    window.addEventListener('keyup', (e) => {
      const code = this.logical(e.code);
      if (!code || this.toggleCodes.has(code)) return;
      this.keys.delete(code);
      this.released.add(code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.buttons.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked) return;
      this.mouse.buttons.add(e.button);
      this.mouse.down.add(e.button);
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (this.mouse.buttons.has(e.button)) this.mouse.up.add(e.button);
      this.mouse.buttons.delete(e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (!this.locked || !this.enabled) return;
      // Clamp spikes some browsers emit on pointer-lock re-entry.
      const cap = 250;
      this.mouse.dx += Math.max(-cap, Math.min(cap, e.movementX));
      this.mouse.dy += Math.max(-cap, Math.min(cap, e.movementY));
    });
    window.addEventListener('wheel', (e) => {
      if (this.locked) this.mouse.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) {
        this.mouse.buttons.clear();
        this.keys.clear();
      }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  logical(code) { return code in this.map ? this.map[code] : code; }

  lock() {
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: false });
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* ignored */ }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  btn(b) { return this.enabled && this.mouse.buttons.has(b); }
  btnDown(b) { return this.enabled && this.mouse.down.has(b); }
  btnUp(b) { return this.mouse.up.has(b); }

  // Xbox-style layout (standard mapping). A: jump / interact, B: sprint, X/RT: attack, Y: ride brush,
  // LB: lock on, RB: next colour, LT: aim, D-pad: colours, L3: descend, Back: map, Start: pause.
  pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { if (!this.touch) this.stick.x = this.stick.z = 0; return; }
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    const any = lx || ly || rx || ry || gp.buttons.some((q) => q.pressed);
    if (any) this.usingPad = true;
    const start = b(9);
    if (start && !this._start && this.onPadStart) this.onPadStart();
    this._start = start;
    if (!this.usingPad || !this.enabled) return;
    this.stick.x = lx;
    this.stick.z = -ly;
    // Right stick drives the camera like mouse movement (with a response curve)
    const curve = (v) => Math.sign(v) * v * v;
    this.mouse.dx += curve(rx) * 1500 * dt;
    this.mouse.dy += curve(ry) * 1000 * dt;
    const map = {
      1: 'ShiftLeft', 3: 'KeyR', 4: 'KeyQ', 5: 'KeyE', 10: 'KeyC', 11: 'KeyG',
      12: 'Digit1', 15: 'Digit2', 13: 'Digit3', 14: 'Digit4',
    };
    const set = (code, on) => {
      if (on && !this.padHeld.has(code)) { this.padHeld.add(code); this.keys.add(code); this.pressed.add(code); }
      else if (!on && this.padHeld.has(code)) { this.padHeld.delete(code); this.keys.delete(code); this.released.add(code); }
    };
    for (const i in map) set(map[i], b(Number(i)));
    // View: tap for the map, hold for the quick menu (ping, emote)
    const view = b(8);
    if (view) {
      this._viewT = (this._viewT || 0) + dt;
      if (this._viewT > 0.35 && !this._viewQuick) { this._viewQuick = true; if (this.onPadQuick) this.onPadQuick(); }
    } else if (this._viewT) {
      if (!this._viewQuick) this.pressed.add('KeyM');
      this._viewT = 0;
      this._viewQuick = false;
    }
    // A is contextual: interact when something is in reach, otherwise jump / glide / rise
    const a = b(0);
    if (a && !this._aHeld) set(this.contextA ? 'KeyF' : 'Space', true);
    if (!a && this._aHeld) { set('KeyF', false); set('Space', false); }
    this._aHeld = a;
    const mbtn = (btn, on) => {
      const key = `m${btn}`;
      if (on && !this.padHeld.has(key)) { this.padHeld.add(key); this.mouse.buttons.add(btn); this.mouse.down.add(btn); }
      else if (!on && this.padHeld.has(key)) { this.padHeld.delete(key); this.mouse.buttons.delete(btn); this.mouse.up.add(btn); }
    };
    mbtn(0, b(2) || b(7));
    mbtn(2, b(6));
  }

  axis() {
    if (this.usingPad && (this.stick.x || this.stick.z)) {
      const l = Math.hypot(this.stick.x, this.stick.z);
      return l > 1 ? { x: this.stick.x / l, z: this.stick.z / l } : { x: this.stick.x, z: this.stick.z };
    }
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    const l = Math.hypot(x, z);
    return l > 0 ? { x: x / l, z: z / l } : { x: 0, z: 0 };
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.down.clear();
    this.mouse.up.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }
}

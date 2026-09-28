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

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
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

  axis() {
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

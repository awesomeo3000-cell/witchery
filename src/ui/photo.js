// Photo mode: free camera around the player, HUD hidden, colour filters, save a PNG.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

const $ = (id) => document.getElementById(id);
export const FILTERS = ['Natural', 'Vivid', 'Golden', 'Noir', 'Gouache', 'Dreamy'];

export class PhotoMode {
  constructor() {
    this.active = false;
    this.filter = 0;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.fov = 60;
    this.capture = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && G.game && G.game.running && !G.game.chatOpen && !(G.forage && G.forage.open)) this.toggle();
    });
  }

  toggle() {
    this.active = !this.active;
    $('hud').classList.toggle('photo', this.active);
    $('photo-ui').classList.toggle('hidden', !this.active);
    if (this.active) {
      this.pos.copy(G.camera.position);
      const d = new THREE.Vector3();
      G.camera.getWorldDirection(d);
      this.yaw = Math.atan2(-d.x, -d.z);
      this.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
      this.fov = G.camera.fov;
      this._label();
    } else {
      this.filter = 0;
    }
  }

  _label() { $('photo-filter').textContent = `Filter: ${FILTERS[this.filter]}`; }

  update(dt) {
    if (!this.active) return;
    const inp = G.input;
    const p = G.player;
    p.invuln = Math.max(p.invuln, 0.3);
    this.yaw -= inp.mouse.dx * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - inp.mouse.dy * 0.0022, -1.4, 1.4);
    if (inp.mouse.wheel) this.fov = THREE.MathUtils.clamp(this.fov + inp.mouse.wheel * 3, 20, 100);
    const a = inp.axis();
    const sp = (inp.down('ShiftLeft') ? 16 : 6) * dt;
    const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.pos.addScaledVector(f, a.z * sp).addScaledVector(r, a.x * sp);
    if (inp.down('Space')) this.pos.y += sp;
    if (inp.down('KeyC')) this.pos.y -= sp;
    // Stay near the player so the world around stays streamed in
    const off = this.pos.clone().sub(p.pos);
    if (off.length() > 45) this.pos.copy(p.pos).add(off.setLength(45));
    const th = G.collision.terrainHeight(this.pos.x, this.pos.y, this.pos.z);
    if (this.pos.y < th + 0.3) this.pos.y = th + 0.3;
    for (let i = 0; i < FILTERS.length; i++) if (inp.hit(`Digit${i + 1}`)) { this.filter = i; this._label(); }
    if (inp.hit('KeyE')) { this.filter = (this.filter + 1) % FILTERS.length; this._label(); }
    if (inp.hit('Enter') || inp.hit('KeyF')) this.capture = true;
    const cam = G.camera;
    cam.position.copy(this.pos);
    cam.lookAt(this.pos.clone().add(f));
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }

  // Called right after rendering so the drawing buffer is still valid
  afterRender(canvas) {
    if (!this.capture) return;
    this.capture = false;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `witchery-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      G.audio.play('flick');
      const fl = $('flash');
      fl.style.transition = 'none';
      fl.style.background = 'rgba(255,255,255,0.8)';
      requestAnimationFrame(() => { fl.style.transition = 'background 0.4s'; fl.style.background = 'transparent'; });
    }, 'image/png');
  }
}

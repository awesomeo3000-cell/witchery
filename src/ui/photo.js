// Photo mode: free camera around the player, HUD hidden, colour filters, save a PNG.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

const $ = (id) => document.getElementById(id);
export const FILTERS = ['Natural', 'Vivid', 'Golden', 'Noir', 'Gouache', 'Dreamy'];
export const FRAMES = ['None', 'Polaroid', 'Painted'];
export const POSES = ['As is', 'Wave', 'Cheer', 'Sit', 'Glide', 'Ride'];
const POSE_STATE = { Wave: 'emote_wave', Cheer: 'emote_cheer', Sit: 'emote_sit', Glide: 'glide', Ride: 'ride' };

export class PhotoMode {
  constructor() {
    this.active = false;
    this.filter = 0;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.fov = 60;
    this.capture = false;
    this.frame = 0;
    this.pose = 0;
    this.hideFriends = false;
    window.addEventListener('keydown', (e) => {
      if (G.input.logical(e.code) === 'KeyP' && G.game && G.game.running && !G.game.chatOpen && !(G.forage && G.forage.open)) this.toggle();
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
      this.pose = 0;
      this._hideFriends(false);
    }
    this._frameOverlay();
  }

  _label() {
    $('photo-filter').textContent = `Filter: ${FILTERS[this.filter]} · Frame: ${FRAMES[this.frame]} · Pose: ${POSES[this.pose]}${this.hideFriends ? ' · Friends hidden' : ''}`;
  }

  _frameOverlay() {
    const el = $('photo-frame');
    el.className = this.active && this.frame ? `f${this.frame}` : 'hidden';
  }

  _hideFriends(on) {
    this.hideFriends = on;
    if (G.peers) for (const peer of G.peers.values()) peer.char.group.visible = !on;
    if (G.fox) G.fox.m.group.visible = !on;
  }

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
    if (inp.hit('KeyG')) { this.frame = (this.frame + 1) % FRAMES.length; this._frameOverlay(); this._label(); }
    if (inp.hit('KeyR')) { this.pose = (this.pose + 1) % POSES.length; this._label(); }
    if (inp.hit('KeyV')) { this._hideFriends(!this.hideFriends); this._label(); }
    if (this.hideFriends) this._hideFriends(true);
    // Pose the hero (the normal player update is paused in photo mode)
    const ps = POSE_STATE[POSES[this.pose]];
    if (ps) p.char.animate({ state: ps, speed: 0, pitch: 0, roll: 0 }, dt);
    if (inp.hit('Enter') || inp.hit('KeyF')) this.capture = true;
    const cam = G.camera;
    cam.position.copy(this.pos);
    cam.lookAt(this.pos.clone().add(f));
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }

  // Composite the render with the chosen frame onto a 2D canvas
  _framed(src) {
    const W = src.width, H = src.height;
    const polaroid = this.frame === 1;
    const pad = Math.round(Math.min(W, H) * 0.04), bottom = polaroid ? pad * 3.5 : pad;
    const cv = document.createElement('canvas');
    cv.width = W + pad * 2;
    cv.height = H + pad + bottom;
    const x = cv.getContext('2d');
    if (polaroid) {
      x.fillStyle = '#fbf7ee';
      x.fillRect(0, 0, cv.width, cv.height);
      x.drawImage(src, pad, pad);
      x.fillStyle = '#4a3a2a';
      x.font = `${Math.round(pad * 1.2)}px Georgia, serif`;
      x.textAlign = 'center';
      x.fillText(`Witchery · ${new Date().toLocaleDateString()}`, cv.width / 2, H + pad + bottom * 0.62);
    } else {
      // Painted border: dabs of the four paint colours around the edge
      x.fillStyle = '#1a1622';
      x.fillRect(0, 0, cv.width, cv.height);
      const cols = ['#e8442e', '#3a9ae8', '#f2c229', '#3fb54a'];
      for (let i = 0; i < 260; i++) {
        const t = i / 260, side = i % 4;
        const along = (t * 4) % 1;
        const px = side === 0 ? along * cv.width : side === 1 ? cv.width - pad / 2 : side === 2 ? (1 - along) * cv.width : pad / 2;
        const py = side === 0 ? pad / 2 : side === 1 ? along * cv.height : side === 2 ? cv.height - pad / 2 : (1 - along) * cv.height;
        x.fillStyle = cols[(i * 7) % 4];
        x.globalAlpha = 0.85;
        x.beginPath();
        x.ellipse(px, py, pad * (0.6 + (i % 5) * 0.12), pad * 0.45, (i * 1.7) % Math.PI, 0, Math.PI * 2);
        x.fill();
      }
      x.globalAlpha = 1;
      x.drawImage(src, pad, pad);
    }
    return cv;
  }

  // Called right after rendering so the drawing buffer is still valid
  afterRender(canvas) {
    if (!this.capture) return;
    this.capture = false;
    G.compendium?.onPhoto(canvas);
    const out = this.frame ? this._framed(canvas) : canvas;
    out.toBlob((blob) => {
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

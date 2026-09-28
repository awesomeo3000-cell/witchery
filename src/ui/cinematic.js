// Short in-engine cinematics: letterboxed camera moves with a boss title card.
import * as THREE from 'three';
import { G, inDungeonY } from '../core/ctx.js';

const $ = (id) => document.getElementById(id);

export const BOSS_TITLES = {
  frostmaw: ['Frostmaw', 'Glacial Colossus'],
  magmaw: ['Magmaw', 'Molten Glutton'],
  shellback: ['Shellback', 'Armoured Roller'],
  galewing: ['Galewing', 'Tempest Sovereign'],
  hueless: ['The Hueless King', 'Devourer of Colour'],
  blotgiant: ['Blot Giant', 'Slumbering Brute of the Fields'],
  sentinel: ['Stone Sentinel', 'Wandering Cairn'],
  rainmane: ['Rainmane', 'Lord of the Painted Plains'],
};

export class Cinematic {
  constructor() {
    this.active = null;
    this.seen = new Set();
  }

  // Orbit the camera around a target while a title card shows
  bossIntro(e) {
    if (this.seen.has(e.id) || this.active) return;
    this.seen.add(e.id);
    const t = BOSS_TITLES[e.type];
    if (!t) return;
    const p = G.player;
    const start = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    this.active = { kind: 'orbit', e, t: 0, dur: 3.4, start, dist: e.radius * 3.2 + 8, height: e.height * 0.5 };
    this._letterbox(true);
    this._card(t[0], t[1]);
    G.audio.play('bossRoar');
  }

  // Quick focus shot (phase changes)
  focus(e, title, sub, dur = 2.2) {
    if (this.active) return;
    const p = G.player;
    this.active = { kind: 'orbit', e, t: 0, dur, start: Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z), dist: e.radius * 2.6 + 7, height: e.height * 0.6, spin: 0.25 };
    this._letterbox(true);
    if (title) this._card(title, sub);
  }

  _letterbox(on) { $('letterbox').classList.toggle('on', on); }

  _card(title, sub) {
    const c = $('bosscard');
    c.querySelector('.t').textContent = title;
    c.querySelector('.s').textContent = sub || '';
    c.classList.remove('hidden');
    c.style.animation = 'none';
    void c.offsetWidth;
    c.style.animation = '';
    clearTimeout(this._cardTimer);
    this._cardTimer = setTimeout(() => c.classList.add('hidden'), 3600);
  }

  get frozen() { return !!this.active; }

  // Called after the player camera update; overrides the camera while active
  update(dt) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    const k = a.t / a.dur;
    const e = a.e;
    const ang = a.start + (a.spin ?? 0.9) * Math.sin(k * Math.PI * 0.5) * Math.PI * 0.5;
    const d = a.dist * (1.15 - 0.25 * k);
    const cam = G.camera;
    const target = e.pos.clone().setY(e.pos.y + a.height);
    const want = target.clone().add(new THREE.Vector3(Math.sin(ang) * d, a.height * 0.3 + 1.5 - k, Math.cos(ang) * d));
    // Keep above the ground outdoors (underground rooms have no terrain to clamp to)
    if (!inDungeonY(target.y)) {
      const th = G.collision.terrainHeight(want.x, want.y, want.z);
      if (want.y < th + 1) want.y = th + 1;
    }
    cam.position.copy(want);
    cam.lookAt(target);
    if (a.t >= a.dur || !e.alive) {
      this.active = null;
      this._letterbox(false);
      G.player.camPos.copy(cam.position);
    }
  }
}

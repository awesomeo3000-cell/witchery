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

  // New game: a slow flight over the island that settles behind the hero. Any key skips it.
  intro() {
    const p = G.player;
    const h = (x, z, up) => Math.max(G.terrain.heightAt(x, z), 0) + up;
    const pts = [
      new THREE.Vector3(-260, h(-260, 260, 55), 260),
      new THREE.Vector3(-120, h(-120, 120, 45), 130),
      new THREE.Vector3(40, h(40, 20, 55), 20),
      new THREE.Vector3(30, h(30, 150, 30), 150),
      p.pos.clone().add(new THREE.Vector3(0, 3, 6)),
    ];
    const looks = [new THREE.Vector3(0, 170, -140), new THREE.Vector3(0, 130, -140), new THREE.Vector3(0, 30, 90), new THREE.Vector3(0, 8, 100), p.pos.clone().add(new THREE.Vector3(0, 1.5, -6))];
    this.active = { kind: 'path', t: 0, dur: 9, path: new THREE.CatmullRomCurve3(pts), looks, e: { alive: true } };
    this._letterbox(true);
    document.body.classList.add('cine-intro');
    this._card('Witchery', 'The colour is fading. Pick up your brush.');
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
    if (a.kind === 'path') {
      const cam = G.camera;
      const s = k * k * (3 - 2 * k); // ease in and out
      cam.position.copy(a.path.getPoint(Math.min(1, s)));
      const f = Math.min(a.looks.length - 1.001, s * (a.looks.length - 1));
      const i = Math.floor(f);
      cam.lookAt(a.looks[i].clone().lerp(a.looks[i + 1], f - i));
      const skip = a.t > 0.6 && (G.input.pressed.size || G.input.mouse.down.size);
      if (a.t >= a.dur || skip) {
        this.active = null;
        this._letterbox(false);
        document.body.classList.remove('cine-intro');
        G.player.camPos.copy(cam.position);
        G.hud.banner('Palette Hollow', 'Talk to Elder Umber (F) near the statue', '#ffe08a');
      }
      return;
    }
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

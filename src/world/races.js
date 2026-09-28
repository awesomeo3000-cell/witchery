// Sky Races: timed ring courses for brush flight. Fly through a golden start gate while riding to
// begin; every ring passed tops up stamina; best times are shared room flags (race_<id>).
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { CITADEL } from './layout.js';

const $ = (id) => document.getElementById(id);
export const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

// Hand-placed control points [x, height above ground, z]; rings are spaced along a smooth curve
const COURSES = [
  { id: 'lake', name: 'Lakeside Loop', color: 0x4ad0e0, r: 5, pts: [[45, 16, 30], [-40, 12, 130], [-110, 10, 170], [-170, 8, 240], [-240, 12, 200], [-220, 14, 130], [-150, 10, 120], [-80, 16, 60], [-10, 18, 40]] },
  { id: 'mesa', name: 'Canyon Run', color: 0xffa040, r: 4.5, pts: [[80, 16, 330], [140, 12, 370], [190, 10, 420], [160, 14, 480], [90, 10, 500], [40, 12, 450], [30, 16, 390], [70, 20, 350]] },
  { id: 'isles', name: 'Islet Hop', color: 0xc080ff, r: 5, islets: true },
];

export class Races {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.courses = COURSES.map((c) => this._build(c));
    this.active = null;
    this.prev = new THREE.Vector3();
  }

  _points(c) {
    if (!c.islets) return c.pts.map(([x, h, z]) => new THREE.Vector3(x, G.terrain.heightAt(x, z) + h, z));
    // Weave between the islets ringing the citadel, in order of angle
    const isl = G.world.islets
      .filter((s) => Math.hypot(s.x - CITADEL.x, s.z - CITADEL.z) < 280)
      .sort((a, b) => Math.atan2(a.z - CITADEL.z, a.x - CITADEL.x) - Math.atan2(b.z - CITADEL.z, b.x - CITADEL.x))
      .slice(0, 8);
    const pts = [];
    isl.forEach((s, i) => {
      const n = isl[(i + 1) % isl.length];
      pts.push(new THREE.Vector3((s.x + n.x) / 2, (s.y + n.y) / 2 + 6, (s.z + n.z) / 2));
    });
    return pts;
  }

  _build(c) {
    const ctrl = this._points(c);
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const n = Math.max(8, Math.round(curve.getLength() / 42));
    const mat = new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.9, fog: false });
    const geo = new THREE.TorusGeometry(c.r, 0.45, 10, 48);
    const rings = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const pos = curve.getPointAt(u);
      pos.y = Math.max(pos.y, G.terrain.heightAt(pos.x, pos.z) + c.r + 3, c.r + 3);
      const tan = curve.getTangentAt(u).normalize();
      const m = new THREE.Mesh(geo, i === 0 ? new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd84a).multiplyScalar(1.8), transparent: true, fog: false }) : mat.clone());
      m.position.copy(pos);
      m.lookAt(pos.clone().add(tan));
      m.visible = i === 0;
      this.root.add(m);
      rings.push({ pos, normal: tan, mesh: m });
    }
    // Start gate flourish: a slowly spinning inner ring
    const inner = new THREE.Mesh(new THREE.TorusGeometry(c.r * 0.7, 0.12, 6, 32), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.7, fog: false }));
    rings[0].mesh.add(inner);
    const course = { ...c, rings, inner };
    course.marker = G.hud.addMarker(`<div class="ic race" style="background:#${c.color.toString(16).padStart(6, '0')}">⟳</div>`, () => rings[0].pos, () => !this.active && rings[0].pos.distanceTo(G.player.pos) < 350);
    return course;
  }

  best(c) { return G.flags[`race_${c.id}`] || null; }

  _start(c) {
    this.active = { c, i: 1, t: 0, since: 0, grounded: 0 };
    for (const r of c.rings) r.mesh.visible = false;
    this._show();
    G.audio.play('waypoint');
    const b = this.best(c);
    G.hud.banner(c.name, `Fly through every ring!${b ? ` Record ${fmtTime(b.t)} (${b.n})` : ''}`, '#ffe08a');
    this.nextMarker = G.hud.addMarker('<div class="ic race next">◎</div>', () => (this.active ? this.active.c.rings[this.active.i].pos : new THREE.Vector3()), () => !!this.active);
    $('race').classList.remove('hidden');
  }

  _show() {
    const a = this.active;
    a.c.rings.forEach((r, k) => {
      r.mesh.visible = k === a.i || k === a.i + 1;
      r.mesh.material.opacity = k === a.i ? 1 : 0.35;
      // Over-bright colour so the next ring blooms
      r.mesh.material.color.setHex(a.c.color).multiplyScalar(k === a.i ? 2.2 : 1);
    });
  }

  _end(msg, color) {
    const c = this.active.c;
    this.active = null;
    for (const r of c.rings) r.mesh.visible = false;
    c.rings[0].mesh.visible = true;
    G.hud.removeMarker(this.nextMarker);
    $('race').classList.add('hidden');
    if (msg) G.hud.toast(msg, color || '#dddddd', 2.5);
  }

  _finish() {
    const { c, t } = this.active;
    const b = this.best(c);
    const record = !b || t < b.t;
    if (record) { G.trials._setFlag(`race_${c.id}`, { t: Math.round(t * 10) / 10, n: G.player.name || 'You' }); G.honours?.event('raceRecord'); }
    G.audio.play(record ? 'shard' : 'solve');
    G.hud.banner(record ? 'New Record!' : 'Course Complete', `${c.name} · ${fmtTime(t)}${!record ? ` (record ${fmtTime(b.t)})` : ''}`, record ? '#ffd84a' : '#ffffff');
    this._end();
  }

  // Did the segment prev -> cur pass through the ring?
  _through(r, radius, cur) {
    const d0 = this.prev.clone().sub(r.pos).dot(r.normal);
    const d1 = cur.clone().sub(r.pos).dot(r.normal);
    if (d0 === d1 || Math.sign(d0) === Math.sign(d1)) return cur.distanceTo(r.pos) < radius * 0.6;
    const k = d0 / (d0 - d1);
    const hit = this.prev.clone().lerp(cur, k);
    return hit.distanceTo(r.pos) < radius + 0.6;
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.root.visible = !p.inDungeon;
    const cur = p.pos.clone().setY(p.pos.y + 1);
    const t = G.time;
    for (const c of this.courses) {
      c.inner.rotation.z = t * 1.5;
      const g = c.rings[0].mesh;
      if (!this.active) g.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    }
    const a = this.active;
    if (!a) {
      if (p.state === 'ride' && !p.inDungeon) {
        for (const c of this.courses) if (c.rings[0].pos.distanceTo(cur) < 30 && this._through(c.rings[0], c.r, cur)) { this._start(c); break; }
      }
    } else {
      a.t += dt;
      a.since += dt;
      a.grounded = p.state === 'ride' ? 0 : a.grounded + dt;
      const r = a.c.rings[a.i];
      if (this._through(r, a.c.r, cur)) {
        const k = a.i / (a.c.rings.length - 1);
        G.audio.tone?.(520 * Math.pow(2, k), 0.18, 'triangle', 0.14, 1.5);
        G.particles.burst(r.pos, { count: 30, color: a.c.color, speed: 6, life: 0.6, size: 0.5, pool: 'glow' });
        p.stamina = Math.min(p.maxStamina, p.stamina + 20);
        p.exhausted = false;
        a.i++;
        a.since = 0;
        if (a.i >= a.c.rings.length) { this._finish(); this.prev.copy(cur); return; }
        this._show();
      } else if (a.grounded > 3) this._end('Race abandoned: you left your brush.');
      else if (a.since > 30) this._end('Race abandoned: too long since the last ring.');
      else if (p.inDungeon || !p.alive) this._end();
      if (this.active) {
        const b = this.best(a.c);
        $('race').innerHTML = `<b>${a.c.name}</b><span class="t">${fmtTime(a.t)}</span><span>Ring ${a.i}/${a.c.rings.length - 1}</span>${b ? `<span class="b">Record ${fmtTime(b.t)} · ${b.n}</span>` : ''}`;
        const nr = a.c.rings[a.i];
        nr.mesh.scale.setScalar(1 + Math.sin(t * 6) * 0.06);
      }
    }
    this.prev.copy(cur);
  }

  // Start gates on the map
  mapMarkers(add) {
    for (const c of this.courses) {
      const b = this.best(c);
      add(c.rings[0].pos.x, c.rings[0].pos.z, 'mrace', `#${c.color.toString(16).padStart(6, '0')}`, `${c.name}${b ? ` · ${fmtTime(b.t)}` : ''}`);
    }
  }
}

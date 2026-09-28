// The Chroma Wyrm: a vast, peaceful rainbow serpent that loops the skies over the island, like the
// spirit dragons of old. It never attacks. Paint that strikes it knocks loose a Chroma Scale that
// drifts to the ground, worth a great deal of Pigment. Its position comes from wall-clock time,
// so every player in a room sees it in the same place.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';

export const SCALE_PIGMENT = 40;
const SEGMENTS = 58;
const SPACING = 1.8;
const SPEED = 17; // m/s

export class Wyrm {
  constructor(scene) {
    const rand = mulberry32(2024);
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 330 + rand() * 230;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pts.push(new THREE.Vector3(x, Math.max(G.terrain.heightAt(x, z), 0) + 75 + rand() * 60, z));
    }
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.len = this.curve.getLength();
    this.group = new THREE.Group();
    scene.add(this.group);
    // Body: one instanced sphere per segment, banded through the four paint colours and white
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x222233 });
    this.body = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), mat, SEGMENTS);
    this.body.castShadow = true;
    this.body.frustumCulled = false;
    // A continuous rainbow from the pale head down to the tail
    const c = new THREE.Color();
    for (let i = 0; i < SEGMENTS; i++) {
      const k = i / SEGMENTS;
      c.setHSL((k * 1.4) % 1, 0.75, 0.62 - Math.max(0, 0.08 - k) * 2);
      if (i < 3) c.lerp(new THREE.Color(0xfff0dc), 1 - i / 3);
      this.body.setColorAt(i, c);
    }
    this.group.add(this.body);
    // Head with snout, horns, whiskers and glowing eyes
    this.head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 14), new THREE.MeshLambertMaterial({ color: 0xfff0dc, emissive: 0x332a22 }));
    skull.scale.set(1, 0.85, 1.35);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.2, 12).rotateX(Math.PI / 2), skull.material);
    snout.position.z = 3.6;
    this.head.add(skull, snout);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.4, 8), new THREE.MeshLambertMaterial({ color: 0xffd84a, emissive: 0x403000 }));
      horn.position.set(s * 1.3, 2.2, -0.8);
      horn.rotation.set(-0.8, 0, s * 0.3);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ee0ff).multiplyScalar(2) }));
      eye.position.set(s * 1.25, 0.8, 1.9);
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 5, 5).rotateX(Math.PI / 2), horn.material);
      whisker.position.set(s * 1.1, -0.4, 4.8);
      whisker.rotation.y = s * 0.5;
      this.head.add(horn, eye, whisker);
    }
    this.group.add(this.head);
    // Fins along the back
    this.fins = [];
    const finMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x303040, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    for (let i = 4; i < SEGMENTS - 4; i += 5) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 3), finMat.clone());
      fin.material.color.setHex(COLORS[Math.floor(i / 5) % 4].hex);
      this.group.add(fin);
      this.fins.push({ fin, i });
    }
    this.segs = Array.from({ length: SEGMENTS }, () => new THREE.Vector3());
    this.cool = 0;
    this.m4 = new THREE.Matrix4();
    this.marker = G.hud.addMarker('<div class="ic" style="background:linear-gradient(90deg,#e8442e,#f2c229,#3fb54a,#3a9ae8)">≈</div>', () => this.segs[0], () => this.segs[0].distanceTo(G.player.pos) < 450);
  }

  _radius(i) { return 2.4 * (1 - Math.pow(i / SEGMENTS, 1.3) * 0.8); }

  // Where along the loop (0..1) the head is right now, shared by everyone via the wall clock
  headU() { return ((Date.now() / 1000) * SPEED / this.len) % 1; }

  update(dt) {
    const p = G.player;
    const t = G.time;
    const u0 = this.headU();
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(), dir = new THREE.Vector3(), obj = this._obj || (this._obj = new THREE.Object3D());
    for (let i = 0; i < SEGMENTS; i++) {
      let u = u0 - (i * SPACING) / this.len;
      u -= Math.floor(u);
      const pos = this.curve.getPointAt(u, this.segs[i]);
      // A slow vertical undulation travels down the body
      pos.y += Math.sin(t * 1.6 - i * 0.28) * 2.2;
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const pos = this.segs[i];
      const r = i === 0 ? 0 : this._radius(i);
      // Stretch each segment along the body so they blend into one smooth tube
      dir.copy(this.segs[Math.max(0, i - 1)]).sub(this.segs[Math.min(SEGMENTS - 1, i + 1)]);
      obj.position.copy(pos);
      obj.lookAt(pos.clone().add(dir));
      q.copy(obj.quaternion);
      this.m4.compose(pos, q, sc.set(r, r * 0.92, r * 1.7).max(new THREE.Vector3(0.01, 0.01, 0.01)));
      this.body.setMatrixAt(i, this.m4);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.position.copy(this.segs[0]);
    this.head.lookAt(this.segs[0].clone().multiplyScalar(2).sub(this.segs[1]));
    for (const f of this.fins) {
      const a = this.segs[f.i], b = this.segs[f.i + 1];
      f.fin.position.copy(a).setY(a.y + this._radius(f.i) * 0.92 + 0.5);
      f.fin.lookAt(b.x, f.fin.position.y, b.z);
      f.fin.rotation.z += Math.sin(t * 3 + f.i) * 0.2;
    }
    this.group.visible = !!p && !p.inDungeon && this.segs[0].distanceTo(G.camera.position) < 900;
    if (!this.group.visible) return;
    const near = p && this.segs[0].distanceTo(p.pos) < 160;
    if (near && !this.sang) G.hud.caption('The Chroma Wyrm sings overhead', this.segs[0]);
    this.sang = near;
    // Sparkling trail
    if (Math.random() < dt * 20) {
      const s = this.segs[SEGMENTS - 1];
      G.particles.burst(s, { count: 2, color: COLORS[Math.floor(Math.random() * 4)].hex, speed: 1, life: 2, size: 1.2, pool: 'glow', gravity: 0.5 });
    }
    // Paint striking the body shakes loose a scale (host decides; everyone sees the sparkle)
    this.cool -= dt;
    for (const g of G.paint.globs) {
      if (g.life <= 0) continue;
      for (let i = 0; i < SEGMENTS; i += 2) {
        const r = i === 0 ? 3 : this._radius(i) + 0.7;
        if (g.pos.distanceTo(this.segs[i]) > r) continue;
        g.life = 0;
        G.particles.burst(g.pos, { count: 30, color: COLORS[g.color].hex, speed: 7, life: 0.8, size: 0.5, pool: 'glow' });
        G.audio.play('glint', 0.8);
        if (G.enemies.isHost && this.cool <= 0) {
          this.cool = 8;
          const k = G.enemies.spawnPickup('scale', this.segs[i].clone());
          k.life = 240;
          // Let it drift all the way down (it floats if it lands on water)
          k.ground = Math.max(G.terrain.heightAt(k.pos.x, k.pos.z), 0) + 0.8;
          G.enemies.fx('scaleDrop', this.segs[i]);
        }
        break;
      }
    }
  }
}

// Co-op pings: press V to mark the spot under the crosshair. Everyone in the room sees a coloured
// beacon in the world and a marker on their compass for a few seconds.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

const LIFE = 12;
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

export class Pings {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.cool = 0;
    this.beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 60, 8, 1, true).translate(0, 30, 0);
    this.ringGeo = new THREE.TorusGeometry(1.4, 0.12, 6, 28).rotateX(Math.PI / 2);
    this.gemGeo = new THREE.OctahedronGeometry(0.7);
  }

  // Local ping from the camera's aim
  cast() {
    if (this.cool > 0) return;
    const cam = G.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const hit = G.collision.raycast(cam.position, dir, 500, { water: true });
    if (!hit) { G.hud.toast('Nothing to ping there', '#dddddd', 1.2); return; }
    const pos = hit.point ? hit.point.clone() : cam.position.clone().addScaledVector(dir, hit.dist);
    this.cool = 1;
    const p = G.player;
    this.add(pos, p.name || 'You', p.look?.hood ?? 0xffe08a);
    G.net?.send({ t: 'ping', p: [pos.x, pos.y, pos.z], n: p.name });
  }

  add(pos, who, color) {
    // One ping per player at a time
    const old = this.list.find((q) => q.who === who);
    if (old) this._remove(old);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const g = new THREE.Group();
    const beam = new THREE.Mesh(this.beamGeo, mat);
    const ring = new THREE.Mesh(this.ringGeo, mat.clone());
    ring.material.opacity = 0.9;
    const gem = new THREE.Mesh(this.gemGeo, new THREE.MeshBasicMaterial({ color, fog: false }));
    gem.position.y = 3;
    g.add(beam, ring, gem);
    g.position.copy(pos);
    g.renderOrder = 4;
    this.scene.add(g);
    const q = { who, pos: pos.clone(), g, ring, gem, beam, t: 0 };
    q.marker = G.hud.addMarker(`<div class="ic ping" style="background:${hex(color)}">!</div>`, () => q.pos, () => true);
    this.list.push(q);
    G.audio.play('glint');
    G.audio.play('switch', 0.5);
    if (who !== (G.player.name || 'You')) G.hud.toast(`${who} pinged a spot`, hex(color), 1.8);
  }

  onNet(m) {
    const peer = G.peers.get(m.from);
    this.add(new THREE.Vector3(...m.p), peer ? peer.name : m.n || '?', peer ? peer.look.hood : 0xffffff);
  }

  _remove(q) {
    this.scene.remove(q.g);
    q.g.traverse((o) => { if (o.material) o.material.dispose(); });
    G.hud.removeMarker(q.marker);
    this.list.splice(this.list.indexOf(q), 1);
  }

  update(dt) {
    this.cool -= dt;
    if (G.input.hit('KeyV') && G.input.locked) this.cast();
    for (const q of [...this.list]) {
      q.t += dt;
      if (q.t > LIFE) { this._remove(q); continue; }
      const k = q.t < 0.3 ? q.t / 0.3 : 1;
      const fade = Math.min(1, (LIFE - q.t) / 1.5);
      // Keep the beacon readable at any distance
      const s = Math.max(1, q.pos.distanceTo(G.camera.position) / 40);
      q.ring.scale.setScalar((1 + Math.sin(q.t * 5) * 0.12) * k * s);
      q.gem.scale.setScalar(k * s);
      q.gem.position.y = 3 * s + Math.sin(q.t * 3) * 0.3 * s;
      q.gem.rotation.y += dt * 2;
      q.beam.scale.set(s, 1, s);
      q.beam.material.opacity = 0.35 * fade;
      q.ring.material.opacity = 0.9 * fade;
    }
  }
}

// Painter's Towers: four tall painted towers, one between the village and each trial. Swirling
// winds around them ground your brush, so you climb: grow vines up the mossy base, bounce from the
// ledge up to the mossy crown, and vine-climb over the top. Activating the easel up there reveals the map around
// it for everyone in the room.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { VILLAGE, TRIALS } from './layout.js';
import { MAT } from './props.js';
import { mergeStatic } from './merge.js';

export const BASE_H = 13; // mossy lower section
export const SMOOTH_H = 8; // bare stone above the ledge: too tall to jump, a bounce reaches past it
export const TOP_H = 26; // top of the mossy crown
export const NOFLY_R = 32;
export const REVEAL_R = 260;

// A flat, dry spot a little over halfway from the village toward each trial
export function towerSites(terrain) {
  return TRIALS.map((t, i) => {
    const bx = VILLAGE.x + (t.x - VILLAGE.x) * 0.55, bz = VILLAGE.z + (t.z - VILLAGE.z) * 0.55;
    let best = null;
    for (let r = 0; r < 90 && !best; r += 6) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + i;
        const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
        const h = terrain.heightAt(x, z);
        if (h < 3) continue;
        const flat = [[5, 0], [-5, 0], [0, 5], [0, -5]].every(([dx, dz]) => Math.abs(terrain.heightAt(x + dx, z + dz) - h) < 1.2);
        if (flat) { best = { x, z, y: h }; break; }
      }
    }
    return { ...(best || { x: bx, z: bz, y: terrain.heightAt(bx, bz) }), color: t.color, name: `${COLORS[t.color].name} Tower` };
  });
}

export class Towers {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.bandMats = COLORS.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c.hex).multiplyScalar(1.2) }));
    this.list = towerSites(G.terrain).map((s, i) => this._build(s, i));
    mergeStatic(this.root);
  }

  active(i) { return !!G.flags[`tower_${i}`]; }
  activeCount() { return this.list.filter((t) => this.active(t.i)).length; }

  _box(x, y, z, w, h, d, mat, tags) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    this.root.add(m);
    G.collision.addBox(x, y + h / 2, z, w, h, d, { tags });
    return m;
  }

  _build(s, i) {
    const { x, y, z } = s;
    const col = COLORS[s.color];
    // Mossy base (vines), a ledge ring, then a smooth upper shaft (bounce) and the top platform
    this._box(x, y - 1, z, 6, BASE_H + 1, 6, MAT.mossWall, ['mossy']);
    const ledgeMat = new THREE.MeshLambertMaterial({ color: col.hex, emissive: col.hex, emissiveIntensity: 0.15 });
    this._box(x, y + BASE_H, z, 9.5, 0.6, 9.5, ledgeMat, ['smooth']);
    const ledgeTop = BASE_H + 0.6;
    this._box(x, y + ledgeTop, z, 4.6, SMOOTH_H, 4.6, MAT.stone, ['smooth']);
    this._box(x, y + ledgeTop + SMOOTH_H, z, 4.6, TOP_H - ledgeTop - SMOOTH_H, 4.6, MAT.mossWall, ['mossy']);
    this._box(x, y + TOP_H, z, 4.8, 0.4, 4.8, ledgeMat, ['smooth']);
    // Painted bands spiralling up the shaft
    for (let k = 0; k < 4; k++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(4.75, 0.35, 4.75), this.bandMats[(s.color + k) % 4]);
      band.position.set(x, y + BASE_H + 2 + k * 1.8, z);
      this.root.add(band);
    }
    // Easel on top: grey until activated, then it glows in the tower's colour
    const easel = new THREE.Group();
    easel.position.set(x, y + TOP_H + 0.4, z);
    for (const sx of [-0.5, 0.5]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 5), MAT.woodDark);
      leg.position.set(sx, 1.1, 0);
      leg.rotation.z = -sx * 0.2;
      easel.add(leg);
    }
    const canvasMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a, emissive: 0x000000 });
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.08), canvasMat);
    canvas.position.set(0, 1.6, 0.05);
    easel.add(canvas);
    this.root.add(easel);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col.hex).multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    beacon.position.set(x, y + TOP_H + 30, z);
    this.root.add(beacon);
    const t = { i, ...s, easel, canvasMat, beacon, top: new THREE.Vector3(x, y + TOP_H + 0.4, z), base: new THREE.Vector3(x, y, z) };
    G.world.interactables.push({
      pos: t.top.clone().setY(t.top.y + 1), radius: 3,
      prompt: () => (this.active(i) ? `${s.name} (active)` : `Paint the ${s.name} easel`),
      action: () => this.activate(t),
    });
    t.marker = G.hud.addMarker(`<div class="ic" style="background:${col.css}">♜</div>`, () => t.base, () => !G.player.inDungeon && !this.active(i) && t.base.distanceTo(G.player.pos) < 400);
    return t;
  }

  activate(t) {
    if (this.active(t.i)) { G.hud.dialog(t.name, 'The easel glows. The land around it is already on your map.'); return; }
    G.trials._setFlag(`tower_${t.i}`);
  }

  // Everyone in the room gets the reveal when any friend activates a tower
  onFlag(k, v) {
    const m = /^tower_(\d)$/.exec(k);
    if (!m || !v) return;
    const t = this.list[+m[1]];
    if (!t) return;
    G.fog?.reveal(t.x, t.z, REVEAL_R);
    const near = G.player && G.player.pos.distanceTo(t.top) < 60;
    if (near) {
      G.audio.play('shard');
      G.hud.banner(`${t.name} Activated`, `The map around it is revealed (${this.activeCount()}/4 towers)`, COLORS[t.color].css);
      G.particles.burst(t.top.clone().setY(t.top.y + 2), { count: 80, color: COLORS[t.color].hex, speed: 12, life: 1.5, size: 0.7, pool: 'glow', gravity: 3 });
      if (G.cine && !G.settings.reduceMotion) G.cine.focus({ pos: t.base, radius: 30, height: TOP_H * 0.6, alive: true, }, null, null, 3);
    } else G.hud.toast(`A friend activated the ${t.name}: new map revealed`, COLORS[t.color].css, 3);
    if (this.activeCount() >= 4) G.honours?.event('towers');
  }

  mapMarkers(add) {
    // Active towers are fast-travel points (you arrive at the foot)
    for (const t of this.list) add(t.x, t.z, `mq${this.active(t.i) ? ' ft' : ''}`, this.active(t.i) ? COLORS[t.color].css : '#9a9a9a', `${t.name}${this.active(t.i) ? ' (travel)' : ' (dormant)'}`, this.active(t.i) ? () => G.game.fastTravel({ x: t.x + 8, z: t.z }) : null);
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.root.visible = !p.inDungeon;
    if (p.inDungeon) return;
    for (const t of this.list) {
      const on = this.active(t.i);
      t.canvasMat.color.setHex(on ? COLORS[t.color].hex : 0x9a9a9a);
      t.canvasMat.emissive.setHex(on ? COLORS[t.color].hex : 0x000000);
      t.beacon.material.opacity = on ? 0.18 + Math.sin(G.time * 2 + t.i) * 0.05 : 0;
      // The tower's winds ground brush riders close by, so the climb is the way up
      const dh = Math.hypot(p.pos.x - t.x, p.pos.z - t.z);
      if (p.state === 'ride' && dh < NOFLY_R && p.pos.y < t.y + TOP_H + 12) {
        p.state = 'air';
        p.vel.x *= -0.4; p.vel.z *= -0.4;
        G.audio.play('glide');
        G.hud.toast(`The ${t.name}'s winds ground your brush. Climb it: vines on the moss, a bounce pad on the ledge, vines again at the crown.`, COLORS[t.color].css, 3.5);
      }
    }
  }
}

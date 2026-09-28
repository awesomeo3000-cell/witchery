// Paint globs, splats and their elemental effects:
//   ember -> fire patch (burns, lights braziers, burns brambles, melts ice)
//   frost -> ice patch / ice floe on water (freezes, walkable water)
//   spring -> bounce pad (launches players & enemies)
//   bloom  -> vines (roots enemies; on walls: climbable vine ladder)
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { makeSplatTexture } from '../world/props.js';
import { brushStats } from '../world/shop.js';


const UP = new THREE.Vector3(0, 1, 0);
const GRAVITY = 16;
const MAX_SPLATS = 160;
const SPLAT_LIFE = { fire: 7, ice: 22, bounce: 25, vine: 40 };

export class PaintSystem {
  constructor(scene) {
    this.scene = scene;
    this.globs = [];
    this.splats = [];
    this.steams = [];
    this.textures = [makeSplatTexture(3), makeSplatTexture(17), makeSplatTexture(71)];
    this.globGeo = new THREE.IcosahedronGeometry(0.28, 1);
    this.globMats = COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c.hex }));
    this.splatMats = [];
    for (const c of COLORS) {
      this.splatMats.push(this.textures.map((t) => new THREE.MeshLambertMaterial({
        color: c.hex, map: t, transparent: true, alphaTest: 0.35, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, emissive: c.hex, emissiveIntensity: 0.15,
      })));
    }
    this.padGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.35, 16);
    this.padMat = new THREE.MeshLambertMaterial({ color: 0xf2c229, emissive: 0xa07010, emissiveIntensity: 0.4 });
    this.floeGeo = new THREE.CylinderGeometry(2.3, 2.0, 0.6, 9);
    this.vineMat = new THREE.MeshLambertMaterial({ color: 0x3f9a3a, flatShading: true });
    this.leafMat = new THREE.MeshLambertMaterial({ color: 0x6acb4a, flatShading: true });
    // Paint mask around the camera so grass takes on the colour of splats underneath it
    this.maskSize = 128;
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = this.maskCanvas.height = 256;
    this.maskCtx = this.maskCanvas.getContext('2d');
    this.maskTex = new THREE.CanvasTexture(this.maskCanvas);
    this.maskTex.flipY = false;
    this.maskCenter = new THREE.Vector2(0, 0);
    this.maskDirty = true;
    this.maskTimer = 0;
  }

  _redrawMask() {
    const ctx = this.maskCtx;
    const S = this.maskSize, px = 256 / S;
    ctx.clearRect(0, 0, 256, 256);
    for (const s of this.splats) {
      if (s.life <= 0 || s.vertical || s.onWater || s.kind !== 'terrain') continue;
      const x = (s.pos.x - this.maskCenter.x + S / 2) * px;
      const y = (s.pos.z - this.maskCenter.y + S / 2) * px;
      if (x < -10 || y < -10 || x > 266 || y > 266) continue;
      const a = Math.min(1, s.life / 1.5);
      const c = COLORS[s.color];
      const r = s.radius * px * 1.05;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, c.css);
      g.addColorStop(0.75, c.css);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.maskTex.needsUpdate = true;
  }

  _updateMask(dt) {
    const cam = G.camera.position;
    const snap = 16;
    const cx = Math.round(cam.x / snap) * snap, cz = Math.round(cam.z / snap) * snap;
    if (cx !== this.maskCenter.x || cz !== this.maskCenter.y) { this.maskCenter.set(cx, cz); this.maskDirty = true; }
    this.maskTimer -= dt;
    if (this.splats.some((s) => s.life > 0 && s.life < 1.5)) this.maskDirty = true;
    if (this.maskDirty && this.maskTimer <= 0) {
      this.maskTimer = 0.1;
      this.maskDirty = false;
      this._redrawMask();
    }
  }

  // Launch a glob. owner: 'local' | peerId. cosmetic globs never create splats.
  throwGlob(origin, vel, colorIdx, owner = 'local', opts = {}) {
    const mesh = new THREE.Mesh(this.globGeo, this.globMats[colorIdx]);
    mesh.position.copy(origin);
    mesh.scale.setScalar(opts.small ? 0.6 : 1);
    this.scene.add(mesh);
    this.globs.push({ mesh, pos: origin.clone(), vel: vel.clone(), color: colorIdx, owner, life: 3, small: !!opts.small, cosmetic: owner !== 'local' });
  }

  _surfaceSplat(point, normal, colorIdx, radius) {
    const tex = Math.floor(Math.random() * 3);
    const onTerrain = normal.kind === 'terrain';
    let geo;
    if (onTerrain && G.terrain) {
      // Conform to terrain with a small grid disc
      geo = new THREE.PlaneGeometry(radius * 2, radius * 2, 6, 6);
      geo.rotateX(-Math.PI / 2);
      const rot = Math.random() * Math.PI * 2;
      geo.rotateY(rot);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const wx = point.x + p.getX(i), wz = point.z + p.getZ(i);
        p.setY(i, G.terrain.heightAt(wx, wz) - point.y + 0.06);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.splatMats[colorIdx][tex]);
      m.position.copy(point);
      m.receiveShadow = true;
      return m;
    }
    geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    const m = new THREE.Mesh(geo, this.splatMats[colorIdx][tex]);
    m.position.copy(point).addScaledVector(normal.n, 0.04);
    m.lookAt(point.clone().add(normal.n));
    m.rotateZ(Math.random() * Math.PI * 2);
    return m;
  }

  // Create a splat and its elemental effect. Called for local hits and for network events.
  createSplat(point, normalVec, colorIdx, kind, opts = {}) {
    const el = COLORS[colorIdx].element;
    const n = normalVec.clone();
    const radius = opts.radius || 1.6;
    const vertical = Math.abs(n.y) < 0.5;
    const onWater = kind === 'water';
    const splat = { pos: point.clone(), normal: n, color: colorIdx, element: el, life: SPLAT_LIFE[el], max: SPLAT_LIFE[el], objs: [], radius, vertical, onWater, kind, hostile: !!opts.hostile };
    if (opts.hostile) splat.life = splat.max = el === 'fire' ? 5 : 8;

    if (onWater) {
      G.water?.ripple(point.x, point.z, 0.8);
      if (el === 'ice') {
        const floe = new THREE.Mesh(this.floeGeo, new THREE.MeshLambertMaterial({ color: 0xd8f2ff, emissive: 0x4080b0, emissiveIntensity: 0.25, flatShading: true, transparent: true, opacity: 1 }));
        floe.position.set(point.x, point.y - 0.05, point.z);
        floe.rotation.y = Math.random() * Math.PI;
        floe.receiveShadow = true;
        this.scene.add(floe);
        splat.objs.push(floe);
        splat.collider = G.collision.addCylinder(point.x, point.z, 2.2, point.y - 1.2, point.y + 0.25, { dynamic: true, tags: ['ice', 'floe'] });
        splat.life = splat.max = 30;
        G.particles.burst(point, { count: 20, color: 0xd8f4ff, speed: 4, life: 0.8, size: 0.4, gravity: 4 });
      } else if (el === 'vine') {
        // Bloom grows a broad lily pad you can hop across (smaller than a floe, but it doesn't melt)
        const pad = new THREE.Group();
        const leaf = new THREE.Mesh(this.lilyGeo || (this.lilyGeo = new THREE.CylinderGeometry(1.6, 1.5, 0.18, 14, 1, false, 0.35, Math.PI * 2 - 0.35)), this.lilyMat || (this.lilyMat = new THREE.MeshLambertMaterial({ color: 0x4aa84a, emissive: 0x143a14, side: THREE.DoubleSide })));
        const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 6), new THREE.MeshLambertMaterial({ color: 0xffb4d8, emissive: 0x402030 }));
        bloom.position.set(0.7, 0.25, 0.4);
        pad.add(leaf, bloom);
        pad.position.set(point.x, point.y + 0.02, point.z);
        pad.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(pad);
        splat.objs.push(pad);
        splat.collider = G.collision.addCylinder(point.x, point.z, 1.5, point.y - 1.2, point.y + 0.12, { dynamic: true, tags: ['floe', 'lily'] });
        splat.life = splat.max = 40;
        G.particles.burst(point, { count: 16, color: 0x8cf08c, speed: 3, up: 2, life: 0.7, size: 0.35, gravity: 6 });
      } else {
        G.particles.burst(point, { count: 16, color: COLORS[colorIdx].hex, speed: 3, up: 3, life: 0.7, size: 0.35, gravity: 10 });
        return null; // other paints just dissolve in water
      }
    } else {
      const m = this._surfaceSplat(point, { n, kind }, colorIdx, radius);
      this.scene.add(m);
      splat.objs.push(m);
      if (el === 'bounce' && !vertical) {
        const pad = new THREE.Mesh(this.padGeo, this.padMat);
        pad.position.copy(point).addScaledVector(n, 0.12);
        pad.quaternion.setFromUnitVectors(UP, n);
        this.scene.add(pad);
        splat.objs.push(pad);
        splat.pad = pad;
      }
      if (el === 'vine' && !(vertical && opts.noClimb)) this._growVines(splat, opts);
      if (el === 'ice' && !vertical) {
        for (let i = 0; i < 5; i++) {
          const shard = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7 + Math.random() * 0.6, 5), new THREE.MeshLambertMaterial({ color: 0xcdefff, emissive: 0x3a7ab0, emissiveIntensity: 0.3, flatShading: true }));
          const a = Math.random() * Math.PI * 2, d = Math.random() * radius * 0.8;
          shard.position.set(point.x + Math.cos(a) * d, point.y + 0.25, point.z + Math.sin(a) * d);
          if (kind === 'terrain') shard.position.y = G.terrain.heightAt(shard.position.x, shard.position.z) + 0.25;
          shard.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
          this.scene.add(shard);
          splat.objs.push(shard);
        }
      }
    }
    this.splats.push(splat);
    this.maskDirty = true;
    if (this.splats.length > MAX_SPLATS) this._remove(this.splats.shift());

    // Interactions with world objects (braziers, brambles, seeds, flowers...)
    if (G.world) {
      for (const r of G.world.reactives) {
        if (!r.active || r.meleeOnly) continue;
        const d = r.pos.distanceTo(point);
        if (d < (r.radius || 2) + radius * 0.6) r.onPaint(el, point, splat);
      }
    }
    // Fire extinguishes ice/splats and vice versa
    for (const s of this.splats) {
      if (s === splat || s.life <= 0) continue;
      if (s.pos.distanceTo(point) > radius + s.radius) continue;
      if ((el === 'fire' && (s.element === 'ice' || s.element === 'vine')) || (el === 'ice' && s.element === 'fire')) {
        s.life = Math.min(s.life, 0.3);
        if (el === 'fire' && s.element === 'vine') G.particles.flames(s.pos, 1, 8);
        G.particles.burst(s.pos, { count: 10, color: 0xdddddd, speed: 2, up: 2, life: 1, size: 0.8, gravity: -1, alpha: 0.5 });
        // Frost on burning paint boils into a cloud of steam that hides anyone inside it
        if (el === 'ice' && s.element === 'fire' && !s.onWater) this._steam(s.pos);
      }
      // Ember on a Spring pad: the pad bursts in a blast that knocks back and burns ink creatures
      if (el === 'fire' && s.pad && s.life > 0.3) {
        s.life = 0.2;
        this._blast(s.pos, !opts.net);
      }
    }
    const snd = { fire: 'fire', ice: 'ice', bounce: 'bounce', vine: 'vine' }[el];
    G.audio.play('splat', 0.7);
    if (opts.loud !== false) G.audio.play(snd, 0.5);
    return splat;
  }

  _steam(pos) {
    const c = { pos: pos.clone(), r: 5, life: 7 };
    this.steams.push(c);
    G.audio.play('glide', 0.8);
    G.hud.caption('Steam hisses up', pos);
    G.particles.burst(pos.clone().setY(pos.y + 1), { count: 40, color: 0xf2f2f2, speed: 3, up: 3, life: 2.5, size: 2.2, gravity: -0.6, alpha: 0.55, grow: 1.8 });
    if (!G.guide?.seen.has('steam')) { G.guide?.seen.add('steam'); G.hud.toast('Steam! Enemies can\'t see you while you stand in it.', '#e8e8e8', 3); }
  }

  // Inside a steam cloud?
  inSteam(pos) { return this.steams.some((c) => c.life > 0 && Math.hypot(pos.x - c.pos.x, pos.z - c.pos.z) < c.r && Math.abs(pos.y - c.pos.y) < 6); }

  _blast(pos, local) {
    G.audio.play('slam');
    G.audio.play('fire');
    G.hud.caption('A pad bursts in flame', pos);
    G.particles.burst(pos.clone().setY(pos.y + 0.6), { count: 60, color: 0xffa040, speed: 12, life: 0.7, size: 0.8, pool: 'glow', gravity: 6 });
    G.particles.flames(pos, 2.5, 30, 1.5);
    if (G.player && G.player.pos.distanceTo(pos) < 25) G.player.cameraShake = Math.max(G.player.cameraShake, 0.4);
    if (!local || !G.enemies) return;
    // Only the painter's own client deals the damage, so co-op doesn't double it
    for (const e of G.enemies.list) {
      if (!e.alive) continue;
      const d = e.pos.clone().sub(pos);
      if (d.length() > 4.5 + e.radius) continue;
      d.y = 0;
      G.enemies.localHit(e, { dmg: 14, element: 'fire', dir: d.lengthSq() > 0.01 ? d.normalize() : new THREE.Vector3(1, 0, 0), source: 'blast', hy: e.pos.y + e.height * 0.5 });
    }
    G.honours?.event('blast');
  }

  _growVines(splat, opts) {
    const { pos, normal, vertical } = splat;
    const grp = new THREE.Group();
    if (vertical && splat.kind === 'box') {
      // Climbable vine ladder from the hit point up the wall (and a bit below)
      const top = opts.wallTop ?? pos.y + 6;
      const bottom = Math.max(opts.wallBottom ?? pos.y - 3, pos.y - 4);
      const height = Math.max(1, top - bottom);
      const tangent = new THREE.Vector3(-normal.z, 0, normal.x);
      for (let i = -1; i <= 1; i++) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, height, 5), this.vineMat);
        stem.position.copy(pos).addScaledVector(tangent, i * 0.55).addScaledVector(normal, 0.12);
        stem.position.y = bottom + height / 2;
        stem.scale.y = 0.01;
        stem.userData.grow = 1;
        grp.add(stem);
      }
      for (let y = bottom + 0.4; y < top; y += 0.6) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), this.leafMat);
        leaf.position.copy(pos).addScaledVector(tangent, (Math.random() - 0.5) * 1.4).addScaledVector(normal, 0.2);
        leaf.position.y = y;
        leaf.scale.set(1, 0.5, 1);
        leaf.visible = false;
        leaf.userData.at = y;
        grp.add(leaf);
      }
      const half = 1.0;
      const min = new THREE.Vector3(pos.x - half - Math.abs(normal.x) * 0.6, bottom, pos.z - half - Math.abs(normal.z) * 0.6);
      const max = new THREE.Vector3(pos.x + half + Math.abs(normal.x) * 0.6, top, pos.z + half + Math.abs(normal.z) * 0.6);
      // Keep the region thin along the wall normal but on the outside of the wall
      if (Math.abs(normal.x) > 0.5) { min.x = pos.x + Math.min(0, normal.x * 0.9); max.x = pos.x + Math.max(0, normal.x * 0.9); }
      else { min.z = pos.z + Math.min(0, normal.z * 0.9); max.z = pos.z + Math.max(0, normal.z * 0.9); }
      splat.climb = { min, max, normal: normal.clone(), active: true, top };
      G.collision.climbables.push(splat.climb);
      splat.growY = { bottom, top, t: 0 };
    } else {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
        const d = 0.3 + Math.random() * splat.radius * 0.8;
        const h = 0.6 + Math.random() * 1.1;
        const tendril = new THREE.Mesh(new THREE.ConeGeometry(0.1, h, 4), this.vineMat);
        let py = pos.y;
        const px = pos.x + Math.cos(a) * d, pz = pos.z + Math.sin(a) * d;
        if (splat.kind === 'terrain') py = G.terrain.heightAt(px, pz);
        tendril.position.set(px, py + h / 2, pz);
        tendril.rotation.set((Math.random() - 0.5) * 0.7, 0, (Math.random() - 0.5) * 0.7);
        tendril.scale.y = 0.01;
        tendril.userData.grow = 1;
        grp.add(tendril);
      }
    }
    this.scene.add(grp);
    splat.objs.push(grp);
    splat.vines = grp;
  }

  _remove(s) {
    for (const o of s.objs) {
      this.scene.remove(o);
      o.traverse?.((m) => { if (m.geometry && m.geometry !== this.padGeo && m.geometry !== this.floeGeo && m.geometry !== this.lilyGeo && m.geometry !== this.globGeo) m.geometry.dispose(); });
    }
    if (s.collider) G.collision.removeDynamic(s.collider);
    if (s.climb) {
      s.climb.active = false;
      const i = G.collision.climbables.indexOf(s.climb);
      if (i >= 0) G.collision.climbables.splice(i, 1);
    }
    s.life = 0;
  }

  clearAll() {
    for (const s of this.splats) this._remove(s);
    this.splats.length = 0;
  }

  // Splats affecting a position (for enemies/players)
  splatsNear(pos, pad = 0) {
    const out = [];
    for (const s of this.splats) {
      if (s.life <= 0 || s.onWater || s.vertical) continue;
      const dx = pos.x - s.pos.x, dz = pos.z - s.pos.z;
      if (dx * dx + dz * dz < (s.radius + pad) ** 2 && Math.abs(pos.y - s.pos.y) < 1.6) out.push(s);
    }
    return out;
  }

  update(dt) {
    for (let i = this.steams.length - 1; i >= 0; i--) {
      const c = this.steams[i];
      c.life -= dt;
      if (c.life <= 0) { this.steams.splice(i, 1); continue; }
      if (Math.random() < dt * 8) G.particles.burst(c.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * c.r * 1.5, 1 + Math.random() * 2, (Math.random() - 0.5) * c.r * 1.5)), { count: 1, color: 0xf2f2f2, speed: 0.5, up: 1, life: 2, size: 2, gravity: -0.3, alpha: 0.4, grow: 1.5 });
    }
    this._updateMask(dt);
    // Globs
    for (let i = this.globs.length - 1; i >= 0; i--) {
      const g = this.globs[i];
      g.life -= dt;
      g.vel.y -= GRAVITY * dt;
      const step = g.vel.clone().multiplyScalar(dt);
      const len = step.length();
      const dir = step.clone().divideScalar(len || 1);
      let hit = null;
      // Enemies first
      if (!g.cosmetic && G.enemies) {
        const e = G.enemies.rayHit(g.pos, dir, len + 0.3);
        if (e) hit = { enemy: e };
      }
      if (!hit) {
        const r = G.collision.raycast(g.pos, dir, len + 0.05, { water: true, ignoreTag: 'glass' });
        if (r) hit = r;
      }
      // Paint-reactive objects (switches, seeds) along the path
      if (!hit && !g.cosmetic && G.world) {
        for (const r of G.world.reactives) {
          if (!r.active || !r.hitbox) continue;
          if (r.pos.distanceTo(g.pos) < r.hitbox) { hit = { reactive: r }; break; }
        }
      }
      g.pos.add(step);
      g.mesh.position.copy(g.pos);
      if (Math.random() < 0.6) G.particles.burst(g.pos, { count: 1, color: COLORS[g.color].hex, speed: 0.4, life: 0.35, size: g.small ? 0.25 : 0.4, gravity: 2 });
      if (hit || g.life <= 0) {
        this.scene.remove(g.mesh);
        this.globs.splice(i, 1);
        if (!hit) continue;
        this._globImpact(g, hit);
      }
    }
    // Splats
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i];
      s.life -= dt;
      const age = s.max - s.life;
      if (s.element === 'fire' && s.life > 0 && !s.vertical) {
        if (Math.random() < dt * 30) G.particles.flames(s.pos, s.radius * 0.7, 1, 1);
        // Shimmering motes rising in the heat show where the updraft is
        if (!s.onWater && Math.random() < dt * 6) G.particles.burst(s.pos.clone().setY(s.pos.y + 1 + Math.random() * 3), { count: 1, color: 0xffd0a0, speed: 0.3, up: 6, life: 1.6, size: 0.25, pool: 'glow', gravity: -2, alpha: 0.6 });
      }
      if (s.vines) {
        const g = Math.min(1, age * 2.5);
        s.vines.children.forEach((c) => {
          if (c.userData.grow) c.scale.y = Math.max(0.01, g);
          if (c.userData.at !== undefined && s.growY) c.visible = c.userData.at < s.growY.bottom + (s.growY.top - s.growY.bottom) * g;
        });
      }
      if (s.pad) {
        const sq = s.squash || 0;
        s.pad.scale.set(1 + sq * 0.3, 1 - sq * 0.6 + Math.sin(G.time * 5) * 0.05, 1 + sq * 0.3);
        s.squash = Math.max(0, sq - dt * 3);
      }
      if (s.life < 1.5) {
        const f = Math.max(0, s.life / 1.5);
        for (const o of s.objs) o.traverse((m) => {
          if (m.material && !m.userData.fadeMat) { m.material = m.material.clone(); m.material.transparent = true; m.userData.fadeMat = true; }
          if (m.material) m.material.opacity = f;
        });
        if (s.climb && s.life < 0.5) s.climb.active = false;
      }
      if (s.life <= 0) {
        this._remove(s);
        this.splats.splice(i, 1);
      }
    }
  }

  _globImpact(g, hit) {
    const el = COLORS[g.color].element;
    if (g.cosmetic) {
      G.particles.burst(g.pos, { count: 10, color: COLORS[g.color].hex, speed: 4, life: 0.5, size: 0.35, gravity: 10 });
      return;
    }
    if (hit.enemy) {
      G.enemies.localHit(hit.enemy, { dmg: Math.round((g.small ? 3 : 7) * brushStats(G.player.upg).damage), element: el, dir: g.vel.clone().setY(0).normalize(), source: 'glob', hy: g.pos.y });
      G.particles.burst(g.pos, { count: 14, color: COLORS[g.color].hex, speed: 5, life: 0.5, size: 0.45, gravity: 10 });
      // Leave a splat under the enemy too
      const gp = hit.enemy.pos.clone();
      const gh = G.collision.groundAt(gp.x, gp.z, 0.3, gp.y + 1);
      if (gh.y > -Infinity && !g.small) this.paintAt(new THREE.Vector3(gp.x, gh.y, gp.z), UP, g.color, gh.obj ? 'box' : 'terrain', { radius: 1.3 });
      return;
    }
    if (hit.reactive) {
      hit.reactive.onPaint(el, g.pos.clone(), null);
      G.particles.burst(g.pos, { count: 14, color: COLORS[g.color].hex, speed: 5, life: 0.5, size: 0.4 });
      return;
    }
    const opts = { radius: g.small ? 1.0 : 1.7 };
    if (hit.kind === 'box' && hit.obj) {
      opts.wallTop = hit.obj.max.y;
      opts.wallBottom = hit.obj.min.y;
      if (hit.obj.tags.has('smooth')) opts.noClimb = true; // polished trial walls reject vines
    }
    if (hit.kind === 'cyl' && Math.abs(hit.normal.y) < 0.5) hit.kind = 'box';
    this.paintAt(hit.point, hit.normal, g.color, hit.kind, opts);
  }

  // Local paint action: create + broadcast
  paintAt(point, normal, colorIdx, kind, opts = {}) {
    const s = this.createSplat(point, normal, colorIdx, kind, opts);
    if (G.net) G.net.send({ t: 'paint', p: [point.x, point.y, point.z].map((v) => +v.toFixed(2)), n: [normal.x, normal.y, normal.z].map((v) => +v.toFixed(2)), c: colorIdx, k: kind, o: { radius: opts.radius, wallTop: opts.wallTop, wallBottom: opts.wallBottom, loud: opts.loud, noClimb: opts.noClimb, hostile: opts.hostile } });
    return s;
  }

  onNetPaint(m) {
    this.createSplat(new THREE.Vector3(...m.p), new THREE.Vector3(...m.n), m.c, m.k, { ...(m.o || {}), net: true });
  }
}

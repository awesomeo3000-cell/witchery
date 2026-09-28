// Overworld population: foliage, village, ruins, trial shrines, waypoints, sky citadel.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { mulberry32, smoothstep } from '../core/math.js';
import { VILLAGE, TRIALS, CITADEL, WAYPOINTS, RUINS, FLAT_SPOTS, VOLCANO, WORLD_SIZE } from './layout.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, treeGeometries, rockGeometry, mergeColored, T, jitter } from './props.js';
import { islandGeometry, makeWaterfall, makeWaterfallMaterial } from './islands.js';
import { makeCharacter } from '../player/character.js';

const CHUNK = 400;

export class World {
  constructor(scene, terrain, collision) {
    this.scene = scene;
    this.terrain = terrain;
    this.col = collision;
    this.interactables = [];
    this.reactives = [];
    this.updrafts = [];
    this.animated = [];
    this.inkFlowers = [];
    this.lavaZones = [];
    this.islets = [];
    this.root = new THREE.Group();
    scene.add(this.root);

    this._foliage();
    this._village();
    this._ruins();
    this._shrines();
    this._waypoints();
    this._citadel();
    this._inkFlowers();
    this._volcano();
    this._updrafts();
    this._mergeStatic();
  }

  // Collapse every non-moving prop into one mesh per material to keep draw calls low.
  _mergeStatic() {
    this.root.updateMatrixWorld(true);
    const groups = new Map();
    const victims = [];
    const visit = (obj) => {
      if (obj.userData.dynamic) return;
      if (obj.isMesh && !obj.isInstancedMesh && !Array.isArray(obj.material)) {
        const mat = obj.material;
        let g = groups.get(mat);
        if (!g) groups.set(mat, (g = { geos: [], cast: false }));
        let geo = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
        if (geo.index) geo = geo.toNonIndexed();
        for (const k of Object.keys(geo.attributes)) {
          if (k !== 'position' && k !== 'normal' && !(k === 'color' && mat.vertexColors)) geo.deleteAttribute(k);
        }
        if (!geo.attributes.normal) geo.computeVertexNormals();
        g.geos.push(geo);
        g.cast ||= obj.castShadow;
        victims.push(obj);
      }
      for (const c of obj.children) visit(c);
    };
    for (const c of this.root.children) visit(c);
    for (const v of victims) v.parent.remove(v);
    for (const [mat, g] of groups) {
      const merged = mergeGeometries(g.geos, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = g.cast;
      m.receiveShadow = true;
      this.root.add(m);
      g.geos.forEach((q) => q.dispose());
    }
  }

  h(x, z) { return this.terrain.heightAt(x, z); }

  nearFlat(x, z, pad = 0) {
    for (const s of FLAT_SPOTS) if (Math.hypot(x - s.x, z - s.z) < s.r + pad) return true;
    return false;
  }

  _foliage() {
    const rand = mulberry32(42);
    const geos = treeGeometries();
    const buckets = new Map();
    const push = (type, x, y, z, s, rot, tint) => {
      const k = `${type}|${Math.floor(x / CHUNK)}|${Math.floor(z / CHUNK)}`;
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = { type, items: [] }));
      b.items.push([x, y, z, s, rot, tint]);
    };
    const spacing = 6.5;
    const half = WORLD_SIZE / 2 - 20;
    const nrm = new THREE.Vector3();
    for (let z = -half; z < half; z += spacing) {
      for (let x = -half; x < half; x += spacing) {
        const px = x + (rand() - 0.5) * spacing * 0.9;
        const pz = z + (rand() - 0.5) * spacing * 0.9;
        const hgt = this.h(px, pz);
        if (hgt < 2.5) continue;
        this.terrain.normalAt(px, pz, nrm);
        if (nrm.y < 0.8) continue;
        if (this.nearFlat(px, pz, 4)) continue;
        const w = this.terrain.biome(px, pz);
        const cluster = (this.terrain.noise3(px * 0.012, pz * 0.012) + 1) * 0.5;
        let p = w.meadow * 0.035 * smoothstep(0.45, 0.8, cluster) + w.bloom * 0.3 * (0.4 + cluster)
          + w.frost * 0.08 * (hgt < 70 ? 1 : 0.1) + w.spring * 0.03 + w.ember * 0.035;
        const r = rand();
        const s = 0.8 + rand() * 0.7;
        const rot = rand() * Math.PI * 2;
        if (r < p) {
          let type;
          const dom = Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
          if (dom === 'frost') type = hgt > 22 ? 'snowPine' : 'pine';
          else if (dom === 'ember') type = 'dead';
          else if (dom === 'spring') type = 'acacia';
          else if (dom === 'bloom') type = rand() < 0.35 ? 'pine' : rand() < 0.5 ? 'tall' : 'round';
          else type = rand() < 0.25 ? 'tall' : 'round';
          push(type, px, hgt - 0.2, pz, s, rot, 0.85 + rand() * 0.3);
          this.col.addCylinder(px, pz, 0.45 * s, hgt - 1, hgt + 4 * s, { tags: ['tree'] });
        } else if (r < p + 0.02 + w.bloom * 0.05 + w.meadow * 0.012) {
          push('bush', px, hgt - 0.1, pz, s, rot, 0.85 + rand() * 0.3);
        } else if (r < p + 0.03 + w.ember * 0.06 + w.frost * 0.03 + w.spring * 0.02) {
          push('rock', px, hgt - 0.3, pz, s * (0.6 + rand() * 1.6), rot, 0.9 + rand() * 0.2);
        }
      }
    }
    const rockGeo = rockGeometry(3);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8f8a82, flatShading: true });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (const b of buckets.values()) {
      const isRock = b.type === 'rock';
      const geo = isRock ? rockGeo : geos[b.type];
      const mesh = new THREE.InstancedMesh(geo, isRock ? rockMat : MAT.foliage, b.items.length);
      b.items.forEach(([x, y, z, s, rot, tint], i) => {
        q.setFromAxisAngle(up, rot);
        if (isRock) {
          sc.set(s * 1.3, s * 0.8, s);
          const w = this.terrain.biome(x, z);
          col.set(w.ember > 0.4 ? 0x3a3234 : w.spring > 0.4 ? 0xc0804a : w.frost > 0.4 ? 0xa0a8b8 : 0x8f8a82).multiplyScalar(tint);
          if (s > 1.2) this.col.addCylinder(x, z, s * 1.0, y - 1, y + s * 0.7, { tags: ['rock'] });
        } else {
          sc.set(s, s, s);
          col.setRGB(tint, tint, tint);
        }
        ps.set(x, y, z);
        m4.compose(ps, q, sc);
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, col);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.root.add(mesh);
    }
  }

  _cottage(x, z, rot, roofMat) {
    const y = this.h(x, z);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 4.5, 6), MAT.plaster);
    body.position.y = 2.25;
    const beams = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.4, 6.2), MAT.woodDark);
    beams.position.y = 4.4;
    // Triangular prism along X with the apex pointing up
    const roofGeo = new THREE.CylinderGeometry(4.6, 4.6, 7.6, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    roofGeo.scale(1, 0.75, 1);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 4.5 + 4.6 * 0.5 * 0.75;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), MAT.woodDark);
    door.position.set(0, 1.2, 3.02);
    const winMat = new THREE.MeshLambertMaterial({ color: 0x3a4a6a, emissive: 0xffc070, emissiveIntensity: 0 });
    this.animated.push(() => { winMat.emissiveIntensity = (G.sky ? G.sky.night : 0) * 1.1; });
    for (const wx of [-2.2, 2.2]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.15), winMat);
      w.position.set(wx, 2.6, 3.02);
      g.add(w);
    }
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.5, 0.9), MAT.stoneDark);
    chim.position.set(2, 7, -1);
    g.add(body, beams, roof, door, chim);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.position.set(x, y, z);
    g.rotation.y = rot;
    this.root.add(g);
    const swap = Math.abs(Math.sin(rot)) > 0.5;
    this.col.addBox(x, y + 3.2, z, swap ? 6 : 7, 6.4, swap ? 7 : 6);
  }

  _village() {
    const { x: vx, z: vz } = VILLAGE;
    const vy = this.h(vx, vz);
    const roofs = [MAT.roofRed, MAT.roofBlue, MAT.roofRed, MAT.roofBlue, MAT.roofRed, MAT.roofBlue];
    const spots = [[-30, -18, 0.5], [28, -22, -0.5], [-38, 16, Math.PI / 2], [36, 18, -Math.PI / 2], [-12, 40, Math.PI], [16, 42, Math.PI]];
    spots.forEach(([dx, dz, r], i) => this._cottage(vx + dx, vz + dz, Math.round(r / (Math.PI / 2)) * (Math.PI / 2), roofs[i]));

    // Plaza
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(16, 16.5, 0.5, 24), MAT.stone);
    plaza.position.set(vx, vy - 0.15, vz);
    plaza.receiveShadow = true;
    this.root.add(plaza);

    // Painter statue holding a giant brush
    const statue = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 2, 8), MAT.stoneDark);
    ped.position.y = 1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 4, 8), MAT.stone);
    body.position.y = 4;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), MAT.stone);
    head.position.y = 6.8;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 8), MAT.stone);
    hood.position.y = 7.6;
    const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), MAT.wood);
    brush.position.set(1.4, 5.5, 0);
    brush.rotation.z = -0.35;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 }));
    tip.position.set(2.7, 9.2, 0);
    tip.rotation.z = -0.35;
    this.statueTip = tip;
    statue.add(ped, body, head, hood, brush, tip);
    statue.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    statue.position.set(vx, vy, vz);
    this.root.add(statue);
    this.col.addCylinder(vx, vz, 3, vy - 1, vy + 2);
    this.col.addCylinder(vx, vz, 1.2, vy + 2, vy + 7.5);
    this.animated.push((t) => {
      const done = TRIALS.filter((tr) => G.flags[`trial_${tr.key}`]).length;
      const c = COLORS[Math.floor(t * 0.5) % 4];
      tip.material.emissive.setHex(done >= 4 ? c.hex : 0xffffff);
      tip.material.color.setHex(done >= 4 ? c.hex : 0xdddddd);
    });

    // Market stalls with the four colours
    COLORS.forEach((c, i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const sx = vx + Math.cos(a) * 21, sz = vz + Math.sin(a) * 21;
      const sy = this.h(sx, sz);
      const g = new THREE.Group();
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.4), MAT.wood);
      counter.position.y = 0.5;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 2.2), new THREE.MeshLambertMaterial({ color: c.hex }));
      cloth.position.set(0, 2.6, 0.2);
      cloth.rotation.x = 0.2;
      for (const px of [-1.5, 1.5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5), MAT.woodDark);
        post.position.set(px, 1.3, 0.9);
        g.add(post);
      }
      for (let k = 0; k < 3; k++) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.45, 8), new THREE.MeshLambertMaterial({ color: c.hex, emissive: c.hex, emissiveIntensity: 0.25 }));
        pot.position.set(-0.9 + k * 0.9, 1.22, 0);
        g.add(pot);
      }
      g.add(counter, cloth);
      g.position.set(sx, sy, sz);
      g.lookAt(vx, sy, vz);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      this.root.add(g);
      this.col.addBox(sx, sy + 0.5, sz, 2.2, 1, 2.2);
    });

    // Lanterns
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const lx = vx + Math.cos(a) * 30, lz = vz + Math.sin(a) * 30;
      const ly = this.h(lx, lz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 5), MAT.woodDark);
      post.position.set(lx, ly + 1.6, lz);
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshLambertMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 0.4 }));
      lamp.position.set(lx, ly + 3.4, lz);
      this.animated.push(() => { lamp.material.emissiveIntensity = 0.3 + (G.sky ? G.sky.night : 0) * 1.5; });
      this.root.add(post, lamp);
      this.col.addCylinder(lx, lz, 0.2, ly, ly + 3.4);
    }

    // Village elder with hints
    const elder = makeCharacter({ hood: 0x7a5aa8, scarf: 0xf2c229, skin: 0xe8c4a0 });
    const ex = vx + 6, ez = vz + 8;
    elder.group.position.set(ex, this.h(ex, ez), ez);
    elder.group.rotation.y = Math.PI * 0.8;
    elder.brush.visible = false;
    elder.group.userData.dynamic = true;
    this.root.add(elder.group);
    this.elder = elder;
    this.animated.push((t, dt) => elder.animate({ state: 'idle', speed: 0 }, dt));
    this.col.addCylinder(ex, ez, 0.5, this.h(ex, ez), this.h(ex, ez) + 1.8);
    let hintIdx = 0;
    this.interactables.push({
      pos: new THREE.Vector3(ex, this.h(ex, ez) + 1, ez), radius: 3.2, prompt: 'Talk to Elder Umber',
      action: () => {
        const done = TRIALS.filter((tr) => G.flags[`trial_${tr.key}`]).length;
        const lines = done >= 4 ? [
          'All four Prism Shards shine! The barrier around the Sky Citadel has fallen.',
          'Ride your brush (R) up to the citadel and paint the Hueless King back into colour!',
          'Its shield changes colour: strike it with the OPPOSITE colour — Ember melts Frost, Frost douses Ember, Bloom tangles Spring, Spring shakes off Bloom.',
        ] : [
          'The Hueless King drained the colour from the sky. Only the four Prism Trials can break its barrier.',
          'Follow the coloured beams. Ember in the east, Frost in the north, Spring in the south, Bloom in the west.',
          'Tap Left Mouse while aiming (Right Mouse) to flick paint. Hold it to paint a stroke.',
          'Red burns brambles and lights braziers. Blue freezes water into floes. Yellow makes bounce pads. Green grows vines you can climb.',
          'Press R to ride your brush through the skies. Mind your stamina!',
          `You have ${done} of 4 Prism Shards.`,
        ];
        G.hud.dialog('Elder Umber', lines[hintIdx % lines.length]);
        hintIdx++;
      },
    });

    // Fences around village edge
    const fenceGeo = mergeColored([
      [T(new THREE.BoxGeometry(0.15, 1.2, 0.15), -1.5, 0.6, 0), 0x6b4a2e],
      [T(new THREE.BoxGeometry(0.15, 1.2, 0.15), 1.5, 0.6, 0), 0x6b4a2e],
      [T(new THREE.BoxGeometry(3.2, 0.12, 0.08), 0, 0.9, 0), 0x8a5a36],
      [T(new THREE.BoxGeometry(3.2, 0.12, 0.08), 0, 0.5, 0), 0x8a5a36],
    ]);
    const fences = [];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      if (Math.abs(Math.sin(a * 2)) < 0.12) continue; // gaps for paths
      fences.push([vx + Math.cos(a) * 62, vz + Math.sin(a) * 62, -a]);
    }
    const fm = new THREE.InstancedMesh(fenceGeo, MAT.vertex, fences.length);
    const m4 = new THREE.Matrix4();
    fences.forEach(([fx, fz, r], i) => {
      m4.makeRotationY(r + Math.PI / 2);
      m4.setPosition(fx, this.h(fx, fz), fz);
      fm.setMatrixAt(i, m4);
    });
    fm.castShadow = true;
    this.root.add(fm);
  }

  _arch(x, z, rot, scale = 1) {
    const y = this.h(x, z);
    const g = new THREE.Group();
    const w = 4 * scale, hgt = 6 * scale;
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(jitter(new THREE.BoxGeometry(1.4 * scale, hgt, 1.4 * scale, 1, 3, 1), 0.2 * scale, 7), MAT.stone);
      p.position.set(s * w, hgt / 2, 0);
      g.add(p);
    }
    const top = new THREE.Mesh(new THREE.TorusGeometry(w, 0.75 * scale, 5, 10, Math.PI), MAT.stone);
    top.position.y = hgt;
    g.add(top);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.position.set(x, y - 0.3, z);
    g.rotation.y = rot;
    this.root.add(g);
    for (const s of [-1, 1]) {
      const px = x + Math.cos(rot) * s * w, pz = z - Math.sin(rot) * s * w;
      this.col.addBox(px, y + hgt / 2, pz, 1.4 * scale, hgt, 1.4 * scale);
    }
  }

  _cairn(x, z, rand) {
    const y = this.h(x, z);
    let cy = y;
    const g = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const s = 1.3 - i * 0.12 + rand() * 0.3;
      const m = new THREE.Mesh(jitter(new THREE.CylinderGeometry(s, s * 1.1, s * 0.9, 7), 0.25, i + 3), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x8a5a4a : 0x6a4f6a, flatShading: true }));
      m.position.set((rand() - 0.5) * 0.3, cy - y + s * 0.45, (rand() - 0.5) * 0.3);
      m.rotation.y = rand() * 3;
      m.castShadow = true;
      g.add(m);
      cy += s * 0.85;
    }
    g.position.set(x, y, z);
    this.root.add(g);
    this.col.addCylinder(x, z, 1.3, y, cy);
  }

  _ruins() {
    const rand = mulberry32(8);
    for (const r of RUINS) {
      this._arch(r.x + (rand() - 0.5) * 8, r.z + (rand() - 0.5) * 8, rand() * Math.PI, 0.9 + rand() * 0.4);
      for (let i = 0; i < 4; i++) {
        const a = rand() * Math.PI * 2, d = 8 + rand() * 9;
        const px = r.x + Math.cos(a) * d, pz = r.z + Math.sin(a) * d;
        const py = this.h(px, pz);
        const hgt = 1.5 + rand() * 4;
        const p = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.8, 0.9, hgt, 7, 2), 0.15, i), rand() < 0.5 ? MAT.stone : MAT.stoneMoss);
        p.position.set(px, py + hgt / 2 - 0.2, pz);
        p.rotation.z = (rand() - 0.5) * 0.2;
        p.castShadow = true;
        this.root.add(p);
        this.col.addCylinder(px, pz, 0.85, py - 1, py + hgt);
      }
      if (rand() < 0.7) this._cairn(r.x + 12 * (rand() - 0.5), r.z + 12 * (rand() - 0.5), rand);
    }
    // Scattered cairns in the wild
    for (let i = 0; i < 24; i++) {
      const a = rand() * Math.PI * 2, d = 60 + rand() * 500;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.h(x, z) < 3 || this.nearFlat(x, z, 6)) continue;
      this._cairn(x, z, rand);
    }
  }

  _shrines() {
    this.shrines = [];
    for (const t of TRIALS) {
      const c = COLORS[t.color];
      const y = this.h(t.x, t.z);
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 1.2, 12), MAT.stone);
      base.position.y = 0.3;
      base.receiveShadow = true;
      g.add(base);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1.25, 12), new THREE.MeshLambertMaterial({ color: 0x1a1a24 }));
      inner.position.y = 0.32;
      g.add(inner);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const hgt = i % 2 ? 7 : 5;
        const p = new THREE.Mesh(jitter(new THREE.BoxGeometry(1.4, hgt, 1.4, 1, 3, 1), 0.15, i + 1), MAT.stone);
        p.position.set(Math.cos(a) * 9, hgt / 2 + 0.8, Math.sin(a) * 9);
        p.castShadow = true;
        g.add(p);
        const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshLambertMaterial({ color: c.hex, emissive: c.hex, emissiveIntensity: 0.6 }));
        cap.position.set(Math.cos(a) * 9, hgt + 1.4, Math.sin(a) * 9);
        g.add(cap);
        this.col.addBox(t.x + Math.cos(a) * 9, y + hgt / 2 + 0.8, t.z + Math.sin(a) * 9, 1.4, hgt, 1.4);
      }
      const prism = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), new THREE.MeshLambertMaterial({ color: c.hex, emissive: c.hex, emissiveIntensity: 0.7, flatShading: true }));
      prism.scale.y = 1.6;
      prism.position.y = 5;
      prism.userData.dynamic = true;
      g.add(prism);
      const beamMat = new THREE.MeshBasicMaterial({ color: c.hex, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 500, 8, 1, true), beamMat);
      beam.position.y = 255;
      g.add(beam);
      g.position.set(t.x, y, t.z);
      this.root.add(g);
      this.col.addCylinder(t.x, t.z, 11.5, y - 2, y + 0.9, { tags: ['shrine'] });
      const shrine = { trial: t, prism, beam, beamMat };
      this.shrines.push(shrine);
      this.animated.push((time) => {
        prism.rotation.y = time * 0.8;
        prism.position.y = 5 + Math.sin(time * 1.5) * 0.4;
        const done = !!G.flags[`trial_${t.key}`];
        beamMat.opacity = done ? 0.12 : 0.35 + Math.sin(time * 2) * 0.1;
        prism.material.emissiveIntensity = done ? 1.4 : 0.7;
      });
      this.interactables.push({
        pos: new THREE.Vector3(t.x, y + 1.2, t.z), radius: 5,
        prompt: () => (G.flags[`trial_${t.key}`] ? `Revisit the ${t.name} (complete)` : `Enter the ${t.name}`),
        action: () => G.trials.enter(t.key),
      });
    }
  }

  _waypoints() {
    this.waypoints = [];
    for (const w of WAYPOINTS) {
      const y = this.h(w.x, w.z);
      const g = new THREE.Group();
      const legGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.2, 5);
      const legs = [[-0.6, 0.15, 0.25], [0.6, 0.15, -0.25], [0, -0.9, 0]];
      legs.forEach(([lx, lz, r]) => {
        const l = new THREE.Mesh(legGeo, MAT.wood);
        l.position.set(lx, 1.5, lz);
        l.rotation.z = r;
        l.rotation.x = lz < 0 ? -0.35 : 0.1;
        g.add(l);
      });
      const canvasMat = new THREE.MeshLambertMaterial({ color: 0xf4eee0, emissive: 0x000000 });
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 0.08), canvasMat);
      canvas.position.set(0, 2.2, 0.28);
      canvas.rotation.x = -0.12;
      g.add(canvas);
      const stripes = [];
      COLORS.forEach((c, i) => {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.02), new THREE.MeshBasicMaterial({ color: c.hex }));
        s.position.set(-0.6 + i * 0.4, 2.2, 0.34);
        s.rotation.x = -0.12;
        s.visible = false;
        s.userData.dynamic = true;
        stripes.push(s);
        g.add(s);
      });
      g.position.set(w.x, y, w.z);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      this.root.add(g);
      this.col.addCylinder(w.x, w.z, 0.6, y, y + 3);
      const wp = { ...w, y, stripes, canvasMat };
      this.waypoints.push(wp);
      this.animated.push((t) => {
        const on = !!G.flags[`wp_${w.key}`];
        stripes.forEach((s) => (s.visible = on));
        canvasMat.emissive.setHex(on ? 0x332a10 : 0);
      });
    }
  }

  _citadel() {
    const { x, y, z, r } = CITADEL;
    const g = new THREE.Group();
    this.waterfallMat = makeWaterfallMaterial();
    this.animated.push((t) => { this.waterfallMat.uniforms.uTime.value = t; });
    const body = new THREE.Mesh(islandGeometry(r + 4, 120, 77, { layers: 9, trees: 0, grass: 0x8aa86a, grass2: 0x7a9a5e }), MAT.vertex);
    body.receiveShadow = true;
    body.castShadow = true;
    g.add(body);
    for (const [a, w] of [[0.6, 7], [2.9, 5], [4.4, 9]]) {
      const wf = makeWaterfall(this.waterfallMat, w, 150);
      wf.position.set(Math.cos(a) * (r + 1), -1, Math.sin(a) * (r + 1));
      wf.rotation.y = -a + Math.PI / 2;
      g.add(wf);
    }
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 0.3, 32), new THREE.MeshLambertMaterial({ color: 0x9a94a8 }));
    arena.position.y = 0.55;
    arena.receiveShadow = true;
    g.add(arena);
    // Ring of towers
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const hgt = 16 + (i % 3) * 7;
      const tx = Math.cos(a) * (r - 10), tz = Math.sin(a) * (r - 10);
      const tower = new THREE.Mesh(jitter(new THREE.CylinderGeometry(3.5, 4.2, hgt, 8, 3), 0.4, i), new THREE.MeshLambertMaterial({ color: 0x5a566a, flatShading: true }));
      tower.position.set(tx, hgt / 2, tz);
      tower.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 6, 8), new THREE.MeshLambertMaterial({ color: 0x3b3550, flatShading: true }));
      roof.position.set(tx, hgt + 3, tz);
      g.add(tower, roof);
      this.col.addCylinder(x + tx, z + tz, 4, y, y + hgt);
    }
    // Hanging broken chunks + trees
    const rand = mulberry32(77);
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2, d = 40 + rand() * 20;
      const tree = new THREE.Mesh(treeGeometries().dead, MAT.vertex);
      tree.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      tree.scale.setScalar(1 + rand());
      g.add(tree);
    }
    g.position.set(x, y, z);
    this.root.add(g);
    this.col.addCylinder(x, z, r - 1, y - 40, y + 0.5, { tags: ['citadel'] });

    // Barrier dome
    const domeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uTime, uAlpha; varying vec3 vN; varying vec3 vP;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0,0.0,1.0); }
        void main(){ float f = pow(1.0-abs(vN.z), 3.0);
          float hex = abs(sin(vP.x*0.25+uTime)*sin(vP.y*0.25-uTime*0.7)*sin(vP.z*0.25));
          vec3 c = hue(fract(vP.y*0.004 + uTime*0.05)) * (0.04 + f*0.55 + step(0.94, hex)*0.12);
          gl_FragColor = vec4(c*0.55*uAlpha, 1.0); }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(95, 40, 24), domeMat);
    dome.userData.dynamic = true;
    dome.position.set(x, y - 10, z);
    this.root.add(dome);
    this.barrier = { center: dome.position.clone(), radius: 95, mesh: dome };
    this.animated.push((t, dt) => {
      domeMat.uniforms.uTime.value = t;
      const open = TRIALS.every((tr) => G.flags[`trial_${tr.key}`]);
      const target = open ? 0 : 1;
      domeMat.uniforms.uAlpha.value += (target - domeMat.uniforms.uAlpha.value) * Math.min(1, dt * 0.8);
      dome.visible = domeMat.uniforms.uAlpha.value > 0.01;
      this.barrier.active = !open;
    });

    // Floating islets around the citadel and scattered over the island (all landable)
    const spots = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand() * 0.3;
      const d = 130 + rand() * 130;
      spots.push([x + Math.cos(a) * d, 85 + rand() * 130, z + Math.sin(a) * d, 9 + rand() * 16]);
    }
    for (const [sx, sz] of [[-200, 200], [250, 150], [-300, -120], [150, -320], [420, -260], [-450, 320], [60, 330]]) {
      spots.push([sx, G.terrain.heightAt(sx, sz) + 70 + rand() * 60, sz, 8 + rand() * 12]);
    }
    spots.forEach(([ix, iy, iz, ir], i) => {
      const depth = ir * (1.4 + rand() * 1.2);
      const isl = new THREE.Group();
      const m = new THREE.Mesh(islandGeometry(ir, depth, 200 + i), MAT.vertex);
      m.castShadow = true;
      m.receiveShadow = true;
      isl.add(m);
      if (rand() < 0.45) {
        const a = rand() * Math.PI * 2;
        const wf = makeWaterfall(this.waterfallMat, 2 + ir * 0.2, 60 + depth);
        wf.position.set(Math.cos(a) * ir * 0.85, -0.5, Math.sin(a) * ir * 0.85);
        wf.rotation.y = -a + Math.PI / 2;
        isl.add(wf);
      }
      if (rand() < 0.3) {
        // Ruined arch on top, like the old sky shrines
        const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.4, 5, 10, Math.PI), MAT.stone);
        arch.position.set(ir * 0.3, 4.2, 0);
        arch.rotation.y = rand() * 3;
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), MAT.stone);
        l.position.set(ir * 0.3 - 2.4 * Math.cos(arch.rotation.y), 2.1, 2.4 * Math.sin(arch.rotation.y));
        const r2 = l.clone();
        r2.position.set(ir * 0.3 + 2.4 * Math.cos(arch.rotation.y), 2.1, -2.4 * Math.sin(arch.rotation.y));
        isl.add(arch, l, r2);
      }
      isl.position.set(ix, iy, iz);
      this.root.add(isl);
      this.col.addCylinder(ix, iz, ir * 0.85, iy - depth * 0.3, iy + 0.4, { tags: ['islet'] });
      this.islets.push({ x: ix, y: iy + 0.4, z: iz, r: ir });
    });
  }

  _inkFlowers() {
    const rand = mulberry32(21);
    const spots = [];
    for (let tries = 0; tries < 2000 && spots.length < 90; tries++) {
      let x, z;
      if (spots.length < 20) {
        // Near each trial shrine and the village
        const anchors = [VILLAGE, ...TRIALS];
        const a = anchors[spots.length % anchors.length];
        const ang = rand() * Math.PI * 2, d = 18 + rand() * 25;
        x = a.x + Math.cos(ang) * d; z = a.z + Math.sin(ang) * d;
      } else {
        const ang = rand() * Math.PI * 2, d = 30 + rand() * 560;
        x = Math.cos(ang) * d; z = Math.sin(ang) * d;
      }
      const y = this.h(x, z);
      if (y < 2 || y > 120) continue;
      spots.push([x, y, z, spots.length % 4]);
    }
    // One instanced mesh per colour: stems + leaves + glowing bulbs merged into a single geometry
    const meshes = COLORS.map((c) => {
      const parts = [[T(new THREE.IcosahedronGeometry(0.6, 0), 0, 0.2, 0, 1, 0.4, 1), 0x3f7a35]];
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * 0.35, oz = (k % 2) * 0.3;
        parts.push([T(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 4), ox, 0.55, oz), 0x5f8a45]);
        parts.push([T(new THREE.IcosahedronGeometry(0.32, 0), ox, 1.15 + k * 0.08, oz), c.hex]);
      }
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: c.hex, emissiveIntensity: 0.18 });
      const m = new THREE.InstancedMesh(mergeColored(parts), mat, spots.filter((s) => s[3] === COLORS.indexOf(c)).length);
      this.root.add(m);
      return m;
    });
    const counts = [0, 0, 0, 0];
    const m4 = new THREE.Matrix4();
    for (const [x, y, z, ci] of spots) {
      const idx = counts[ci]++;
      m4.makeTranslation(x, y, z);
      meshes[ci].setMatrixAt(idx, m4);
      this.inkFlowers.push({ pos: new THREE.Vector3(x, y + 0.8, z), base: new THREE.Vector3(x, y, z), color: ci, mesh: meshes[ci], idx, regrow: 0, scale: 1 });
    }
    meshes.forEach((m) => m.computeBoundingSphere());
    this.animated.push((t, dt) => {
      const dirty = new Set();
      for (const f of this.inkFlowers) {
        let sc = 1;
        if (f.regrow > 0) {
          f.regrow -= dt;
          sc = Math.max(0.2, 1 - f.regrow / 45);
        }
        if (Math.abs(sc - f.scale) > 0.01) {
          f.scale = sc;
          m4.makeScale(sc, sc, sc).setPosition(f.base);
          f.mesh.setMatrixAt(f.idx, m4);
          dirty.add(f.mesh);
        }
      }
      for (const m of dirty) m.instanceMatrix.needsUpdate = true;
    });
  }

  _volcano() {
    const cy = this.h(VOLCANO.x, VOLCANO.z);
    const lavaY = cy + 3;
    const lava = new THREE.Mesh(new THREE.CircleGeometry(40, 24), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(VOLCANO.x, lavaY, VOLCANO.z);
    this.root.add(lava);
    this.lavaZones.push({ x: VOLCANO.x, z: VOLCANO.z, r: 38, y: lavaY });
    this.animated.push((t) => lava.material.color.setHSL(0.04 + Math.sin(t) * 0.01, 1, 0.5 + Math.sin(t * 2) * 0.05));
  }

  _updrafts() {
    const spots = [
      [40, 40], [-60, -60], [200, -200], [-200, 150], [80, -300], [-300, -250], [300, 100], [0, -60],
    ];
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    for (const [x, z] of spots) {
      const y = Math.max(0, this.h(x, z));
      const hgt = x === 0 && z === -60 ? 190 : 90;
      const g = new THREE.Group();
      g.userData.dynamic = true;
      for (let i = 0; i < 3; i++) {
        const spiral = new THREE.Mesh(new THREE.TorusGeometry(3 + i, 0.08, 4, 24), mat);
        spiral.rotation.x = Math.PI / 2;
        spiral.userData.off = i / 3;
        g.add(spiral);
      }
      g.position.set(x, y, z);
      this.root.add(g);
      const u = { x, z, r: 6, y0: y, y1: y + hgt, group: g };
      this.updrafts.push(u);
      this.animated.push((t) => {
        g.children.forEach((s) => {
          const f = (t * 0.25 + s.userData.off) % 1;
          s.position.y = f * Math.min(hgt, 40);
          s.material.opacity = 0.18 * Math.sin(f * Math.PI);
          s.rotation.z = t * 2;
        });
      });
    }
  }

  update(dt, t) {
    for (const f of this.animated) f(t, dt);
  }
}

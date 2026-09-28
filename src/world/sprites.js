// Paint Sprites: shy little colour spirits hidden around the island behind small challenges.
// Finding them is shared progress (flags "sprite_<id>"); Pip trades them for heart & stamina upgrades.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';
import { FLAT_SPOTS, VILLAGE } from './layout.js';
import { jitter } from './props.js';
import { makeCharacter } from '../player/character.js';
import { spriteCount, upgradeCount } from '../core/progress.js';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const ELEMENTS = ['fire', 'ice', 'bounce', 'vine'];
export const SPRITES_PER_UPGRADE = 4;

export class Sprites {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.pops = [];
    this.cullTimer = 0;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.mats = {
      rock: lam(0x9a8fb0), grey: lam(0x9a9a9a), stone: lam(0x8a8680), twig: lam(0x6a4a30),
      leaf: lam(0x6acb4a), ring: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    };
    this._place();
    this._pip();
  }

  // Deterministic placement so every client agrees on ids
  _place() {
    const rand = mulberry32(4242);
    const T = G.terrain;
    const ok = (x, z, minH = 3, maxH = 140) => {
      const h = T.heightAt(x, z);
      if (h < minH || h > maxH) return false;
      if (FLAT_SPOTS.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 6)) return false;
      if (this.list.some((q) => Math.hypot(q.pos.x - x, q.pos.z - z) < 40)) return false;
      return T.normalAt(x, z).y > 0.75;
    };
    const pick = (minD = 60, maxD = 640, minH, maxH) => {
      for (let i = 0; i < 300; i++) {
        const a = rand() * Math.PI * 2, d = minD + rand() * (maxD - minD);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (ok(x, z, minH, maxH)) return new THREE.Vector3(x, T.heightAt(x, z), z);
      }
      return null;
    };
    let id = 0;
    const add = (kind, pos, extra = {}) => { if (pos) this.list.push({ id: id++, kind, pos, ...extra }); };
    for (let i = 0; i < 12; i++) add('rock', pick());
    for (let i = 0; i < 8; i++) add('ring', pick(), { color: i % 4 });
    for (let i = 0; i < 7; i++) add('sapling', pick());
    // Sky hoops between the floating islets and over valleys
    const islets = G.world.islets;
    for (let i = 0; i < 8; i++) {
      let pos;
      if (i < 5 && islets.length > i * 2 + 1) {
        const a = islets[i * 2], b = islets[i * 2 + 1];
        pos = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + 6, (a.z + b.z) / 2);
      } else {
        const p = pick(150, 550);
        if (p) pos = p.add(new THREE.Vector3(0, 35 + rand() * 25, 0));
      }
      add('hoop', pos, { yaw: rand() * Math.PI });
    }
    // Summits: islet tops and the highest peaks
    for (let i = 0; i < 4 && i < islets.length; i++) {
      const s = islets[islets.length - 1 - i * 3] || islets[i];
      add('summit', new THREE.Vector3(s.x + s.r * 0.3, s.y, s.z));
    }
    const peaks = [];
    for (let i = 0; i < 1500; i++) {
      const a = rand() * Math.PI * 2, d = 150 + rand() * 550;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      peaks.push([T.heightAt(x, z), x, z]);
    }
    peaks.sort((p, q) => q[0] - p[0]);
    let n = 0;
    for (const [h, x, z] of peaks) {
      if (n >= 3) break;
      if (this.list.some((q) => Math.hypot(q.pos.x - x, q.pos.z - z) < 150)) continue;
      add('summit', new THREE.Vector3(x, h, z));
      n++;
    }
    for (const s of this.list) this._build(s);
    this.total = this.list.length;
  }

  _build(s) {
    const g = new THREE.Group();
    g.position.copy(s.pos);
    s.group = g;
    s.flag = `sprite_${s.id}`;
    const react = (r) => { r.active = true; r.sprite = s; G.world.reactives.push(r); s.reactive = r; };
    switch (s.kind) {
      case 'rock': {
        const rock = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(0.9, 0), 0.2, s.id + 3), this.mats.rock);
        rock.position.y = 0.45;
        rock.scale.set(1.2, 0.8, 1);
        const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 4, 12), new THREE.MeshBasicMaterial({ color: COLORS[s.id % 4].hex }));
        swirl.rotation.x = Math.PI / 2;
        swirl.position.y = 1.18;
        g.add(rock, swirl);
        react({ pos: s.pos.clone().setY(s.pos.y + 0.6), radius: 1.6, meleeOnly: true, onPaint: () => this.found(s) });
        break;
      }
      case 'ring': {
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.9, 6), this.mats.stone);
        stone.position.y = 0.45;
        const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: COLORS[s.color].hex }));
        glyph.position.y = 1.25;
        g.add(stone, glyph);
        s.flowers = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), new THREE.MeshLambertMaterial({ color: 0x9a9a9a, flatShading: true }));
          const fx = Math.cos(a) * 2.6, fz = Math.sin(a) * 2.6;
          f.position.set(fx, G.terrain.heightAt(s.pos.x + fx, s.pos.z + fz) - s.pos.y + 0.45, fz);
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 3), this.mats.grey);
          stem.position.set(fx, f.position.y - 0.22, fz);
          g.add(f, stem);
          s.flowers.push(f);
        }
        react({
          pos: s.pos.clone().setY(s.pos.y + 0.5), radius: 1.2, hitbox: 1.0,
          onPaint: (el) => {
            if (el === ELEMENTS[s.color]) this.found(s);
            else if (el && el !== 'none' && G.time - (s.hint || -9) > 4) { s.hint = G.time; G.hud.toast('The grey flowers wait for a different colour...', '#dddddd', 2); }
          },
        });
        break;
      }
      case 'sapling': {
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.4, 4), this.mats.twig);
        twig.position.y = 0.7;
        twig.rotation.z = 0.2;
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 3), this.mats.twig);
        branch.position.set(0.2, 1.1, 0);
        branch.rotation.z = -0.8;
        const bloom = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), this.mats.leaf);
          l.position.set((Math.random() - 0.5) * 0.9, 1.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.9);
          bloom.add(l);
        }
        bloom.visible = false;
        s.bloom = bloom;
        g.add(twig, branch, bloom);
        react({ pos: s.pos.clone().setY(s.pos.y + 0.8), radius: 1.3, hitbox: 1.0, onPaint: (el) => { if (el === 'vine') this.found(s); } });
        break;
      }
      case 'hoop': {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.22, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const cols = [];
        const pos = hoop.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const c = new THREE.Color().setHSL((Math.atan2(pos.getY(i), pos.getX(i)) / (Math.PI * 2) + 1) % 1, 0.8, 0.62);
          cols.push(c.r, c.g, c.b);
        }
        hoop.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        hoop.material.vertexColors = true;
        g.add(hoop);
        g.rotation.y = s.yaw;
        s.hoop = hoop;
        break;
      }
      case 'summit': {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 4), this.mats.leaf);
        leaf.position.y = 0.5;
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), this.mats.glow);
        core.position.y = 1.1;
        g.add(leaf, core);
        s.core = core;
        break;
      }
      default: break;
    }
    this.root.add(g);
  }

  _pip() {
    const pip = makeCharacter({ hood: 0xf2c229, scarf: 0x3fb54a, skin: 0xf0d0b0, tunic: 0x5a4a8a });
    const x = VILLAGE.x - 7, z = VILLAGE.z + 7;
    const y = G.terrain.heightAt(x, z);
    pip.group.position.set(x, y, z);
    pip.group.rotation.y = Math.PI * 0.2;
    pip.group.scale.setScalar(0.8);
    pip.brush.visible = false;
    this.root.add(pip.group);
    this.pip = pip;
    G.collision.addCylinder(x, z, 0.45, y, y + 1.5);
    G.world.interactables.push({
      pos: new THREE.Vector3(x, y + 1, z), radius: 3.2,
      prompt: () => `Talk to Pip the Palette Keeper (${spriteCount()} sprites)`,
      action: () => this.talk(),
    });
  }

  spendable() {
    const spent = (upgradeCount('heart') + upgradeCount('stamina')) * SPRITES_PER_UPGRADE;
    return spriteCount() - spent;
  }

  talk() {
    const have = this.spendable();
    if (have < SPRITES_PER_UPGRADE) {
      const n = spriteCount();
      G.hud.dialog('Pip', n === 0
        ? `Paint Sprites hide all over the island: under odd lavender rocks, in rings of grey flowers, in withered saplings, on lonely peaks and in sky hoops. Bring me ${SPRITES_PER_UPGRADE} and I'll brighten your spirit!`
        : `You've found ${n} of ${this.total} Paint Sprites! Bring me ${SPRITES_PER_UPGRADE - have} more for a blessing.`);
      return;
    }
    G.hud.choice('Pip', `${have} Paint Sprites are buzzing around you! Which blessing do you want?`, ['Heart Container', 'Stamina Vessel', 'Not yet'], (i) => {
      if (i === 2) return;
      const kind = i === 0 ? 'heart' : 'stamina';
      G.trials._setFlag(`upg_${kind}_${upgradeCount(kind) + 1}`);
      G.audio.play('shard');
      G.hud.banner(i === 0 ? 'Heart Container' : 'Stamina Vessel', i === 0 ? 'Your hearts grow for everyone in the party' : 'Your stamina grows for everyone in the party', '#fff09a');
    });
  }

  found(s) {
    if (G.flags[s.flag]) return;
    G.trials._setFlag(s.flag); // onFlag -> onFound shows the pop for everyone
  }

  onFound(flag) {
    const s = this.list.find((q) => q.flag === flag);
    if (!s || s.done) return;
    s.done = true;
    if (s.reactive) s.reactive.active = false;
    const near = G.player && G.player.pos.distanceTo(s.pos) < 80;
    if (near) {
      G.audio.play('sprite');
      G.hud.toast(`You found a Paint Sprite! (${spriteCount()}/${this.total})`, '#fff09a', 3);
      this._pop(s.pos.clone().setY(s.pos.y + (s.kind === 'hoop' ? 0 : 1)));
    }
    this._solvedLook(s);
  }

  _solvedLook(s) {
    if (s.kind === 'rock') s.group.children[0].position.set(1.4, 0.3, 0.6);
    if (s.kind === 'ring') s.flowers.forEach((f, i) => f.material.color.setHex(COLORS[(s.color + i) % 4].hex));
    if (s.kind === 'sapling') s.bloom.visible = true;
    if (s.kind === 'hoop' || s.kind === 'summit') s.group.visible = false;
  }

  _pop(pos) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x444444 }));
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 5), new THREE.MeshLambertMaterial({ color: COLORS[Math.floor(Math.random() * 4)].hex }));
    hat.position.y = 0.4;
    const eyes = new THREE.MeshBasicMaterial({ color: 0x222222 });
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), eyes);
      e.position.set(sx * 0.12, 0.05, 0.31);
      g.add(e);
    }
    g.add(body, hat);
    g.position.copy(pos);
    this.scene.add(g);
    this.pops.push({ g, t: 0, base: pos.clone() });
    G.particles.burst(pos, { count: 40, color: 0xfff2b0, speed: 5, life: 1, size: 0.4, pool: 'glow', gravity: -1 });
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    for (const s of this.list) {
      if (s.done) continue;
      if (G.flags[s.flag]) { s.done = true; if (s.reactive) s.reactive.active = false; this._solvedLook(s); continue; }
      if (s.kind === 'hoop') {
        s.hoop.rotation.z += dt * 0.6;
        const local = p.pos.clone().setY(p.pos.y + 1).sub(s.pos);
        if (local.length() < 3.3) this.found(s);
      } else if (s.kind === 'summit') {
        s.core.rotation.y += dt * 2;
        s.core.position.y = 1.1 + Math.sin(G.time * 2 + s.id) * 0.15;
        if (Math.random() < dt * 4) G.particles.burst(s.pos.clone().setY(s.pos.y + 1.1), { count: 1, color: 0xfff2b0, speed: 0.6, life: 1, size: 0.3, pool: 'glow', gravity: -0.5 });
        if (p.pos.distanceTo(s.pos) < 2.4) this.found(s);
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const q = this.pops[i];
      q.t += dt;
      q.g.position.copy(q.base).add(new THREE.Vector3(Math.sin(q.t * 3) * 0.3, q.t * 1.2 + Math.sin(q.t * 6) * 0.1, 0));
      q.g.lookAt(G.camera.position.x, q.g.position.y, G.camera.position.z);
      q.g.scale.setScalar(q.t < 2.5 ? Math.min(1, q.t * 4) : Math.max(0, 1 - (q.t - 2.5) * 2));
      if (q.t > 3) { this.scene.remove(q.g); this.pops.splice(i, 1); }
    }
    // Distance culling keeps draw calls down
    this.cullTimer -= dt;
    if (this.cullTimer <= 0) {
      this.cullTimer = 0.5;
      const cam = G.camera.position;
      for (const s of this.list) s.group.visible = !(s.done && (s.kind === 'hoop' || s.kind === 'summit')) && s.pos.distanceTo(cam) < (s.kind === 'hoop' ? 400 : 180);
      this.root.visible = !p.inDungeon;
    }
    if (this.pip) this.pip.animate({ state: 'idle', speed: 0 }, dt);
  }
}

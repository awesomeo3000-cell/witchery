// The four Prism Trials (dungeon interiors + puzzles + mini-boss arenas) and the Sky Citadel finale.
// Puzzle progress is stored in shared flags so everyone in the room sees the same state.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { TRIALS, CITADEL } from '../world/layout.js';
import { MAT, jitter } from '../world/props.js';
import { applyStats } from '../core/progress.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Builder {
  constructor(root, origin) {
    this.root = root;
    this.o = origin;
    this.boxes = [];
  }

  // Box in dungeon-local coordinates (x,z centre, y bottom).
  box(x, y, z, w, h, d, mat, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(this.o.x + x, this.o.y + y + h / 2, this.o.z + z);
    m.receiveShadow = true;
    m.castShadow = opts.shadow !== false;
    this.root.add(m);
    let col = null;
    if (opts.solid !== false) {
      col = G.collision.addBox(this.o.x + x, this.o.y + y + h / 2, this.o.z + z, w, h, d, { tags: opts.tags || ['smooth'], dynamic: opts.dynamic });
    }
    return { mesh: m, col };
  }

  torch(x, y, z, color = 0xffb060) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.2, 5), MAT.woodDark);
    post.position.set(this.o.x + x, this.o.y + y + 0.6, this.o.z + z);
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color }));
    flame.position.set(this.o.x + x, this.o.y + y + 1.4, this.o.z + z);
    this.root.add(post, flame);
    return flame;
  }

  light(x, y, z, color, intensity = 30, dist = 40) {
    const l = new THREE.PointLight(color, intensity, dist, 1.4);
    l.position.set(this.o.x + x, this.o.y + y, this.o.z + z);
    this.root.add(l);
    return l;
  }

  // Wall across the corridor at depth z with a centred doorway.
  partition(z, hw, h, ow = 4, oh = 5, y0 = 0) {
    const side = hw - ow / 2;
    this.box(-(ow / 2 + side / 2), y0 - 1, z, side, h, 1, MAT.dungeon);
    this.box(ow / 2 + side / 2, y0 - 1, z, side, h, 1, MAT.dungeon);
    this.box(0, y0 + oh, z, ow, h - oh - 1, 1, MAT.dungeon);
  }

  w(x, y, z) { return V(this.o.x + x, this.o.y + y, this.o.z + z); }
}

export class Trials {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.interactables = [];
    this.data = {};
    this.lights = [];
    this.doors = [];
    for (const t of TRIALS) this._build(t);
    this.bossSpawnCd = 0;
  }

  shardCount() { return TRIALS.filter((t) => G.flags[`trial_${t.key}`]).length; }

  arenaFor(key) { return this.data[key].arena; }

  citadelArena() { return { x: CITADEL.x, y: CITADEL.y, z: CITADEL.z, r: 36 }; }

  _setFlag(k, v = true) {
    if (G.flags[k] === v) return;
    G.flags[k] = v;
    G.net?.send({ t: 'flag', k, v });
    this.onFlag(k, v);
  }

  // Called whenever a flag changes (locally or from the network)
  onFlag(k, v) {
    if (k.startsWith('upg_')) applyStats(false);
    if (k.startsWith('sprite_') && v && G.sprites) G.sprites.onFound(k);
    if (G.quests) G.quests.onFlag(k, v);
    if (G.puzzles) G.puzzles.onFlag(k, v);
    if (G.towers) G.towers.onFlag(k, v);
    if (k.startsWith('trial_') && v) {
      const t = TRIALS.find((q) => `trial_${q.key}` === k);
      if (t && !this._announced?.[k]) {
        (this._announced ||= {})[k] = true;
        G.audio.play('shard');
        G.hud.banner(`${COLORS[t.color].name} Prism Shard`, `${this.shardCount()} / 4 Prism Shards restored`, COLORS[t.color].css);
        applyStats(true);
        if (this.shardCount() >= 4) setTimeout(() => G.hud.banner('The Barrier Falls', 'The Sky Citadel awaits above Palette Hollow', '#e0c8ff'), 4500);
      }
    }
    if (k === 'final' && v && !this._finalShown) {
      this._finalShown = true;
      G.audio.mood = 'victory';
      G.victoryGlow = 6;
      G.hud.banner('Colour Returns', 'The Hueless King is undone', '#ffe08a');
      for (let i = 0; i < 4; i++) setTimeout(() => G.particles && G.player && G.particles.burst(G.player.pos.clone().setY(G.player.pos.y + 8), { count: 120, color: [0xe8442e, 0x3a9ae8, 0xf2c229, 0x3fb54a][i], speed: 18, life: 2.5, size: 0.6, pool: 'glow', gravity: 6 }), i * 450);
      setTimeout(() => G.hud.victory(), 4500);
    }
  }

  // ------------------------------------------------------------ building
  _build(t) {
    const o = V(t.dungeon.x, t.dungeon.y, t.dungeon.z);
    const b = new Builder(this.root, o);
    const d = { trial: t, origin: o, builder: b, reactives: [] };
    this.data[t.key] = d;
    d.spawn = b.w(0, 0.1, 2);
    // Entry room shared by all trials
    b.box(0, -1, 5, 14, 1, 14, MAT.dungeonFloor);
    // Left wall has a doorway (z 4..8) into an optional side chamber
    b.box(-7.5, -1, 1, 1, 12, 6, MAT.dungeon);
    b.box(-7.5, -1, 10, 1, 12, 4, MAT.dungeon);
    b.box(-7.5, 4, 6, 1, 7, 4, MAT.dungeon);
    b.box(7.5, -1, 5, 1, 12, 14, MAT.dungeon);
    b.box(0, -1, -2.5, 16, 12, 1, MAT.dungeon);
    b.box(0, 10, 5, 16, 1, 16, MAT.dungeon, { shadow: false });
    b.torch(-5, 0, 0, COLORS[t.color].hex);
    b.torch(5, 0, 0, COLORS[t.color].hex);
    b.light(0, 6, 5, COLORS[t.color].hex, 18, 30);
    // Exit portal
    const portal = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.2, 8, 24), new THREE.MeshBasicMaterial({ color: COLORS[t.color].hex }));
    portal.position.copy(b.w(0, 1.8, -1.6));
    this.root.add(portal);
    this.interactables.push({ pos: b.w(0, 1, -0.8), radius: 2.6, prompt: 'Leave the trial', action: () => this.exit(t.key) });

    if (t.key === 'ember') this._buildEmber(d);
    if (t.key === 'frost') this._buildFrost(d);
    if (t.key === 'spring') this._buildSpring(d);
    if (t.key === 'bloom') this._buildBloom(d);
    this._buildArena(d);
    this._buildSide(d);
  }

  // Optional side chamber: a small colour challenge guarding a chest with a Paint Sprite
  _buildSide(d) {
    const b = d.builder;
    const key = d.trial.key;
    b.box(-20.5, -1, 5, 1, 12, 15, MAT.dungeon);
    b.box(-14, -1, -2.5, 14, 12, 1, MAT.dungeon);
    b.box(-14, -1, 12.5, 14, 12, 1, MAT.dungeon);
    b.box(-14, 10, 5, 14, 1, 15, MAT.dungeon, { shadow: false });
    b.light(-14, 7, 5, COLORS[d.trial.color].hex, 14, 22);
    let chestAt = [-17, 0, 5];
    if (key === 'frost') {
      // A freezing channel: freeze it to cross
      b.box(-9, -1, 5, 2, 1, 14, MAT.dungeonFloor);
      b.box(-19, -1, 5, 2, 1, 14, MAT.dungeonFloor);
      b.box(-14, -7, 5, 8, 1, 14, MAT.dungeonFloor);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), MAT.dungeonWater);
      water.rotation.x = -Math.PI / 2;
      water.position.copy(b.w(-14, -0.4, 5));
      this.root.add(water);
      G.collision.water.push({ min: b.w(-18, -7, -2), max: b.w(-10, 0, 12), level: b.o.y - 0.4, cold: true, active: true });
      chestAt = [-19, 0, 5];
    } else {
      b.box(-14, -1, 5, 12, 1, 14, MAT.dungeonFloor);
    }
    if (key === 'ember') {
      this._bramble(d, 'side', -8, 0, 6, 4, 5, 'z');
      // The chest is sealed in ice: melt it with fire
      d.sideNeeds = this._iceBlock(d, -17, 5, 3.2);
    }
    if (key === 'spring') { b.box(-17, -1, 5, 5, 8, 5, MAT.dungeon); chestAt = [-17, 7, 5]; }
    if (key === 'bloom') { b.box(-17, -1, 5, 5, 8, 5, MAT.mossWall, { tags: ['mossy'] }); chestAt = [-17, 7, 5]; }
    const hints = { ember: 'Frozen treasure...', frost: 'Across the cold channel', spring: 'Treasure up high', bloom: 'Moss climbs to treasure' };
    const hint = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.9), new THREE.MeshBasicMaterial({ map: textTexture(hints[key], COLORS[d.trial.color].light), transparent: true }));
    hint.position.copy(b.w(-19.9, 5, 5));
    hint.rotation.y = Math.PI / 2;
    this.root.add(hint);
    this._trialChest(d, ...chestAt);
  }

  _iceBlock(d, x, z, size = 1.6) {
    const b = d.builder;
    const { mesh, col } = b.box(x, 0, z, size, 3, size, MAT.ice, { dynamic: true, tags: ['smooth'] });
    const flag = `ice_${d.trial.key}_${x}_${z}`;
    const pos = b.w(x, 1.5, z);
    const r = this._reactive(d, {
      pos,
      radius: size * 0.6 + 0.8, hitbox: size * 0.6 + 0.4,
      onPaint: (el) => { if (el === 'fire' && !G.flags[flag]) this._setFlag(flag); },
      tick: () => {
        if (G.flags[flag] && mesh.visible) {
          mesh.visible = false;
          col.active = false;
          r.active = false;
          G.particles.burst(pos, { count: 30, color: 0xcdefff, speed: 5, life: 0.8, size: 0.5 });
          G.particles.burst(pos, { count: 10, color: 0xdddddd, speed: 2, up: 3, life: 1.2, size: 0.9, gravity: -1, alpha: 0.5 });
          G.audio.play('ice');
        }
      },
    });
    return flag;
  }

  _trialChest(d, x, y, z) {
    const b = d.builder;
    const flag = `sprite_trial_${d.trial.key}`;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), new THREE.MeshLambertMaterial({ color: 0x5a4a8a, flatShading: true }));
    body.position.y = 0.35;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.12, 0.84), new THREE.MeshLambertMaterial({ color: COLORS[d.trial.color].hex, emissive: COLORS[d.trial.color].hex, emissiveIntensity: 0.4 }));
    trim.position.y = 0.55;
    const lid = new THREE.Group();
    lid.position.set(0, 0.7, -0.4);
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8, 1, false, 0, Math.PI), body.material);
    lidM.rotation.z = Math.PI / 2;
    lidM.position.z = 0.4;
    lid.add(lidM);
    g.add(body, trim, lid);
    g.position.copy(b.w(x, y, z));
    g.rotation.y = Math.PI / 2;
    this.root.add(g);
    G.collision.addBox(g.position.x, g.position.y + 0.35, g.position.z, 1.1, 0.7, 1.1);
    const pos = g.position.clone();
    this._reactive(d, { pos, radius: 0.1, onPaint: () => {}, tick: (dt) => { lid.rotation.x += ((G.flags[flag] ? -1.9 : 0) - lid.rotation.x) * Math.min(1, dt * 4); } });
    this.interactables.push({
      pos: pos.clone().setY(pos.y + 0.6), radius: 2.3, prompt: 'Open the trial chest',
      enabled: () => !G.flags[flag] && (!d.sideNeeds || G.flags[d.sideNeeds]),
      action: () => {
        if (G.flags[flag]) return;
        this._setFlag(flag);
        if (G.sprites) G.sprites._pop(pos.clone().setY(pos.y + 1.2));
        G.audio.play('sprite');
        G.hud.toast(`A Paint Sprite was hiding in the chest! (${Object.keys(G.flags).filter((f) => f.startsWith('sprite_') && G.flags[f]).length}/${G.sprites ? G.sprites.total : 46})`, '#fff09a', 3);
      },
    });
  }

  _door(d, x, y, z, w, h, flagFn, axis = 'x') {
    const b = d.builder;
    const { mesh, col } = b.box(x, y, z, axis === 'x' ? w : 1, h, axis === 'x' ? 1 : w, new THREE.MeshLambertMaterial({ color: COLORS[d.trial.color].hex, emissive: COLORS[d.trial.color].hex, emissiveIntensity: 0.25, flatShading: true }), { dynamic: true, tags: ['smooth', 'door'] });
    const door = { mesh, col, open: false, flagFn, baseY: mesh.position.y, h, d };
    this.doors.push(door);
    return door;
  }

  _reactive(d, r) {
    r.active = true;
    d.reactives.push(r);
    G.world.reactives.push(r);
    return r;
  }

  _brazier(d, key, x, y, z) {
    const b = d.builder;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.8, 8), MAT.stoneDark);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 6), MAT.stoneDark);
    stand.position.copy(b.w(x, y + 0.7, z));
    bowl.position.copy(b.w(x, y + 1.8, z));
    this.root.add(bowl, stand);
    G.collision.addCylinder(o(b, x), o2(b, z), 0.7, b.o.y + y, b.o.y + y + 2.2, { tags: ['smooth'] });
    const flag = `ember_brazier_${key}`;
    const flame = new THREE.PointLight(0xff8a3a, 0, 14, 1.5);
    flame.position.copy(b.w(x, y + 3, z));
    this.root.add(flame);
    const pos = b.w(x, y + 2.2, z);
    this._reactive(d, {
      pos, radius: 1.6, hitbox: 1.3, flag,
      onPaint: (el) => {
        if (el !== 'fire' || G.flags[flag]) return;
        this._setFlag(flag);
        G.audio.play('switch');
      },
      tick: (dt) => {
        const lit = !!G.flags[flag];
        flame.intensity = lit ? 25 + Math.random() * 6 : 0;
        if (lit && Math.random() < dt * 30) G.particles.flames(pos, 0.5, 1, 1.2);
      },
    });
  }

  _bramble(d, key, x, y, z, w, h, axis = 'x') {
    const b = d.builder;
    const flag = `bramble_${d.trial.key}_${key}`;
    const g = new THREE.Group();
    const thornMat = MAT.bramble;
    for (let i = 0; i < 26; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.6 + Math.random() * 0.5, 0.12, 4, 8), thornMat);
      t.position.set((Math.random() - 0.5) * (axis === 'x' ? w : 0.6), Math.random() * h, (Math.random() - 0.5) * (axis === 'x' ? 0.6 : w));
      t.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      g.add(t);
      for (let k = 0; k < 2; k++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
        sp.position.copy(t.position).add(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
        g.add(sp);
      }
    }
    g.position.copy(b.w(x, y, z));
    this.root.add(g);
    const col = G.collision.addBox(o(b, x), b.o.y + y + h / 2, o2(b, z), axis === 'x' ? w : 1, h, axis === 'x' ? 1 : w, { dynamic: true, tags: ['bramble'] });
    const burn = () => {
      col.active = false;
      g.visible = false;
    };
    const pos = b.w(x, y + h / 2, z);
    const r = this._reactive(d, {
      pos, radius: Math.max(w, h) * 0.55, hitbox: Math.max(w, h) * 0.5,
      onPaint: (el) => {
        if (el !== 'fire' || G.flags[flag]) return;
        this._setFlag(flag);
      },
      tick: () => {
        if (G.flags[flag] && g.visible) {
          for (let i = 0; i < 40; i++) G.particles.flames(pos.clone().add(V((Math.random() - 0.5) * w, (Math.random() - 0.5) * h, 0)), 0.5, 1, 1.5);
          G.audio.play('fire');
          burn();
          r.active = false;
        }
      },
    });
  }

  // ---------------------------------------------------------------- EMBER: light three braziers
  _buildEmber(d) {
    const b = d.builder;
    // Main hall z 12..44
    b.box(0, -1, 28, 26, 1, 34, MAT.dungeonFloor);
    b.box(-13.5, -1, 28, 1, 16, 34, MAT.dungeon);
    b.box(13.5, -1, 28, 1, 16, 34, MAT.dungeon);
    b.box(0, 15, 28, 28, 1, 34, MAT.dungeon, { shadow: false });
    b.partition(11.5, 14, 17);
    // Brazier A: in plain sight
    this._brazier(d, 'a', -8, 0, 20);
    // Brazier B: behind a bramble wall in an alcove on the right
    b.box(9, -1, 30, 8, 1, 8, MAT.dungeonFloor);
    b.box(9, -1, 26, 8, 8, 1, MAT.dungeon);
    b.box(9, -1, 34, 8, 8, 1, MAT.dungeon);
    this._bramble(d, 'alcove', 5.5, 0, 30, 7, 7, 'z');
    this._brazier(d, 'b', 10.5, 0, 30);
    // Brazier C: up on a high ledge (shoot it with an Ember flick)
    b.box(-9, -1, 36, 8, 8, 6, MAT.dungeon);
    this._brazier(d, 'c', -9.5, 7, 36.5);
    b.torch(-11, 0, 14);
    b.torch(11, 0, 14);
    b.light(0, 10, 28, 0xffd8b0, 40, 60);
    const hint = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: textTexture('Light the three flames', '#ffb080'), transparent: true }));
    hint.position.copy(b.w(0, 6, 44.4));
    hint.rotation.y = Math.PI;
    this.root.add(hint);
    // Door to arena at far end
    b.box(-8.5, -1, 45, 9, 16, 1, MAT.dungeon);
    b.box(8.5, -1, 45, 9, 16, 1, MAT.dungeon);
    b.box(0, 7, 45, 8, 8, 1, MAT.dungeon);
    this._door(d, 0, 0, 45, 8, 7, () => ['a', 'b', 'c'].every((k) => G.flags[`ember_brazier_${k}`]));
    d.arenaZ = 46;
  }

  // ---------------------------------------------------------------- FROST: freeze the freezing pool
  _buildFrost(d) {
    const b = d.builder;
    // Hall with a wide pool of freezing water z 16..40
    b.box(0, -1, 14, 24, 1, 6, MAT.dungeonFloor);  // near bank z 11..17
    b.box(0, -8, 28, 24, 1, 22, MAT.dungeonFloor); // pool floor
    b.box(0, -1, 42, 24, 1, 6, MAT.dungeonFloor);  // far bank z 39..45
    b.box(-12.5, -8, 28, 1, 23, 36, MAT.dungeon);
    b.box(12.5, -8, 28, 1, 23, 36, MAT.dungeon);
    b.box(0, 15, 28, 26, 1, 36, MAT.dungeon, { shadow: false });
    b.partition(11.5, 13, 17);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(24, 22), MAT.dungeonWater);
    water.rotation.x = -Math.PI / 2;
    water.position.copy(b.w(0, -0.4, 28));
    this.root.add(water);
    G.collision.water.push({ min: b.w(-12, -8, 17), max: b.w(12, 0, 39), level: b.o.y - 0.4, cold: true, active: true });
    // A few pillars poking out of the water (too far apart to jump)
    b.box(-4, -8, 24, 2, 8.2, 2, MAT.dungeon);
    b.box(5, -8, 33, 2, 8.2, 2, MAT.dungeon);
    // Icicles
    for (let i = 0; i < 20; i++) {
      const ic = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5 + Math.random() * 2, 5), MAT.ice);
      ic.rotation.x = Math.PI;
      ic.position.copy(b.w((Math.random() - 0.5) * 22, 14, 14 + Math.random() * 30));
      this.root.add(ic);
    }
    const hint = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.2), new THREE.MeshBasicMaterial({ map: textTexture('Water too cold to swim...', '#9ee0ff'), transparent: true }));
    hint.position.copy(b.w(0, 5, 44.4));
    hint.rotation.y = Math.PI;
    this.root.add(hint);
    // Pressure plate on far bank opens the door
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.2, 16), new THREE.MeshLambertMaterial({ color: 0x3a9ae8, emissive: 0x1a4a88 }));
    plate.position.copy(b.w(0, 0.1, 42));
    this.root.add(plate);
    d.plate = { pos: b.w(0, 0, 42), mesh: plate, flag: 'frost_plate' };
    b.light(0, 10, 28, 0xe0f4ff, 40, 60);
    b.box(-8, -1, 45, 8, 16, 1, MAT.dungeon);
    b.box(8, -1, 45, 8, 16, 1, MAT.dungeon);
    b.box(0, 7, 45, 8, 8, 1, MAT.dungeon);
    this._door(d, 0, 0, 45, 8, 7, () => G.flags.frost_plate);
    d.arenaZ = 46;
  }

  // ---------------------------------------------------------------- SPRING: bounce up the tiers
  _buildSpring(d) {
    const b = d.builder;
    b.box(0, -1, 30, 28, 1, 38, MAT.dungeonFloor);
    b.box(-14.5, -1, 30, 1, 30, 38, MAT.dungeon);
    b.box(14.5, -1, 30, 1, 30, 38, MAT.dungeon);
    b.box(0, 28, 30, 30, 1, 38, MAT.dungeon, { shadow: false });
    b.partition(11.5, 15, 30);
    // Tiers (tops at 5, 10, 15) - each too tall to jump
    const gold = new THREE.MeshLambertMaterial({ color: 0xc89a4a, flatShading: true });
    b.box(-7, 0, 24, 12, 5, 8, gold);
    b.box(6, 0, 34, 14, 10, 8, gold);
    b.box(-4, 0, 44, 20, 15, 6, gold);
    const hint = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: textTexture('Reach the golden bell', '#fff09a'), transparent: true }));
    hint.position.copy(b.w(0, 20, 48.3));
    hint.rotation.y = Math.PI;
    this.root.add(hint);
    // Bell on the top tier: hit it (with anything) to open the arena
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshLambertMaterial({ color: 0xf2c229, emissive: 0x805a10, side: THREE.DoubleSide }));
    bell.position.copy(b.w(-8, 17.5, 44));
    this.root.add(bell);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 5, 12, Math.PI), MAT.woodDark);
    frame.position.copy(b.w(-8, 17, 44));
    this.root.add(frame);
    const bellPos = b.w(-8, 17, 44);
    this._reactive(d, {
      pos: bellPos, radius: 1.8, meleeOnly: true,
      onPaint: () => {
        if (G.flags.spring_bell) return;
        this._setFlag('spring_bell');
        G.audio.play('solve');
      },
      tick: () => { bell.rotation.z = G.flags.spring_bell ? Math.sin(G.time * 6) * 0.2 : 0; },
    });
    // Drop down from the top tier to the arena door (right side)
    b.light(0, 20, 30, 0xfff4d8, 50, 70);
    b.box(-10, -1, 49, 10, 30, 1, MAT.dungeon);
    b.box(10, -1, 49, 10, 30, 1, MAT.dungeon);
    b.box(0, 7, 49, 10, 22, 1, MAT.dungeon);
    this._door(d, 0, 0, 49, 10, 7, () => G.flags.spring_bell);
    d.arenaZ = 50;
  }

  // ---------------------------------------------------------------- BLOOM: grow vines
  _buildBloom(d) {
    const b = d.builder;
    const moss = MAT.mossWall;
    b.box(0, -1, 18, 20, 1, 12, MAT.dungeonFloor);
    b.box(-10.5, -1, 30, 1, 30, 38, MAT.dungeon);
    b.box(10.5, -1, 30, 1, 30, 38, MAT.dungeon);
    b.box(0, 28, 30, 22, 1, 38, MAT.dungeon, { shadow: false });
    b.partition(11.5, 11, 30);
    // A mossy cliff (climbable with vines) z 24, top at 9
    b.box(0, -1, 26, 20, 10, 4, moss, { tags: ['mossy'] });
    // Upper ledge beyond the cliff
    b.box(0, -1, 31, 20, 10, 6, MAT.dungeon);
    // Chasm z 34..42 — cross with a vine bridge grown from a seed pod
    b.box(0, -13, 38, 20, 1, 8, MAT.dungeonFloor);
    b.box(-10.5, -13, 38, 1, 12, 8, MAT.dungeon);
    b.box(10.5, -13, 38, 1, 12, 8, MAT.dungeon);
    b.box(0, -1, 45, 20, 10, 6, MAT.dungeon);
    // Seed pod on the far side
    const pod = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshLambertMaterial({ color: 0x6acb4a, emissive: 0x2a6a1a, flatShading: true }));
    pod.position.copy(b.w(0, 10.2, 42.8));
    this.root.add(pod);
    const bridgeParts = [];
    for (let i = 0; i < 8; i++) {
      const plank = new THREE.Mesh(jitter(new THREE.BoxGeometry(3, 0.5, 1.05, 2, 1, 1), 0.1, i), new THREE.MeshLambertMaterial({ color: 0x3f8a3a, flatShading: true }));
      plank.position.copy(b.w(0, 8.75, 34.5 + i));
      plank.visible = false;
      this.root.add(plank);
      bridgeParts.push(plank);
    }
    const bridgeCol = G.collision.addBox(b.o.x, b.o.y + 8.75, b.o.z + 38, 3, 0.5, 8, { dynamic: true, tags: ['bridge'] });
    bridgeCol.active = false;
    this._reactive(d, {
      pos: b.w(0, 10.2, 42.8), radius: 1.5, hitbox: 1.4,
      onPaint: (el) => {
        if (el !== 'vine' || G.flags.bloom_bridge) return;
        this._setFlag('bloom_bridge');
        G.audio.play('vine');
      },
      tick: (dt) => {
        if (G.flags.bloom_bridge) {
          if (!bridgeCol.active && G.collision.dynamic.indexOf(bridgeCol) < 0) G.collision.dynamic.push(bridgeCol);
          bridgeCol.active = true;
          d.bridgeT = Math.min(1, (d.bridgeT || 0) + dt * 1.5);
          bridgeParts.forEach((p, i) => { p.visible = d.bridgeT * 8 > 7 - i; });
          pod.scale.setScalar(1.4);
        } else pod.scale.setScalar(1 + Math.sin(G.time * 3) * 0.1);
      },
    });
    // Cold chasm floor: falling in respawns you
    G.collision.water.push({ min: b.w(-10, -12, 34), max: b.w(10, -6, 42), level: b.o.y - 6.5, cold: true, active: true });
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), new THREE.MeshBasicMaterial({ color: 0x2a4a2a, transparent: true, opacity: 0.8 }));
    mist.rotation.x = -Math.PI / 2;
    mist.position.copy(b.w(0, -6.5, 38));
    this.root.add(mist);
    const hint = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: textTexture('Moss welcomes the vine', '#a8f08c'), transparent: true }));
    hint.position.copy(b.w(0, 5, 23.9));
    hint.rotation.y = Math.PI;
    this.root.add(hint);
    // Hanging plants
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2 + Math.random() * 5, 4), this.vine || (this.vine = new THREE.MeshLambertMaterial({ color: 0x3f7a35 })));
      v.position.copy(b.w((Math.random() - 0.5) * 18, 25, 14 + Math.random() * 34));
      this.root.add(v);
    }
    b.light(0, 18, 30, 0xe8ffd8, 45, 70);
    b.box(-6.5, 8, 48, 7, 20, 1, MAT.dungeon);
    b.box(6.5, 8, 48, 7, 20, 1, MAT.dungeon);
    b.box(0, 15, 48, 6, 13, 1, MAT.dungeon);
    this._door(d, 0, 9, 48, 6, 6, () => G.flags.bloom_bridge);
    // The arena for bloom sits at the upper level
    d.arenaZ = 49;
    d.arenaY = 9;
  }

  _buildArena(d) {
    const b = d.builder;
    const z0 = d.arenaZ;
    const y0 = d.arenaY || 0;
    const R = 20;
    const cz = z0 + R + 1;
    b.box(0, y0 - 1, cz, R * 2 + 4, 1, R * 2 + 4, MAT.dungeonFloor);
    b.box(-R - 2.5, y0 - 1, cz, 1, 24, R * 2 + 4, MAT.dungeon);
    b.box(R + 2.5, y0 - 1, cz, 1, 24, R * 2 + 4, MAT.dungeon);
    b.box(0, y0 - 1, cz + R + 2.5, R * 2 + 6, 24, 1, MAT.dungeon);
    b.box(0, y0 + 22, cz, R * 2 + 6, 1, R * 2 + 6, MAT.dungeon, { shadow: false });
    // Side walls where the entrance wall meets arena (arena is wider)
    b.box(-16.5, y0 - 1, z0 - 0.5, 15, 24, 1, MAT.dungeon);
    b.box(16.5, y0 - 1, z0 - 0.5, 15, 24, 1, MAT.dungeon);
    b.box(0, y0 + 7, z0 - 0.5, 18, 16, 1, MAT.dungeon, { shadow: false });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.box(Math.cos(a) * (R - 2), y0, cz + Math.sin(a) * (R - 2), 1.6, 20, 1.6, MAT.stone);
    }
    b.light(0, y0 + 16, cz, 0xfff0e0, 60, 80);
    b.light(0, y0 + 4, cz + R - 4, COLORS[d.trial.color].hex, 30, 40);
    d.arena = { x: b.o.x, y: b.o.y + y0, z: b.o.z + cz, r: R };
    // Prism pedestal (appears after the boss is defeated)
    const prism = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: COLORS[d.trial.color].hex, emissive: COLORS[d.trial.color].hex, emissiveIntensity: 0.8 }));
    prism.scale.y = 1.6;
    prism.position.copy(b.w(0, y0 + 2.5, cz));
    prism.visible = false;
    this.root.add(prism);
    d.prism = prism;
    this.interactables.push({
      pos: b.w(0, y0 + 1, cz), radius: 3.5, prompt: 'Return to the surface',
      enabled: () => !!G.flags[`trial_${d.trial.key}`], action: () => this.exit(d.trial.key),
    });
  }

  // ------------------------------------------------------------ enter / exit
  enter(key) {
    const d = this.data[key];
    const p = G.player;
    p.state = 'air';
    p.pos.copy(d.spawn);
    p.vel.set(0, 0, 0);
    p.checkpoint.copy(d.spawn);
    p.lastSafe.copy(d.spawn);
    p.camYaw = Math.PI; // face +z into the dungeon
    p.yaw = 0;
    p.camPos.copy(d.spawn).add(V(0, 3, -5));
    G.audio.play('waypoint');
    G.audio.mood = 'dungeon';
    G.hud.banner(d.trial.name, this._subtitle(key), COLORS[d.trial.color].css);
  }

  _subtitle(key) {
    return {
      ember: 'Ember burns what bars your way',
      frost: 'Frost makes a path where none can walk',
      spring: 'Spring lifts those who dare to leap',
      bloom: 'Bloom climbs where stone stands tall',
    }[key];
  }

  exit(key) {
    const t = TRIALS.find((q) => q.key === key);
    const p = G.player;
    const y = G.terrain.heightAt(t.x + 13, t.z) + 0.5;
    p.pos.set(t.x + 13, y, t.z);
    p.vel.set(0, 0, 0);
    p.state = 'air';
    p.checkpoint.copy(p.pos);
    p.lastSafe.copy(p.pos);
    p.camPos.copy(p.pos).add(V(6, 3, 0));
    G.audio.mood = 'explore';
    G.audio.play('waypoint');
  }

  onBossDefeated(key) {
    this._setFlag(`trial_${key}`);
  }

  onFinalDefeated() {
    this._setFlag('final');
  }

  // ------------------------------------------------------------ update
  update(dt) {
    for (const d of Object.values(this.data)) for (const r of d.reactives) r.tick?.(dt);
    // Doors
    for (const door of this.doors) {
      const open = door.flagFn();
      if (open && !door.open) {
        door.open = true;
        if (G.player && G.player.pos.distanceTo(door.mesh.position) < 80) {
          G.audio.play('door');
          G.audio.play('solve');
          G.hud.toast('A door rumbles open...', '#ffffff', 2);
        }
      }
      const target = door.open ? door.baseY - door.h - 0.2 : door.baseY;
      door.mesh.position.y += (target - door.mesh.position.y) * Math.min(1, dt * 1.5);
      door.col.active = door.mesh.position.y > door.baseY - door.h + 0.5;
    }
    // Frost pressure plate: any player standing on it
    const fd = this.data.frost;
    if (fd.plate && !G.flags.frost_plate) {
      const pls = G.enemies.players();
      if (pls.some((p) => p.pos.distanceTo(fd.plate.pos) < 1.6)) {
        this._setFlag('frost_plate');
        G.audio.play('switch');
      }
    }
    if (fd.plate) fd.plate.mesh.position.y = fd.plate.pos.y + (G.flags.frost_plate ? 0.02 : 0.1);
    // Prisms after victory
    for (const d of Object.values(this.data)) {
      d.prism.visible = !!G.flags[`trial_${d.trial.key}`];
      d.prism.rotation.y += dt;
    }
    // Boss spawning (host)
    if (G.enemies.isHost) {
      this.bossSpawnCd -= dt;
      if (this.bossSpawnCd <= 0) {
        this.bossSpawnCd = 1;
        const pls = G.enemies.players();
        for (const d of Object.values(this.data)) {
          const t = d.trial;
          if (G.flags[`trial_${t.key}`]) continue;
          const a = d.arena;
          const inside = pls.some((p) => p.alive && Math.hypot(p.pos.x - a.x, p.pos.z - a.z) < a.r && Math.abs(p.pos.y - a.y) < 15);
          const existing = G.enemies.list.find((e) => e.trial === t.key && e.alive);
          if (inside && !existing) {
            const type = { ember: 'frostmaw', frost: 'magmaw', spring: 'shellback', bloom: 'galewing' }[t.key];
            const e = G.enemies.spawn(type, V(a.x, a.y + (type === 'galewing' ? 8 : 0.5), a.z + 8), { arena: a, trial: t.key });
            e.yaw = Math.PI;
            G.enemies.fx('roar', e.pos);
          }
        }
        // Final boss on the citadel
        const barrierDown = this.shardCount() >= 4;
        if (barrierDown && !G.flags.final) {
          const a = this.citadelArena();
          const inside = pls.some((p) => p.alive && Math.hypot(p.pos.x - a.x, p.pos.z - a.z) < a.r && p.pos.y > a.y - 5 && p.pos.y < a.y + 40);
          if (inside && !G.enemies.list.find((e) => e.type === 'hueless' && e.alive)) {
            const e = G.enemies.spawn('hueless', V(a.x, a.y, a.z - 10), { arena: a });
            G.enemies.fx('roar', e.pos);
          }
        }
      }
    }
    // Music mood
    const boss = G.enemies.bossActive;
    if (G.audio.mood !== 'victory') {
      if (boss) G.audio.mood = 'battle';
      else if (G.player.inDungeon) G.audio.mood = 'dungeon';
      else G.audio.mood = 'explore';
    }
  }
}

function o(b, x) { return b.o.x + x; }
function o2(b, z) { return b.o.z + z; }

export function textTexture(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.font = 'italic 44px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.shadowColor = color;
  x.shadowBlur = 16;
  x.fillStyle = color;
  x.fillText(text, 256, 48);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

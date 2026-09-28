// The Prism Vault: a post-game dungeon. Once the Hueless King falls, a stone spire rises from the
// middle of the lake. Below it, four chambers each need two colours or more:
//   A  freeze the pool, then keep both braziers burning at once
//   B  bounce up the smooth ledge, vine up the moss, ring the bell
//   C  burn the brambles, grow the vine bridge from the seed pod
//   D  paint the four crystals in the order the mural shows
// The last chamber holds a chest with 100 Pigment and the Prismatic glider.
import * as THREE from 'three';
import { makePortal } from './portal.js';
import { G, COLORS, DUNGEON_Y } from '../core/ctx.js';
import { LAKE } from '../world/layout.js';
import { MAT } from '../world/props.js';
import { Builder, textTexture } from './trials.js';

export const VAULT = { x: LAKE.x, y: DUNGEON_Y - 620, z: LAKE.z };
export const VAULT_PIGMENT = 100;
export const BRAZIER_WINDOW = 12000;
export const ORDER = [2, 0, 3, 1]; // Spring, Ember, Bloom, Frost

// Where the crystal sequence stands after painting colour c at progress n: returns the new progress
export const nextStep = (n, c, order = ORDER) => (n < order.length && order[n] === c ? n + 1 : c === order[0] ? 1 : 0);

export class Vault {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.reactives = [];
    this.doors = [];
    this.o = new THREE.Vector3(VAULT.x, VAULT.y, VAULT.z);
    this.b = new Builder(this.root, this.o);
    this.spawn = this.b.w(0, 0.1, 2);
    this._shell();
    this._roomA();
    this._roomB();
    this._roomC();
    this._roomD();
    this._finale();
    this._spire(G.scene);
  }

  get open() { return !!G.flags.final; }
  inside(pos) { return Math.abs(pos.y - VAULT.y) < 40 && Math.abs(pos.x - VAULT.x) < 20 && pos.z > VAULT.z - 4 && pos.z < VAULT.z + 116; }

  // ------------------------------------------------------------ the spire in the lake
  _spire(scene) {
    const g = new THREE.Group();
    const x = LAKE.x, z = LAKE.z;
    g.position.set(x, 0, z);
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(7, 8.5, 1.4, 20), MAT.stone);
    isle.position.y = 0.2;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 16, 8), MAT.stoneDark);
    spire.position.set(0, 8.5, -3);
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xc8b8ff, emissiveIntensity: 0.8 }));
    crown.position.set(0, 18, -3);
    const door = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8b8ff).multiplyScalar(1.4), transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    door.position.set(0, 2.2, -0.8);
    g.add(isle, spire, crown, door);
    g.visible = false;
    scene.add(g);
    this.spire = g;
    this.crown = crown;
    this.isle = G.collision.addBox(x, 0.2, z, 12, 1.4, 12, { dynamic: true });
    this.isle.active = false;
    this.spireCol = G.collision.addCylinder(x, z - 3, 2, 0.9, 16.9, { dynamic: true });
    this.spireCol.active = false;
    G.world.interactables.push({
      pos: new THREE.Vector3(x, 2, z), radius: 4,
      enabled: () => this.open,
      prompt: () => (G.flags.vault_done ? 'Enter the Prism Vault (cleared)' : 'Enter the Prism Vault'),
      action: () => this.enter(),
    });
    G.world.interactables.push({ pos: this.b.w(0, 1, -0.8), radius: 2.6, prompt: 'Return to the lake', action: () => this.leave() });
    this.marker = G.hud.addMarker('<div class="ic" style="background:linear-gradient(90deg,#e8442e,#3a9ae8,#f2c229,#3fb54a)">◆</div>', () => new THREE.Vector3(x, 2, z), () => this.open && !G.flags.vault_done && !G.player.inDungeon && Math.hypot(G.player.pos.x - x, G.player.pos.z - z) < 500);
  }

  // ------------------------------------------------------------ helpers
  _reactive(r) { r.active = true; this.reactives.push(r); G.world.reactives.push(r); return r; }

  _door(z, flagFn, color = 0xc8b8ff) {
    const { mesh, col } = this.b.box(0, 0, z, 5, 6, 1, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3, flatShading: true }), { dynamic: true, tags: ['smooth', 'door'] });
    this.b.box(-6.75, -1, z, 8.5, 24, 1, MAT.dungeon);
    this.b.box(6.75, -1, z, 8.5, 24, 1, MAT.dungeon);
    this.b.box(0, 6, z, 5, 17, 1, MAT.dungeon);
    const d = { mesh, col, flagFn, baseY: mesh.position.y, open: false };
    this.doors.push(d);
    return d;
  }

  _brazier(key, x, y, z) {
    const b = this.b;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.8, 8), MAT.stoneDark);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 6), MAT.stoneDark);
    stand.position.copy(b.w(x, y + 0.7, z));
    bowl.position.copy(b.w(x, y + 1.8, z));
    this.root.add(bowl, stand);
    G.collision.addCylinder(this.o.x + x, this.o.z + z, 0.7, this.o.y + y, this.o.y + y + 2.2, { tags: ['smooth'] });
    const flame = new THREE.PointLight(0xff8a3a, 0, 14, 1.5);
    flame.position.copy(b.w(x, y + 3, z));
    this.root.add(flame);
    const pos = b.w(x, y + 2.2, z);
    const lit = () => G.flags.vault_a || (typeof G.flags[key] === 'number' && Date.now() - G.flags[key] < BRAZIER_WINDOW);
    this._reactive({
      pos, radius: 1.6, hitbox: 1.3,
      onPaint: (el) => { if (el === 'fire' && !G.flags.vault_a) { G.trials._setFlag(key, Date.now()); G.audio.play('switch'); } },
      tick: (dt) => {
        const on = lit();
        flame.intensity = on ? 25 + Math.random() * 6 : 0;
        if (on && Math.random() < dt * 30) G.particles.flames(pos, 0.5, 1, 1.2);
      },
    });
    return key;
  }

  _hint(text, z, color = '#e0d0ff') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshBasicMaterial({ map: textTexture(text, color), transparent: true }));
    m.position.copy(this.b.w(0, 7.5, z - 0.6));
    m.rotation.y = Math.PI;
    this.root.add(m);
  }

  // ------------------------------------------------------------ shell: long hall of five chambers
  _shell() {
    const b = this.b;
    b.box(-10.5, -14, 55, 1, 38, 116, MAT.dungeon);
    b.box(10.5, -14, 55, 1, 38, 116, MAT.dungeon);
    b.box(0, -14, -2.5, 22, 38, 1, MAT.dungeon);
    b.box(0, -14, 112.5, 22, 38, 1, MAT.dungeon);
    b.box(0, 23, 55, 22, 1, 116, MAT.dungeon, { shadow: false });
    for (let z = 10; z < 110; z += 24) b.light(0, 14, z, 0xe8e0ff, 26, 40);
    const portal = makePortal(0xc8b8ff, 1.3);
    portal.position.copy(b.w(0, 1.8, -1.7));
    this.root.add(portal);
    b.torch(-8, 0, 0, 0xc8b8ff);
    b.torch(8, 0, 0, 0xc8b8ff);
  }

  // A: freeze the pool, light both braziers together
  _roomA() {
    const b = this.b;
    b.box(0, -1, 2.5, 20, 1, 7, MAT.dungeonFloor);
    b.box(0, -8, 12, 20, 1, 12, MAT.dungeonFloor);
    b.box(0, -1, 21, 20, 1, 6, MAT.dungeonFloor);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), MAT.dungeonWater);
    water.rotation.x = -Math.PI / 2;
    water.position.copy(b.w(0, -0.4, 12));
    this.root.add(water);
    G.collision.water.push({ min: b.w(-10, -8, 6), max: b.w(10, 0, 18), level: this.o.y - 0.4, cold: true, active: true });
    this.brA = [this._brazier('vault_a0', -7, 0, 21), this._brazier('vault_a1', 7, 0, 21)];
    this._hint('Two flames, one moment', 24);
    this._door(24, () => !!G.flags.vault_a, COLORS[0].hex);
  }

  // B: bounce up the smooth ledge, vine up the moss, ring the bell
  _roomB() {
    const b = this.b;
    b.box(0, -1, 36, 20, 1, 24, MAT.dungeonFloor);
    const gold = new THREE.MeshLambertMaterial({ color: 0xc89a4a, flatShading: true });
    b.box(0, -1, 32, 20, 8, 4, gold); // smooth ledge z 30..34, top at 7
    b.box(0, -1, 37, 20, 16, 6, MAT.mossWall, { tags: ['mossy'] }); // mossy block z 34..40, top at 15
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshLambertMaterial({ color: 0xf2c229, emissive: 0x805a10, side: THREE.DoubleSide }));
    bell.position.copy(b.w(0, 17.2, 37));
    this.root.add(bell);
    const pos = b.w(0, 16.5, 37);
    this._reactive({
      pos, radius: 1.8, meleeOnly: true,
      onPaint: () => { if (!G.flags.vault_b) { G.trials._setFlag('vault_b'); G.audio.play('solve'); } },
      tick: () => { bell.rotation.z = G.flags.vault_b ? Math.sin(G.time * 6) * 0.2 : 0; },
    });
    this._hint('Leap, climb, ring', 48);
    this._door(48, () => !!G.flags.vault_b, COLORS[2].hex);
  }

  // C: burn the brambles, grow the bridge from the seed pod
  _roomC() {
    const b = this.b;
    b.box(0, -1, 55, 20, 1, 12, MAT.dungeonFloor); // z 49..61
    b.box(0, -14, 64.5, 20, 1, 7, MAT.dungeonFloor); // chasm floor z 61..68
    b.box(0, -1, 70, 20, 1, 4, MAT.dungeonFloor); // far side z 68..72
    G.collision.water.push({ min: b.w(-10, -13, 61), max: b.w(10, -6, 68), level: this.o.y - 6.5, cold: true, active: true });
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(20, 7), new THREE.MeshBasicMaterial({ color: 0x2a2a4a, transparent: true, opacity: 0.8 }));
    mist.rotation.x = -Math.PI / 2;
    mist.position.copy(b.w(0, -6.5, 64.5));
    this.root.add(mist);
    // Bramble wall across the room
    const g = new THREE.Group();
    for (let i = 0; i < 30; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.6 + Math.random() * 0.5, 0.12, 4, 8), MAT.bramble);
      t.position.set((Math.random() - 0.5) * 19, Math.random() * 6, (Math.random() - 0.5) * 0.6);
      t.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      g.add(t);
    }
    g.position.copy(b.w(0, 0, 56));
    this.root.add(g);
    const bcol = G.collision.addBox(this.o.x, this.o.y + 3, this.o.z + 56, 20, 6, 1, { dynamic: true, tags: ['bramble'] });
    const bpos = b.w(0, 3, 56);
    const burn = this._reactive({
      pos: bpos, radius: 6, hitbox: 1.5,
      onPaint: (el) => { if (el === 'fire' && !G.flags.vault_bramble) G.trials._setFlag('vault_bramble'); },
      tick: () => {
        if (!G.flags.vault_bramble || !g.visible) return;
        for (let i = 0; i < 40; i++) G.particles.flames(bpos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 5, 0)), 0.5, 1, 1.5);
        G.audio.play('fire');
        g.visible = false;
        bcol.active = false;
        burn.active = false;
      },
    });
    for (const x of [-6, 6]) this._reactive({ pos: b.w(x, 2, 56), radius: 4, hitbox: 1.2, onPaint: burn.onPaint });
    // Seed pod on the far side, and the bridge it grows
    const pod = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshLambertMaterial({ color: 0x6acb4a, emissive: 0x2a6a1a, flatShading: true }));
    pod.position.copy(b.w(0, 1.2, 69.5));
    this.root.add(pod);
    const planks = [];
    for (let i = 0; i < 8; i++) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.05), new THREE.MeshLambertMaterial({ color: 0x3f8a3a, flatShading: true }));
      pl.position.copy(b.w(0, -0.25, 61.5 + i));
      pl.visible = false;
      this.root.add(pl);
      planks.push(pl);
    }
    const bridge = G.collision.addBox(this.o.x, this.o.y - 0.25, this.o.z + 64.5, 3, 0.5, 8, { dynamic: true, tags: ['bridge'] });
    bridge.active = false;
    let grow = 0;
    this._reactive({
      pos: b.w(0, 1.2, 69.5), radius: 1.5, hitbox: 1.4,
      onPaint: (el) => { if (el === 'vine' && !G.flags.vault_c) { G.trials._setFlag('vault_c'); G.audio.play('vine'); } },
      tick: (dt) => {
        if (!G.flags.vault_c) { pod.scale.setScalar(1 + Math.sin(G.time * 3) * 0.1); return; }
        bridge.active = true;
        grow = Math.min(1, grow + dt * 1.5);
        planks.forEach((p, i) => { p.visible = grow * 8 > i; });
      },
    });
    this._hint('Burn, then bloom', 72);
    this._door(72, () => !!G.flags.vault_c, COLORS[3].hex);
  }

  // D: four crystals, painted in the mural's order
  _roomD() {
    const b = this.b;
    b.box(0, -1, 84, 20, 1, 24, MAT.dungeonFloor);
    // The mural: four coloured discs in order on the far wall
    ORDER.forEach((c, i) => {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS[c].hex).multiplyScalar(1.3) }));
      disc.position.copy(b.w(-4.5 + i * 3, 5, 95.4));
      disc.rotation.y = Math.PI;
      this.root.add(disc);
    });
    this.crystals = [[-7, 78], [7, 78], [-7, 90], [7, 90]].map(([x, z], i) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2, 8), MAT.stoneDark);
      pillar.position.copy(b.w(x, 1, z));
      const mat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a, emissive: 0x000000, flatShading: true });
      const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), mat);
      cry.scale.y = 1.5;
      cry.position.copy(b.w(x, 3.4, z));
      this.root.add(pillar, cry);
      G.collision.addCylinder(this.o.x + x, this.o.z + z, 0.8, this.o.y, this.o.y + 2);
      const r = { i, cry, mat, pos: b.w(x, 3.4, z) };
      this._reactive({
        pos: r.pos, radius: 1.4, hitbox: 1.2,
        onPaint: (el) => {
          if (G.flags.vault_d) return;
          const c = COLORS.findIndex((q) => q.element === el);
          if (c < 0) return;
          const prev = G.flags.vault_seq || 0;
          const n = nextStep(prev, c);
          G.trials._setFlag('vault_seq', n);
          G.trials._setFlag(`vault_cry${i}`, c);
          G.audio.play(n > prev ? 'switch' : 'hit');
          if (n >= ORDER.length) { G.trials._setFlag('vault_d'); G.audio.play('solve'); } else if (n === 0) G.hud.toast('The crystals dim. Follow the mural\'s order.', '#e0d0ff', 2);
        },
        tick: () => {
          const c = G.flags[`vault_cry${i}`];
          const on = typeof c === 'number' && (G.flags.vault_d || (G.flags.vault_seq || 0) > 0);
          r.mat.color.setHex(on ? COLORS[c].hex : 0x9a9a9a);
          r.mat.emissive.setHex(on ? COLORS[c].hex : 0x000000);
          r.cry.rotation.y += 0.01;
        },
      });
      return r;
    });
    this._door(96, () => !!G.flags.vault_d, 0xffffff);
  }

  _finale() {
    const b = this.b;
    b.box(0, -1, 104, 20, 1, 16, MAT.dungeonFloor);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.1), new THREE.MeshLambertMaterial({ color: 0xe8e0ff, emissive: 0x4a3a8a, emissiveIntensity: 0.4 }));
    body.position.y = 0.45;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1.2), new THREE.MeshLambertMaterial({ color: 0xffd84a, emissive: 0x805a10 }));
    lid.position.y = 1.05;
    g.add(body, lid);
    g.position.copy(b.w(0, 0, 106));
    this.root.add(g);
    this.lid = lid;
    G.collision.addBox(g.position.x, g.position.y + 0.5, g.position.z, 1.7, 1, 1.2);
    const pos = g.position.clone().setY(g.position.y + 1);
    G.world.interactables.push({
      pos, radius: 2.6, prompt: 'Open the Prism Vault chest',
      enabled: () => !G.flags.vault_done && !!G.flags.vault_d,
      action: () => {
        G.trials._setFlag('vault_done');
        G.player.pigment += VAULT_PIGMENT;
        G.audio.play('shard');
        G.hud.banner('The Prism Vault', `+${VAULT_PIGMENT} Pigment · the Prismatic glider is yours (pause menu > Wardrobe)`, '#e0d0ff');
        G.particles.burst(pos.clone().setY(pos.y + 1), { count: 120, color: 0xe0d0ff, speed: 10, life: 1.5, size: 0.6, pool: 'glow', gravity: 2 });
        G.game?.wardrobe?.render(false);
        G.honours?.event('vault');
      },
    });
  }

  // ------------------------------------------------------------ enter / leave
  enter() {
    const p = G.player;
    p.state = 'air';
    p.pos.copy(this.spawn);
    p.vel.set(0, 0, 0);
    p.checkpoint.copy(this.spawn);
    p.lastSafe.copy(this.spawn);
    p.camYaw = Math.PI;
    p.yaw = 0;
    p.camPos.copy(this.spawn).add(new THREE.Vector3(0, 3, -5));
    G.audio.play('waypoint');
    G.audio.mood = 'dungeon';
    G.hud.banner('The Prism Vault', 'Every colour, together', '#e0d0ff');
  }

  leave() {
    const p = G.player;
    p.pos.set(LAKE.x + 4, 1.5, LAKE.z + 4);
    p.vel.set(0, 0, 0);
    p.state = 'air';
    p.checkpoint.copy(p.pos);
    p.lastSafe.copy(p.pos);
    p.camPos.copy(p.pos).add(new THREE.Vector3(0, 3, 6));
    G.audio.mood = 'explore';
    G.audio.play('waypoint');
  }

  mapMarkers(add) {
    if (this.open) add(LAKE.x, LAKE.z, 'mq', '#c8b8ff', `Prism Vault${G.flags.vault_done ? ' (cleared)' : ''}`);
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    const open = this.open;
    this.spire.visible = open && !p.inDungeon;
    this.isle.active = this.spireCol.active = open;
    if (open) this.crown.rotation.y += dt * 0.6;
    for (const r of this.reactives) r.tick?.(dt);
    // Room A: both braziers burning at once
    if (!G.flags.vault_a && this.brA.every((k) => typeof G.flags[k] === 'number' && Date.now() - G.flags[k] < BRAZIER_WINDOW)) G.trials._setFlag('vault_a');
    for (const d of this.doors) {
      const want = d.flagFn();
      if (want && !d.open) { d.open = true; if (this.inside(p.pos)) { G.audio.play('door'); G.hud.toast('A door rumbles open...', '#ffffff', 2); } }
      const target = d.open ? d.baseY - 6.2 : d.baseY;
      d.mesh.position.y += (target - d.mesh.position.y) * Math.min(1, dt * 1.5);
      d.col.active = d.mesh.position.y > d.baseY - 5.5;
    }
    this.lid.rotation.x = G.flags.vault_done ? -0.9 : 0;
    this.lid.position.z = G.flags.vault_done ? -0.4 : 0;
  }
}

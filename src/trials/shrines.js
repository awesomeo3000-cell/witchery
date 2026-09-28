// Paint Shrines: three small single-room puzzles hidden around the island, each mixing two colours.
// A stone arch on the surface leads down to the shrine; solving it opens a chest with a Paint Sprite
// and a pouch of Pigment. Progress is kept in shared flags so friends can solve them together.
import * as THREE from 'three';
import { G, COLORS, DUNGEON_Y } from '../core/ctx.js';
import { MAT } from '../world/props.js';
import { puzzleSites } from '../world/puzzles.js';
import { Builder, textTexture } from './trials.js';
import { mergeStatic } from '../world/merge.js';

export const SHRINE_PIGMENT = 15;
export const BRAZIER_WINDOW = 12000; // ms each shrine brazier stays lit
export const SHRINES = [
  { name: 'Shrine of Crossing', hint: 'Cross the cold, then melt the wall', colors: [1, 0] },
  { name: 'Shrine of Heights', hint: 'Leap the smooth stone, climb the moss', colors: [2, 3] },
  { name: 'Shrine of Haste', hint: 'Three flames, burning at once', colors: [0, 0] },
];

// Every brazier in the haste shrine is lit at the same moment
export const allLit = (stamps, now = Date.now(), win = BRAZIER_WINDOW) => stamps.length > 0 && stamps.every((t) => typeof t === 'number' && now - t < win);

export class Shrines {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.surface = new THREE.Group();
    G.scene.add(this.surface);
    this.reactives = [];
    const taken = [
      ...(G.puzzles ? G.puzzles.list.map((p) => ({ x: p.pos.x, z: p.pos.z })) : []),
      ...(G.tablets ? G.tablets.items.map((t) => ({ x: t.pos.x, z: t.pos.z })) : []),
    ];
    const sites = puzzleSites(G.terrain, SHRINES.length, 9191, taken);
    this.list = sites.map((s, i) => this._build(i, s));
    mergeStatic(this.surface);
    if (G.sprites) G.sprites.total += this.list.length;
  }

  cleared(i) { return !!G.flags[`sprite_shrine_${i}`]; }
  clearedCount() { return this.list.filter((s) => this.cleared(s.i)).length; }

  _build(i, site) {
    const def = SHRINES[i];
    const o = new THREE.Vector3(site.x, DUNGEON_Y - 460 - i * 40, site.z);
    const b = new Builder(this.root, o);
    const s = { i, def, site, b, origin: o, spawn: b.w(0, 0.1, 1), surface: new THREE.Vector3(site.x, site.y, site.z) };
    this._arch(s);
    this._room(s);
    if (i === 0) this._crossing(s);
    if (i === 1) this._heights(s);
    if (i === 2) this._haste(s);
    return s;
  }

  // ---------------------------------------------------------------- surface entrance
  _arch(s) {
    const { x, y, z } = s.site;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = (s.i * 1.9) % (Math.PI * 2);
    const col = COLORS[s.def.colors[0]].hex, col2 = COLORS[s.def.colors[1]].hex;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.4, 12), MAT.stone);
    base.position.y = 0.1;
    base.receiveShadow = true;
    g.add(base);
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 8), MAT.stoneDark);
      pillar.position.set(sx * 2.2, 2.1, 0);
      pillar.castShadow = true;
      g.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.32, 8, 20, Math.PI), MAT.stoneDark);
    lintel.position.y = 4.1;
    lintel.castShadow = true;
    g.add(lintel);
    // Swirling paint in the doorway: the shrine's two colours
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).lerp(new THREE.Color(col2), 0.5).multiplyScalar(1.3), transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    swirl.position.y = 2.4;
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.5) }));
    orb.position.y = 4.9;
    // A faint beam of light marks shrines you haven't cleared yet (gold once cleared)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 70, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.4), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 40;
    swirl.userData.keep = orb.userData.keep = beam.userData.keep = true;
    g.add(swirl, orb, beam);
    this.surface.add(g);
    for (const sx of [-1, 1]) {
      const px = x + Math.cos(g.rotation.y) * sx * 2.2, pz = z - Math.sin(g.rotation.y) * sx * 2.2;
      G.collision.addCylinder(px, pz, 0.5, y, y + 4.2);
    }
    s.swirl = swirl;
    s.orb = orb;
    s.beam = beam;
    G.world.interactables.push({
      pos: new THREE.Vector3(x, y + 1.2, z), radius: 3.4,
      prompt: () => `Enter the ${s.def.name}${this.cleared(s.i) ? ' (cleared)' : ''}`,
      action: () => this.enter(s),
    });
    s.marker = G.hud.addMarker(`<div class="ic" style="background:${COLORS[s.def.colors[0]].css}">⛩</div>`, () => s.surface, () => !G.player.inDungeon && !this.cleared(s.i) && s.surface.distanceTo(G.player.pos) < 220);
  }

  // ---------------------------------------------------------------- shared room shell
  _room(s) {
    const b = s.b;
    const H = 24;
    b.box(-9.5, -9, 16, 1, H + 8, 38, MAT.dungeon);
    b.box(9.5, -9, 16, 1, H + 8, 38, MAT.dungeon);
    b.box(0, -9, -2.5, 20, H + 8, 1, MAT.dungeon);
    b.box(0, -9, 34.5, 20, H + 8, 1, MAT.dungeon);
    b.box(0, H - 1, 16, 20, 1, 38, MAT.dungeon, { shadow: false });
    const c = COLORS[s.def.colors[0]].hex;
    b.torch(-7, 0, 0, c);
    b.torch(7, 0, 0, c);
    b.light(0, 12, 8, 0xfff0dc, 30, 50);
    b.light(0, 12, 26, COLORS[s.def.colors[1]].hex, 26, 44);
    const portal = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.18, 8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.3) }));
    portal.position.copy(b.w(0, 1.8, -1.7));
    this.root.add(portal);
    G.world.interactables.push({ pos: b.w(0, 1, -0.8), radius: 2.6, prompt: 'Leave the shrine', action: () => this.leave(s) });
    const hint = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshBasicMaterial({ map: textTexture(s.def.hint, COLORS[s.def.colors[1]].light), transparent: true }));
    hint.position.copy(b.w(0, 9, 33.9));
    hint.rotation.y = Math.PI;
    this.root.add(hint);
  }

  _reactive(r) {
    r.active = true;
    this.reactives.push(r);
    G.world.reactives.push(r);
    return r;
  }

  _chest(s, x, y, z, ready = () => true) {
    const b = s.b;
    const flag = `sprite_shrine_${s.i}`;
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x6a4a2a, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.85), wood);
    body.position.y = 0.38;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.12, 0.89), new THREE.MeshLambertMaterial({ color: 0xffd84a, emissive: 0x806010, emissiveIntensity: 0.5 }));
    trim.position.y = 0.6;
    const lid = new THREE.Group();
    lid.position.set(0, 0.75, -0.42);
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 10, 1, false, 0, Math.PI), wood);
    lidM.rotation.z = Math.PI / 2;
    lidM.position.z = 0.42;
    lid.add(lidM);
    g.add(body, trim, lid);
    g.position.copy(b.w(x, y, z));
    g.rotation.y = Math.PI;
    this.root.add(g);
    G.collision.addBox(g.position.x, g.position.y + 0.38, g.position.z, 1.3, 0.75, 0.9);
    const pos = g.position.clone();
    this._reactive({ pos, radius: 0.1, onPaint: () => {}, tick: (dt) => { lid.rotation.x += ((G.flags[flag] ? -1.9 : 0) - lid.rotation.x) * Math.min(1, dt * 4); } });
    G.world.interactables.push({
      pos: pos.clone().setY(pos.y + 0.6), radius: 2.4, prompt: 'Open the shrine chest',
      enabled: () => !G.flags[flag] && ready(),
      action: () => this.open(s, pos),
    });
  }

  open(s, pos) {
    const flag = `sprite_shrine_${s.i}`;
    if (G.flags[flag]) return;
    G.trials._setFlag(flag);
    G.player.pigment += SHRINE_PIGMENT;
    G.sprites?._pop(pos.clone().setY(pos.y + 1.2));
    G.audio.play('sprite');
    G.audio.play('solve');
    G.hud.banner(`${s.def.name} cleared`, `A Paint Sprite and ${SHRINE_PIGMENT} Pigment · ${this.clearedCount()} / ${this.list.length} shrines`, '#ffe08a');
  }

  // ---------------------------------------------------------------- 0: freeze the pool, melt the wall
  _crossing(s) {
    const b = s.b;
    b.box(0, -1, 3, 18, 1, 10, MAT.dungeonFloor);
    b.box(0, -8, 16, 18, 1, 16, MAT.dungeonFloor);
    b.box(0, -1, 29, 18, 1, 10, MAT.dungeonFloor);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), MAT.dungeonWater);
    water.rotation.x = -Math.PI / 2;
    water.position.copy(b.w(0, -0.4, 16));
    this.root.add(water);
    G.collision.water.push({ min: b.w(-9, -8, 8), max: b.w(9, 0, 24), level: s.origin.y - 0.4, cold: true, active: true });
    for (let k = 0; k < 14; k++) {
      const ic = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2 + Math.random() * 2, 5), MAT.ice);
      ic.rotation.x = Math.PI;
      ic.position.copy(b.w((Math.random() - 0.5) * 17, 22.5, 4 + Math.random() * 28));
      this.root.add(ic);
    }
    // A wall of ice seals the far bank
    const { mesh, col } = b.box(0, 0, 27, 18, 22, 1.4, MAT.ice, { dynamic: true, tags: ['smooth'] });
    const flag = 'shrine_0_ice';
    const pos = b.w(0, 1.8, 27);
    const r = this._reactive({
      pos, radius: 3.5, hitbox: 1.2,
      onPaint: (el) => { if (el === 'fire' && !G.flags[flag]) G.trials._setFlag(flag); },
      tick: () => {
        if (!G.flags[flag] || !mesh.visible) return;
        mesh.visible = false;
        col.active = false;
        r.active = false;
        for (let k = 0; k < 5; k++) G.particles.burst(b.w(-7 + k * 3.5, 2, 27), { count: 16, color: 0xcdefff, speed: 5, life: 0.8, size: 0.5 });
        G.particles.burst(pos, { count: 20, color: 0xdddddd, speed: 3, up: 3, life: 1.4, size: 1, gravity: -1, alpha: 0.5 });
        G.audio.play('ice');
      },
    });
    // The whole wall melts from a hit anywhere low along it (it reaches the ceiling, so no bouncing over)
    for (const [x, y] of [[-6, 1.8], [6, 1.8], [-6, 5.5], [0, 5.5], [6, 5.5]]) this._reactive({ pos: b.w(x, y, 27), radius: 3.5, hitbox: 1.2, onPaint: r.onPaint });
    this._chest(s, 0, 0, 31, () => !!G.flags[flag]);
  }

  // ---------------------------------------------------------------- 1: bounce up, then climb
  _heights(s) {
    const b = s.b;
    b.box(0, -1, 16, 18, 1, 36, MAT.dungeonFloor);
    const gold = new THREE.MeshLambertMaterial({ color: 0xc89a4a, flatShading: true });
    // Smooth ledge: too tall to jump or climb (paint a bounce pad at its foot)
    b.box(0, -1, 20, 18, 8, 6, gold);
    // Mossy cliff above it, too tall to bounce up from the ledge: grow vines to climb
    b.box(0, -1, 28.5, 18, 20, 11, MAT.mossWall, { tags: ['mossy'] });
    for (let k = 0; k < 10; k++) {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5 + Math.random() * 3, 4), this.vineMat || (this.vineMat = new THREE.MeshLambertMaterial({ color: 0x3f7a35 })));
      v.position.copy(b.w(-8 + Math.random() * 16, 17, 22.8));
      this.root.add(v);
    }
    this._chest(s, 0, 19, 29);
  }

  // ---------------------------------------------------------------- 2: three braziers at once
  _haste(s) {
    const b = s.b;
    b.box(0, -1, 16, 18, 1, 36, MAT.dungeonFloor);
    // Gate across the room guarding the chest
    b.box(-6, -1, 25, 6, 24, 1, MAT.dungeon);
    b.box(6, -1, 25, 6, 24, 1, MAT.dungeon);
    b.box(0, 6, 25, 6, 17, 1, MAT.dungeon);
    const gate = b.box(0, 0, 25, 6, 6, 1, new THREE.MeshLambertMaterial({ color: COLORS[0].hex, emissive: COLORS[0].hex, emissiveIntensity: 0.3, flatShading: true }), { dynamic: true, tags: ['smooth', 'door'] });
    s.gate = { ...gate, baseY: gate.mesh.position.y };
    // Braziers: one on the floor, one on a tall pillar, one tucked behind a pillar
    b.box(6, -1, 15, 2.6, 7, 2.6, MAT.dungeon);
    b.box(-3.5, -1, 20, 1.6, 10, 1.6, MAT.dungeon);
    s.braziers = [[-6, 0, 7], [6, 6, 15], [-6.5, 0, 21]].map(([x, y, z], k) => this._brazier(s, k, x, y, z));
    this._chest(s, 0, 0, 30);
  }

  _brazier(s, k, x, y, z) {
    const b = s.b;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.8, 8), MAT.stoneDark);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 6), MAT.stoneDark);
    stand.position.copy(b.w(x, y + 0.7, z));
    bowl.position.copy(b.w(x, y + 1.8, z));
    this.root.add(bowl, stand);
    G.collision.addCylinder(s.origin.x + x, s.origin.z + z, 0.7, s.origin.y + y, s.origin.y + y + 2.2, { tags: ['smooth'] });
    const flag = `shrine_2_b${k}`;
    const flame = new THREE.PointLight(0xff8a3a, 0, 14, 1.5);
    flame.position.copy(b.w(x, y + 3, z));
    this.root.add(flame);
    const pos = b.w(x, y + 2.2, z);
    const lit = () => typeof G.flags[flag] === 'number' && Date.now() - G.flags[flag] < BRAZIER_WINDOW;
    this._reactive({
      pos, radius: 1.6, hitbox: 1.3,
      onPaint: (el) => {
        if (el !== 'fire' || G.flags.shrine_2_open) return;
        G.trials._setFlag(flag, Date.now());
        G.audio.play('switch');
      },
      tick: (dt) => {
        const on = G.flags.shrine_2_open || lit();
        // Guttering as the time runs out
        const left = typeof G.flags[flag] === 'number' ? 1 - (Date.now() - G.flags[flag]) / BRAZIER_WINDOW : 0;
        flame.intensity = on ? (G.flags.shrine_2_open || left > 0.25 ? 25 : 10 + Math.random() * 14) + Math.random() * 6 : 0;
        if (on && Math.random() < dt * 30) G.particles.flames(pos, 0.5, 1, 1.2);
      },
    });
    return flag;
  }

  // ---------------------------------------------------------------- enter / leave
  enter(s) {
    if (!G.flags[`shrine_seen_${s.i}`]) G.trials._setFlag(`shrine_seen_${s.i}`);
    const p = G.player;
    p.state = 'air';
    p.pos.copy(s.spawn);
    p.vel.set(0, 0, 0);
    p.checkpoint.copy(s.spawn);
    p.lastSafe.copy(s.spawn);
    p.camYaw = Math.PI;
    p.yaw = 0;
    p.camPos.copy(s.spawn).add(new THREE.Vector3(0, 3, -5));
    G.audio.play('waypoint');
    G.audio.mood = 'dungeon';
    G.hud.banner(s.def.name, s.def.hint, COLORS[s.def.colors[0]].css);
    // First visit: a slow look across the room to show the puzzle
    const id = `shrine_${s.i}`;
    if (G.cine && !G.cine.seen.has(id) && !G.settings.reduceMotion) {
      G.cine.seen.add(id);
      G.cine.focus({ pos: s.b.w(0, 0, 18), radius: 3.2, height: 7, alive: true }, null, null, 2.6);
    }
  }

  leave(s) {
    const p = G.player;
    const { x, z } = s.site;
    const px = x + 4, pz = z + 4;
    p.pos.set(px, G.terrain.heightAt(px, pz) + 0.5, pz);
    p.vel.set(0, 0, 0);
    p.state = 'air';
    p.checkpoint.copy(p.pos);
    p.lastSafe.copy(p.pos);
    p.camPos.copy(p.pos).add(new THREE.Vector3(5, 3, 5));
    G.audio.mood = 'explore';
    G.audio.play('waypoint');
  }

  mapMarkers(add) {
    // Shrines you've been inside are fast-travel points
    for (const s of this.list) {
      const ft = !!G.flags[`shrine_seen_${s.i}`];
      add(s.site.x, s.site.z, `mq${ft ? ' ft' : ''}`, this.cleared(s.i) ? '#b8a878' : COLORS[s.def.colors[0]].css, `${s.def.name}${this.cleared(s.i) ? ' (cleared)' : ''}`, ft ? () => G.game.fastTravel({ x: s.site.x + 7, z: s.site.z + 4 }) : null);
    }
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.surface.visible = !p.inDungeon;
    for (const s of this.list) {
      s.swirl.rotation.z += dt * 0.8;
      s.swirl.material.opacity = this.cleared(s.i) ? 0.2 : 0.5 + Math.sin(G.time * 2 + s.i) * 0.1;
      s.orb.position.y = 4.9 + Math.sin(G.time * 1.5 + s.i) * 0.15;
      const done = this.cleared(s.i);
      if (done !== s.wasCleared) {
        s.wasCleared = done;
        s.orb.material.color.setHex(done ? 0xffd84a : COLORS[s.def.colors[0]].hex).multiplyScalar(1.5);
        s.beam.material.color.setHex(done ? 0xffd84a : COLORS[s.def.colors[0]].hex).multiplyScalar(1.4);
        s.beam.material.opacity = done ? 0.07 : 0.16;
      }
    }
    for (const r of this.reactives) r.tick?.(dt);
    // Haste shrine: all three braziers burning together opens the gate for good
    const h = this.list[2];
    if (h) {
      if (!G.flags.shrine_2_open && allLit(h.braziers.map((f) => G.flags[f]))) {
        G.trials._setFlag('shrine_2_open');
        if (p.pos.distanceTo(h.origin) < 60) { G.audio.play('door'); G.audio.play('solve'); G.hud.toast('The gate rumbles open...', '#ffffff', 2); }
      }
      const g = h.gate;
      const target = G.flags.shrine_2_open ? g.baseY - 6.2 : g.baseY;
      g.mesh.position.y += (target - g.mesh.position.y) * Math.min(1, dt * 1.5);
      g.col.active = g.mesh.position.y > g.baseY - 5.5;
      // Show the countdown while inside
      if (!G.flags.shrine_2_open && p.pos.distanceTo(h.origin.clone().setZ(h.origin.z + 16)) < 30) {
        const lit = h.braziers.filter((f) => typeof G.flags[f] === 'number' && Date.now() - G.flags[f] < BRAZIER_WINDOW).length;
        G.hud.setRush?.(lit ? `${lit} / 3 flames burning` : 'Light all three flames together', 'Shrine of Haste');
        this._rush = true;
      } else if (this._rush) { this._rush = false; G.hud.setRush?.(null); }
    }
  }
}

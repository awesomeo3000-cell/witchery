// Enemies, bosses, their projectiles/shockwaves and loot. The host simulates; everyone renders.
import * as THREE from 'three';
import { G, COLORS, COUNTER, inDungeonY } from '../core/ctx.js';
import { damp, dampAngle, mulberry32 } from '../core/math.js';
import {
  buildBounder, buildInkling, buildSpitter, buildWisp, buildInkbat, buildDummy, buildFrostmaw, buildMagmaw,
  buildShellback, buildGalewing, buildHueless, buildArcher, buildBlotGiant, buildSentinel, VARIANT_TINT,
} from './models.js';
import { fmtTime } from '../world/races.js';
import { STAR_PIGMENT } from '../world/stars.js';
import { smoothRockGeometry } from '../world/props.js';
import { CampDecor } from './camps.js';
import { VILLAGE, TRIALS, CITADEL } from '../world/layout.js';

export const TYPES = {
  bounder: { name: 'Bounder', hp: 32, speed: 4.2, aggro: 24, build: buildBounder },
  inkling: { name: 'Inkling', hp: 20, speed: 4.5, aggro: 20, build: buildInkling },
  spitter: { name: 'Spitter', hp: 26, speed: 0, aggro: 28, build: buildSpitter, static: true },
  wisp: { name: 'Ink Wisp', hp: 16, speed: 8, aggro: 34, build: buildWisp, fly: true },
  archer: { name: 'Inkshot', hp: 24, speed: 0, aggro: 44, build: buildArcher, static: true },
  frostmaw: { name: 'Frostmaw', hp: 240, speed: 3.2, aggro: 60, build: buildFrostmaw, boss: true },
  magmaw: { name: 'Magmaw', hp: 240, speed: 3.6, aggro: 60, build: buildMagmaw, boss: true },
  shellback: { name: 'Shellback', hp: 220, speed: 3.4, aggro: 60, build: buildShellback, boss: true },
  galewing: { name: 'Galewing', hp: 200, speed: 6, aggro: 60, build: buildGalewing, boss: true, fly: true },
  hueless: { name: 'The Hueless King', hp: 700, speed: 2.5, aggro: 90, build: buildHueless, boss: true },
  blotgiant: { name: 'Blot Giant', hp: 360, speed: 2.6, aggro: 45, build: buildBlotGiant, boss: true, field: true },
  sentinel: { name: 'Stone Sentinel', hp: 300, speed: 1.8, aggro: 40, build: () => buildSentinel(smoothRockGeometry), boss: true, field: true },
  dummy: { name: 'Practice Dummy', hp: 200, speed: 0, aggro: 0, build: buildDummy, static: true },
  inkbat: { name: 'Inkbat', hp: 7, speed: 13, aggro: 60, build: buildInkbat, fly: true },
};
const TYPE_KEYS = Object.keys(TYPES);
const VARIANTS = ['none', 'fire', 'ice'];
const STATES = ['idle', 'chase', 'windup', 'attack', 'recover', 'stun', 'dead', 'fly', 'slam', 'shoot', 'roll', 'dive', 'summon', 'sleep', 'dormant', 'wake'];
const ELEMENTS = ['fire', 'ice', 'bounce', 'vine'];

const tmpV = new THREE.Vector3();

class Enemy {
  constructor(id, type, variant, pos) {
    this.id = id;
    this.type = type;
    this.def = TYPES[type];
    this.variant = variant;
    this.pos = pos.clone();
    this.home = pos.clone();
    this.netPos = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.netYaw = this.yaw;
    this.maxHp = this.def.hp;
    this.hp = this.maxHp;
    this.state = 'idle';
    this.stateT = 0;
    this.alive = true;
    this.cool = 1 + Math.random() * 2;
    this.status = { burn: 0, frozen: 0, rooted: 0, stun: 0, chill: 0, rootImmune: 0 };
    this.burnTick = 0;
    this.hitFlash = 0;
    this.lastHit = -100;
    this.model = this.def.build(VARIANT_TINT[variant]);
    this.height = this.model.height;
    this.radius = this.model.radius;
    this.group = this.model.group;
    this.group.position.copy(pos);
    G.scene.add(this.group);
    this.mats = [];
    this.group.traverse((m) => { if (m.isMesh && m.material.emissive) this.mats.push({ m: m.material, base: m.material.emissive.clone() }); });
    this.boss = !!this.def.boss;
    // boss-specific
    this.armor = 0; this.maxArmor = 0;
    this.meter = 0; // freeze / flip meter
    this.shield = 0; // element index for hueless
    this.shieldHp = 0;
    this.phase = 1;
    this.anim = 0;
    this.grounded = false;
    this.target = null;
    if (type === 'frostmaw') { this.armor = this.maxArmor = 50; }
    if (type === 'hueless') { this.shield = 0; this.shieldHp = 3; }
    this.name = (variant === 'fire' ? 'Cinder ' : variant === 'ice' ? 'Frost ' : '') + this.def.name;
    this._buildStatusFx();
  }

  _buildStatusFx() {
    const s = Math.max(this.radius * 1.4, 1.2);
    this.iceBlock = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, this.height * 1.05, s * 1.5), new THREE.MeshLambertMaterial({ color: 0xcdefff, transparent: true, opacity: 0.55, emissive: 0x3070a0, emissiveIntensity: 0.3 }));
    this.iceBlock.position.y = this.height / 2;
    this.iceBlock.visible = false;
    this.group.add(this.iceBlock);
    this.vineWrap = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(this.radius * 1.05, 0.1, 4, 12), new THREE.MeshLambertMaterial({ color: 0x3f9a3a }));
      t.rotation.x = Math.PI / 2 + (i - 1) * 0.3;
      t.position.y = this.height * (0.2 + i * 0.25);
      this.vineWrap.add(t);
    }
    this.vineWrap.visible = false;
    this.group.add(this.vineWrap);
  }

  // Bigger, tougher camp leaders
  makeElite() {
    if (this.elite) return;
    this.elite = true;
    this.maxHp = this.hp = Math.round(this.def.hp * 2.6);
    this.group.scale.setScalar(1.5);
    this.baseScale = 1.5;
    this.radius *= 1.5;
    this.height *= 1.5;
    this.dmgMul = 1.5;
    this.name = `Great ${this.name}`;
  }

  get center() { return tmpV.copy(this.pos).setY(this.pos.y + this.height * 0.5); }

  dispose() {
    G.scene.remove(this.group);
    this.group.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
  }
}

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.byId = new Map();
    this.nextId = 1;
    this.projectiles = [];
    this.waves = [];
    this.pickups = [];
    this.camps = this._makeCamps();
    this.decor = new CampDecor(scene, this.camps);
    this.syncTimer = 0;
    this._hintTime = 0;
    this.bossActive = null;
    this.ringGeo = new THREE.TorusGeometry(1, 0.35, 6, 48);
    this.ringGeo.rotateX(Math.PI / 2);
    this.projMats = {
      ink: new THREE.MeshBasicMaterial({ color: 0x5a2a7a }),
      ice: new THREE.MeshLambertMaterial({ color: 0xcdefff, emissive: 0x3a7ab0, flatShading: true }),
      fire: new THREE.MeshBasicMaterial({ color: 0xff7a2a }),
      feather: new THREE.MeshLambertMaterial({ color: 0x9ab8d8, flatShading: true }),
      rock: new THREE.MeshLambertMaterial({ color: 0xa07a40, flatShading: true }),
      rain: new THREE.MeshBasicMaterial({ color: 0x3a2a4a }),
      arrow: new THREE.MeshBasicMaterial({ color: 0x2a2433 }),
    };
    this.projGeo = {
      ink: new THREE.IcosahedronGeometry(0.35, 1), ice: new THREE.DodecahedronGeometry(1.1, 0), fire: new THREE.IcosahedronGeometry(0.6, 1),
      feather: new THREE.ConeGeometry(0.2, 1.2, 4).rotateX(Math.PI / 2), rock: new THREE.DodecahedronGeometry(0.9, 0), rain: new THREE.IcosahedronGeometry(0.5, 1),
      arrow: new THREE.CylinderGeometry(0.05, 0.12, 1.4, 5).rotateX(Math.PI / 2),
    };
    this.heartGeo = (() => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.35);
      s.bezierCurveTo(-0.5, 0, -0.45, 0.35, -0.22, 0.35);
      s.bezierCurveTo(-0.08, 0.35, 0, 0.25, 0, 0.18);
      s.bezierCurveTo(0, 0.25, 0.08, 0.35, 0.22, 0.35);
      s.bezierCurveTo(0.45, 0.35, 0.5, 0, 0, -0.35);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
      g.center();
      return g;
    })();
  }

  get isHost() { return !G.net || G.net.isHost; }

  _makeCamps() {
    const rand = mulberry32(1234);
    const camps = [];
    for (let i = 0; i < 3000 && camps.length < 28; i++) {
      const a = rand() * Math.PI * 2, d = 110 + rand() * 520;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = G.terrain.heightAt(x, z);
      if (h < 3 || h > 90) continue;
      if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 120) continue;
      if (TRIALS.some((t) => Math.hypot(x - t.x, z - t.z) < 45)) continue;
      if (camps.some((c) => Math.hypot(c.x - x, c.z - z) < 70)) continue;
      // Camps need fairly level ground for tents and the lookout
      let bumpy = false;
      for (let k = 0; k < 8 && !bumpy; k++) {
        const a2 = (k / 8) * Math.PI * 2;
        if (Math.abs(G.terrain.heightAt(x + Math.cos(a2) * 12, z + Math.sin(a2) * 12) - h) > 2.5) bumpy = true;
      }
      if (bumpy) continue;
      const w = G.terrain.biome(x, z);
      const variant = w.ember > 0.45 ? 'fire' : w.frost > 0.45 ? 'ice' : 'none';
      const roll = rand();
      let types;
      if (roll < 0.35) types = ['bounder', 'bounder', 'inkling'];
      else if (roll < 0.6) types = ['inkling', 'inkling', 'inkling', 'spitter'];
      else if (roll < 0.8) types = ['bounder', 'spitter', 'inkling'];
      else types = ['bounder', 'bounder', 'bounder'];
      const tower = rand() < 0.45;
      const ta = rand() * Math.PI * 2;
      const towerPos = new THREE.Vector3(x + Math.cos(ta) * 11, 0, z + Math.sin(ta) * 11);
      towerPos.y = G.terrain.heightAt(towerPos.x, towerPos.z) + 6.5;
      if (tower) types = [...types, 'archer'];
      camps.push({ id: camps.length, x, z, variant, types, active: false, members: [], respawn: 0, tower, towerPos, elite: rand() < 0.35 });
    }
    // Field bosses in fixed, open spots
    const fieldSpots = [['blotgiant', -120, 250], ['blotgiant', 230, -150], ['sentinel', 250, 330], ['sentinel', 60, -330]];
    for (const [type, fx, fz] of fieldSpots) {
      let bx = fx, bz = fz;
      for (let k = 0; k < 40 && G.terrain.heightAt(bx, bz) < 4; k++) { bx *= 0.95; bz *= 0.95; }
      camps.push({ id: camps.length, x: bx, z: bz, variant: 'none', types: [type], active: false, members: [], respawn: 0, field: true });
    }
    // Wisps guarding the sky around the citadel
    camps.push({ id: camps.length, x: CITADEL.x + 120, z: CITADEL.z, y: 150, variant: 'none', types: ['wisp', 'wisp', 'wisp'], active: false, members: [], respawn: 0, sky: true });
    camps.push({ id: camps.length, x: CITADEL.x - 120, z: CITADEL.z + 60, y: 170, variant: 'none', types: ['wisp', 'wisp'], active: false, members: [], respawn: 0, sky: true });
    return camps;
  }

  players() {
    const out = [];
    const p = G.player;
    if (p) out.push({ id: G.net?.id ?? 'local', pos: p.pos, alive: p.alive, local: true, state: p.state, sneak: !!p.sneaking });
    if (G.peers) for (const peer of G.peers.values()) out.push({ id: peer.id, pos: peer.pos, alive: peer.state !== 'dead', local: false, state: peer.state, sneak: peer.state === 'sneak' });
    return out;
  }

  spawn(type, pos, opts = {}) {
    const e = new Enemy(opts.id ?? this.nextId++, type, opts.variant || 'none', pos);
    if (opts.arena) e.arena = opts.arena;
    if (opts.trial) e.trial = opts.trial;
    if (opts.camp !== undefined) e.camp = opts.camp;
    if (opts.elite) e.makeElite();
    this.list.push(e);
    this.byId.set(e.id, e);
    if (e.boss && !e.def.field) {
      e.introT = 3.4; // host holds the boss still during its intro
      if (G.player && e.pos.distanceTo(G.player.pos) < 80 && G.cine) G.cine.bossIntro(e);
    }
    if (e.def.field) { e.state = e.type === 'blotgiant' ? 'sleep' : 'dormant'; e.weakCd = 0; }
    if (e.type === 'sentinel') e.collider = G.collision.addCylinder(pos.x, pos.z, 2.6, pos.y, pos.y + 6.2, { dynamic: true, tags: ['sentinel'] });
    return e;
  }

  // Three practice dummies in the village training yard
  _dummies() {
    if (this.list.some((e) => e.type === 'dummy')) return;
    for (let i = 0; i < 3; i++) {
      const x = VILLAGE.x - 32 + (i - 1) * 4.5, z = VILLAGE.z + 30 + Math.abs(i - 1) * 1.5;
      const e = this.spawn('dummy', new THREE.Vector3(x, G.terrain.heightAt(x, z), z), {});
      e.yaw = Math.PI * 0.85;
    }
  }

  // Flocks of Inkbats come out at night away from the village, and melt away at dawn
  _nightBats(dt) {
    const sky = G.sky;
    if (!sky) return;
    const bats = this.list.filter((e) => e.type === 'inkbat' && e.alive);
    if (sky.night < 0.3) {
      for (const b of bats) { this.fx('summon', b.pos); this.remove(b); }
      this.batT = 20;
      return;
    }
    for (const b of bats) if (!this.players().some((p) => p.pos.distanceTo(b.pos) < 220)) this.remove(b);
    this.batT = (this.batT ?? 20) - dt;
    if (this.batT > 0 || sky.night < 0.6) return;
    this.batT = 45 + Math.random() * 30;
    if (bats.length >= 8) return;
    const cand = this.players().filter((p) => p.alive && p.pos.y > -200 && Math.hypot(p.pos.x - VILLAGE.x, p.pos.z - VILLAGE.z) > VILLAGE.r + 20);
    if (!cand.length) return;
    const p = cand[Math.floor(Math.random() * cand.length)];
    const a = Math.random() * Math.PI * 2;
    const c = p.pos.clone().add(new THREE.Vector3(Math.cos(a) * 45, 0, Math.sin(a) * 45));
    c.y = Math.max(p.pos.y, G.terrain.heightAt(c.x, c.z)) + 14;
    const n = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const e = this.spawn('inkbat', c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 3, (Math.random() - 0.5) * 6)), {});
      e.cool = 2 + i * 0.7;
      this.fx('summon', e.pos);
    }
  }

  remove(e) {
    if (e.collider) G.collision.removeDynamic(e.collider);
    e.dispose();
    this.byId.delete(e.id);
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  clearAll() {
    for (const e of [...this.list]) this.remove(e);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const w of this.waves) this.scene.remove(w.mesh);
    for (const k of this.pickups) this.scene.remove(k.mesh);
    this.projectiles.length = this.waves.length = this.pickups.length = 0;
    for (const c of this.camps) { c.active = false; c.members = []; }
  }

  // ------------------------------------------------------------ queries
  rayHit(origin, dir, maxDist, pad = 0) {
    let best = null, bd = maxDist;
    for (const e of this.list) {
      if (!e.alive) continue;
      const c = e.center;
      const r = e.radius * 0.9 + pad + (e.boss ? 0.5 : 0.2);
      const L = c.clone().sub(origin);
      const tca = L.dot(dir);
      if (tca < 0) continue;
      const d2 = L.lengthSq() - tca * tca;
      const rr = Math.max(r, e.height * 0.45);
      if (d2 > rr * rr) continue;
      const t = tca - Math.sqrt(rr * rr - d2);
      if (t < bd) { bd = t; best = e; }
    }
    return best;
  }

  findLockTarget(pos, fwd, range) {
    let best = null, bs = -Infinity;
    for (const e of this.list) {
      if (!e.alive) continue;
      const d = e.pos.clone().sub(pos);
      const dist = d.length();
      if (dist > range) continue;
      d.y = 0;
      d.normalize();
      const score = d.dot(fwd) * 10 - dist * 0.3 + (e.boss ? 5 : 0);
      if (score > bs && d.dot(fwd) > -0.2) { bs = score; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------ damage
  computeHit(e, hit) {
    let dmg = hit.dmg;
    const el = hit.element;
    const res = { dmg: 0, blocked: false, hint: null, armor: 0, crit: false };
    if (!e.alive) return res;
    if (e.variant === 'fire' && el === 'fire') { res.blocked = true; res.hint = 'Immune to Ember!'; return res; }
    if (e.variant === 'ice' && el === 'ice') { res.blocked = true; res.hint = 'Immune to Frost!'; return res; }
    if ((e.variant === 'fire' && el === 'ice') || (e.variant === 'ice' && el === 'fire')) { dmg *= 2; res.crit = true; }
    switch (e.type) {
      case 'frostmaw':
        if (e.armor > 0) {
          if (el === 'fire') { res.armor = dmg * (hit.source === 'glob' ? 1.6 : 1.2); res.crit = true; return res; }
          res.blocked = true; res.hint = 'Its ice armour is too thick - melt it with Ember (red)!';
          return res;
        }
        break;
      case 'magmaw':
        if (e.status.frozen <= 0) {
          if (el === 'ice') { res.meter = hit.source === 'glob' ? 26 : 20; return res; }
          res.blocked = true; res.hint = 'Magmaw is white-hot! Cool it down with Frost (blue).';
          return res;
        }
        dmg *= 1.5; res.crit = true;
        break;
      case 'shellback':
        if (e.status.stun <= 0) {
          if (el === 'bounce') { res.meter = 50; return res; }
          res.blocked = true; res.hint = 'Its shell deflects you! Flip it over with Spring (yellow).';
          return res;
        }
        dmg *= 1.4; res.crit = true;
        break;
      case 'galewing':
        if (e.status.rooted <= 0) {
          if (el === 'vine') { res.meter = 100; return res; }
          dmg *= 0.3;
          if (!res.hint) res.hint = 'Galewing is too swift in the air! Tangle it with Bloom (green).';
        }
        break;
      case 'blotgiant': {
        // The eye is the weak spot: hits up high deal big damage and can topple it
        const high = hit.hy !== undefined && hit.hy > e.pos.y + e.height * 0.72;
        if (high) { dmg *= 2.5; res.crit = true; res.weak = true; }
        if (e.state === 'sleep') { dmg *= 1.5; res.crit = true; }
        break;
      }
      case 'sentinel': {
        const onTop = hit.hy !== undefined && hit.hy > e.pos.y + e.height * 0.7;
        if (!onTop && e.status.stun <= 0) { res.blocked = true; res.hint = 'Solid stone! Strike the glowing crystal on its back (bounce or glide on top).'; return res; }
        dmg *= 1.6; res.crit = true;
        break;
      }
      case 'hueless': {
        if (e.shieldHp > 0) {
          const need = COUNTER[ELEMENTS[e.shield]];
          if (el === need) { res.shieldHit = true; return res; }
          res.blocked = true;
          const ci = ELEMENTS.indexOf(need);
          res.hint = `The ${COLORS[e.shield].name} shield holds! Strike it with ${COLORS[ci].name}.`;
          return res;
        }
        break;
      }
      default:
        if (e.status.frozen > 0 && hit.source === 'melee') { dmg *= 2; res.crit = true; res.shatter = true; }
    }
    res.dmg = Math.round(dmg);
    return res;
  }

  // Called by the local player when it hits an enemy.
  localHit(e, hit) {
    const res = this.computeHit(e, hit);
    if (e.type === 'inkbat' && res.dmg >= e.hp) G.honours?.event('inkbat');
    this._hitFeedback(e, res, hit);
    if (this.isHost) this.applyHit(e, hit);
    else G.net.send({ t: 'hit', id: e.id, d: hit.dmg, el: hit.element, dir: [hit.dir.x, hit.dir.z], src: hit.source, hy: hit.hy });
  }

  _hitFeedback(e, res, hit) {
    const c = e.center.clone().setY(e.pos.y + e.height + 0.3);
    if (res.blocked) {
      G.hud.damageNumber(c, 'Blocked', '#cccccc');
      G.audio.play('shield', 0.6);
      if (res.hint && G.time - this._hintTime > 4) { this._hintTime = G.time; G.hud.toast(res.hint, '#ffe9a0', 3); }
      G.particles.burst(c, { count: 8, color: 0xffffff, speed: 4, life: 0.3, size: 0.3 });
      return;
    }
    if (res.armor) { G.hud.damageNumber(c, `-${Math.round(res.armor)}`, '#8fd8ff'); G.audio.play('break', 0.5); }
    else if (res.meter) { G.hud.damageNumber(c, 'Hit!', hit.element === 'ice' ? '#9ee0ff' : hit.element === 'vine' ? '#a8f08c' : '#fff09a'); G.audio.play('crit', 0.6); }
    else if (res.shieldHit) { G.hud.damageNumber(c, 'Shield Crack!', '#ffffff'); G.audio.play('break', 0.7); }
    else if (res.dmg > 0) {
      G.hud.damageNumber(c, `${res.dmg}`, res.crit ? '#ffe066' : '#ffffff', res.crit);
      G.audio.play(res.crit ? 'crit' : 'hit');
      if (res.hint && G.time - this._hintTime > 5) { this._hintTime = G.time; G.hud.toast(res.hint, '#ffe9a0', 3); }
    }
    e.hitFlash = 0.15;
    e.lastHit = G.time;
    if (!e.boss && hit.dir && !this.isHost) { e.pos.x += hit.dir.x * 0.4; e.pos.z += hit.dir.z * 0.4; } // predicted knockback
    const col = hit.element ? COLORS[ELEMENTS.indexOf(hit.element)].hex : 0xffffff;
    G.particles.burst(e.center, { count: 12, color: col, speed: 6, life: 0.4, size: 0.4, pool: 'glow' });
  }

  applyHit(e, hit) {
    if (!e.alive) return;
    const res = this.computeHit(e, hit);
    e.lastHit = G.time;
    e.hitFlash = 0.15;
    if (e.state === 'sleep' || e.state === 'dormant') this._wake(e);
    if (res.blocked) return;
    if (res.weak && e.weakCd <= 0) {
      e.weakCd = 12;
      e.status.stun = 5;
      e.state = 'stun';
      this.fx('topple', e.pos);
    }
    const el = hit.element;
    const dir = hit.dir ? tmpV.set(hit.dir.x, 0, hit.dir.z) : tmpV.set(0, 0, 0);
    if (res.armor) {
      e.armor = Math.max(0, e.armor - res.armor);
      if (e.armor <= 0) {
        e.status.stun = 8;
        e.state = 'stun';
        e.stateT = 0;
        G.audio.play('break');
        this.fx('armorBreak', e.pos);
      }
      return;
    }
    if (res.meter) {
      e.meter += res.meter;
      if (e.meter >= 100) {
        e.meter = 0;
        if (e.type === 'magmaw') { e.status.frozen = 7; this.fx('freeze', e.pos); }
        if (e.type === 'shellback') { e.status.stun = 7; e.state = 'stun'; e.vel.y = 10; this.fx('flip', e.pos); }
        if (e.type === 'galewing') { e.status.rooted = 7; e.state = 'stun'; this.fx('tangle', e.pos); }
      }
      return;
    }
    if (res.shieldHit) {
      e.shieldHp--;
      if (e.shieldHp <= 0) {
        e.status.stun = 9;
        e.state = 'stun';
        e.stateT = 0;
        this.fx('shieldBreak', e.pos);
      }
      return;
    }
    // Status effects
    if (!e.boss) {
      if (el === 'fire') e.status.burn = 3.5;
      if (el === 'ice') {
        if (res.shatter) e.status.frozen = 0;
        else if (e.status.frozen <= 0) e.status.frozen = 3;
      }
      if (el === 'bounce') { e.vel.y = 11; e.vel.x = dir.x * 9; e.vel.z = dir.z * 9; e.status.stun = 1; }
      else if (el === 'vine' && e.status.rootImmune <= 0) { e.status.rooted = 3.5; e.status.rootImmune = 6; }
      else if (e.status.frozen <= 0 && e.status.rooted <= 0 && !e.def.static) { e.vel.x += dir.x * 6; e.vel.z += dir.z * 6; e.vel.y = Math.max(e.vel.y, 3); }
    } else if (el === 'fire' && e.type !== 'magmaw') e.status.burn = 2;
    e.hp -= res.dmg;
    if (e.state === 'idle' && hit.from) e.state = 'chase';
    // Staggering interrupts regular enemies mid wind-up
    if (!e.boss && (e.state === 'windup' || e.state === 'attack')) { e.state = 'recover'; e.stateT = 0; e.cool = Math.max(e.cool, 0.8); }
    if (e.hp <= 0) this.kill(e);
  }

  _wake(e) {
    if (e.state !== 'sleep' && e.state !== 'dormant') return;
    e.state = 'wake';
    e.stateT = 0;
    this.fx('wake', e.pos);
    G.net?.send({ t: 'efx', k: 'wake', p: [e.pos.x, e.pos.y, e.pos.z], id: e.id });
  }

  kill(e) {
    if (!e.alive) return;
    // Practice dummies just pop back to full straw
    if (e.type === 'dummy') { e.hp = e.maxHp; this.fx('dummyReset', e.pos); return; }
    e.alive = false;
    e.hp = 0;
    this._deathFx(e);
    if (this.isHost) {
      const n = e.boss ? 6 : 1 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const kind = e.boss ? (i < 3 ? 'heart' : 'ink') : Math.random() < 0.4 ? 'heart' : 'ink';
        this.spawnPickup(kind, e.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.8, (Math.random() - 0.5) * 3)));
      }
      // Pigment for the Brushwright
      const pig = e.boss ? (e.def.field ? 5 : 8) : e.elite ? 3 : Math.random() < 0.7 ? 1 : 0;
      for (let i = 0; i < pig; i++) this.spawnPickup('pigment', e.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.9, (Math.random() - 0.5) * 3)));
      if (e.camp !== undefined) {
        const c = this.camps[e.camp];
        c.members = c.members.filter((m) => m !== e);
        if (!c.members.length) c.respawn = c.field ? 900 : 180;
      }
      if (e.def.field) {
        this.spawnPickup('buff', e.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
        G.trials._setFlag(`slain_${e.type}`);
      }
      if (e.trial) G.trials.onBossDefeated(e.trial);
      if (e.type === 'hueless') G.trials.onFinalDefeated();
    }
    setTimeout(() => this.remove(e), 50);
  }

  _deathFx(e) {
    G.audio.play('enemyDie');
    const c = e.center.clone();
    G.particles.burst(c, { count: e.boss ? 120 : 30, color: 0x2a2433, speed: e.boss ? 12 : 6, life: 1, size: e.boss ? 1.4 : 0.7, gravity: 3 });
    for (let i = 0; i < 4; i++) G.particles.burst(c, { count: e.boss ? 30 : 6, color: COLORS[i].hex, speed: e.boss ? 14 : 7, life: 1, size: 0.5, pool: 'glow', gravity: 4 });
    if (e.boss) G.hud.flash('rgba(255,255,255,0.6)');
  }

  fx(kind, pos) {
    this._fx(kind, pos);
    if (this.isHost) G.net?.send({ t: 'efx', k: kind, p: [pos.x, pos.y, pos.z] });
  }

  _fx(kind, pos) {
    const p = pos.clone();
    switch (kind) {
      case 'armorBreak': G.audio.play('break'); G.particles.burst(p.setY(p.y + 4), { count: 60, color: 0xcdefff, speed: 12, life: 1.2, size: 0.6, gravity: 12 }); G.hud.toast('The armour shatters! Strike now!', '#9ee0ff', 2); break;
      case 'freeze': G.audio.play('ice'); G.particles.burst(p.setY(p.y + 3), { count: 60, color: 0xcdefff, speed: 8, life: 1, size: 0.6 }); G.hud.toast('Magmaw is frozen solid! Attack!', '#9ee0ff', 2); break;
      case 'flip': G.audio.play('bounce'); G.particles.burst(p.setY(p.y + 1), { count: 50, color: 0xf2c229, speed: 10, life: 0.8, size: 0.5, pool: 'glow' }); G.hud.toast('Shellback flipped over! Hit its belly!', '#fff09a', 2); break;
      case 'tangle': G.audio.play('vine'); G.particles.burst(p.setY(p.y + 3), { count: 50, color: 0x3fb54a, speed: 8, life: 1, size: 0.5 }); G.hud.toast('Vines drag Galewing to the ground!', '#a8f08c', 2); break;
      case 'shieldBreak': G.audio.play('break'); G.particles.burst(p.setY(p.y + 7), { count: 100, color: 0xffffff, speed: 15, life: 1.2, size: 0.7, pool: 'glow' }); G.hud.toast('The shield shatters! Paint it back into colour!', '#ffffff', 2.5); break;
      case 'slam': G.audio.play('slam'); G.particles.burst(p.setY(p.y + 0.5), { count: 40, color: 0xd8d0c0, speed: 10, life: 0.8, size: 0.9, gravity: 6 }); if (G.player && G.player.pos.distanceTo(pos) < 30) G.player.cameraShake = 0.4; break;
      case 'roar': G.audio.play('bossRoar'); if (G.player) G.player.cameraShake = 0.6; break;
      case 'wake': {
        G.audio.play('bossRoar');
        const e = this.list.find((q) => q.def.field && q.pos.distanceTo(p) < 3);
        if (e && G.cine && G.player && e.pos.distanceTo(G.player.pos) < 70) G.cine.bossIntro(e);
        break;
      }
      case 'star': G.stars?.streak(p); break;
      case 'dummyReset': G.particles.burst(p.setY(p.y + 1.4), { count: 30, color: 0xd8b060, speed: 5, life: 0.9, size: 0.45, gravity: 8 }); G.audio.play('pickup', 0.5); break;
      case 'rushClear': {
        G.audio.play('shard');
        const b = G.flags.rush_best;
        G.hud.banner('The Echoes Are Stilled', b ? `Gallery record ${fmtTime(b.t)} · ${b.n}` : 'The gallery falls silent', '#c8a8ff');
        break;
      }
      case 'topple': G.audio.play('slam'); G.hud.toast('It staggers! Attack now!', '#fff09a', 2); G.particles.burst(p.setY(p.y + 1), { count: 40, color: 0xd8d0c0, speed: 8, life: 0.8, size: 0.9, gravity: 6 }); break;
      case 'summon': G.particles.burst(p.setY(p.y + 1), { count: 30, color: 0x2a2433, speed: 5, life: 1, size: 0.8 }); break;
      default: break;
    }
  }

  // ------------------------------------------------------------ pickups
  spawnPickup(kind, pos, id) {
    const pid = id ?? this.nextId++;
    let mesh;
    if (kind === 'heart') mesh = new THREE.Mesh(this.heartGeo, new THREE.MeshLambertMaterial({ color: 0xff3a4a, emissive: 0x801020 }));
    else if (kind === 'buff') mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshLambertMaterial({ color: 0xffd84a, emissive: 0xa07000 }));
    else if (kind === 'star') {
      mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a0).multiplyScalar(2.2) })));
      mesh.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 70, 8, 1, true).translate(0, 35, 0), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    } else if (kind === 'pigment') mesh = new THREE.Mesh(this.pigmentGeo ||= new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc84a).multiplyScalar(1.6) }));
    else {
      const c = Math.floor(Math.random() * 4);
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshBasicMaterial({ color: COLORS[c].hex }));
    }
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const g = G.collision.groundAt(pos.x, pos.z, 0.2, pos.y + 2);
    const k = { id: pid, kind, pos: pos.clone(), ground: Math.max(g.y, pos.y - 3) + 0.6, mesh, life: 60 };
    this.pickups.push(k);
    return k;
  }

  collectPickups(player) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      if (k.pos.distanceTo(player.pos.clone().setY(player.pos.y + 0.8)) > 1.6) continue;
      if (k.kind === 'heart') {
        if (player.hp >= player.maxHp) continue;
        player.heal(4);
        G.hud.toast('+2 Hearts', '#ff9aa8', 1);
      } else if (k.kind === 'star') {
        player.pigment += STAR_PIGMENT;
        G.honours?.event('star');
        G.audio.play('sprite');
        G.hud.banner('Star Fragment', `+${STAR_PIGMENT} Pigment`, '#fff0a0');
      } else if (k.kind === 'pigment') {
        player.pigment += 5;
        G.hud.toast(`+5 Pigment (${player.pigment})`, '#ffc84a', 1.2);
      } else if (k.kind === 'buff') {
        const keys = ['tonic', 'power', 'ink', 'swift'];
        const b = keys[Math.floor(Math.random() * keys.length)];
        player.applyBuff(b);
        G.hud.toast({ tonic: 'Prism Tonic: +3 golden hearts', power: 'Bold Pigment: stronger strikes', ink: 'Bottomless Ink', swift: 'Featherfoot: faster movement' }[b], '#ffd84a', 2.5);
      } else {
        for (let c = 0; c < 4; c++) player.ink[c] = Math.min(100, player.ink[c] + 35);
        G.hud.toast('Ink restored', '#ffffff', 1);
      }
      G.audio.play('pickup');
      this.scene.remove(k.mesh);
      this.pickups.splice(i, 1);
      if (!this.isHost) G.net.send({ t: 'pickup', id: k.id });
    }
  }

  // ------------------------------------------------------------ projectiles & waves (host)
  shoot(kind, from, vel, opts = {}) {
    const mesh = new THREE.Mesh(this.projGeo[kind], this.projMats[kind]);
    mesh.position.copy(from);
    this.scene.add(mesh);
    const p = { id: opts.id ?? this.nextId++, kind, pos: from.clone(), vel: vel.clone(), mesh, life: opts.life ?? 5, dmg: opts.dmg ?? 2, grav: opts.grav ?? 14, element: opts.element, radius: opts.radius ?? 0.8, owner: opts.owner };
    this.projectiles.push(p);
    return p;
  }

  wave(pos, opts = {}) {
    const mesh = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: opts.color ?? 0x2a2433, transparent: true, opacity: 0.85 }));
    mesh.position.copy(pos).setY(pos.y + 0.3);
    this.scene.add(mesh);
    const w = { id: opts.id ?? this.nextId++, pos: pos.clone(), r: 1, speed: opts.speed ?? 12, maxR: opts.maxR ?? 26, width: opts.width ?? 1.2, dmg: opts.dmg ?? 3, mesh, hit: new Set(), color: opts.color ?? 0x2a2433 };
    this.waves.push(w);
    return w;
  }

  damagePlayer(pl, dmg, from, element) {
    if (G.greyMoon && G.greyMoon.active) dmg = Math.ceil(dmg * 1.25);
    if (pl.local) G.player.takeDamage(dmg, from, { element });
    else G.net?.send({ t: 'pdmg', to: pl.id, d: dmg, f: [from.x, from.y, from.z], e: element });
  }

  _updateProjectiles(dt, host) {
    const pls = host ? this.players() : [];
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (host || !p.netTarget) {
        p.vel.y -= p.grav * dt;
        p.pos.addScaledVector(p.vel, dt);
      } else {
        p.netTarget.addScaledVector(p.vel, dt);
        p.pos.lerp(p.netTarget, 1 - Math.exp(-15 * dt));
      }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 5;
      if (p.kind === 'feather' || p.kind === 'arrow') p.mesh.lookAt(p.pos.clone().add(p.vel));
      if (p.kind === 'fire' && Math.random() < 0.6) G.particles.flames(p.pos, 0.3, 1, 0.8);
      if (p.kind === 'ink' || p.kind === 'rain') G.particles.burst(p.pos, { count: 1, color: 0x3a2a4a, speed: 0.3, life: 0.4, size: 0.4 });
      if (!host) {
        if (p.life <= 0) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
        continue;
      }
      let done = p.life <= 0;
      for (const pl of pls) {
        if (!pl.alive) continue;
        const c = tmpV.copy(pl.pos).setY(pl.pos.y + 0.9);
        if (c.distanceTo(p.pos) < p.radius + 0.5) {
          this.damagePlayer(pl, p.dmg, p.pos.clone(), p.element);
          done = true;
          break;
        }
      }
      const g = G.collision.groundAt(p.pos.x, p.pos.z, 0.1, p.pos.y + 0.5);
      if (p.pos.y <= g.y + 0.2) {
        done = true;
        this._projImpact(p, g);
      }
      if (done) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        G.net?.send({ t: 'efx', k: 'pimp', p: [p.pos.x, p.pos.y, p.pos.z], kind: p.kind });
        this._impactFx(p.kind, p.pos);
      }
    }
  }

  _impactFx(kind, pos) {
    const col = { ink: 0x5a2a7a, ice: 0xcdefff, fire: 0xff7a2a, feather: 0x9ab8d8, rock: 0xa07a40, rain: 0x3a2a4a, arrow: 0x2a2433 }[kind];
    G.particles.burst(pos, { count: 14, color: col, speed: 5, life: 0.5, size: 0.5 });
  }

  _projImpact(p, g) {
    const pt = p.pos.clone().setY(g.y);
    const kind = g.obj ? 'box' : 'terrain';
    const n = g.obj ? new THREE.Vector3(0, 1, 0) : G.terrain.normalAt(pt.x, pt.z);
    if (p.kind === 'ice') G.paint.paintAt(pt, n, 1, kind, { radius: 2, hostile: true });
    if (p.kind === 'fire') G.paint.paintAt(pt, n, 0, kind, { radius: 1.8, hostile: true });
    if (p.kind === 'rock') this.fx('slam', pt);
  }

  _updateWaves(dt, host) {
    const pls = host ? this.players() : [];
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.r += w.speed * dt;
      w.mesh.scale.set(w.r, 1 + w.width, w.r);
      w.mesh.material.opacity = 0.85 * (1 - w.r / w.maxR);
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        G.particles.burst(w.pos.clone().add(new THREE.Vector3(Math.cos(a) * w.r, 0.4, Math.sin(a) * w.r)), { count: 1, color: w.color, speed: 1, up: 2, life: 0.5, size: 0.7 });
      }
      if (host) {
        for (const pl of pls) {
          if (!pl.alive || w.hit.has(pl.id)) continue;
          const d = Math.hypot(pl.pos.x - w.pos.x, pl.pos.z - w.pos.z);
          if (Math.abs(d - w.r) < w.width + 0.4 && pl.pos.y < w.pos.y + 1.1 && pl.pos.y > w.pos.y - 2) {
            w.hit.add(pl.id);
            this.damagePlayer(pl, w.dmg, w.pos, null);
          }
        }
      }
      if (w.r >= w.maxR) {
        this.scene.remove(w.mesh);
        w.mesh.material.dispose();
        this.waves.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------ host simulation
  _updateCamps(dt) {
    const pls = this.players();
    for (const c of this.camps) {
      if (c.respawn > 0) { c.respawn -= dt; continue; }
      let near = Infinity;
      for (const p of pls) near = Math.min(near, Math.hypot(p.pos.x - c.x, p.pos.z - c.z) + (inDungeonY(p.pos.y) ? 9999 : 0));
      if (!c.active && near < 120) {
        c.active = true;
        c.members = c.types.map((t, i) => {
          const a = (i / c.types.length) * Math.PI * 2;
          const x = c.x + Math.cos(a) * 5, z = c.z + Math.sin(a) * 5;
          if (t === 'archer') return this.spawn(t, c.towerPos.clone().setY(c.towerPos.y + 0.2), { variant: c.variant, camp: c.id });
          const y = c.sky ? c.y + i * 3 : G.terrain.heightAt(x, z);
          return this.spawn(t, new THREE.Vector3(x, y, z), { variant: c.variant, camp: c.id, elite: c.elite && i === 0 });
        });
      } else if (c.active && near > 180) {
        c.active = false;
        for (const m of c.members) this.remove(m);
        c.members = [];
      }
    }
  }

  _nearestPlayer(e, range, alert = false) {
    let best = null, bd = range;
    for (const p of this.players()) {
      if (!p.alive) continue;
      if (inDungeonY(p.pos.y) !== inDungeonY(e.pos.y)) continue;
      // Sneaking players are noticed much later, unless the enemy is already after them
      const d = p.pos.distanceTo(e.pos) / (p.sneak && !alert && e.target?.id !== p.id ? 0.4 : 1);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  _simulate(e, dt) {
    const s = e.status;
    for (const k of ['frozen', 'rooted', 'stun', 'chill', 'rootImmune']) s[k] = Math.max(0, s[k] - dt);
    if (s.burn > 0) {
      s.burn -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.6;
        const dmg = e.variant === 'fire' ? 0 : e.variant === 'ice' ? 4 : 2;
        if (dmg) { e.hp -= dmg; e.lastHit = G.time; if (e.hp <= 0) { this.kill(e); return; } }
      }
    }
    // Paint on the ground
    if (!e.def.fly) {
      for (const sp of G.paint.splatsNear(e.pos, e.radius * 0.5)) {
        if (sp.hostile) continue;
        if (sp.element === 'fire' && e.variant !== 'fire' && s.burn <= 0) s.burn = 2.5;
        if (sp.element === 'ice') { s.chill = 0.5; if (e.variant !== 'ice' && !e.boss && s.frozen <= 0 && Math.random() < dt * 0.5) s.frozen = 2; }
        if (sp.pad && e.grounded) {
          sp.squash = 1;
          e.vel.y = e.boss ? 9 : 16;
          if (e.type === 'shellback') { s.stun = 7; e.state = 'stun'; this.fx('flip', e.pos); }
          else if (!e.boss) s.stun = 1.2;
        }
        if (sp.element === 'vine' && !e.boss && s.rootImmune <= 0) { s.rooted = 3; s.rootImmune = 6; }
      }
    }

    if (e.introT > 0) { e.introT -= dt; this._physics(e, dt); return; }
    // Alerted enemies look twice as far and can't be fooled by sneaking
    if (e.alertT > 0) e.alertT -= dt;
    const target = this._nearestPlayer(e, e.def.aggro * (e.alertT > 0 ? 2 : 1), e.alertT > 0);
    // Spotting someone raises the alarm for the rest of the camp
    if (target && !e.target && e.camp !== undefined && !e.boss) {
      for (const m of this.camps[e.camp]?.members || []) if (m !== e && m.alive) m.alertT = 8;
    }
    e.target = target;
    const ai = AI[e.type];
    const disabled = s.frozen > 0 || s.stun > 0;
    if (ai && !disabled) ai(e, dt, target, this);
    else if (disabled) {
      e.vel.x = damp(e.vel.x, 0, 3, dt);
      e.vel.z = damp(e.vel.z, 0, 3, dt);
      if (s.stun > 0 && e.state !== 'stun') e.state = 'stun';
    }
    if (s.stun <= 0 && e.state === 'stun') {
      e.state = 'recover';
      e.stateT = 0;
      if (e.type === 'frostmaw') e.armor = e.maxArmor * (e.hp < e.maxHp * 0.5 ? 0.8 : 1);
      if (e.type === 'hueless') { e.shieldHp = 3; e.shield = (e.shield + 1 + Math.floor(Math.random() * 3)) % 4; }
    }
    if (s.rooted > 0 && !e.boss) { e.vel.x = 0; e.vel.z = 0; }
    this._physics(e, dt);
  }

  _physics(e, dt) {
    if (e.collider) e.collider.active = false; // don't collide with our own back
    const fly = e.def.fly && !(e.type === 'galewing' && e.status.rooted > 0);
    if (!fly) e.vel.y -= 26 * dt;
    const slow = e.status.chill > 0 ? 0.5 : 1;
    e.pos.x += e.vel.x * dt * slow;
    e.pos.z += e.vel.z * dt * slow;
    e.pos.y += e.vel.y * dt;
    G.collision.resolveHorizontal(e.pos, e.radius * 0.8, e.height, 0.7, []);
    const g = G.collision.groundAt(e.pos.x, e.pos.z, e.radius * 0.5, e.pos.y + 0.8);
    e.grounded = false;
    if (e.pos.y <= g.y) {
      e.pos.y = g.y;
      if (e.vel.y < 0) e.vel.y = 0;
      e.grounded = true;
      if (!fly) {
        e.vel.x = damp(e.vel.x, 0, 6, dt);
        e.vel.z = damp(e.vel.z, 0, 6, dt);
      }
    }
    // Keep in arena / out of the sea
    if (e.arena) {
      const dx = e.pos.x - e.arena.x, dz = e.pos.z - e.arena.z;
      const d = Math.hypot(dx, dz);
      if (d > e.arena.r - e.radius) {
        e.pos.x = e.arena.x + (dx / d) * (e.arena.r - e.radius);
        e.pos.z = e.arena.z + (dz / d) * (e.arena.r - e.radius);
      }
      if (e.pos.y < e.arena.y - 20) e.pos.set(e.arena.x, e.arena.y + 2, e.arena.z);
    }
    if (!inDungeonY(e.pos.y) && !fly && G.terrain.heightAt(e.pos.x, e.pos.z) < -0.8) {
      e.pos.x = damp(e.pos.x, e.home.x, 2, dt);
      e.pos.z = damp(e.pos.z, e.home.z, 2, dt);
    }
    if (e.pos.y < -2000 || (!inDungeonY(e.home.y) && e.pos.y < -60)) this.kill(e);
    if (e.collider) e.collider.active = e.alive;
  }

  // ------------------------------------------------------------ rendering
  _render(e, dt) {
    const g = e.group;
    if (e.collider) {
      const c = e.collider;
      c.x = e.pos.x; c.z = e.pos.z;
      c.min.set(e.pos.x - c.r, e.pos.y, e.pos.z - c.r);
      c.max.set(e.pos.x + c.r, e.pos.y + 6.2, e.pos.z + c.r);
    }
    g.position.copy(e.pos);
    g.rotation.y = e.yaw;
    e.anim += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    const f = e.hitFlash > 0 ? 1 : 0;
    // Telegraph: a bright glint flashes when an attack winds up
    const tele = e.state === 'windup' || e.state === 'slam' || e.state === 'shoot' || e.state === 'summon' || e.state === 'dive';
    if (tele && e.prevState !== e.state) {
      const head = e.pos.clone().setY(e.pos.y + e.height * 0.85).addScaledVector(new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)), e.radius * 0.6);
      G.particles.burst(head, { count: 1, color: 0xfff2c0, speed: 0, life: 0.35, size: e.boss ? 5 : 2.4, pool: 'glow', gravity: 0 });
      G.particles.burst(head, { count: 8, color: 0xffe8a0, speed: 3, life: 0.3, size: 0.3, pool: 'glow', gravity: 0 });
      if (e.pos.distanceTo(G.player.pos) < 40) G.audio.play('glint', 0.6);
    }
    e.prevState = e.state;
    const tint = tele && e.stateT < 1.2 ? 0.25 + 0.25 * Math.sin(e.anim * 30) : 0;
    for (const { m, base } of e.mats) {
      if (f) m.emissive.setRGB(1, 1, 1);
      else if (tint > 0) m.emissive.setRGB(base.r + tint, base.g + tint * 0.3, base.b);
      else m.emissive.copy(base);
    }
    // Squash on impact
    const sq = e.hitFlash / 0.15;
    const bs = e.baseScale || 1;
    g.scale.set(bs * (1 + sq * 0.14), bs * (1 - sq * 0.16), bs * (1 + sq * 0.14));
    e.iceBlock.visible = e.status.frozen > 0 && e.type !== 'magmaw';
    e.vineWrap.visible = e.status.rooted > 0 && e.type !== 'galewing';
    if (e.status.burn > 0 && Math.random() < dt * 25) G.particles.flames(e.pos.clone().setY(e.pos.y + e.height * 0.3), e.radius * 0.6, 1);
    const R = RENDER[e.type];
    if (R) R(e, dt);
  }

  // ------------------------------------------------------------ networking
  snapshot() {
    const r = (v) => Math.round(v * 100) / 100;
    return {
      t: 'world',
      e: this.list.filter((e) => e.alive).map((e) => [
        e.id, TYPE_KEYS.indexOf(e.type), VARIANTS.indexOf(e.variant), r(e.pos.x), r(e.pos.y), r(e.pos.z), r(e.yaw),
        Math.ceil(e.hp), e.maxHp, STATES.indexOf(e.state),
        (e.status.burn > 0 ? 1 : 0) | (e.status.frozen > 0 ? 2 : 0) | (e.status.rooted > 0 ? 4 : 0) | (e.status.stun > 0 ? 8 : 0) | (e.elite ? 16 : 0),
        Math.round(e.armor), Math.round(e.meter), e.shield, e.shieldHp, e.phase, r(e.stateT), e.trial || 0,
      ]),
      p: this.projectiles.map((p) => [p.id, p.kind, r(p.pos.x), r(p.pos.y), r(p.pos.z), r(p.vel.x), r(p.vel.y), r(p.vel.z)]),
      w: this.waves.map((w) => [w.id, r(w.pos.x), r(w.pos.y), r(w.pos.z), r(w.r), w.speed, w.maxR, w.width, w.color]),
      k: this.pickups.map((k) => [k.id, k.kind, r(k.pos.x), r(k.pos.y), r(k.pos.z)]),
      d: G.sky ? r(G.sky.dayT * 1000) / 1000 : 0,
      wx: G.weather ? G.weather.code() : 0,
      gm: G.greyMoon && G.greyMoon.active ? 1 : 0,
    };
  }

  applySnapshot(m) {
    const seen = new Set();
    for (const a of m.e) {
      const [id, ti, vi, x, y, z, yaw, hp, maxHp, st, bits, armor, meter, shield, shieldHp, phase, stT, trial] = a;
      seen.add(id);
      let e = this.byId.get(id);
      if (!e) {
        e = this.spawn(TYPE_KEYS[ti], new THREE.Vector3(x, y, z), { id, variant: VARIANTS[vi], elite: !!(bits & 16) });
        if (trial) e.trial = trial;
        this.nextId = Math.max(this.nextId, id + 1);
      }
      e.netPos.set(x, y, z);
      e.netYaw = yaw;
      if (hp < e.hp) e.lastHit = G.time;
      e.hp = hp; e.maxHp = maxHp;
      e.state = STATES[st] || 'idle';
      e.status.burn = bits & 1 ? 1 : 0;
      e.status.frozen = bits & 2 ? 1 : 0;
      e.status.rooted = bits & 4 ? 1 : 0;
      e.status.stun = bits & 8 ? 1 : 0;
      e.armor = armor; e.meter = meter; e.shield = shield; e.shieldHp = shieldHp; e.phase = phase; e.stateT = stT;
    }
    for (const e of [...this.list]) {
      if (!seen.has(e.id) && e.alive) {
        e.alive = false;
        if (e.pos.distanceTo(G.player.pos) < 150) this._deathFx(e);
        this.remove(e);
      }
    }
    // Projectiles
    const pseen = new Set();
    for (const [id, kind, x, y, z, vx, vy, vz] of m.p) {
      pseen.add(id);
      let p = this.projectiles.find((q) => q.id === id);
      if (!p) p = this.shoot(kind, new THREE.Vector3(x, y, z), new THREE.Vector3(vx, vy, vz), { id });
      p.netTarget = new THREE.Vector3(x, y, z);
      p.vel.set(vx, vy, vz);
      p.life = 1;
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!pseen.has(this.projectiles[i].id)) { this.scene.remove(this.projectiles[i].mesh); this.projectiles.splice(i, 1); }
    }
    const wseen = new Set();
    for (const [id, x, y, z, r, speed, maxR, width, color] of m.w) {
      wseen.add(id);
      let w = this.waves.find((q) => q.id === id);
      if (!w) w = this.wave(new THREE.Vector3(x, y, z), { id, speed, maxR, width, color });
      if (Math.abs(w.r - r) > 2) w.r = r;
    }
    const kseen = new Set();
    for (const [id, kind, x, y, z] of m.k) {
      kseen.add(id);
      if (!this.pickups.find((q) => q.id === id)) this.spawnPickup(kind, new THREE.Vector3(x, y, z), id);
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (!kseen.has(this.pickups[i].id)) { this.scene.remove(this.pickups[i].mesh); this.pickups.splice(i, 1); }
    }
    if (G.weather && typeof m.wx === 'number') G.weather.sync(m.wx);
    if (G.greyMoon && typeof m.gm === 'number') G.greyMoon.sync(m.gm);
    if (G.sky && typeof m.d === 'number' && Math.abs(G.sky.dayT - m.d) > 0.01) G.sky.setTime(m.d);
  }

  onNetHit(m) {
    const e = this.byId.get(m.id);
    if (!e) return;
    this.applyHit(e, { dmg: m.d, element: m.el, dir: { x: m.dir[0], z: m.dir[1] }, source: m.src, from: m.from, hy: m.hy });
  }

  onNetPickup(m) {
    const i = this.pickups.findIndex((k) => k.id === m.id);
    if (i >= 0) { this.scene.remove(this.pickups[i].mesh); this.pickups.splice(i, 1); }
  }

  // Called when this client becomes the host: adopt interpolated state as authoritative.
  becomeHost() {
    // Re-adopt camps around enemies we already know about so they don't double-spawn
    for (const c of this.camps) {
      c.members = this.list.filter((e) => !e.boss && e.alive && Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 35);
      c.members.forEach((m) => (m.camp = c.id));
      c.active = c.members.length > 0;
    }
    for (const e of this.list) {
      e.pos.copy(e.netPos);
      e.home.copy(e.pos);
      if (e.boss && !e.arena) {
        const t = TRIALS.find((q) => q.key === e.trial);
        if (t) e.arena = G.trials.arenaFor(t.key);
        else if (e.type === 'hueless') e.arena = G.trials.citadelArena();
        else if (G.gallery && G.gallery.inside(e.pos)) { e.arena = G.gallery.arena; e.rush = true; }
      }
    }
  }

  update(dt) {
    const host = this.isHost;
    if (host) { this._updateCamps(dt); this._nightBats(dt); this._dummies(); }
    this.bossActive = null;
    for (const e of [...this.list]) {
      if (!e.alive) continue;
      if (host) this._simulate(e, dt);
      else {
        e.pos.lerp(e.netPos, 1 - Math.exp(-10 * dt));
        e.yaw = dampAngle(e.yaw, e.netYaw, 10, dt);
        if (e.pos.distanceTo(e.netPos) > 12) e.pos.copy(e.netPos);
      }
      if (e.boss && e.state !== 'sleep' && e.state !== 'dormant' && e.pos.distanceTo(G.player.pos) < (e.def.field ? 60 : 90)) this.bossActive = e;
      this._render(e, dt);
    }
    this.decor.update(dt);
    this._updateProjectiles(dt, host);
    this._updateWaves(dt, host);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.pos.y = damp(k.pos.y, k.ground + Math.sin(G.time * 3 + k.id) * 0.15, 4, dt);
      k.mesh.position.copy(k.pos);
      k.mesh.rotation.y += dt * 2;
      if (host) {
        k.life -= dt;
        if (k.life <= 0) { this.scene.remove(k.mesh); this.pickups.splice(i, 1); }
      }
    }
    if (host && G.net && G.net.connected) {
      this.syncTimer -= dt;
      if (this.syncTimer <= 0) {
        this.syncTimer = 0.1;
        G.net.send(this.snapshot());
      }
    }
  }
}

// ====================================================================== AI
function faceTo(e, target, dt, rate = 6) {
  const dx = target.x - e.pos.x, dz = target.z - e.pos.z;
  e.yaw = dampAngle(e.yaw, Math.atan2(dx, dz), rate, dt);
}
function moveToward(e, target, speed, dt) {
  const dx = target.x - e.pos.x, dz = target.z - e.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  e.vel.x = damp(e.vel.x, (dx / d) * speed, 6, dt);
  e.vel.z = damp(e.vel.z, (dz / d) * speed, 6, dt);
  faceTo(e, target, dt);
}
function wander(e, dt) {
  e.stateT -= dt;
  if (e.stateT <= 0) {
    e.stateT = 2 + Math.random() * 3;
    const a = Math.random() * Math.PI * 2;
    e.wanderTo = e.home.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6));
  }
  if (e.wanderTo && e.pos.distanceTo(e.wanderTo) > 1) moveToward(e, e.wanderTo, e.def.speed * 0.35, dt);
}
function setState(e, s) { e.state = s; e.stateT = 0; }
const fwdOf = (e) => new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));

function contactDamage(e, mgr, dmg, range, element) {
  for (const p of mgr.players()) {
    if (!p.alive || (e.hitSet && e.hitSet.has(p.id))) continue;
    const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    if (d < e.radius + range && Math.abs(p.pos.y - e.pos.y) < e.height + 0.5) {
      (e.hitSet || (e.hitSet = new Set())).add(p.id);
      mgr.damagePlayer(p, Math.round(dmg * (e.dmgMul || 1)), e.pos.clone(), element);
    }
  }
}

const AI = {
  bounder(e, dt, t, mgr) {
    e.stateT += dt;
    const leash = e.pos.distanceTo(e.home) > 45;
    if (!t || leash) {
      if (leash) moveToward(e, e.home, e.def.speed, dt); else wander(e, dt);
      if (e.state !== 'idle') { e.state = 'idle'; e.stateT = 0; }
      return;
    }
    const d = t.pos.distanceTo(e.pos);
    const rooted = e.status.rooted > 0;
    switch (e.state) {
      case 'idle': case 'chase':
        e.state = 'chase';
        if (!rooted) moveToward(e, t.pos, e.def.speed, dt); else faceTo(e, t.pos, dt);
        e.cool -= dt;
        if (d < 8 && e.cool <= 0 && !rooted) { setState(e, 'windup'); e.hitSet = new Set(); }
        break;
      case 'windup':
        faceTo(e, t.pos, dt, 10);
        e.vel.x = damp(e.vel.x, 0, 8, dt); e.vel.z = damp(e.vel.z, 0, 8, dt);
        if (e.stateT > 0.65) {
          setState(e, 'attack');
          const f = fwdOf(e);
          e.vel.set(f.x * 14, 4, f.z * 14);
        }
        break;
      case 'attack':
        contactDamage(e, mgr, 2, 0.6);
        if (e.stateT > 0.55) { setState(e, 'recover'); e.cool = 1.5 + Math.random(); }
        break;
      case 'recover':
        if (e.stateT > 0.8) setState(e, 'chase');
        break;
      default: setState(e, 'chase');
    }
  },
  inkling(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t || e.pos.distanceTo(e.home) > 40) {
      if (!t) wander(e, dt); else moveToward(e, e.home, e.def.speed, dt);
      e.state = 'idle';
      return;
    }
    const d = t.pos.distanceTo(e.pos);
    const rooted = e.status.rooted > 0;
    switch (e.state) {
      case 'windup':
        faceTo(e, t.pos, dt, 12);
        if (e.stateT > 0.4) {
          setState(e, 'attack');
          const f = fwdOf(e);
          e.vel.set(f.x * 9, 7, f.z * 9);
          e.hitSet = new Set();
        }
        break;
      case 'attack':
        contactDamage(e, mgr, 2, 0.5);
        if (e.stateT > 0.5 && e.grounded) { setState(e, 'recover'); e.cool = 1.2 + Math.random(); }
        break;
      case 'recover':
        if (e.stateT > 0.6) setState(e, 'chase');
        break;
      default:
        e.state = 'chase';
        // Slight strafing so groups spread out
        if (!rooted) {
          const side = new THREE.Vector3(Math.cos(e.id), 0, Math.sin(e.id)).multiplyScalar(2);
          moveToward(e, t.pos.clone().add(side), e.def.speed, dt);
        }
        e.cool -= dt;
        if (d < 3.2 && e.cool <= 0 && !rooted) setState(e, 'windup');
    }
  },
  spitter(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t) { e.state = 'idle'; return; }
    faceTo(e, t.pos, dt, 4);
    e.cool -= dt;
    if (e.state === 'windup' && e.stateT > 0.6) {
      setState(e, 'shoot');
      const from = e.pos.clone().setY(e.pos.y + 2).addScaledVector(fwdOf(e), 0.8);
      const to = t.pos.clone().setY(t.pos.y + 0.8);
      const dist = from.distanceTo(to);
      const tt = dist / 18;
      const v = to.sub(from).divideScalar(tt);
      v.y += 0.5 * 14 * tt;
      mgr.shoot('ink', from, v, { dmg: 2, element: null });
      G.net?.send({ t: 'efx', k: 'spit', p: [from.x, from.y, from.z] });
      G.audio.play('shoot', 0.6);
    } else if (e.state === 'shoot' && e.stateT > 0.4) setState(e, 'idle');
    else if (e.cool <= 0 && e.state === 'idle') {
      e.cool = 2.6 + Math.random();
      setState(e, 'windup');
    }
  },
  blotgiant(e, dt, t, mgr) {
    e.stateT += dt;
    e.weakCd = Math.max(0, e.weakCd - dt);
    if (e.state === 'sleep') {
      // Sprinting or fighting nearby wakes it
      for (const p of mgr.players()) {
        const d = p.pos.distanceTo(e.pos);
        if (p.alive && (p.sneak ? d < 3.5 : d < 9 || (d < 18 && p.state !== 'ground'))) { mgr._wake(e); break; }
      }
      return;
    }
    if (e.state === 'wake') { if (e.stateT > 2.4) setState(e, 'chase'); return; }
    if (!t) { if (e.stateT > 20) { setState(e, 'sleep'); } return; }
    const d = t.pos.distanceTo(e.pos);
    switch (e.state) {
      case 'chase': case 'recover': case 'idle':
        if (e.state === 'recover' && e.stateT < 0.8) break;
        e.state = 'chase';
        moveToward(e, t.pos, e.def.speed, dt);
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = 2.4;
          e.hitSet = new Set();
          setState(e, d < 8 ? (Math.random() < 0.5 ? 'slam' : 'attack') : 'shoot');
        }
        break;
      case 'slam':
        e.vel.x = damp(e.vel.x, 0, 8, dt); e.vel.z = damp(e.vel.z, 0, 8, dt);
        if (e.stateT > 1.0 && !e.did) {
          e.did = true;
          mgr.fx('slam', e.pos);
          mgr.wave(e.pos, { color: 0x3a3246, speed: 13, maxR: 18, dmg: 3 });
          for (const p of mgr.players()) if (p.alive && p.pos.distanceTo(e.pos) < 6) mgr.damagePlayer(p, 4, e.pos, null);
        }
        if (e.stateT > 1.7) { e.did = false; setState(e, 'recover'); }
        break;
      case 'attack': // wide arm sweep in front
        faceTo(e, t.pos, dt, 3);
        if (e.stateT > 0.7 && e.stateT < 1.1) {
          for (const p of mgr.players()) {
            if (!p.alive || e.hitSet.has(p.id)) continue;
            const v = p.pos.clone().sub(e.pos); v.y = 0;
            if (v.length() < 7.5 && v.normalize().dot(fwdOf(e)) > 0.1 && p.pos.y < e.pos.y + 4) { e.hitSet.add(p.id); mgr.damagePlayer(p, 4, e.pos, null); }
          }
        }
        if (e.stateT > 1.5) setState(e, 'recover');
        break;
      case 'shoot': // hurls a boulder
        faceTo(e, t.pos, dt, 6);
        if (e.stateT > 0.9 && !e.did) {
          e.did = true;
          const from = e.pos.clone().setY(e.pos.y + 7);
          const tt = 1.2;
          const v = t.pos.clone().sub(from).divideScalar(tt);
          v.y += 0.5 * 14 * tt;
          mgr.shoot('rock', from, v, { dmg: 3, radius: 1.3 });
        }
        if (e.stateT > 1.5) { e.did = false; setState(e, 'recover'); }
        break;
      default: setState(e, 'chase');
    }
  },
  sentinel(e, dt, t, mgr) {
    e.stateT += dt;
    if (e.state === 'dormant') {
      for (const p of mgr.players()) if (p.alive && p.pos.distanceTo(e.pos) < (p.sneak ? 5 : 13)) { mgr._wake(e); break; }
      return;
    }
    if (e.state === 'wake') { if (e.stateT > 2) setState(e, 'chase'); return; }
    if (!t) { if (e.stateT > 20) setState(e, 'dormant'); return; }
    const d = t.pos.distanceTo(e.pos);
    // Players riding on its back get shaken off now and then
    const rider = mgr.players().find((p) => p.alive && Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < 3 && p.pos.y > e.pos.y + 5);
    switch (e.state) {
      case 'chase': case 'recover': case 'idle':
        if (e.state === 'recover' && e.stateT < 0.9) break;
        e.state = 'chase';
        if (!rider) moveToward(e, t.pos, e.def.speed, dt);
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = rider ? 4.5 : 2.8;
          setState(e, rider || d < 7 ? 'slam' : 'shoot');
        }
        break;
      case 'slam':
        if (e.stateT > 1.1 && !e.did) {
          e.did = true;
          mgr.fx('slam', e.pos);
          mgr.wave(e.pos, { color: 0x9a8c7a, speed: 12, maxR: 16, dmg: 3 });
        }
        if (e.stateT > 1.8) { e.did = false; setState(e, 'recover'); }
        break;
      case 'shoot':
        faceTo(e, t.pos, dt, 5);
        if (e.stateT > 1.0 && !e.did) {
          e.did = true;
          for (let i = 0; i < 2; i++) {
            const from = e.pos.clone().setY(e.pos.y + 5);
            const tt = 1.3 + i * 0.25;
            const to = t.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4));
            const v = to.sub(from).divideScalar(tt);
            v.y += 0.5 * 14 * tt;
            mgr.shoot('rock', from, v, { dmg: 3, radius: 1.2 });
          }
        }
        if (e.stateT > 1.6) { e.did = false; setState(e, 'recover'); }
        break;
      default: setState(e, 'chase');
    }
  },
  archer(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t) { e.state = 'idle'; return; }
    faceTo(e, t.pos, dt, 5);
    e.cool -= dt;
    if (e.state === 'windup' && e.stateT > 0.9) {
      setState(e, 'shoot');
      const from = e.pos.clone().setY(e.pos.y + e.height * 0.6).addScaledVector(fwdOf(e), 0.6);
      const to = t.pos.clone().setY(t.pos.y + 1);
      const tt = Math.max(0.4, from.distanceTo(to) / 34);
      const v = to.sub(from).divideScalar(tt);
      v.y += 0.5 * 10 * tt;
      mgr.shoot('arrow', from, v, { dmg: Math.round(2 * (e.dmgMul || 1)), grav: 10, radius: 0.5 });
      G.net?.send({ t: 'efx', k: 'spit', p: [from.x, from.y, from.z] });
      G.audio.play('shoot', 0.5);
    } else if (e.state === 'shoot' && e.stateT > 0.5) setState(e, 'idle');
    else if (e.cool <= 0 && e.state === 'idle') { e.cool = 2.8 + Math.random() * 1.5; setState(e, 'windup'); }
  },
  wisp(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t) {
      const a = G.time * 0.5 + e.id;
      moveToward(e, e.home.clone().add(new THREE.Vector3(Math.cos(a) * 10, Math.sin(a * 2) * 2, Math.sin(a) * 10)), 4, dt);
      e.vel.y = damp(e.vel.y, (e.home.y - e.pos.y) * 0.8, 3, dt);
      return;
    }
    const tp = t.pos.clone().setY(t.pos.y + 1);
    if (e.state === 'dive') {
      contactDamage(e, mgr, 2, 0.6);
      if (e.stateT > 1) { setState(e, 'fly'); e.cool = 2 + Math.random() * 2; }
      return;
    }
    const a = G.time * 1.2 + e.id * 2;
    const orbit = tp.clone().add(new THREE.Vector3(Math.cos(a) * 9, 5, Math.sin(a) * 9));
    const d = orbit.sub(e.pos);
    e.vel.lerp(d.multiplyScalar(1.2).clampLength(0, e.def.speed), 1 - Math.exp(-3 * dt));
    faceTo(e, tp, dt);
    e.state = 'fly';
    e.cool -= dt;
    if (e.cool <= 0) {
      setState(e, 'dive');
      e.hitSet = new Set();
      e.vel.copy(tp.sub(e.pos).normalize().multiplyScalar(16));
    }
  },

  // Swirls above its target, then swoops; riders and gliders get chased at full speed
  inkbat(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t) {
      const a = G.time * 0.8 + e.id;
      const home = e.home.clone().add(new THREE.Vector3(Math.cos(a) * 8, Math.sin(a * 3), Math.sin(a) * 8));
      e.vel.lerp(home.sub(e.pos).multiplyScalar(0.8).clampLength(0, 6), 1 - Math.exp(-2 * dt));
      return;
    }
    const tp = t.pos.clone().setY(t.pos.y + 1);
    if (e.state === 'dive') {
      contactDamage(e, mgr, 1, 0.5);
      if (e.stateT > 0.9) { setState(e, 'fly'); e.cool = 1.8 + Math.random() * 2.2; }
      return;
    }
    const airborne = t.state === 'ride' || t.state === 'glide' || t.state === 'air';
    const a = G.time * 1.8 + e.id * 1.7;
    const want = airborne ? tp.clone().add(new THREE.Vector3(Math.cos(a) * 4, 2, Math.sin(a) * 4)) : tp.clone().add(new THREE.Vector3(Math.cos(a) * 7, 6 + Math.sin(a * 2), Math.sin(a) * 7));
    const floor = G.terrain.heightAt(e.pos.x, e.pos.z) + 1.5;
    if (want.y < floor) want.y = floor;
    e.vel.lerp(want.sub(e.pos).multiplyScalar(1.5).clampLength(0, e.def.speed * (airborne ? 1.3 : 0.8)), 1 - Math.exp(-3 * dt));
    faceTo(e, tp, dt, 10);
    e.state = 'fly';
    e.cool -= dt;
    if (e.cool <= 0 && e.pos.distanceTo(tp) < 16) {
      setState(e, 'dive');
      e.hitSet = new Set();
      e.vel.copy(tp.sub(e.pos).normalize().multiplyScalar(19));
      G.audio.play('glide', 0.4);
    }
  },

  // ---------------------------------------------------------------- bosses
  frostmaw(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t) { e.state = 'idle'; return; }
    const d = t.pos.distanceTo(e.pos);
    const enraged = e.hp < e.maxHp * 0.5;
    switch (e.state) {
      case 'idle': case 'chase': case 'recover':
        e.state = 'chase';
        moveToward(e, t.pos, e.def.speed * (enraged ? 1.4 : 1), dt);
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = enraged ? 2 : 3;
          if (d < 9) setState(e, 'slam');
          else setState(e, Math.random() < 0.6 ? 'shoot' : 'windup');
          e.hitSet = new Set();
        }
        break;
      case 'slam':
        e.vel.x = damp(e.vel.x, 0, 8, dt); e.vel.z = damp(e.vel.z, 0, 8, dt);
        if (e.stateT > 1.1 && !e.did) {
          e.did = true;
          mgr.fx('slam', e.pos);
          mgr.wave(e.pos, { color: 0xbfe8ff, speed: 14, maxR: 20, dmg: 3 });
          for (const p of mgr.players()) if (p.alive && p.pos.distanceTo(e.pos) < 5.5) mgr.damagePlayer(p, 4, e.pos, 'ice');
        }
        if (e.stateT > 1.8) { e.did = false; setState(e, 'recover'); }
        break;
      case 'shoot':
        faceTo(e, t.pos, dt, 8);
        if (e.stateT > 0.9 && !e.did) {
          e.did = true;
          const n = enraged ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const from = e.pos.clone().setY(e.pos.y + 8);
            const to = t.pos.clone().add(new THREE.Vector3((i - (n - 1) / 2) * 4, 0, 0));
            const tt = 1.3;
            const v = to.sub(from).divideScalar(tt);
            v.y += 0.5 * 14 * tt;
            mgr.shoot('ice', from, v, { dmg: 3, element: 'ice', radius: 1.3 });
          }
          G.audio.play('ice');
        }
        if (e.stateT > 1.5) { e.did = false; setState(e, 'recover'); }
        break;
      case 'windup':
        faceTo(e, t.pos, dt, 8);
        if (e.stateT > 0.8) {
          setState(e, 'attack');
          const f = fwdOf(e);
          e.vel.set(f.x * 16, 0, f.z * 16);
        }
        break;
      case 'attack':
        contactDamage(e, mgr, 3, 1, 'ice');
        if (e.stateT > 0.9) setState(e, 'recover');
        break;
      default: setState(e, 'chase');
    }
  },
  magmaw(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t) { e.state = 'idle'; return; }
    const enraged = e.hp < e.maxHp * 0.5;
    // Magmaw leaves burning footprints
    if (e.grounded && Math.random() < dt * 0.8 && e.status.frozen <= 0) {
      G.paint.paintAt(e.pos.clone(), new THREE.Vector3(0, 1, 0), 0, inDungeonY(e.pos.y) ? 'box' : 'terrain', { radius: 1.6, hostile: true, loud: false });
    }
    switch (e.state) {
      case 'idle': case 'chase': case 'recover':
        e.state = 'chase';
        moveToward(e, t.pos, e.def.speed * (enraged ? 1.3 : 1), dt);
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = enraged ? 2.2 : 3.2;
          setState(e, Math.random() < 0.5 ? 'slam' : 'shoot');
        }
        break;
      case 'slam': // leap onto the player
        if (e.stateT < 0.5) { faceTo(e, t.pos, dt, 10); break; }
        if (!e.did) {
          e.did = true;
          const dx = t.pos.x - e.pos.x, dz = t.pos.z - e.pos.z;
          e.vel.set(dx / 1.1, 15, dz / 1.1);
          e.airborne = true;
        }
        if (e.airborne && e.grounded && e.stateT > 0.8) {
          e.airborne = false;
          mgr.fx('slam', e.pos);
          mgr.wave(e.pos, { color: 0xff6a20, speed: 13, maxR: 16, dmg: 3 });
          for (const p of mgr.players()) if (p.alive && p.pos.distanceTo(e.pos) < 4.5) mgr.damagePlayer(p, 4, e.pos, 'fire');
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            G.paint.paintAt(e.pos.clone().add(new THREE.Vector3(Math.cos(a) * 4, 0, Math.sin(a) * 4)), new THREE.Vector3(0, 1, 0), 0, 'box', { radius: 1.8, hostile: true, loud: false });
          }
        }
        if (e.stateT > 2.2) { e.did = false; setState(e, 'recover'); }
        break;
      case 'shoot':
        faceTo(e, t.pos, dt, 8);
        if (e.stateT > 0.7 && !e.did) {
          e.did = true;
          const n = enraged ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const from = e.pos.clone().setY(e.pos.y + 4);
            const spread = (i - (n - 1) / 2) * 0.25;
            const dir = t.pos.clone().sub(from).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
            const dist = Math.hypot(t.pos.x - from.x, t.pos.z - from.z);
            const tt = Math.max(0.8, dist / 16);
            mgr.shoot('fire', from, dir.multiplyScalar(dist / tt).setY(0.5 * 14 * tt - 4 / tt), { dmg: 2, element: 'fire', radius: 1 });
          }
          G.audio.play('fire');
        }
        if (e.stateT > 1.4) { e.did = false; setState(e, 'recover'); }
        break;
      default: setState(e, 'chase');
    }
  },
  shellback(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t) { e.state = 'idle'; return; }
    const enraged = e.hp < e.maxHp * 0.5;
    switch (e.state) {
      case 'idle': case 'chase': case 'recover':
        e.state = 'chase';
        moveToward(e, t.pos, e.def.speed, dt);
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = enraged ? 2.5 : 3.5;
          setState(e, Math.random() < 0.6 ? 'windup' : 'summon');
          e.hitSet = new Set();
        }
        break;
      case 'windup':
        faceTo(e, t.pos, dt, 8);
        e.vel.x = damp(e.vel.x, 0, 6, dt); e.vel.z = damp(e.vel.z, 0, 6, dt);
        if (e.stateT > 1) {
          setState(e, 'roll');
          const f = fwdOf(e);
          e.rollDir = f;
          e.bounces = enraged ? 3 : 2;
        }
        break;
      case 'roll': {
        const sp = enraged ? 20 : 16;
        e.vel.x = e.rollDir.x * sp; e.vel.z = e.rollDir.z * sp;
        contactDamage(e, mgr, 3, 0.8);
        // Bounce off arena walls
        if (e.arena) {
          const dx = e.pos.x - e.arena.x, dz = e.pos.z - e.arena.z;
          if (Math.hypot(dx, dz) > e.arena.r - e.radius - 0.5) {
            e.bounces--;
            mgr.fx('slam', e.pos);
            const n = new THREE.Vector3(-dx, 0, -dz).normalize();
            const tp = t.pos.clone().sub(e.pos).setY(0).normalize();
            e.rollDir = n.lerp(tp, 0.6).normalize();
            e.hitSet = new Set();
            e.yaw = Math.atan2(e.rollDir.x, e.rollDir.z);
            if (e.bounces <= 0) setState(e, 'recover');
          }
        }
        if (e.stateT > 5) setState(e, 'recover');
        break;
      }
      case 'summon': // stomp: rocks rain down around players
        if (e.stateT > 0.8 && !e.did) {
          e.did = true;
          mgr.fx('slam', e.pos);
          for (const p of mgr.players()) {
            if (!p.alive) continue;
            for (let i = 0; i < 4; i++) {
              const from = p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 18 + i * 3, (Math.random() - 0.5) * 8));
              mgr.shoot('rock', from, new THREE.Vector3(0, -4, 0), { dmg: 2, radius: 1.1 });
            }
          }
        }
        if (e.stateT > 1.6) { e.did = false; setState(e, 'recover'); }
        break;
      default: setState(e, 'chase');
    }
  },
  galewing(e, dt, t, mgr) {
    e.stateT += dt;
    if (e.status.rooted > 0) { e.state = 'stun'; e.vel.x = e.vel.z = 0; return; }
    if (!t) { e.state = 'idle'; return; }
    const enraged = e.hp < e.maxHp * 0.5;
    const center = e.arena ? new THREE.Vector3(e.arena.x, e.arena.y, e.arena.z) : e.home;
    switch (e.state) {
      case 'dive':
        contactDamage(e, mgr, 3, 1);
        if (e.stateT > 1.2) { setState(e, 'fly'); e.cool = 2; }
        return;
      case 'shoot':
        faceTo(e, t.pos, dt, 8);
        e.vel.multiplyScalar(0.9);
        if (e.stateT > 0.6 && !e.did) {
          e.did = true;
          const n = enraged ? 7 : 5;
          const from = e.pos.clone().setY(e.pos.y + 1);
          const base = t.pos.clone().setY(t.pos.y + 0.8).sub(from).normalize();
          for (let i = 0; i < n; i++) {
            const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * 0.18);
            mgr.shoot('feather', from, dir.multiplyScalar(22), { dmg: 2, grav: 0, radius: 0.6, life: 3 });
          }
          G.audio.play('shoot');
        }
        if (e.stateT > 1.2) { e.did = false; setState(e, 'fly'); }
        return;
      case 'summon': // gust pushes everyone away
        if (e.stateT > 0.8 && !e.did) {
          e.did = true;
          mgr.wave(e.pos.clone().setY(center.y), { color: 0xdde8f0, speed: 18, maxR: 28, dmg: 2, width: 1.6 });
          G.audio.play('glide');
        }
        if (e.stateT > 1.4) { e.did = false; setState(e, 'fly'); }
        return;
      default: {
        e.state = 'fly';
        const a = G.time * (enraged ? 0.7 : 0.45);
        const goal = center.clone().add(new THREE.Vector3(Math.cos(a) * 14, 8 + Math.sin(a * 2) * 1.5, Math.sin(a) * 14));
        const d = goal.sub(e.pos);
        e.vel.lerp(d.clampLength(0, e.def.speed), 1 - Math.exp(-2 * dt));
        faceTo(e, t.pos, dt);
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = enraged ? 2.3 : 3.2;
          const r = Math.random();
          if (r < 0.4) setState(e, 'shoot');
          else if (r < 0.7) {
            setState(e, 'dive');
            e.hitSet = new Set();
            e.vel.copy(t.pos.clone().setY(t.pos.y + 0.8).sub(e.pos).normalize().multiplyScalar(20));
          } else setState(e, 'summon');
        }
      }
    }
  },
  hueless(e, dt, t, mgr) {
    e.stateT += dt;
    if (!t) { e.state = 'idle'; return; }
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
      e.phase = 2;
      mgr.fx('roar', e.pos);
      G.net?.send({ t: 'efx', k: 'phase2', p: [e.pos.x, e.pos.y, e.pos.z] });
      G.hud.toast('The Hueless King is enraged!', '#e0c8ff', 3);
      if (G.cine) G.cine.focus(e, 'The Hueless King', 'rises in fury', 2.4);
      e.introT = 2.4;
    }
    const p2 = e.phase === 2;
    // Periodic shield colour shift if not broken
    e.shiftT = (e.shiftT || 0) + dt;
    if (e.shieldHp > 0 && e.shiftT > (p2 ? 9 : 13)) { e.shiftT = 0; e.shield = (e.shield + 1) % 4; e.shieldHp = 3; G.audio.play('shield'); }
    const center = e.arena ? new THREE.Vector3(e.arena.x, e.arena.y, e.arena.z) : e.home;
    switch (e.state) {
      case 'idle': case 'chase': case 'recover': {
        e.state = 'chase';
        const goal = t.pos.clone().lerp(center, 0.5);
        moveToward(e, goal, e.def.speed * (p2 ? 1.5 : 1), dt);
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = p2 ? 2.4 : 3.4;
          const r = Math.random();
          setState(e, r < 0.4 ? 'slam' : r < 0.75 ? 'shoot' : 'summon');
        }
        break;
      }
      case 'slam':
        e.vel.x = damp(e.vel.x, 0, 6, dt); e.vel.z = damp(e.vel.z, 0, 6, dt);
        if (e.stateT > 1 && !e.did) {
          e.did = true;
          mgr.fx('slam', e.pos);
          mgr.wave(e.pos, { speed: 13, maxR: 34, dmg: 3, color: 0x2a2433 });
          if (p2) setTimeout(() => { if (e.alive && mgr.isHost) mgr.wave(e.pos, { speed: 16, maxR: 34, dmg: 3, color: 0x4a2a5a }); }, 700);
        }
        if (e.stateT > 1.8) { e.did = false; setState(e, 'recover'); }
        break;
      case 'shoot': // ink rain on every player
        if (e.stateT > 0.6 && !e.did) {
          e.did = true;
          for (const p of mgr.players()) {
            if (!p.alive) continue;
            const n = p2 ? 7 : 5;
            for (let i = 0; i < n; i++) {
              const from = p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 22 + Math.random() * 10, (Math.random() - 0.5) * 10));
              mgr.shoot('rain', from, new THREE.Vector3(0, -6, 0), { dmg: 2, radius: 1.1 });
            }
          }
          G.audio.play('shoot');
        }
        if (e.stateT > 1.4) { e.did = false; setState(e, 'recover'); }
        break;
      case 'summon':
        if (e.stateT > 0.8 && !e.did) {
          e.did = true;
          const n = mgr.list.filter((q) => q.type === 'inkling' && q.alive).length;
          for (let i = 0; i < Math.min(3, 6 - n); i++) {
            const a = Math.random() * Math.PI * 2;
            const pos = center.clone().add(new THREE.Vector3(Math.cos(a) * 15, 1, Math.sin(a) * 15));
            const m = mgr.spawn('inkling', pos, {});
            m.arena = e.arena;
            mgr.fx('summon', pos);
          }
          mgr.fx('roar', e.pos);
        }
        if (e.stateT > 1.5) { e.did = false; setState(e, 'recover'); }
        break;
      default: setState(e, 'chase');
    }
    if (p2) e.vel.y = damp(e.vel.y, (center.y + 3 + Math.sin(G.time) * 1.5 - e.pos.y) * 2, 3, dt);
  },
};

// ====================================================================== render animations
const RENDER = {
  bounder(e) {
    const m = e.model;
    const moving = e.state === 'chase' || e.state === 'attack';
    const hop = moving ? Math.abs(Math.sin(e.anim * (e.state === 'attack' ? 14 : 8))) * 0.35 : 0;
    m.body.position.y = hop;
    m.body.scale.y = e.state === 'windup' ? 0.8 : 1;
    m.body.rotation.x = e.state === 'attack' ? 0.4 : 0;
    m.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(e.anim * 12 + i * 1.6) * 0.6 : 0));
  },
  inkling(e) {
    const m = e.model;
    const w = e.state === 'windup' ? 0.7 : 1 + Math.sin(e.anim * 6) * 0.08;
    m.body.scale.set(1 / Math.sqrt(w), w, 1 / Math.sqrt(w));
  },
  spitter(e) {
    const m = e.model;
    m.head.scale.setScalar(e.state === 'windup' ? 1.2 + Math.sin(e.anim * 30) * 0.05 : 1);
    m.head.rotation.x = e.state === 'shoot' ? -0.4 : Math.sin(e.anim) * 0.1;
    m.body.rotation.z = Math.sin(e.anim * 1.3) * 0.05;
  },
  blotgiant(e) {
    const m = e.model;
    const asleep = e.state === 'sleep';
    m.body.rotation.x = asleep ? -0.25 : e.state === 'stun' ? 0.5 : 0;
    m.body.position.y = asleep ? -1.2 + Math.sin(e.anim * 1.2) * 0.1 : e.state === 'stun' ? -2 : 0;
    m.lid.visible = asleep || e.state === 'stun';
    m.iris.visible = !m.lid.visible;
    const walk = e.state === 'chase' ? Math.sin(e.anim * 3) : 0;
    m.arms[0].rotation.x = e.state === 'slam' ? -2.8 * Math.min(1, e.stateT) : e.state === 'shoot' ? -2.4 : walk * 0.4;
    m.arms[1].rotation.x = e.state === 'slam' ? -2.8 * Math.min(1, e.stateT) : e.state === 'attack' ? -1.2 : -walk * 0.4;
    m.arms[1].rotation.z = e.state === 'attack' ? 1.6 - e.stateT * 2.5 : 0;
    if (asleep && Math.random() < 0.02) G.particles.burst(e.pos.clone().setY(e.pos.y + 8), { count: 1, color: 0xffffff, speed: 0.5, up: 1.5, life: 2, size: 0.6, gravity: -0.4, alpha: 0.7 });
  },
  sentinel(e) {
    const m = e.model;
    const dormant = e.state === 'dormant';
    m.body.position.y = dormant ? -1.8 : e.state === 'wake' ? -1.8 + Math.min(1.8, e.stateT * 1.2) : 0;
    m.eyes.visible = !dormant;
    m.crystal.rotation.y += 0.02;
    m.crystal.material.emissiveIntensity = dormant ? 0.3 : 0.9 + Math.sin(e.anim * 5) * 0.2;
    const k = e.state === 'slam' ? Math.min(1, e.stateT) : 0;
    m.arms.forEach((a, i) => { a.position.y = 2.2 + (e.state === 'slam' ? (k < 0.9 ? k * 3 : -0.5) : Math.sin(e.anim * 2 + i) * 0.2); });
    m.body.rotation.z = e.state === 'chase' ? Math.sin(e.anim * 2) * 0.05 : 0;
  },
  archer(e) {
    const m = e.model;
    m.bow.scale.set(1, 1, e.state === 'windup' ? 1.3 : 1);
    m.body.rotation.x = e.state === 'windup' ? -0.15 : 0;
  },
  dummy(e) {
    // Wobble when struck
    const k = Math.max(0, 0.6 - (G.time - (e.lastHit || -9)));
    e.model.body.rotation.z = Math.sin(G.time * 22) * k * 0.4;
    e.model.body.rotation.x = k * 0.2;
  },
  inkbat(e) {
    const m = e.model;
    const flap = Math.sin(e.anim * (e.state === 'dive' ? 8 : 22));
    m.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (flap * 0.9 + (e.state === 'dive' ? 0.9 : 0.1)); });
    m.body.rotation.x = e.state === 'dive' ? 0.7 : 0.15;
    m.body.position.y = 0.5 + flap * 0.08;
  },
  wisp(e) {
    const m = e.model;
    m.wings.forEach((w, i) => (w.rotation.x = Math.sin(e.anim * 18) * 0.6 * (i ? 1 : -1)));
    m.body.rotation.x = e.state === 'dive' ? 0.8 : 0;
  },
  frostmaw(e) {
    const m = e.model;
    m.armor.visible = e.armor > 0;
    m.armor.scale.setScalar(0.6 + 0.4 * (e.armor / 50));
    const walk = e.state === 'chase' ? Math.sin(e.anim * 4) : 0;
    m.body.rotation.z = walk * 0.05;
    const slam = e.state === 'slam' ? Math.min(1, e.stateT / 1.0) : 0;
    m.arms.forEach((a, i) => {
      a.rotation.x = e.state === 'slam' ? (slam < 1 ? -2.6 * slam : 0.3) : e.state === 'shoot' ? -2.8 : walk * 0.4 * (i ? 1 : -1);
    });
    m.body.rotation.x = e.state === 'stun' ? 0.35 : 0;
  },
  magmaw(e) {
    const m = e.model;
    const frozen = e.status.frozen > 0;
    m.ice.visible = frozen;
    m.lavaMat.color.setHex(frozen ? 0x4a6a8a : 0xff6a20);
    const s = frozen ? 1 : 1 + Math.sin(e.anim * 5) * 0.04;
    m.body.scale.set(s, e.state === 'slam' && e.stateT < 0.5 ? 0.8 : s, s);
    if (!frozen && Math.random() < 0.3) G.particles.flames(e.pos.clone().setY(e.pos.y + 5), 1.5, 1, 1.5);
  },
  shellback(e) {
    const m = e.model;
    const flipped = e.status.stun > 0;
    m.body.rotation.z = damp(m.body.rotation.z, flipped ? Math.PI : 0, 6, 1 / 60);
    m.body.position.y = flipped ? 3 : 0;
    if (e.state === 'roll') { m.body.rotation.x += 0.35; m.legs.forEach((l) => (l.visible = false)); }
    else { m.body.rotation.x = 0; m.legs.forEach((l, i) => { l.visible = true; l.rotation.x = e.state === 'chase' ? Math.sin(e.anim * 8 + i) * 0.4 : flipped ? Math.sin(e.anim * 20 + i) * 0.8 : 0; }); }
  },
  galewing(e) {
    const m = e.model;
    const grounded = e.status.rooted > 0;
    m.vines.visible = grounded;
    const flap = grounded ? 0.3 : Math.sin(e.anim * (e.state === 'dive' ? 3 : 7));
    m.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * flap * 0.6));
    m.body.position.y = 2;
    m.body.rotation.x = e.state === 'dive' ? 0.9 : 0;
  },
  hueless(e) {
    const m = e.model;
    m.shield.visible = e.shieldHp > 0;
    m.shieldMat.color.setHex(COLORS[e.shield].hex);
    m.shieldMat.opacity = 0.2 + 0.08 * e.shieldHp + Math.sin(e.anim * 4) * 0.05;
    m.shield.rotation.y += 0.01;
    m.tendrils.forEach((t, i) => (t.rotation.x = Math.sin(e.anim * 2 + i) * 0.3 + (e.state === 'slam' ? -0.6 : 0)));
    m.body.position.y = Math.sin(e.anim * 1.5) * 0.4;
    m.body.rotation.x = e.state === 'stun' ? 0.3 : 0;
    m.eye.scale.setScalar(e.state === 'stun' ? 0.6 : 1);
  },
};

export { ELEMENTS };

// Brushbucks: herds of painted deer graze in the meadows. Sneak up and mount one, then hold on
// (it bucks, costing stamina) to tame it. Your Brushbuck trots, gallops with Sprint and jumps;
// whistle (X) and it runs to you. Wild bucks bolt if you rush at them. Taming is per player
// and kept in your local save; friends see you riding.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';
import { VILLAGE } from './layout.js';
import { makeCharacter } from '../player/character.js';
import { MAT } from './props.js';

export const COATS = [
  { name: 'Sienna', hex: 0xb8643a },
  { name: 'Umber', hex: 0x6a4a32 },
  { name: 'Saffron', hex: 0xd8a040 },
  { name: 'Dapple', hex: 0x9a9a9a },
  { name: 'Cobalt', hex: 0x4a6aa8 },
];
export const NAMES = ['Juniper', 'Cinder', 'Bramble', 'Pebble', 'Tansy', 'Ochre'];
export const STABLE_ANGLE = Math.PI * 0.95;
export const TAME_TIME = 1.8;
export const TAME_COST = 45; // stamina spent holding on
export const TROT = 9, GALLOP = 15.5, BUCK_JUMP = 12;
export const RIDE_Y = 1.02; // rider hip above the ground
const FLEE_R = 11;

// Can this player hold on long enough to tame a wild buck?
export const canTame = (stamina, exhausted) => !exhausted && stamina >= TAME_COST * 0.6;

export function herdSites(terrain, n = 3, seed = 3131) {
  const rand = mulberry32(seed);
  const out = [];
  for (let i = 0; i < 5000 && out.length < n; i++) {
    const a = rand() * Math.PI * 2, d = 90 + rand() * 480;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = terrain.heightAt(x, z);
    if (h < 4 || h > 60 || terrain.normalAt(x, z).y < 0.93) continue;
    const w = terrain.biome(x, z);
    const dom = Object.entries(w).sort((p, q) => q[1] - p[1])[0][0];
    if (dom !== 'meadow') continue;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 25) continue;
    if (out.some((q) => Math.hypot(q.x - x, q.z - z) < 160)) continue;
    out.push({ x, z, y: h });
  }
  return out;
}

const tint = (geo, hex) => {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo.index ? geo.toNonIndexed() : geo;
};

// Shared geometry: one coat-coloured body, one vertex-coloured set of details, and a leg
function buckGeometry() {
  const body = [
    new THREE.CapsuleGeometry(0.42, 1.1, 6, 12).rotateX(Math.PI / 2).scale(1, 1, 1).translate(0, 1.18, 0),
    new THREE.CylinderGeometry(0.2, 0.3, 0.85, 10).rotateX(-0.75).translate(0, 1.62, 0.78),
    new THREE.SphereGeometry(0.27, 12, 10).scale(0.9, 0.9, 1.25).translate(0, 2.0, 1.1),
    new THREE.ConeGeometry(0.16, 0.42, 10).rotateX(Math.PI / 2).translate(0, 1.93, 1.42),
    new THREE.ConeGeometry(0.12, 0.34, 6).rotateX(-2.2).translate(0, 1.32, -0.95),
  ].map((g) => g.toNonIndexed());
  body.forEach((g) => g.deleteAttribute('uv'));
  const parts = [];
  // Cream belly patch and white painted spots along the back
  parts.push(tint(new THREE.SphereGeometry(0.36, 10, 8).scale(0.9, 0.5, 1.9).translate(0, 0.98, 0.02), 0xf2e6cc));
  for (let i = 0; i < 7; i++) {
    const s = 0.07 + (i % 3) * 0.02;
    parts.push(tint(new THREE.SphereGeometry(s, 6, 4).scale(1, 0.4, 1).translate(((i % 2) * 2 - 1) * 0.22, 1.55 - Math.abs(i - 3) * 0.02, -0.6 + i * 0.18), 0xfff8ec));
  }
  // Antlers painted in the four colours, ears, eyes, nose, tail tuft
  const antlerCols = [0xe8442e, 0x3a9ae8, 0xf2c229, 0x3fb54a];
  for (const s of [-1, 1]) {
    parts.push(tint(new THREE.CylinderGeometry(0.03, 0.045, 0.6, 5).rotateZ(-s * 0.4).translate(s * 0.18, 2.4, 1.02), 0xe8dcc0));
    parts.push(tint(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 5).rotateZ(-s * 1.0).rotateX(0.4).translate(s * 0.34, 2.55, 1.1), antlerCols[s < 0 ? 0 : 1]));
    parts.push(tint(new THREE.CylinderGeometry(0.025, 0.035, 0.3, 5).rotateZ(-s * 0.1).rotateX(-0.3).translate(s * 0.28, 2.72, 0.96), antlerCols[s < 0 ? 2 : 3]));
    parts.push(tint(new THREE.ConeGeometry(0.08, 0.26, 5).rotateZ(-s * 1.1).translate(s * 0.28, 2.14, 0.98), 0x8a5a3a));
    parts.push(tint(new THREE.SphereGeometry(0.045, 6, 5).translate(s * 0.16, 2.06, 1.3), 0x1a1410));
  }
  parts.push(tint(new THREE.SphereGeometry(0.06, 6, 5).translate(0, 1.95, 1.63), 0x2a1a14));
  parts.push(tint(new THREE.SphereGeometry(0.1, 6, 5).translate(0, 1.18, -1.12), 0xfff8ec));
  parts.forEach((g) => g.deleteAttribute('uv'));
  // Saddle and a painted blanket (only shown once tamed)
  const saddle = mergeGeometries([
    tint(new THREE.BoxGeometry(0.95, 0.06, 0.8).translate(0, 1.58, 0.05), 0xe8442e),
    tint(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.6, 1).translate(0, 1.62, 0.05), 0x6a3a1a),
    tint(new THREE.BoxGeometry(0.08, 0.14, 0.06).translate(0, 1.72, 0.32), 0x6a3a1a),
  ].map((g) => { g.deleteAttribute('uv'); return g; }));
  const leg = new THREE.CylinderGeometry(0.075, 0.05, 1.0, 6).translate(0, -0.5, 0);
  const hoof = tint(new THREE.CylinderGeometry(0.07, 0.085, 0.12, 6).translate(0, -1.0, 0), 0x2a1e18);
  return { body: mergeGeometries(body), details: mergeGeometries(parts), saddle, leg, hoof };
}

export class Steeds {
  constructor(scene) {
    this.geo = buckGeometry();
    this.detailMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.hoofMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.root = new THREE.Group();
    scene.add(this.root);
    this.sites = herdSites(G.terrain);
    this.list = [];
    const rand = mulberry32(8080);
    this.sites.forEach((s, hi) => {
      for (let k = 0; k < 3; k++) {
        const a = rand() * Math.PI * 2, d = 3 + rand() * 7;
        const coat = (hi * 3 + k) % COATS.length;
        this._make(coat, new THREE.Vector3(s.x + Math.cos(a) * d, 0, s.z + Math.sin(a) * d), s);
      }
    });
    this.mine = null;
    this.whistleT = 0;
    this._stable(scene);
  }

  // Stable post at the edge of Palette Hollow: Rosa renames your buck or fetches it for you
  _stable(scene) {
    const a = STABLE_ANGLE, R = VILLAGE.r - 12;
    const x = VILLAGE.x + Math.cos(a) * R, z = VILLAGE.z + Math.sin(a) * R;
    const y = G.terrain.heightAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(VILLAGE.x - x, VILLAGE.z - z);
    // Hitching rail, water trough and a painted sign
    for (const px of [-2.2, 2.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.3, 6), MAT.woodDark);
      post.position.set(px, 0.65, -1.5);
      g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 0.12), MAT.wood);
    rail.position.set(0, 1.15, -1.5);
    const trough = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.7), MAT.wood);
    trough.position.set(-3.4, 0.25, -0.6);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4a9ad8, emissive: 0x10304a }));
    water.position.set(-3.4, 0.46, -0.6);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.08), new THREE.MeshLambertMaterial({ color: 0xd8a040 }));
    sign.position.set(3.4, 1.9, -1.5);
    const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 6), MAT.woodDark);
    signPost.position.set(3.4, 0.95, -1.55);
    g.add(rail, trough, water, sign, signPost);
    this.npc = makeCharacter({ hood: 0x8a5a3a, scarf: 0xd8a040, skin: 0xe0b890, tunic: 0x5a7a4a });
    this.npc.brush.visible = false;
    this.npc.group.position.set(1.2, 0, 0.4);
    g.add(this.npc.group);
    scene.add(g);
    this.stable = g;
    this.stablePos = new THREE.Vector3(x, y, z);
    G.collision.addBox(x, y + 0.5, z, 1.2, 1, 1.2);
    G.world.interactables.push({
      pos: this.stablePos.clone().setY(y + 1), radius: 3.4,
      prompt: () => 'Talk to Rosa the Stablehand',
      action: () => this.talk(),
    });
  }

  talk() {
    const b = this.mine;
    if (!b) {
      G.hud.dialog('Rosa the Stablehand', 'Brushbucks graze in the open meadows. Creep up quietly, climb on and hold tight until it settles. Bring it by once you have one and I\'ll look after it!');
      return;
    }
    G.hud.choice('Rosa the Stablehand', `How's ${b.name} doing? A fine buck.`, ['Rename my Brushbuck', `Bring ${b.name} here`, 'Goodbye'], (i) => {
      if (i === 0) {
        const opts = NAMES.filter((n) => n !== b.name).slice(0, 4);
        G.hud.choice('Rosa the Stablehand', 'What shall we call it?', [...opts, `Keep "${b.name}"`], (k) => {
          if (k < opts.length) { b.name = opts[k]; G.hud.toast(`Your Brushbuck is now called ${b.name}`, '#ffd890', 2); G.audio.play('pickup'); }
        });
      } else if (i === 1) {
        if (G.player.mounted === b) this.dismount();
        const s = this.stablePos;
        const back = new THREE.Vector3(-Math.sin(this.stable.rotation.y), 0, -Math.cos(this.stable.rotation.y));
        b.pos.set(s.x + back.x * 2.5, 0, s.z + back.z * 2.5);
        b.pos.y = G.terrain.heightAt(b.pos.x, b.pos.z);
        b.state = 'graze'; b.t = 8;
        G.hud.dialog('Rosa the Stablehand', `${b.name} is tied at the rail. Take good care!`);
      }
    });
  }

  // Just the model (also used to show friends' mounts)
  visual(coat) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: COATS[coat].hex });
    const body = new THREE.Mesh(this.geo.body, mat);
    const details = new THREE.Mesh(this.geo.details, this.detailMat);
    const saddle = new THREE.Mesh(this.geo.saddle, this.detailMat);
    saddle.visible = false;
    body.castShadow = true;
    g.add(body, details, saddle);
    const legs = [];
    for (const [x, z] of [[-0.24, 0.6], [0.24, 0.6], [-0.24, -0.55], [0.24, -0.55]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.05, z);
      const m = new THREE.Mesh(this.geo.leg, mat);
      const h = new THREE.Mesh(this.geo.hoof, this.hoofMat);
      h.position.y = 0.05;
      pivot.add(m, h);
      g.add(pivot);
      legs.push(pivot);
    }
    return { g, legs, saddle };
  }

  _make(coat, pos, herd) {
    const { g, legs, saddle } = this.visual(coat);
    pos.y = G.terrain.heightAt(pos.x, pos.z);
    g.position.copy(pos);
    this.root.add(g);
    const b = {
      id: this.list.length, coat, name: COATS[coat].name, g, legs, saddle, herd,
      pos: g.position, yaw: Math.random() * Math.PI * 2, vel: new THREE.Vector3(), speed: 0,
      state: 'graze', t: 1 + Math.random() * 4, target: null, phase: Math.random() * 10,
      owned: false, rider: false, taming: 0, flee: 0,
      ipos: new THREE.Vector3(),
    };
    G.world.interactables.push({
      pos: b.ipos, radius: 2.6,
      enabled: () => this._canMount(b),
      prompt: () => (b.owned ? `Ride ${b.name}` : 'Mount the wild Brushbuck'),
      action: () => this.mount(b),
    });
    this.list.push(b);
    return b;
  }

  _canMount(b) {
    const p = G.player;
    if (!p || p.mounted || b.rider || p.state === 'ride' || p.state === 'swim' || p.inDungeon) return false;
    return b.owned || (b.state !== 'flee' && p.sneaking);
  }

  mount(b) {
    const p = G.player;
    if (!this._canMount(b)) return;
    p.mounted = b;
    b.rider = true;
    p.pos.set(b.pos.x, b.pos.y + 0.05, b.pos.z);
    p.vel.set(0, 0, 0);
    p.yaw = b.yaw;
    p.state = 'ground';
    p.sneakOn = false;
    G.audio.play('jump');
    if (b.owned && !G.guide?.seen.has('buck')) { G.guide?.seen.add('buck'); G.hud.toast('Sprint to gallop, Space to jump, Interact to climb down.', '#ffd890', 3.5); }
    if (!b.owned) {
      b.taming = TAME_TIME;
      G.hud.toast('Hold on! Taming costs stamina…', '#ffd890', 1.8);
      G.audio.play('bossRoar', 0.25);
    }
  }

  dismount(thrown = false) {
    const p = G.player;
    const b = p?.mounted;
    if (!b) return;
    p.mounted = null;
    b.rider = false;
    b.taming = 0;
    b.yaw = p.yaw;
    const side = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    p.pos.addScaledVector(side, 1.2);
    p.pos.y += 0.6;
    p.state = 'air';
    if (thrown) {
      p.vel.copy(side).multiplyScalar(5).setY(6);
      b.state = 'flee'; b.flee = 3;
      G.hud.toast('Thrown off! You need more stamina to tame a Brushbuck.', '#ffb0b0', 2.5);
      G.audio.play('hit');
    }
  }

  _tamed(b) {
    const p = G.player;
    if (this.mine && this.mine !== b) {
      // Your old buck wanders back to its herd
      this.mine.owned = false;
      this.mine.saddle.visible = false;
    }
    b.owned = true;
    b.saddle.visible = true;
    this.mine = b;
    b.taming = 0;
    G.audio.play('solve');
    G.hud.banner(`You tamed ${b.name}!`, 'Whistle (X) to call your Brushbuck. Sprint to gallop.', '#ffd890');
    G.particles.burst(p.pos.clone().setY(p.pos.y + 1.6), { count: 40, color: 0xffd890, speed: 5, up: 3, life: 1, size: 0.5, pool: 'glow', gravity: 1 });
    G.honours?.event('tame');
  }

  whistle() {
    const p = G.player;
    if (!p || p.inDungeon) return;
    G.audio.play('glint');
    G.hud.caption?.('You whistle', p.pos);
    const b = this.mine;
    if (!b) { G.hud.toast('You have no Brushbuck yet. Tame one in the meadows!', '#dddddd', 2); return; }
    if (p.mounted) return;
    const d = b.pos.distanceTo(p.pos);
    if (d > 160) {
      // Too far to hear: it arrives from just out of sight
      const a = p.camYaw;
      b.pos.set(p.pos.x + Math.sin(a) * 45, 0, p.pos.z + Math.cos(a) * 45);
      b.pos.y = Math.max(G.terrain.heightAt(b.pos.x, b.pos.z), 0);
    }
    b.state = 'called';
    b.t = 30;
  }

  serialize() { return this.mine ? { id: this.mine.id, name: this.mine.name, p: [this.mine.pos.x, this.mine.pos.z].map((v) => +v.toFixed(1)) } : null; }

  load(d) {
    const b = d && this.list[d.id];
    if (!b) return;
    b.owned = true;
    b.saddle.visible = true;
    if (typeof d.name === 'string' && d.name) b.name = d.name.slice(0, 16);
    if (Array.isArray(d.p)) { b.pos.set(d.p[0], 0, d.p[1]); b.pos.y = G.terrain.heightAt(b.pos.x, b.pos.z); }
    this.mine = b;
  }

  _legs(b, dt, speed, airborne) {
    b.phase = (b.phase || 0) + dt * (2 + speed * 0.9);
    const amp = airborne ? 0 : Math.min(0.75, speed * 0.07);
    b.legs.forEach((l, i) => {
      const off = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5][i];
      l.rotation.x = airborne ? (i < 2 ? -0.7 : 0.6) : Math.sin(b.phase + off) * amp;
    });
  }

  _groundMove(b, dt, want, speed) {
    const dx = want.x - b.pos.x, dz = want.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) return true;
    const ty = Math.atan2(dx, dz);
    let dy = ty - b.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    b.yaw += dy * Math.min(1, dt * 4);
    const nx = b.pos.x + Math.sin(b.yaw) * speed * dt, nz = b.pos.z + Math.cos(b.yaw) * speed * dt;
    const h = G.terrain.heightAt(nx, nz);
    if (h < 0.4) { b.yaw += Math.PI * 0.6; return true; } // won't walk into the water
    b.pos.set(nx, h, nz);
    b.speed = speed;
    return false;
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.root.visible = !p.inDungeon;
    if (G.input.hit('KeyX')) this.whistle();
    if (this.npc && this.stablePos.distanceTo(p.pos) < 50) this.npc.animate({ state: 'idle', speed: 0 }, dt);
    const m = p.mounted;
    if (m && (p.inDungeon || p.state === 'swim' || p.state === 'ride' || !p.alive)) this.dismount();
    // Interact climbs down, unless there's something else to interact with
    else if (m && !m.taming && !p.interactTarget && G.input.hit('KeyF')) this.dismount();
    for (const b of this.list) {
      const dp = b.pos.distanceTo(p.pos);
      b.ipos.set(b.pos.x, b.pos.y + 1, b.pos.z);
      if (b.rider) {
        // A teleport (respawn, trial, fast travel) leaves the buck behind
        if (b.pos.distanceTo(p.pos) > 8) { this.dismount(); continue; }
        // Carried by the player's own movement
        b.pos.set(p.pos.x, p.pos.y, p.pos.z);
        b.yaw = p.yaw;
        const hv = Math.hypot(p.vel.x, p.vel.z);
        this._legs(b, dt, hv, p.state === 'air');
        b.g.rotation.set(0, b.yaw, 0);
        if (b.taming > 0) {
          b.taming -= dt;
          // Bucking wildly while you hold on
          b.g.rotation.x = Math.sin(G.time * 14) * 0.25;
          p.useStamina(TAME_COST / TAME_TIME * dt);
          if (p.exhausted) { this.dismount(true); continue; }
          if (b.taming <= 0) this._tamed(b);
        }
        continue;
      }
      b.g.visible = dp < 220;
      if (!b.g.visible && b.state !== 'called') continue;
      b.g.rotation.set(0, b.yaw, 0);
      if (dp > 160 && b.state !== 'called') continue;
      b.speed = 0;
      // Wild bucks bolt from anyone rushing at them
      if (!b.owned && b.state !== 'flee') {
        const riding = p.state === 'ride';
        if (p.alive && ((dp < FLEE_R && !p.sneaking && !p.mounted) || (riding && dp < 25))) {
          b.state = 'flee'; b.flee = 3 + Math.random();
        }
      }
      if (b.state === 'flee') {
        b.flee -= dt;
        const away = b.pos.clone().sub(p.pos).setY(0).normalize().multiplyScalar(20).add(b.pos);
        this._groundMove(b, dt, away, 11);
        if (b.flee <= 0) { b.state = 'graze'; b.t = 3; }
      } else if (b.state === 'called') {
        b.t -= dt;
        if (this._groundMove(b, dt, p.pos, dp > 12 ? 13 : 5) || dp < 3.2 || b.t <= 0) { b.state = 'graze'; b.t = 6; }
      } else if (b.state === 'walk') {
        if (this._groundMove(b, dt, b.target, 1.6)) { b.state = 'graze'; b.t = 3 + Math.random() * 6; }
      } else {
        b.t -= dt;
        if (b.t <= 0) {
          const c = b.owned ? b.pos : b.herd;
          const a = Math.random() * Math.PI * 2, r = Math.random() * (b.owned ? 3 : 10);
          b.target = new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
          b.state = 'walk';
        }
      }
      this._legs(b, dt, b.speed, false);
      // Grazing: dip now and then
      b.g.rotation.x = b.state === 'graze' ? Math.max(0, Math.sin(G.time * 0.8 + b.id)) * 0.08 : 0;
    }
    const tb = p.mounted;
    if (tb && tb.taming > 0) { G.hud.setRush?.(`Hold on! ${tb.taming.toFixed(1)}s`, 'Taming'); this._taming = true; } else if (this._taming) { this._taming = false; G.hud.setRush?.(null); }
  }

  // Leg swing for a friend's mount
  animateVisual(v, dt, speed, airborne) { this._legs(v, dt, speed, airborne); }

  mapMarkers(add) {
    if (this.mine) add(this.mine.pos.x, this.mine.pos.z, 'mq', '#ffd890', this.mine.name);
  }
}

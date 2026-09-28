// Your own cottage: an empty plot on the south side of Palette Hollow is for sale. Once bought, the
// cottage goes up, you can paint its roof, rest in bed until morning, evening or night, and a trophy
// garden out front fills with painted figurines of every great foe you've beaten. Ownership and the
// roof colour are kept in your local save; each player has their own.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { VILLAGE } from './layout.js';
import { MAT, smoothRockGeometry } from './props.js';
import { mergeStatic } from './merge.js';
import { buildFrostmaw, buildMagmaw, buildShellback, buildGalewing, buildHueless, buildBlotGiant, buildSentinel, buildRainmane } from '../enemies/models.js';

export const HOME_COST = 80;
export const HOME_AT = { dx: -6, dz: -46 };
export const ROOFS = [
  { name: 'Brick red', hex: 0xc85a48 },
  { name: 'Lake blue', hex: 0x5a88c0 },
  { name: 'Sunflower', hex: 0xe0b040 },
  { name: 'Moss green', hex: 0x5aa04a },
  { name: 'Plum', hex: 0x8a5aa8 },
];
export const REST = [
  { name: 'morning', t: 0.3 },
  { name: 'evening', t: 0.72 },
  { name: 'night', t: 0.9 },
];

// Trophies, in the order they stand along the garden path
export const TROPHIES = [
  { id: 'frostmaw', flag: 'trial_ember', name: 'Frostmaw', build: buildFrostmaw, color: COLORS[0].hex },
  { id: 'magmaw', flag: 'trial_frost', name: 'Magmaw', build: buildMagmaw, color: COLORS[1].hex },
  { id: 'shellback', flag: 'trial_spring', name: 'Shellback', build: buildShellback, color: COLORS[2].hex },
  { id: 'galewing', flag: 'trial_bloom', name: 'Galewing', build: buildGalewing, color: COLORS[3].hex },
  { id: 'blotgiant', flag: 'slain_blotgiant', name: 'Blot Giant', build: buildBlotGiant, color: 0x6a5a8a },
  { id: 'sentinel', flag: 'slain_sentinel', name: 'Stone Sentinel', build: () => buildSentinel(smoothRockGeometry), color: 0x8a8a7a },
  { id: 'rainmane', flag: 'slain_rainmane', name: 'Rainmane', build: buildRainmane, color: 0x4a9ac8 },
  { id: 'hueless', flag: 'final', name: 'The Hueless King', build: buildHueless, color: 0xe8e2d4 },
];

// A little porcelain figurine of a boss, about a metre tall, glazed in one colour
function figurine(t) {
  const m = t.build();
  const g = m.group;
  const glaze = new THREE.MeshLambertMaterial({ color: t.color, emissive: t.color, emissiveIntensity: 0.12 });
  g.traverse((o) => { if (o.isMesh) o.material = glaze; });
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  const k = 1.1 / Math.max(size.y, size.x * 0.8, size.z * 0.8, 0.01);
  g.scale.setScalar(k);
  g.position.y = -box.min.y * k;
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

export class Home {
  constructor(scene) {
    this.owned = false;
    this.roof = 0;
    this.scene = scene;
    const x = VILLAGE.x + HOME_AT.dx, z = VILLAGE.z + HOME_AT.dz;
    this.y = G.terrain.heightAt(x, z);
    this.pos = new THREE.Vector3(x, this.y, z);
    this.roofMat = MAT.roofRed.clone();
    this.roofMat.color.setHex(ROOFS[0].hex);
    this.house = null;
    // The plot: a bare plinth and a "for sale" sign
    this.plot = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 6.5), MAT.stone);
    base.position.y = 0.1;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 6), MAT.woodDark);
    post.position.set(3.2, 0.9, 4.2);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.08), MAT.wood);
    sign.position.set(3.2, 1.55, 4.25);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.42), new THREE.MeshLambertMaterial({ color: 0xf2e6c8 }));
    tag.position.set(3.2, 1.55, 4.3);
    this.plot.add(base, post, sign, tag);
    this.plot.position.copy(this.pos);
    scene.add(this.plot);
    this.garden = new THREE.Group();
    scene.add(this.garden);
    this.gardenKey = '';
    const door = this.pos.clone().add(new THREE.Vector3(0, 1.2, 3.6));
    G.world.interactables.push({
      pos: door, radius: 3,
      enabled: () => !G.player.inDungeon,
      prompt: () => (this.owned ? 'Go inside' : `Buy the cottage (${HOME_COST} Pigment)`),
      action: () => (this.owned ? this.open() : this.buy()),
    });
  }

  buy() {
    const p = G.player;
    G.hud.choice('Elder Umber\'s notice', `A snug cottage for a painter who's settling in: ${HOME_COST} Pigment. You have ${p.pigment}.`, [`Buy it (${HOME_COST} Pigment)`, 'Not now'], (k) => {
      if (k !== 0) return;
      if (p.pigment < HOME_COST) { G.hud.toast(`You need ${HOME_COST - p.pigment} more Pigment`, '#ffb0b0', 2); return; }
      p.pigment -= HOME_COST;
      this.owned = true;
      this._build();
      G.audio.play('quest');
      G.hud.banner('Home Sweet Home', 'The cottage is yours. Rest here, paint the roof, and fill the garden with trophies.', '#ffe08a');
      G.honours?.event('home');
    });
  }

  _build() {
    if (this.house || !this.owned) return;
    this.plot.visible = false;
    const before = G.world.root.children.length;
    G.world._cottage(this.pos.x, this.pos.z, 0, this.roofMat);
    this.house = G.world.root.children[before];
    this._garden(true);
  }

  // Figurines on little plinths either side of the path, one per great foe beaten
  _garden(force = false) {
    if (!this.owned) return;
    const key = TROPHIES.map((t) => (G.flags[t.flag] ? 1 : 0)).join('');
    if (!force && key === this.gardenKey) return;
    this.gardenKey = key;
    for (const c of [...this.garden.children]) this.garden.remove(c);
    const g = new THREE.Group();
    TROPHIES.forEach((t, i) => {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      const px = side * 2.4, pz = 5 + row * 1.9;
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.6, 8), MAT.stone);
      plinth.position.set(px, 0.3, pz);
      g.add(plinth);
      if (!G.flags[t.flag]) return;
      const f = figurine(t);
      f.position.set(px, 0.6, pz);
      f.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(f);
    });
    // Stepping stones up the path
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 8), MAT.stoneDark);
      s.position.set((k % 2 ? 0.2 : -0.2), 0.02, 4.4 + k * 1.7);
      g.add(s);
    }
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    g.position.copy(this.pos);
    this.garden.add(g);
    mergeStatic(g);
  }

  mapMarkers(add) { add(this.pos.x, this.pos.z, 'mq', '#c89a5a', this.owned ? '🏠 Your cottage' : `Cottage for sale (${HOME_COST} Pigment)`); }

  trophyCount() { return TROPHIES.filter((t) => G.flags[t.flag]).length; }

  open() {
    const host = !G.net || G.net.isHost;
    const opts = [...REST.map((r) => `Rest until ${r.name}`), `Paint the roof (now ${ROOFS[this.roof].name})`, 'Leave'];
    const n = this.trophyCount();
    const text = `Home, warm and quiet. Trophy garden: ${n}/${TROPHIES.length}${n < TROPHIES.length ? ' (great foes you defeat appear out front)' : ', every great foe'}.`;
    G.hud.choice('Your cottage', text, opts, (k) => {
      if (k < REST.length) {
        if (!host) { G.hud.toast('Only the room\'s host can change the time of day', '#ffb0b0', 2.5); return; }
        this.rest(REST[k]);
      } else if (k === REST.length) {
        this.setRoof((this.roof + 1) % ROOFS.length);
        G.hud.toast(`Roof painted ${ROOFS[this.roof].name}`, `#${ROOFS[this.roof].hex.toString(16).padStart(6, '0')}`, 2);
        G.audio.play('solve', 0.6);
      }
    });
  }

  rest(r) {
    const p = G.player;
    G.hud.flash('rgba(20,16,30,0.95)');
    G.sky.setTime(r.t);
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.exhausted = false;
    G.audio.play('memory', 0.6);
    G.hud.toast(`You rest until ${r.name}. Fully refreshed!`, '#c8d8ff', 3);
  }

  setRoof(i) {
    this.roof = ((i % ROOFS.length) + ROOFS.length) % ROOFS.length;
    this.roofMat.color.setHex(ROOFS[this.roof].hex);
  }

  update() {
    if (!this.owned || G.time - (this._t || 0) < 2) return;
    this._t = G.time;
    this._garden();
  }

  serialize() { return { owned: this.owned, roof: this.roof }; }
  load(d) {
    if (!d || typeof d !== 'object') return;
    this.setRoof(Number(d.roof) || 0);
    if (d.owned) { this.owned = true; this._build(); }
  }
}

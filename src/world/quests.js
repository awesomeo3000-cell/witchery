// Villager side quests: four Palette Hollow residents with small errands. Progress lives in shared
// flags (q_<id> accepted, q_<id>_done finished, plus per-quest step flags) so co-op friends share
// them, and rewards are permanent upgrades or charms that everyone in the room benefits from.
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { VILLAGE, RUINS } from './layout.js';
import { makeCharacter } from '../player/character.js';
import { INGREDIENTS } from './forage.js';
import { MAT, jitter } from './props.js';

const flag = (k) => !!G.flags[k];
const setFlag = (k, v = true) => G.trials._setFlag(k, v);

// Grey statues for Ochre's quest, one per colour, beside four of the old ruins
const STATUES = [0, 1, 2, 3].map((i) => ({ i, x: RUINS[i].x + 7, z: RUINS[i].z - 5 }));
const MIRA_NEEDS = { pepper: 3, lily: 2 };

// Ambient lines villagers call out when you wander past
const BARKS = {
  mira: ['Red from peppers, blue from lilies... simple!', 'Mind the vats, they stain everything.', 'The festival needs every colour we can find.'],
  tilly: ['Wanna race? Oh wait, you can FLY.', 'I saw a sky whale once. Probably.', 'Grandpa Umber says the sky used to be even bluer!'],
  bram: ['Keep your brush up and your eyes open.', 'Those Inkbats come out after dark. Nasty.', 'A good hunter watches before striking.'],
  ochre: ['Every grey thing is just a painting waiting to happen.', 'Hold still... no, never mind, keep moving.', 'Have you seen the light over the mesas at dusk?'],
};
const NIGHT_BARKS = ['Warm pot, good company.', "Can't sleep with the ink creatures about.", 'Stay by the fire a while.'];
// At night the villagers gather to sit around the cooking pot
const POT = { x: 9, z: -6 };

export const QUESTS = [
  {
    id: 'mira', giver: 'Mira the Dyer', title: 'Dyes for the Festival',
    look: { hood: 0xc0463a, scarf: 0xf2c229, skin: 0xe0b890, tunic: 0x6a3a5a }, at: [-20, 0],
    intro: 'The Colour Festival is coming and my vats are empty! Could you gather 3 Emberpeppers from the warm hills and 2 Frostlilies from the snowy north?',
    reward: 'upg_stamina_mira', rewardText: 'Stamina wheel extended',
    steps: () => Object.entries(MIRA_NEEDS).map(([k, n]) => ({ text: `${INGREDIENTS[k].name} ${Math.min(n, G.forage.inv[k])}/${n}`, done: G.forage.inv[k] >= n })),
    ready: () => Object.entries(MIRA_NEEDS).every(([k, n]) => G.forage.inv[k] >= n),
    turnIn: () => { for (const [k, n] of Object.entries(MIRA_NEEDS)) G.forage.inv[k] -= n; },
    waiting: 'Emberpeppers grow in the east near the volcano; Frostlilies bloom only in the cold north.',
    thanks: 'Look at those colours! This will be the brightest festival in a hundred years.',
  },
  {
    id: 'tilly', giver: 'Tilly', title: "Tilly's Lost Kite", child: true,
    look: { hood: 0x4aa0e0, scarf: 0xffe08a, skin: 0xf2d0b0, tunic: 0x3a6a5a }, at: [8, 26],
    intro: 'My kite! The wind took it way up onto one of the floating islands, west over the lake. Can you fly up there and get it back? Please?',
    reward: 'upg_heart_tilly', rewardText: 'Heart container +1',
    steps: () => [{ text: 'Find the kite on a sky islet west of the village', done: flag('q_kite_got') }],
    ready: () => flag('q_kite_got'),
    waiting: 'It went west, over the lake! Ride your brush (R) to get up high.',
    thanks: 'You found it! I will tie it down properly this time. Probably.',
  },
  {
    id: 'bram', giver: 'Bram the Hunter', title: 'Giants of the Field',
    look: { hood: 0x5a6a3a, scarf: 0x8a5a2e, skin: 0xc89a78, tunic: 0x4a3a2a }, at: [22, 0],
    intro: 'Two old terrors roam the fields: the sleeping Blot Giants and the Stone Sentinels. Bring one of each down and I will give you my lucky charm.',
    reward: 'charm_power', rewardText: "Hunter's Charm: strikes deal 15% more damage",
    steps: () => [
      { text: 'Defeat a Blot Giant (aim for its eye)', done: flag('slain_blotgiant') },
      { text: 'Defeat a Stone Sentinel (strike its back crystal)', done: flag('slain_sentinel') },
    ],
    ready: () => flag('slain_blotgiant') && flag('slain_sentinel'),
    waiting: 'Blot Giants nap in the open meadows. Sentinels look just like boulders until you get close.',
    thanks: 'Ha! I knew that brush was more than a toy. Keep the charm, you have earned it.',
  },
  {
    id: 'ochre', giver: 'Painter Ochre', title: 'The Grey Statues',
    look: { hood: 0xe0a040, scarf: 0x5a8ad8, skin: 0xe8c4a0, tunic: 0x7a5a3a }, at: [-4, -24],
    intro: 'Out by the old ruins stand four statues the Hueless King drained grey. Each once held one colour. Paint each with its own hue and they will wake again.',
    reward: 'charm_ink', rewardText: "Ochre's Palette: ink refills 50% faster",
    steps: () => STATUES.map((s) => ({ text: `${COLORS[s.i].name} statue`, done: flag(`q_statue_${s.i}`) })),
    ready: () => STATUES.every((s) => flag(`q_statue_${s.i}`)),
    waiting: 'Look for the grey figures near the ruins. The faint gem on each one tells you its colour.',
    thanks: 'They shine again! Take my palette: the pigment in it never quite runs dry.',
  },
];

export class Quests {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.npcs = [];
    this.statues = [];
    this.seenField = new Set();
    this._villagers();
    this._kite();
    this._statues();
    this._markers();
  }

  _villagers() {
    const { x: vx, z: vz } = VILLAGE;
    for (const q of QUESTS) {
      const c = makeCharacter(q.look);
      const x = vx + q.at[0], z = vz + q.at[1];
      const y = G.terrain.heightAt(x, z);
      c.group.position.set(x, y, z);
      c.group.rotation.y = Math.atan2(vx - x, vz - z);
      if (q.child) c.group.scale.setScalar(0.78);
      c.brush.visible = q.id === 'ochre';
      if (q.id === 'ochre') { c.brush.scale.setScalar(0.5); }
      this.root.add(c.group);
      const col = G.collision.addCylinder(x, z, 0.5, y, y + 1.8, { dynamic: true });
      const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glyph('!'), depthWrite: false, transparent: true, fog: false }));
      mark.scale.set(1.3, 1.3, 1);
      mark.position.set(x, y + (q.child ? 2.4 : 2.9), z);
      this.root.add(mark);
      const i = this.npcs.length;
      const na = (i / QUESTS.length) * Math.PI * 2 + 0.4;
      const night = new THREE.Vector3(vx + POT.x + Math.cos(na) * 2.6, 0, vz + POT.z + Math.sin(na) * 2.6);
      night.y = G.terrain.heightAt(night.x, night.z);
      const npc = { q, c, mark, col, pos: new THREE.Vector3(x, y, z), day: new THREE.Vector3(x, y, z), night, ipos: new THREE.Vector3(x, y + 1, z), phase: Math.random() * 6, barkT: 0, bubble: null };
      this.npcs.push(npc);
      G.world.interactables.push({
        pos: npc.ipos, radius: 3,
        prompt: () => `Talk to ${q.giver}`,
        action: () => this.talk(q),
      });
    }
  }

  _glyph(ch) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = 'rgba(40,24,8,0.55)';
    x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill();
    x.font = 'bold 44px Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffe070';
    x.fillText(ch, 32, 35);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  state(q) {
    if (flag(`q_${q.id}_done`)) return 'done';
    if (!flag(`q_${q.id}`)) return 'new';
    return q.ready() ? 'ready' : 'active';
  }

  talk(q) {
    const s = this.state(q);
    if (s === 'new') {
      G.hud.choice(q.giver, q.intro, ['I will help', 'Maybe later'], (i) => {
        if (i !== 0) { G.hud.dialog(q.giver, 'Oh... alright. Come back if you change your mind.'); return; }
        setFlag(`q_${q.id}`);
        G.audio.play('glint');
        G.hud.banner(q.title, 'New quest added to your satchel (I)', '#ffe08a');
        G.hud.dialog(q.giver, q.waiting);
      });
    } else if (s === 'active') {
      const left = q.steps().filter((st) => !st.done).map((st) => st.text).join(' · ');
      G.hud.dialog(q.giver, `${q.waiting} (Still needed: ${left})`);
    } else if (s === 'ready') {
      q.turnIn?.();
      setFlag(`q_${q.id}_done`);
      setFlag(q.reward);
      G.audio.play('quest');
      G.hud.banner('Quest Complete', `${q.title} · ${q.rewardText}`, '#ffd84a');
      G.hud.dialog(q.giver, q.thanks);
      const n = this.npcs.find((v) => v.q === q);
      G.particles.burst(n.pos.clone().setY(n.pos.y + 1.5), { count: 40, color: 0xffe08a, speed: 5, up: 3, life: 1.2, size: 0.45, pool: 'glow', gravity: 1 });
    } else {
      G.hud.dialog(q.giver, q.thanks);
    }
  }

  // Tilly's kite, snagged on the islet closest to the lake
  _kite() {
    const isl = G.world.islets.reduce((a, b) => (Math.hypot(a.x + 200, a.z - 200) < Math.hypot(b.x + 200, b.z - 200) ? a : b));
    const g = new THREE.Group();
    const shape = new THREE.Shape([new THREE.Vector2(0, 0.9), new THREE.Vector2(0.55, 0), new THREE.Vector2(0, -1.1), new THREE.Vector2(-0.55, 0)]);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: 0x4aa0e0, emissive: 0x10304a, side: THREE.DoubleSide }));
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.16), new THREE.MeshLambertMaterial({ color: 0xffe08a, side: THREE.DoubleSide }));
    stripe.position.z = 0.01;
    const tail = [];
    for (let i = 0; i < 5; i++) {
      const bow = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshLambertMaterial({ color: COLORS[i % 4].hex }));
      bow.position.set(0, -1.3 - i * 0.35, 0);
      tail.push(bow);
      g.add(bow);
    }
    g.add(sail, stripe);
    const a = 0.7;
    g.position.set(isl.x + Math.cos(a) * isl.r * 0.4, isl.y + 1.1, isl.z + Math.sin(a) * isl.r * 0.4);
    g.rotation.set(-0.9, 0.4, 0.3);
    this.root.add(g);
    this.kite = { g, tail, pos: g.position.clone() };
    G.world.interactables.push({
      pos: this.kite.pos, radius: 3,
      enabled: () => flag('q_tilly') && !flag('q_kite_got'),
      prompt: () => "Take Tilly's kite",
      action: () => {
        setFlag('q_kite_got');
        G.audio.play('pickup');
        G.hud.toast("Got Tilly's kite! Bring it back to the village.", '#9ee0ff', 3);
      },
    });
  }

  _statues() {
    const grey = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    for (const s of STATUES) {
      const y = G.terrain.heightAt(s.x, s.z);
      const c = COLORS[s.i];
      const g = new THREE.Group();
      const mat = grey.clone();
      const ped = new THREE.Mesh(jitter(new THREE.CylinderGeometry(1.2, 1.4, 1, 7), 0.08, s.i), MAT.stoneDark);
      ped.position.y = 0.5;
      const body = new THREE.Mesh(new THREE.LatheGeometry([[0.01, 0], [0.75, 0], [0.55, 1.2], [0.42, 2.1], [0.2, 2.4], [0.01, 2.45]].map(([a, b]) => new THREE.Vector2(a, b)), 12), mat);
      body.position.y = 1;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat);
      head.position.y = 3.75;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 10), mat);
      hat.position.y = 4.3;
      hat.rotation.z = 0.25;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshLambertMaterial({ color: c.hex, emissive: c.hex, emissiveIntensity: 0.25 }));
      gem.position.set(0, 2.6, 0.5);
      g.add(ped, body, head, hat, gem);
      g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      g.position.set(s.x, y - 0.1, s.z);
      g.rotation.y = Math.atan2(VILLAGE.x - s.x, VILLAGE.z - s.z);
      this.root.add(g);
      G.collision.addCylinder(s.x, s.z, 1.2, y - 0.5, y + 4.6);
      const st = { ...s, g, mat, gem, pos: new THREE.Vector3(s.x, y + 2.5, s.z), glow: flag(`q_statue_${s.i}`) ? 1 : 0 };
      this.statues.push(st);
      G.world.reactives.push({
        active: true, pos: st.pos, radius: 2.4, hitbox: 2.4,
        onPaint: (el) => {
          if (flag(`q_statue_${s.i}`)) return;
          if (el !== c.element) { if (el && el !== 'none') G.hud.toast(`The statue's gem glints ${c.name}...`, c.css, 2); return; }
          setFlag(`q_statue_${s.i}`);
        },
      });
    }
  }

  _markers() {
    const add = (html, pos, show) => G.hud.addMarker(html, pos, show);
    add('<div class="ic" style="background:#4aa0e0">✦</div>', () => this.kite.pos, () => flag('q_tilly') && !flag('q_kite_got'));
    for (const s of this.statues) add(`<div class="ic" style="background:${COLORS[s.i].css}">♜</div>`, () => s.pos, () => flag('q_ochre') && !flag(`q_statue_${s.i}`));
  }

  onFlag(k, v) {
    if (!v) return;
    const m = k.match(/^q_statue_(\d)$/);
    if (m) {
      const s = this.statues[+m[1]];
      G.audio.play('solve');
      G.particles.burst(s.pos, { count: 50, color: COLORS[s.i].hex, speed: 7, up: 3, life: 1.2, size: 0.5, pool: 'glow', gravity: 2 });
      const n = this.statues.filter((q) => flag(`q_statue_${q.i}`)).length;
      G.hud.toast(`The ${COLORS[s.i].name} statue awakens! (${n}/4)`, COLORS[s.i].css, 3);
    }
    if (k === 'q_kite_got' && G.player && this.kite.pos.distanceTo(G.player.pos) > 20) G.hud.toast("A friend found Tilly's kite!", '#9ee0ff', 3);
  }

  // Speech bubble with an ambient line when a player strolls past
  _bark(n, d, nightTime, dt) {
    n.barkT -= dt;
    if (!n.bubble && d < 8 && n.barkT <= 0 && G.hud.dialogTimer <= 0) {
      const lines = nightTime ? NIGHT_BARKS : BARKS[n.q.id];
      n.bubble = document.createElement('div');
      n.bubble.className = 'bubble';
      n.bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
      G.hud.labels.appendChild(n.bubble);
      n.bubbleT = 4;
      n.barkT = 30 + Math.random() * 20;
      G.audio.voice(G.hud._voice(n.q.giver));
    }
    if (n.bubble) {
      n.bubbleT -= dt;
      const s = G.hud.project(n.pos.clone().setY(n.pos.y + (n.q.child ? 2.1 : 2.5)));
      if (n.bubbleT <= 0 || !s || G.hud.dialogTimer > 0) { n.bubble.remove(); n.bubble = null; return; }
      n.bubble.style.left = `${s.x}px`;
      n.bubble.style.top = `${s.y}px`;
      n.bubble.style.opacity = Math.min(1, n.bubbleT * 2);
    }
  }

  // Villagers with news, active quest targets and field bosses already spotted
  mapMarkers(add) {
    const states = this.npcs.map((n) => this.state(n.q));
    const ready = states.filter((s) => s === 'ready').length, fresh = states.filter((s) => s === 'new').length;
    if (ready || fresh) {
      const n = this.npcs[0];
      add(n.pos.x - 12, n.pos.z + 14, 'mq', '#ffd84a', ready ? `? ${ready} quest${ready > 1 ? 's' : ''} to turn in` : `! ${fresh} villager${fresh > 1 ? 's' : ''} need help`);
    }
    if (flag('q_tilly') && !flag('q_kite_got')) add(this.kite.pos.x, this.kite.pos.z, 'mq', '#4aa0e0', "Tilly's kite");
    for (const s of this.statues) if (flag('q_ochre') && !flag(`q_statue_${s.i}`)) add(s.x, s.z, 'mq', COLORS[s.i].css, 'Grey statue');
    for (const c of G.enemies.camps) {
      if (!c.field || !this.seenField.has(c.id)) continue;
      const alive = c.members.some((m) => m.alive);
      add(c.x, c.z, 'mboss', alive ? '#8a2a3a' : '#555', `${c.types[0] === 'blotgiant' ? 'Blot Giant' : 'Stone Sentinel'}${alive ? '' : ' (resting)'}`);
    }
  }

  // Quest log section for the satchel
  renderLog(el) {
    const rows = QUESTS.filter((q) => this.state(q) !== 'new');
    if (!rows.length) { el.innerHTML = '<div class="none">No quests yet. Villagers marked with ! need a hand.</div>'; return; }
    el.innerHTML = rows.map((q) => {
      const s = this.state(q);
      const steps = s === 'done' ? '' : q.steps().map((st) => `<li class="${st.done ? 'ok' : ''}">${st.text}</li>`).join('');
      const tag = s === 'done' ? '<span class="qd">Complete</span>' : s === 'ready' ? `<span class="qr">Return to ${q.giver}</span>` : '';
      return `<div class="quest ${s}"><div class="qt">${q.title} ${tag}</div><div class="qg">${q.giver} · Reward: ${q.rewardText}</div><ul>${steps}</ul></div>`;
    }).join('');
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.root.visible = !p.inDungeon;
    if (p.inDungeon) return;
    const t = G.time;
    for (const n of this.npcs) {
      const s = this.state(n.q);
      n.mark.visible = s === 'new' || s === 'ready';
      if (n.mark.visible) {
        const want = s === 'ready' ? '?' : '!';
        if (n.mark.userData.ch !== want) { n.mark.material.map = this._glyph(want); n.mark.userData.ch = want; n.mark.material.needsUpdate = true; }
        n.mark.position.y = n.pos.y + (n.q.child ? 2.4 : 2.9) + Math.sin(t * 2.5 + n.phase) * 0.12;
      }
      // Walk between the day spot and the evening gathering at the pot
      const nightTime = G.sky && G.sky.night > 0.55;
      const goal = nightTime ? n.night : n.day;
      const to = goal.clone().sub(n.pos).setY(0);
      const dist = to.length();
      let anim = 'idle', spd = 0;
      if (dist > 0.25) {
        const step = Math.min(dist, 1.7 * dt);
        n.pos.addScaledVector(to.normalize(), step);
        n.pos.y = G.terrain.heightAt(n.pos.x, n.pos.z);
        const want = Math.atan2(to.x, to.z);
        n.c.group.rotation.y += Math.atan2(Math.sin(want - n.c.group.rotation.y), Math.cos(want - n.c.group.rotation.y)) * Math.min(1, dt * 6);
        anim = 'walk'; spd = 1.7;
      } else if (nightTime) {
        anim = 'emote_sit';
        const want = Math.atan2(VILLAGE.x + POT.x - n.pos.x, VILLAGE.z + POT.z - n.pos.z);
        n.c.group.rotation.y += Math.atan2(Math.sin(want - n.c.group.rotation.y), Math.cos(want - n.c.group.rotation.y)) * Math.min(1, dt * 3);
      }
      n.c.group.position.copy(n.pos);
      n.ipos.set(n.pos.x, n.pos.y + 1, n.pos.z);
      n.col.min.set(n.pos.x - 0.5, n.pos.y, n.pos.z - 0.5);
      n.col.max.set(n.pos.x + 0.5, n.pos.y + 1.8, n.pos.z + 0.5);
      n.col.x = n.pos.x; n.col.z = n.pos.z;
      n.mark.position.x = n.pos.x;
      n.mark.position.z = n.pos.z;
      const d = n.pos.distanceTo(p.pos);
      this._bark(n, d, nightTime, dt);
      if (d < 60) {
        n.c.animate({ state: anim, speed: spd }, dt);
        // Turn to face a nearby player
        if (d < 7 && anim === 'idle') {
          const want = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
          let da = want - n.c.group.rotation.y;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          n.c.group.rotation.y += da * Math.min(1, dt * 4);
        }
      }
    }
    // Remember field bosses once spotted, for the map
    for (const c of G.enemies.camps) if (c.field && !this.seenField.has(c.id) && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 90) this.seenField.add(c.id);
    // Kite flutters until taken
    const k = this.kite;
    k.g.visible = !flag('q_kite_got');
    if (k.g.visible) {
      k.g.rotation.z = 0.3 + Math.sin(t * 3) * 0.12;
      k.tail.forEach((b, i) => { b.position.x = Math.sin(t * 4 - i * 0.8) * 0.12 * i; });
    }
    // Restored statues fade from grey into their colour
    for (const s of this.statues) {
      const target = flag(`q_statue_${s.i}`) ? 1 : 0;
      if (Math.abs(s.glow - target) < 0.001) continue;
      s.glow += (target - s.glow) * Math.min(1, dt * 1.5);
      if (Math.abs(s.glow - target) < 0.01) s.glow = target;
      const c = COLORS[s.i];
      s.mat.color.setHex(0x8a8a8a).lerp(new THREE.Color(c.light ?? c.hex), s.glow);
      s.mat.emissive.setHex(c.hex).multiplyScalar(0.18 * s.glow);
      s.gem.material.emissiveIntensity = 0.25 + s.glow * 1.2;
    }
  }
}

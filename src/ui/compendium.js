// Compendium: take a photo (photo mode, P) with a creature in frame to register it, with a small
// snapshot cut from your picture. Kept in your local save and shown in the satchel.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

export const ENTRIES = [
  { id: 'bounder', name: 'Bounder', text: 'A springy blot of ink that charges headlong. Frost stops it cold.' },
  { id: 'inkling', name: 'Inkling', text: 'Small, quick and always in a crowd. Watch your back.' },
  { id: 'spitter', name: 'Spitter', text: 'Rooted in place, it lobs ink from a distance. Close in fast.' },
  { id: 'archer', name: 'Inkshot', text: 'Keeps watch from camp towers and raises the alarm.' },
  { id: 'wisp', name: 'Ink Wisp', text: 'Guards the skies around the Sky Citadel, diving at riders.' },
  { id: 'inkbat', name: 'Inkbat', text: 'Flutters out at night in twitchy swarms. One stroke pops it.' },
  { id: 'blotgiant', name: 'Blot Giant', text: 'Sleeps in the meadows. Its single eye is its weak spot.' },
  { id: 'sentinel', name: 'Stone Sentinel', text: 'Looks like a boulder until you come close. Strike the crystal on its back.' },
  { id: 'knight', name: 'Ink Knight', text: 'Leads elite camps behind a round shield. Circle behind it, or knock the shield aside with Spring.' },
  { id: 'inkspout', name: 'Inkspout', text: 'Lurks under the shallows and pops up to spit ink. Freeze it before it ducks.' },
  { id: 'sentry', name: 'Ruin Sentry', text: 'An old turret by the ruins. Strike its bolt just as it arrives to send it back.' },
  { id: 'rainmane', name: 'Rainmane', text: 'Lord of the Painted Plains. Only the colour that undoes its mane bites deep.' },
  { id: 'frostmaw', name: 'Frostmaw', text: 'Guardian of the Ember Trial, armoured in ice.' },
  { id: 'magmaw', name: 'Magmaw', text: 'Guardian of the Frost Trial, a molten glutton.' },
  { id: 'shellback', name: 'Shellback', text: 'Guardian of the Spring Trial. Flip it to reach its belly.' },
  { id: 'galewing', name: 'Galewing', text: 'Guardian of the Bloom Trial. Tangle it with vines to bring it down.' },
  { id: 'hueless', name: 'The Hueless King', text: 'The apprentice who wanted a world with no mistakes.' },
  { id: 'brushbuck', name: 'Brushbuck', text: 'Painted deer with rainbow antlers. Gentle, but they bolt if you rush them.' },
  { id: 'fish', name: 'Glimmerfish', text: 'Silvery schools circle the shallows. Frost freezes them for the pot.' },
  { id: 'prismfin', name: 'Prismfin', text: 'A rare pink fish that swims among the Glimmerfish.' },
  { id: 'sunwing', name: 'Sunwing', text: 'A butterfly of the dry meadows. Restores stamina when eaten.' },
  { id: 'glowbug', name: 'Glowbug', text: 'Drifts over the grass at night. Makes meals that hush your steps.' },
  { id: 'fox', name: 'Paint Fox', text: 'A loyal little companion with a nose for hidden things.' },
  { id: 'wyrm', name: 'Chroma Wyrm', text: 'The first Painter\'s unfinished stroke, still flying round the island.' },
];

export class Compendium {
  constructor() {
    this.got = new Map(); // id -> snapshot data URL
    this.v = new THREE.Vector3();
  }

  get total() { return ENTRIES.length; }

  serialize() { return Object.fromEntries(this.got); }
  load(d) { if (d && typeof d === 'object') for (const e of ENTRIES) if (typeof d[e.id] === 'string') this.got.set(e.id, d[e.id]); }

  // Everything that could be in frame right now: [id, world position, how far it can be seen]
  _candidates() {
    const out = [];
    for (const e of G.enemies?.list || []) if (e.alive && ENTRIES.some((q) => q.id === e.type)) out.push([e.type, e.pos.clone().setY(e.pos.y + e.height * 0.5), e.boss ? 90 : 50]);
    for (const b of G.steeds?.list || []) if (b.g.visible) out.push(['brushbuck', b.pos.clone().setY(b.pos.y + 1.4), 60]);
    for (const f of G.fishing?.fish || []) if (f.state !== 'gone') out.push([f.prism ? 'prismfin' : 'fish', f.pos, 25]);
    for (const c of G.critters?.list || []) out.push([c.kind === 'fly' ? 'sunwing' : 'glowbug', c.pos, 20]);
    if (G.fox?.pos && G.settings.fox !== false) out.push(['fox', G.fox.pos.clone().setY(G.fox.pos.y + 0.4), 30]);
    if (G.wyrm?.group?.visible) out.push(['wyrm', G.wyrm.segs[0], 300]);
    return out;
  }

  // Called with the freshly rendered canvas when a photo is taken
  onPhoto(canvas) {
    const cam = G.camera;
    const found = [], seen = new Set();
    for (const [id, pos, range] of this._candidates()) {
      if (seen.has(id)) continue;
      if (pos.distanceTo(cam.position) > range) continue;
      this.v.copy(pos).project(cam);
      if (this.v.z > 1 || Math.abs(this.v.x) > 0.8 || Math.abs(this.v.y) > 0.8) continue;
      seen.add(id);
      if (!this.got.has(id)) found.push({ id, x: (this.v.x + 1) / 2, y: (1 - this.v.y) / 2 });
    }
    for (const id of seen) G.bounties?.event('photo', id); // photo bounties count creatures already registered too
    for (const f of found) {
      this.got.set(f.id, this._crop(canvas, f.x, f.y));
      const e = ENTRIES.find((q) => q.id === f.id);
      G.hud.toast(`📖 Compendium: ${e.name} registered! (${this.got.size}/${ENTRIES.length})`, '#e8dcc0', 3);
    }
    if (found.length) {
      G.audio.play('glint');
      if (this.got.size >= 10) G.honours?.event('compendium');
    }
    return found.map((f) => f.id);
  }

  _crop(canvas, fx, fy) {
    try {
      const W = 160, H = 120;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const sw = canvas.width * 0.3, sh = sw * (H / W);
      const sx = Math.min(Math.max(0, fx * canvas.width - sw / 2), canvas.width - sw);
      const sy = Math.min(Math.max(0, fy * canvas.height - sh / 2), canvas.height - sh);
      c.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, W, H);
      return c.toDataURL('image/jpeg', 0.75);
    } catch (_) {
      return '';
    }
  }

  render(el) {
    el.innerHTML = ENTRIES.map((e) => {
      const img = this.got.get(e.id);
      return this.got.has(e.id)
        ? `<div class="cpd got" title="${e.text}">${img ? `<img src="${img}" alt="">` : '<div class="blank"></div>'}<b>${e.name}</b><span>${e.text}</span></div>`
        : '<div class="cpd"><div class="blank">?</div><b>???</b></div>';
    }).join('');
  }
}

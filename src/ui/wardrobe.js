// Wardrobe: cosmetics unlocked by Painter's Honours. Brush trail styles and glider tints, chosen
// in the pause menu, saved with the settings and sent to friends in state snapshots.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { mergeColored } from '../world/props.js';

export const TRAILS = [
  { id: 'paint', name: 'Paint (your colour)', need: 0 },
  { id: 'ember', name: 'Ember sparks', need: 3 },
  { id: 'rainbow', name: 'Rainbow', need: 6 },
  { id: 'star', name: 'Starlight', need: 10 },
];
export const GLIDERS = [
  { id: 'patch', name: 'Patchwork', need: 0, tint: 0xffffff },
  { id: 'gold', name: 'Sunflower gold', need: 4, tint: 0xffe08a },
  { id: 'rose', name: 'Rose', need: 8, tint: 0xffb4cc },
  { id: 'midnight', name: 'Midnight', need: 12, tint: 0x8a98ff },
  { id: 'prism', name: 'Prismatic', need: 0, flag: 'vault_done', tint: 0xd8c8ff },
];
// Hats, each earned by a particular deed (an honour) or found in the world (a flag)
export const HATS = [
  { id: 'none', name: 'No hat', need: 0 },
  { id: 'straw', name: "Angler's straw hat", honour: 'angler' },
  { id: 'flower', name: 'Festival flower crown', flag: 'q_mira_done' },
  { id: 'antlers', name: 'Brushbuck antlers', honour: 'tame' },
  { id: 'crown', name: "Rainmane's crown", honour: 'rainmane' },
  { id: 'peak', name: "Painter's peaked hat", need: 15 },
];
const TRAIL_STYLE = { paint: 0, rainbow: 1, star: 2, ember: 3 };

// One vertex-coloured mesh per hat, placed on top of the hood
function hatGeometry(id) {
  const C = (r, rt, h, seg = 16) => new THREE.CylinderGeometry(r, rt, h, seg);
  switch (id) {
    case 'straw': return mergeColored([[C(0.55, 0.55, 0.04, 20).translate(0, 0.33, 0), 0xe8c870], [C(0.24, 0.28, 0.2).translate(0, 0.45, 0), 0xe0bc60], [C(0.285, 0.285, 0.06).translate(0, 0.39, 0), 0xc0463a]]);
    case 'flower': {
      const parts = [[new THREE.TorusGeometry(0.3, 0.045, 6, 20).rotateX(Math.PI / 2).translate(0, 0.33, 0), 0x3f8a3a]];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        parts.push([new THREE.SphereGeometry(0.07, 8, 6).translate(Math.cos(a) * 0.3, 0.36, Math.sin(a) * 0.3), [0xe8442e, 0xf2c229, 0x3a9ae8, 0xffb4d8][i % 4]]);
      }
      return mergeColored(parts);
    }
    case 'antlers': {
      const parts = [];
      for (const sx of [-1, 1]) {
        parts.push([C(0.025, 0.035, 0.45, 6).rotateZ(-sx * 0.4).translate(sx * 0.2, 0.5, 0), 0xe8dcc0]);
        parts.push([C(0.02, 0.03, 0.22, 6).rotateZ(-sx * 1.1).translate(sx * 0.33, 0.62, 0.02), sx < 0 ? 0xe8442e : 0x3a9ae8]);
        parts.push([C(0.02, 0.03, 0.2, 6).rotateZ(-sx * 0.1).translate(sx * 0.27, 0.74, -0.02), sx < 0 ? 0xf2c229 : 0x3fb54a]);
      }
      return mergeColored(parts);
    }
    case 'crown': {
      const parts = [[C(0.25, 0.27, 0.12).translate(0, 0.38, 0), 0xd8b060]];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push([new THREE.ConeGeometry(0.06, 0.2, 4).translate(Math.cos(a) * 0.24, 0.53, Math.sin(a) * 0.24), 0xf2c229]);
      }
      parts.push([new THREE.OctahedronGeometry(0.06).translate(0, 0.4, 0.26), 0xe8442e]);
      return mergeColored(parts);
    }
    case 'peak': return mergeColored([[C(0.5, 0.5, 0.04, 20).translate(0, 0.33, 0), 0x3a3246], [new THREE.ConeGeometry(0.3, 0.75, 16).rotateX(-0.25).translate(0, 0.7, -0.08), 0x4a3a7a], [C(0.305, 0.305, 0.07).translate(0, 0.39, 0), 0xf2c229]]);
    default: return null;
  }
}

function applyHat(char, id) {
  if (!char || !char.head || char.hatId === id) return;
  if (char.hat) { char.head.remove(char.hat); char.hat.geometry.dispose(); char.hat = null; }
  char.hatId = id;
  const geo = hatGeometry(id);
  if (!geo) return;
  char.hat = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  char.hat.castShadow = true;
  char.head.add(char.hat);
}

// Most items unlock with honours; a few are rewards found in the world (a shared flag)
export const unlocked = (item, honours, flags = G.flags || {}, got = G.honours?.got) => (item.flag ? !!flags[item.flag] : item.honour ? !!got?.has(item.honour) : honours >= item.need);

// Apply a cosmetic code ("trail|glider|hat") to a character and its ride trail
export function applyCosmetics(char, ribbon, code) {
  const [t, g, h] = String(code || 'paint|patch|none').split('|');
  applyHat(char, HATS.some((x) => x.id === h) ? h : 'none');
  if (ribbon) ribbon.style = TRAIL_STYLE[t] ?? 0;
  const gl = GLIDERS.find((x) => x.id === g) || GLIDERS[0];
  if (char && char.glider) char.glider.material.color = new THREE.Color(gl.tint);
}

export class Wardrobe {
  constructor(save) {
    this.save = save;
    const s = G.settings;
    s.trail ??= 'paint';
    s.gliderTint ??= 'patch';
    s.hat ??= 'none';
    this.tSel = document.getElementById('set-trail');
    this.gSel = document.getElementById('set-glider');
    this.tSel.addEventListener('change', () => { s.trail = this.tSel.value; this.apply(); this.save(); });
    this.gSel.addEventListener('change', () => { s.gliderTint = this.gSel.value; this.apply(); this.save(); });
    this.hSel = document.getElementById('set-hat');
    this.hSel.addEventListener('change', () => { s.hat = this.hSel.value; this.apply(); this.save(); });
    this.render();
  }

  code() { return `${G.settings.trail}|${G.settings.gliderTint}|${G.settings.hat || 'none'}`; }

  // Rebuild the options, disabling anything not yet earned
  render(enforce = false) {
    const n = G.honours ? G.honours.got.size : 0;
    const fill = (sel, list, cur) => {
      const why = (x) => (x.flag ? ' (found in the world)' : x.honour ? ` (honour: ${G.honours?.name?.(x.honour) || x.honour})` : ` (${x.need} honours)`);
      sel.innerHTML = list.map((x) => `<option value="${x.id}" ${unlocked(x, n) ? '' : 'disabled'} ${x.id === cur ? 'selected' : ''}>${x.name}${unlocked(x, n) ? '' : why(x)}</option>`).join('');
    };
    const s = G.settings;
    // Once honours are loaded, fall back to the defaults if a saved pick isn't earned here
    if (enforce && !unlocked(TRAILS.find((x) => x.id === s.trail) || TRAILS[0], n)) s.trail = 'paint';
    if (enforce && !unlocked(GLIDERS.find((x) => x.id === s.gliderTint) || GLIDERS[0], n)) s.gliderTint = 'patch';
    if (enforce && !unlocked(HATS.find((x) => x.id === s.hat) || HATS[0], n)) s.hat = 'none';
    fill(this.tSel, TRAILS, s.trail);
    fill(this.gSel, GLIDERS, s.gliderTint);
    fill(this.hSel, HATS, s.hat);
  }

  apply() {
    const p = G.player;
    if (p) applyCosmetics(p.char, p.rideTrail, this.code());
  }
}

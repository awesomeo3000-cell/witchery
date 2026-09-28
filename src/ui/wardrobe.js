// Wardrobe: cosmetics unlocked by Painter's Honours. Brush trail styles and glider tints, chosen
// in the pause menu, saved with the settings and sent to friends in state snapshots.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

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
const TRAIL_STYLE = { paint: 0, rainbow: 1, star: 2, ember: 3 };

// Most items unlock with honours; a few are rewards found in the world (a shared flag)
export const unlocked = (item, honours, flags = G.flags || {}) => (item.flag ? !!flags[item.flag] : honours >= item.need);

// Apply a cosmetic code ("trail|glider") to a character and its ride trail
export function applyCosmetics(char, ribbon, code) {
  const [t, g] = String(code || 'paint|patch').split('|');
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
    this.tSel = document.getElementById('set-trail');
    this.gSel = document.getElementById('set-glider');
    this.tSel.addEventListener('change', () => { s.trail = this.tSel.value; this.apply(); this.save(); });
    this.gSel.addEventListener('change', () => { s.gliderTint = this.gSel.value; this.apply(); this.save(); });
    this.render();
  }

  code() { return `${G.settings.trail}|${G.settings.gliderTint}`; }

  // Rebuild the options, disabling anything not yet earned
  render(enforce = false) {
    const n = G.honours ? G.honours.got.size : 0;
    const fill = (sel, list, cur) => {
      sel.innerHTML = list.map((x) => `<option value="${x.id}" ${unlocked(x, n) ? '' : 'disabled'} ${x.id === cur ? 'selected' : ''}>${x.name}${unlocked(x, n) ? '' : x.flag ? ' (found in the world)' : ` (${x.need} honours)`}</option>`).join('');
    };
    const s = G.settings;
    // Once honours are loaded, fall back to the defaults if a saved pick isn't earned here
    if (enforce && !unlocked(TRAILS.find((x) => x.id === s.trail) || TRAILS[0], n)) s.trail = 'paint';
    if (enforce && !unlocked(GLIDERS.find((x) => x.id === s.gliderTint) || GLIDERS[0], n)) s.gliderTint = 'patch';
    fill(this.tSel, TRAILS, s.trail);
    fill(this.gSel, GLIDERS, s.gliderTint);
  }

  apply() {
    const p = G.player;
    if (p) applyCosmetics(p.char, p.rideTrail, this.code());
  }
}

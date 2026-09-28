// Painted Memories: Elder Umber's sketchbook holds eight sketches of places around the island.
// Each sketch is drawn in-engine from the real spot, one every so often in the background.
// Stand where a sketch was drawn to recover the memory: a short scene from the Painters' past.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { LAKE, CITADEL, VOLCANO, VILLAGE } from './layout.js';

export const RECOVER_R = 12;
export const MEMORIES = [
  { title: 'The First Lesson', at: [-80, 150], look: [LAKE.x, 4, LAKE.z], text: 'By this lake the first Painter taught her apprentices to mix. "Colours are like people," she said, dabbing Frost into Ember until it turned the grey of rain. "Alone they shout. Together they sing."' },
  { title: 'Raising the Prism', at: [40, 40], look: [CITADEL.x, CITADEL.y, CITADEL.z], text: 'The whole village stood here to watch the Prism lifted into the sky. Four Painters held it aloft, one colour each, and when it caught the dawn every roof in Palette Hollow turned gold.' },
  { title: 'The Mountain of Ember', at: [420, -80], look: [VOLCANO.x, 120, VOLCANO.z], text: 'Ember was not dug from the volcano; it was coaxed. The Painters sang to the mountain every summer, and it answered with a single glowing drop that could warm a house for a year.' },
  { title: 'The Frost Vigil', at: [-10, -330], look: [VILLAGE.x, 20, VILLAGE.z], text: 'Up in the pass the Frost Painters kept watch through the long nights. From here they could see every lantern in the Hollow, and they counted them, one by one, until morning.' },
  { title: 'Amber Afternoons', at: [60, 360], look: [150, 45, 470], text: 'Children came to the mesas to learn Spring. They painted pads on the golden rock and bounced higher and higher, laughing, until the Painters called them home for supper.' },
  { title: 'The Old Grove', at: [-330, 20], look: [-440, 20, 60], text: 'The Bloom Painters never cut a tree. When they needed a bridge they asked the forest, and by morning the vines had woven one across the river, strong enough for a cart.' },
  { title: 'The Apprentice', at: [150, -110], look: [CITADEL.x, CITADEL.y, CITADEL.z], text: 'He sat at this ruin every evening, staring at the Prism. "It wobbles," he told anyone who would listen. "One wrong stroke and it all runs together." Nobody thought much of it at the time.' },
  { title: 'The Grey Morning', at: [240, 200], look: [VOLCANO.x, 80, VOLCANO.z], text: 'The morning the colour went, the Painters stood here and watched the volcano turn to ash, then the forest, then the sky. The first Painter was the only one who did not cry. She picked up her brush.' },
];

export class Memories {
  constructor() {
    this.got = new Set();
    this.spots = MEMORIES.map((m) => {
      let [x, z] = m.at;
      // Keep the spot on dry land
      for (let k = 0; k < 30 && G.terrain.heightAt(x, z) < 1.5; k++) { x *= 0.95; z *= 0.95; }
      const y = G.terrain.heightAt(x, z);
      return { ...m, pos: new THREE.Vector3(x, y, z), target: new THREE.Vector3(...m.look), sketch: null };
    });
    this.checkT = 0;
    this.sketchT = 4;
  }

  serialize() { return [...this.got]; }
  load(list) { for (const i of list || []) if (i >= 0 && i < MEMORIES.length) this.got.add(i); }

  // Draw the sketch for a memory from its real spot, with a pencil-on-paper look
  _sketch(s) {
    if (s.sketch) return s.sketch;
    const W = 240, H = 150;
    try {
      const r = G.renderer;
      const rt = new THREE.WebGLRenderTarget(W, H);
      const cam = new THREE.PerspectiveCamera(55, W / H, 0.5, 3000);
      // A little above head height, stepped back from the spot, so nearby bushes don't fill the frame
      const dir = s.target.clone().sub(s.pos).setY(0).normalize();
      cam.position.copy(s.pos).addScaledVector(dir, -4);
      cam.position.y = Math.max(G.terrain.heightAt(cam.position.x, cam.position.z), s.pos.y) + 6;
      cam.lookAt(s.target);
      // Leave game markers (race gates, shrine beams, the Wyrm) out of the drawing
      const hide = [G.races?.root, G.shrines?.surface, G.wyrm?.group, G.player?.char?.group, G.rainbow?.mesh, G.world?.barrier?.mesh].filter((o) => o && o.visible);
      hide.forEach((o) => { o.visible = false; });
      // The sky dome follows the main camera; centre it on the sketch camera for the drawing
      const skyAt = G.sky?.sky ? G.sky.sky.position.clone() : null;
      if (skyAt) G.sky.sky.position.copy(cam.position);
      const cu = G.sky?.clouds?.mat?.uniforms?.uCam;
      const cloudAt = cu ? cu.value.clone() : null;
      if (cu) cu.value.copy(cam.position);
      const waterAt = G.water?.mesh ? G.water.mesh.position.clone() : null;
      if (waterAt) { G.water.mesh.position.x = Math.round(cam.position.x / 4) * 4; G.water.mesh.position.z = Math.round(cam.position.z / 4) * 4; }
      const prev = r.getRenderTarget();
      r.setRenderTarget(rt);
      r.render(G.scene, cam);
      hide.forEach((o) => { o.visible = true; });
      if (skyAt) G.sky.sky.position.copy(skyAt);
      if (cloudAt) cu.value.copy(cloudAt);
      if (waterAt) G.water.mesh.position.copy(waterAt);
      const px = new Uint8Array(W * H * 4);
      r.readRenderTargetPixels(rt, 0, 0, W, H, px);
      r.setRenderTarget(prev);
      rt.dispose();
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(W, H);
      // Flip vertically, turn to warm graphite on cream paper, and darken edges between tones
      const lum = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = ((H - 1 - y) * W + x) * 4;
        lum[y * W + x] = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const l = lum[y * W + x];
        const e = x > 0 && y > 0 ? Math.min(1, (Math.abs(l - lum[y * W + x - 1]) + Math.abs(l - lum[(y - 1) * W + x])) * 4) : 0;
        const tone = Math.min(1, 0.35 + l * 0.8) * (1 - e * 0.7);
        const o = (y * W + x) * 4;
        img.data[o] = 238 * tone + 20; img.data[o + 1] = 226 * tone + 16; img.data[o + 2] = 200 * tone + 10; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      s.sketch = c.toDataURL('image/jpeg', 0.8);
    } catch (_) {
      s.sketch = '';
    }
    return s.sketch;
  }

  recover(i) {
    const s = this.spots[i];
    const first = !this.got.has(i);
    this.got.add(i);
    if (first) {
      G.audio.play('shard');
      G.hud.banner('Memory Recovered', `${s.title} (${this.got.size}/${MEMORIES.length})`, '#e8dcc0');
      if (G.cine && !G.settings.reduceMotion) G.cine.focus({ pos: s.target.clone().setY(s.target.y - 4), radius: 6, height: 8, alive: true }, null, null, 3);
      if (this.got.size === MEMORIES.length) G.honours?.event('memories');
    }
    setTimeout(() => G.hud.dialog(`Memory: ${s.title}`, s.text), first ? 1500 : 0);
  }

  // Journal section in the satchel
  render(el) {
    el.innerHTML = '';
    this.spots.forEach((s, i) => {
      const d = document.createElement('div');
      const got = this.got.has(i);
      d.className = `mem${got ? ' got' : ''}`;
      const src = s.sketch;
      d.innerHTML = `${src ? `<img src="${src}" alt="">` : '<div class="blank"></div>'}<b>${got ? s.title : 'Where was this drawn?'}</b>`;
      if (got) d.onclick = () => { G.forage.closeUI(); this.recover(i); };
      el.appendChild(d);
    });
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    // Draw one missing sketch at a time so opening the journal never stalls
    this.sketchT -= dt;
    if (this.sketchT <= 0) {
      this.sketchT = 1.5;
      const s = this.spots.find((q) => q.sketch === null);
      if (s) this._sketch(s);
    }
    if (p.inDungeon) return;
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 0.5;
    this.spots.forEach((s, i) => {
      if (this.got.has(i)) return;
      if (Math.hypot(p.pos.x - s.pos.x, p.pos.z - s.pos.z) < RECOVER_R && Math.abs(p.pos.y - s.pos.y) < 8) this.recover(i);
    });
  }
}

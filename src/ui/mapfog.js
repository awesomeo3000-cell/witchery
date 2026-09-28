// Map fog of war: the map starts veiled in parchment and clears where you've been. You see farther
// when flying high, and activating an easel reveals the land around it. Saved with the local save.
import { G } from '../core/ctx.js';
import { WORLD_SIZE, WAYPOINTS, VILLAGE } from '../world/layout.js';

export const FOG_N = 64;
const CELL = WORLD_SIZE / FOG_N;

export class MapFog {
  constructor() {
    this.cells = new Uint8Array(FOG_N * FOG_N);
    this.t = 0;
    this.reveal(VILLAGE.x, VILLAGE.z, 120);
  }

  // Mark every cell whose centre lies within r of (x, z)
  reveal(x, z, r) {
    const h = WORLD_SIZE / 2;
    const i0 = Math.max(0, Math.floor((x - r + h) / CELL)), i1 = Math.min(FOG_N - 1, Math.floor((x + r + h) / CELL));
    const j0 = Math.max(0, Math.floor((z - r + h) / CELL)), j1 = Math.min(FOG_N - 1, Math.floor((z + r + h) / CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = -h + (i + 0.5) * CELL, cz = -h + (j + 0.5) * CELL;
        if (Math.hypot(cx - x, cz - z) <= r) this.cells[j * FOG_N + i] = 1;
      }
    }
  }

  explored() { return this.cells.reduce((a, b) => a + b, 0) / this.cells.length; }

  serialize() {
    let s = '';
    for (let k = 0; k < this.cells.length; k += 8) {
      let b = 0;
      for (let q = 0; q < 8; q++) b |= this.cells[k + q] << q;
      s += String.fromCharCode(b);
    }
    return btoa(s);
  }

  load(str) {
    try {
      const s = atob(str);
      for (let k = 0; k < s.length && k * 8 < this.cells.length; k++) {
        const b = s.charCodeAt(k);
        for (let q = 0; q < 8; q++) this.cells[k * 8 + q] |= (b >> q) & 1;
      }
    } catch (_) { /* corrupt save: keep what we have */ }
  }

  update(dt) {
    const p = G.player;
    if (!p || p.inDungeon) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const alt = Math.max(0, p.pos.y - G.terrain.heightAt(p.pos.x, p.pos.z));
    this.reveal(p.pos.x, p.pos.z, Math.min(220, 70 + alt * 1.2));
    for (const w of WAYPOINTS) if (G.flags[`wp_${w.key}`]) this.reveal(w.x, w.z, 220);
  }

  // Paint soft parchment fog over the map canvas
  draw(ctx, w, h) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = FOG_N;
    const x = cv.getContext('2d');
    const img = x.createImageData(FOG_N, FOG_N);
    for (let k = 0; k < this.cells.length; k++) {
      img.data[k * 4] = 222; img.data[k * 4 + 1] = 205; img.data[k * 4 + 2] = 168;
      img.data[k * 4 + 3] = this.cells[k] ? 0 : 242;
    }
    x.putImageData(img, 0, 0);
    // Scale up softly on its own layer, sketch hatching onto the fog only, then lay it over the map
    const layer = document.createElement('canvas');
    layer.width = w; layer.height = h;
    const l = layer.getContext('2d');
    l.imageSmoothingEnabled = true;
    l.filter = 'blur(6px)';
    l.drawImage(cv, 0, 0, w, h);
    l.filter = 'none';
    l.globalCompositeOperation = 'source-atop';
    l.strokeStyle = 'rgba(120,96,60,0.16)';
    for (let i = -h; i < w; i += 14) { l.beginPath(); l.moveTo(i, 0); l.lineTo(i + h, h); l.stroke(); }
    ctx.drawImage(layer, 0, 0);
  }
}

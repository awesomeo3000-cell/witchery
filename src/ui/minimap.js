// Corner minimap: the painted map around you, rotating with the camera, fogged where you haven't
// been, with the same markers as the compass (trials, friends, quests, pings, races).
import { G } from '../core/ctx.js';
import { WORLD_SIZE } from '../world/layout.js';
import { FOG_N } from './mapfog.js';

const $ = (id) => document.getElementById(id);
const VIEW = 110; // metres from the centre to the edge

export class Minimap {
  constructor() {
    this.cv = $('minimap');
    this.ctx = this.cv.getContext('2d');
    this.t = 0;
    this.base = null;
    this.fogCv = document.createElement('canvas');
    this.fogCv.width = this.fogCv.height = FOG_N;
    this.fogT = 0;
  }

  _fog() {
    const x = this.fogCv.getContext('2d');
    const img = x.createImageData(FOG_N, FOG_N);
    const cells = G.fog.cells;
    for (let k = 0; k < cells.length; k++) {
      img.data[k * 4] = 222; img.data[k * 4 + 1] = 205; img.data[k * 4 + 2] = 168;
      img.data[k * 4 + 3] = cells[k] ? 0 : 235;
    }
    x.putImageData(img, 0, 0);
  }

  update(dt) {
    const p = G.player;
    const show = G.settings.minimap !== false && p && !p.inDungeon && !G.game?.mapOpen && !(G.photo && G.photo.active);
    this.cv.classList.toggle('hidden', !show);
    if (!show) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.1;
    // The detailed base map is painted once, on first use
    if (!this.base) this.base = G.terrain.renderMapCanvas(512);
    this.fogT -= 0.1;
    if (this.fogT <= 0 && G.fog) { this.fogT = 1; this._fog(); }
    const c = this.ctx, W = this.cv.width, R = W / 2, s = R / VIEW, h = WORLD_SIZE / 2;
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#2a4a70'; c.fillRect(0, 0, W, W);
    c.translate(R, R);
    c.rotate(p.camYaw);
    c.scale(s, s);
    c.translate(-p.pos.x, -p.pos.z);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.base, -h, -h, WORLD_SIZE, WORLD_SIZE);
    if (G.fog) c.drawImage(this.fogCv, -h, -h, WORLD_SIZE, WORLD_SIZE);
    c.restore();
    // Markers (clamped to the rim when out of range)
    const cos = Math.cos(p.camYaw), sin = Math.sin(p.camYaw);
    for (const m of G.hud.markers) {
      if (!m.show()) continue;
      const t = m.pos();
      const dx = t.x - p.pos.x, dz = t.z - p.pos.z;
      let x = (dx * cos - dz * sin) * s, y = (dx * sin + dz * cos) * s;
      const d = Math.hypot(x, y), max = R - 9;
      const far = d > max;
      if (far) { x *= max / d; y *= max / d; }
      const ic = m.el.querySelector('.ic');
      c.fillStyle = (ic && ic.style.background) || '#fff';
      c.globalAlpha = far ? 0.75 : 1;
      c.beginPath(); c.arc(R + x, R + y, far ? 4 : 5.5, 0, Math.PI * 2); c.fill();
      c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
      c.globalAlpha = 1;
    }
    // You: an arrow pointing where the camera faces
    c.fillStyle = '#fff'; c.strokeStyle = '#1a1a2a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(R, R - 9); c.lineTo(R + 6, R + 6); c.lineTo(R, R + 3); c.lineTo(R - 6, R + 6); c.closePath(); c.stroke(); c.fill();
    // North tick on the rim
    const nx = sin * (R - 10), ny = -cos * (R - 10);
    c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffe08a'; c.fillText('N', R + nx, R + ny);
    c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = 'rgba(232,196,106,0.85)'; c.stroke();
  }
}

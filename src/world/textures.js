// Procedural painted textures: everything is drawn with canvas brush strokes so surfaces read as
// hand-painted rather than flat polygons. Textures are cached and tile seamlessly where needed.
import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';

const cache = new Map();

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// Soft elongated dab, drawn wrapped so textures tile
function dab(x, px, py, len, wid, ang, color, W, H) {
  for (const ox of [-W, 0, W]) {
    for (const oy of [-H, 0, H]) {
      const cx = px + ox, cy = py + oy;
      if (cx < -len || cx > W + len || cy < -len || cy > H + len) continue;
      x.save();
      x.translate(cx, cy);
      x.rotate(ang);
      x.fillStyle = color;
      x.beginPath();
      x.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  }
}

function strokes(x, W, H, n, rand, colorFn, sizeFn, angFn) {
  for (let i = 0; i < n; i++) {
    const [len, wid] = sizeFn(rand);
    dab(x, rand() * W, rand() * H, len, wid, angFn(rand), colorFn(rand), W, H);
  }
}

const builders = {
  // Warm grey stone with lighter dabs and dark crevices
  rock() {
    const W = 256;
    const [c, x] = canvas(W);
    const rand = mulberry32(11);
    x.fillStyle = hsl(30, 8, 52); x.fillRect(0, 0, W, W);
    strokes(x, W, W, 900, rand, (r) => hsl(20 + r() * 30, 6 + r() * 10, 40 + r() * 25, 0.35), (r) => [6 + r() * 16, 3 + r() * 6], (r) => r() * Math.PI);
    strokes(x, W, W, 140, rand, (r) => hsl(220, 10, 22 + r() * 10, 0.3), (r) => [10 + r() * 20, 1.2 + r() * 1.5], (r) => r() * Math.PI);
    strokes(x, W, W, 200, rand, (r) => hsl(40, 20, 72 + r() * 12, 0.25), (r) => [4 + r() * 8, 2 + r() * 3], () => -0.5);
    return tex(c);
  },
  // Vertical bark with dark grooves
  bark() {
    const W = 128;
    const [c, x] = canvas(W, W * 2);
    const rand = mulberry32(7);
    x.fillStyle = hsl(25, 30, 30); x.fillRect(0, 0, W, W * 2);
    strokes(x, W, W * 2, 500, rand, (r) => hsl(22 + r() * 12, 25 + r() * 15, 22 + r() * 22, 0.45), (r) => [14 + r() * 26, 2 + r() * 3], () => Math.PI / 2 + (rand() - 0.5) * 0.2);
    strokes(x, W, W * 2, 90, rand, (r) => hsl(20, 30, 12, 0.5), (r) => [20 + r() * 30, 1 + r()], () => Math.PI / 2);
    return tex(c);
  },
  // Leaf clump card with alpha: many small leaf dabs, bright rim at the top
  leaves() {
    const W = 256;
    const [c, x] = canvas(W);
    const rand = mulberry32(3);
    for (let i = 0; i < 520; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * W * 0.42;
      const px = W / 2 + Math.cos(a) * d, py = W / 2 + Math.sin(a) * d * 0.9;
      const light = 30 + (1 - py / W) * 35 + rand() * 12;
      x.save();
      x.translate(px, py);
      x.rotate(rand() * Math.PI * 2);
      x.fillStyle = hsl(95 + rand() * 25, 45 + rand() * 20, light, 0.95);
      x.beginPath();
      x.ellipse(0, 0, 9 + rand() * 7, 4 + rand() * 3, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
    return tex(c, false);
  },
  // Stacked stone blocks for walls and ruins
  stone() {
    const W = 256;
    const [c, x] = canvas(W);
    const rand = mulberry32(19);
    x.fillStyle = hsl(35, 6, 42); x.fillRect(0, 0, W, W);
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const h = W / rows, y = r * h;
      let bx = r % 2 ? -W / 8 : 0;
      while (bx < W) {
        const bw = W / 4 + (rand() - 0.5) * W / 8;
        x.fillStyle = hsl(30 + rand() * 20, 6 + rand() * 8, 52 + rand() * 16);
        x.beginPath();
        x.roundRect(bx + 3, y + 3, bw - 6, h - 6, 8);
        x.fill();
        for (let k = 0; k < 14; k++) dab(x, bx + rand() * bw, y + rand() * h, 5 + rand() * 9, 2 + rand() * 3, rand() * 3, hsl(30, 10, 45 + rand() * 30, 0.3), W, W);
        bx += bw;
      }
    }
    return tex(c);
  },
  // Overlapping roof shingles; tinted per material with .color
  shingles() {
    const W = 256;
    const [c, x] = canvas(W);
    const rand = mulberry32(23);
    x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, W, W);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const h = W / rows, y = r * h;
      const n = 6, sw = W / n;
      for (let i = -1; i <= n; i++) {
        const sx = i * sw + (r % 2 ? sw / 2 : 0);
        const g = 170 + rand() * 60;
        x.fillStyle = `rgb(${g},${g},${g})`;
        x.beginPath();
        x.moveTo(sx + 2, y);
        x.lineTo(sx + sw - 2, y);
        x.lineTo(sx + sw - 2, y + h * 0.85);
        x.quadraticCurveTo(sx + sw / 2, y + h * 1.15, sx + 2, y + h * 0.85);
        x.fill();
        x.fillStyle = 'rgba(0,0,0,0.18)';
        x.fillRect(sx + 2, y + h * 0.78, sw - 4, 3);
      }
    }
    return tex(c);
  },
  // Soft plaster with warm/cool mottling
  plaster() {
    const W = 256;
    const [c, x] = canvas(W);
    const rand = mulberry32(29);
    x.fillStyle = hsl(40, 45, 88); x.fillRect(0, 0, W, W);
    strokes(x, W, W, 380, rand, (r) => hsl(30 + r() * 30, 35, 80 + r() * 12, 0.3), (r) => [12 + r() * 20, 6 + r() * 8], (r) => r() * Math.PI);
    return tex(c);
  },
  // Horizontal wood planks
  wood() {
    const W = 256;
    const [c, x] = canvas(W);
    const rand = mulberry32(31);
    const planks = 6;
    for (let i = 0; i < planks; i++) {
      const h = W / planks;
      x.fillStyle = hsl(26 + rand() * 8, 38 + rand() * 12, 34 + rand() * 12);
      x.fillRect(0, i * h, W, h);
      for (let k = 0; k < 40; k++) dab(x, rand() * W, i * h + rand() * h, 14 + rand() * 30, 1 + rand() * 1.5, 0, hsl(25, 30, 20 + rand() * 20, 0.4), W, W);
      x.fillStyle = 'rgba(30,18,10,0.6)';
      x.fillRect(0, i * h, W, 2);
    }
    return tex(c);
  },
  // Woven cloth for tunics, tents and banners (tinted by material colour)
  cloth() {
    const W = 128;
    const [c, x] = canvas(W);
    const rand = mulberry32(37);
    x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < W; i += 4) {
      x.fillStyle = `rgba(255,255,255,${0.1 + rand() * 0.1})`;
      x.fillRect(i, 0, 2, W);
      x.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.06})`;
      x.fillRect(0, i, W, 2);
    }
    strokes(x, W, W, 60, rand, () => 'rgba(255,255,255,0.12)', (r) => [10 + r() * 20, 5], (r) => r() * 3);
    return tex(c);
  },
  // Horizontal sediment bands for cliffs and island undersides (greyscale, tinted by vertex colour)
  strata() {
    const W = 256;
    const [c, x] = canvas(W);
    const rand = mulberry32(41);
    let y = 0;
    while (y < W) {
      const h = 6 + rand() * 22;
      const g = 150 + rand() * 90;
      x.fillStyle = `rgb(${g},${g * 0.97},${g * 0.95})`;
      x.fillRect(0, y, W, h);
      y += h;
    }
    strokes(x, W, W, 700, rand, (r) => `rgba(${r() < 0.5 ? '255,255,255' : '40,30,30'},${0.08 + r() * 0.12})`, (r) => [10 + r() * 30, 1.5 + r() * 3], () => (rand() - 0.5) * 0.15);
    strokes(x, W, W, 60, rand, () => 'rgba(30,20,20,0.25)', (r) => [16 + r() * 24, 1 + r()], () => Math.PI / 2 + (rand() - 0.5) * 0.3);
    return tex(c);
  },
};

export function paintTex(name) {
  if (!cache.has(name)) cache.set(name, builders[name]());
  return cache.get(name);
}

// Procedural island heightfield: biomes, colours, exact height queries and a GPU height texture.
import * as THREE from 'three';
import { makeNoise2D, fbm, smoothstep, clamp, lerp, hash2 } from '../core/math.js';
import { WORLD_SIZE, WORLD_SEG, FLAT_SPOTS, VOLCANO, LAKE, VILLAGE } from './layout.js';

// Palette colours are converted from sRGB once and reused (converting per vertex dominated load time)
const PALETTE = new Map();
const PAL = (hex) => { let c = PALETTE.get(hex); if (!c) PALETTE.set(hex, (c = new THREE.Color(hex))); return c; };
const TMP = new THREE.Color(), ROCK = new THREE.Color();

export const WET = { value: 0 };

const BIOME_DIRS = { frost: 0, ember: Math.PI / 2, spring: Math.PI, bloom: -Math.PI / 2 };

export class Terrain {
  constructor(seed = 7) {
    this.size = WORLD_SIZE;
    this.seg = WORLD_SEG;
    this.n = WORLD_SEG + 1;
    this.cell = WORLD_SIZE / WORLD_SEG;
    this.half = WORLD_SIZE / 2;
    this.noise = makeNoise2D(seed);
    this.noise2 = makeNoise2D(seed + 11);
    this.noise3 = makeNoise2D(seed + 23);
    this.heights = new Float32Array(this.n * this.n);
    this.grass = new Float32Array(this.n * this.n);
    this.hue = new Float32Array(this.n * this.n);
    this._bio = new Array(this.n * this.n);
    this._generate();
    this._buildMesh();
    this._buildTexture();
    this._bio = null; // only needed while building
  }

  biome(x, z) {
    const d = Math.hypot(x, z);
    const a = Math.atan2(x, -z) + this.noise2(x * 0.004, z * 0.004) * 0.5;
    const w = {};
    let sum = 0;
    for (const k in BIOME_DIRS) {
      const c = Math.max(0, Math.cos(a - BIOME_DIRS[k]));
      w[k] = c * c * c * c;
      sum += w[k];
    }
    const radial = smoothstep(150, 300, d + this.noise3(x * 0.006, z * 0.006) * 60);
    for (const k in w) w[k] = (w[k] / sum) * radial;
    w.meadow = 1 - radial;
    return w;
  }

  _rawHeight(x, z, w = this.biome(x, z)) {
    const n = this.noise;
    const d = Math.hypot(x, z);
    const warp = fbm(this.noise2, x * 0.003, z * 0.003, 3) * 110;
    const island = 1 - smoothstep(520, 740, d + warp);

    let h = 7 + fbm(n, x * 0.0035, z * 0.0035, 4) * 12;
    h += fbm(n, x * 0.015, z * 0.015, 2) * 2.5;

    // Frost: jagged mountains
    if (w.frost > 0.01) {
      const r = 1 - Math.abs(fbm(this.noise3, x * 0.0042, z * 0.0042, 4));
      h += w.frost * (r * r * r * 105 + 8);
    }
    // Bloom: rolling forest hills
    if (w.bloom > 0.01) h += w.bloom * (fbm(n, x * 0.008 + 5, z * 0.008, 3) * 16 + 8);
    // Spring: terraced mesas
    if (w.spring > 0.01) {
      const m = fbm(this.noise3, x * 0.006 + 9, z * 0.006, 3);
      const t = smoothstep(0.05, 0.22, m);
      const levels = Math.floor(m * 5);
      h += w.spring * (t * (30 + levels * 8) + 2);
    }
    // Ember: volcano
    const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    const cone = Math.pow(1 - smoothstep(0, 210, vd), 1.6) * 165;
    const crater = (1 - smoothstep(18, 42, vd)) * 70;
    h += (cone - crater) * Math.max(w.ember, 0.35 * (1 - smoothstep(0, 210, vd)));
    if (w.ember > 0.01) h += w.ember * Math.abs(fbm(n, x * 0.02, z * 0.02, 2)) * 6;

    h = Math.max(h, 3); // no stray inland ponds
    // Lake in the meadow
    const ld = Math.hypot(x - LAKE.x, z - LAKE.z) + this.noise2(x * 0.02, z * 0.02) * 15;
    h = lerp(h, -6, 1 - smoothstep(LAKE.r * 0.5, LAKE.r, ld));

    return lerp(-28 - smoothstep(740, 900, d) * 20, h, island);
  }

  _generate() {
    const { n, cell, half } = this;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -half + i * cell;
        const z = -half + j * cell;
        // Biome weights per grid vertex are kept for the grass and colour passes below
        const w = this.biome(x, z);
        this._bio[j * n + i] = w;
        this.heights[j * n + i] = this._rawHeight(x, z, w);
      }
    }
    // Flatten building spots
    for (const s of FLAT_SPOTS) {
      const target = s.h ?? Math.max(3, this._rawHeight(s.x, s.z));
      s.h = target;
      const r = s.r * 1.6;
      const i0 = Math.max(0, Math.floor((s.x - r + half) / cell));
      const i1 = Math.min(n - 1, Math.ceil((s.x + r + half) / cell));
      const j0 = Math.max(0, Math.floor((s.z - r + half) / cell));
      const j1 = Math.min(n - 1, Math.ceil((s.z + r + half) / cell));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = -half + i * cell, z = -half + j * cell;
          const t = 1 - smoothstep(s.r, r, Math.hypot(x - s.x, z - s.z));
          const k = j * n + i;
          this.heights[k] = lerp(this.heights[k], target, t);
        }
      }
    }
    // Grass density + hue per vertex
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -half + i * cell, z = -half + j * cell;
        const k = j * n + i;
        const h = this.heights[k];
        const w = this._bio[k];
        const slope = this._slopeAt(i, j);
        let g = w.meadow + w.bloom * 0.9 + w.spring * 0.85 + w.frost * 0.05 + w.ember * 0.05;
        g *= smoothstep(1.2, 3.5, h) * (1 - smoothstep(0.55, 0.8, slope));
        if (h > 95) g *= 0;
        g *= smoothstep(17, 22, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)); // keep the stone plaza clear
        g *= 0.65 + 0.35 * smoothstep(-0.4, 0.3, this.noise3(x * 0.03, z * 0.03));
        this.grass[k] = clamp(g, 0, 1);
        this.hue[k] = clamp(w.spring * 1.4 - w.bloom * 0.8 + 0.3 + this.noise2(x * 0.01, z * 0.01) * 0.15, 0, 1);
      }
    }
  }

  _slopeAt(i, j) {
    const { n, cell } = this;
    const h = (a, b) => this.heights[clamp(b, 0, n - 1) * n + clamp(a, 0, n - 1)];
    const dx = (h(i + 1, j) - h(i - 1, j)) / (2 * cell);
    const dz = (h(i, j + 1) - h(i, j - 1)) / (2 * cell);
    return Math.min(1, Math.hypot(dx, dz));
  }

  // Exact height of the rendered triangle mesh.
  heightAt(x, z) {
    const { n, cell, half } = this;
    const gx = (x + half) / cell, gz = (z + half) / cell;
    if (gx < 0 || gz < 0 || gx >= n - 1 || gz >= n - 1) return -50;
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const H = this.heights;
    const ha = H[j * n + i], hb = H[j * n + i + 1], hc = H[(j + 1) * n + i], hd = H[(j + 1) * n + i + 1];
    if (fx + fz <= 1) return ha + (hb - ha) * fx + (hc - ha) * fz;
    return hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 1.5;
    const hL = this.heightAt(x - e, z), hR = this.heightAt(x + e, z);
    const hD = this.heightAt(x, z - e), hU = this.heightAt(x, z + e);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  hueAt(x, z) {
    const { n, cell, half } = this;
    const i = clamp(Math.round((x + half) / cell), 0, n - 1);
    const j = clamp(Math.round((z + half) / cell), 0, n - 1);
    return this.hue[j * n + i];
  }

  grassAt(x, z) {
    const { n, cell, half } = this;
    const i = clamp(Math.round((x + half) / cell), 0, n - 1);
    const j = clamp(Math.round((z + half) / cell), 0, n - 1);
    return this.grass[j * n + i];
  }

  _colorAt(x, z, h, slope, out, w = this.biome(x, z)) {
    const v = this.noise3(x * 0.05, z * 0.05) * 0.5 + hash2(Math.floor(x), Math.floor(z)) * 0.12;
    const c = out.setRGB(0, 0, 0);
    const add = (col, k) => {
      if (k <= 0) return;
      c.r += col.r * k; c.g += col.g * k; c.b += col.b * k;
    };
    add(PAL(v > 0.1 ? 0x93a04e : 0x74904a), w.meadow);
    add(PAL(v > 0 ? 0x3a7248 : 0x2d5e40), w.bloom);
    add(PAL(v > 0.05 ? 0xd4a843 : 0xc08f35), w.spring);
    const snowy = smoothstep(18, 40, h);
    add(TMP.copy(PAL(0x6f9b52)).lerp(PAL(v > 0 ? 0xf2f6fb : 0xdfe8f2), snowy), w.frost);
    add(PAL(v > 0.15 ? 0x7a3a28 : v > -0.1 ? 0x4a3c3a : 0x2f2a2c), w.ember);

    // Cliffs
    const rock = ROCK.copy(PAL(w.ember > 0.4 ? 0x332c2d : w.spring > 0.4 ? 0xb8683a : w.frost > 0.4 ? 0x7d8aa0 : 0x857a70));
    if (w.frost > 0.4) rock.lerp(PAL(0xe4ecf6), smoothstep(30, 70, h) * (v > -0.1 ? 0.8 : 0.4));
    if (w.spring > 0.4) {
      const band = Math.sin(h * 0.9) * 0.5 + 0.5;
      rock.lerp(PAL(0xe09a5a), band * 0.5);
    }
    c.lerp(rock, smoothstep(0.55, 0.85, slope));
    // Beaches & underwater
    c.lerp(PAL(0xe8d7a0), 1 - smoothstep(1.5, 3.2, h));
    if (h < 0) c.lerp(PAL(0x9a8a62), smoothstep(0, -12, h));
    // Volcano crater glow
    const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    if (vd < 45) c.lerp(PAL(0x5a2418), 1 - smoothstep(20, 45, vd));
    return out;
  }

  _buildMesh() {
    const { n, cell, half } = this;
    const pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const tmp = new THREE.Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -half + i * cell, z = -half + j * cell, h = this.heights[k];
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        this._colorAt(x, z, h, this._slopeAt(i, j), tmp, this._bio[k]);
        col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
      }
    }
    const idx = new Uint32Array(this.seg * this.seg * 6);
    let p = 0;
    for (let j = 0; j < this.seg; j++) {
      for (let i = 0; i < this.seg; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWet = WET;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWPos; varying vec3 vWN;
          uniform float uWet;
          float th(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
          float tn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(th(i),th(i+vec2(1,0)),f.x), mix(th(i+vec2(0,1)),th(i+vec2(1,1)),f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          // Painterly brush strokes and broad colour patches
          float strokes = tn(vWPos.xz * vec2(0.9, 0.35)) * 0.6 + tn(vWPos.xz * 3.1) * 0.4;
          float patches = tn(vWPos.xz * 0.018) * 0.6 + tn(vWPos.xz * 0.06) * 0.4;
          diffuseColor.rgb *= 0.88 + strokes * 0.2;
          diffuseColor.rgb *= vec3(0.94 + patches * 0.12, 0.96 + patches * 0.08, 0.98);
          // Layered rock strata on steep cliffs
          float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
          float cliff = smoothstep(0.3, 0.55, slope);
          float band = sin(vWPos.y * 1.7 + tn(vWPos.xz * 0.15) * 4.0);
          float band2 = sin(vWPos.y * 0.45 + tn(vWPos.xz * 0.05) * 3.0);
          diffuseColor.rgb *= mix(1.0, 0.82 + 0.1 * band + 0.12 * band2, cliff);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.95, 0.93, 1.02), cliff * 0.5);
          // Rain darkens and cools the ground
          diffuseColor.rgb *= 1.0 - uWet * 0.25;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.95, 1.08), uWet);`);
    };
    // Split into tiles that share the vertex buffers so off-screen parts get frustum-culled
    this.mesh = new THREE.Group();
    this.mesh.name = 'terrain';
    const T = 8, per = this.seg / T;
    const posAttr = geo.attributes.position, colAttr = geo.attributes.color, nAttr = geo.attributes.normal;
    for (let ty = 0; ty < T; ty++) {
      for (let tx = 0; tx < T; tx++) {
        const tIdx = [];
        for (let j = ty * per; j < (ty + 1) * per; j++) {
          for (let i = tx * per; i < (tx + 1) * per; i++) {
            const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
            tIdx.push(a, c, b, b, c, d);
          }
        }
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', posAttr);
        tg.setAttribute('normal', nAttr);
        tg.setAttribute('color', colAttr);
        tg.setIndex(tIdx);
        // Bounding sphere from the tile's own vertices
        const box = new THREE.Box3();
        const v = new THREE.Vector3();
        for (const k of [tIdx[0], tIdx[tIdx.length - 1], (ty * per) * n + (tx + 1) * per, ((ty + 1) * per) * n + tx * per]) box.expandByPoint(v.fromBufferAttribute(posAttr, k));
        let minH = Infinity, maxH = -Infinity;
        for (let q = 0; q < tIdx.length; q += 6) { const hh = posAttr.getY(tIdx[q]); minH = Math.min(minH, hh); maxH = Math.max(maxH, hh); }
        box.min.y = minH - 2; box.max.y = maxH + 2;
        tg.boundingBox = box;
        tg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
        const m = new THREE.Mesh(tg, mat);
        m.receiveShadow = true;
        this.mesh.add(m);
      }
    }
    this.geometry = geo;
  }

  _buildTexture() {
    const { n } = this;
    const data = new Uint16Array(n * n * 4);
    const toHalf = THREE.DataUtils.toHalfFloat;
    for (let k = 0; k < n * n; k++) {
      data[k * 4] = toHalf(this.heights[k]);
      data[k * 4 + 1] = toHalf(this.grass[k]);
      data[k * 4 + 2] = toHalf(this.hue[k]);
      data[k * 4 + 3] = toHalf(1);
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.heightTex = tex;
  }

  // Render a top-down colour map (for the map screen).
  renderMapCanvas(px = 512) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(px, px);
    const tmp = new THREE.Color();
    const light = new THREE.Vector3(-0.5, 0.8, -0.4).normalize();
    const nrm = new THREE.Vector3();
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const wx = -this.half + (x + 0.5) / px * this.size;
        const wz = -this.half + (y + 0.5) / px * this.size;
        const h = this.heightAt(wx, wz);
        const o = (y * px + x) * 4;
        if (h < 0) {
          const d = smoothstep(0, -25, h);
          img.data[o] = lerp(90, 30, d); img.data[o + 1] = lerp(170, 80, d); img.data[o + 2] = lerp(200, 150, d);
        } else {
          this.normalAt(wx, wz, nrm);
          const i = clamp((Math.floor((wx + this.half) / this.cell)), 0, this.n - 1);
          const j = clamp((Math.floor((wz + this.half) / this.cell)), 0, this.n - 1);
          this._colorAt(wx, wz, h, this._slopeAt(i, j), tmp);
          const s = 0.65 + 0.5 * Math.max(0, nrm.dot(light));
          img.data[o] = clamp(tmp.r * 255 * s, 0, 255);
          img.data[o + 1] = clamp(tmp.g * 255 * s, 0, 255);
          img.data[o + 2] = clamp(tmp.b * 255 * s, 0, 255);
        }
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// Shared stylised geometry builders and materials.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintTex } from './textures.js';
import { mulberry32 as _rng, makeNoise2D as _noise } from '../core/math.js';

export const MAT = {};
export const WIND = { value: 0 };

// Adds a soft rim light (and optional wind sway for instanced foliage) to a Lambert/Toon material.
export function softLit(mat, { wind = 0, rim = 0.3, wrap = 0 } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uWind = WIND;
    if (wind) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vec3 ip = vec3(0.0);
            #ifdef USE_INSTANCING
              ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            #endif
            float hgt = max(transformed.y - 1.8, 0.0);
            float sway = sin(uWind * 1.3 + ip.x * 0.05 + ip.z * 0.07) * 0.045 + sin(uWind * 3.1 + ip.x * 0.4 + transformed.y) * 0.012;
            transformed.x += sway * hgt * ${wind.toFixed(2)};
            transformed.z += sway * hgt * 0.5 * ${wind.toFixed(2)};
          }`);
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      {
        vec3 vd = normalize(vViewPosition);
        float rimF = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 3.0);
        outgoingLight += diffuseColor.rgb * rimF * ${rim.toFixed(2)};
        ${wrap ? `outgoingLight = mix(outgoingLight, diffuseColor.rgb * 0.55, ${wrap.toFixed(2)} * (1.0 - clamp(length(outgoingLight) * 1.2, 0.0, 1.0)));` : ''}
      }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `soft${wind}${rim}${wrap}`;
  return mat;
}

// Samples the material's painted map in world space (tri-planar by dominant normal axis), so any
// mesh gets evenly scaled texture without hand-made UVs.
export function worldMapped(mat, scale = 0.25) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTpW; varying vec3 vTpN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 tpw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          tpw = instanceMatrix * tpw;
        #endif
        vTpW = (modelMatrix * tpw).xyz;
        vTpN = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTpW; varying vec3 vTpN;')
      .replace('#include <map_fragment>', `
        vec3 an = abs(vTpN);
        vec2 tuv = an.y > max(an.x, an.z) ? vTpW.xz : (an.x > an.z ? vTpW.zy : vTpW.xy);
        vec4 sampledDiffuseColor = texture2D(map, tuv * ${scale.toFixed(3)});
        diffuseColor *= sampledDiffuseColor;`);
  };
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => `wm${scale}${prevKey ? prevKey.call(mat) : ''}`;
  return mat;
}

export function initMaterials() {
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const tx = (name, color, scale, o = {}) => worldMapped(lam(color, { map: paintTex(name), ...o }), scale);
  MAT.stone = tx('stone', 0xd8d2c8, 0.3);
  MAT.stoneDark = tx('stone', 0x8a8480, 0.3);
  MAT.stoneMoss = tx('stone', 0xa8c08a, 0.3);
  MAT.dungeon = bricks(lam(0x8a8494), 1.2, 0.6);
  MAT.dungeonFloor = bricks(lam(0x6a6572), 1.3, 1.3);
  MAT.wood = tx('wood', 0xe0c0a0, 0.45);
  MAT.woodDark = tx('wood', 0x9a7a60, 0.45);
  MAT.roofRed = tx('shingles', 0xc85a48, 0.35);
  MAT.roofBlue = tx('shingles', 0x5a88c0, 0.35);
  MAT.plaster = tx('plaster', 0xffffff, 0.2);
  MAT.islandRock = worldMapped(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: paintTex('strata') }), 0.06);
  MAT.vertex = lam(0xffffff, { vertexColors: true, flatShading: true });
  MAT.foliage = softLit(lam(0xffffff, { vertexColors: true }), { wind: 1, rim: 0.35 });
  MAT.glow = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  MAT.crystal = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666677, flatShading: true, transparent: true, opacity: 0.9 });
  MAT.smooth = lam(0xc8c4d8, { flatShading: true }); // un-climbable crystal walls
  MAT.mossWall = bricks(lam(0x5f8a55), 1.2, 0.6);
  MAT.bramble = lam(0x5b3d2a, { flatShading: true });
  MAT.ice = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x3070a0, emissiveIntensity: 0.3, transparent: true, opacity: 0.85, flatShading: true });
  MAT.lava = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
  MAT.dungeonWater = new THREE.MeshLambertMaterial({ color: 0x2a6fa8, emissive: 0x0a2a48, transparent: true, opacity: 0.8 });
  return MAT;
}

// World-space stone block pattern (mortar lines + per-block tint) for dungeon surfaces.
function bricks(mat, bw, bh) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBW; varying vec3 vBN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBW = (modelMatrix * vec4(transformed,1.0)).xyz; vBN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBW; varying vec3 vBN;
        float bh1(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 an = abs(vBN);
        vec2 uv = an.y > 0.6 ? vBW.xz / vec2(${bw.toFixed(2)}, ${bw.toFixed(2)}) : (an.x > an.z ? vBW.zy : vBW.xy) / vec2(${(bw * 1.6).toFixed(2)}, ${bh.toFixed(2)});
        float row = floor(uv.y);
        uv.x += mod(row, 2.0) * 0.5;
        vec2 f = fract(uv);
        float mortar = smoothstep(0.0, 0.05, f.x) * smoothstep(1.0, 0.95, f.x) * smoothstep(0.0, 0.08, f.y) * smoothstep(1.0, 0.92, f.y);
        diffuseColor.rgb *= (0.62 + 0.38 * mortar) * (0.88 + 0.24 * bh1(floor(uv)));`);
  };
  return mat;
}

export function colorize(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Merge a list of [geometry, color] pairs into one vertex-coloured non-indexed geometry.
export function mergeColored(parts) {
  const gs = parts.map(([g, c]) => colorize(g.index ? g.toNonIndexed() : g, c));
  for (const g of gs) { if (g.attributes.uv) g.deleteAttribute('uv'); }
  // Keep each part's own normals so smooth parts (canopies) stay smooth
  return mergeGeometries(gs, false);
}

export function jitter(geo, amt, seed = 1) {
  const p = geo.attributes.position;
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  // Jitter shared vertex positions consistently by hashing position
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let d = map.get(k);
    if (!d) { d = [r() * amt, r() * amt, r() * amt]; map.set(k, d); }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

const T = (g, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => {
  g.scale(sx, sy, sz);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
};
export { T };

// Lumpy blob for canopies
let BLOB_DETAIL = 1;
function blob(r, seed) {
  let g = jitter(new THREE.IcosahedronGeometry(r, BLOB_DETAIL), r * 0.22, seed);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  g.computeVertexNormals();
  return g;
}

// Darken the underside and brighten the crown of canopy vertices (fake self-shadowing).
function shadeCanopy(geo) {
  const p = geo.attributes.position, c = geo.attributes.color;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < p.count; i++) { min = Math.min(min, p.getY(i)); max = Math.max(max, p.getY(i)); }
  for (let i = 0; i < p.count; i++) {
    const r = c.getX(i), g = c.getY(i), b = c.getZ(i);
    const isLeaf = g > r * 1.15; // trunks stay as they are
    if (!isLeaf) continue;
    const t = (p.getY(i) - min) / (max - min || 1);
    const k = 0.62 + 0.55 * t;
    c.setXYZ(i, r * k + 0.03 * t, g * k + 0.04 * t, b * k * 0.95);
  }
  c.needsUpdate = true;
  return geo;
}

// lod=true builds cheap far-distance versions (low-poly canopies)
export function treeGeometries(lod = false) {
  BLOB_DETAIL = lod ? 0 : 1;
  const trunk = 0x6b4a2e;
  const round = shadeCanopy(mergeColored([
    [T(new THREE.CylinderGeometry(0.25, 0.42, 4, 7), 0, 2, 0), trunk],
    [T(new THREE.CylinderGeometry(0.08, 0.14, 1.8, 4), 0.7, 3.6, 0, 1, 1, 1, 0, 0, -0.9), trunk],
    [T(blob(2.1, 1), 0, 5.0, 0, 1.1, 0.85, 1.1), 0x62a23c],
    [T(blob(1.6, 2), 1.5, 4.4, 0.5, 1, 0.85, 1), 0x5a9a38],
    [T(blob(1.5, 3), -1.4, 4.5, -0.6, 1, 0.85, 1), 0x6aaa44],
    [T(blob(1.4, 4), 0.3, 6.3, -0.4, 1, 0.85, 1), 0x74b54c],
    [T(blob(1.2, 5), -0.5, 4.8, 1.3, 1, 0.85, 1), 0x5f9e3c],
  ]));
  const tall = shadeCanopy(mergeColored([
    [T(new THREE.CylinderGeometry(0.2, 0.35, 3.2, 6), 0, 1.6, 0), trunk],
    [T(blob(1.5, 6), 0, 3.8, 0, 1, 1.35, 1), 0x3f7f35],
    [T(blob(1.25, 7), 0.2, 5.6, 0.1, 1, 1.4, 1), 0x4a8c3a],
    [T(blob(0.95, 8), -0.1, 7.2, 0, 1, 1.4, 1), 0x57994a],
  ]));
  const pine = mergeColored([
    [T(new THREE.CylinderGeometry(0.2, 0.35, 2.4, 5), 0, 1.2, 0), trunk],
    [T(new THREE.ConeGeometry(2.4, 3.2, 7), 0, 3.2, 0), 0x2f5f3a],
    [T(new THREE.ConeGeometry(1.9, 2.8, 7), 0, 4.9, 0), 0x356b40],
    [T(new THREE.ConeGeometry(1.3, 2.4, 7), 0, 6.5, 0), 0x3c7646],
  ]);
  const snowPine = mergeColored([
    [T(new THREE.CylinderGeometry(0.2, 0.35, 2.4, 5), 0, 1.2, 0), trunk],
    [T(new THREE.ConeGeometry(2.4, 3.2, 7), 0, 3.2, 0), 0x2a4f48],
    [T(new THREE.ConeGeometry(1.95, 1.2, 7), 0, 4.2, 0), 0xf0f6ff],
    [T(new THREE.ConeGeometry(1.9, 2.8, 7), 0, 4.9, 0), 0x2f5a50],
    [T(new THREE.ConeGeometry(1.35, 1.1, 7), 0, 5.8, 0), 0xf0f6ff],
    [T(new THREE.ConeGeometry(1.3, 2.4, 7), 0, 6.5, 0), 0xe6f0fa],
  ]);
  const acacia = shadeCanopy(mergeColored([
    [T(new THREE.CylinderGeometry(0.22, 0.4, 4.2, 5), 0.3, 2.1, 0, 1, 1, 1, 0, 0, -0.15), 0x7a5230],
    [T(blob(2.6, 9), 0.7, 4.7, 0, 1.3, 0.35, 1.1), 0x8a9a3a],
    [T(blob(1.8, 10), -0.9, 4.4, 0.6, 1.2, 0.35, 1.1), 0x9aa844],
  ]));
  const dead = mergeColored([
    [T(new THREE.CylinderGeometry(0.2, 0.45, 5, 5), 0, 2.5, 0), 0x2a2224],
    [T(new THREE.CylinderGeometry(0.08, 0.16, 2.2, 4), 0.7, 3.8, 0, 1, 1, 1, 0, 0, -0.8), 0x2a2224],
    [T(new THREE.CylinderGeometry(0.08, 0.14, 1.8, 4), -0.6, 4.3, 0.2, 1, 1, 1, 0, 0.3, 0.9), 0x2a2224],
    [T(new THREE.IcosahedronGeometry(0.22, 0), 1.45, 4.5, 0), 0xff6a2a],
    [T(new THREE.IcosahedronGeometry(0.18, 0), -1.25, 4.95, 0.35), 0xff8a3a],
  ]);
  const bush = shadeCanopy(mergeColored([
    [T(blob(0.9, 11), 0, 0.6, 0), 0x4f8f36],
    [T(blob(0.7, 12), 0.7, 0.45, 0.2), 0x5ea040],
    [T(blob(0.6, 13), -0.6, 0.4, -0.3), 0x5ea040],
  ]));
  BLOB_DETAIL = 1;
  return { round, tall, pine, snowPine, acacia, dead, bush };
}

export function rockGeometry(seed = 1) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  return jitter(g, 0.45, seed);
}

// Soft round sprite texture used by particles
export function makeSoftTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Painterly blob splat texture
export function makeSplatTexture(seed = 3) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  x.fillStyle = '#fff';
  x.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 38 + r() * 16;
    const px = 64 + Math.cos(a) * rr, py = 64 + Math.sin(a) * rr;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  x.fill();
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = 44 + r() * 16, rr = 3 + r() * 7;
    x.beginPath();
    x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rr, 0, Math.PI * 2);
    x.fill();
  }
  // inner tone variation (alpha channel keeps it opaque, rgb slightly varied)
  for (let i = 0; i < 30; i++) {
    x.fillStyle = `rgba(${200 + r() * 55},${200 + r() * 55},${200 + r() * 55},0.35)`;
    x.beginPath();
    x.arc(30 + r() * 68, 30 + r() * 68, 4 + r() * 10, 0, Math.PI * 2);
    x.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function makeFlameTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.beginPath();
  x.moveTo(32, 2);
  x.bezierCurveTo(44, 20, 58, 34, 52, 48);
  x.bezierCurveTo(46, 62, 18, 62, 12, 48);
  x.bezierCurveTo(6, 34, 22, 22, 32, 2);
  x.fill();
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- painted foliage (leaf cards)

let atlasTex = null;
// 512x256 atlas: bark on the left half, leaf clump on the right half
export function foliageAtlas() {
  if (atlasTex) return atlasTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.drawImage(paintTex('bark').image, 0, 0, 256, 256);
  x.drawImage(paintTex('leaves').image, 256, 0, 256, 256);
  atlasTex = new THREE.CanvasTexture(c);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = 4;
  return atlasTex;
}

export function foliageMaterial() {
  const m = new THREE.MeshLambertMaterial({ map: foliageAtlas(), vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
  return softLit(m, { wind: 1, rim: 0.45, wrap: 0.75 });
}

// Collects triangles with position/normal/uv/color
class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  add(geo, color, uvRect = [0, 0, 0.5, 1], normalFn = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const col = new THREE.Color();
    for (let i = 0; i < P.count; i++) {
      this.p.push(P.getX(i), P.getY(i), P.getZ(i));
      const nn = normalFn ? normalFn(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i)) : [N.getX(i), N.getY(i), N.getZ(i)];
      this.n.push(nn[0], nn[1], nn[2]);
      const u = U ? U.getX(i) : 0, v = U ? U.getY(i) : 0;
      this.u.push(uvRect[0] + u * uvRect[2], uvRect[1] + v * uvRect[3]);
      col.set(typeof color === 'function' ? color(P.getX(i), P.getY(i), P.getZ(i)) : color);
      this.c.push(col.r, col.g, col.b);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const BARK = [0, 0, 0.5, 1];
const LEAF = [0.5, 0, 0.5, 1];

function trunk(B, h, r0, r1, bend = 0.25, seed = 1, tint = 0xffffff) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 8, 5, true);
  const p = g.attributes.position;
  const rand = _rng(seed);
  const bx = (rand() - 0.5) * bend, bz = (rand() - 0.5) * bend;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h;
    p.setX(i, p.getX(i) + bx * t * t * h * 0.3);
    p.setZ(i, p.getZ(i) + bz * t * t * h * 0.3);
    // Root flare
    const flare = 1 + Math.max(0, 0.25 - t) * 1.6;
    p.setX(i, p.getX(i) * flare);
    p.setZ(i, p.getZ(i) * flare);
  }
  g.computeVertexNormals();
  g.translate(0, h / 2, 0);
  B.add(g, tint, BARK);
  return [bx * h * 0.3, h, bz * h * 0.3];
}

function branch(B, from, dir, len, r, tint = 0xffffff) {
  const g = new THREE.CylinderGeometry(r * 0.5, r, len, 5, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(...from);
  B.add(g, tint, [0, 0, 0.5, 0.3]);
}

// Leaf cards scattered over an ellipsoid; normals point away from the canopy centre so the
// cluster shades like one soft volume
function canopy(B, cx, cy, cz, rx, ry, rz, count, cardSize, base, seed, opts = {}) {
  const rand = _rng(seed);
  const c0 = new THREE.Color(base);
  const top = c0.clone().offsetHSL(0.03, 0.06, 0.2);
  const bottom = c0.clone().offsetHSL(-0.03, -0.04, -0.06);
  for (let i = 0; i < count; i++) {
    // Points biased to the surface of the ellipsoid
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const k = 0.55 + 0.45 * Math.cbrt(rand());
    let px = Math.cos(th) * s * rx * k, py = u * ry * k, pz = Math.sin(th) * s * rz * k;
    if (opts.flat) py *= 0.35;
    const size = cardSize * (0.75 + rand() * 0.5);
    const q = new THREE.PlaneGeometry(size, size);
    q.rotateZ(rand() * Math.PI * 2);
    q.rotateX((rand() - 0.5) * Math.PI);
    q.rotateY(rand() * Math.PI * 2);
    q.translate(cx + px, cy + py, cz + pz);
    const tNorm = (py / (ry * (opts.flat ? 0.35 : 1)) + 1) / 2;
    const col = bottom.clone().lerp(top, Math.min(1, Math.max(0, tNorm + (rand() - 0.5) * 0.2)));
    if (opts.snow && tNorm > 0.55) col.lerp(new THREE.Color(0xeef4fb), 0.7);
    B.add(q, col.getHex(), LEAF, (x, y, z) => {
      const d = new THREE.Vector3(x - cx, (y - cy) * 0.8 + ry * 0.6, z - cz).normalize();
      return [d.x, d.y, d.z];
    });
  }
}

export function paintedTreeGeometries(lod = false) {
  const n = (v) => Math.max(4, Math.round(lod ? v * 0.35 : v));
  const sz = (v) => (lod ? v * 1.5 : v);
  const out = {};
  let B = new GeoBuilder();
  let t = trunk(B, 4.2, 0.42, 0.22, 0.4, 1);
  branch(B, [t[0] * 0.6, 3.2, t[2] * 0.6], new THREE.Vector3(0.8, 1, 0.2), 1.8, 0.14);
  branch(B, [t[0] * 0.7, 3.6, t[2] * 0.7], new THREE.Vector3(-0.7, 1, -0.4), 1.6, 0.12);
  canopy(B, t[0], 5.0, t[2], 2.5, 1.9, 2.5, n(80), sz(1.45), 0x6aad45, 11);
  canopy(B, t[0] + 1.3, 4.3, t[2] + 0.6, 1.5, 1.2, 1.5, n(26), sz(1.2), 0x66a840, 12);
  out.round = B.build();

  B = new GeoBuilder();
  t = trunk(B, 3.4, 0.34, 0.18, 0.2, 2);
  canopy(B, t[0], 5.2, t[2], 1.5, 3.0, 1.5, n(64), sz(1.2), 0x559445, 13);
  out.tall = B.build();

  const pine = (snow, seed) => {
    const b = new GeoBuilder();
    const tt = trunk(b, 7.2, 0.3, 0.1, 0.05, seed);
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const y = 2 + i * 1.15;
      const r = 2.5 * (1 - i / (tiers + 0.6));
      canopy(b, tt[0] * (y / 7), y, tt[2] * (y / 7), r, 0.5, r, n(22 - i * 2), sz(1.1), snow ? 0x3a6656 : 0x3f7448, seed * 10 + i, { snow });
    }
    return b.build();
  };
  out.pine = pine(false, 3);
  out.snowPine = pine(true, 4);

  B = new GeoBuilder();
  t = trunk(B, 4.4, 0.4, 0.2, 0.7, 5);
  branch(B, [t[0], 4.2, t[2]], new THREE.Vector3(1, 0.5, 0.2), 2.2, 0.14);
  branch(B, [t[0], 4.2, t[2]], new THREE.Vector3(-1, 0.45, -0.3), 2, 0.14);
  canopy(B, t[0], 4.9, t[2], 3.3, 0.9, 3.0, n(60), sz(1.4), 0x9aaa44, 15, { flat: true });
  out.acacia = B.build();

  B = new GeoBuilder();
  t = trunk(B, 5, 0.45, 0.14, 0.9, 6, 0x6a6064);
  branch(B, [t[0] * 0.6, 3.4, t[2] * 0.6], new THREE.Vector3(1, 0.8, 0), 2.2, 0.13, 0x6a6064);
  branch(B, [t[0] * 0.7, 4.0, t[2] * 0.7], new THREE.Vector3(-0.8, 1, 0.3), 1.9, 0.12, 0x6a6064);
  branch(B, [t[0] * 0.8, 4.5, t[2] * 0.8], new THREE.Vector3(0.2, 1, -1), 1.5, 0.1, 0x6a6064);
  // A few glowing ember leaves
  canopy(B, t[0], 5.2, t[2], 1.3, 0.8, 1.3, n(6), sz(0.7), 0xff6a2a, 16);
  out.dead = B.build();

  B = new GeoBuilder();
  canopy(B, 0, 0.7, 0, 1.2, 0.8, 1.2, n(28), sz(0.9), 0x5f9f40, 17);
  canopy(B, 0.7, 0.55, 0.3, 0.8, 0.6, 0.8, n(12), sz(0.8), 0x6aaa48, 18);
  out.bush = B.build();
  return out;
}

// Smooth, noise-sculpted boulder with painted rock texture
let rockNoise = null;
export function smoothRockGeometry(seed = 1) {
  if (!rockNoise) rockNoise = _noise(91);
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const d = 1 + rockNoise(v.x * 1.6 + seed, v.z * 1.6 + v.y) * 0.22 + rockNoise(v.x * 4 + v.y * 3, v.z * 4 + seed) * 0.07;
    // Flattened base, slightly faceted top like a weathered boulder
    p.setXYZ(i, v.x * d, Math.max(-0.35, v.y * d * 0.9), v.z * d);
  }
  g.deleteAttribute('normal');
  let m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
}

export function rockMaterial() {
  const t = paintTex('rock');
  return new THREE.MeshLambertMaterial({ map: t, color: 0xffffff });
}

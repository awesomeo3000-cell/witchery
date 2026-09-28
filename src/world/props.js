// Shared stylised geometry builders and materials.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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

export function initMaterials() {
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  MAT.stone = lam(0x9c968c, { flatShading: true });
  MAT.stoneDark = lam(0x6b6660, { flatShading: true });
  MAT.stoneMoss = lam(0x7f8f6a, { flatShading: true });
  MAT.dungeon = bricks(lam(0x8a8494), 1.2, 0.6);
  MAT.dungeonFloor = bricks(lam(0x6a6572), 1.3, 1.3);
  MAT.wood = lam(0x8a5a36, { flatShading: true });
  MAT.woodDark = lam(0x5a3a24, { flatShading: true });
  MAT.roofRed = lam(0xb4483a, { flatShading: true });
  MAT.roofBlue = lam(0x3f6fa8, { flatShading: true });
  MAT.plaster = lam(0xefe4cc, { flatShading: true });
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
function blob(r, seed) {
  let g = jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.22, seed);
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

export function treeGeometries() {
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

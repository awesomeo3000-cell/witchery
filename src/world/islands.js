// Floating sky islands: grassy caps over layered, banded rock bodies with hanging chunks,
// dangling roots and waterfalls that pour off the edge into the clouds.
import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';
import { mergeColored, T, jitter, treeGeometries } from './props.js';

const STRATA = [0xc8a995, 0xa98f97, 0x8c7a8e, 0xb49a8a, 0x76687e, 0x9a8378];

// Build one merged, vertex-coloured island geometry. The walkable top sits at y = 0.
export function islandGeometry(r, depth, seed, opts = {}) {
  const rand = mulberry32(seed);
  const N = Math.max(14, Math.round(r * 1.6));
  const K = opts.layers ?? 7;
  const outline = [];
  for (let i = 0; i < N; i++) outline.push(0.82 + rand() * 0.28 + Math.sin(i * 0.9 + seed) * 0.06);
  const ringR = [], ringY = [];
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    // Strata: every band steps in a little, giving ledges on the cliff
    const taper = 1 - Math.pow(t, 1.35) * 0.93;
    ringR.push(taper * (k % 2 ? 0.94 : 1) * r);
    ringY.push(-0.6 - Math.pow(t, 1.05) * depth);
  }
  const pos = [], col = [];
  const c = new THREE.Color();
  const tri = (a, b, d, hex, shade = 1) => {
    pos.push(...a, ...b, ...d);
    c.setHex(hex).multiplyScalar(shade);
    for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b);
  };
  const P = (k, i) => {
    const ii = ((i % N) + N) % N;
    const a = (ii / N) * Math.PI * 2;
    const groove = 1 + ((ii * 7 + k * 3) % 5 === 0 ? -0.06 : 0);
    const rr = ringR[k] * outline[ii] * groove * (k === K ? 0.2 : 1);
    return [Math.cos(a) * rr, ringY[k] + (k > 0 && k < K ? (rand() - 0.5) * depth * 0.03 : 0), Math.sin(a) * rr];
  };
  // Cache jittered ring vertices so neighbouring faces share them
  const V = [];
  for (let k = 0; k <= K; k++) { V.push([]); for (let i = 0; i < N; i++) V[k].push(P(k, i)); }
  // Grass cap: centre dome + lip
  const grassA = opts.grass ?? 0x7fb04a, grassB = opts.grass2 ?? 0x6a9e3e;
  const top = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = r * outline[i] * 1.03;
    top.push([Math.cos(a) * rr, 0, Math.sin(a) * rr]);
  }
  const mid = [];
  for (let i = 0; i < N; i++) mid.push([top[i][0] * 0.55, 0.35 + rand() * 0.2, top[i][2] * 0.55]);
  const centre = [0, 0.6, 0];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    tri(centre, mid[j], mid[i], rand() < 0.5 ? grassA : grassB, 1.05);
    tri(mid[i], mid[j], top[j], grassA, 0.97);
    tri(mid[i], top[j], top[i], grassB, 1.0);
    // Grass lip hanging over the cliff
    const lip = (p) => [p[0] * 1.0, -0.9, p[2] * 1.0];
    tri(top[i], top[j], lip(top[j]), 0x5f8a3a, 0.8);
    tri(top[i], lip(top[j]), lip(top[i]), 0x5f8a3a, 0.8);
    tri(lip(top[i]), lip(top[j]), V[0][j], 0x8a7060, 0.9);
    tri(lip(top[i]), V[0][j], V[0][i], 0x8a7060, 0.9);
  }
  // Rock body bands
  for (let k = 0; k < K; k++) {
    const band = STRATA[(k + seed) % STRATA.length];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const shade = 0.82 + 0.3 * Math.max(0, Math.cos((i / N) * Math.PI * 2 - 0.8)); // fake sun side
      if (k === K - 1) tri(V[k][i], V[k][j], V[K][0], band, shade * 0.85);
      else {
        tri(V[k][i], V[k][j], V[k + 1][j], band, shade);
        tri(V[k][i], V[k + 1][j], V[k + 1][i], band, shade * 0.96);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const parts = [[geo, 0xffffff]];
  // Hanging rock chunks & roots under the island
  for (let i = 0; i < Math.round(r / 3); i++) {
    const a = rand() * Math.PI * 2, d = rand() * r * 0.6;
    const s = 1 + rand() * r * 0.12;
    parts.push([T(jitter(new THREE.DodecahedronGeometry(1, 0), 0.3, seed + i), Math.cos(a) * d, -depth * (0.35 + rand() * 0.5), Math.sin(a) * d, s, s * 1.4, s), STRATA[(i + 2) % STRATA.length]]);
  }
  for (let i = 0; i < Math.round(r / 2); i++) {
    const a = rand() * Math.PI * 2;
    const len = 2 + rand() * r * 0.25;
    parts.push([T(new THREE.CylinderGeometry(0.05, 0.12, len, 3), Math.cos(a) * r * 0.9, -1 - len / 2, Math.sin(a) * r * 0.9), 0x4f6a3a]);
  }
  // Trees & rocks on top
  const trees = treeGeometries();
  const nTrees = opts.trees ?? Math.round(r / 5);
  for (let i = 0; i < nTrees; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * 0.6;
    const s = 0.8 + rand() * 0.5;
    const g = (rand() < 0.3 ? trees.tall : trees.round).clone();
    g.scale(s, s, s);
    g.rotateY(rand() * 6);
    g.translate(Math.cos(a) * d, 0.3, Math.sin(a) * d);
    parts.push([g, null]);
  }
  for (let i = 0; i < Math.round(r / 6); i++) {
    const a = rand() * Math.PI * 2, d = rand() * r * 0.7;
    const s = 0.5 + rand() * 1.2;
    parts.push([T(jitter(new THREE.DodecahedronGeometry(1, 0), 0.3, i + seed * 3), Math.cos(a) * d, 0.3, Math.sin(a) * d, s * 1.3, s * 0.8, s), 0x9a9490]);
  }
  // mergeColored recolours everything, so pre-coloured parts are merged separately
  const pre = parts.filter((p) => p[1] === null || p[1] === 0xffffff).map((p) => p[0]);
  const rest = mergeColored(parts.filter((p) => p[1] !== null && p[1] !== 0xffffff));
  const all = [...pre.map((g) => (g.index ? g.toNonIndexed() : g)), rest];
  for (const g of all) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return mergeGeoms(all);
}

function mergeGeoms(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = g.attributes.color;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (c) col.set(c.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

// Animated waterfall ribbon + mist at the bottom
export function makeWaterfallMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        float s = n(vec2(uv.x * 9.0, uv.y * 3.0 + uTime * 2.2)) * 0.6 + n(vec2(uv.x * 23.0, uv.y * 7.0 + uTime * 3.4)) * 0.4;
        float edge = smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x);
        float fade = smoothstep(0.0, 0.45, uv.y);
        vec3 col = mix(vec3(0.62, 0.8, 0.9), vec3(1.0), smoothstep(0.45, 0.8, s));
        float a = (0.45 + 0.5 * s) * edge * fade;
        gl_FragColor = vec4(col, a);
      }`,
  });
}

export function makeWaterfall(mat, width, length) {
  const g = new THREE.PlaneGeometry(width, length, 1, 8);
  // Slight outward curve as it falls
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = (length / 2 - y) / length;
    p.setZ(i, t * t * length * 0.12);
  }
  g.translate(0, -length / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 3;
  m.userData.dynamic = true;
  return m;
}

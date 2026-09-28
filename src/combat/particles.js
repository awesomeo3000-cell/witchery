// Pooled point-sprite particles (soft blobs + additive flames).
import * as THREE from 'three';
import { makeSoftTexture, makeFlameTexture } from '../world/props.js';

class Pool {
  constructor(scene, cap, tex, additive) {
    this.cap = cap;
    this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    this.p = []; // particle state
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uScale: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute vec4 aColor; attribute float aSize; uniform float uScale;
        varying vec4 vC;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D uTex; varying vec4 vC;
        void main(){ vec4 t = texture2D(uTex, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
          gl_FragColor = vec4(vC.rgb, vC.a * t.a); if (gl_FragColor.a < 0.01) discard; }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  add(o) {
    if (this.p.length >= this.cap) this.p.shift();
    this.p.push(o);
  }

  update(dt) {
    const arr = this.p;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const q = arr[i];
      q.life -= dt;
      if (q.life <= 0) continue;
      q.vy -= q.g * dt;
      const d = Math.exp(-q.drag * dt);
      q.vx *= d; q.vy *= d; q.vz *= d;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      arr[w++] = q;
    }
    arr.length = w;
    for (let i = 0; i < w; i++) {
      const q = arr[i];
      const t = 1 - q.life / q.max;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.col[i * 4] = q.r; this.col[i * 4 + 1] = q.gr; this.col[i * 4 + 2] = q.b;
      this.col[i * 4 + 3] = q.a * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
      this.size[i] = q.s * (q.grow ? 1 + t * q.grow : 1 - t * 0.5);
    }
    this.geo.setDrawRange(0, w);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

const tmpC = new THREE.Color();

export class Particles {
  constructor(scene) {
    this.soft = new Pool(scene, 4000, makeSoftTexture(), false);
    this.glow = new Pool(scene, 3000, makeSoftTexture(), true);
    this.flame = new Pool(scene, 2500, makeFlameTexture(), true);
  }

  setScale(h) {
    for (const p of [this.soft, this.glow, this.flame]) p.mat.uniforms.uScale.value = h * 0.55;
  }

  // o: {count, color, speed, life, size, gravity, drag, up, spread, alpha, pool, grow, jitter}
  burst(pos, o = {}) {
    const pool = this[o.pool || 'soft'];
    const count = o.count ?? 12;
    tmpC.set(o.color ?? 0xffffff);
    for (let i = 0; i < count; i++) {
      const sp = (o.speed ?? 4) * (0.4 + Math.random() * 0.8);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(1 - 2 * Math.random() * (o.spread ?? 1));
      const dir = o.dir;
      let vx = Math.sin(ph) * Math.cos(th) * sp, vy = Math.cos(ph) * sp, vz = Math.sin(ph) * Math.sin(th) * sp;
      if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
      const j = o.jitter ?? 0.2;
      const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.8);
      const cv = o.colorVar ?? 0.1;
      pool.add({
        x: pos.x + (Math.random() - 0.5) * j, y: pos.y + (Math.random() - 0.5) * j, z: pos.z + (Math.random() - 0.5) * j,
        vx, vy: vy + (o.up ?? 0), vz,
        g: o.gravity ?? 6, drag: o.drag ?? 1.5,
        life, max: life,
        r: Math.min(1, tmpC.r + (Math.random() - 0.5) * cv), gr: Math.min(1, tmpC.g + (Math.random() - 0.5) * cv), b: Math.min(1, tmpC.b + (Math.random() - 0.5) * cv),
        a: o.alpha ?? 1, s: (o.size ?? 0.5) * (0.6 + Math.random() * 0.8), grow: o.grow || 0,
      });
    }
  }

  flames(pos, radius = 1, count = 2, scale = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * radius;
      const life = 0.5 + Math.random() * 0.5;
      const hot = Math.random();
      this.flame.add({
        x: pos.x + Math.cos(a) * d, y: pos.y + 0.1, z: pos.z + Math.sin(a) * d,
        vx: (Math.random() - 0.5) * 0.5, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 0.5,
        g: -1, drag: 1, life, max: life,
        r: 1, gr: 0.3 + hot * 0.4, b: 0.08 + hot * 0.08, a: 0.75, s: (0.5 + Math.random() * 0.6) * scale, grow: 0,
      });
    }
  }

  update(dt) {
    this.soft.update(dt);
    this.glow.update(dt);
    this.flame.update(dt);
  }
}

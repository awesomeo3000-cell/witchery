// Paint ribbons: the flowing trail behind a ridden brush, and the swoosh arc of brush strikes.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

const trailMat = () => new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uStyle: { value: 0 } },
  vertexShader: /* glsl */`
    attribute float aAlpha; attribute vec2 aUv;
    varying float vA; varying vec2 vUv;
    void main(){ vA = aAlpha; vUv = aUv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor; uniform float uTime; uniform int uStyle;
    varying float vA; varying vec2 vUv;
    vec3 hue(float x){ return clamp(abs(mod(x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    void main(){
      // Dry-brush edges: bristle streaks along the stroke, frayed where it thins out
      float streak = n(vec2(vUv.x * 3.0, vUv.y * 26.0));
      float edge = smoothstep(0.0, 0.18 + streak * 0.2, vUv.y) * smoothstep(1.0, 0.82 - streak * 0.2, vUv.y);
      float a = vA * edge * (0.75 + 0.25 * streak);
      if (a < 0.02) discard;
      vec3 base = uColor;
      // Wardrobe trail styles: 1 rainbow, 2 starlight, 3 ember sparks
      if (uStyle == 1) base = hue(fract(vUv.x * 1.5 - uTime * 0.4 + vUv.y * 0.15)) * 1.3;
      else if (uStyle == 2) {
        float st = step(0.965, h(floor(vec2(vUv.x * 60.0, vUv.y * 8.0) + floor(uTime * 8.0))));
        base = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.92, 0.6), vUv.x) + st * 2.5;
      } else if (uStyle == 3) {
        float fl = n(vec2(vUv.x * 10.0 - uTime * 6.0, vUv.y * 5.0));
        base = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.85, 0.3), fl) * (1.2 + fl);
      }
      vec3 c = base * (0.85 + 0.35 * streak) + vec3(0.08) * smoothstep(0.4, 0.5, abs(vUv.y - 0.5));
      gl_FragColor = vec4(c, a);
    }`,
});

// Camera-facing ribbon that follows a moving point (brush flight trail).
export class Ribbon {
  constructor(scene, { max = 48, width = 1.1, life = 0.9 } = {}) {
    this.max = max;
    this.width = width;
    this.life = life;
    this.pts = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 2 * 3);
    this.alpha = new Float32Array(max * 2);
    this.uv = new Float32Array(max * 2 * 2);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aUv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.mat = trailMat();
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  update(dt, head, active, colorHex) {
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[0].age > this.life) this.pts.shift();
    if (active) {
      const last = this.pts[this.pts.length - 1];
      if (!last || last.p.distanceToSquared(head) > 0.25) this.pts.push({ p: head.clone(), age: 0 });
      else last.p.copy(head);
      if (this.pts.length > this.max) this.pts.shift();
      this.mat.uniforms.uColor.value.setHex(colorHex);
    }
    this.mat.uniforms.uTime.value = G.time;
    this.mat.uniforms.uStyle.value = this.style || 0;
    const n = this.pts.length;
    this.mesh.visible = n > 1;
    if (n < 2) return;
    const cam = G.camera.position;
    const t = new THREE.Vector3(), side = new THREE.Vector3(), toCam = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = this.pts[Math.max(0, i - 1)].p, b = this.pts[Math.min(n - 1, i + 1)].p;
      t.subVectors(b, a).normalize();
      toCam.subVectors(cam, this.pts[i].p).normalize();
      side.crossVectors(t, toCam).normalize();
      const k = this.pts[i].age / this.life;
      const w = this.width * (1 - k) * Math.min(1, (i + 1) / 3);
      const p = this.pts[i].p;
      const o = i * 6;
      this.pos[o] = p.x + side.x * w; this.pos[o + 1] = p.y + side.y * w; this.pos[o + 2] = p.z + side.z * w;
      this.pos[o + 3] = p.x - side.x * w; this.pos[o + 4] = p.y - side.y * w; this.pos[o + 5] = p.z - side.z * w;
      const al = (1 - k) * 0.9;
      this.alpha[i * 2] = al; this.alpha[i * 2 + 1] = al;
      this.uv[i * 4] = i / n; this.uv[i * 4 + 1] = 0; this.uv[i * 4 + 2] = i / n; this.uv[i * 4 + 3] = 1;
    }
    this.geo.setDrawRange(0, (n - 1) * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aUv.needsUpdate = true;
  }

  dispose(scene) { scene.remove(this.mesh); this.geo.dispose(); }
}

// Swoosh between the brush tip and ferrule over the last few frames of a strike.
export class SwingTrail {
  constructor(scene, { max = 14, life = 0.16 } = {}) {
    this.max = max;
    this.life = life;
    this.pts = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 2 * 3);
    this.alpha = new Float32Array(max * 2);
    this.uv = new Float32Array(max * 2 * 2);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aUv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.mat = trailMat();
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  update(dt, tip, base, active, colorHex) {
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[0].age > this.life) this.pts.shift();
    if (active) {
      // Extend the blade a little past the tip for a bolder arc
      const ext = tip.clone().sub(base).multiplyScalar(0.35).add(tip);
      this.pts.push({ a: ext, b: base.clone(), age: 0 });
      if (this.pts.length > this.max) this.pts.shift();
      this.mat.uniforms.uColor.value.setHex(colorHex);
    }
    const n = this.pts.length;
    this.mesh.visible = n > 1;
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
      const q = this.pts[i];
      const o = i * 6;
      this.pos[o] = q.a.x; this.pos[o + 1] = q.a.y; this.pos[o + 2] = q.a.z;
      this.pos[o + 3] = q.b.x; this.pos[o + 4] = q.b.y; this.pos[o + 5] = q.b.z;
      const al = (1 - q.age / this.life) * (i / n) * 0.95;
      this.alpha[i * 2] = al; this.alpha[i * 2 + 1] = al * 0.3;
      this.uv[i * 4] = i / n; this.uv[i * 4 + 1] = 0.05; this.uv[i * 4 + 2] = i / n; this.uv[i * 4 + 3] = 0.95;
    }
    this.geo.setDrawRange(0, (n - 1) * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aUv.needsUpdate = true;
  }
}

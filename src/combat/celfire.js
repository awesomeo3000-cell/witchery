// Cel-shaded flames: flat, hand-drawn looking flame tongues (red rim, orange body, pale yellow core)
// that stand on burning Ember paint and lick around burning ink creatures. One instanced draw call,
// rebuilt every frame from whatever is on fire.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

const MAX = 260;

// Palettes: 0 Ember (red/orange), 1 Frost (blue/white), 2 Spring (gold), 3 Bloom (green), 4 Prism (violet)
export const FLAME_PALETTE = { 0xe8442e: 0, 0x3a9ae8: 1, 0xf2c229: 2, 0x3fb54a: 3, 0xc8b8ff: 4 };
// Fixed flames on torches and braziers; registered by level builders at any time
export const STATIC_FLAMES = [];
export function addFlame(pos, scale = 0.7, palette = 0, on = null) {
  const f = { pos: pos.clone(), scale, palette, on, phase: Math.random() * 100 };
  STATIC_FLAMES.push(f);
  return f;
}

export class CelFire {
  constructor(scene) {
    const base = new THREE.PlaneGeometry(1, 1.6).translate(0, 0.8, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.aPos = new Float32Array(MAX * 3);
    this.aScale = new Float32Array(MAX);
    this.aPhase = new Float32Array(MAX);
    this.aTint = new Float32Array(MAX);
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(this.aScale, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(this.aPhase, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(this.aTint, 1).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 0;
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute vec3 aPos; attribute float aScale, aPhase, aTint;
        uniform float uTime;
        varying vec2 vUv; varying float vPhase; varying float vTint;
        void main(){
          vUv = uv; vPhase = aPhase; vTint = aTint;
          // Upright billboard: turn to face the camera around the vertical axis only
          vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
          float stretch = 1.0 + 0.14 * sin(uTime * 9.0 + aPhase * 7.0) + 0.06 * sin(uTime * 23.0 + aPhase);
          vec3 w = aPos + right * position.x * aScale + vec3(0.0, position.y * aScale * stretch, 0.0);
          w += right * sin(uTime * 5.0 + aPhase * 3.0) * 0.12 * aScale * uv.y * uv.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec2 vUv; varying float vPhase; varying float vTint;
        void main(){
          float y = vUv.y;
          float x = (vUv.x - 0.5) * 2.0;
          // Wavy tongue that flickers from side to side as it rises
          x += sin(y * 7.0 - uTime * 9.0 + vPhase * 5.0) * 0.16 * y;
          // Teardrop: a round belly at the bottom, tapering to a curled tip
          float w = y < 0.28 ? sqrt(max(0.0, 1.0 - pow((0.28 - y) / 0.28, 2.0))) : pow(max(0.0, (1.0 - y) / 0.72), 1.25);
          float t = abs(x) / max(w, 0.001);
          if (t > 1.0 || w <= 0.0) discard;
          // Flat cel bands: red rim, orange body, pale core low in the flame
          vec3 rim = vec3(0.9, 0.22, 0.06), body = vec3(1.0, 0.5, 0.1), core = vec3(1.0, 0.86, 0.5);
          if (vTint > 0.5 && vTint < 1.5) { rim = vec3(0.2, 0.45, 0.9); body = vec3(0.55, 0.85, 1.0); core = vec3(0.94, 0.99, 1.0); }
          else if (vTint > 1.5 && vTint < 2.5) { rim = vec3(0.8, 0.5, 0.06); body = vec3(0.98, 0.78, 0.18); core = vec3(1.0, 0.96, 0.72); }
          else if (vTint > 2.5 && vTint < 3.5) { rim = vec3(0.16, 0.5, 0.2); body = vec3(0.42, 0.85, 0.36); core = vec3(0.88, 1.0, 0.8); }
          else if (vTint > 3.5) { rim = vec3(0.45, 0.3, 0.85); body = vec3(0.75, 0.66, 1.0); core = vec3(0.97, 0.94, 1.0); }
          vec3 c = t > 0.8 ? rim : (t < 0.48 && y < 0.62 - 0.08 * sin(uTime * 7.0 + vPhase)) ? core : body;
          gl_FragColor = vec4(pow(c, vec3(2.2)) * 0.95, 1.0); // palette authored in sRGB
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }

  update(dt) {
    this.mat.uniforms.uTime.value = G.time;
    let n = 0;
    const cam = G.camera.position;
    const put = (x, y, z, s, ph, tint = 0) => {
      if (n >= MAX) return;
      this.aPos[n * 3] = x; this.aPos[n * 3 + 1] = y; this.aPos[n * 3 + 2] = z;
      this.aScale[n] = s; this.aPhase[n] = ph; this.aTint[n] = tint;
      n++;
    };
    // Torches and braziers: a main tongue and a smaller one beside it
    for (const f of STATIC_FLAMES) {
      if (f.on && !f.on()) continue;
      if (f.pos.distanceToSquared(cam) > 80 * 80) continue;
      put(f.pos.x, f.pos.y, f.pos.z, f.scale, f.phase, f.palette);
      put(f.pos.x + 0.12 * f.scale, f.pos.y, f.pos.z + 0.08 * f.scale, f.scale * 0.62, f.phase + 3.1, f.palette);
    }
    // Burning Ember paint
    for (const s of G.paint?.splats || []) {
      if (s.element !== 'fire' || s.life <= 0 || s.vertical || s.onWater) continue;
      if (Math.abs(s.pos.x - cam.x) > 120 || Math.abs(s.pos.z - cam.z) > 120) continue;
      s.fireSeed ??= Math.random() * 1000;
      const env = Math.min(1, (s.max - s.life) / 0.35) * Math.min(1, s.life / 1.2);
      const k = Math.max(3, Math.min(9, Math.round(s.radius * 3)));
      for (let i = 0; i < k; i++) {
        const h = Math.sin(s.fireSeed + i * 12.9898) * 43758.5453;
        const f = h - Math.floor(h);
        const a = i * 2.39996 + s.fireSeed, d = Math.sqrt((i + 0.5) / k) * s.radius * 0.8;
        const x = s.pos.x + Math.cos(a) * d, z = s.pos.z + Math.sin(a) * d;
        const y = s.kind === 'terrain' && G.terrain ? G.terrain.heightAt(x, z) : s.pos.y;
        put(x, y, z, (0.7 + f * 0.7) * env * Math.min(1.4, 0.7 + s.radius * 0.25), s.fireSeed + i);
      }
    }
    // Ink creatures on fire
    for (const e of G.enemies?.list || []) {
      if (!e.alive || !(e.status?.burn > 0)) continue;
      if (e.pos.distanceToSquared(cam) > 90 * 90) continue;
      const r = e.radius || 0.8, hgt = e.height || 1.6;
      for (let i = 0; i < 3; i++) {
        const a = e.id * 1.7 + i * 2.1;
        put(e.pos.x + Math.cos(a) * r * 0.6, e.pos.y + hgt * (0.25 + i * 0.18), e.pos.z + Math.sin(a) * r * 0.6, 0.35 + r * 0.35, e.id + i * 3.3);
      }
    }
    this.geo.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n) {
      this.geo.attributes.aPos.needsUpdate = true;
      this.geo.attributes.aScale.needsUpdate = true;
      this.geo.attributes.aPhase.needsUpdate = true;
      this.geo.attributes.aTint.needsUpdate = true;
    }
  }
}

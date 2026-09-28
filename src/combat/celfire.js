// Cel-shaded flames: flat, hand-drawn looking flame tongues (red rim, orange body, pale yellow core)
// that stand on burning Ember paint and lick around burning ink creatures. One instanced draw call,
// rebuilt every frame from whatever is on fire.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

const MAX = 220;

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
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(this.aScale, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(this.aPhase, 1).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 0;
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute vec3 aPos; attribute float aScale, aPhase;
        uniform float uTime;
        varying vec2 vUv; varying float vPhase;
        void main(){
          vUv = uv; vPhase = aPhase;
          // Upright billboard: turn to face the camera around the vertical axis only
          vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
          float stretch = 1.0 + 0.14 * sin(uTime * 9.0 + aPhase * 7.0) + 0.06 * sin(uTime * 23.0 + aPhase);
          vec3 w = aPos + right * position.x * aScale + vec3(0.0, position.y * aScale * stretch, 0.0);
          w += right * sin(uTime * 5.0 + aPhase * 3.0) * 0.12 * aScale * uv.y * uv.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec2 vUv; varying float vPhase;
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
    const put = (x, y, z, s, ph) => {
      if (n >= MAX) return;
      this.aPos[n * 3] = x; this.aPos[n * 3 + 1] = y; this.aPos[n * 3 + 2] = z;
      this.aScale[n] = s; this.aPhase[n] = ph;
      n++;
    };
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
    }
  }
}

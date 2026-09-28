// GPU grass field that wraps around the camera. Heights/density come from the terrain texture,
// so thousands of clumps cost one draw call.
import * as THREE from 'three';
import { G, inDungeonY } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';

export class Grass {
  constructor(scene, terrain, quality = 1) {
    this.scene = scene;
    this.terrain = terrain;
    this.build(quality);
  }

  build(quality) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    if (quality <= 0) { this.mesh = null; return; }
    const N = Math.round(110 + 60 * quality);
    const spacing = 0.72;
    const W = N * spacing;

    // Base clump: 3 tapered blades
    const pos = [], hgt = [], idx = [];
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI + 0.3;
      const ox = Math.cos(a * 2.3) * 0.12, oz = Math.sin(a * 1.7) * 0.12;
      const lean = 0.18 * (b - 1);
      const w = 0.06;
      const cs = Math.cos(a), sn = Math.sin(a);
      const pts = [[-w, 0], [w, 0], [-w * 0.6, 0.5], [w * 0.6, 0.5], [0, 1]];
      const base = pos.length / 3;
      for (const [px, py] of pts) {
        const lx = px * cs + ox + lean * py * sn;
        const lz = px * sn + oz - lean * py * cs;
        pos.push(lx, py, lz);
        hgt.push(py);
      }
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1));
    geo.setIndex(idx);
    const rand = mulberry32(5);
    const offs = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = (j * N + i) * 3;
        offs[k] = (i - N / 2) * spacing;
        offs[k + 1] = (j - N / 2) * spacing;
        offs[k + 2] = rand();
      }
    }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 3));
    geo.instanceCount = N * N;

    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uCenter: { value: new THREE.Vector3() },
        uW: { value: W },
        uSpacing: { value: spacing },
        uHeight: { value: null },
        uSize: { value: this.terrain.size },
        uTexN: { value: this.terrain.n },
        uTime: { value: 0 },
        uPush: { value: [new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0)] },
        uLight: { value: new THREE.Color(1, 1, 1) },
        uPaint: { value: null },
        uPaintC: { value: new THREE.Vector2() },
        uPaintS: { value: 128 },
      },
    ]);
    uniforms.uHeight.value = this.terrain.heightTex;
    const mat = new THREE.ShaderMaterial({
      uniforms,
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        #include <fog_pars_vertex>
        uniform vec3 uCenter; uniform float uW, uSpacing, uSize, uTexN, uTime;
        uniform sampler2D uHeight, uPaint;
        uniform vec2 uPaintC; uniform float uPaintS;
        uniform vec3 uPush[4];
        attribute vec3 aOff; attribute float aH;
        varying float vH; varying float vHue; varying float vShade; varying vec4 vPaint;
        void main(){
          vec2 off = aOff.xy;
          vec2 wp = off + uW * floor((uCenter.xz - off) / uW + 0.5);
          float r = aOff.z;
          wp += (vec2(fract(r * 13.17), fract(r * 71.73)) - 0.5) * uSpacing * 1.4;
          vec2 uv = (wp + uSize * 0.5) / uSize;
          vec2 tuv = uv * (uTexN - 1.0) / uTexN + 0.5 / uTexN;
          vec4 t = texture2D(uHeight, tuv);
          float dens = t.g;
          float dist = length(wp - uCenter.xz);
          float fade = 1.0 - smoothstep(uW * 0.3, uW * 0.48, dist);
          float s = smoothstep(r - 0.08, r + 0.08, dens) * fade;
          vec2 puv = (wp - uPaintC) / uPaintS + 0.5;
          vPaint = (puv.x > 0.0 && puv.x < 1.0 && puv.y > 0.0 && puv.y < 1.0) ? texture2D(uPaint, puv) : vec4(0.0);
          float bh = (0.32 + fract(r * 7.3) * 0.42) * s * (0.6 + 0.5 * dens) * (1.0 - vPaint.a * 0.3);
          float a = r * 6.2831;
          vec3 p = position;
          p = vec3(p.x * cos(a) - p.z * sin(a), p.y, p.x * sin(a) + p.z * cos(a));
          p.y *= bh;
          p.xz *= 0.6 + 0.6 * s;
          float w = sin(uTime * 1.6 + wp.x * 0.13 + wp.y * 0.09) * 0.55 + sin(uTime * 3.1 + wp.x * 0.5 + wp.y * 0.3) * 0.18;
          vec2 bend = vec2(w * 0.28, w * 0.12) * aH * aH;
          for (int i = 0; i < 4; i++) {
            vec2 d = wp - uPush[i].xz;
            float l = length(d);
            if (l < 1.5 && abs(t.r - uPush[i].y) < 2.5) bend += (d / max(l, 0.01)) * (1.5 - l) * 0.75 * aH;
          }
          vec3 world = vec3(wp.x + p.x + bend.x, t.r + p.y - length(bend) * 0.35 * aH, wp.y + p.z + bend.y);
          vH = aH; vHue = t.b; vShade = 0.85 + fract(r * 3.7) * 0.3;
          vec4 mvPosition = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <fog_pars_fragment>
        uniform vec3 uLight;
        varying float vH; varying float vHue; varying float vShade; varying vec4 vPaint;
        void main(){
          vec3 forest = vec3(0.22, 0.46, 0.18);
          vec3 meadow = vec3(0.45, 0.7, 0.24);
          vec3 golden = vec3(0.86, 0.66, 0.26);
          vec3 c = vHue < 0.3 ? mix(forest, meadow, vHue / 0.3) : mix(meadow, golden, (vHue - 0.3) / 0.7);
          c *= (0.5 + 0.7 * vH) * vShade;
          c += vec3(0.08, 0.1, 0.02) * smoothstep(0.7, 1.0, vH);
          c = mix(c, vPaint.rgb * (0.55 + 0.6 * vH), clamp(vPaint.a * 1.2, 0.0, 0.9));
          gl_FragColor = vec4(c * uLight, 1.0);
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  update(dt, env, pushers) {
    if (!this.mesh) return;
    const u = this.mesh.material.uniforms;
    u.uTime.value += dt;
    u.uCenter.value.copy(G.camera.position);
    if (G.paint) {
      u.uPaint.value = G.paint.maskTex;
      u.uPaintC.value.copy(G.paint.maskCenter);
      u.uPaintS.value = G.paint.maskSize;
    }
    for (let i = 0; i < 4; i++) {
      const p = pushers[i];
      if (p) u.uPush.value[i].copy(p); else u.uPush.value[i].set(0, -999, 0);
    }
    const sunUp = Math.max(0.2, env.lightDir ? env.lightDir.y : 1);
    u.uLight.value.copy(env.sun.color).multiplyScalar(env.sun.intensity * 0.32 * sunUp)
      .add(env.hemi.color.clone().multiplyScalar(env.hemi.intensity * 0.55));
    this.mesh.visible = !inDungeonY(G.camera.position.y);
  }
}

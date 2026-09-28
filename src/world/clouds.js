// Soft painted billboard clouds: drifting cumulus clusters plus a cloud sea around the Sky Citadel.
import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';
import { CITADEL } from './layout.js';

function cloudAtlas() {
  const S = 512, H = S / 2;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const rand = mulberry32(5);
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * H, oy = Math.floor(v / 2) * H;
    x.save();
    x.beginPath();
    x.rect(ox, oy, H, H);
    x.clip();
    const n = 18 + v * 4;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.pow(rand(), 0.7) * H * 0.26;
      const cx = ox + H / 2 + Math.cos(a) * d * 1.25;
      const cy = oy + H / 2 + Math.sin(a) * d * 0.7 - H * 0.03;
      const r = H * (0.1 + rand() * 0.14);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export class Clouds {
  constructor(scene) {
    const rand = mulberry32(99);
    const puffs = [];
    const cluster = (cx, cy, cz, w, n, size, alpha = 1) => {
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2, d = Math.sqrt(rand());
        const px = cx + Math.cos(a) * d * w;
        const pz = cz + Math.sin(a) * d * w * 0.6;
        const top = 1 - d;
        const py = cy + top * size * 0.6 * rand();
        const s = size * (0.6 + 0.6 * rand()) * (0.7 + top * 0.5);
        puffs.push([px, py, pz, s, Math.floor(rand() * 4), Math.min(1, 0.25 + (py - cy) / (size * 0.6)), alpha * (0.75 + rand() * 0.25)]);
      }
    };
    // Drifting cumulus
    for (let i = 0; i < 55; i++) {
      const a = rand() * Math.PI * 2, d = 120 + rand() * 1500;
      cluster(Math.cos(a) * d, 170 + rand() * 170, Math.sin(a) * d, 40 + rand() * 60, 9 + Math.floor(rand() * 10), 38 + rand() * 30);
    }
    // Cloud sea around the Sky Citadel - the floating islands poke out of it
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2, d = 120 + rand() * 200;
      cluster(CITADEL.x + Math.cos(a) * d, 100 + rand() * 30, CITADEL.z + Math.sin(a) * d, 40, 6, 36, 0.55);
    }
    // Low wisps over the lowlands
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2, d = 60 + rand() * 600;
      cluster(Math.cos(a) * d, 75 + rand() * 40, Math.sin(a) * d, 30, 4, 22, 0.35);
    }
    this.count = puffs.length;
    this.src = puffs;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(this.count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(this.count * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', this.aPos);
    geo.setAttribute('aData', this.aData);
    geo.instanceCount = this.count;
    this.order = puffs.map((_, i) => i);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: cloudAtlas() },
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uLit: { value: new THREE.Color(1, 1, 1) },
        uShade: { value: new THREE.Color(0.7, 0.75, 0.85) },
        uFog: { value: new THREE.Color(0.8, 0.85, 0.9) },
        uCam: { value: new THREE.Vector3() },
      },
      vertexShader: /* glsl */`
        attribute vec3 aPos; attribute vec4 aData; // size, variant, shade, alpha
        uniform float uTime; uniform vec3 uCam;
        varying vec2 vUv; varying float vShade; varying float vAlpha; varying vec3 vW; varying float vVar;
        void main(){
          vec3 c = aPos;
          c.x = mod(c.x + uTime * 2.5 + 2000.0, 4000.0) - 2000.0;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 w = c + (right * position.x + up * position.y * 0.7) * aData.x;
          vW = w;
          vUv = uv; vShade = aData.z; vVar = aData.y;
          float dist = distance(c, uCam);
          vAlpha = aData.w * smoothstep(aData.x * 0.4, aData.x * 1.6, dist) * (1.0 - smoothstep(2600.0, 3400.0, dist));
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex; uniform vec3 uSunDir, uLit, uShade, uFog, uCam;
        varying vec2 vUv; varying float vShade; varying float vAlpha; varying vec3 vW; varying float vVar;
        void main(){
          vec2 off = vec2(mod(vVar, 2.0), floor(vVar / 2.0)) * 0.5;
          float a = texture2D(uTex, off + vUv * 0.5).a * vAlpha;
          if (a < 0.01) discard;
          float h = clamp(vShade * 0.6 + vUv.y * 0.6, 0.0, 1.0);
          vec3 V = normalize(vW - uCam);
          float toward = pow(max(dot(V, uSunDir), 0.0), 4.0);
          vec3 col = mix(uShade, uLit, h) + uLit * toward * 0.35 * (1.0 - a);
          float fog = 1.0 - exp(-distance(vW, uCam) * 0.0005);
          col = mix(col, uFog, fog * 0.7);
          gl_FragColor = vec4(col, min(a * 1.3, 0.92));
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.sortTimer = 0;
    this._write(new THREE.Vector3());
  }

  _write(cam) {
    const t = this.mat.uniforms.uTime.value * 2.5;
    const dist = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const p = this.src[i];
      const x = ((p[0] + t + 2000) % 4000 + 4000) % 4000 - 2000;
      dist[i] = (x - cam.x) ** 2 + (p[1] - cam.y) ** 2 + (p[2] - cam.z) ** 2;
    }
    this.order.sort((a, b) => dist[b] - dist[a]); // far to near
    const P = this.aPos.array, D = this.aData.array;
    this.order.forEach((idx, i) => {
      const p = this.src[idx];
      P[i * 3] = p[0]; P[i * 3 + 1] = p[1]; P[i * 3 + 2] = p[2];
      D[i * 4] = p[3]; D[i * 4 + 1] = p[4]; D[i * 4 + 2] = p[5]; D[i * 4 + 3] = p[6];
    });
    this.aPos.needsUpdate = true;
    this.aData.needsUpdate = true;
  }

  update(dt, env, cam) {
    const u = this.mat.uniforms;
    u.uTime.value += dt;
    u.uCam.value.copy(cam);
    u.uSunDir.value.copy(env.sunDir);
    if (env.cur) {
      const night = env.night;
      u.uLit.value.copy(env.cur.sun).lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(1.05 - night * 0.6);
      u.uShade.value.copy(env.cur.hemiS).lerp(env.cur.fog, 0.4).multiplyScalar(0.82 - night * 0.35);
      u.uFog.value.copy(env.cur.fog);
    }
    this.sortTimer -= dt;
    if (this.sortTimer <= 0) {
      this.sortTimer = 0.3;
      this._write(cam);
    }
    this.mesh.visible = !env.dungeon;
  }
}

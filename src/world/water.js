// Stylised ocean: rolling swells on a camera-centred grid (dense near the viewer), depth tint from the
// terrain height texture, sky reflection, sun glitter, shallow-water caustics, shore foam and
// expanding ripple rings from splashes, swimmers and rain.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

const MAX_RIPPLES = 16;

// Square grid whose spacing grows with distance from the centre: fine swells up close, few vertices far out
function warpedGrid(size, segs) {
  const g = new THREE.PlaneGeometry(2, 2, segs, segs);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const warp = (u) => Math.sign(u) * (0.08 * Math.abs(u) + 0.92 * u * u) * size * 0.5;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, warp(p.getX(i)), 0, warp(p.getZ(i)));
  g.computeBoundingSphere();
  return g;
}

export class Water {
  constructor(scene, terrain) {
    this.ripples = [];
    this.ripData = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0));
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uHeight: { value: terrain.heightTex },
        uSize: { value: terrain.size },
        uTexN: { value: terrain.n },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color(1, 1, 1) },
        uSky: { value: new THREE.Color(0.7, 0.85, 1) },
        uSkyTop: { value: new THREE.Color(0.3, 0.55, 0.9) },
        uLight: { value: 1 },
        uWave: { value: 1 },
        uRain: { value: 0 },
        uRip: { value: this.ripData },
      },
    ]);
    uniforms.uHeight.value = terrain.heightTex;
    uniforms.uRip.value = this.ripData;
    const common = /* glsl */`
      uniform float uTime, uSize, uTexN, uWave;
      uniform sampler2D uHeight;
      float groundAt(vec2 xz){
        vec2 uv = (xz + uSize * 0.5) / uSize;
        if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return -60.0;
        return texture2D(uHeight, uv * (uTexN - 1.0) / uTexN + 0.5 / uTexN).r;
      }
      // Three directional swells; returns height and slope (dh/dx, dh/dz)
      vec3 swell(vec2 p, float amp){
        vec3 r = vec3(0.0);
        vec3 W[3];
        W[0] = vec3(normalize(vec2(0.8, 0.6)), 0.19);
        W[1] = vec3(normalize(vec2(-0.5, 0.85)), 0.31);
        W[2] = vec3(normalize(vec2(0.95, -0.3)), 0.53);
        float A[3]; A[0] = 0.32; A[1] = 0.16; A[2] = 0.07;
        float S[3]; S[0] = 0.9; S[1] = 1.3; S[2] = 1.9;
        for (int i = 0; i < 3; i++) {
          float k = W[i].z;
          float ph = dot(W[i].xy, p) * k + uTime * S[i];
          float a = A[i] * amp;
          r.x += a * sin(ph);
          r.yz += a * k * cos(ph) * W[i].xy;
        }
        return r;
      }`;
    this.mat = new THREE.ShaderMaterial({
      uniforms,
      fog: true,
      transparent: true,
      depthWrite: true, // so the post haze sees the sea surface
      vertexShader: /* glsl */`
        #include <fog_pars_vertex>
        ${common}
        varying vec3 vW;
        varying float vDepth;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          float ground = groundAt(w.xz);
          float depth = max(-ground, 0.0);
          // Swells fade out towards the shore so beaches stay clean
          float amp = smoothstep(0.5, 9.0, depth) * uWave;
          w.y += swell(w.xz, amp).x;
          vW = w.xyz;
          vDepth = depth;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <fog_pars_fragment>
        ${common}
        uniform float uLight, uRain;
        uniform vec3 uSunDir, uSunCol, uSky, uSkyTop;
        uniform vec4 uRip[${MAX_RIPPLES}];
        varying vec3 vW;
        varying float vDepth;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 43758.5); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hh(i),hh(i+vec2(1,0)),f.x), mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x), f.y); }
        // Thin bright contour lines of drifting noise read as caustic light on the sea floor
        float caustic(vec2 p){
          float a = vn(p * 0.55 + vec2(uTime * 0.23, uTime * 0.11));
          float b = vn(p * 0.8 - vec2(uTime * 0.17, -uTime * 0.2) + 3.1);
          float c = abs(a + b - 1.0);
          return pow(1.0 - smoothstep(0.0, 0.09, c), 2.0);
        }
        void main(){
          float ground = groundAt(vW.xz);
          float depth = max(-ground, 0.0);
          vec3 shallow = vec3(0.24, 0.78, 0.76);
          vec3 deep = vec3(0.04, 0.22, 0.46);
          vec3 col = mix(shallow, deep, smoothstep(0.0, 22.0, depth));
          // Surface normal: swells + small drifting ripples
          float amp = smoothstep(0.5, 9.0, depth) * uWave;
          vec3 sw = swell(vW.xz, amp);
          vec2 p = vW.xz * 0.08;
          float r1 = vn(p + vec2(uTime * 0.15, uTime * 0.1));
          float r2 = vn(p * 2.3 - vec2(uTime * 0.2, -uTime * 0.07));
          float rip = r1 * 0.6 + r2 * 0.4;
          vec2 slope = sw.yz + vec2(r1 - 0.5, r2 - 0.5) * 0.35;
          // Ripple rings (splashes, swimmers)
          float ringFoam = 0.0;
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec4 r = uRip[i];
            float age = uTime - r.z;
            if (age < 0.0 || age > 2.2) continue;
            vec2 d = vW.xz - r.xy;
            float dist = length(d);
            float rad = 0.4 + age * 3.2;
            float x = (dist - rad) * 2.4;
            float fade = r.w * (1.0 - age / 2.2);
            float ring = exp(-x * x) * fade;
            ringFoam += ring * 0.55;
            slope += (d / max(dist, 0.01)) * (-2.0 * x * exp(-x * x)) * fade * 0.25;
          }
          // Rain pocks the surface with tiny rings
          if (uRain > 0.01) {
            vec2 cell = floor(vW.xz / 1.6);
            vec2 f = fract(vW.xz / 1.6) - 0.5;
            float rnd = hh(cell);
            float t = fract(uTime * 0.9 + rnd);
            vec2 c0 = vec2(hh(cell + 3.7), hh(cell + 9.1)) * 0.5 - 0.25;
            float dist = length(f - c0);
            float x = (dist - t * 0.45) * 30.0;
            ringFoam += exp(-x * x) * (1.0 - t) * uRain * step(0.35, rnd) * 0.7;
          }
          vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
          // Caustics shimmer where the floor is visible
          float cz = caustic(vW.xz + n.xz * 2.0) * (1.0 - smoothstep(0.3, 7.0, depth)) * smoothstep(0.05, 0.5, depth);
          col += vec3(0.75, 1.0, 0.95) * cz * 0.3 * uLight;
          col += smoothstep(0.72, 0.8, rip) * 0.12;
          // Crest foam on the bigger swells
          col = mix(col, vec3(0.92, 0.97, 1.0), smoothstep(0.24, 0.42, sw.x) * 0.35 * min(uWave, 1.5));
          // Shore foam bands
          float foamBand = sin(depth * 2.2 - uTime * 1.6 + rip * 4.0);
          float foam = smoothstep(1.4, 0.0, depth) * smoothstep(0.6, 0.95, foamBand) * 0.8 + (1.0 - smoothstep(0.0, 0.35, depth)) * 0.9;
          foam = clamp(foam + ringFoam, 0.0, 1.0);
          // Sky reflection with a horizon-to-zenith gradient and soft cloud streaks
          vec3 V = normalize(cameraPosition - vW);
          vec3 R = reflect(-V, n);
          vec3 sky = mix(uSky, uSkyTop, 0.35 + 0.65 * smoothstep(-0.05, 0.35, R.y));
          vec2 cuv = R.xz / max(R.y, 0.08) * 0.6 + uTime * 0.01;
          sky = mix(sky, uSky * 1.25 + 0.1, smoothstep(0.55, 0.85, vn(cuv) * 0.7 + vn(cuv * 2.7) * 0.3) * 0.35 * smoothstep(0.02, 0.3, R.y));
          float fres = 0.08 + 0.92 * pow(1.0 - max(dot(V, n), 0.0), 5.0);
          col = mix(col, sky * uLight, fres * 0.55);
          // Sun glitter: a tight highlight plus sparkling facets
          vec3 H = normalize(V + uSunDir);
          float nh = max(dot(n, H), 0.0);
          float spark = step(0.93, hh(floor(vW.xz * 3.0) + floor(uTime * 6.0)));
          col += uSunCol * (pow(nh, 260.0) * 1.5 + pow(nh, 60.0) * spark * 0.6);
          col = mix(col, vec3(0.97, 0.99, 1.0) * max(uLight, 0.35), foam);
          col *= mix(1.0, uLight, 0.8);
          float alpha = mix(0.5, 0.93, smoothstep(0.0, 6.0, depth));
          alpha = max(alpha, foam);
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(warpedGrid(8000, 240), this.mat);
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.wakeT = 0;
  }

  // Expanding ring on the surface
  ripple(x, z, strength = 1) {
    const r = this.ripData[this.ripples.length % MAX_RIPPLES];
    this.ripples.push(1);
    if (this.ripples.length > 1000) this.ripples.length = 0;
    r.set(x, z, this.mat.uniforms.uTime.value, strength);
  }

  update(dt, env) {
    const u = this.mat.uniforms;
    u.uTime.value += dt;
    u.uSunDir.value.copy(env.lightDir || env.sunDir);
    u.uSunCol.value.copy(env.cur.sun).multiplyScalar(1 - env.night * 0.7);
    u.uSky.value.copy(env.cur.hor);
    u.uSkyTop.value.copy(env.cur.top);
    u.uLight.value = 1 - env.night * 0.55;
    const wx = G.weather ? G.weather.w : 0;
    u.uWave.value = 1 + wx * 1.2;
    u.uRain.value = G.weather && G.weather.rain.visible ? Math.max(0, wx - 0.4) * 1.6 : 0;
    // Snap to a coarse grid so the fine centre follows the camera without visible swimming
    this.mesh.position.x = Math.round(G.camera.position.x / 4) * 4;
    this.mesh.position.z = Math.round(G.camera.position.z / 4) * 4;
    this.mesh.visible = G.camera.position.y > -200;
    // Wakes behind swimmers
    const p = G.player;
    if (p && p.state === 'swim') {
      const hv = Math.hypot(p.vel.x, p.vel.z);
      this.wakeT -= dt * (hv > 0.5 ? 1 : 0.25);
      if (this.wakeT <= 0) { this.wakeT = 0.32; this.ripple(p.pos.x, p.pos.z, hv > 0.5 ? 0.6 : 0.35); }
    }
  }

  // How far the camera is under the surface (for the underwater grade)
  underwater() {
    const c = G.camera.position;
    if (c.y > -0.15 || c.y < -150) return 0;
    const w = G.collision.waterAt(c.x, c.y, c.z);
    return w && c.y < w.level - 0.15 ? 1 : 0;
  }
}

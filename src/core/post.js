// Post-processing: atmospheric height haze with sun in-scattering, bloom, painterly colour grade,
// vignette, speed lines while flying and the Flurry Rush tint. Renders HDR into a half-float target.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { G } from './ctx.js';

const VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    const w = 2, h = 2;
    this.depthTex = new THREE.DepthTexture(w, h);
    this.depthTex.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthTexture: this.depthTex });
    this.hazeRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });

    this.hazeMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.sceneRT.texture },
        tDepth: { value: this.depthTex },
        uProjInv: { value: new THREE.Matrix4() },
        uViewInv: { value: new THREE.Matrix4() },
        uCam: { value: new THREE.Vector3() },
        uFog: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color() },
        uDensity: { value: 0.0009 },
        uHeightDensity: { value: 0.02 },
        uFalloff: { value: 0.018 },
        uBase: { value: 0 },
        uMaxFog: { value: 0.92 },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor, tDepth;
        uniform mat4 uProjInv, uViewInv;
        uniform vec3 uCam, uFog, uSunDir, uSunCol;
        uniform float uDensity, uHeightDensity, uFalloff, uBase, uMaxFog;
        varying vec2 vUv;
        void main(){
          vec4 col = texture2D(tColor, vUv);
          float d = texture2D(tDepth, vUv).x;
          if (d >= 0.99999) { gl_FragColor = col; return; }
          vec4 ndc = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 vp = uProjInv * ndc; vp /= vp.w;
          vec3 wp = (uViewInv * vp).xyz;
          vec3 rd = wp - uCam;
          float dist = length(rd);
          rd /= dist;
          // Exponential distance haze
          float fogD = 1.0 - exp(-dist * uDensity);
          // Analytic height fog (denser in the valleys, thin up high)
          float k = uFalloff;
          float h0 = max(uCam.y - uBase, -50.0);
          float dy = rd.y * dist;
          float integ = abs(dy) > 0.01 ? (exp(-k * h0) - exp(-k * (h0 + dy))) / (k * rd.y) : dist * exp(-k * h0);
          float fogH = 1.0 - exp(-uHeightDensity * max(integ, 0.0));
          float fog = clamp(1.0 - (1.0 - fogD) * (1.0 - fogH), 0.0, uMaxFog);
          float sun = pow(max(dot(rd, uSunDir), 0.0), 6.0);
          vec3 fogCol = mix(uFog, uSunCol, sun * 0.55);
          gl_FragColor = vec4(mix(col.rgb, fogCol, fog), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.hazeQuad = new FullScreenQuad(this.hazeMat);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.55, 0.9);

    this.gradeMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.hazeRT.texture },
        uTime: { value: 0 },
        uSpeed: { value: 0 },
        uFlurry: { value: 0 },
        uHurt: { value: 0 },
        uAspect: { value: 1 },
        uSat: { value: 1.12 },
        uFilter: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor;
        uniform float uTime, uSpeed, uFlurry, uHurt, uAspect, uSat;
        uniform int uFilter;
        varying vec2 vUv;
        float hh(float n){ return fract(sin(n) * 43758.5453); }
        float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec3 c = texture2D(tColor, vUv).rgb;
          // Painterly grade: gentle warm highlights, cool shadows, a little extra saturation
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, uSat);
          c += vec3(0.012, 0.0, -0.01) * smoothstep(0.3, 1.0, l);
          c += vec3(-0.004, 0.002, 0.014) * (1.0 - smoothstep(0.0, 0.35, l));
          // Flurry Rush: desaturate & tint blue
          if (uFlurry > 0.0) {
            float g = dot(c, vec3(0.299, 0.587, 0.114));
            c = mix(c, vec3(g * 0.75, g * 0.9, g * 1.25), uFlurry * 0.7);
          }
          // Photo mode filters
          if (uFilter == 1) { c = mix(vec3(dot(c, vec3(0.299,0.587,0.114))), c, 1.45); c = (c - 0.5) * 1.12 + 0.5; }
          else if (uFilter == 2) { c *= vec3(1.12, 1.0, 0.82); c += vec3(0.04, 0.02, 0.0); }
          else if (uFilter == 3) { float g = dot(c, vec3(0.299,0.587,0.114)); g = (g - 0.5) * 1.35 + 0.5; c = vec3(g); }
          else if (uFilter == 4) { c = floor(c * 6.0 + 0.5) / 6.0; c = mix(vec3(dot(c, vec3(0.3,0.59,0.11))), c, 1.2); }
          else if (uFilter == 5) { c = mix(c, vec3(1.0, 0.95, 1.0), 0.12); c = mix(vec3(dot(c, vec3(0.3,0.59,0.11))), c, 0.8); }
          vec2 p = vUv - 0.5;
          p.x *= uAspect;
          float r = length(p);
          // Speed lines
          if (uSpeed > 0.01) {
            float a = atan(p.y, p.x);
            float seg = floor(a * 38.0);
            float rnd = hh(seg * 7.13 + floor(uTime * 14.0));
            float line = step(0.72, rnd) * smoothstep(0.3, 0.75, r) * (1.0 - fract(a * 38.0) * 1.6);
            c = mix(c, vec3(1.0), clamp(line, 0.0, 1.0) * uSpeed * 0.55);
          }
          // Vignette + hurt pulse
          float vig = smoothstep(0.95, 0.35, r);
          c *= mix(0.72, 1.0, vig);
          c = mix(c, vec3(0.6, 0.02, 0.05), uHurt * (1.0 - vig) * 0.8);
          // Paper grain
          c += (hash2(vUv * 850.0 + fract(uTime)) - 0.5) * 0.018;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.gradeQuad = new FullScreenQuad(this.gradeMat);
    this.enabled = true;
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.sceneRT.setSize(W, H);
    this.hazeRT.setSize(W, H);
    this.bloom.setSize(W, H);
    this.gradeMat.uniforms.uAspect.value = w / h;
  }

  render(scene, camera, env, fx) {
    const r = this.renderer;
    // Haze parameters follow the time of day; trials get a close dark fog
    const hz = this.hazeMat.uniforms;
    hz.uProjInv.value.copy(camera.projectionMatrixInverse);
    hz.uViewInv.value.copy(camera.matrixWorld);
    hz.uCam.value.copy(camera.position);
    if (env.cur) {
      hz.uFog.value.copy(env.cur.fog);
      hz.uSunCol.value.copy(env.cur.sun).multiplyScalar(1 - env.night * 0.8);
    }
    hz.uSunDir.value.copy(env.sunDir);
    if (env.dungeon) {
      hz.uDensity.value = 0.012; hz.uHeightDensity.value = 0; hz.uMaxFog.value = 0.85;
    } else {
      const w = G.weather ? G.weather.w : 0;
      hz.uDensity.value = 0.00038 + w * 0.0016; hz.uHeightDensity.value = 0.0013 + w * 0.002; hz.uFalloff.value = 0.02; hz.uBase.value = 0; hz.uMaxFog.value = 0.9 + w * 0.06;
    }
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);
    G.stats = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    r.setRenderTarget(this.hazeRT);
    this.hazeQuad.render(r);
    this.bloom.render(r, null, this.hazeRT, 0, false);
    const g = this.gradeMat.uniforms;
    g.uTime.value = G.time;
    g.uSpeed.value = fx.speed || 0;
    g.uFlurry.value = fx.flurry || 0;
    g.uHurt.value = fx.hurt || 0;
    g.uSat.value = fx.sat ?? 1.12;
    g.uFilter.value = G.photo && G.photo.active ? G.photo.filter : 0;
    r.setRenderTarget(null);
    this.gradeQuad.render(r);
  }
}

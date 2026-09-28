// Sky dome, day/night cycle, sun/moon lighting, fog and drifting clouds.
import * as THREE from 'three';
import { G, inDungeonY } from '../core/ctx.js';
import { smoothstep } from '../core/math.js';
import { Clouds } from './clouds.js';

const DAY_LENGTH = 720; // seconds for a full cycle

// Palettes lean on soft aerial perspective: pale hazy horizons, cool shadows, warm light.
const KEYS = {
  night: { top: 0x0d1a3d, hor: 0x33507e, fog: 0x2e4670, sun: 0xa8bcff, sunI: 0.9, hemiS: 0x6a82c8, hemiG: 0x2e3660, hemiI: 1.35 },
  dusk: { top: 0x5a6fa8, hor: 0xf0b894, fog: 0xd9ad9c, sun: 0xffb27a, sunI: 2.0, hemiS: 0xb8b0e0, hemiG: 0x806058, hemiI: 1.25 },
  day: { top: 0x4c8fd6, hor: 0xd4e8f0, fog: 0xb4cddb, sun: 0xfff1da, sunI: 2.5, hemiS: 0xa8c8f0, hemiG: 0x6a6a48, hemiI: 1.05 },
  dungeon: { top: 0x10131c, hor: 0x1a1e2a, fog: 0x161a26, sun: 0xfff0e0, sunI: 0.5, hemiS: 0xb8bcd8, hemiG: 0x4a4050, hemiI: 1.6 },
};

function mixKey(a, b, t) {
  const o = {};
  for (const k in a) {
    if (typeof a[k] === 'number' && k.endsWith('I')) o[k] = a[k] + (b[k] - a[k]) * t;
    else o[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
  }
  return o;
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.dayT = 0.33;
    this.sunDir = new THREE.Vector3();

    const skyGeo = new THREE.SphereGeometry(4000, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color() },
        uNight: { value: 0 },
        uDungeon: { value: 0 },
        uFogC: { value: new THREE.Color() },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uHor, uSunDir, uSunCol, uFogC;
        uniform float uNight, uDungeon;
        varying vec3 vDir;
        float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float e = max(d.y, 0.0);
          vec3 col = mix(uHor, uTop, pow(e, 0.45));
          col = mix(col, uHor * 0.92, smoothstep(0.0, -0.25, d.y));
          col = mix(col, uFogC, smoothstep(0.1, 0.0, abs(d.y)) * 0.85); // meet the terrain haze at the horizon
          float sd = max(dot(d, uSunDir), 0.0);
          // Wide warm glow around the sun that bleeds into the horizon haze
          col = mix(col, uSunCol, pow(sd, 5.0) * 0.35 * (1.0 - uNight) * (1.0 - e * 0.6));
          col += uSunCol * (smoothstep(0.9985, 0.9993, sd) * 2.5 + pow(sd, 60.0) * 0.4) * (1.0 - uNight);
          // Faint high streaky cirrus
          float ci = sin(d.x * 9.0 + d.z * 3.0) * sin(d.z * 14.0 - d.x * 5.0);
          col += vec3(0.06) * smoothstep(0.55, 1.0, ci) * smoothstep(0.05, 0.4, d.y) * (1.0 - uNight);
          // Moon
          float md = max(dot(d, -uSunDir), 0.0);
          col += vec3(0.9,0.95,1.0) * (smoothstep(0.9993, 0.9996, md) * 1.2 + pow(md, 40.0) * 0.15) * uNight;
          // Stars
          vec3 q = floor(d * 380.0);
          float s = h(q);
          float tw = step(0.9975, s) * smoothstep(0.0, 0.25, d.y);
          col += vec3(tw) * uNight * (0.6 + 0.4 * h(q + 3.1));
          col = mix(col, vec3(0.06,0.07,0.1), uDungeon);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -70; s.right = 70; s.top = 70; s.bottom = -70; s.near = 1; s.far = 400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x5a6a3a, 1);
    scene.add(this.hemi);

    this.fog = new THREE.Fog(0xbfdff0, 200, 1300);
    this.clouds = new Clouds(scene);
    this.cur = null;
  }

  setTime(t) { this.dayT = ((t % 1) + 1) % 1; }

  update(dt, focus) {
    this.dayT = (this.dayT + dt / DAY_LENGTH) % 1;
    const th = (this.dayT - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(th), Math.sin(th), -0.35).normalize();
    const e = this.sunDir.y;
    const dungeon = inDungeonY(focus.y);
    this.dungeon = dungeon;
    // Only draw the half of the world the camera is in
    if (G.trials) G.trials.root.visible = dungeon;
    if (G.world) G.world.root.visible = G.terrain.mesh.visible = !dungeon;

    let k;
    if (e < -0.12) k = mixKey(KEYS.night, KEYS.night, 0);
    else if (e < 0.1) k = mixKey(KEYS.night, KEYS.dusk, smoothstep(-0.12, 0.1, e));
    else k = mixKey(KEYS.dusk, KEYS.day, smoothstep(0.1, 0.4, e));
    if (dungeon) k = mixKey(KEYS.dungeon, KEYS.dungeon, 0);
    this.cur = k;
    const night = dungeon ? 0 : 1 - smoothstep(-0.2, 0.05, e);
    this.night = night;

    this.skyMat.uniforms.uTop.value.copy(k.top);
    this.skyMat.uniforms.uHor.value.copy(k.hor);
    this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.skyMat.uniforms.uSunCol.value.copy(k.sun);
    this.skyMat.uniforms.uNight.value = night;
    this.skyMat.uniforms.uDungeon.value = dungeon ? 1 : 0;
    this.skyMat.uniforms.uFogC.value.copy(k.fog);
    this.sky.position.copy(G.camera.position);

    // Light comes from the moon at night
    const lightDir = e > -0.05 || dungeon ? this.sunDir.clone() : this.sunDir.clone().negate();
    if (lightDir.y < 0.15) lightDir.y = 0.15;
    if (dungeon) lightDir.set(0.3, 1, 0.2);
    lightDir.normalize();
    this.lightDir = lightDir;
    this.sun.color.copy(k.sun);
    const horizonFade = dungeon ? 1 : smoothstep(-0.12, 0.02, Math.abs(e) - 0.02) * 0.7 + 0.3;
    this.sun.intensity = k.sunI * horizonFade;
    this.sun.position.copy(focus).addScaledVector(lightDir, 200);
    this.sun.target.position.copy(focus);
    this.sun.castShadow = G.settings.shadows;

    this.hemi.color.copy(k.hemiS);
    this.hemi.groundColor.copy(k.hemiG);
    this.hemi.intensity = k.hemiI;

    // Built-in fog is only used when post-processing (which draws the haze) is off
    this.scene.fog = G.post && G.post.enabled ? null : this.fog;
    this.fog.color.copy(k.fog);
    this.fog.near = dungeon ? 30 : 220;
    this.fog.far = dungeon ? 160 : 1400;
    G.renderer.setClearColor(k.fog);
    this.clouds.update(dt, this, G.camera.position);
  }
}

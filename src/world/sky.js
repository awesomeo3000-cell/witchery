// Sky dome, day/night cycle, sun/moon lighting, fog and drifting clouds.
import * as THREE from 'three';
import { G, inDungeonY } from '../core/ctx.js';
import { smoothstep, mulberry32 } from '../core/math.js';

const DAY_LENGTH = 720; // seconds for a full cycle

const KEYS = {
  night: { top: 0x0a1233, hor: 0x24386a, fog: 0x1d2c55, sun: 0x9fb4ff, sunI: 0.75, hemiS: 0x4a5c9a, hemiG: 0x1a2038, hemiI: 0.9 },
  dusk: { top: 0x3b5a9a, hor: 0xf2a36e, fog: 0xd8a383, sun: 0xffa86a, sunI: 1.6, hemiS: 0x9ab0e0, hemiG: 0x6a4a3a, hemiI: 0.85 },
  day: { top: 0x3b8de0, hor: 0xc4e6f7, fog: 0xbfdff0, sun: 0xfff2dc, sunI: 2.4, hemiS: 0xbfe0ff, hemiG: 0x5a6a3a, hemiI: 1.0 },
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
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uHor, uSunDir, uSunCol;
        uniform float uNight, uDungeon;
        varying vec3 vDir;
        float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float e = max(d.y, 0.0);
          vec3 col = mix(uHor, uTop, pow(e, 0.55));
          col = mix(col, uHor * 0.8, smoothstep(0.0, -0.3, d.y));
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 12.0) * 0.35) * (1.0 - uNight);
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

    scene.fog = new THREE.Fog(0xbfdff0, 200, 1300);
    this._buildClouds();
    this.cur = null;
  }

  _buildClouds() {
    const rand = mulberry32(99);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa8c0, emissiveIntensity: 0.45 });
    const puffs = [];
    this.cloudList = [];
    for (let i = 0; i < 38; i++) {
      const a = rand() * Math.PI * 2, d = 150 + rand() * 1100;
      const c = { x: Math.cos(a) * d, y: 150 + rand() * 140, z: Math.sin(a) * d, speed: 1 + rand() * 2, first: puffs.length };
      const n = 4 + Math.floor(rand() * 5);
      for (let k = 0; k < n; k++) {
        const r = 10 + rand() * 16;
        puffs.push({ cloud: c, ox: (k - n / 2) * 13 + rand() * 6, oy: rand() * 6, oz: rand() * 14 - 7, sx: r * 1.3, sy: r * 0.7, sz: r });
      }
      this.cloudList.push(c);
    }
    this.puffs = puffs;
    this.clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), mat, puffs.length);
    this.clouds.frustumCulled = false;
    this._placeClouds();
    this.scene.add(this.clouds);
  }

  _placeClouds() {
    const m4 = new THREE.Matrix4();
    this.puffs.forEach((p, i) => {
      m4.makeScale(p.sx, p.sy, p.sz).setPosition(p.cloud.x + p.ox, p.cloud.y + p.oy, p.cloud.z + p.oz);
      this.clouds.setMatrixAt(i, m4);
    });
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  setTime(t) { this.dayT = ((t % 1) + 1) % 1; }

  update(dt, focus) {
    this.dayT = (this.dayT + dt / DAY_LENGTH) % 1;
    const th = (this.dayT - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(th), Math.sin(th), -0.35).normalize();
    const e = this.sunDir.y;
    const dungeon = inDungeonY(focus.y);

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

    this.scene.fog.color.copy(k.fog);
    this.scene.fog.near = dungeon ? 30 : 220;
    this.scene.fog.far = dungeon ? 160 : 1400;
    G.renderer.setClearColor(k.fog);

    this.clouds.visible = !dungeon;
    for (const c of this.cloudList) {
      c.x += c.speed * dt;
      if (c.x > 1400) c.x = -1400;
    }
    this._placeClouds();
  }
}

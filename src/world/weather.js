// Weather: clear / cloudy / rain / storm cycles (host-decided and synced), rain or snow around the
// camera, darker skies, wet ground, lightning with thunder, and rain dousing fire paint.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { damp, smoothstep } from '../core/math.js';

export const WEATHER = ['clear', 'cloudy', 'rain', 'storm'];
const TARGET = { clear: 0, cloudy: 0.35, rain: 0.8, storm: 1 };

function precipMaterial(snow) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uAmount: { value: 0 }, uColor: { value: new THREE.Color(0.8, 0.85, 0.95) } },
    vertexShader: /* glsl */`
      attribute vec4 aSeed; // xyz random, w = 0 top / 1 bottom of the streak
      uniform vec3 uCam; uniform float uTime, uAmount;
      varying float vA;
      void main(){
        const vec3 box = vec3(60.0, 36.0, 60.0);
        float speed = ${snow ? '3.0' : '26.0'};
        vec3 p;
        p.x = uCam.x + (fract(aSeed.x - uCam.x / box.x) - 0.5) * box.x;
        p.z = uCam.z + (fract(aSeed.z - uCam.z / box.z) - 0.5) * box.z;
        p.y = uCam.y + (fract(aSeed.y - uTime * speed / box.y) - 0.5) * box.y;
        ${snow ? 'p.x += sin(uTime * 1.3 + aSeed.x * 40.0) * 0.8; p.z += cos(uTime * 1.1 + aSeed.z * 40.0) * 0.8;' : 'p.x += aSeed.w * 0.35; p.y -= aSeed.w * 1.1;'}
        vA = step(aSeed.x * 0.999, uAmount) * (1.0 - smoothstep(12.0, 30.0, distance(p, uCam)));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = ${snow ? '3.5 * 30.0 / max(1.0, -mv.z)' : '1.0'};
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; varying float vA;
      void main(){
        if (vA < 0.01) discard;
        ${snow ? 'float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; float soft = 1.0 - smoothstep(0.2, 0.5, r);' : 'float soft = 1.0;'}
        gl_FragColor = vec4(uColor, vA * soft * ${snow ? '0.9' : '0.35'});
      }`,
  });
}

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.state = 'clear';
    this.w = 0; // smoothed intensity 0..1
    this.timer = 180 + Math.random() * 180;
    this.lightning = 0;
    this.nextBolt = 5;
    const N = 5000;
    const rain = new Float32Array(N * 2 * 4);
    for (let i = 0; i < N; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      rain.set([x, y, z, 0, x, y, z, 1], i * 8);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('aSeed', new THREE.BufferAttribute(rain, 4));
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    this.rainMat = precipMaterial(false);
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 6;
    scene.add(this.rain);
    const M = 3000;
    const snow = new Float32Array(M * 4);
    for (let i = 0; i < M; i++) snow.set([Math.random(), Math.random(), Math.random(), 0], i * 4);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('aSeed', new THREE.BufferAttribute(snow, 4));
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
    this.snowMat = precipMaterial(true);
    this.snowMat.uniforms.uColor.value.set(1, 1, 1);
    this.snow = new THREE.Points(sg, this.snowMat);
    this.snow.frustumCulled = false;
    this.snow.renderOrder = 6;
    scene.add(this.snow);
  }

  get raining() { return this.w > 0.55; }

  // Host rolls the next weather every few minutes; everyone else follows the snapshot.
  _roll() {
    const r = Math.random();
    this.state = r < 0.45 ? 'clear' : r < 0.7 ? 'cloudy' : r < 0.9 ? 'rain' : 'storm';
    this.timer = 150 + Math.random() * 200;
  }

  sync(state) { if (WEATHER[state]) this.state = WEATHER[state]; }
  code() { return WEATHER.indexOf(this.state); }

  set(state) { this.state = state; this.timer = 240; }

  update(dt, env) {
    if (!G.net || G.net.isHost) {
      this.timer -= dt;
      if (this.timer <= 0) this._roll();
    }
    this.w = damp(this.w, TARGET[this.state], 0.25, dt);
    const cam = G.camera.position;
    const p = G.player;
    const frost = p && G.terrain ? G.terrain.biome(p.pos.x, p.pos.z).frost : 0;
    const snowy = frost > 0.5 || (p && p.pos.y > 120);
    const precip = smoothstep(0.45, 0.8, this.w) * (env.dungeon ? 0 : 1);
    this.rainMat.uniforms.uCam.value.copy(cam);
    this.snowMat.uniforms.uCam.value.copy(cam);
    this.rainMat.uniforms.uTime.value += dt;
    this.snowMat.uniforms.uTime.value += dt;
    this.rainMat.uniforms.uAmount.value = snowy ? 0 : precip;
    this.snowMat.uniforms.uAmount.value = snowy ? precip : 0;
    this.rain.visible = !snowy && precip > 0.01;
    this.snow.visible = snowy && precip > 0.01;
    this.rainMat.uniforms.uColor.value.copy(env.cur ? env.cur.fog : new THREE.Color(0.8, 0.8, 0.9)).lerp(new THREE.Color(1, 1, 1), 0.4);

    // Storm lightning
    this.lightning = Math.max(0, this.lightning - dt * 3);
    if (this.state === 'storm' && this.w > 0.8 && !env.dungeon) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 6 + Math.random() * 12;
        this.lightning = 1;
        G.hud.flash('rgba(230,235,255,0.45)');
        setTimeout(() => G.audio.play('thunder'), 400 + Math.random() * 1600);
      }
    }
    // Rain puts out fire paint faster
    if (this.raining && !snowy && G.paint) {
      for (const s of G.paint.splats) if (s.element === 'fire' && !s.vertical) s.life -= dt * 1.5;
    }
    G.audio.setRain && G.audio.setRain(env.dungeon ? 0 : precip * (snowy ? 0.2 : 1));
  }

  // Applied by the sky: greys out the palette and dims the sun
  tint(k) {
    const w = this.w;
    if (w <= 0.001) return k;
    const grey = new THREE.Color(0.55, 0.58, 0.62);
    const out = { ...k };
    out.top = k.top.clone().lerp(grey.clone().multiplyScalar(0.8), w * 0.75);
    out.hor = k.hor.clone().lerp(grey, w * 0.7);
    out.fog = k.fog.clone().lerp(grey, w * 0.75);
    out.sun = k.sun.clone().lerp(new THREE.Color(0.8, 0.82, 0.88), w * 0.6);
    out.sunI = k.sunI * (1 - w * 0.65);
    out.hemiS = k.hemiS.clone().lerp(grey, w * 0.5);
    out.hemiI = k.hemiI * (1 - w * 0.15) + this.lightning * 1.5;
    return out;
  }
}

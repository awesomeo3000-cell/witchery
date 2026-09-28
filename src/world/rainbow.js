// Rainbows: when rain clears during the day, a soft rainbow arcs across the sky opposite the sun
// for a minute or two.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

const INNER = 290, OUTER = 330;

export class Rainbow {
  constructor(scene) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying float vT;
        void main(){
          vT = (length(position.xy) - ${INNER.toFixed(1)}) / ${(OUTER - INNER).toFixed(1)};
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uAlpha;
        varying float vT;
        vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){
          // Violet inside, red outside, soft at both edges
          vec3 c = hue(0.78 * (1.0 - vT));
          float edge = smoothstep(0.0, 0.18, vT) * smoothstep(1.0, 0.82, vT);
          gl_FragColor = vec4(c * 0.9, edge * uAlpha);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(INNER, OUTER, 96, 1, 0, Math.PI), this.mat);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.t = 0; // seconds of rainbow left
    this.wasRaining = false;
    this.a = 0;
  }

  show(seconds = 100) { this.t = seconds; }

  update(dt) {
    const w = G.weather, sky = G.sky, p = G.player;
    if (!w || !sky || !p) return;
    const raining = w.rain.visible && w.w > 0.5;
    if (this.wasRaining && !raining && w.w < 0.45 && sky.night < 0.2 && sky.sunDir.y > 0.05) this.show();
    this.wasRaining = raining || (this.wasRaining && w.w > 0.45);
    this.t = Math.max(0, this.t - dt);
    const target = this.t > 0 && !p.inDungeon && sky.night < 0.3 && w.w < 0.5 ? Math.min(1, this.t / 10) : 0;
    this.a += (target - this.a) * Math.min(1, dt * 0.5);
    this.mat.uniforms.uAlpha.value = this.a * 0.42;
    this.mesh.visible = this.a > 0.01;
    if (!this.mesh.visible) return;
    // Stand the arc up on the horizon, opposite the sun, centred on the viewer
    const anti = new THREE.Vector3(-sky.sunDir.x, 0, -sky.sunDir.z).normalize();
    const cam = G.camera.position;
    this.mesh.position.set(cam.x + anti.x * 820, -30, cam.z + anti.z * 820);
    this.mesh.lookAt(cam.x, -30, cam.z);
  }
}

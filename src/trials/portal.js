// Swirling doorway for trial exits, shrines and the Vault: a disc of paint slowly turning in the
// room's colour inside a glowing ring (art direction in docs/inspo).
import * as THREE from 'three';

export const portalTime = { value: 0 };

export function makePortal(color, radius = 1.4) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: c }, uTime: portalTime },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p), a = atan(p.y, p.x);
        // Two arms of paint wound into a spiral, drifting inward
        float sw = sin(a * 2.0 + r * 9.0 - uTime * 2.2);
        float band = smoothstep(0.25, 0.55, sw);
        vec3 deep = uColor * 0.35;
        vec3 c = mix(deep, mix(uColor, vec3(1.0), 0.65), band);
        c = mix(c, vec3(1.0), smoothstep(0.35, 0.0, r) * 0.6);
        float alpha = smoothstep(1.0, 0.9, r) * 0.92;
        gl_FragColor = vec4(c * 1.15, alpha);
      }`,
  }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.3) }));
  g.add(disc, ring);
  return g;
}

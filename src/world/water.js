// Stylised ocean: depth-tinted from the terrain height texture, with animated foam lines.
import * as THREE from 'three';
import { G } from '../core/ctx.js';

export class Water {
  constructor(scene, terrain) {
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
        uLight: { value: 1 },
      },
    ]);
    uniforms.uHeight.value = terrain.heightTex;
    this.mat = new THREE.ShaderMaterial({
      uniforms,
      fog: true,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */`
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <fog_pars_fragment>
        uniform float uTime, uSize, uTexN, uLight;
        uniform sampler2D uHeight;
        uniform vec3 uSunDir, uSunCol, uSky;
        varying vec3 vW;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 43758.5); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hh(i),hh(i+vec2(1,0)),f.x), mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 uv = (vW.xz + uSize * 0.5) / uSize;
          float ground = -60.0;
          if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
            vec2 tuv = uv * (uTexN - 1.0) / uTexN + 0.5 / uTexN;
            ground = texture2D(uHeight, tuv).r;
          }
          float depth = max(-ground, 0.0);
          vec3 shallow = vec3(0.35, 0.85, 0.82);
          vec3 deep = vec3(0.06, 0.28, 0.52);
          vec3 col = mix(shallow, deep, smoothstep(0.0, 22.0, depth));
          // Ripples
          vec2 p = vW.xz * 0.08;
          float r1 = vn(p + vec2(uTime * 0.15, uTime * 0.1));
          float r2 = vn(p * 2.3 - vec2(uTime * 0.2, -uTime * 0.07));
          float rip = r1 * 0.6 + r2 * 0.4;
          vec3 n = normalize(vec3((r1 - 0.5) * 0.6, 1.0, (r2 - 0.5) * 0.6));
          // Stylised highlight streaks
          col += smoothstep(0.72, 0.8, rip) * 0.18;
          // Shore foam bands
          float foamBand = sin(depth * 2.2 - uTime * 1.6 + rip * 4.0);
          float foam = smoothstep(2.4, 0.0, depth) * smoothstep(0.35, 0.9, foamBand + (1.0 - smoothstep(0.0, 0.7, depth)));
          col = mix(col, vec3(0.97, 0.99, 1.0), clamp(foam, 0.0, 1.0));
          // Fresnel sky reflection + sun glint
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(V, n), 0.0), 3.0);
          col = mix(col, uSky, fres * 0.55);
          vec3 H = normalize(V + uSunDir);
          col += uSunCol * pow(max(dot(n, H), 0.0), 180.0) * 1.4;
          col *= uLight;
          float alpha = mix(0.55, 0.92, smoothstep(0.0, 6.0, depth));
          alpha = max(alpha, foam);
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(8000, 8000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  update(dt, env) {
    const u = this.mat.uniforms;
    u.uTime.value += dt;
    u.uSunDir.value.copy(env.lightDir || env.sunDir);
    u.uSunCol.value.copy(env.cur.sun).multiplyScalar(1 - env.night * 0.7);
    u.uSky.value.copy(env.cur.hor);
    u.uLight.value = 1 - env.night * 0.55;
    this.mesh.position.x = Math.round(G.camera.position.x / 100) * 100;
    this.mesh.position.z = Math.round(G.camera.position.z / 100) * 100;
    this.mesh.visible = G.camera.position.y > -200;
  }
}

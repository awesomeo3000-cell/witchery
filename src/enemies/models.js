// Enemy & boss meshes built from primitives. Each returns {group, parts, mats}.
import * as THREE from 'three';
import { softLit } from '../world/props.js';

const lam = (c, o = {}) => softLit(new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o }), { rim: 0.4 });

function eyes(group, y, z, spread = 0.18, size = 0.09, color = 0x111111) {
  const m = new THREE.MeshBasicMaterial({ color });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 5), m);
    e.position.set(s * spread, y, z);
    group.add(e);
  }
}

export const VARIANT_TINT = { none: null, fire: 0xff8a5a, ice: 0x9ad8ff };

export function buildBounder(tint) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const furMat = lam(tint ?? 0xf4f0ea);
  const puffGeo = new THREE.IcosahedronGeometry(0.55, 1);
  const puffs = [[0, 0.9, 0, 1.3], [0.45, 1.1, -0.2, 0.9], [-0.45, 1.1, -0.2, 0.9], [0, 1.35, -0.35, 0.9], [0.3, 0.7, 0.3, 0.8], [-0.3, 0.7, 0.3, 0.8], [0, 0.95, -0.6, 0.9]];
  for (const [x, y, z, s] of puffs) {
    const p = new THREE.Mesh(puffGeo, furMat);
    p.position.set(x, y, z);
    p.scale.setScalar(s);
    p.castShadow = true;
    body.add(p);
  }
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lam(0x3a3040));
  face.position.set(0, 0.95, 0.55);
  face.scale.set(1, 0.9, 0.6);
  body.add(face);
  const hornMat = lam(0xd8b080);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 5, 8, Math.PI * 1.3), hornMat);
    h.position.set(s * 0.45, 1.25, 0.4);
    h.rotation.y = s * 1.3;
    body.add(h);
  }
  eyes(body, 1.02, 0.8, 0.15, 0.07, 0xff4040);
  const legMat = lam(0x3a3040);
  const legs = [];
  for (const [x, z] of [[-0.35, 0.3], [0.35, 0.3], [-0.35, -0.35], [0.35, -0.35]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.45, 5), legMat);
    l.position.set(x, 0.22, z);
    body.add(l);
    legs.push(l);
  }
  return { group: g, body, legs, height: 1.8, radius: 0.9 };
}

export function buildInkling(tint) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const mat = lam(tint ?? 0x3a3448, { emissive: 0x100818 });
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), mat);
  blob.scale.set(1, 0.8, 1);
  blob.position.y = 0.55;
  blob.castShadow = true;
  body.add(blob);
  const drip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 8), mat);
  drip.position.y = 1.2;
  body.add(drip);
  eyes(body, 0.7, 0.55, 0.22, 0.12, 0xfff2a0);
  return { group: g, body, blob, height: 1.4, radius: 0.7 };
}

export function buildSpitter(tint) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const stemMat = lam(0x3f6a35);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.6, 6), stemMat);
  stem.position.y = 0.8;
  body.add(stem);
  const leafGeo = new THREE.ConeGeometry(0.35, 1.4, 4);
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(leafGeo, stemMat);
    const a = (i / 5) * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.6, 0.3, Math.sin(a) * 0.6);
    l.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    body.add(l);
  }
  const head = new THREE.Group();
  head.position.y = 1.9;
  body.add(head);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), lam(tint ?? 0x8a3a8a));
  bulb.castShadow = true;
  head.add(bulb);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.5, 8), lam(0x2a1a2a));
  mouth.rotation.x = Math.PI / 2;
  mouth.position.z = 0.55;
  head.add(mouth);
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), lam(0xe8e0c0));
    const a = (i / 6) * Math.PI * 2;
    t.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0);
    t.rotation.z = a - Math.PI / 2;
    head.add(t);
  }
  return { group: g, body, head, height: 2.4, radius: 0.8 };
}

export function buildArcher(tint) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const cloak = lam(tint ?? 0x3a3448, { emissive: 0x100818 });
  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 7), cloak);
  torso.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), cloak);
  head.position.y = 1.65;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 7), cloak);
  hood.position.set(0, 2.05, -0.1);
  hood.rotation.x = -0.3;
  body.add(torso, head, hood);
  eyes(body, 1.7, 0.33, 0.14, 0.08, 0xff6a3a);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 4, 16, Math.PI), lam(0x6a4428));
  bow.position.set(0.45, 1.2, 0.35);
  bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
  body.add(bow);
  return { group: g, body, bow, height: 2.2, radius: 0.6 };
}

export function buildWisp() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const mat = lam(0x2a2438, { emissive: 0x1a0a2a });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), mat);
  core.castShadow = true;
  body.add(core);
  const wingMat = lam(0x4a3a6a, { side: THREE.DoubleSide });
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 3), wingMat);
    w.rotation.z = s * Math.PI / 2;
    w.position.x = s * 0.9;
    w.scale.z = 0.2;
    body.add(w);
    wings.push(w);
  }
  eyes(body, 0.1, 0.45, 0.18, 0.1, 0xff60ff);
  body.position.y = 1;
  return { group: g, body, wings, height: 1.6, radius: 0.8 };
}

// ------------------------------------------------------------------ bosses
export function buildFrostmaw() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const rock = lam(0x6a7a90);
  const ice = lam(0xbfe8ff, { emissive: 0x3070a0, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 });
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), rock);
  torso.position.y = 4.2;
  torso.scale.set(1.2, 1, 0.9);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), rock);
  head.position.set(0, 6.3, 0.6);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 2.8, 5, 0);
    const a = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), rock);
    a.position.y = -1.3;
    a.scale.set(0.8, 1.4, 0.8);
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), rock);
    fist.position.y = -3;
    arm.add(a, fist);
    body.add(arm);
    arms.push(arm);
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rock);
    leg.position.set(s * 1.2, 1.2, 0);
    leg.scale.set(1, 1.5, 1);
    body.add(leg);
  }
  const armor = new THREE.Group();
  const spikes = [[0, 6.2, -0.8, 0], [1.6, 5.4, -0.6, 0.6], [-1.6, 5.4, -0.6, -0.6], [2.8, 5.8, 0, 0.9], [-2.8, 5.8, 0, -0.9], [0, 4.4, 1.9, 0], [0, 7.4, 0.3, 0]];
  for (const [x, y, z, r] of spikes) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 5), ice);
    s.position.set(x, y, z);
    s.rotation.z = -r;
    s.rotation.x = z < 0 ? -0.5 : z > 1 ? 1.2 : 0;
    armor.add(s);
  }
  const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5, 0), ice);
  shell.position.y = 4.2;
  shell.scale.set(1.25, 1.05, 1);
  armor.add(shell);
  body.add(torso, head, armor);
  eyes(body, 6.4, 1.55, 0.4, 0.2, 0x7af0ff);
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, arms, armor, height: 7.5, radius: 3.2 };
}

export function buildMagmaw() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const crust = lam(0x3a2a2a);
  const lava = new THREE.MeshBasicMaterial({ color: 0xff6a20 });
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), crust);
  blob.position.y = 3;
  blob.scale.set(1.1, 0.9, 1.1);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.7, 1), lava);
  core.position.y = 3;
  core.scale.set(1.12, 0.93, 1.12);
  const cracks = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.6), lava);
    const a = Math.random() * Math.PI * 2, b = Math.random() * 1.2;
    c.position.set(Math.cos(a) * 3 * Math.cos(b), 3 + Math.sin(b) * 2.6, Math.sin(a) * 3 * Math.cos(b));
    c.lookAt(0, 3, 0);
    c.rotateY(Math.PI / 2);
    cracks.add(c);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.5), lava);
  mouth.position.set(0, 2.6, 3);
  body.add(blob, core, cracks, mouth);
  eyes(body, 4, 2.8, 0.8, 0.3, 0xffee60);
  const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 1), lam(0xcdefff, { transparent: true, opacity: 0.6, emissive: 0x3070a0 }));
  ice.position.y = 3;
  ice.visible = false;
  body.add(ice);
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, ice, lavaMat: lava, height: 6, radius: 3.4 };
}

export function buildShellback() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shellMat = lam(0xd8a030);
  const belly = lam(0xf0d8a0);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  shell.position.y = 1.4;
  shell.scale.set(1, 0.8, 1.2);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.6, 12), belly);
  plate.position.y = 1.4;
  plate.scale.set(1, 1, 1.2);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), lam(0x8a6a3a));
  head.position.set(0, 1.8, 3.8);
  const legs = [];
  for (const [x, z] of [[-2.2, 2], [2.2, 2], [-2.2, -2], [2.2, -2]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 1.6, 6), lam(0x8a6a3a));
    l.position.set(x, 0.8, z);
    body.add(l);
    legs.push(l);
  }
  const studs = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 5), lam(0x9a6a20));
    const a = (i / 9) * Math.PI * 2;
    s.position.set(Math.cos(a) * 1.8, 3.3, Math.sin(a) * 2.2);
    studs.add(s);
  }
  body.add(shell, plate, head, studs);
  eyes(body, 2.1, 4.75, 0.45, 0.18, 0x111111);
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, legs, height: 4.2, radius: 3.4 };
}

export function buildGalewing() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const featherMat = lam(0x6a8aa8);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), featherMat);
  torso.scale.set(1, 1.3, 1);
  torso.position.y = 0;
  const face = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), lam(0xe8e0d0));
  face.position.set(0, 1.4, 0.8);
  face.scale.set(1, 0.9, 0.6);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 5), lam(0xe8a030));
  beak.rotation.x = Math.PI / 2 + 0.4;
  beak.position.set(0, 1.2, 1.6);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 1.3, 0.8, 0);
    const wm = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 2.2), featherMat);
    wm.position.x = s * 2.3;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 4), lam(0x4a6a88));
    tip.rotation.z = -s * Math.PI / 2;
    tip.position.x = s * 5.5;
    tip.scale.z = 0.2;
    w.add(wm, tip);
    body.add(w);
    wings.push(w);
  }
  const vines = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 5, 14), lam(0x3f9a3a));
    v.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    vines.add(v);
  }
  vines.visible = false;
  body.add(torso, face, beak, vines);
  eyes(body, 1.6, 1.4, 0.45, 0.2, 0xffcc30);
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, wings, vines, height: 4, radius: 2.4 };
}

export function buildHueless() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const ink = lam(0x2a2630, { emissive: 0x0a0810 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 2), ink);
  core.position.y = 7;
  const crown = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 5), lam(0x5a5468));
    const a = (i / 7) * Math.PI * 2;
    s.position.set(Math.cos(a) * 2.2, 11, Math.sin(a) * 2.2);
    s.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    crown.add(s);
  }
  const tendrils = [];
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Group();
    const a = (i / 8) * Math.PI * 2;
    t.position.set(Math.cos(a) * 3, 4, Math.sin(a) * 3);
    t.rotation.y = -a;
    const seg = new THREE.Mesh(new THREE.ConeGeometry(0.7, 6, 6), ink);
    seg.position.y = -2.5;
    seg.rotation.x = Math.PI;
    t.add(seg);
    body.add(t);
    tendrils.push(t);
  }
  const shieldMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(6.2, 2), shieldMat);
  shield.position.y = 7;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  eye.position.set(0, 7.5, 3.6);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  pupil.position.set(0, 7.5, 4.6);
  body.add(core, crown, eye, pupil, shield);
  body.traverse((m) => { if (m.isMesh && m !== shield) m.castShadow = true; });
  return { group: g, body, tendrils, shield, shieldMat, eye, height: 12, radius: 4.5 };
}

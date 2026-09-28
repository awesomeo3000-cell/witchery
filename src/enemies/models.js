// Enemy & boss meshes built from primitives. Each returns {group, parts, mats}.
import * as THREE from 'three';
import { softLit } from '../world/props.js';
import { paintTex } from '../world/textures.js';

// Smooth shading with a soft rim; rocky bosses opt back into facets with { flatShading: true }
const lam = (c, o = {}) => softLit(new THREE.MeshLambertMaterial({ color: c, ...o }), { rim: 0.4, wrap: 0.3 });

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
  const puffGeo = new THREE.IcosahedronGeometry(0.55, 3);
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
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 18), mat);
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
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), lam(tint ?? 0x8a3a8a));
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
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), mat);
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

// Practice dummy: a straw sack on a post with a painted target and a pot helmet
export function buildDummy() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const wood = lam(0x7a5230), straw = lam(0xd8b060), pot = lam(0x5a5a64);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 8), wood);
  post.position.y = 0.6;
  const sack = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.55, 6, 14), straw);
  sack.position.y = 1.35;
  sack.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), straw);
  head.position.y = 2.1;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), pot);
  helm.position.y = 2.14;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), wood);
  arm.rotation.z = Math.PI / 2;
  arm.position.y = 1.55;
  // Painted target rings on the chest
  const rings = [0xe8442e, 0xfff0dc, 0xe8442e].map((c, i) => {
    const r = new THREE.Mesh(new THREE.CircleGeometry(0.26 - i * 0.08, 16), new THREE.MeshBasicMaterial({ color: c }));
    r.position.set(0, 1.4, 0.36 + i * 0.005);
    return r;
  });
  body.add(post, sack, head, helm, arm, ...rings);
  return { group: g, body, height: 2.4, radius: 0.5 };
}

// Night Inkbat: a round ink body with scalloped membrane wings and glowing eyes
export function buildInkbat() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const mat = lam(0x1e1a2a, { emissive: 0x120820 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), mat);
  core.scale.set(1, 0.9, 1.15);
  core.castShadow = true;
  body.add(core);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 6), mat);
    ear.position.set(s * 0.15, 0.32, 0.02);
    ear.rotation.z = -s * 0.3;
    body.add(ear);
  }
  // Wing: finger bones fanning out with scalloped membrane between them
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.12);
  sh.lineTo(0.55, 0.28);
  sh.lineTo(1.15, 0.12);
  sh.quadraticCurveTo(0.98, -0.02, 0.95, -0.22);
  sh.quadraticCurveTo(0.8, -0.1, 0.62, -0.3);
  sh.quadraticCurveTo(0.45, -0.12, 0.28, -0.28);
  sh.quadraticCurveTo(0.14, -0.08, 0, -0.12);
  sh.closePath();
  const wingGeo = new THREE.ShapeGeometry(sh, 6).rotateX(-Math.PI / 2);
  const wingMat = lam(0x3a2a52, { side: THREE.DoubleSide, emissive: 0x100818 });
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.22, 0.05, 0);
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.scale.x = s;
    pivot.add(w);
    body.add(pivot);
    wings.push(pivot);
  }
  eyes(body, 0.08, 0.3, 0.12, 0.06, 0xffd040);
  body.position.y = 0.5;
  return { group: g, body, wings, height: 0.9, radius: 0.6 };
}

// ------------------------------------------------------------------ bosses
export function buildFrostmaw() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const rock = lam(0x6a7a90, { flatShading: true });
  const ice = lam(0xbfe8ff, { emissive: 0x3070a0, emissiveIntensity: 0.4, transparent: true, opacity: 0.9, flatShading: true });
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
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 4), crust);
  blob.position.y = 3;
  blob.scale.set(1.1, 0.9, 1.1);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.7, 4), lava);
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
  const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 2), lam(0xcdefff, { transparent: true, opacity: 0.6, emissive: 0x3070a0, flatShading: true }));
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
  const shell = new THREE.Mesh(new THREE.SphereGeometry(3.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  shell.position.y = 1.4;
  shell.scale.set(1, 0.8, 1.2);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.6, 28), belly);
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
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 18), featherMat);
  torso.scale.set(1, 1.3, 1);
  torso.position.y = 0;
  const face = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 18), lam(0xe8e0d0));
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
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 5), ink);
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
  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(6.2, 4), shieldMat);
  shield.position.y = 7;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  eye.position.set(0, 7.5, 3.6);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  pupil.position.set(0, 7.5, 4.6);
  body.add(core, crown, eye, pupil, shield);
  body.traverse((m) => { if (m.isMesh && m !== shield) m.castShadow = true; });
  return { group: g, body, tendrils, shield, shieldMat, eye, height: 12, radius: 4.5 };
}

// ------------------------------------------------------------------ field bosses
export function buildBlotGiant() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const ink = lam(0x3a3246);
  const belly = lam(0x6a5a78);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(2.6, 28, 20), ink);
  torso.scale.set(1, 1.15, 0.85);
  torso.position.y = 5.2;
  const bellyM = new THREE.Mesh(new THREE.SphereGeometry(2.1, 24, 16), belly);
  bellyM.scale.set(1, 1.05, 0.6);
  bellyM.position.set(0, 4.8, 1.0);
  const head = new THREE.Group();
  head.position.y = 8.2;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 18), ink);
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 16), lam(0xf4f0e8, { emissive: 0x303030 }));
  sclera.position.set(0, 0.15, 1.12);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe8442e }));
  iris.position.set(0, 0.15, 1.72);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), ink);
  lid.position.set(0, 0.15, 1.1);
  lid.rotation.x = Math.PI / 2 + 0.2;
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 12), lam(0xd8c8a0));
    horn.position.set(s * 0.95, 1.1, 0);
    horn.rotation.z = -s * 0.5;
    head.add(horn);
  }
  head.add(skull, sclera, iris, lid);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 2.7, 6.6, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 2.2, 8, 14), ink);
    up.position.y = -1.6;
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), ink);
    fist.position.y = -3.4;
    arm.add(up, fist);
    body.add(arm);
    arms.push(arm);
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.8, 8, 14), ink);
    leg.position.set(s * 1.3, 1.6, 0);
    body.add(leg);
  }
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 1.4, 20, 1, true), lam(0x8a5a36, { side: THREE.DoubleSide }));
  cloth.position.y = 3.2;
  body.add(torso, bellyM, head, cloth);
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, head, arms, lid, iris, height: 9.5, radius: 3 };
}

export function buildSentinel(rockGeoFn) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const stone = lam(0x9a8c7a);
  const mk = (s, x, y, z, seed) => {
    const m = new THREE.Mesh(rockGeoFn(seed), stone);
    m.scale.set(s * 1.2, s, s);
    m.position.set(x, y, z);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  mk(2.6, 0, 2.4, 0, 1);
  mk(1.8, 0, 4.6, -0.2, 2);
  const arms = [mk(1.2, -3, 2.2, 0.4, 3), mk(1.2, 3, 2.2, 0.4, 4)];
  mk(1, -1.5, 0.8, 1.2, 5);
  mk(1, 1.5, 0.8, 1.2, 6);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshLambertMaterial({ color: 0xffd84a, emissive: 0xffa000, emissiveIntensity: 0.9, flatShading: true }));
  crystal.scale.y = 1.6;
  crystal.position.set(0, 6.6, -0.2);
  body.add(crystal);
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd84a }));
    e.position.set(s * 0.6, 4.8, 1.55);
    eyes.add(e);
  }
  body.add(eyes);
  return { group: g, body, arms, crystal, eyes, height: 7, radius: 3.2 };
}

// Rainmane: a painted centaur-lion that roams the plains. Its great mane shifts through the four
// colours; only the colour that undoes the mane's current one really hurts it.
export function buildRainmane() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = lam(0x4e3e62, { map: paintTex('cloth') });
  const belly = lam(0x6a5a78, { map: paintTex('cloth') });
  const gold = lam(0xd8b060, { emissive: 0x302000 });
  // Lion body
  const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 2.4, 8, 16).rotateX(Math.PI / 2), hide);
  barrel.position.set(0, 2.3, -0.4);
  const under = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 2.0, 6, 12).rotateX(Math.PI / 2), belly);
  under.position.set(0, 2.0, -0.4);
  under.scale.set(0.9, 0.7, 1);
  body.add(barrel, under);
  const legs = [];
  for (const [x, z] of [[-0.6, 0.9], [0.6, 0.9], [-0.6, -1.6], [0.6, -1.6]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.1, z);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 6, 10), hide);
    leg.position.y = -1.0;
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), belly);
    paw.scale.set(1, 0.6, 1.3);
    paw.position.set(0, -1.95, 0.1);
    pivot.add(leg, paw);
    body.add(pivot);
    legs.push(pivot);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 2.6, -2.2);
  const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.8, 6).translate(0, -0.9, 0), hide);
  tailM.rotation.x = -0.5;
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), gold);
  tuft.position.set(0, -1.6, -0.85);
  tail.add(tailM, tuft);
  body.add(tail);
  // Upright torso, arms and head
  const torso = new THREE.Group();
  torso.position.set(0, 3.0, 1.2);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.2, 8, 14), hide);
  chest.position.y = 0.9;
  const plate = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), gold);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(0, 1.1, 0.45);
  plate.scale.set(1, 1, 0.5);
  const head = new THREE.Group();
  head.position.y = 2.35;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), belly);
  skull.scale.set(1, 1, 1.1);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), belly);
  snout.position.set(0, -0.15, 0.5);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe066).multiplyScalar(1.8) }));
    eye.position.set(s * 0.22, 0.1, 0.48);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 8), gold);
    horn.position.set(s * 0.35, 0.55, -0.1);
    horn.rotation.set(-0.6, 0, -s * 0.3);
    head.add(eye, horn);
  }
  // The mane: a ruff of spikes whose colour shows its current pigment
  const maneMat = new THREE.MeshLambertMaterial({ color: 0xe8442e, emissive: 0xe8442e, emissiveIntensity: 0.45 });
  const mane = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.0 + (i % 2) * 0.4, 6), maneMat);
    spike.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, -0.25);
    spike.rotation.z = a - Math.PI / 2;
    spike.rotation.x = -0.35;
    mane.add(spike);
  }
  head.add(skull, snout, mane);
  torso.add(chest, plate, head);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.95, 1.5, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.1, 6, 10), hide);
    up.position.y = -0.7;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), belly);
    hand.position.y = -1.45;
    arm.add(up, hand);
    torso.add(arm);
    arms.push(arm);
  }
  // A huge paint-glaive in the right hand
  const glaive = new THREE.Group();
  glaive.position.set(0, -1.45, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.8, 6), lam(0x5a3a22));
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.8;
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 4).rotateX(Math.PI / 2), maneMat);
  blade.position.z = 3.3;
  blade.scale.set(0.35, 1, 1);
  glaive.add(shaft, blade);
  arms[1].add(glaive);
  body.add(torso);
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, legs, torso, head, arms, glaive, tail, mane, maneMat, height: 5, radius: 1.8 };
}

// Ruin Sentry: an old stone turret left by the Painters, now soaked in ink. A single eye charges a
// beam, then fires a bolt you can strike back at it.
export function buildSentry() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const stone = lam(0x8a8272, { map: paintTex('cloth') });
  const ink = lam(0x3a3246);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1.2, 10), stone);
  base.position.y = 0.6;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8), ink);
    leg.position.set(Math.cos(a) * 1.2, 0.35, Math.sin(a) * 1.2);
    leg.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    body.add(leg);
  }
  const head = new THREE.Group();
  head.position.y = 1.6;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 6, 20).rotateX(Math.PI / 2), ink);
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ee0ff).multiplyScalar(1.6) });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), eyeMat);
  eye.position.set(0, 0.55, 0.95);
  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 6, 16), ink);
  brow.position.copy(eye.position);
  head.add(dome, rim, eye, brow);
  body.add(base, head);
  // The charging beam: a thin glowing rod from the eye, stretched toward the target
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a4a).multiplyScalar(1.5), transparent: true, opacity: 0.8 }));
  beam.visible = false;
  g.add(beam);
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, head, eye, eyeMat, beam, height: 2.6, radius: 1.4 };
}

// Inkspout: a round, snouted blot that lurks under shallow water, pops up and spits ink.
export function buildInkspout(tint) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = lam(tint || 0x4a3a6a, { map: paintTex('cloth') });
  const pale = lam(0xb8a8d8);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 14), skin);
  ball.scale.set(1, 0.9, 1);
  ball.position.y = 0.7;
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.7, 12).rotateX(Math.PI / 2), skin);
  snout.position.set(0, 0.62, 0.85);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 6, 14), pale);
  lip.position.set(0, 0.62, 1.2);
  body.add(ball, snout, lip);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff4c0 }));
    eye.position.set(s * 0.35, 1.05, 0.6);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    pupil.position.set(s * 0.37, 1.07, 0.74);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 4), pale);
    fin.position.set(s * 0.75, 0.9, -0.1);
    fin.rotation.z = -s * 0.9;
    body.add(eye, pupil, fin);
  }
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, snout, height: 1.4, radius: 0.9 };
}

// Ink Knight: a heavy blot in painted armour with a round shield that turns aside frontal blows.
export function buildKnight(tint) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const ink = lam(tint || 0x3a3246);
  const plate = lam(0x9a9aa8, { map: paintTex('cloth') });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.7, 6, 12), ink);
  torso.position.y = 1.2;
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), plate);
  chest.position.y = 1.35;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), plate);
  helm.position.y = 2.15;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a4a).multiplyScalar(1.5) }));
  visor.position.set(0, 2.15, 0.34);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), lam(0xe8442e));
  plume.position.set(0, 2.6, -0.05);
  body.add(torso, chest, helm, visor, plume);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8), ink);
    leg.position.set(s * 0.25, 0.4, 0);
    body.add(leg);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.7, 1.6, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.55, 4, 8), ink);
    up.position.y = -0.4;
    arm.add(up);
    body.add(arm);
    arms.push(arm);
  }
  // Shield on the left arm, sword in the right
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 18).rotateX(Math.PI / 2), plate);
  shield.position.set(0.1, -0.5, 0.45);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lam(0xd8b060));
  boss.position.set(0.1, -0.5, 0.52);
  arms[0].add(shield, boss);
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.04).translate(0, -1.2, 0), plate);
  arms[1].add(sword);
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, body, arms, shield: [shield, boss], height: 2.7, radius: 0.8 };
}

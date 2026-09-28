// Procedurally built & animated hero (also used for friends and NPCs).
import * as THREE from 'three';
import { lerp, damp } from '../core/math.js';
import { softLit } from '../world/props.js';
import { paintTex } from '../world/textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Fold the static meshes under each joint into one mesh per material kind, baking each part's colour
// into vertex colours. Joints (groups) keep animating; meshes in `keep` and the brush are untouched.
// Cuts a character from ~48 draw calls to about a dozen.
function compactCharacter(root, keep, skip) {
  const groups = [];
  root.traverse((o) => { if (!o.isMesh && o !== skip) groups.push(o); });
  for (const g of groups) {
    if (g === skip) continue;
    const buckets = new Map();
    for (const m of g.children) {
      if (!m.isMesh || m.isInstancedMesh || m.children.length || keep.has(m) || Array.isArray(m.material) || !m.visible) continue;
      const mat = m.material;
      if (!(mat.isMeshToonMaterial || mat.isMeshBasicMaterial) || mat.vertexColors) continue;
      const key = `${mat.type}|${mat.map ? mat.map.uuid : ''}|${mat.side}|${mat.transparent}|${mat.opacity}|${mat.depthWrite}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(m);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        geo.applyMatrix4(m.matrix);
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
        if (!geo.attributes.normal) geo.computeVertexNormals();
        const c = m.material.color;
        const col = new Float32Array(geo.attributes.position.count * 3);
        for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return geo;
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mat = list[0].material;
      mat.vertexColors = true;
      mat.color.setRGB(1, 1, 1);
      mat.needsUpdate = true;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = list.some((m) => m.castShadow);
      mesh.receiveShadow = list.some((m) => m.receiveShadow);
      for (const m of list) { g.remove(m); if (m.material !== mat) m.material.dispose(); }
      g.add(mesh);
    }
  }
}

let gradientMap = null;
function toon(color, extra = {}) {
  if (!gradientMap) {
    // Soft cel ramp: a gentle step into shadow instead of hard facets
    const data = new Uint8Array([125, 140, 205, 235, 255]);
    gradientMap = new THREE.DataTexture(data, 5, 1, THREE.RedFormat);
    gradientMap.minFilter = gradientMap.magFilter = THREE.LinearFilter;
    gradientMap.needsUpdate = true;
  }
  return softLit(new THREE.MeshToonMaterial({ color, gradientMap, ...extra }), { rim: 0.5 });
}

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
  m.castShadow = true;
  return m;
}

// Cloth-textured toon material
function cloth(color, extra = {}) { return toon(color, { map: paintTex('cloth'), ...extra }); }

// Smooth flared garment from a profile of [radius, y] points
function lathe(profile, segs = 20) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  g.computeVertexNormals();
  return g;
}

// Cape: a curved sheet hanging from the shoulders
function capeGeometry() {
  const g = new THREE.PlaneGeometry(0.62, 0.9, 6, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const t = (0.45 - y) / 0.9; // 0 at top
    p.setX(i, x * (0.75 + t * 0.55));
    p.setZ(i, -Math.cos(x * 3) * 0.06 - t * 0.12);
  }
  g.translate(0, -0.45, 0);
  g.computeVertexNormals();
  return g;
}

function gliderGeometry() {
  // Curved patchwork canopy
  const w = 3.1, segs = 12;
  const geo = new THREE.PlaneGeometry(w, 1.4, segs, 3);
  const p = geo.attributes.position;
  const colors = [];
  const pal = [0xe8e2d4, 0xc7453a, 0x3a9ae8, 0xe8e2d4, 0x3fb54a, 0xc7453a, 0xf2c229];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const bend = Math.pow(x / (w / 2), 2);
    p.setXYZ(i, x, -bend * 0.9, y);
    const patch = pal[Math.abs(Math.floor(x * 1.7) * 3 + Math.floor(y * 2.1)) % pal.length];
    const c = new THREE.Color(patch);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo.toNonIndexed();
}

export function makeBrush(colorHex = 0xe8442e) {
  const brush = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.1, 10), toon(0x7a4a2a, { map: paintTex('bark') }));
  handle.position.y = 0.5;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), toon(0x5a3a1a));
  knob.position.y = -0.55;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.22, 16), toon(0xd8b050));
  ferrule.position.y = 1.62;
  const tipMat = toon(colorHex, { emissive: colorHex, emissiveIntensity: 0.35 });
  const bristleGeo = new THREE.SphereGeometry(0.17, 18, 14);
  bristleGeo.scale(1, 2.4, 1);
  bristleGeo.translate(0, 0.28, 0);
  const pos = bristleGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.35) { // pinch into a pointed tip
      const k = 1 - (y - 0.35) * 1.6;
      pos.setX(i, pos.getX(i) * Math.max(0.1, k));
      pos.setZ(i, pos.getZ(i) * Math.max(0.1, k));
    }
  }
  bristleGeo.computeVertexNormals();
  const tip = new THREE.Mesh(bristleGeo, tipMat);
  tip.position.y = 1.7;
  [handle, knob, ferrule, tip].forEach((m) => (m.castShadow = true));
  brush.add(handle, knob, ferrule, tip);
  const tipPoint = new THREE.Object3D();
  tipPoint.position.y = 2.35;
  brush.add(tipPoint);
  const basePoint = new THREE.Object3D();
  basePoint.position.y = 1.1;
  brush.add(basePoint);
  return { group: brush, tipMat, tipPoint, basePoint };
}

export function makeCharacter(look = {}) {
  const hoodC = look.hood ?? 0x2f8a8a;
  const scarfC = look.scarf ?? 0xc7453a;
  const skinC = look.skin ?? 0xf0c8a0;
  const tunicC = look.tunic ?? 0x3a3f5a;

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.85;
  root.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);
  // Tunic: chest tapering to the waist, then a flared skirt
  const tunic = new THREE.Mesh(lathe([[0.001, 0.78], [0.2, 0.74], [0.27, 0.62], [0.25, 0.4], [0.22, 0.2], [0.28, 0.08], [0.36, -0.12], [0.4, -0.2]]), cloth(tunicC, { side: THREE.DoubleSide }));
  tunic.castShadow = true;
  torso.add(tunic);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.025, 6, 24), toon(scarfC));
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -0.18;
  torso.add(hem);
  const cape = new THREE.Mesh(capeGeometry(), cloth(hoodC, { side: THREE.DoubleSide }));
  cape.position.set(0, 0.72, -0.2);
  cape.castShadow = true;
  torso.add(cape);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.045, 8, 24), toon(0x6a4a2a));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.12;
  torso.add(belt);

  const headG = new THREE.Group();
  headG.position.y = 0.86;
  torso.add(headG);
  const headGeo = new THREE.SphereGeometry(0.27, 24, 18);
  headGeo.scale(1, 1.02, 0.96);
  const head = new THREE.Mesh(headGeo, toon(skinC));
  head.castShadow = true;
  headG.add(head);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth(hoodC, { side: THREE.DoubleSide }));
  hood.rotation.x = -0.45;
  hood.position.set(0, 0.04, -0.05);
  hood.castShadow = true;
  headG.add(hood);
  // Soft drooping hood tip: a tapered tube along a curve
  const tipCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.12, -0.22), new THREE.Vector3(0, 0.26, -0.42), new THREE.Vector3(0, 0.14, -0.62), new THREE.Vector3(0, -0.06, -0.7)]);
  const tipGeo = new THREE.TubeGeometry(tipCurve, 16, 0.16, 10, false);
  const tp = tipGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const seg = Math.floor(i / 11) / 16; // taper along the tube
    const c = tipCurve.getPoint(Math.min(1, seg));
    const k = 1 - seg * 0.9;
    tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * k, c.y + (tp.getY(i) - c.y) * k, c.z + (tp.getZ(i) - c.z) * k);
  }
  tipGeo.computeVertexNormals();
  const hoodTip = new THREE.Mesh(tipGeo, cloth(hoodC));
  hoodTip.castShadow = true;
  headG.add(hoodTip);
  // Pointed ears poking out of the hood, and a fringe of hair
  const skinMat = toon(skinC);
  for (const sd of [-1, 1]) {
    const earGeo = new THREE.ConeGeometry(0.07, 0.34, 12);
    earGeo.scale(1, 1, 0.45);
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(sd * 0.29, 0.02, -0.02);
    ear.rotation.z = -sd * 1.25;
    ear.rotation.y = sd * 0.3;
    headG.add(ear);
  }
  // Soft swept fringe of hair under the hood
  const hairMat = toon(look.hair ?? 0xd8a860);
  for (let i = 0; i < 6; i++) {
    const lockGeo = new THREE.SphereGeometry(0.075, 12, 10);
    lockGeo.scale(0.85, 1.5, 0.6);
    const lock = new THREE.Mesh(lockGeo, hairMat);
    const a = (i - 2.5) * 0.28;
    lock.position.set(Math.sin(a) * 0.23, 0.14 - Math.abs(i - 2.5) * 0.025, Math.cos(a) * 0.2);
    lock.rotation.set(0.5, a, (i - 2.5) * 0.25);
    headG.add(lock);
  }
  // Big expressive eyes with a highlight, and rosy cheeks
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x241e30 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xf08a8a, transparent: true, opacity: 0.45, depthWrite: false });
  for (const s of [-1, 1]) {
    const eyeGeo = new THREE.SphereGeometry(0.042, 12, 10);
    eyeGeo.scale(0.8, 1.15, 0.5);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(s * 0.095, 0.01, 0.245);
    eye.rotation.y = s * 0.35;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), shineMat);
    shine.position.set(s * 0.085 + 0.01, 0.03, 0.265);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), blushMat);
    blush.position.set(s * 0.15, -0.06, 0.225);
    blush.rotation.y = s * 0.55;
    headG.add(eye, shine, blush);
  }
  const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.12), toon(0x7a5230));
  satchel.position.set(-0.26, 0.08, 0.1);
  satchel.rotation.y = 0.4;
  torso.add(satchel);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 16), toon(0x5a3a20));
  strap.position.set(0, 0.35, 0);
  strap.rotation.set(Math.PI / 2, 0.55, 0);
  strap.scale.set(1, 1.25, 1);
  torso.add(strap);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.075, 10, 24), cloth(scarfC));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.66;
  torso.add(scarf);
  const tailGeo = new THREE.PlaneGeometry(0.16, 0.6, 1, 6);
  const ttp = tailGeo.attributes.position;
  for (let i = 0; i < ttp.count; i++) ttp.setZ(i, Math.sin(ttp.getY(i) * 6) * 0.03);
  tailGeo.computeVertexNormals();
  tailGeo.translate(0, -0.3, 0);
  const tail = new THREE.Mesh(tailGeo, cloth(scarfC, { side: THREE.DoubleSide }));
  tail.position.set(0.1, 0.66, -0.2);
  tail.castShadow = true;
  torso.add(tail);

  // Arms
  const mkArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.34, 0.6, 0);
    const upper = capsule(0.078, 0.28, cloth(tunicC));
    upper.position.y = -0.2;
    sh.add(upper);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), cloth(tunicC));
    sh.add(shoulder);
    const fore = new THREE.Group();
    fore.position.y = -0.38;
    sh.add(fore);
    const lower = capsule(0.066, 0.22, toon(skinC));
    lower.position.y = -0.16;
    fore.add(lower);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16), toon(0x6a4a2a));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.2;
    fore.add(cuff);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), toon(0x7a5a3a));
    fist.position.y = -0.33;
    fore.add(fist);
    const hand = new THREE.Group();
    hand.position.y = -0.34;
    fore.add(hand);
    torso.add(sh);
    return { sh, fore, hand };
  };
  // Facing +Z, the character's left is +X.
  const armL = mkArm(1);
  const armR = mkArm(-1);

  const mkLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, 0, 0);
    const thigh = capsule(0.092, 0.3, cloth(0x4a3a2a));
    thigh.position.y = -0.2;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    const shin = capsule(0.088, 0.24, toon(0x5a3a22));
    shin.position.y = -0.18;
    knee.add(shin);
    // Rounded boot with a folded cuff
    const bootGeo = new THREE.SphereGeometry(0.11, 14, 10);
    bootGeo.scale(0.85, 0.6, 1.4);
    const boot = new THREE.Mesh(bootGeo, toon(0x3a2418));
    boot.position.set(0, -0.37, 0.05);
    boot.castShadow = true;
    const bootCuff = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.03, 8, 16), toon(0x6a4a2a));
    bootCuff.rotation.x = Math.PI / 2;
    bootCuff.position.y = -0.14;
    knee.add(boot, bootCuff);
    hips.add(hip);
    return { hip, knee };
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  const brushParts = makeBrush(look.brush ?? 0xe8442e);
  const brush = brushParts.group;
  armR.hand.add(brush);

  const glider = new THREE.Mesh(gliderGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  glider.position.set(0, 2.55, -0.1);
  glider.rotation.x = 0.55; // nose down so the canopy reads from behind
  glider.castShadow = true;
  glider.visible = false;
  const strings = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.3, 2.0, 0), new THREE.Vector3(-0.3, 1.55, 0),
      new THREE.Vector3(1.3, 2.0, 0), new THREE.Vector3(0.3, 1.55, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0x333333 }),
  );
  strings.visible = false;
  root.add(glider, strings);
  const rideAnchor = new THREE.Group();
  rideAnchor.position.set(0, 0.62, 0);
  root.add(rideAnchor);

  let phase = 0;
  let brushMode = 'hand';
  const cur = { lean: 0 };

  function setBrushMode(mode) {
    if (mode === brushMode) return;
    brushMode = mode;
    if (mode === 'ride') {
      rideAnchor.add(brush);
      brush.position.set(0, 0, -0.15);
      brush.rotation.set(-Math.PI / 2, 0, 0);
    } else {
      armR.hand.add(brush);
      brush.position.set(0, 0, 0);
      brush.rotation.set(0, 0, 0);
    }
  }

  const A = (o, x, y, z, k) => {
    o.rotation.x = lerp(o.rotation.x, x, k);
    o.rotation.y = lerp(o.rotation.y, y, k);
    o.rotation.z = lerp(o.rotation.z, z, k);
  };

  function animate(p, dt) {
    const k = 1 - Math.exp(-14 * dt);
    const st = p.state;
    const sp = p.speed || 0;
    phase += dt * (st === 'swim' ? 4 : 4 + sp * 1.1);
    const s = Math.sin(phase), c = Math.cos(phase);
    glider.visible = strings.visible = st === 'glide';
    setBrushMode(st === 'ride' ? 'ride' : 'hand');

    let hipY = 0.85, bodyX = 0, bodyZ = 0;
    let lSh = [0, 0, 0.1], rSh = [0, 0, -0.1], lF = [0, 0, 0], rF = [-0.3, 0, 0];
    let lHip = [0, 0, 0], rHip = [0, 0, 0], lK = [0, 0, 0], rK = [0, 0, 0];
    let brushRot = [0.2, 0, 0];

    if (st === 'idle' || st === 'walk' || st === 'run') {
      const amt = Math.min(1, sp / 6);
      const run = Math.min(1, Math.max(0, (sp - 6) / 4));
      hipY = 0.85 + Math.abs(s) * 0.06 * amt - run * 0.05 + (amt < 0.05 ? Math.sin(phase * 0.4) * 0.01 : 0);
      bodyX = 0.08 * amt + run * 0.2;
      lHip = [s * 0.75 * amt, 0, 0];
      rHip = [-s * 0.75 * amt, 0, 0];
      lK = [Math.max(0, -c) * 1.0 * amt + 0.05, 0, 0];
      rK = [Math.max(0, c) * 1.0 * amt + 0.05, 0, 0];
      lSh = [-s * 0.6 * amt, 0, 0.12];
      rSh = [s * 0.4 * amt - 0.1, 0, -0.15];
      lF = [-0.3 - amt * 0.4, 0, 0];
      rF = [-0.5, 0, 0];
      brushRot = [0.9, 0, 0.2];
    } else if (st === 'jump' || st === 'fall') {
      lHip = [-0.6, 0, 0]; rHip = [0.2, 0, 0]; lK = [1.0, 0, 0]; rK = [0.4, 0, 0];
      lSh = [-0.4, 0, 0.8]; rSh = [0.1, 0, -0.8]; brushRot = [0.8, 0, 0];
    } else if (st === 'glide') {
      lSh = [-3.0, 0, 0.25]; rSh = [-3.0, 0, -0.25]; lF = [0, 0, 0]; rF = [0, 0, 0];
      lHip = [0.15 + s * 0.1, 0, 0]; rHip = [0.15 - s * 0.1, 0, 0]; lK = [0.3, 0, 0]; rK = [0.3, 0, 0];
      brushRot = [1.6, 0, 0];
      bodyX = 0.1;
    } else if (st === 'ride') {
      hipY = 0.95;
      lHip = [-1.35, 0, 0.35]; rHip = [-1.35, 0, -0.35]; lK = [1.6, 0, 0]; rK = [1.6, 0, 0];
      lSh = [-0.9, 0, 0.1]; rSh = [-0.9, 0, -0.1]; lF = [-0.4, 0, 0]; rF = [-0.4, 0, 0];
      bodyX = 0.35 + (p.pitch || 0) * 0.3;
      bodyZ = -(p.roll || 0) * 0.4;
    } else if (st === 'climb') {
      const cs = Math.sin(phase * 0.8) * Math.min(1, sp);
      lSh = [-2.6 - cs * 0.4, 0, 0.2]; rSh = [-2.6 + cs * 0.4, 0, -0.2];
      lHip = [-0.5 + cs * 0.4, 0, 0]; rHip = [-0.5 - cs * 0.4, 0, 0]; lK = [0.9, 0, 0]; rK = [0.9, 0, 0];
      brushRot = [1.5, 0, 0];
    } else if (st === 'swim') {
      hipY = 0.75;
      bodyX = 1.1;
      lSh = [-2.5 + s * 0.8, 0, 0.5]; rSh = [-2.5 - s * 0.8, 0, -0.5];
      lHip = [s * 0.4, 0, 0]; rHip = [-s * 0.4, 0, 0];
      brushRot = [1.5, 0, 0];
    } else if (st === 'dead') {
      hipY = 0.25; bodyX = -1.45;
      lSh = [0, 0, 1.2]; rSh = [0, 0, -1.2];
    } else if (st === 'emote_wave') {
      rSh = [-2.7, 0, -0.35 + Math.sin(phase * 2.2) * 0.4]; rF = [-0.5, 0, 0];
      lSh = [0.1, 0, 0.15]; brushRot = [0.4, 0, 0];
    } else if (st === 'emote_cheer') {
      hipY = 0.85 + Math.abs(Math.sin(phase * 1.6)) * 0.12;
      lSh = [-2.9, 0, 0.35]; rSh = [-2.9, 0, -0.35]; lF = [-0.2, 0, 0]; rF = [-0.2, 0, 0];
      brushRot = [0.6 + Math.sin(phase * 1.6) * 0.3, 0, 0];
    } else if (st === 'emote_sit') {
      hipY = 0.3; bodyX = -0.12;
      lHip = [-1.45, 0, 0.18]; rHip = [-1.45, 0, -0.18]; lK = [0.35, 0, 0]; rK = [0.5, 0, 0];
      lSh = [0.35, 0, 0.35]; rSh = [0.35, 0, -0.35]; lF = [-0.2, 0, 0]; rF = [-0.2, 0, 0];
      brushRot = [1.3, 0, 0];
    } else if (st === 'dodge') {
      hipY = 0.55; bodyX = 0.9;
      lHip = [-1.4, 0, 0]; rHip = [-1.4, 0, 0]; lK = [2, 0, 0]; rK = [2, 0, 0];
      lSh = [-1.2, 0, 0]; rSh = [-1.2, 0, 0];
    }

    // Upper-body overrides (attacks & aiming) blend on top of locomotion
    if (p.attack) {
      const t = p.attack.t; // 0..1
      const kind = p.attack.kind;
      if (kind === 'spin') {
        rSh = [-1.5, 0, -1.4]; rF = [-0.2, 0, 0]; brushRot = [2.9, 0, 0];
        lSh = [-0.6, 0, 1.2];
      } else {
        const e = t < 0.3 ? t / 0.3 : 1;
        const back = t < 0.3 ? 1 - e : 0;
        const swing = t < 0.3 ? 0 : Math.min(1, (t - 0.3) / 0.35);
        if (kind === 0) { // right-to-left horizontal
          rSh = [lerp(-1.3, -1.4, swing), lerp(-0.2, 1.4, swing) - back * 0.6, lerp(-1.4, -0.4, swing)];
          brushRot = [2.7, 0, 0];
        } else if (kind === 1) { // left-to-right backhand
          rSh = [lerp(-1.4, -1.3, swing), lerp(1.2, -0.9, swing) + back * 0.4, lerp(-0.3, -1.4, swing)];
          brushRot = [2.7, 0, 0];
        } else { // overhead slam
          rSh = [lerp(-2.9, -0.7, swing) - back * 0.2, 0, -0.15];
          brushRot = [lerp(2.2, 3.0, swing), 0, 0];
          bodyX += swing * 0.3;
        }
        rF = [-0.25, 0, 0];
        lSh = [-0.3, 0, 0.5];
      }
    } else if (p.aim) {
      const pitch = p.aimPitch || 0;
      rSh = [-1.55 - pitch, 0, 0]; rF = [0, 0, 0]; brushRot = [3.0, 0, 0];
      lSh = [-1.2 - pitch, -0.5, 0.3]; lF = [-0.6, 0, 0];
      if (p.paintHold) brushRot = [3.0 + Math.sin(phase * 3) * 0.15, Math.cos(phase * 3) * 0.15, 0];
    }

    hips.position.y = lerp(hips.position.y, hipY, k);
    A(torso, bodyX, 0, bodyZ, k);
    A(armL.sh, ...lSh, k); A(armR.sh, ...rSh, k);
    A(armL.fore, ...lF, k); A(armR.fore, ...rF, k);
    A(legL.hip, ...lHip, k); A(legR.hip, ...rHip, k);
    A(legL.knee, ...lK, k); A(legR.knee, ...rK, k);
    if (brushMode === 'hand') A(brush, ...brushRot, k);
    // Scarf tail flutters with speed
    cur.lean = damp(cur.lean, Math.min(1.3, sp * 0.08 + (st === 'ride' ? 0.9 : 0) + (st === 'glide' ? 0.6 : 0)), 5, dt);
    tail.rotation.x = cur.lean + Math.sin(phase * 2.3) * 0.12 * (0.3 + cur.lean);
    cape.rotation.x = cur.lean * 0.75 + Math.sin(phase * 1.7) * 0.05 * (0.4 + cur.lean);
  }

  function setBrushColor(hex) {
    brushParts.tipMat.color.setHex(hex);
    brushParts.tipMat.emissive.setHex(hex);
  }

  function setHurt(v) {
    root.traverse((m) => {
      if (m.isMesh && m.material.emissive && m.material !== brushParts.tipMat) {
        m.material.emissive.setRGB(v, v * 0.2, v * 0.2);
      }
    });
  }

  compactCharacter(root, new Set([tail, cape, glider]), brush);

  return {
    group: root, brush, brushTip: brushParts.tipPoint, brushBase: brushParts.basePoint, animate, setBrushColor, setHurt,
    hand: armR.hand, head: headG, glider,
  };
}

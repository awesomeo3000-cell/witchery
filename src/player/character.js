// Procedurally built & animated hero (also used for friends and NPCs).
import * as THREE from 'three';
import { lerp, damp } from '../core/math.js';
import { softLit } from '../world/props.js';

let gradientMap = null;
function toon(color, extra = {}) {
  if (!gradientMap) {
    const data = new Uint8Array([120, 185, 255]);
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return softLit(new THREE.MeshToonMaterial({ color, gradientMap, ...extra }), { rim: 0.5 });
}

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);
  m.castShadow = true;
  return m;
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
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.1, 6), toon(0x7a4a2a));
  handle.position.y = 0.5;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), toon(0x5a3a1a));
  knob.position.y = -0.55;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.22, 8), toon(0xd8b050));
  ferrule.position.y = 1.62;
  const tipMat = toon(colorHex, { emissive: colorHex, emissiveIntensity: 0.35 });
  const bristleGeo = new THREE.SphereGeometry(0.17, 10, 8);
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
  const body = capsule(0.26, 0.42, toon(tunicC));
  body.position.y = 0.33;
  torso.add(body);
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.75, 10, 1, true), toon(hoodC, { side: THREE.DoubleSide }));
  cloak.position.set(0, 0.35, -0.04);
  cloak.castShadow = true;
  torso.add(cloak);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.05, 5, 12), toon(0x6a4a2a));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.12;
  torso.add(belt);

  const headG = new THREE.Group();
  headG.position.y = 0.86;
  torso.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), toon(skinC));
  head.castShadow = true;
  headG.add(head);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(hoodC));
  hood.rotation.x = -0.45;
  hood.position.set(0, 0.04, -0.05);
  hood.castShadow = true;
  headG.add(hood);
  const hoodTip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), toon(hoodC));
  hoodTip.position.set(0, 0.2, -0.32);
  hoodTip.rotation.x = -1.2;
  headG.add(hoodTip);
  // Pointed ears poking out of the hood, and a fringe of hair
  const skinMat = toon(skinC);
  for (const sd of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 5), skinMat);
    ear.position.set(sd * 0.29, 0.02, -0.02);
    ear.rotation.z = -sd * 1.25;
    ear.rotation.y = sd * 0.3;
    headG.add(ear);
  }
  const hairMat = toon(look.hair ?? 0xd8a860);
  for (let i = 0; i < 5; i++) {
    const lock = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), hairMat);
    lock.position.set((i - 2) * 0.07, 0.15, 0.24 - Math.abs(i - 2) * 0.02);
    lock.rotation.x = Math.PI + 0.5;
    lock.rotation.z = (i - 2) * 0.15;
    headG.add(lock);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a24 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat);
    eye.position.set(s * 0.09, 0.02, 0.25);
    headG.add(eye);
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
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 6, 12), toon(scarfC));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.66;
  torso.add(scarf);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.05), toon(scarfC));
  tail.geometry.translate(0, -0.3, 0);
  tail.position.set(0.1, 0.66, -0.2);
  tail.castShadow = true;
  torso.add(tail);

  // Arms
  const mkArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.34, 0.6, 0);
    const upper = capsule(0.075, 0.28, toon(tunicC));
    upper.position.y = -0.2;
    sh.add(upper);
    const fore = new THREE.Group();
    fore.position.y = -0.38;
    sh.add(fore);
    const lower = capsule(0.07, 0.24, toon(skinC));
    lower.position.y = -0.16;
    fore.add(lower);
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
    const thigh = capsule(0.09, 0.3, toon(0x4a3a2a));
    thigh.position.y = -0.2;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    const shin = capsule(0.085, 0.26, toon(0x4a3a2a));
    shin.position.y = -0.18;
    knee.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.28), toon(0x3a2418));
    boot.position.set(0, -0.37, 0.05);
    boot.castShadow = true;
    knee.add(boot);
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

  return {
    group: root, brush, brushTip: brushParts.tipPoint, brushBase: brushParts.basePoint, animate, setBrushColor, setHurt,
    hand: armR.hand, head: headG, glider,
  };
}

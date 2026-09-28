// Draw-call helper: bake a static group's meshes into one mesh per material. Meshes marked with
// userData.keep (animated or recoloured on their own) are left alone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  const drop = [];
  group.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || m.userData.keep || Array.isArray(m.material)) return;
    for (let p = m.parent; p && p !== group; p = p.parent) if (p.userData.keep) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const list = byMat.get(m.material) || [];
    list.push({ g, m });
    byMat.set(m.material, list);
  });
  let saved = 0;
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    // Only merge geometries that share the same attribute set
    const keys = (g) => Object.keys(g.attributes).sort().join();
    const groups = new Map();
    for (const it of list) { const k = keys(it.g); groups.set(k, [...(groups.get(k) || []), it]); }
    for (const items of groups.values()) {
      if (items.length < 2) continue;
      const merged = mergeGeometries(items.map((it) => it.g));
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = items.some((it) => it.m.castShadow);
      mesh.receiveShadow = items.some((it) => it.m.receiveShadow);
      group.add(mesh);
      for (const it of items) drop.push(it.m);
      saved += items.length - 1;
    }
  }
  for (const m of drop) m.parent.remove(m);
  return saved;
}

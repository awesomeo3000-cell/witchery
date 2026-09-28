// Static + dynamic collision world: axis-aligned boxes, vertical cylinders and the terrain.
import * as THREE from 'three';
import { inDungeonY } from '../core/ctx.js';

const CELL = 16;
let nextId = 1;

export class Collision {
  constructor(terrain) {
    this.terrain = terrain;
    this.grid = new Map();
    this.dynamic = []; // boxes that move or toggle: always tested
    this.all = [];
    this.water = []; // extra water volumes (dungeon pools): {min,max,level,cold}
    this.climbables = []; // vine surfaces: {min,max,normal}
  }

  _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

  _insert(obj) {
    const x0 = Math.floor(obj.min.x / CELL), x1 = Math.floor(obj.max.x / CELL);
    const z0 = Math.floor(obj.min.z / CELL), z1 = Math.floor(obj.max.z / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this._key(ix, iz);
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(obj);
      }
    }
  }

  // Box from centre + size. opts: {tags:[], dynamic, data}
  addBox(cx, cy, cz, sx, sy, sz, opts = {}) {
    const b = {
      id: nextId++,
      type: 'box',
      min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
      max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
      tags: new Set(opts.tags || []),
      active: true,
      data: opts.data || null,
    };
    if (opts.dynamic) this.dynamic.push(b);
    else this._insert(b);
    this.all.push(b);
    return b;
  }

  addCylinder(x, z, r, y0, y1, opts = {}) {
    const c = {
      id: nextId++,
      type: 'cyl',
      x, z, r,
      min: new THREE.Vector3(x - r, y0, z - r),
      max: new THREE.Vector3(x + r, y1, z + r),
      tags: new Set(opts.tags || []),
      active: true,
      data: opts.data || null,
    };
    if (opts.dynamic) this.dynamic.push(c);
    else this._insert(c);
    this.all.push(c);
    return c;
  }

  removeDynamic(obj) {
    const i = this.dynamic.indexOf(obj);
    if (i >= 0) this.dynamic.splice(i, 1);
    obj.active = false;
  }

  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const arr = this.grid.get(this._key(ix, iz));
        if (!arr) continue;
        for (const o of arr) {
          if (!o.active || seen.has(o.id)) continue;
          seen.add(o.id);
          out.push(o);
        }
      }
    }
    for (const o of this.dynamic) if (o.active) out.push(o);
    return out;
  }

  terrainHeight(x, y, z) {
    if (inDungeonY(y)) return -Infinity;
    return this.terrain.heightAt(x, z);
  }

  // Highest walkable surface under (x,z) that is at or below maxY.
  groundAt(x, z, r, maxY) {
    let best = this.terrainHeight(x, maxY, z);
    let bestObj = null;
    const list = this.query(x - r, z - r, x + r, z + r, this._q1 || (this._q1 = []));
    for (const o of list) {
      if (o.max.y > maxY || o.max.y < best) continue;
      if (o.tags.has('nofloor')) continue;
      if (o.type === 'box') {
        const inset = r * 0.5;
        if (x < o.min.x - inset || x > o.max.x + inset || z < o.min.z - inset || z > o.max.z + inset) continue;
      } else {
        if (Math.hypot(x - o.x, z - o.z) > o.r + r * 0.5) continue;
      }
      best = o.max.y;
      bestObj = o;
    }
    return { y: best, obj: bestObj };
  }

  // Push a vertical capsule (feet at pos.y) out of solid objects horizontally.
  // Returns the list of objects touched (for wall/climb checks).
  resolveHorizontal(pos, r, h, step, touched = []) {
    touched.length = 0;
    const list = this.query(pos.x - r - 1, pos.z - r - 1, pos.x + r + 1, pos.z + r + 1, this._q2 || (this._q2 = []));
    for (const o of list) {
      if (o.tags.has('nowall')) continue;
      if (o.max.y <= pos.y + step || o.min.y >= pos.y + h) continue;
      if (o.type === 'box') {
        const cx = Math.max(o.min.x, Math.min(pos.x, o.max.x));
        const cz = Math.max(o.min.z, Math.min(pos.z, o.max.z));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
          touched.push({ obj: o, nx: dx / d, nz: dz / d });
        } else {
          // Centre inside the box: push out along the shallowest axis.
          const px1 = pos.x - o.min.x, px2 = o.max.x - pos.x;
          const pz1 = pos.z - o.min.z, pz2 = o.max.z - pos.z;
          const m = Math.min(px1, px2, pz1, pz2);
          if (m === px1) { pos.x = o.min.x - r; touched.push({ obj: o, nx: -1, nz: 0 }); }
          else if (m === px2) { pos.x = o.max.x + r; touched.push({ obj: o, nx: 1, nz: 0 }); }
          else if (m === pz1) { pos.z = o.min.z - r; touched.push({ obj: o, nx: 0, nz: -1 }); }
          else { pos.z = o.max.z + r; touched.push({ obj: o, nx: 0, nz: 1 }); }
        }
      } else {
        const dx = pos.x - o.x, dz = pos.z - o.z;
        const d = Math.hypot(dx, dz);
        const rr = r + o.r;
        if (d >= rr || d < 1e-6) continue;
        pos.x = o.x + (dx / d) * rr;
        pos.z = o.z + (dz / d) * rr;
        touched.push({ obj: o, nx: dx / d, nz: dz / d });
      }
    }
    return touched;
  }

  // Lowest ceiling above head.
  ceilingAt(x, z, r, headY) {
    let best = Infinity;
    const list = this.query(x - r, z - r, x + r, z + r, this._q3 || (this._q3 = []));
    for (const o of list) {
      if (o.min.y < headY - 0.8 || o.min.y > best) continue;
      if (o.type === 'box') {
        if (x < o.min.x || x > o.max.x || z < o.min.z || z > o.max.z) continue;
      } else if (Math.hypot(x - o.x, z - o.z) > o.r) continue;
      best = o.min.y;
    }
    return best;
  }

  waterAt(x, y, z) {
    for (const w of this.water) {
      if (!w.active) continue;
      if (x > w.min.x && x < w.max.x && z > w.min.z && z < w.max.z && y < w.level + 0.5 && y > w.min.y) return w;
    }
    if (!inDungeonY(y) && Math.abs(x) < 3000 && Math.abs(z) < 3000) return { level: 0, ocean: true };
    return null;
  }

  // Ray vs world. Returns {dist, point, normal, obj, kind:'box'|'cyl'|'terrain'|'water'} or null.
  raycast(origin, dir, maxDist, opts = {}) {
    let best = null;
    const step = CELL * 0.75;
    const seen = new Set();
    const tmp = [];
    const checkObj = (o) => {
      if (!o.active || seen.has(o.id)) return;
      seen.add(o.id);
      if (opts.ignoreTag && o.tags.has(opts.ignoreTag)) return;
      if (o.tags.has('noray')) return;
      const hit = o.type === 'box' ? rayBox(origin, dir, o.min, o.max) : rayCyl(origin, dir, o);
      if (hit && hit.t <= maxDist && (!best || hit.t < best.dist)) {
        best = { dist: hit.t, normal: hit.n, obj: o, kind: o.type };
      }
    };
    for (let t = 0; t <= maxDist + step; t += step) {
      const px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
      this.query(px - step, pz - step, px + step, pz + step, tmp);
      for (const o of tmp) checkObj(o);
      if (best && best.dist < t - step) break;
    }
    // Terrain (march then bisect)
    if (!opts.noTerrain) {
      const lim = best ? best.dist : maxDist;
      let prevT = 0;
      let prevAbove = true;
      const tStep = 0.8;
      for (let t = 0; t <= lim; t += tStep) {
        const y = origin.y + dir.y * t;
        const th = this.terrainHeight(origin.x + dir.x * t, y, origin.z + dir.z * t);
        const above = y > th;
        if (!above && prevAbove && t > 0) {
          let a = prevT, b = t;
          for (let k = 0; k < 8; k++) {
            const m = (a + b) / 2;
            const ym = origin.y + dir.y * m;
            if (ym > this.terrainHeight(origin.x + dir.x * m, ym, origin.z + dir.z * m)) a = m; else b = m;
          }
          const px = origin.x + dir.x * b, pz = origin.z + dir.z * b;
          best = { dist: b, normal: this.terrain.normalAt(px, pz), obj: null, kind: 'terrain' };
          break;
        }
        prevAbove = above;
        prevT = t;
      }
    }
    // Water surfaces
    if (opts.water && dir.y < 0) {
      const lim = best ? best.dist : maxDist;
      const levels = [];
      if (!inDungeonY(origin.y)) levels.push({ level: 0, vol: null });
      for (const w of this.water) if (w.active) levels.push({ level: w.level, vol: w });
      for (const L of levels) {
        const t = (L.level - origin.y) / dir.y;
        if (t < 0 || t > lim) continue;
        const px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
        if (L.vol && !(px > L.vol.min.x && px < L.vol.max.x && pz > L.vol.min.z && pz < L.vol.max.z)) continue;
        if (!L.vol && this.terrain.heightAt(px, pz) > -0.2) continue;
        if (!best || t < best.dist) best = { dist: t, normal: new THREE.Vector3(0, 1, 0), obj: L.vol, kind: 'water' };
      }
    }
    if (best) best.point = origin.clone().addScaledVector(dir, best.dist);
    return best;
  }

  climbableAt(pos, r, h) {
    for (const c of this.climbables) {
      if (!c.active) continue;
      if (pos.y + h * 0.5 < c.min.y - 0.2 || pos.y > c.max.y + 0.3) continue;
      if (pos.x + r < c.min.x - 0.25 || pos.x - r > c.max.x + 0.25) continue;
      if (pos.z + r < c.min.z - 0.25 || pos.z - r > c.max.z + 0.25) continue;
      return c;
    }
    return null;
  }
}

function rayBox(o, d, min, max) {
  let tmin = -Infinity, tmax = Infinity, nAxis = -1, nSign = 0;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
    const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    const lo = a === 0 ? min.x : a === 1 ? min.y : min.z;
    const hi = a === 0 ? max.x : a === 1 ? max.y : max.z;
    if (Math.abs(da) < 1e-9) {
      if (oa < lo || oa > hi) return null;
      continue;
    }
    let t1 = (lo - oa) / da, t2 = (hi - oa) / da, s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = a; nSign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  if (tmin < 0) return null; // origin inside
  const n = new THREE.Vector3();
  if (nAxis === 0) n.x = nSign; else if (nAxis === 1) n.y = nSign; else n.z = nSign;
  return { t: tmin, n };
}

function rayCyl(o, d, c) {
  const ox = o.x - c.x, oz = o.z - c.z;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = 2 * (ox * d.x + oz * d.z);
  const cc = ox * ox + oz * oz - c.r * c.r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return null;
  const y = o.y + d.y * t;
  if (y < c.min.y || y > c.max.y) return null;
  const n = new THREE.Vector3(ox + d.x * t, 0, oz + d.z * t).normalize();
  return { t, n };
}


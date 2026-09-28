import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Collision } from '../src/world/collision.js';
import { VILLAGE, TRIALS, LAKE } from '../src/world/layout.js';
import { DUNGEON_Y } from '../src/core/ctx.js';

const terrain = new Terrain(7);
const col = new Collision(terrain);

test('terrain is deterministic for a seed', () => {
  const other = new Terrain(7);
  for (const [x, z] of [[0, 0], [123, -45], [-300, 250]]) assert.equal(other.heightAt(x, z), terrain.heightAt(x, z));
});

test('village and trial shrines sit on flat, dry ground', () => {
  const spots = [VILLAGE, ...TRIALS];
  for (const s of spots) {
    const h0 = terrain.heightAt(s.x, s.z);
    assert.ok(h0 > 1, `site at ${s.x},${s.z} is above sea level`);
    for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
      assert.ok(Math.abs(terrain.heightAt(s.x + dx, s.z + dz) - h0) < 1.5, `site at ${s.x},${s.z} is flat`);
    }
  }
});

test('the lake basin is below the water line', () => {
  assert.ok(terrain.heightAt(LAKE.x, LAKE.z) < -3);
  assert.ok(col.waterAt(LAKE.x, -1, LAKE.z));
});

test('grass is cleared from the village plaza', () => {
  assert.ok(terrain.grassAt(VILLAGE.x, VILLAGE.z) < 0.05);
});

test('groundAt finds boxes above the terrain', () => {
  const x = 500, z = 500;
  const h = terrain.heightAt(x, z);
  const box = col.addBox(x, h + 5, z, 4, 2, 4);
  assert.equal(col.groundAt(x, z, 0.4, h + 10).y, h + 6);
  assert.equal(col.groundAt(x, z, 0.4, h + 10).obj, box);
  // Below the box top we only see terrain
  assert.equal(col.groundAt(x, z, 0.4, h + 3).y, h);
});

test('raycast hits a cylinder in front of the ray', () => {
  const x = -500, z = -500;
  const h = terrain.heightAt(x, z);
  col.addCylinder(x, z, 1, h, h + 10);
  const origin = new THREE.Vector3(x - 10, h + 3, z);
  const hit = col.raycast(origin, new THREE.Vector3(1, 0, 0), 20);
  assert.ok(hit);
  assert.equal(hit.kind, 'cyl');
  assert.ok(Math.abs(hit.dist - 9) < 0.05);
});

test('dungeons ignore the overworld terrain', () => {
  assert.equal(col.terrainHeight(0, DUNGEON_Y + 5, 0), -Infinity);
});

test('puzzle sites are deterministic, dry, flat and spread out', async () => {
  const { puzzleSites } = await import('../src/world/puzzles.js');
  const a = puzzleSites(terrain, 6, 4242);
  const b = puzzleSites(terrain, 4, 777, a);
  assert.equal(a.length, 6);
  assert.equal(b.length, 4);
  assert.deepEqual(puzzleSites(terrain, 6, 4242), a);
  const all = [...a, ...b];
  for (const s of all) {
    assert.ok(s.y > 3, 'above water');
    assert.ok(Math.hypot(s.x - VILLAGE.x, s.z - VILLAGE.z) > VILLAGE.r + 20, 'outside the village');
    for (const o of all) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.z - s.z) >= 110, 'spread out');
  }
});

test('twelve lore tablets fit around the island puzzles', async () => {
  const { puzzleSites } = await import('../src/world/puzzles.js');
  const { TABLETS } = await import('../src/world/tablets.js');
  const a = puzzleSites(terrain, 6, 4242);
  const b = puzzleSites(terrain, 4, 777, a);
  const c = puzzleSites(terrain, TABLETS.length, 1313, [...a, ...b]);
  assert.equal(c.length, TABLETS.length);
  for (const t of TABLETS) assert.ok(t.title && t.text.length > 40);
});

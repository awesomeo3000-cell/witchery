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

test('fish schools sit in shallow water, some in the lake, spread apart', async () => {
  const { fishSites, fishSpot, SCHOOLS } = await import('../src/world/fishing.js');
  const sites = fishSites(terrain);
  assert.equal(sites.length, SCHOOLS);
  assert.ok(sites.filter((s) => s.lake).length >= 2, 'some schools live in the lake');
  for (const s of sites) assert.ok(fishSpot(terrain.heightAt(s.x, s.z)));
  for (const a of sites) for (const b of sites) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 50);
  assert.deepEqual(fishSites(terrain), sites, 'deterministic');
});

test('shrine sites keep clear of puzzles and tablets', async () => {
  const { puzzleSites } = await import('../src/world/puzzles.js');
  const totems = puzzleSites(terrain, 6, 4242);
  const rings = puzzleSites(terrain, 4, 777, totems);
  const tablets = puzzleSites(terrain, 12, 1313, [...totems, ...rings]);
  const shrines = puzzleSites(terrain, 3, 9191, [...totems, ...rings, ...tablets]);
  assert.equal(shrines.length, 3);
  for (const s of shrines) for (const q of [...totems, ...rings, ...tablets]) assert.ok(Math.hypot(s.x - q.x, s.z - q.z) > 100);
});

test('Brushbuck herds graze on flat, dry meadow away from the village', async () => {
  const { herdSites } = await import('../src/world/steeds.js');
  const sites = herdSites(terrain);
  assert.ok(sites.length >= 2, `found ${sites.length} herds`);
  for (const s of sites) {
    assert.ok(s.y > 4 && terrain.normalAt(s.x, s.z).y > 0.9);
    assert.ok(Math.hypot(s.x - VILLAGE.x, s.z - VILLAGE.z) > VILLAGE.r + 20);
  }
});

test('peaks are cold, the volcano top is hot, the village is mild', async () => {
  const { climateAt, protectedFrom } = await import('../src/world/climate.js');
  const { VOLCANO } = await import('../src/world/layout.js');
  assert.equal(climateAt(terrain, VILLAGE.x, terrain.heightAt(VILLAGE.x, VILLAGE.z), VILLAGE.z), 0);
  assert.equal(climateAt(terrain, VOLCANO.x + 60, 120, VOLCANO.z), 1);
  // Find a high frost peak
  let cold = 0;
  for (let x = -600; x <= 600 && !cold; x += 20) for (let z = -600; z <= 0 && !cold; z += 20) {
    const h = terrain.heightAt(x, z);
    if (climateAt(terrain, x, h, z) < 0) cold = 1;
  }
  assert.equal(cold, 1, 'some frost peak is freezing');
  assert.equal(protectedFrom(-1, { power: 30, ink: 0 }), true);
  assert.equal(protectedFrom(-1, { power: 0, ink: 30 }), false);
  assert.equal(protectedFrom(1, { power: 0, ink: 30 }), true);
});

test('memory spots sit on dry land with a view', async () => {
  const { MEMORIES } = await import('../src/world/memories.js');
  assert.equal(MEMORIES.length, 8);
  for (const m of MEMORIES) {
    let [x, z] = m.at;
    for (let k = 0; k < 30 && terrain.heightAt(x, z) < 1.5; k++) { x *= 0.95; z *= 0.95; }
    assert.ok(terrain.heightAt(x, z) >= 1.5, m.title);
    assert.ok(Math.hypot(m.look[0] - x, m.look[2] - z) > 60, `${m.title} looks at something distant`);
  }
});

test('Painter\'s Towers stand on dry ground between the village and each trial', async () => {
  const { towerSites } = await import('../src/world/towers.js');
  const sites = towerSites(terrain);
  assert.equal(sites.length, 4);
  sites.forEach((s, i) => {
    assert.ok(s.y >= 3, `${s.name} is dry`);
    assert.ok(Math.hypot(s.x - VILLAGE.x, s.z - VILLAGE.z) > VILLAGE.r, `${s.name} is outside the village`);
    assert.ok(Math.hypot(s.x - TRIALS[i].x, s.z - TRIALS[i].z) > 60, `${s.name} is away from its trial`);
  });
});

test('bounty postings are shared, varied and always include a job that isn\'t a fight', async () => {
  const { pickJobs, postIndex, POST_MS, JOBS } = await import('../src/world/bounties.js');
  assert.equal(postIndex(POST_MS * 5 + 10), 5);
  const seen = new Set();
  for (let p = 0; p < 200; p++) {
    const jobs = pickJobs(p);
    assert.equal(jobs.length, 3);
    assert.equal(new Set(jobs.map((j) => j.id)).size, 3, 'no repeats in a posting');
    assert.ok(jobs.some((j) => j.kind !== 'foe'), 'one peaceful job');
    assert.deepEqual(pickJobs(p), jobs, 'same posting for everyone');
    for (const j of jobs) seen.add(j.id);
  }
  assert.equal(seen.size, JOBS.length, 'every job turns up');
});

test('the cottage plot sits on flat village ground with room for its trophy garden', async () => {
  const { HOME_AT, TROPHIES, REST } = await import('../src/world/home.js').catch(() => ({}));
  if (!HOME_AT) return; // needs browser-only model code
  const x = VILLAGE.x + HOME_AT.dx, z = VILLAGE.z + HOME_AT.dz;
  assert.ok(Math.hypot(HOME_AT.dx, HOME_AT.dz) < VILLAGE.r - 20, 'inside the village fence');
  for (const [dx, dz] of [[-4, -4], [4, -4], [-3, 11], [3, 11]]) assert.ok(Math.abs(terrain.heightAt(x + dx, z + dz) - terrain.heightAt(x, z)) < 0.6, 'flat plot');
  assert.equal(new Set(TROPHIES.map((t) => t.flag)).size, TROPHIES.length);
  for (const r of REST) assert.ok(r.t >= 0 && r.t < 1);
});

test('treasure spots are dry, reachable and come with a sensible hint', async () => {
  const { treasureSpot, hintFor, dirWord } = await import('../src/world/treasure.js');
  assert.equal(dirWord(0, -10), 'north');
  assert.equal(dirWord(10, 0), 'east');
  assert.equal(dirWord(-7, 7), 'south-west');
  for (let seed = 1; seed < 40; seed++) {
    const s = treasureSpot(terrain, seed);
    const h = terrain.heightAt(s.x, s.z);
    assert.ok(h >= 3, 'dry');
    assert.ok(Math.hypot(s.x - VILLAGE.x, s.z - VILLAGE.z) > VILLAGE.r, 'outside the village');
    assert.match(hintFor(s.x, s.z), /(close to|of) [A-Z]/);
  }
});

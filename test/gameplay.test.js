import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, COLORS, COUNTER } from '../src/core/ctx.js';
import { EnemyManager, TYPES, ELEMENTS } from '../src/enemies/enemies.js';
import { applyStats, shardCount, upgradeCount } from '../src/core/progress.js';
import { QUESTS } from '../src/world/quests.js';
import { ACTIONS, AccessUI, applyBindings, keyLabel, physKey } from '../src/ui/access.js';

const computeHit = (e, hit) => EnemyManager.prototype.computeHit.call({}, e, hit);
const enemy = (type, extra = {}) => ({ type, alive: true, variant: null, pos: { y: 0 }, height: TYPES[type]?.height ?? 2, status: { frozen: 0, stun: 0, rooted: 0 }, state: 'chase', ...extra });

test('every colour has a counter element', () => {
  for (const c of COLORS) assert.ok(ELEMENTS.includes(COUNTER[c.element]));
});

test('elemental variants are immune to their own element and weak to the opposite', () => {
  assert.equal(computeHit(enemy('inkling', { variant: 'fire' }), { dmg: 10, element: 'fire' }).blocked, true);
  assert.equal(computeHit(enemy('inkling', { variant: 'fire' }), { dmg: 10, element: 'ice' }).dmg, 20);
  assert.equal(computeHit(enemy('inkling', { variant: 'ice' }), { dmg: 10, element: 'fire' }).dmg, 20);
});

test('frozen enemies shatter under melee', () => {
  const r = computeHit(enemy('inkling', { status: { frozen: 2, stun: 0, rooted: 0 } }), { dmg: 10, element: 'vine', source: 'melee' });
  assert.equal(r.dmg, 20);
  assert.equal(r.shatter, true);
});

test('Blot Giant eye is a weak spot', () => {
  const e = enemy('blotgiant', { height: 9.5 });
  const low = computeHit(e, { dmg: 10, element: 'fire', hy: 1 });
  const high = computeHit(e, { dmg: 10, element: 'fire', hy: 9 });
  assert.equal(low.dmg, 10);
  assert.equal(high.dmg, 25);
  assert.equal(high.weak, true);
  e.state = 'sleep';
  assert.ok(computeHit(e, { dmg: 10, element: 'fire', hy: 1 }).dmg > 10);
});

test('Stone Sentinel only takes damage on its back crystal', () => {
  const e = enemy('sentinel', { height: 6 });
  assert.equal(computeHit(e, { dmg: 10, element: 'fire', hy: 1 }).blocked, true);
  assert.equal(computeHit(e, { dmg: 10, element: 'fire', hy: 5.5 }).dmg, 16);
});

test('trial bosses need their counter colour', () => {
  assert.equal(computeHit(enemy('frostmaw', { armor: 50 }), { dmg: 10, element: 'vine' }).blocked, true);
  assert.ok(computeHit(enemy('frostmaw', { armor: 50 }), { dmg: 10, element: 'fire' }).armor > 0);
  assert.equal(computeHit(enemy('magmaw'), { dmg: 10, element: 'fire' }).blocked, true);
  assert.ok(computeHit(enemy('magmaw'), { dmg: 10, element: 'ice' }).meter > 0);
  assert.ok(computeHit(enemy('shellback'), { dmg: 10, element: 'bounce' }).meter > 0);
  assert.ok(computeHit(enemy('galewing'), { dmg: 10, element: 'vine' }).meter > 0);
});

test('Hueless King shield takes only the opposite colour', () => {
  for (let s = 0; s < 4; s++) {
    const e = enemy('hueless', { shield: s, shieldHp: 3 });
    const need = COUNTER[ELEMENTS[s]];
    for (const el of ELEMENTS) {
      const r = computeHit(e, { dmg: 10, element: el });
      if (el === need) assert.equal(r.shieldHit, true);
      else assert.equal(r.blocked, true);
    }
  }
});

test('stats grow with shards and upgrades', () => {
  G.flags = {};
  G.player = { maxHp: 0, hp: 0, maxStamina: 0, stamina: 0 };
  applyStats(true);
  assert.equal(G.player.maxHp, 12);
  assert.equal(G.player.maxStamina, 100);
  G.flags = { trial_ember: true, trial_frost: true, upg_heart_1: true, upg_heart_tilly: true, upg_stamina_mira: true };
  applyStats(false);
  assert.equal(shardCount(), 2);
  assert.equal(upgradeCount('heart'), 2);
  assert.equal(G.player.maxHp, 12 + 4 + 4);
  assert.equal(G.player.maxStamina, 125);
  assert.equal(G.player.hp, G.player.maxHp, 'gaining a heart refills health');
});

test('quests report readiness from shared flags and the satchel', () => {
  const q = Object.fromEntries(QUESTS.map((x) => [x.id, x]));
  G.flags = {};
  G.forage = { inv: { pepper: 3, lily: 1 } };
  assert.equal(q.mira.ready(), false);
  G.forage.inv.lily = 2;
  assert.equal(q.mira.ready(), true);
  q.mira.turnIn();
  assert.deepEqual(G.forage.inv, { pepper: 0, lily: 0 });
  assert.equal(q.bram.ready(), false);
  G.flags.slain_blotgiant = true;
  G.flags.slain_sentinel = true;
  assert.equal(q.bram.ready(), true);
  assert.equal(q.ochre.ready(), false);
  for (let i = 0; i < 4; i++) G.flags[`q_statue_${i}`] = true;
  assert.equal(q.ochre.ready(), true);
  for (const x of QUESTS) assert.ok(x.reward.startsWith('upg_') || x.reward.startsWith('charm_'));
});

test('key rebinding swaps conflicting keys and unbinds freed defaults', () => {
  G.settings.binds = {};
  G.input = { map: {}, toggleCodes: new Set(), keys: new Set() };
  G.hud = null;
  const ui = Object.create(AccessUI.prototype);
  ui.save = () => {};
  ui.rebind('interact', 'KeyT');
  assert.equal(physKey('KeyF'), 'KeyT');
  assert.equal(G.input.map.KeyT, 'KeyF');
  assert.equal(G.input.map.KeyF, '', 'the old key no longer interacts');
  ui.rebind('interact', 'KeyE'); // E belongs to "next colour"
  assert.equal(physKey('KeyF'), 'KeyE');
  assert.equal(physKey('KeyE'), 'KeyT', 'the displaced action takes the old key');
  ui.rebind('interact', 'KeyF');
  ui.rebind('cycle', 'KeyE');
  assert.deepEqual(G.settings.binds, {});
  applyBindings();
  assert.deepEqual(G.input.map, {});
  G.settings.toggleSprint = true;
  applyBindings();
  assert.ok(G.input.toggleCodes.has('ShiftLeft'));
  assert.equal(new Set(ACTIONS.map((a) => a.code)).size, ACTIONS.length, 'default keys are unique');
  assert.equal(keyLabel('KeyQ'), 'Q');
  assert.equal(keyLabel('ShiftLeft'), 'Shift');
  assert.equal(keyLabel('Digit3'), '3');
});

test('race times format as m:ss.s', async () => {
  const { fmtTime } = await import('../src/world/races.js');
  assert.equal(fmtTime(0), '0:00.0');
  assert.equal(fmtTime(9.46), '0:09.5');
  assert.equal(fmtTime(83.2), '1:23.2');
});

test('brush upgrades cost pigment and scale stats', async () => {
  const { purchase, brushStats, UPGRADES } = await import('../src/world/shop.js');
  const w = { pigment: 50, upg: {} };
  assert.equal(purchase(w, 'bristle'), true);
  assert.equal(w.pigment, 20);
  assert.equal(w.upg.bristle, 1);
  assert.equal(purchase(w, 'bristle'), false, 'cannot afford level 2');
  w.pigment = 1000;
  assert.equal(purchase(w, 'bristle'), true);
  assert.equal(purchase(w, 'bristle'), true);
  assert.equal(purchase(w, 'bristle'), false, 'maxed out');
  assert.equal(w.upg.bristle, UPGRADES[0].costs.length);
  const s = brushStats({ bristle: 3, reservoir: 2, lacquer: 3 });
  assert.ok(Math.abs(s.damage - 1.36) < 1e-9);
  assert.equal(s.inkRegen, 1.5);
  assert.ok(Math.abs(s.flightCost - 0.55) < 1e-9);
  assert.deepEqual(brushStats(), { damage: 1, inkRegen: 1, flightCost: 1 });
});

test('map fog reveals around a point and survives a save round trip', async () => {
  const { MapFog, FOG_N } = await import('../src/ui/mapfog.js');
  const f = new MapFog();
  const start = f.explored();
  assert.ok(start > 0 && start < 0.1, 'the village starts revealed');
  f.reveal(500, -500, 150);
  assert.ok(f.explored() > start);
  const g = new MapFog();
  g.cells.fill(0);
  g.load(f.serialize());
  assert.deepEqual([...g.cells], [...f.cells]);
  assert.equal(g.cells.length, FOG_N * FOG_N);
});

test('adventure log summarises progress', async () => {
  const { adventureStats } = await import('../src/ui/advlog.js');
  G.flags = { trial_ember: true, trial_frost: true, q_mira_done: true, slain_sentinel: true };
  G.player = { pigment: 12, upg: { bristle: 1 } };
  const s = Object.fromEntries(adventureStats().map((x) => [x.label, x.value]));
  assert.equal(s['Prism Shards'], '2 / 4');
  assert.equal(s['Villager quests'], '1 / 4');
  assert.equal(s['Field giants felled'], '1 / 2');
  assert.equal(s.Pigment, '12');
  assert.equal(s['Brush (bristle · ink · wind)'], '1 · 0 · 0');
});

test('honours unlock from checks and counted events, and round-trip a save', async () => {
  const { Honours, HONOURS } = await import('../src/ui/honours.js');
  G.flags = { trial_ember: true };
  G.player = { state: 'ground', pigment: 0, upg: {} };
  G.puzzles = null; G.fog = null;
  G.audio = { play() {} }; G.hud = { toast() {} };
  const h = new Honours();
  h.update(1);
  assert.ok(h.got.has('shard'));
  assert.ok(!h.got.has('shards'));
  for (let i = 0; i < 4; i++) h.event('flurry');
  assert.ok(!h.got.has('flurry'));
  h.event('flurry');
  assert.ok(h.got.has('flurry'));
  const g = new Honours();
  g.load(h.serialize());
  assert.deepEqual([...g.got].sort(), [...h.got].sort());
  assert.equal(new Set(HONOURS.map((x) => x.id)).size, HONOURS.length, 'ids are unique');
});

test('wardrobe cosmetics unlock with honours and apply from a sync code', async () => {
  const { TRAILS, GLIDERS, unlocked, applyCosmetics } = await import('../src/ui/wardrobe.js');
  assert.ok(unlocked(TRAILS[0], 0));
  assert.ok(!unlocked(TRAILS.find((t) => t.id === 'star'), 9));
  assert.ok(unlocked(TRAILS.find((t) => t.id === 'star'), 10));
  const ribbon = {};
  const char = { glider: { material: {} } };
  applyCosmetics(char, ribbon, 'rainbow|rose');
  assert.equal(ribbon.style, 1);
  assert.equal(char.glider.material.color.getHex(), GLIDERS.find((g) => g.id === 'rose').tint);
  applyCosmetics(char, ribbon, undefined);
  assert.equal(ribbon.style, 0);
});

test('target gallery scoring and payout', async () => {
  const { scoreFor, payout } = await import('../src/world/targets.js');
  assert.equal(scoreFor(2, 2), 3);
  assert.equal(scoreFor(2, 0), 1);
  assert.equal(payout(0), 0);
  assert.equal(payout(17), 8);
});

test('the merchant visits every easel in turn on a shared clock', async () => {
  const { stopIndex, STAY_MS, WARES } = await import('../src/world/merchant.js');
  const { WAYPOINTS } = await import('../src/world/layout.js');
  const seen = new Set();
  for (let k = 0; k < WAYPOINTS.length; k++) seen.add(stopIndex(k * STAY_MS + 5));
  assert.equal(seen.size, WAYPOINTS.length);
  assert.equal(stopIndex(1000), stopIndex(STAY_MS - 1));
  for (const w of WARES) assert.ok(w.cost > 0 && typeof w.give === 'function');
});

test('the haste shrine opens only while every brazier burns at once', async () => {
  const { allLit, BRAZIER_WINDOW, SHRINES } = await import('../src/trials/shrines.js');
  const now = 1e9;
  assert.equal(allLit([now - 100, now - 5000, now - BRAZIER_WINDOW + 1], now), true);
  assert.equal(allLit([now - 100, now - BRAZIER_WINDOW - 1, now], now), false);
  assert.equal(allLit([now, true, now], now), false);
  assert.equal(allLit([], now), false);
  assert.equal(SHRINES.length, 3);
});

test('critters spook unless you sneak, and always when you ride', async () => {
  const { spooked, SPOOK_R, CATCH_R } = await import('../src/world/critters.js');
  assert.ok(CATCH_R < SPOOK_R);
  assert.equal(spooked(SPOOK_R - 0.5, false, false), true);
  assert.equal(spooked(SPOOK_R - 0.5, true, false), false);
  assert.equal(spooked(SPOOK_R + 0.5, false, false), false);
  assert.equal(spooked(SPOOK_R * 2, true, true), true);
});

test('caught ingredients cook into named meals', async () => {
  const { INGREDIENTS } = await import('../src/world/forage.js');
  for (const k of ['fish', 'prismfin', 'sunwing', 'glowbug']) assert.ok(INGREDIENTS[k] && INGREDIENTS[k].biome.length === 0, k);
  assert.equal(INGREDIENTS.glowbug.buff, 'hush');
});

test('cooking names meals and records order-free recipes', async () => {
  const { cookMeal, recipeKey } = await import('../src/world/forage.js');
  const m = cookMeal(['glowbug', 'fish', 'glowbug']);
  assert.equal(m.buff, 'hush');
  assert.equal(m.dur, 180);
  assert.equal(m.heal, Math.round((1 + 3 + 1) * 1.5));
  assert.match(m.name, /^Hushed Glowbug Feast$/);
  assert.equal(recipeKey(['fish', 'apple']), recipeKey(['apple', 'fish']));
  assert.equal(cookMeal(['apple']).name, 'Hearty Apple Skewer');
});

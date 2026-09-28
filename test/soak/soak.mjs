// Soak test: drives the built game with seeded random input for many rounds, teleporting between
// towers, shrines, herds, the lake, the volcano and the village, sometimes mounted, at random times
// of day. Fails on page errors or NaN positions. Run with `npm run soak [rounds]` after a build.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 20000 + Math.floor(Math.random() * 20000);
const server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT), WITCHERY_DATA: '.smoke-data' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => server.stdout.on('data', (d) => { if (String(d).includes('listening')) resolve(); }));
const url = `http://localhost:${PORT}/?autoplay&solo`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|AudioContext/.test(m.text())) errors.push(`[console] ${m.text()}`); });
await page.goto(url);
await page.waitForFunction(() => window.G && G.player && G.game.running, null, { timeout: 300000 });
const rounds = Number(process.argv[2] || 20);
let failed = false;
for (let r = 0; r < rounds; r++) {
  const res = await page.evaluate((r) => {
    const rnd = mulberry(r * 7919 + 13);
    function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    const p = G.player, inp = G.input;
    G.debugFreeze = true; inp.locked = true;
    // Jump somewhere interesting
    const spots = [
      ...G.towers.list.map((t) => [t.x + 8, t.z]), ...G.shrines.list.map((s) => [s.site.x + 5, s.site.z + 5]),
      ...G.steeds.sites.map((s) => [s.x, s.z]), [-170, 190], [560, -100], [-20, -380], [0, 90], [-100, -110],
    ];
    const [x, z] = spots[Math.floor(rnd() * spots.length)];
    p.pos.set(x, Math.max(G.terrain.heightAt(x, z), 0) + 2, z); p.vel.set(0, 0, 0); p.state = 'air'; p.lastSafe.copy(p.pos);
    if (rnd() < 0.3) G.sky.setTime(rnd());
    if (rnd() < 0.15) { const b = G.steeds.list[Math.floor(rnd() * G.steeds.list.length)]; b.pos.copy(p.pos); G.steeds._tamed(b); G.steeds.mount(b); }
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyR', 'KeyC', 'KeyF', 'KeyE', 'KeyQ', 'KeyX', 'KeyV', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
    const frame = (dt) => {
      G.time += dt;
      for (const k of ['player', 'trials', 'sprites', 'forage', 'quests', 'shrines', 'fishing', 'critters', 'steeds', 'climate', 'memories', 'towers', 'party', 'vault', 'festival', 'tally', 'races', 'puzzles', 'fox', 'merchant', 'targets']) G[k]?.update?.(dt);
      G.enemies.update(dt); G.paint.update(dt); G.particles.update(dt); G.world.update(dt, G.time);
      p.updateCamera(dt); G.sky.update(dt, p.pos); G.hud.update(dt); G.cine.update(dt);
      inp.endFrame();
    };
    for (let f = 0; f < 150; f++) {
      if (rnd() < 0.2) { const k = keys[Math.floor(rnd() * keys.length)]; if (inp.keys.has(k)) { inp.keys.delete(k); inp.released.add(k); } else { inp.keys.add(k); inp.pressed.add(k); } }
      if (rnd() < 0.08) { const b = rnd() < 0.7 ? 0 : 2; if (inp.mouse.buttons.has(b)) { inp.mouse.buttons.delete(b); inp.mouse.up.add(b); } else { inp.mouse.buttons.add(b); inp.mouse.down.add(b); } }
      inp.mouse.dx = (rnd() - 0.5) * 40; inp.mouse.dy = (rnd() - 0.5) * 10;
      if (G.hud.choiceCb && rnd() < 0.3) G.hud.answerChoice(4);
      if (G.hud.dialogOpen && rnd() < 0.3) G.hud.dialogTimer = 0;
      frame(1 / 30);
    }
    for (const k of [...inp.keys]) { inp.keys.delete(k); }
    inp.mouse.buttons.clear();
    const bad = [p.pos.x, p.pos.y, p.pos.z, p.vel.x, p.vel.y, p.vel.z, p.hp, p.stamina].some((v) => !Number.isFinite(v));
    const enemyBad = G.enemies.list.some((e) => ![e.pos.x, e.pos.y, e.pos.z, e.hp].every(Number.isFinite));
    return [r, x | 0, z | 0, p.state, p.pos.y.toFixed(1), bad, enemyBad, G.enemies.list.length, G.paint.splats.length, !!p.mounted];
  }, r).catch((e) => ['eval error', e.message]);
  console.log(JSON.stringify(res));
  if (res[0] === 'eval error' || res[5] || res[6]) failed = true;
  if (errors.length) { failed = true; console.log('ERRORS', errors.slice(0, 5).join('\n---\n')); errors.length = 0; }
}
await browser.close();
server.kill();
if (failed) { console.error('SOAK FAIL'); process.exitCode = 1; } else console.log('soak ok');

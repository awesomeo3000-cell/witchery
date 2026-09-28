// Browser smoke test: loads the built game against the real server in headless Chromium, starts a
// solo session and checks that the world builds, frames render and no errors reach the console.
// Run with `npm run smoke` after `npm run build`.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 20000 + Math.floor(Math.random() * 20000);
const server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT), WITCHERY_DATA: '.smoke-data' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => server.stdout.on('data', (d) => { if (String(d).includes('listening')) resolve(); }));

const fail = (msg) => { console.error(`SMOKE FAIL: ${msg}`); process.exitCode = 1; };
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|AudioContext/.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?autoplay&solo`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.G && window.G.player && window.G.game && window.G.game.running, null, { timeout: 180000 });
  const t0 = await page.evaluate(() => window.G.time);
  await page.waitForTimeout(8000);
  const state = await page.evaluate(() => ({
    time: window.G.time,
    hp: window.G.player.hp,
    enemies: window.G.enemies.list.length,
    quests: window.G.quests.npcs.length,
    calls: window.G.stats ? window.G.stats.calls : 0,
  }));
  console.log('smoke state', state);
  if (!(state.time > t0)) fail('game clock did not advance');
  if (!(state.hp > 0)) fail('player has no health');
  if (state.quests !== 4) fail('villagers missing');
  if (!(state.calls > 0)) fail('nothing was drawn');
  if (errors.length) fail(`console errors:\n${errors.join('\n')}`);
} finally {
  await browser.close();
  server.kill();
}
if (!process.exitCode) console.log('smoke ok');

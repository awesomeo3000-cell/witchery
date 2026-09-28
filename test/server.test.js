// Runs the real co-op server on a spare port and talks to it over WebSockets.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

const PORT = 20000 + Math.floor(Math.random() * 20000);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'witchery-test-'));
let proc;

function startServer() {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT), WITCHERY_DATA: DATA, WITCHERY_RATE: '50' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => reject(new Error('server did not start')), 10000);
    p.stdout.on('data', (d) => { if (String(d).includes('listening')) { clearTimeout(timer); resolve(p); } });
    p.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
}
const stopServer = (p) => new Promise((resolve) => { p.removeAllListeners('exit'); p.on('exit', resolve); p.kill(); });

// A test client that queues incoming messages and lets tests await specific ones
function client(room, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const inbox = [];
    const waiters = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      const i = waiters.findIndex((w) => w.pred(m));
      if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
    });
    const c = {
      ws,
      send: (m) => ws.send(JSON.stringify(m)),
      next: (pred, ms = 3000) => {
        const i = inbox.findIndex(pred);
        if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
        return new Promise((res, rej) => {
          const w = { pred, resolve: (m) => { clearTimeout(t); res(m); } };
          const t = setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); rej(new Error('timed out waiting for message')); }, ms);
          waiters.push(w);
        });
      },
      none: async (pred, ms = 400) => {
        await new Promise((r) => setTimeout(r, ms));
        return !inbox.some(pred);
      },
      close: () => new Promise((r) => { if (ws.readyState === WebSocket.CLOSED) { r(); return; } ws.once('close', r); ws.close(); }),
    };
    ws.on('open', async () => {
      c.send({ t: 'join', room, name });
      c.welcome = await c.next((m) => m.t === 'welcome');
      resolve(c);
    });
    ws.on('error', reject);
  });
}

before(async () => { proc = await startServer(); });
after(async () => { if (proc) await stopServer(proc); fs.rmSync(DATA, { recursive: true, force: true }); });

test('first player hosts and later players see who is there', async () => {
  const a = await client('alpha', 'Ada');
  assert.equal(a.welcome.hostId, a.welcome.id);
  const b = await client('alpha', 'Bo');
  assert.equal(b.welcome.hostId, a.welcome.id);
  assert.deepEqual(b.welcome.players.map((p) => p.name), ['Ada']);
  const joined = await a.next((m) => m.t === 'peer_join');
  assert.equal(joined.name, 'Bo');
  await a.close();
  await b.close();
});

test('only the host receives hits and only the host may send world state', async () => {
  const host = await client('beta', 'Host');
  const guest = await client('beta', 'Guest');
  guest.send({ t: 'hit', id: 1, d: 5 });
  const hit = await host.next((m) => m.t === 'hit');
  assert.equal(hit.from, guest.welcome.id);
  guest.send({ t: 'world', e: [] });
  assert.ok(await host.none((m) => m.t === 'world'), 'guest world state is dropped');
  host.send({ t: 'world', e: [] });
  await guest.next((m) => m.t === 'world');
  await host.close();
  await guest.close();
});

test('host migrates when the host leaves', async () => {
  const a = await client('gamma', 'A');
  const b = await client('gamma', 'B');
  await a.close();
  const m = await b.next((x) => x.t === 'host');
  assert.equal(m.hostId, b.welcome.id);
  await b.close();
});

test('flags are shared, sent to late joiners and survive a restart', async () => {
  const a = await client('delta', 'A');
  const b = await client('delta', 'B');
  a.send({ t: 'flag', k: 'trial_ember', v: true });
  const f = await b.next((m) => m.t === 'flag');
  assert.equal(f.k, 'trial_ember');
  const c = await client('delta', 'C');
  assert.equal(c.welcome.flags.trial_ember, true);
  await Promise.all([a.close(), b.close(), c.close()]);
  // Saves are debounced; wait for the file then restart the server
  const file = path.join(DATA, 'rooms.json');
  for (let i = 0; i < 40 && !fs.existsSync(file); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(fs.existsSync(file));
  await stopServer(proc);
  proc = await startServer();
  const d = await client('delta', 'D');
  assert.equal(d.welcome.flags.trial_ember, true);
  await d.close();
});

test('rooms are capped at eight players', async () => {
  const players = [];
  for (let i = 0; i < 8; i++) players.push(await client('full', `P${i}`));
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const msg = await new Promise((resolve) => {
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', room: 'full', name: 'Late' })));
    ws.on('message', (raw) => resolve(JSON.parse(raw)));
  });
  assert.equal(msg.t, 'full');
  await Promise.all(players.map((p) => p.close()));
});

test('floods are rate limited', async () => {
  const a = await client('flood', 'A');
  const b = await client('flood', 'B');
  let got = 0;
  b.ws.on('message', (raw) => { if (JSON.parse(raw).t === 'chat') got++; });
  for (let i = 0; i < 400; i++) a.send({ t: 'chat', text: `spam ${i}` });
  await new Promise((r) => setTimeout(r, 600));
  assert.ok(got > 50 && got < 200, `relayed ${got} of 400 (burst is 100)`);
  await Promise.all([a.close(), b.close()]);
});

test('oversized flag values are rejected', async () => {
  const a = await client('big', 'A');
  const b = await client('big', 'B');
  a.send({ t: 'flag', k: 'huge', v: 'x'.repeat(1000) });
  a.send({ t: 'flag', k: 'ok', v: { t: 12.3, n: 'Ada' } });
  const f = await b.next((m) => m.t === 'flag');
  assert.equal(f.k, 'ok');
  const c = await client('big', 'C');
  assert.equal(c.welcome.flags.huge, undefined);
  assert.deepEqual(c.welcome.flags.ok, { t: 12.3, n: 'Ada' });
  await Promise.all([a.close(), b.close(), c.close()]);
});

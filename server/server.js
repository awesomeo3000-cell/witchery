// Witchery co-op server: serves the built client from dist/ and relays game messages per room.
// The first player in a room is the "host" and simulates enemies; if they leave, the next player takes over.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 8080;
const MAX_PLAYERS = 8;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.normalize(path.join(DIST, url));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Witchery server running. Build the client with "npm run build" (or use "npm run dev").');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
const rooms = new Map(); // code -> { clients: Map<id, ws>, hostId, flags }
let nextId = 1;

// World progress (puzzle flags, shards, easels, collectibles) survives server restarts.
const DATA_DIR = process.env.WITCHERY_DATA || path.resolve(__dirname, '..', 'data');
const SAVE_FILE = path.join(DATA_DIR, 'rooms.json');
let saved = {};
try { saved = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); } catch { saved = {}; }
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    for (const [code, r] of rooms) saved[code] = r.flags;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SAVE_FILE + '.tmp', JSON.stringify(saved));
      fs.renameSync(SAVE_FILE + '.tmp', SAVE_FILE);
    } catch (e) { console.warn('save failed', e.message); }
  }, 1500);
}

function roomOf(code) {
  let r = rooms.get(code);
  if (!r) rooms.set(code, (r = { clients: new Map(), hostId: null, flags: { ...(saved[code] || {}) } }));
  return r;
}

function broadcast(room, msg, exceptId = null) {
  const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
  for (const [id, ws] of room.clients) if (id !== exceptId && ws.readyState === 1) ws.send(data);
}

function sendTo(room, id, msg) {
  const ws = room.clients.get(id);
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws) => {
  let room = null;
  let id = null;

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'join' && !room) {
      const code = String(m.room || 'main').slice(0, 24).toLowerCase() || 'main';
      room = roomOf(code);
      if (room.clients.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: 'full' })); ws.close(); room = null; return; }
      id = `p${nextId++}`;
      ws.meta = { name: String(m.name || 'Painter').slice(0, 16), look: m.look || {} };
      room.clients.set(id, ws);
      if (!room.hostId) room.hostId = id;
      const players = [...room.clients].filter(([pid]) => pid !== id).map(([pid, c]) => ({ id: pid, name: c.meta.name, look: c.meta.look }));
      ws.send(JSON.stringify({ t: 'welcome', id, hostId: room.hostId, flags: room.flags, players, room: code }));
      broadcast(room, { t: 'peer_join', id, name: ws.meta.name, look: ws.meta.look }, id);
      console.log(`[${code}] ${ws.meta.name} joined (${room.clients.size} players)`);
      return;
    }
    if (!room) return;
    m.from = id;

    switch (m.t) {
      case 'flag':
        if (typeof m.k === 'string' && m.k.length < 64) {
          room.flags[m.k] = m.v;
          broadcast(room, m, id);
          scheduleSave();
        }
        break;
      case 'hit': case 'pickup':
        // Only the host simulates enemies
        if (room.hostId && room.hostId !== id) sendTo(room, room.hostId, m);
        break;
      case 'world':
        if (id === room.hostId) broadcast(room, m, id);
        break;
      case 'pdmg':
        if (id === room.hostId && typeof m.to === 'string') sendTo(room, m.to, m);
        break;
      case 'chat':
        m.text = String(m.text || '').slice(0, 140);
        broadcast(room, m, id);
        break;
      default:
        // st, paint, glob, fx, efx ...
        broadcast(room, m, id);
    }
  });

  ws.on('close', () => {
    if (!room) return;
    room.clients.delete(id);
    broadcast(room, { t: 'peer_leave', id });
    if (room.hostId === id) {
      room.hostId = room.clients.keys().next().value || null;
      if (room.hostId) broadcast(room, { t: 'host', hostId: room.hostId });
    }
    if (!room.clients.size) {
      // Keep progress around for a while so friends can rejoin
      const empty = room;
      // Flags are persisted to disk, so the in-memory room can go once everyone has left
      setTimeout(() => { if (!empty.clients.size) for (const [k, v] of rooms) if (v === empty) { saved[k] = v.flags; rooms.delete(k); } }, 30 * 60 * 1000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Witchery server listening on http://localhost:${PORT}`);
});

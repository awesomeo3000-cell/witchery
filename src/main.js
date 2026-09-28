// Witchery - boot, menus, networking glue and the main loop.
import * as THREE from 'three';
import { G, COLORS } from './core/ctx.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Terrain } from './world/terrain.js';
import { Collision } from './world/collision.js';
import { Environment } from './world/sky.js';
import { Water } from './world/water.js';
import { Grass } from './world/grass.js';
import { World } from './world/world.js';
import { initMaterials } from './world/props.js';
import { WAYPOINTS } from './world/layout.js';
import { PaintSystem } from './combat/paint.js';
import { Particles } from './combat/particles.js';
import { EnemyManager } from './enemies/enemies.js';
import { Trials } from './trials/trials.js';
import { Player } from './player/player.js';
import { makeCharacter } from './player/character.js';
import { HUD } from './ui/hud.js';
import { Net } from './net/net.js';
import { damp, dampAngle } from './core/math.js';

const $ = (id) => document.getElementById(id);
const LOOKS = [
  { hood: 0x2f8a8a, scarf: 0xc7453a },
  { hood: 0x8a3a6a, scarf: 0xf2c229 },
  { hood: 0x3a5aa8, scarf: 0xe8e2d4 },
  { hood: 0xd07a2a, scarf: 0x3a5a3a },
  { hood: 0x5a8a3a, scarf: 0x7a3aa8 },
  { hood: 0xe8e2d4, scarf: 0x3a9ae8 },
];

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('witchery.settings') || '{}');
    Object.assign(G.settings, s);
  } catch (_) { /* ignore */ }
}
function saveSettings() {
  try { localStorage.setItem('witchery.settings', JSON.stringify(G.settings)); } catch (_) { /* ignore */ }
}
function loadProfile() {
  try { return JSON.parse(localStorage.getItem('witchery.profile') || '{}'); } catch (_) { return {}; }
}
function saveProfile(p) {
  try { localStorage.setItem('witchery.profile', JSON.stringify(p)); } catch (_) { /* ignore */ }
}

class Peer {
  constructor(id, name, look) {
    this.id = id;
    this.name = name;
    this.look = { hood: 0x2f8a8a, scarf: 0xc7453a, ...look };
    this.char = makeCharacter(this.look);
    G.scene.add(this.char.group);
    this.pos = new THREE.Vector3(0, -9999, 0);
    this.target = new THREE.Vector3(0, -9999, 0);
    this.yaw = 0;
    this.tyaw = 0;
    this.state = 'idle';
    this.speed = 0;
    this.hp = 12;
    this.color = 0;
    this.attack = null;
    this.aim = false;
    this.fresh = true;
  }

  apply(m) {
    this.target.set(m.p[0], m.p[1], m.p[2]);
    if (this.fresh) { this.pos.copy(this.target); this.fresh = false; }
    this.tyaw = m.y;
    this.state = m.s || 'idle';
    this.speed = m.v || 0;
    this.hp = m.hp;
    this.aim = !!m.m;
    this.pitch = m.pt || 0;
    this.rp = m.rp || 0;
    this.rr = m.rr || 0;
    this.attack = m.a ? { kind: m.a[0] === 'spin' ? 'spin' : m.a[0], t: m.a[1] } : null;
    if (m.c !== this.color) { this.color = m.c; this.char.setBrushColor(COLORS[m.c].hex); }
  }

  update(dt) {
    if (this.pos.distanceTo(this.target) > 25) this.pos.copy(this.target);
    this.pos.x = damp(this.pos.x, this.target.x, 12, dt);
    this.pos.y = damp(this.pos.y, this.target.y, 12, dt);
    this.pos.z = damp(this.pos.z, this.target.z, 12, dt);
    this.yaw = dampAngle(this.yaw, this.tyaw, 12, dt);
    if (this.attack && this.attack.kind === 'spin') this.yaw += dt * 16;
    this.char.group.position.copy(this.pos);
    this.char.group.rotation.y = this.yaw;
    this.char.animate({ state: this.state, speed: this.speed, attack: this.attack, aim: this.aim, aimPitch: -this.pitch * 0.6, pitch: this.rp, roll: this.rr }, dt);
    if (this.state === 'ride' && Math.random() < dt * 30) {
      G.particles.burst(this.pos.clone().setY(this.pos.y + 0.6).addScaledVector(new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), 1.6),
        { count: 1, color: COLORS[this.color].hex, speed: 0.6, life: 1.2, size: 0.45, gravity: 1, pool: 'glow', alpha: 0.8 });
    }
  }

  dispose() { G.scene.remove(this.char.group); }
}

class Game {
  constructor() {
    G.game = this;
    loadSettings();
    const canvas = $('game');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    G.renderer = renderer;
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 5000);
    G.input = new Input(canvas);
    G.audio = new Audio();
    G.peers = new Map();
    G.flags = {};
    G.hitStop = 0;
    const params = new URLSearchParams(location.search);
    G.godMode = params.has('god');
    this.params = params;
    this.clock = new THREE.Timer();
    this.netTimer = 0;
    this.running = false;
    this.mapOpen = false;
    this.chatOpen = false;
    window.G = G; // handy for debugging from the console
    window.THREE = THREE;

    this._buildWorld();
    this._setupMenu();
    this._setupPause();
    this._setupChat();
    window.addEventListener('resize', () => this._resize());
    this._resize();
    $('loading').classList.add('hidden');
    renderer.setAnimationLoop(() => this._frame());
  }

  _buildWorld() {
    initMaterials();
    G.terrain = new Terrain(7);
    G.scene.add(G.terrain.mesh);
    G.collision = new Collision(G.terrain);
    G.sky = new Environment(G.scene);
    G.water = new Water(G.scene, G.terrain);
    G.grass = new Grass(G.scene, G.terrain, G.settings.grass);
    G.particles = new Particles(G.scene);
    G.paint = new PaintSystem(G.scene);
    G.world = new World(G.scene, G.terrain, G.collision);
    G.enemies = new EnemyManager(G.scene);
    G.trials = new Trials(G.scene);
    G.hud = new HUD();
    // Menu backdrop camera
    G.camera.position.set(60, 60, 200);
    G.camera.lookAt(0, 40, -100);
  }

  _resize() {
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(innerWidth, innerHeight);
    G.particles.setScale(innerHeight);
  }

  // ------------------------------------------------------------ menus
  _setupMenu() {
    const prof = loadProfile();
    const params = this.params;
    $('in-name').value = prof.name || `Painter${Math.floor(Math.random() * 900 + 100)}`;
    $('in-room').value = params.get('room') || prof.room || '';
    this.lookIdx = prof.look ?? Math.floor(Math.random() * LOOKS.length);
    const box = $('looks');
    LOOKS.forEach((l, i) => {
      const s = document.createElement('div');
      s.className = 'sw' + (i === this.lookIdx ? ' sel' : '');
      s.style.background = `linear-gradient(135deg, #${l.hood.toString(16).padStart(6, '0')} 60%, #${l.scarf.toString(16).padStart(6, '0')} 60%)`;
      s.onclick = () => {
        this.lookIdx = i;
        [...box.children].forEach((c, k) => c.classList.toggle('sel', k === i));
      };
      box.appendChild(s);
    });
    $('btn-play').onclick = () => this._play();
    $('in-room').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._play(); });
    if (params.has('autoplay')) setTimeout(() => this._play(), 50);
  }

  async _play() {
    if (this.starting) return;
    this.starting = true;
    G.audio.init();
    const name = $('in-name').value.trim() || 'Painter';
    const room = ($('in-room').value.trim() || 'main').toLowerCase();
    const look = LOOKS[this.lookIdx];
    saveProfile({ name, room, look: this.lookIdx });
    $('menu-status').textContent = 'Connecting…';
    G.net = new Net();
    this._netHandlers();
    const ok = this.params.has('solo') ? false : await G.net.connect(room, name, look);
    if (!ok) G.hud.toast('No server found - playing solo.', '#dddddd', 3);
    this.myLook = look;
    G.player = new Player(name, look);
    // Start on the south side of Palette Hollow, looking north over the plaza toward the Sky Citadel
    const sx = 0, sz = 112;
    G.player.spawn(new THREE.Vector3(sx, G.terrain.heightAt(sx, sz) + 0.2, sz));
    G.player.camYaw = 0;
    G.flags.wp_village = true;
    this._applyWelcomeFlags();
    $('menu').classList.add('hidden');
    G.hud.show(true);
    G.hud.banner('Palette Hollow', 'Talk to Elder Umber (F) near the statue', '#ffe08a');
    this.running = true;
    G.input.lock();
    if (G.net.connected) {
      history.replaceState(null, '', `?room=${encodeURIComponent(room)}`);
      G.hud.chat('', `Joined room "${room}". Share the link or room code with friends!`, '#ffe08a');
    }
  }

  _applyWelcomeFlags() {
    const w = this._welcome;
    if (w) {
      Object.assign(G.flags, w.flags || {});
      for (const pl of w.players || []) this._addPeer(pl.id, pl.name, pl.look);
    }
    // Existing progress shouldn't re-trigger fanfare
    G.trials._announced = {};
    for (const k in G.flags) if (k.startsWith('trial_') && G.flags[k]) G.trials._announced[k] = true;
    if (G.flags.final) G.trials._finalShown = true;
    G.player.maxHp = 12 + G.trials.shardCount() * 2;
    G.player.hp = G.player.maxHp;
  }

  _setupPause() {
    G.input.onLockChange = (locked) => {
      if (!this.running) return;
      if (!locked && !this.mapOpen && !this.chatOpen && $('victory').classList.contains('hidden')) this._showPause(true);
      if (locked) this._showPause(false);
    };
    $('game').addEventListener('click', () => {
      if (this.running && !G.input.locked && !this.mapOpen) G.input.lock();
    });
    $('btn-resume').onclick = () => { this._showPause(false); G.input.lock(); };
    $('btn-copy').onclick = () => {
      const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(G.net?.room || 'main')}`;
      navigator.clipboard?.writeText(url).then(() => G.hud.toast('Invite link copied!', '#ffe08a')).catch(() => G.hud.toast(url, '#ffe08a', 6));
    };
    $('btn-victory').onclick = () => { $('victory').classList.add('hidden'); G.input.lock(); };
    const bind = (id, key, parse, apply) => {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = !!G.settings[key]; else el.value = G.settings[key];
      el.addEventListener('input', () => {
        G.settings[key] = el.type === 'checkbox' ? el.checked : parse(el.value);
        if (apply) apply(G.settings[key]);
        saveSettings();
      });
    };
    bind('set-sens', 'sensitivity', parseFloat);
    bind('set-invert', 'invertY');
    bind('set-grass', 'grass', parseFloat, (v) => G.grass.build(v));
    bind('set-shadows', 'shadows');
    bind('set-volume', 'volume', parseFloat, (v) => G.audio.setVolume(v));
    bind('set-music', 'music');
  }

  _showPause(v) {
    $('pause').classList.toggle('hidden', !v);
    if (v) {
      $('pause-room').textContent = G.net?.connected ? `Room: ${G.net.room} · ${G.peers.size + 1} player(s)` : 'Solo game';
    }
  }

  _setupChat() {
    const input = $('chat-input');
    window.addEventListener('keydown', (e) => {
      if (!this.running) return;
      if (e.code === 'Enter' && !this.chatOpen && G.input.locked) {
        this.chatOpen = true;
        G.input.enabled = false;
        G.input.keys.clear();
        input.classList.remove('hidden');
        G.input.unlock();
        setTimeout(() => input.focus(), 0);
        e.preventDefault();
      } else if (e.code === 'KeyM' && G.input.enabled && !this.chatOpen) {
        this.toggleMap();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        const text = input.value.trim();
        if (text) {
          G.net?.send({ t: 'chat', text, name: G.player.name });
          G.hud.chat(G.player.name, text, '#ffe08a');
        }
        this._closeChat();
      } else if (e.code === 'Escape') this._closeChat();
      e.stopPropagation();
    });
  }

  _closeChat() {
    const input = $('chat-input');
    input.value = '';
    input.blur();
    input.classList.add('hidden');
    this.chatOpen = false;
    G.input.enabled = true;
    G.input.lock();
  }

  toggleMap() {
    this.mapOpen = !this.mapOpen;
    if (this.mapOpen) { G.hud.openMap(); G.input.unlock(); }
    else { G.hud.closeMap(); G.input.lock(); }
  }

  fastTravel(w) {
    const p = G.player;
    if (p.inDungeon) { G.hud.toast('You cannot fast-travel from inside a trial.', '#ffcf8a'); return; }
    p.pos.set(w.x - 3, G.terrain.heightAt(w.x - 3, w.z) + 0.3, w.z);
    p.vel.set(0, 0, 0);
    p.state = 'air';
    p.camPos.copy(p.pos).add(new THREE.Vector3(0, 3, 6));
    p.checkpoint.copy(p.pos);
    G.audio.play('waypoint');
    this.toggleMap();
  }

  // ------------------------------------------------------------ networking
  _addPeer(id, name, look) {
    if (G.peers.has(id)) return G.peers.get(id);
    const p = new Peer(id, name, look);
    G.peers.set(id, p);
    return p;
  }

  _netHandlers() {
    const net = G.net;
    net.on('welcome', (m) => { this._welcome = m; });
    net.on('peer_join', (m) => {
      this._addPeer(m.id, m.name, m.look);
      G.hud.chat('', `${m.name} joined the adventure!`, '#a8f08c');
      G.audio.play('chat');
      // Share world progress the newcomer might not have (flags are also stored server-side)
    });
    net.on('peer_leave', (m) => {
      const p = G.peers.get(m.id);
      if (!p) return;
      G.hud.chat('', `${p.name} left.`, '#dddddd');
      G.hud.removePeer(p);
      p.dispose();
      G.peers.delete(m.id);
    });
    net.on('host', (m) => {
      if (m.hostId === net.id) {
        G.enemies.becomeHost();
        G.hud.chat('', 'You are now the host.', '#dddddd');
      }
    });
    net.on('st', (m) => {
      const p = G.peers.get(m.from);
      if (p) p.apply(m);
    });
    net.on('paint', (m) => G.paint.onNetPaint(m));
    net.on('glob', (m) => G.paint.throwGlob(new THREE.Vector3(...m.p), new THREE.Vector3(...m.v), m.c, m.from, { small: !!m.s }));
    net.on('flag', (m) => {
      G.flags[m.k] = m.v;
      G.trials.onFlag(m.k, m.v);
    });
    net.on('world', (m) => { if (!net.isHost) G.enemies.applySnapshot(m); });
    net.on('hit', (m) => { if (net.isHost) G.enemies.onNetHit(m); });
    net.on('pickup', (m) => { if (net.isHost) G.enemies.onNetPickup(m); });
    net.on('pdmg', (m) => {
      if (m.to === net.id && G.player) G.player.takeDamage(m.d, new THREE.Vector3(...m.f), { element: m.e });
    });
    net.on('efx', (m) => {
      if (m.k === 'pimp') G.enemies._impactFx(m.kind, new THREE.Vector3(...m.p));
      else if (m.k === 'spit') G.audio.play('shoot', 0.5);
      else if (m.k === 'phase2') G.hud.toast('The Hueless King is enraged!', '#e0c8ff', 3);
      else G.enemies._fx(m.k, new THREE.Vector3(...m.p));
    });
    net.on('fx', (m) => {
      const p = G.peers.get(m.from);
      if (m.k === 'down' && p) G.hud.chat('', `${p.name} fainted!`, '#ffb0b0');
    });
    net.on('chat', (m) => {
      const p = G.peers.get(m.from);
      G.hud.chat(p ? p.name : m.name || '?', m.text, p ? `#${p.look.hood.toString(16).padStart(6, '0')}` : '#fff');
      G.audio.play('chat');
    });
    net.on('full', () => G.hud.toast('That room is full.', '#ffb0b0', 4));
    net.on('disconnect', () => {
      G.hud.toast('Disconnected from server - continuing solo.', '#ffb0b0', 4);
      for (const p of G.peers.values()) { G.hud.removePeer(p); p.dispose(); }
      G.peers.clear();
      G.enemies.becomeHost();
    });
  }

  // ------------------------------------------------------------ loop
  _checkWaypoints() {
    const p = G.player;
    for (const w of WAYPOINTS) {
      const d = Math.hypot(p.pos.x - w.x, p.pos.z - w.z);
      if (d < 5 && Math.abs(p.pos.y - G.terrain.heightAt(w.x, w.z)) < 4) {
        if (!G.flags[`wp_${w.key}`]) {
          G.flags[`wp_${w.key}`] = true;
          G.net?.send({ t: 'flag', k: `wp_${w.key}`, v: true });
          G.audio.play('waypoint');
          G.hud.toast(`Easel "${w.name}" painted! Fast-travel from the map (M).`, '#ffe08a', 3);
        }
        if (p.checkpoint.distanceTo(p.pos) > 8) {
          p.checkpoint.set(w.x - 2, G.terrain.heightAt(w.x - 2, w.z) + 0.3, w.z);
        }
      }
    }
  }

  _frame() {
    this.clock.update();
    let dt = Math.min(this.clock.getDelta(), 0.05);
    G.time += dt;
    if (!this.running) {
      // Slow orbit over the island behind the menu
      const t = G.time * 0.05;
      G.camera.position.set(Math.cos(t) * 260, 110, Math.sin(t) * 260);
      G.camera.lookAt(0, 30, 0);
      G.sky.update(dt, G.camera.position);
      G.water.update(dt, G.sky);
      G.grass.update(dt, G.sky, []);
      G.world.update(dt, G.time);
      G.trials.root.visible = false;
      G.renderer.render(G.scene, G.camera);
      return;
    }
    if (G.debugFreeze) { G.renderer.render(G.scene, G.camera); return; }
    if (G.hitStop > 0) { G.hitStop -= dt; dt *= 0.15; }
    const p = G.player;
    if (!this.mapOpen) p.update(dt);
    G.trials.update(dt);
    G.enemies.update(dt);
    G.paint.update(dt);
    G.particles.update(dt);
    G.world.update(dt, G.time);
    for (const peer of G.peers.values()) peer.update(dt);
    this._checkWaypoints();
    p.updateCamera(dt);
    // Only draw the half of the world the camera is in
    const under = p.inDungeon;
    G.trials.root.visible = under;
    G.world.root.visible = G.terrain.mesh.visible = !under;
    G.sky.update(dt, p.pos);
    G.water.update(dt, G.sky);
    const pushers = [p.pos];
    for (const peer of G.peers.values()) if (pushers.length < 4) pushers.push(peer.pos);
    for (const e of G.enemies.list) if (pushers.length < 4 && e.pos.distanceTo(p.pos) < 30) pushers.push(e.pos);
    G.grass.update(dt, G.sky, pushers);
    G.hud.update(dt);
    G.audio.update(dt);
    if (G.input.hit('KeyF') && G.hud.dialogTimer > 0 && !p.interactTarget) G.hud.dialogTimer = 0;

    this.netTimer -= dt;
    if (this.netTimer <= 0 && G.net?.connected) {
      this.netTimer = 1 / 15;
      G.net.send(p.netState());
    }
    G.input.endFrame();
    G.renderer.render(G.scene, G.camera);
  }
}

new Game();

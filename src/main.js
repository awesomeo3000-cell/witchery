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
import { initMaterials, WIND } from './world/props.js';
import { WAYPOINTS } from './world/layout.js';
import { PaintSystem } from './combat/paint.js';
import { Particles } from './combat/particles.js';
import { EnemyManager } from './enemies/enemies.js';
import { Trials } from './trials/trials.js';
import { Sprites } from './world/sprites.js';
import { Weather } from './world/weather.js';
import { Forage } from './world/forage.js';
import { Quests } from './world/quests.js';
import { AccessUI } from './ui/access.js';
import { Wardrobe, applyCosmetics } from './ui/wardrobe.js';
import { Pings } from './ui/ping.js';
import { Races } from './world/races.js';
import { Shop } from './world/shop.js';
import { MapFog } from './ui/mapfog.js';
import { Puzzles } from './world/puzzles.js';
import { Fox } from './world/fox.js';
import { Gallery } from './trials/gallery.js';
import { Stars } from './world/stars.js';
import { Minimap } from './ui/minimap.js';
import { Revive } from './ui/revive.js';
import { Honours } from './ui/honours.js';
import { Wyrm } from './world/wyrm.js';
import { Rainbow } from './world/rainbow.js';
import { TargetGallery } from './world/targets.js';
import { Tablets } from './world/tablets.js';
import { Shrines } from './trials/shrines.js';
import { Fishing } from './world/fishing.js';
import { Critters } from './world/critters.js';
import { Merchant } from './world/merchant.js';
import { GreyMoon } from './world/greymoon.js';
import { WET } from './world/terrain.js';
import { Player } from './player/player.js';
import { makeCharacter } from './player/character.js';
import { Ribbon } from './combat/trails.js';
import { HUD } from './ui/hud.js';
import { Net } from './net/net.js';
import { PostFX } from './core/post.js';
import { Cinematic } from './ui/cinematic.js';
import { Guide } from './ui/guide.js';
import { PhotoMode } from './ui/photo.js';
import { TouchControls } from './ui/touch.js';
import { loadSave, writeSave } from './core/save.js';
import { applyStats, spriteCount } from './core/progress.js';
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
    this.trail = new Ribbon(G.scene, { width: 0.7, life: 0.85 });
    this._tip = new THREE.Vector3();
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
    if (m.cs !== this.cs) { this.cs = m.cs; applyCosmetics(this.char, this.trail, m.cs); }
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
    this.char.group.updateMatrixWorld(true);
    this.char.brushTip.getWorldPosition(this._tip);
    this.trail.update(dt, this._tip, this.state === 'ride' && this.speed > 5, COLORS[this.color].hex);
    if (this.state === 'ride' && Math.random() < dt * 30) {
      G.particles.burst(this.pos.clone().setY(this.pos.y + 0.6).addScaledVector(new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), 1.6),
        { count: 1, color: COLORS[this.color].hex, speed: 0.6, life: 1.2, size: 0.45, gravity: 1, pool: 'glow', alpha: 0.8 });
    }
  }

  dispose() { G.scene.remove(this.char.group); this.trail.dispose(G.scene); }
}

class Game {
  constructor() {
    G.game = this;
    loadSettings();
    const canvas = $('game');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.basePR = renderer.getPixelRatio();
    this.resScale = 1;
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    G.renderer = renderer;
    G.post = new PostFX(renderer);
    G.post.enabled = G.settings.post !== false;
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
    // Boot timings (ms per step) are kept in G.bootTimes for profiling
    G.bootTimes = {};
    const timed = (name, fn) => { const t0 = performance.now(); const r = fn(); G.bootTimes[name] = Math.round(performance.now() - t0); return r; };
    G.terrain = timed('terrain', () => new Terrain(7));
    G.scene.add(G.terrain.mesh);
    G.collision = timed('collision', () => new Collision(G.terrain));
    G.sky = timed('sky', () => new Environment(G.scene));
    G.water = timed('water', () => new Water(G.scene, G.terrain));
    G.grass = timed('grass', () => new Grass(G.scene, G.terrain, G.settings.grass));
    G.particles = timed('particles', () => new Particles(G.scene));
    G.paint = timed('paint', () => new PaintSystem(G.scene));
    G.world = timed('world', () => new World(G.scene, G.terrain, G.collision));
    G.enemies = timed('enemies', () => new EnemyManager(G.scene));
    G.trials = timed('trials', () => new Trials(G.scene));
    G.sprites = timed('sprites', () => new Sprites(G.scene));
    G.weather = timed('weather', () => new Weather(G.scene));
    G.forage = timed('forage', () => new Forage(G.scene));
    G.greyMoon = timed('greyMoon', () => new GreyMoon());
    G.hud = timed('hud', () => new HUD());
    G.quests = timed('quests', () => new Quests(G.scene));
    G.pings = timed('pings', () => new Pings(G.scene));
    G.races = timed('races', () => new Races(G.scene));
    G.shop = timed('shop', () => new Shop(G.scene));
    G.fog = timed('fog', () => new MapFog());
    G.puzzles = timed('puzzles', () => new Puzzles(G.scene));
    G.fox = timed('fox', () => new Fox(G.scene));
    G.gallery = timed('gallery', () => new Gallery(G.trials.root));
    G.stars = timed('stars', () => new Stars());
    G.minimap = timed('minimap', () => new Minimap());
    G.revive = timed('revive', () => new Revive());
    G.honours = timed('honours', () => new Honours());
    G.wyrm = timed('wyrm', () => new Wyrm(G.scene));
    G.rainbow = timed('rainbow', () => new Rainbow(G.scene));
    G.targets = timed('targets', () => new TargetGallery(G.scene));
    G.tablets = timed('tablets', () => new Tablets(G.scene));
    G.shrines = timed('shrines', () => new Shrines(G.trials.root));
    G.fishing = timed('fishing', () => new Fishing(G.scene));
    G.critters = timed('critters', () => new Critters(G.scene));
    G.merchant = timed('merchant', () => new Merchant(G.scene));
    G.cine = timed('cine', () => new Cinematic());
    G.guide = timed('guide', () => new Guide());
    G.photo = timed('photo', () => new PhotoMode());
    G.touch = timed('touch', () => new TouchControls());
    // Menu backdrop camera
    G.camera.position.set(60, 60, 200);
    G.camera.lookAt(0, 40, -100);
  }

  _resize() {
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(innerWidth, innerHeight);
    G.post.setSize(innerWidth, innerHeight);
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
    // Continue vs. new game: this browser keeps one save for solo play and one per room
    const saveKeys = () => {
      const room = ($('in-room').value.trim() || 'main').toLowerCase();
      return ['witchery.save.solo', `witchery.save.room.${room}`];
    };
    const hasSave = () => { try { return saveKeys().some((k) => localStorage.getItem(k)); } catch (_) { return false; } };
    const refresh = () => {
      const has = hasSave();
      $('btn-play').textContent = has ? 'Continue' : 'Play';
      $('btn-erase').classList.toggle('hidden', !has);
    };
    $('in-room').addEventListener('input', refresh);
    refresh();
    $('btn-erase').onclick = () => {
      const msg = 'Erase this browser\'s saved progress (position, satchel, Pigment, upgrades, map, and all solo progress)? Shared progress in an online room stays on the server.';
      if (!window.confirm(msg)) return;
      try { for (const k of saveKeys()) localStorage.removeItem(k); } catch (_) { /* storage blocked */ }
      refresh();
      $('menu-status').textContent = 'Save erased. Press Play for a fresh start.';
    };
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
    const save = loadSave();
    if (save) {
      if (save.flags && !G.net.connected) Object.assign(G.flags, save.flags);
      if (save.pos) {
        G.player.spawn(new THREE.Vector3(...save.pos).add(new THREE.Vector3(0, 0.5, 0)));
        G.player.checkpoint.copy(G.player.pos);
      }
      if (typeof save.color === 'number') G.player.setColor(save.color);
      if (save.ink) G.player.ink = save.ink.slice(0, 4);
      if (save.forage) G.forage.load(save.forage);
      if (typeof save.pigment === 'number') G.player.pigment = save.pigment;
      if (save.upg) Object.assign(G.player.upg, save.upg);
      if (save.fog) G.fog.load(save.fog);
      if (save.honours) G.honours.load(save.honours);
      if (save.tablets) G.tablets.load(save.tablets);
      if (!G.net.connected && typeof save.dayT === 'number') G.sky.setTime(save.dayT);
    }
    this.wardrobe.render(true);
    this.wardrobe.apply();
    G.flags.wp_village = true;
    this._applyWelcomeFlags();
    this.saveTimer = 5;
    window.addEventListener('beforeunload', () => writeSave());
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
    applyStats(true);
  }

  _setupPause() {
    G.input.onLockChange = (locked) => {
      if (!this.running) return;
      if (!locked && !this.mapOpen && !this.chatOpen && !G.forage.open && $('victory').classList.contains('hidden') && $('credits').classList.contains('hidden')) this._showPause(true);
      if (locked) this._showPause(false);
    };
    G.input.onPadStart = () => {
      if (!this.running) { this._play(); return; }
      const paused = !$('pause').classList.contains('hidden');
      if (paused) { this._showPause(false); G.input.lock(); } else { this._showPause(true); G.input.unlock(); }
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
    $('btn-credits').onclick = () => this._credits();
    $('credits').onclick = () => { $('credits').classList.add('hidden'); G.input.lock(); };
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
    bind('set-post', 'post', null, (v) => { G.post.enabled = v; });
    bind('set-volume', 'volume', parseFloat, (v) => G.audio.setVolume(v));
    bind('set-music', 'music');
    bind('set-fps', 'fps', null, (v) => $('fps').classList.toggle('hidden', !v));
    $('fps').classList.toggle('hidden', !G.settings.fps);
    $('set-tips').addEventListener('change', (e) => {
      if (e.target.checked) { G.guide.seen.clear(); G.guide._save(); e.target.checked = false; G.hud.toast('Tips will show again', '#ffe08a'); }
    });
    this.access = new AccessUI(saveSettings);
    this.wardrobe = new Wardrobe(saveSettings);
    // Gamepad quick menu (hold View)
    G.input.onPadQuick = () => {
      if (!this.running || G.hud.choiceCb) return;
      G.hud.choice('Quick menu', 'What would you like to do?', ['Ping this spot', 'Emote', 'Cancel'], (i) => {
        if (i === 0) G.pings.cast();
        else if (i === 1) setTimeout(() => G.player.openEmotes(), 0);
      });
    };
    const q = $('set-quality');
    q.value = G.settings.quality || 'high';
    q.addEventListener('change', () => { this.applyQuality(q.value); saveSettings(); });
    // Changing an individual option switches the preset to "custom"
    for (const id of ['set-grass', 'set-shadows', 'set-post']) $(id).addEventListener('input', () => { G.settings.quality = 'custom'; q.value = 'custom'; saveSettings(); });
  }

  applyQuality(level) {
    G.settings.quality = level;
    if (level === 'custom') return;
    const presets = {
      low: { grass: 0, shadows: false, post: false, pr: 0.75, shadowMap: 1024 },
      medium: { grass: 1, shadows: true, post: true, pr: 1, shadowMap: 1024 },
      high: { grass: 2, shadows: true, post: true, pr: Math.min(window.devicePixelRatio, 1.5), shadowMap: 2048 },
    };
    const c = presets[level];
    G.settings.grass = c.grass; G.settings.shadows = c.shadows; G.settings.post = c.post;
    G.grass.build(c.grass);
    G.post.enabled = c.post;
    G.renderer.setPixelRatio(c.pr);
    this.basePR = c.pr;
    this.resScale = 1;
    const sh = G.sky.sun.shadow;
    if (sh.mapSize.x !== c.shadowMap) { sh.mapSize.set(c.shadowMap, c.shadowMap); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    this._resize();
    $('set-grass').value = c.grass; $('set-shadows').checked = c.shadows; $('set-post').checked = c.post;
  }

  _showPause(v) {
    if (v && this.wardrobe && G.player) this.wardrobe.render(true);
    $('pause').classList.toggle('hidden', !v);
    this.paused = v;
    if (!this.chatOpen) G.input.enabled = !v;
    if (v) {
      $('pause-room').textContent = `${G.net?.connected ? `Room: ${G.net.room} · ${G.peers.size + 1} player(s)` : 'Solo game'} · Paint Sprites ${spriteCount()}/${G.sprites.total}`;
    }
  }

  _setupChat() {
    const input = $('chat-input');
    window.addEventListener('keydown', (e) => {
      if (!this.running) return;
      if (e.code === 'Enter' && !this.chatOpen && G.input.locked && !G.photo.active) {
        this.chatOpen = true;
        G.input.enabled = false;
        G.input.keys.clear();
        input.classList.remove('hidden');
        G.input.unlock();
        setTimeout(() => input.focus(), 0);
        e.preventDefault();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        const text = input.value.trim();
        if (text.startsWith('/')) {
          this._command(text);
        } else if (text) {
          G.net?.send({ t: 'chat', text, name: G.player.name });
          G.hud.chat(G.player.name, text, '#ffe08a');
        }
        this._closeChat();
      } else if (e.code === 'Escape') this._closeChat();
      e.stopPropagation();
    });
  }

  // Small host commands: /weather clear|cloudy|rain|storm, /time dawn|day|dusk|night
  _command(text) {
    const [cmd, arg] = text.slice(1).split(/\s+/);
    if (G.net.connected && !G.net.isHost) { G.hud.chat('', 'Only the host can use commands.', '#ffb0b0'); return; }
    if (cmd === 'weather' && ['clear', 'cloudy', 'rain', 'storm'].includes(arg)) { G.weather.set(arg); G.hud.chat('', `Weather: ${arg}`, '#dddddd'); return; }
    if (cmd === 'greymoon') { G.greyMoon.force(); G.hud.chat('', 'The Grey Moon will rise at midnight...', '#c8a8ff'); return; }
    const times = { dawn: 0.26, day: 0.4, noon: 0.5, dusk: 0.72, night: 0.95 };
    if (cmd === 'time' && arg in times) { G.sky.setTime(times[arg]); G.hud.chat('', `Time: ${arg}`, '#dddddd'); return; }
    G.hud.chat('', 'Commands: /weather clear|cloudy|rain|storm · /time dawn|day|noon|dusk|night · /greymoon', '#dddddd');
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

  _credits() {
    $('victory').classList.add('hidden');
    const names = [G.player.name, ...[...G.peers.values()].map((q) => q.name)];
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    $('credits').querySelector('.roll').innerHTML = `
      <h1>Witchery</h1>
      <h3>THE PAINTERS</h3>${names.map((n) => `<p>${esc(n)}</p>`).join('')}
      <h3>CHAMPIONS OF THE PRISM TRIALS</h3><p>Frostmaw · Magmaw · Shellback · Galewing</p>
      <h3>WITH</h3><p>Elder Umber</p><p>Pip the Palette Keeper</p><p>Mira the Dyer · Tilly · Bram the Hunter</p><p>Painter Ochre · Sable the Brushwright</p><p>${G.sprites ? `${Object.keys(G.flags).filter((k) => k.startsWith('sprite_')).length} Paint Sprites` : ''}</p>
      <h3>YOUR JOURNEY</h3><p>${G.fog ? Math.round(G.fog.explored() * 100) : 0}% of the island mapped</p><p>${G.puzzles ? `${G.puzzles.solvedCount()} / ${G.puzzles.total}` : 0} island puzzles solved</p><p>${G.shrines ? `${G.shrines.clearedCount()} / ${G.shrines.list.length}` : 0} Paint Shrines cleared</p><p>${Object.keys(G.flags).filter((k) => /^q_\w+_done$/.test(k) && G.flags[k]).length} / 4 villager quests</p>
      <h3>BUILT WITH</h3><p>Three.js · WebAudio · a lot of paint</p>
      <h3>&nbsp;</h3><p>Thank you for playing!</p>`;
    const c = $('credits');
    c.classList.remove('hidden');
    const roll = c.querySelector('.roll');
    roll.style.animation = 'none';
    void roll.offsetWidth;
    roll.style.animation = '';
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
      else if (m.k === 'phase2') {
        G.hud.toast('The Hueless King is enraged!', '#e0c8ff', 3);
        const b = G.enemies.list.find((e) => e.type === 'hueless');
        if (b) G.cine.focus(b, 'The Hueless King', 'rises in fury', 2.4);
      }
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
    net.on('ping', (m) => G.pings.onNet(m));
    net.on('revive', (m) => G.revive.onNet(m));
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
    const rawDt = this.clock.getDelta();
    let dt = Math.min(rawDt, 0.05);
    G.input.pollGamepad(dt);
    G.time += dt;
    WIND.value = G.time;
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
      this._render({});
      return;
    }
    if (G.debugFreeze) { this._render({ under: G.water.underwater() }); return; }
    if (G.hitStop > 0) { G.hitStop -= dt; dt *= 0.12; }
    // Flurry Rush slows everything except the player
    if (G.flurry > 0) G.flurry -= dt;
    const wdt = G.flurry > 0 ? dt * 0.28 : dt;
    const p = G.player;
    // Map (keyboard, pad View tap, touch button all arrive as KeyM)
    if (G.input.hit('KeyM') && !this.chatOpen && !G.hud.choiceCb && !G.photo.active) this.toggleMap();
    // Choice dialogs eat number keys before they can switch colours
    if (G.hud.choiceCb) {
      for (let i = 0; i < 5; i++) {
        if (G.input.hit(`Digit${i + 1}`)) {
          G.input.pressed.delete(`Digit${i + 1}`);
          G.hud.answerChoice(i);
          break;
        }
      }
      if (G.hud.choiceCb && G.input.hit('Escape')) G.hud.answerChoice(G.hud.choiceN - 1);
    }
    if (G.photo.active) { p.vel.x = p.vel.z = 0; p._animate(dt); }
    else if (!this.mapOpen && !G.cine.frozen) p.update(dt);
    else if (G.cine.frozen) { p.vel.x = p.vel.z = 0; p._animate(dt); }
    G.trials.update(wdt);
    G.sprites.update(dt);
    G.forage.update(dt);
    G.quests.update(dt);
    G.pings.update(dt);
    G.races.update(dt);
    G.shop.update(dt);
    G.fog.update(dt);
    G.puzzles.update(dt);
    G.fox.update(dt);
    G.gallery.update(dt);
    G.stars.update(dt);
    G.minimap.update(dt);
    G.revive.update(dt);
    G.honours.update(dt);
    G.wyrm.update(dt);
    G.rainbow.update(dt);
    G.targets.update(dt);
    G.tablets.update(dt);
    G.shrines.update(dt);
    G.fishing.update(dt);
    G.critters.update(dt);
    G.merchant.update(dt);
    G.greyMoon.update(dt);
    G.enemies.update(wdt);
    G.paint.update(wdt);
    G.particles.update(wdt);
    G.world.update(dt, G.time);
    for (const peer of G.peers.values()) peer.update(dt);
    this._checkWaypoints();
    if (G.photo.active) G.photo.update(dt);
    else p.updateCamera(dt);
    G.cine.update(dt);
    G.weather.update(dt, G.sky);
    WET.value = Math.min(1, G.weather.w * 1.2) * (G.weather.snow.visible ? 0.3 : 1);
    G.sky.update(dt, p.pos);
    G.water.update(dt, G.sky);
    const pushers = [p.pos];
    for (const peer of G.peers.values()) if (pushers.length < 4) pushers.push(peer.pos);
    for (const e of G.enemies.list) if (pushers.length < 4 && e.pos.distanceTo(p.pos) < 30) pushers.push(e.pos);
    G.grass.update(dt, G.sky, pushers);
    G.hud.update(dt);
    G.guide.update(dt);
    G.audio.update(dt);
    this._dynamicResolution(rawDt);
    if (G.settings.fps) {
      this.fpsN = (this.fpsN || 0) + 1;
      this.fpsT = (this.fpsT || 0) + rawDt;
      if (this.fpsT >= 1) {
        const info = G.stats || { calls: 0, triangles: 0 };
        $('fps').textContent = `${Math.round(this.fpsN / this.fpsT)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris${this.resScale < 1 ? ` · res ${Math.round(this.resScale * 100)}%` : ''}`;
        this.fpsN = 0; this.fpsT = 0;
      }
    }
    if (G.input.hit('KeyF') && G.hud.dialogTimer > 0 && !p.interactTarget) G.hud.skipDialog();

    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 5; writeSave(); }
    this.netTimer -= dt;
    if (this.netTimer <= 0 && G.net?.connected) {
      this.netTimer = 1 / 15;
      G.net.send(p.netState());
    }
    G.input.endFrame();
    const speed = p.state === 'ride' ? Math.hypot(p.vel.x, p.vel.y, p.vel.z) : 0;
    this._render({
      speed: Math.max(0, Math.min(1, (speed - 24) / 14)),
      flurry: Math.min(1, (G.flurry || 0) * 3),
      hurt: p.hurtFlash > 0 ? p.hurtFlash * 2 : (p.hp <= 2 && p.alive ? 0.25 + Math.sin(G.time * 6) * 0.15 : 0),
      sat: this._saturation(dt),
      under: G.water.underwater(),
    });
  }

  // The Hueless King drains colour from the world while it lives; beating it floods colour back
  _saturation(dt) {
    const b = G.enemies.bossActive;
    let target = 1.12;
    if (b && b.type === 'hueless' && b.alive) target = b.status.stun > 0 ? 0.85 : 0.5;
    if (G.victoryGlow > 0) { G.victoryGlow -= dt; target = 1.12 + Math.min(0.5, G.victoryGlow * 0.12); }
    this.sat = this.sat === undefined ? 1.12 : this.sat + (target - this.sat) * Math.min(1, dt * 1.5);
    return this.sat;
  }

  // Dynamic resolution: lower the render scale when frames run slow, raise it again with headroom
  _dynamicResolution(dt) {
    if (G.settings.dynRes === false) {
      if (this.resScale !== 1) { this.resScale = 1; G.renderer.setPixelRatio(this.basePR); this._resize(); }
      return;
    }
    this.drN = (this.drN || 0) + 1;
    this.drT = (this.drT || 0) + dt;
    if (this.drT < 2) return;
    const fps = this.drN / this.drT;
    this.drN = 0; this.drT = 0;
    const before = this.resScale;
    if (fps < 45) this.resScale = Math.max(0.55, this.resScale - 0.1);
    else if (fps > 57) this.resScale = Math.min(1, this.resScale + 0.05);
    if (this.resScale !== before) { G.renderer.setPixelRatio(this.basePR * this.resScale); this._resize(); }
  }

  _render(fx) {
    if (G.post.enabled) G.post.render(G.scene, G.camera, G.sky, fx);
    else {
      G.renderer.render(G.scene, G.camera);
      G.stats = { calls: G.renderer.info.render.calls, triangles: G.renderer.info.render.triangles };
    }
    if (G.photo) G.photo.afterRender(G.renderer.domElement);
  }
}

new Game();

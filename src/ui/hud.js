// DOM overlay HUD: hearts, compass, prism trials, ink potions, stamina wheel, labels, map, chat.
import * as THREE from 'three';
import { G, COLORS, COUNTER } from '../core/ctx.js';
import { angleDiff } from '../core/math.js';
import { TRIALS, CITADEL, WAYPOINTS, WORLD_SIZE } from '../world/layout.js';
import { ELEMENTS } from '../enemies/enemies.js';

const $ = (id) => document.getElementById(id);
const HEART = 'M20 34 C 6 24 1 17 1 10.5 C 1 5 5 1 10.5 1 C 14.5 1 18 3.5 20 7 C 22 3.5 25.5 1 29.5 1 C 35 1 39 5 39 10.5 C 39 17 34 24 20 34 Z';
const PRISM_PATH = 'M15 1 L29 14 L15 41 L1 14 Z';
const PAD_LEGEND = [
  ['L stick', 'Move'], ['R stick', 'Look'], ['A', 'Jump · Glide · Interact'], ['B', 'Sprint · Boost'],
  ['X / RT', 'Strike · hold to spin'], ['LT', 'Aim (RT to flick)'], ['LB', 'Lock on (A to dodge)'], ['RB', 'Next colour'],
  ['D-pad', 'Pick colour'], ['Y', 'Ride the brush'], ['L3', 'Descend (riding)'], ['View', 'Map · Start: Pause'],
].map(([k, v]) => `<div><kbd>${k}</kbd> ${v}</div>`).join('');

export class HUD {
  constructor() {
    this.el = $('hud');
    this.hearts = $('hearts');
    this.compass = $('compass-strip');
    this.labels = $('labels');
    this.toasts = $('toasts');
    this.enemyLabels = new Map();
    this.peerLabels = new Map();
    this.lastHp = -1;
    this.lastMax = -1;
    this.wheelSel = 0;
    this.wheelVec = { x: 0, y: 0 };
    this.dialogTimer = 0;
    this.bannerTimer = 0;
    this._buildInks();
    this._buildPrisms();
    this._buildCompass();
    this._buildWheel();
    this.v = new THREE.Vector3();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && G.input?.enabled && G.input.locked) $('controls').classList.toggle('hidden');
    });
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  _buildInks() {
    const row = $('ink-row');
    this.potions = COLORS.map((c, i) => {
      const p = document.createElement('div');
      p.className = 'potion';
      p.innerHTML = `<div class="cork"></div><div class="neck"></div><div class="flask"><div class="fill" style="background:linear-gradient(${c.light}, ${c.css})"></div></div><div class="key">${i + 1}</div>`;
      row.appendChild(p);
      return { el: p, fill: p.querySelector('.fill') };
    });
    this.setColor(0);
  }

  setColor(i) {
    this.potions.forEach((p, k) => p.el.classList.toggle('active', k === i));
    const n = $('ink-name');
    n.textContent = COLORS[i].name.toUpperCase();
    n.style.background = `linear-gradient(90deg, ${COLORS[i].css}, ${COLORS[i].light})`;
  }

  inkShake(i) {
    const el = this.potions[i].el;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  _buildPrisms() {
    const box = $('prism-icons');
    this.prismEls = TRIALS.map((t) => {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 30 42');
      s.innerHTML = `<path d="${PRISM_PATH}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.85)" stroke-width="2"/><path d="M1 14 L29 14 M15 1 L15 41" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>`;
      box.appendChild(s);
      return { s, t };
    });
  }

  _buildCompass() {
    this.cmpItems = [];
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('div');
      d.className = 'cmp' + (i % 2 === 0 ? ' major' : '');
      d.textContent = dirs[i];
      this.compass.appendChild(d);
      this.cmpItems.push({ el: d, bearing: (i / 8) * Math.PI * 2 });
    }
    for (let i = 0; i < 24; i++) {
      if (i % 3 === 0) continue;
      const d = document.createElement('div');
      d.className = 'cmp tick';
      this.compass.appendChild(d);
      this.cmpItems.push({ el: d, bearing: (i / 24) * Math.PI * 2 });
    }
    this.markers = [];
    for (const t of TRIALS) {
      const c = COLORS[t.color];
      const d = document.createElement('div');
      d.className = 'cmp marker';
      d.innerHTML = `<div class="ic diamond" style="background:${c.css}"></div><div class="dist"></div>`;
      this.compass.appendChild(d);
      this.markers.push({ el: d, dist: d.querySelector('.dist'), pos: () => ({ x: t.x, z: t.z }), show: () => true, done: () => G.flags[`trial_${t.key}`] });
    }
    const cit = document.createElement('div');
    cit.className = 'cmp marker';
    cit.innerHTML = '<div class="ic" style="background:#6a4a9a">♛</div><div class="dist"></div>';
    this.compass.appendChild(cit);
    this.markers.push({ el: cit, dist: cit.querySelector('.dist'), pos: () => ({ x: CITADEL.x, z: CITADEL.z }), show: () => !G.flags.final });
  }

  _peerMarker(peer) {
    const d = document.createElement('div');
    d.className = 'cmp marker';
    d.innerHTML = `<div class="ic" style="background:#${peer.look.hood.toString(16).padStart(6, '0')}">${(peer.name[0] || '?').toUpperCase()}</div><div class="dist"></div>`;
    this.compass.appendChild(d);
    const m = { el: d, dist: d.querySelector('.dist'), pos: () => peer.pos, show: () => true, peer };
    this.markers.push(m);
    return m;
  }

  removePeer(peer) {
    const i = this.markers.findIndex((m) => m.peer === peer);
    if (i >= 0) { this.markers[i].el.remove(); this.markers.splice(i, 1); }
    const l = this.peerLabels.get(peer.id);
    if (l) { l.remove(); this.peerLabels.delete(peer.id); }
  }

  _buildWheel() {
    const w = $('wheel');
    this.wheelSegs = COLORS.map((c, i) => {
      const s = document.createElement('div');
      s.className = 'seg';
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      s.style.left = `${150 + Math.cos(a) * 95 - 45}px`;
      s.style.top = `${150 + Math.sin(a) * 95 - 45}px`;
      s.style.background = c.css;
      s.textContent = c.name;
      w.appendChild(s);
      return s;
    });
  }

  openWheel(cur) {
    $('wheel').classList.remove('hidden');
    this.wheelSel = cur;
    this.wheelVec = { x: 0, y: 0 };
    this.wheelOpen = true;
    this._wheelHighlight();
  }

  wheelMove(dx, dy) {
    if (!this.wheelOpen) return;
    this.wheelVec.x += dx;
    this.wheelVec.y += dy;
    const l = Math.hypot(this.wheelVec.x, this.wheelVec.y);
    if (l > 30) {
      const a = Math.atan2(this.wheelVec.y, this.wheelVec.x) + Math.PI / 2;
      this.wheelSel = ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4;
      this.wheelVec.x *= 60 / l;
      this.wheelVec.y *= 60 / l;
      this._wheelHighlight();
    }
  }

  _wheelHighlight() { this.wheelSegs.forEach((s, i) => s.classList.toggle('sel', i === this.wheelSel)); }

  closeWheel() {
    if (!this.wheelOpen) return null;
    this.wheelOpen = false;
    $('wheel').classList.add('hidden');
    return this.wheelSel;
  }

  showCrosshair(v) { $('crosshair').classList.toggle('hidden', !v); }

  setPrompt(text) {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    p.querySelector('span').textContent = text;
    p.querySelector('kbd').textContent = G.input && G.input.usingPad ? 'A' : 'F';
  }

  toast(text, color = '#fff', dur = 2.2) {
    // Avoid spamming identical toasts
    const last = this.toasts.lastElementChild;
    if (last && last.textContent === text) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    d.style.color = color;
    this.toasts.appendChild(d);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => d.remove(), dur * 1000);
  }

  banner(title, sub, color = '#fff') {
    const b = $('banner');
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    b.querySelector('.t').textContent = title;
    b.querySelector('.t').style.color = color;
    b.querySelector('.s').textContent = sub || '';
    this.bannerTimer = 4;
  }

  dialog(name, text) {
    const d = $('dialog');
    d.classList.remove('hidden');
    d.querySelector('.name').textContent = name;
    d.querySelector('.text').textContent = text;
    this.dialogTimer = 7;
    this.choiceCb = null;
    d.querySelector('.hint').textContent = 'F to continue';
  }

  // Multiple-choice dialog; answered with number keys / D-pad (see Game loop)
  choice(name, text, options, cb) {
    const d = $('dialog');
    d.classList.remove('hidden');
    d.querySelector('.name').textContent = name;
    d.querySelector('.text').innerHTML = '';
    d.querySelector('.text').append(text);
    const list = document.createElement('div');
    list.className = 'choices';
    options.forEach((o, i) => {
      const b = document.createElement('div');
      b.innerHTML = `<kbd>${G.input.usingPad ? ['↑', '→', '↓'][i] || i + 1 : i + 1}</kbd> `;
      b.append(o);
      list.appendChild(b);
    });
    d.querySelector('.text').appendChild(list);
    d.querySelector('.hint').textContent = 'Choose an option';
    this.choiceCb = cb;
    this.choiceN = options.length;
    this.dialogTimer = 1e9;
  }

  answerChoice(i) {
    if (!this.choiceCb || i >= this.choiceN) return;
    const cb = this.choiceCb;
    this.choiceCb = null;
    this.dialogTimer = 0;
    $('dialog').querySelector('.hint').textContent = 'F to continue';
    cb(i);
  }

  flash(color) {
    const f = $('flash');
    f.style.transition = 'none';
    f.style.background = color;
    requestAnimationFrame(() => {
      f.style.transition = 'background 0.5s';
      f.style.background = 'transparent';
    });
  }

  project(pos) {
    this.v.copy(pos).project(G.camera);
    if (this.v.z > 1) return null;
    return { x: (this.v.x * 0.5 + 0.5) * innerWidth, y: (-this.v.y * 0.5 + 0.5) * innerHeight };
  }

  damageNumber(pos, text, color = '#fff', big = false) {
    const s = this.project(pos);
    if (!s) return;
    const d = document.createElement('div');
    d.className = 'dmg' + (big ? ' big' : '');
    d.style.left = `${s.x + (Math.random() - 0.5) * 30}px`;
    d.style.top = `${s.y}px`;
    d.style.color = color;
    d.textContent = text;
    this.labels.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  chat(name, text, color = '#fff') {
    const log = $('chat-log');
    const d = document.createElement('div');
    d.innerHTML = `<b style="color:${color}"></b> <span></span>`;
    d.querySelector('b').textContent = name ? `${name}:` : '';
    d.querySelector('span').textContent = text;
    log.appendChild(d);
    while (log.children.length > 7) log.firstChild.remove();
    setTimeout(() => { d.style.transition = 'opacity 1s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 1000); }, 12000);
  }

  victory() {
    $('victory').classList.remove('hidden');
    G.input.unlock();
  }

  // ------------------------------------------------------------ per-frame
  update(dt) {
    const p = G.player;
    if (!p) return;
    // Hearts
    if (p.hp !== this.lastHp || p.maxHp !== this.lastMax) {
      this.lastHp = p.hp; this.lastMax = p.maxHp;
      let html = '';
      for (let i = 0; i < p.maxHp / 2; i++) {
        const v = Math.max(0, Math.min(2, p.hp - i * 2));
        const id = `hc${i}`;
        const fill = v === 2 ? '#ff3a4a' : v === 1 ? `url(#${id})` : 'rgba(40,20,30,0.7)';
        html += `<svg viewBox="0 0 40 36"><defs><linearGradient id="${id}"><stop offset="50%" stop-color="#ff3a4a"/><stop offset="50%" stop-color="rgba(40,20,30,0.7)"/></linearGradient></defs><path d="${HEART}" fill="${fill}" stroke="#fff" stroke-width="2.5"/><path d="M9 8 Q 12 5 15 7" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
      }
      this.hearts.innerHTML = html;
    }
    // Inks
    this.potions.forEach((pt, i) => { pt.fill.style.height = `${p.ink[i]}%`; });
    // Prisms
    let done = 0;
    for (const { s, t } of this.prismEls) {
      const ok = !!G.flags[`trial_${t.key}`];
      if (ok) done++;
      const path = s.querySelector('path');
      path.setAttribute('fill', ok ? COLORS[t.color].css : 'rgba(255,255,255,0.08)');
      s.style.filter = ok ? `drop-shadow(0 0 6px ${COLORS[t.color].css})` : '';
    }
    $('prism-count').textContent = `${done} / 4`;

    // Compass
    const heading = -p.camYaw;
    const w = this.compass.clientWidth;
    const fov = Math.PI * 0.9;
    const place = (el, bearing) => {
      const d = angleDiff(heading, bearing);
      if (Math.abs(d) > fov / 2) { el.style.display = 'none'; return false; }
      el.style.display = '';
      el.style.left = `${w / 2 + (d / (fov / 2)) * (w / 2)}px`;
      return true;
    };
    for (const it of this.cmpItems) place(it.el, it.bearing);
    for (const m of this.markers) {
      if (!m.show()) { m.el.style.display = 'none'; continue; }
      const t = m.pos();
      const dx = t.x - p.pos.x, dz = t.z - p.pos.z;
      const bearing = Math.atan2(dx, -dz);
      if (place(m.el, bearing)) {
        m.dist.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
        m.el.style.opacity = m.done && m.done() ? 0.45 : 1;
      }
    }
    // Peers on compass
    if (G.peers) for (const peer of G.peers.values()) if (!this.markers.find((m) => m.peer === peer)) this._peerMarker(peer);

    // Stamina ring
    const st = $('stamina');
    const frac = p.stamina / p.maxStamina;
    const circ = 2 * Math.PI * 22;
    $('stamina-fg').setAttribute('stroke-dasharray', `${circ * frac} ${circ}`);
    st.classList.toggle('exhausted', p.exhausted);
    st.style.opacity = frac < 0.999 ? 1 : 0;
    const sp = this.project(p.pos.clone().setY(p.pos.y + 1.3));
    if (sp) { st.style.left = `${sp.x + 50}px`; st.style.top = `${sp.y - 40}px`; }

    // Enemy labels
    const seen = new Set();
    const boss = G.enemies.bossActive;
    for (const e of G.enemies.list) {
      if (!e.alive || e.boss) continue;
      const show = e === p.lock || G.time - e.lastHit < 5;
      if (!show || e.pos.distanceTo(p.pos) > 60) continue;
      const s = this.project(e.pos.clone().setY(e.pos.y + e.height + 0.6));
      if (!s) continue;
      seen.add(e.id);
      let l = this.enemyLabels.get(e.id);
      if (!l) {
        l = document.createElement('div');
        l.className = 'elabel';
        l.innerHTML = `<div class="n"></div><div class="b"><div></div></div><div class="lock"></div>`;
        l.querySelector('.n').textContent = e.name.toUpperCase();
        this.labels.appendChild(l);
        this.enemyLabels.set(e.id, l);
      }
      l.style.left = `${s.x}px`;
      l.style.top = `${s.y}px`;
      l.querySelector('.b div').style.width = `${(100 * e.hp) / e.maxHp}%`;
      l.querySelector('.lock').textContent = e === p.lock ? '▼' : '';
    }
    for (const [id, l] of this.enemyLabels) if (!seen.has(id)) { l.remove(); this.enemyLabels.delete(id); }
    // Lock indicator on a boss
    if (p.lock && p.lock.boss) {
      const s = this.project(p.lock.pos.clone().setY(p.lock.pos.y + p.lock.height + 1));
      let l = this.enemyLabels.get('bosslock');
      if (!l) { l = document.createElement('div'); l.className = 'elabel'; l.innerHTML = '<div class="lock">▼</div>'; this.labels.appendChild(l); this.enemyLabels.set('bosslock', l); }
      if (s) { l.style.left = `${s.x}px`; l.style.top = `${s.y}px`; }
    }

    // Peer nameplates
    if (G.peers) {
      for (const peer of G.peers.values()) {
        let l = this.peerLabels.get(peer.id);
        if (!l) {
          l = document.createElement('div');
          l.className = 'plabel';
          l.innerHTML = '<div class="nm"></div><div class="hp"></div>';
          l.querySelector('.nm').textContent = peer.name;
          this.labels.appendChild(l);
          this.peerLabels.set(peer.id, l);
        }
        const s = peer.pos.distanceTo(p.pos) < 250 ? this.project(peer.pos.clone().setY(peer.pos.y + 2.3)) : null;
        l.style.display = s ? '' : 'none';
        if (s) {
          l.style.left = `${s.x}px`; l.style.top = `${s.y}px`;
          l.querySelector('.hp').textContent = peer.state === 'dead' ? 'fainted' : '♥'.repeat(Math.ceil((peer.hp || 0) / 2));
        }
      }
    }

    // Boss bar
    const bb = $('bossbar');
    if (boss) {
      bb.classList.remove('hidden');
      bb.querySelector('.name').textContent = boss.name.toUpperCase();
      bb.querySelector('.fill').style.width = `${(100 * boss.hp) / boss.maxHp}%`;
      bb.querySelector('.armor').style.width = boss.type === 'frostmaw' ? `${(100 * boss.armor) / 50}%` : '0%';
      bb.querySelector('.mech').innerHTML = this._bossMech(boss);
    } else bb.classList.add('hidden');

    this.dialogTimer -= dt;
    if (this.dialogTimer <= 0) $('dialog').classList.add('hidden');
    this.bannerTimer -= dt;
    if (this.bannerTimer <= 0) $('banner').classList.add('hidden');

    // Altitude & speed while flying or gliding
    const fl = $('flight');
    const flying = p.state === 'ride' || p.state === 'glide';
    fl.classList.toggle('hidden', !flying);
    if (flying) {
      const g = G.collision.groundAt(p.pos.x, p.pos.z, 0.3, p.pos.y);
      const ground = Math.max(g.y, p.inDungeon ? g.y : 0);
      $('fl-alt').textContent = Math.max(0, Math.round(p.pos.y - ground));
      $('fl-spd').textContent = Math.round(Math.hypot(p.vel.x, p.vel.y, p.vel.z));
    }

    // Swap the controls legend when a gamepad is in use
    const pad = !!G.input.usingPad;
    if (pad !== this._padLegend) {
      this._padLegend = pad;
      $('controls').querySelector('.grid').innerHTML = pad ? PAD_LEGEND : this._kbLegend || ($('controls').querySelector('.grid').innerHTML);
    }
    if (!this._kbLegend && !pad) this._kbLegend = $('controls').querySelector('.grid').innerHTML;

    // Net status
    if (G.net) {
      const n = (G.peers ? G.peers.size : 0) + 1;
      $('net-status').textContent = G.net.connected ? `Room "${G.net.room}" · ${n} player${n > 1 ? 's' : ''}${G.net.isHost ? ' · host' : ''}` : 'Solo (offline)';
    }
  }

  _bossMech(b) {
    const col = (i) => `<span style="color:${COLORS[i].light}">${COLORS[i].name}</span>`;
    switch (b.type) {
      case 'frostmaw': return b.armor > 0 ? `Ice armour · melt it with ${col(0)}` : '<span style="color:#fff38a">Armour broken - attack!</span>';
      case 'magmaw': return b.status.frozen > 0 ? '<span style="color:#9ee0ff">Frozen solid - attack!</span>' : `White-hot · cool it with ${col(1)} (${Math.round(b.meter)}%)`;
      case 'shellback': return b.status.stun > 0 ? '<span style="color:#fff38a">Flipped - hit its belly!</span>' : `Armoured shell · flip it with ${col(2)} (or lure it onto a bounce pad)`;
      case 'galewing': return b.status.rooted > 0 ? '<span style="color:#a8f08c">Grounded - attack!</span>' : `Airborne · tangle it with ${col(3)}`;
      case 'hueless': {
        if (b.shieldHp <= 0) return '<span style="color:#fff">Shield shattered - paint it back!</span>';
        const need = ELEMENTS.indexOf(COUNTER[ELEMENTS[b.shield]]);
        return `${col(b.shield)} shield ${'◆'.repeat(b.shieldHp)} · break it with ${col(need)}`;
      }
      default: return '';
    }
  }

  // ------------------------------------------------------------ map
  openMap() {
    const m = $('map');
    m.classList.remove('hidden');
    if (!this.mapDrawn) {
      this.mapDrawn = true;
      const src = G.terrain.renderMapCanvas(320);
      const cv = $('map-canvas');
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
    }
    this.renderMapMarkers();
  }

  closeMap() { $('map').classList.add('hidden'); }

  renderMapMarkers() {
    const box = $('map-markers');
    box.innerHTML = '';
    const toPct = (x, z) => [((x + WORLD_SIZE / 2) / WORLD_SIZE) * 100, ((z + WORLD_SIZE / 2) / WORLD_SIZE) * 100];
    const add = (x, z, cls, color, label, onClick) => {
      const [l, t] = toPct(x, z);
      const d = document.createElement('div');
      d.className = `mm ${cls}`;
      d.style.left = `${l}%`;
      d.style.top = `${t}%`;
      d.innerHTML = `<div class="dot" style="background:${color}"></div><div></div>`;
      d.lastChild.textContent = label;
      if (onClick) d.addEventListener('click', onClick);
      box.appendChild(d);
      return d;
    };
    for (const t of TRIALS) add(t.x, t.z, 'trial', COLORS[t.color].css, `${t.name}${G.flags[`trial_${t.key}`] ? ' ✓' : ''}`);
    add(CITADEL.x, CITADEL.z, 'cit', '#6a4a9a', 'Sky Citadel');
    for (const w of WAYPOINTS) {
      const on = !!G.flags[`wp_${w.key}`];
      add(w.x, w.z, `wp${on ? '' : ' off'}`, '', w.name, on ? () => { G.game.fastTravel(w); } : null);
    }
    if (G.peers) for (const peer of G.peers.values()) add(peer.pos.x, peer.pos.z, 'peer', `#${peer.look.hood.toString(16).padStart(6, '0')}`, peer.name);
    const p = G.player;
    const me = add(p.pos.x, p.pos.z, 'me', '', 'You');
    me.querySelector('.dot').style.transform = `rotate(${-p.camYaw}rad)`;
  }
}

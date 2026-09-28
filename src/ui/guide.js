// Contextual one-time tips and the current-objective tracker.
import { G } from '../core/ctx.js';
import { keyFor } from './access.js';
import { TRIALS, CITADEL } from '../world/layout.js';
import { shardCount, spriteCount } from '../core/progress.js';

const $ = (id) => document.getElementById(id);

const KB = {
  attack: 'LMB', aim: 'RMB', colour: '1-4',
  get lock() { return keyFor('KeyQ'); }, get jump() { return keyFor('Space'); }, get ride() { return keyFor('KeyR'); },
  get interact() { return keyFor('KeyF'); }, get map() { return keyFor('KeyM'); }, get sprint() { return keyFor('ShiftLeft'); }, get descend() { return keyFor('KeyC'); },
};
const PAD = { attack: 'X', aim: 'LT', lock: 'LB', jump: 'A', ride: 'Y', interact: 'A', colour: 'D-pad', map: 'View', sprint: 'B', descend: 'L3' };
const k = (a) => `<kbd>${(G.input && G.input.usingPad ? PAD : KB)[a]}</kbd>`;

const TIPS = {
  move: () => `Welcome to Palette Hollow! Talk to the villagers (${k('interact')}), then follow the coloured beams.`,
  enemy: () => `An enemy! ${k('lock')} locks on, ${k('attack')} strikes (hold to spin), and ${k('jump')} while locked on dodges. Dodging at the last moment triggers a Flurry Rush!`,
  paint: () => `Hold ${k('aim')} to aim and tap ${k('attack')} to flick paint. Each colour does something different: try them on enemies and the world.`,
  fall: () => `Falling! Press ${k('jump')} in the air to open your glider, or ${k('ride')} to ride your brush.`,
  ride: () => `Riding the brush: aim with the camera, hold forward, ${k('sprint')} to boost, ${k('jump')} to rise and ${k('descend')} to sink. It drains stamina slowly.`,
  ink: () => 'Running low on ink! Brush past glowing ink flowers or defeat enemies to refill.',
  shrine: () => `A Prism Trial! Press ${k('interact')} to enter. Each trial's puzzle is built around its colour.`,
  camp: () => 'An enemy camp. Clear it out to open its treasure chest.',
  sprite: () => 'A Paint Sprite is hiding nearby... Look for odd rocks, grey flower rings, withered saplings, sky hoops and sparkling peaks.',
  water: () => `Swimming. Hold ${k('sprint')} to swim faster, but watch your stamina.`,
  map: () => `Easels you visit become fast-travel points. Open the map with ${k('map')}.`,
  tower: () => `A Painter's Tower! Its winds ground your brush. Paint vines (green) on the moss, bounce (yellow) from the ledge, then vine up the crown and paint the easel to reveal the map.`,
  pshrine: () => `A Paint Shrine. Step through the arch with ${k('interact')}: a small colour puzzle with a Paint Sprite inside.`,
  buck: () => `Brushbucks! Sneak up (${k('descend')}) and press ${k('interact')} to climb on, then hold on while it bucks. It costs stamina.`,
  cold: () => 'Freezing! Eat a spicy (Bold) meal to stay warm, or stand by an easel.',
};

export class Guide {
  constructor() {
    try { this.seen = new Set(JSON.parse(localStorage.getItem('witchery.tips') || '[]')); } catch (_) { this.seen = new Set(); }
    this.timer = 0;
    this.queue = [];
    this.showT = 0;
    this.objTimer = 0;
  }

  tip(key) {
    if (this.seen.has(key) || this.queue.includes(key)) return;
    this.queue.push(key);
  }

  _save() {
    try { localStorage.setItem('witchery.tips', JSON.stringify([...this.seen])); } catch (_) { /* ignore */ }
  }

  _checkTriggers() {
    const p = G.player;
    if (!p || !p.alive) return;
    if (G.time > 4) this.tip('move');
    if (G.enemies.list.some((e) => e.alive && !e.boss && e.pos.distanceTo(p.pos) < 22)) this.tip('enemy');
    if (G.enemies.list.some((e) => e.alive && e.pos.distanceTo(p.pos) < 35) && this.seen.has('enemy')) this.tip('paint');
    if (p.state === 'air' && p.vel.y < -12) this.tip('fall');
    if (p.state === 'ride') this.tip('ride');
    if (p.ink.some((v) => v < 20)) this.tip('ink');
    if (TRIALS.some((t) => Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < 25)) this.tip('shrine');
    if (G.enemies.decor && G.enemies.decor.items.some((it) => it.pos.distanceTo(p.pos) < 40)) this.tip('camp');
    if (G.towers && G.towers.list.some((t) => !G.towers.active(t.i) && Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < 45)) this.tip('tower');
    if (G.shrines && G.shrines.list.some((sh) => !p.inDungeon && sh.surface.distanceTo(p.pos) < 20)) this.tip('pshrine');
    if (G.steeds && !G.steeds.mine && G.steeds.list.some((b) => b.pos.distanceTo(p.pos) < 30)) this.tip('buck');
    if (G.climate && G.climate.kind < 0 && G.climate.exposure > 1) this.tip('cold');
    if (G.sprites && G.sprites.list.some((s) => !s.done && s.pos.distanceTo(p.pos) < 18)) this.tip('sprite');
    if (p.state === 'swim') this.tip('water');
    if (Object.keys(G.flags).filter((f) => f.startsWith('wp_')).length > 1) this.tip('map');
  }

  _objective() {
    const p = G.player;
    const shards = shardCount();
    let title, sub = '';
    if (shards < 4) {
      title = `Clear the Prism Trials (${shards}/4)`;
      let best = null, bd = Infinity;
      for (const t of TRIALS) {
        if (G.flags[`trial_${t.key}`]) continue;
        const d = Math.hypot(p.pos.x - t.x, p.pos.z - t.z);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) sub = `Nearest: ${best.name} · ${Math.round(bd)} m`;
    } else if (!G.flags.final) {
      title = 'Defeat the Hueless King';
      sub = `Ride to the Sky Citadel · ${Math.round(Math.hypot(p.pos.x - CITADEL.x, p.pos.z - CITADEL.z))} m`;
    } else {
      title = 'Colour restored!';
      sub = `Paint Sprites found: ${spriteCount()}/${G.sprites ? G.sprites.total : 42}`;
    }
    const side = this._side(p);
    const html = `<div class="ot">${title}</div><div class="os">${sub}</div>${side ? `<div class="os side">${side}</div>` : ''}`;
    if (html !== this._objHtml) { this._objHtml = html; $('objective').innerHTML = html; }
  }

  // A nearby side goal worth doing next: towers first (they reveal the map), then shrines
  _side(p) {
    if (p.inDungeon) return '';
    const near = (list, pos) => list.map((it) => [it, Math.hypot(p.pos.x - pos(it).x, p.pos.z - pos(it).z)]).sort((a, b) => a[1] - b[1])[0];
    if (G.towers) {
      const t = near(G.towers.list.filter((q) => !G.towers.active(q.i)), (q) => q);
      if (t && t[1] < 450) return `Side: climb the ${t[0].name} · ${Math.round(t[1])} m`;
    }
    if (G.shrines) {
      const s = near(G.shrines.list.filter((q) => !G.shrines.cleared(q.i)), (q) => q.site);
      if (s && s[1] < 350) return `Side: ${s[0].def.name} · ${Math.round(s[1])} m`;
    }
    return '';
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = 0.5; this._checkTriggers(); }
    this.objTimer -= dt;
    if (this.objTimer <= 0) { this.objTimer = 0.5; this._objective(); }
    const box = $('tip');
    if (this.showT > 0) {
      this.showT -= dt;
      if (this.showT <= 0) box.classList.add('hidden');
    } else if (this.queue.length) {
      const key = this.queue.shift();
      this.seen.add(key);
      this._save();
      box.innerHTML = `<span class="tl">TIP</span> ${TIPS[key]()}`;
      box.classList.remove('hidden');
      this.showT = 9;
    }
  }
}

// Bounty board: a noticeboard at the edge of the plaza posts three odd jobs every twenty minutes
// (defeat some ink creatures, catch fish or critters, cook, race, take a photo). The posting is worked out from the
// wall clock, so friends in a room see the same notices; progress and rewards are your own and kept
// in your local save. Finished bounties are paid out at the board.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { mulberry32 } from '../core/math.js';
import { VILLAGE } from './layout.js';
import { MAT } from './props.js';

export const POST_MS = 20 * 60 * 1000;
export const postIndex = (now = Date.now()) => Math.floor(now / POST_MS);
export const BOARD_ANGLE = Math.PI;

export const JOBS = [
  { id: 'inkling', kind: 'foe', type: 'inkling', n: 6, pig: 8, text: 'Defeat 6 Inklings' },
  { id: 'bounder', kind: 'foe', type: 'bounder', n: 4, pig: 8, text: 'Defeat 4 Bounders' },
  { id: 'spitter', kind: 'foe', type: 'spitter', n: 3, pig: 9, text: 'Defeat 3 Spitters' },
  { id: 'archer', kind: 'foe', type: 'archer', n: 2, pig: 10, text: 'Defeat 2 Inkshots' },
  { id: 'knight', kind: 'foe', type: 'knight', n: 1, pig: 14, text: 'Defeat an Ink Knight' },
  { id: 'inkspout', kind: 'foe', type: 'inkspout', n: 2, pig: 12, text: 'Defeat 2 Inkspouts' },
  { id: 'sentry', kind: 'foe', type: 'sentry', n: 1, pig: 12, text: 'Topple a Ruin Sentry' },
  { id: 'fish', kind: 'fish', n: 3, pig: 8, text: 'Catch 3 fish from the ice' },
  { id: 'critter', kind: 'critter', n: 2, pig: 8, text: 'Catch 2 critters' },
  { id: 'cook', kind: 'cook', n: 2, pig: 6, text: 'Cook 2 meals' },
  { id: 'race', kind: 'race', n: 1, pig: 8, text: 'Finish any Sky Race' },
  { id: 'snapbuck', kind: 'photo', type: 'brushbuck', n: 1, pig: 8, text: 'Photograph a Brushbuck' },
  { id: 'snapfish', kind: 'photo', type: 'fish', n: 1, pig: 7, text: 'Photograph a Glimmerfish' },
  { id: 'snapknight', kind: 'photo', type: 'knight', n: 1, pig: 10, text: 'Photograph an Ink Knight' },
];

// The three notices for a posting: always at least one that isn't a fight
export function pickJobs(post) {
  const rand = mulberry32(post * 7919 + 13);
  const pool = [...JOBS];
  const out = [];
  while (out.length < 3) {
    const j = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (out.length === 2 && out.every((q) => q.kind === 'foe') && j.kind === 'foe') continue;
    out.push(j);
  }
  return out;
}

export class Bounties {
  constructor(scene) {
    this.post = -1;
    this.jobs = [];
    this.prog = [0, 0, 0];
    this.claimed = [false, false, false];
    this.seen = new Set(); // enemy ids already counted
    const R = 17.6, a = BOARD_ANGLE;
    const x = VILLAGE.x + Math.cos(a) * R, z = VILLAGE.z + Math.sin(a) * R;
    const y = G.terrain.heightAt(x, z);
    this.pos = new THREE.Vector3(x, y, z);
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6), MAT.woodDark);
      post.position.set(s * 1.2, 1.3, 0);
      g.add(post);
    }
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 0.12), MAT.wood);
    board.position.y = 1.75;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.6), MAT.woodDark);
    roof.position.set(0, 2.62, 0.08);
    roof.rotation.x = 0.35;
    g.add(board, roof);
    // Three paper notices; the ones you've been paid for are taken down
    this.notes = [0, 1, 2].map((i) => {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshLambertMaterial({ color: 0xf2e6c8, side: THREE.DoubleSide }));
      n.position.set(-0.8 + i * 0.8, 1.75 + (i === 1 ? 0.06 : -0.04), 0.07);
      n.rotation.z = (i - 1) * 0.08;
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshLambertMaterial({ color: [0xe8442e, 0x3a9ae8, 0xf2c229][i] }));
      pin.position.set(0, 0.32, 0.02);
      n.add(pin);
      g.add(n);
      return n;
    });
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    g.position.copy(this.pos);
    g.rotation.y = Math.atan2(VILLAGE.x - x, VILLAGE.z - z);
    scene.add(g);
    this.group = g;
    G.world.col?.addBox(x, y + 1.3, z, 1.4, 1.3, 0.3);
    G.world.interactables.push({
      pos: this.pos.clone().setY(y + 1.2), radius: 3,
      enabled: () => !G.player.inDungeon,
      prompt: () => (this.claimable() ? 'Collect a bounty' : 'Read the bounty board'),
      action: () => this.open(),
    });
    this.marker = G.hud.addMarker('<div class="ic" style="background:#b8864a">📜</div>', () => this.pos, () => this.claimable() > 0 && this.pos.distanceTo(G.player.pos) < 250);
    this._refresh();
  }

  claimable() { return this.jobs.filter((j, i) => !this.claimed[i] && this.prog[i] >= j.n).length; }

  _refresh(now = Date.now()) {
    const post = postIndex(now);
    if (post === this.post) return;
    this.post = post;
    this.jobs = pickJobs(post);
    this.prog = [0, 0, 0];
    this.claimed = [false, false, false];
    this._notes();
  }

  _notes() { this.notes.forEach((n, i) => { n.visible = !this.claimed[i]; }); }

  // Something happened that a bounty might care about
  event(kind, type) {
    this._refresh();
    this.jobs.forEach((j, i) => {
      if (j.kind !== kind || (j.type && j.type !== type) || this.claimed[i] || this.prog[i] >= j.n) return;
      this.prog[i]++;
      if (this.prog[i] >= j.n) {
        G.audio.play('glint');
        G.hud.toast(`📜 Bounty done: ${j.text}. Collect ${j.pig} Pigment at the board in Palette Hollow.`, '#e8c890', 3.5);
      }
    });
  }

  // An ink creature fell near you (anyone in the room may have landed the blow)
  onFoe(e) {
    if (!G.player || e.type === 'dummy' || this.seen.has(e.id)) return;
    if (e.pos.distanceTo(G.player.pos) > 60) return;
    this.seen.add(e.id);
    if (this.seen.size > 200) this.seen = new Set([...this.seen].slice(-100));
    this.event('foe', e.type);
  }

  open() {
    this._refresh();
    const left = Math.ceil((POST_MS - (Date.now() % POST_MS)) / 60000);
    const rows = this.jobs.map((j, i) => {
      if (this.claimed[i]) return `✓ ${j.text} (paid)`;
      if (this.prog[i] >= j.n) return `★ Collect: ${j.text} · ${j.pig} Pigment`;
      return `${j.text} · ${this.prog[i]}/${j.n} · ${j.pig} Pigment`;
    });
    G.hud.choice('Bounty Board', `New notices in ${left} min. Finished jobs are paid here.`, [...rows, 'Leave'], (k) => {
      if (k >= 3) return;
      const j = this.jobs[k];
      if (this.claimed[k] || this.prog[k] < j.n) { if (!this.claimed[k]) G.hud.toast(`${j.text}: ${this.prog[k]}/${j.n}`, '#e8c890', 2); return; }
      this.claimed[k] = true;
      G.player.pigment += j.pig;
      G.audio.play('shard');
      G.hud.toast(`📜 Bounty paid: +${j.pig} Pigment`, '#ffe08a', 2.5);
      G.honours?.event('bounty');
      this._notes();
    });
  }

  mapMarkers(add) {
    const n = this.claimable();
    add(this.pos.x, this.pos.z, 'mq', '#b8864a', n ? `📜 ${n} bount${n > 1 ? 'ies' : 'y'} to collect` : 'Bounty board');
  }

  update() {
    if (G.time - (this._t || 0) < 1) return;
    this._t = G.time;
    this._refresh();
  }

  serialize() { return { post: this.post, prog: this.prog, claimed: this.claimed }; }
  load(d) {
    if (!d || d.post !== postIndex()) return; // an old posting: its notices are long gone
    if (Array.isArray(d.prog)) this.prog = [0, 1, 2].map((i) => Math.max(0, Math.min(99, Number(d.prog[i]) || 0)));
    if (Array.isArray(d.claimed)) this.claimed = [0, 1, 2].map((i) => !!d.claimed[i]);
    this._notes();
  }
}

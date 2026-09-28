// Painted Tablets: twelve weathered stone slabs across the island, each carrying a fragment of the
// island's story. Reading one adds it to the journal in your satchel (kept in your local save).
import * as THREE from 'three';
import { G, COLORS } from '../core/ctx.js';
import { puzzleSites } from './puzzles.js';
import { MAT } from './props.js';

export const TABLETS = [
  { title: 'The First Stroke', text: 'Before the island there was only grey sea and grey sky. The first Painter dipped a brush in the dawn and drew a single line, and the line became a shore.' },
  { title: 'Four Pigments', text: 'From the volcano came Ember, from the northern ice came Frost, from the golden mesas Spring, and from the deep forest Bloom. Mixed together, they made everything else.' },
  { title: 'The Prism', text: 'The Painters built a great prism above Palette Hollow to hold the four pigments in balance. While it shone, no colour could fade.' },
  { title: 'The Brushwrights', text: 'Every Painter carried a brush grown from a single bristle of the first brush. It is said a good brush remembers every stroke it has ever made.' },
  { title: 'The Colourless One', text: 'One apprentice wanted a world with no mistakes in it. He learned that the only painting without errors is a blank canvas, and began to erase.' },
  { title: 'The Hueless King', text: 'He drank the colour out of the sky until he could hold no more, and crowned himself with the grey. The ink creatures are what drips from his robes.' },
  { title: 'Breaking the Prism', text: 'He broke the prism into four shards and hid each one in a trial of its own colour, guarded by a beast that could only be beaten by its opposite.' },
  { title: 'The Opposites', text: 'Ember melts Frost. Frost douses Ember. Bloom tangles Spring. Spring shakes off Bloom. Every colour has a partner that undoes it. That is the balance.' },
  { title: 'The Sky Citadel', text: 'The King raised his citadel on a shard of stolen sky and sealed it behind the prism\'s broken light. Only when all four shards shine again will the seal fall.' },
  { title: 'The Grey Moon', text: 'On some nights his power swells, and a violet moon rises. The erased things stir and walk again until dawn paints them away.' },
  { title: 'The Chroma Wyrm', text: 'The first Painter\'s last stroke was never finished. It still flies around the island, looping through the clouds, shedding scales of pure colour for whoever can catch them.' },
  { title: 'To Whoever Reads This', text: 'If you are reading these, you carry a brush. Paint boldly. Mistakes are only colours you did not plan for.' },
];

export class Tablets {
  constructor(scene) {
    this.read = new Set();
    this.root = new THREE.Group();
    scene.add(this.root);
    const taken = [...(G.puzzles ? G.puzzles.list.map((p) => ({ x: p.pos.x, z: p.pos.z })) : [])];
    const sites = puzzleSites(G.terrain, TABLETS.length, 1313, taken).map((s) => ({ ...s }));
    this.items = sites.map((s, i) => this._build(i, s));
  }

  _build(i, s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = (i * 2.3) % (Math.PI * 2);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.35), MAT.stoneDark);
    slab.position.y = 1.0;
    slab.rotation.z = ((i % 3) - 1) * 0.06;
    slab.castShadow = true;
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.42, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS[i % 4].hex).multiplyScalar(1.4) }));
    glyph.position.set(0, 1.25, 0.18);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.3, 7), MAT.stone);
    base.position.y = 0.1;
    g.add(slab, glyph, base);
    this.root.add(g);
    G.collision.addCylinder(s.x, s.z, 0.9, s.y, s.y + 2.1);
    const item = { i, g, glyph, pos: new THREE.Vector3(s.x, s.y + 1, s.z) };
    G.world.interactables.push({
      pos: item.pos, radius: 3,
      prompt: () => (this.read.has(i) ? `Reread "${TABLETS[i].title}"` : 'Read the painted tablet'),
      action: () => this.open(i),
    });
    return item;
  }

  open(i) {
    const first = !this.read.has(i);
    this.read.add(i);
    G.hud.dialog(`${TABLETS[i].title} (${i + 1}/${TABLETS.length})`, TABLETS[i].text);
    if (first) {
      G.audio.play('glint');
      G.hud.toast(`Tablet added to your journal (${this.read.size}/${TABLETS.length})`, '#e0d0ff', 2.5);
      if (this.read.size === TABLETS.length) G.honours?.event('lore');
    }
  }

  serialize() { return [...this.read]; }
  load(list) { for (const i of list || []) if (i >= 0 && i < TABLETS.length) this.read.add(i); }

  // Journal section for the satchel
  render(el) {
    el.innerHTML = TABLETS.map((t, i) => (this.read.has(i)
      ? `<div class="tab read" data-i="${i}"><b>${i + 1}. ${t.title}</b></div>`
      : `<div class="tab"><b>${i + 1}. ???</b></div>`)).join('');
    for (const d of el.querySelectorAll('.tab.read')) d.onclick = () => { G.forage.closeUI(); this.open(+d.dataset.i); };
  }

  update(dt) {
    const p = G.player;
    if (!p) return;
    this.root.visible = !p.inDungeon;
    for (const it of this.items) {
      const unread = !this.read.has(it.i);
      it.glyph.material.color.setHex(COLORS[it.i % 4].hex).multiplyScalar(unread ? 1.2 + Math.sin(G.time * 3 + it.i) * 0.4 : 0.5);
    }
  }
}

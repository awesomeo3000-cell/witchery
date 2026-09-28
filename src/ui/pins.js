// Map pins: click an empty spot on the map to drop one of your own stamps there (up to 8); click a
// pin to remove it. Pins show on the compass and minimap and are kept in your local save.
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { WORLD_SIZE } from '../world/layout.js';

export const MAX_PINS = 8;
export const PIN_COLORS = ['#ff6a6a', '#ffd84a', '#6ad0ff', '#8cf08c'];

// Map click position (0..1 in both axes) to world x/z
export const mapToWorld = (u, v) => ({ x: (u - 0.5) * WORLD_SIZE, z: (v - 0.5) * WORLD_SIZE });

export class Pins {
  constructor() {
    this.list = [];
    this.next = 0;
    // The marker layer sits over the canvas; clicks on markers themselves are theirs to handle
    const box = document.getElementById('map-markers');
    box.addEventListener('click', (e) => {
      if (e.target.closest('.mm')) return;
      const r = box.getBoundingClientRect();
      this.add(mapToWorld((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
    });
  }

  add({ x, z }) {
    if (this.list.length >= MAX_PINS) this.remove(this.list[0]);
    const pos = new THREE.Vector3(x, 0, z);
    pos.y = Math.max(G.terrain.heightAt(x, z), 0) + 2;
    const pin = { pos, color: PIN_COLORS[this.next++ % PIN_COLORS.length] };
    pin.marker = G.hud.addMarker(`<div class="ic" style="background:${pin.color}">✦</div>`, () => pin.pos, () => !G.player.inDungeon);
    this.list.push(pin);
    G.audio.play('chat');
    G.hud.renderMapMarkers();
  }

  remove(pin) {
    G.hud.removeMarker(pin.marker);
    this.list.splice(this.list.indexOf(pin), 1);
    G.hud.renderMapMarkers();
  }

  mapMarkers(add) {
    for (const pin of this.list) {
      const d = add(pin.pos.x, pin.pos.z, 'pin ft', pin.color, `${Math.round(Math.hypot(pin.pos.x - G.player.pos.x, pin.pos.z - G.player.pos.z))} m`, () => this.remove(pin));
      d.title = 'Click to remove';
    }
  }

  serialize() { return this.list.map((p) => [Math.round(p.pos.x), Math.round(p.pos.z)]); }
  load(list) { if (Array.isArray(list)) for (const [x, z] of list.slice(0, MAX_PINS)) if (Number.isFinite(x) && Number.isFinite(z)) this.add({ x, z }); }
}

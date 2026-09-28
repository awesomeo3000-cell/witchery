// Key world locations. -Z is north.
import { DUNGEON_Y } from '../core/ctx.js';

export const WORLD_SIZE = 1600;
export const WORLD_SEG = 320;

export const VILLAGE = { x: 0, z: 90, r: 75 };

export const TRIALS = [
  { key: 'ember', name: 'Ember Trial', color: 0, x: 400, z: -40, boss: 'Frostmaw' },
  { key: 'frost', name: 'Frost Trial', color: 1, x: -30, z: -420, boss: 'Magmaw' },
  { key: 'spring', name: 'Spring Trial', color: 2, x: 130, z: 440, boss: 'Shellback' },
  { key: 'bloom', name: 'Bloom Trial', color: 3, x: -420, z: 40, boss: 'Galewing' },
];
TRIALS.forEach((t, i) => {
  // Dungeon interiors sit far underground, below their shrines.
  t.dungeon = { x: t.x, y: DUNGEON_Y - i * 60, z: t.z };
});

export const CITADEL = { x: 0, y: 210, z: -140, r: 70 };
export const VOLCANO = { x: 610, z: -120 };
export const LAKE = { x: -170, z: 190, r: 70 };

export const WAYPOINTS = [
  { key: 'village', name: 'Palette Hollow', x: 18, z: 70 },
  { key: 'ember', name: 'Cinder Steps', x: 360, z: -20 },
  { key: 'frost', name: 'Rimefall Pass', x: -10, z: -370 },
  { key: 'spring', name: 'Amber Mesa', x: 110, z: 395 },
  { key: 'bloom', name: 'Mossglen', x: -370, z: 60 },
];

export const RUINS = [
  { x: -90, z: 10 }, { x: 150, z: -110 }, { x: 240, z: 200 }, { x: -250, z: -170 },
  { x: -230, z: 330 }, { x: 300, z: -300 }, { x: -330, z: -380 }, { x: 420, z: 260 },
];

// Areas where terrain is flattened (x, z, radius, optional fixed height)
export const FLAT_SPOTS = [
  { ...VILLAGE },
  ...TRIALS.map((t) => ({ x: t.x, z: t.z, r: 28 })),
  ...WAYPOINTS.map((w) => ({ x: w.x, z: w.z, r: 9 })),
  ...RUINS.map((r) => ({ x: r.x, z: r.z, r: 20 })),
];

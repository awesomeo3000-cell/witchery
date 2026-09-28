// Shared game context. Systems register themselves here so they can find each other
// without long constructor chains.
export const G = {
  scene: null,
  camera: null,
  renderer: null,
  terrain: null,
  collision: null,
  water: null,
  sky: null,
  player: null,
  peers: null,
  enemies: null,
  paint: null,
  particles: null,
  hud: null,
  net: null,
  audio: null,
  input: null,
  trials: null,
  world: null,
  flags: {},
  time: 0,
  settings: {
    sensitivity: 1,
    invertY: false,
    grass: 1,
    shadows: true,
    volume: 0.7,
    music: true,
  },
};

export const COLORS = [
  { key: 'ember', name: 'Ember', hex: 0xe8442e, css: '#e8442e', light: '#ff9d6b', element: 'fire' },
  { key: 'frost', name: 'Frost', hex: 0x3a9ae8, css: '#3a9ae8', light: '#9ee0ff', element: 'ice' },
  { key: 'spring', name: 'Spring', hex: 0xf2c229, css: '#f2c229', light: '#fff09a', element: 'bounce' },
  { key: 'bloom', name: 'Bloom', hex: 0x3fb54a, css: '#3fb54a', light: '#a8f08c', element: 'vine' },
];

// Which colour breaks which shield (used by the final boss and elemental enemies).
export const COUNTER = { fire: 'ice', ice: 'fire', bounce: 'vine', vine: 'bounce' };

export const DUNGEON_Y = -600; // trials live far underground, below their shrines
export const inDungeonY = (y) => y < -200;

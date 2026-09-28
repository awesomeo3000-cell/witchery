# Witchery

A co-op, open-world adventure inspired by *Breath of the Wild*, built with Three.js. You carry a giant paintbrush, and each colour of paint has its own attack and effect. Explore the island with friends, solve the four Prism Trial dungeons, beat their mini-bosses, then ride your brush up to the Sky Citadel to face the final boss.

## Quick start

```bash
npm install
npm run serve        # builds the client and starts the server on http://localhost:8080
```

For development with hot reload, run `npm run dev`. It starts the game server on port 8080 and Vite on port 5173, and Vite proxies `/ws` to the game server.

### Playing with friends

1. Run the server on a machine your friends can reach. That can be your LAN IP (`http://192.168.x.x:8080`), a tunnel (for example `ngrok http 8080`), or any Node host. The port is set with the `PORT` environment variable.
2. Everyone opens the same URL and enters the same **room code**. In-game, *Pause → Copy invite link* copies a link that joins your room.
3. Each room holds up to 8 players. Puzzle progress, Prism Shards and activated easels are shared. The first player in a room simulates the enemies. If that player leaves, another player takes over automatically.

If the page can't reach a server (for example, when the built `dist/` is opened from a static host), the game starts in solo mode.

## Controls

| Input | Action |
| --- | --- |
| WASD / Mouse | Move / look |
| Space | Jump. Press again in the air to glide. Dodge when locked on. |
| Shift | Sprint (boost while riding) |
| LMB | Brush strike (3-hit combo). Hold for a spin attack. |
| RMB + LMB | Aim. Tap to flick a paint glob, hold to paint a stroke (Brush Art). |
| Q / Middle mouse | Lock on to an enemy |
| 1–4, E, Tab | Pick a colour: number keys, cycle, or hold Tab for the wheel |
| R | Ride the brush and fly (Space to rise, C to descend) |
| F | Interact: talk, enter trials, continue dialogue |
| M | Map, with fast travel to activated easels |
| Enter | Chat |
| H | Hide the controls panel |
| Esc | Pause and settings |

## Paint colours

| Colour | Combat effect | World effect |
| --- | --- | --- |
| **Ember** (red) | Burns enemies over time | Fire patches, lights braziers, burns bramble walls, melts ice |
| **Frost** (blue) | Freezes enemies; the next strike shatters them for double damage | Ice patches; on water it makes ice floes you can walk on |
| **Spring** (yellow) | Launches and knocks enemies back | Bounce pads that throw you (and enemies) high into the air |
| **Bloom** (green) | Roots enemies in place | Vines. On walls they make a climbable ladder, and standing in them slowly heals you. |

Each colour has its own ink bottle, which refills slowly over time. Ink flowers and enemy drops refill it faster.

## The Prism Trials

Coloured light beams mark the four trial shrines. Each trial has a puzzle built around its colour, followed by a mini-boss:

- **Ember Trial** (east, near the volcano). Light three braziers: one behind brambles, one on a high ledge. Boss: **Frostmaw**, an ice golem whose armour must be melted with Ember.
- **Frost Trial** (north, in the mountains). Cross a freezing pool on ice floes. Boss: **Magmaw**, a molten brute that must be frozen with Frost before it takes damage.
- **Spring Trial** (south, on the golden mesas). Bounce up the tiers to ring the bell. Boss: **Shellback**, which must be flipped with Spring (or lured onto a bounce pad).
- **Bloom Trial** (west, in the forest). Climb the mossy cliff on vines and grow a vine bridge. Boss: **Galewing**, which must be tangled and dragged down with Bloom.

Each Prism Shard adds a heart container. With all four shards, the barrier around the **Sky Citadel** falls. At the top waits **the Hueless King**, whose shield changes colour. Break it with the opposite colour (Ember ↔ Frost, Spring ↔ Bloom), then attack while it's stunned.

## Project layout

```
server/server.js      static file server + WebSocket rooms (relay, host election, shared flags)
src/main.js           boot, menus, networking glue, main loop
src/core/             shared context, input, procedural audio, math/noise
src/world/            terrain & biomes, sky/day-night, water, GPU grass, props, overworld population, collision
src/player/           character model/animation and the player controller (walk, glide, climb, swim, ride, combat)
src/combat/           paint globs/splats/elemental effects and particles
src/enemies/          enemy & boss models, AI, projectiles, shockwaves, loot, network snapshots
src/trials/           the four dungeons, their puzzles and boss arenas, and the final boss trigger
src/ui/               HUD (hearts, compass, ink potions, stamina wheel, boss bar, map, chat) and styles
```

Debugging: `?solo` skips the server, and `?god` makes you invulnerable. The game state is exposed as `window.G` in the browser console.

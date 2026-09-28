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
| Space | Jump. Press again in the air to glide. Dodge when locked on. A last-moment dodge triggers **Flurry Rush** (slow motion, bonus damage). |
| Shift | Sprint (boost while riding) |
| LMB | Brush strike (3-hit combo, inputs are buffered). Hold for a spin attack. In mid-air, plunge attack. |
| RMB + LMB | Aim. Tap to flick a paint glob, hold to paint a stroke (Brush Art). |
| Q / Middle mouse | Lock on to an enemy |
| 1–4, E, Tab | Pick a colour: number keys, cycle, or hold Tab for the wheel |
| R | Ride the brush and fly (Space to rise, C to descend) |
| F | Interact: talk, enter trials, continue dialogue |
| M | Map, with fast travel to activated easels |
| I / G | Open the satchel / quick-eat the best healing item |
| P | Photo mode (free camera, filters, Enter saves a PNG) |
| Enter | Chat (the host can type `/weather rain`, `/time dusk`, `/greymoon`) |
| H | Hide the controls panel |
| Esc | Pause and settings |

Gamepads (Xbox/PlayStation standard mapping) work too:
- **A**: jump, or interact when something's in reach
- **B**: sprint
- **X / RT**: strike
- **LT**: aim
- **LB**: lock on
- **RB / D-pad**: colours
- **Y**: ride the brush
- **L3**: descend while riding
- **R3**: quick eat
- **View**: map
- **Start**: pause

On phones and tablets, touch controls appear automatically: a floating joystick on the left, drag anywhere else to look, and action buttons on the right.

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

## Paint Sprites

46 Paint Sprites are hidden around the island and inside the trials:
- under odd lavender rocks (strike them)
- in rings of grey flowers (paint the centre stone the colour its gem shows)
- in withered saplings (paint them with Bloom)
- in rainbow sky hoops (fly or glide through)
- on lonely peaks and floating islets (touch the sparkle)
- in each trial's optional side chamber, behind a small colour challenge

Bring every 4 sprites to Pip in Palette Hollow for a Heart Container or Stamina Vessel. Upgrades are shared by the whole party.

## The wider world

- **Enemy camps** have tents, campfires and sometimes a lookout tower with an Inkshot archer. Some are led by a tougher *Great* enemy. Clearing a camp unlocks its chest, which grants a temporary buff: golden hearts, stronger strikes, bottomless ink, or faster movement.
- **Foraging & cooking.** Apples, sunshrooms, swiftmint, emberpeppers, frostlilies and goldpetals grow by biome and regrow over time. Eat them from the satchel, or cook up to three at a pot (in the village and at every camp) for a stronger meal. Matching buff ingredients make the effect last longer.
- **Weather** cycles between clear, cloudy, rain and storms. It snows in the mountains, rain puts out fire paint, and storms bring lightning.
- **The Grey Moon.** Some nights a violet moon rises at midnight. Every camp and chest refreshes, enemies hit harder, and ink creatures roam until dawn.
- **Boss intros**, a colour-draining final fight, and a credits roll with your party's names.

## Saving

Online rooms save their world progress on the server in `data/rooms.json`, so it survives restarts. Each browser also remembers where you were. Solo games keep everything in the browser's local storage.

## Graphics options

The pause menu (Esc) has Low / Medium / High presets, plus separate toggles for shadows, grass density and *Atmosphere & bloom* (the post-processing pass that draws the haze, sun glow, bloom and colour grade). "Show FPS" displays the frame rate and draw calls. Try Medium or Low on laptops with integrated graphics.

All art is generated in code: painted canvas textures (bark, leaves, stone, shingles, plaster, wood, cloth, strata), leaf-card trees, sculpted boulders, and rounded characters with a soft cel ramp. No asset files need to be downloaded.

## Project layout

```
server/server.js      static file server + WebSocket rooms (relay, host election, shared flags)
src/main.js           boot, menus, networking glue, main loop
src/core/             shared context, input, procedural audio, math/noise, post-processing (haze, bloom, grade)
src/world/            terrain & biomes, sky/day-night, weather, Grey Moon, billboard clouds, floating islands, water, GPU grass,
                      painted textures & props, overworld population, Paint Sprites, foraging/cooking, collision
src/player/           character model/animation and the player controller (walk, glide, climb, swim, ride, combat)
src/combat/           paint globs/splats/elemental effects, particles, brush-stroke trails
src/enemies/          enemy & boss models, AI, camps & chests, projectiles, shockwaves, loot, network snapshots
src/trials/           the four dungeons, their puzzles and boss arenas, and the final boss trigger
src/ui/               HUD, tips & objectives, boss cinematics, photo mode, touch controls, styles
src/core/save.js      local save; src/core/progress.js derives hearts/stamina from shared progress
```

Debugging: `?solo` skips the server, and `?god` makes you invulnerable. The game state is exposed as `window.G` in the browser console.

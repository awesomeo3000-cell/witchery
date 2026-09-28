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
| V | Ping the spot under the crosshair for your friends |
| B | Emote: wave, cheer or sit (friends see it too) |
| C (on foot) | Sneak: crouch so enemies notice you later and sleeping giants stay asleep. Strikes on unaware enemies deal double damage |
| H | Hide the controls panel |
| Esc | Pause and settings |

Every keyboard action can be rebound under *Key bindings* in the pause menu.

Gamepads (Xbox/PlayStation standard mapping) work too:
- **A**: jump, or interact when something's in reach
- **B**: sprint
- **X / RT**: strike
- **LT**: aim
- **LB**: lock on
- **RB / D-pad**: colours
- **Y**: ride the brush
- **R3**: quick eat
- **View**: tap for the map, hold for the quick menu (ping, emote)
- **L3**: sneak on foot, descend while riding
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
- **Inkbats** flock out at night away from the village. They circle and swoop, chase you hard while you fly or glide, and melt away at dawn. One glob or strike pops them.
- **The Grey Moon.** Some nights a violet moon rises at midnight. Every camp and chest refreshes, enemies hit harder, and ink creatures roam until dawn.
- **Field bosses.** Blot Giants sleep in the meadows: sneak up for bonus damage and hit the eye up top to topple them. Stone Sentinels pose as boulders until you get close, and only take damage on the crystal on their back, so bounce or glide onto them. Both drop a buff tonic and return after a while.
- **Pigment & the Brushwright.** Ink creatures drop golden Pigment. Sable the Brushwright, at a market stall in Palette Hollow, turns it into permanent brush upgrades: Stiff Bristles (more damage), Deep Reservoir (faster ink) and Wind Lacquer (cheaper flight). Each upgrade has three levels, and your Pigment total shows in the satchel.
- **Villager quests.** Four villagers in Palette Hollow have errands, marked with **!** (and **?** when you can turn one in). Gather dyes for Mira, fetch Tilly's kite from a sky islet, bring down both field bosses for Bram, and repaint Painter Ochre's four grey statues out by the ruins. Rewards are permanent: more stamina, a heart container, stronger strikes and faster ink. Active quests are listed in the satchel (I), and their targets appear on the compass.
- **Sky Races.** Three ring courses for brush flight: Lakeside Loop by the village, Canyon Run through the southern mesas, and Islet Hop around the Sky Citadel. Fly through a golden start gate while riding to begin. Each ring tops up your stamina, and room records are saved and shown on the map.
- **Paint Fox.** A little fox follows you around. It sits when you rest, fetches Pigment you've left behind, and every so often runs ahead and points toward an unsolved puzzle or a hidden Paint Sprite. You can turn it off in Accessibility.
- **Pings.** Press V to mark the spot you're looking at. Friends see a beacon and a compass marker.
- **Island puzzles.** Ten small puzzles are hidden around the island:
  - **Colour Totems:** a plinth shows three colours; paint the three pillars to match, in order.
  - **Brazier Rings:** light one brazier with Ember, then the rest before the flames die.
  
  Each one pays Pigment to everyone nearby. Found and solved puzzles show on the map.
- **Map exploration.** The map starts as blank parchment and fills in wherever you travel. Flying high reveals more, and activating an easel uncovers the land around it.
- **Living water.** The sea has rolling swells that grow in storms, sky reflections, caustics in the shallows, and ripples when you splash, swim or paint it.
- **Boss intros**, a colour-draining final fight, and a credits roll with your party's names.

## Music

The score is generated live and changes with what you're doing: gentle piano for exploring, slower at night, sparse plucks over a heartbeat while sneaking, airy pads when soaring on the brush, drums for skirmishes, driving beats for Sky Races, and full battle themes for bosses. Changes land on the bar line, so they stay musical.

## Saving

Online rooms save their world progress on the server in `data/rooms.json`, so it survives restarts. Each browser also remembers where you were. Solo games keep everything in the browser's local storage.

## Graphics options

The pause menu (Esc) has Low / Medium / High presets, plus separate toggles for shadows, grass density and *Atmosphere & bloom* (the post-processing pass that draws the haze, sun glow, bloom and colour grade). "Show FPS" displays the frame rate and draw calls. Try Medium or Low on laptops with integrated graphics.

All art is generated in code: painted canvas textures (bark, leaves, stone, shingles, plaster, wood, cloth, strata), leaf-card trees, sculpted boulders, and rounded characters with a soft cel ramp. No asset files need to be downloaded.

## Accessibility

The pause menu's *Accessibility* section has:
- HUD size, field of view and camera distance sliders
- colour symbols (▲ Ember, ❄ Frost, ● Spring, ✿ Bloom) on the potions, colour wheel and compass
- *Reduce motion*, which removes speed lines, the FOV kick and the underwater wobble
- *Reduce screen flashes*
- toggle sprint

*Key bindings* remaps any keyboard action. If the key is already taken, the two actions swap.

## Development

```
npm run lint    # ESLint
npm test        # unit tests (math, terrain/collision, combat rules, progress, quests, key bindings) + server protocol tests
npm run build   # production build into dist/
npm run smoke   # boots the built game in headless Chromium against the real server (needs `npx playwright install chromium` once)
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests, build and the smoke test on every push and pull request.

## Project layout

```
server/server.js      static file server + WebSocket rooms (relay, host election, shared flags)
src/main.js           boot, menus, networking glue, main loop
src/core/             shared context, input, procedural audio, math/noise, post-processing (haze, bloom, grade)
src/world/            terrain & biomes, sky/day-night, weather, Grey Moon, billboard clouds, floating islands, water, GPU grass,
                      painted textures & props, overworld population, Paint Sprites, foraging/cooking, villager quests, collision
src/player/           character model/animation and the player controller (walk, glide, climb, swim, ride, combat)
src/combat/           paint globs/splats/elemental effects, particles, brush-stroke trails
src/enemies/          enemy & boss models, AI, camps & chests, projectiles, shockwaves, loot, network snapshots
src/trials/           the four dungeons, their puzzles and boss arenas, and the final boss trigger
src/ui/               HUD, tips & objectives, boss cinematics, photo mode, touch controls, accessibility & key bindings, styles
test/                 node:test unit and server tests; test/smoke/ has the headless browser check
src/core/save.js      local save; src/core/progress.js derives hearts/stamina from shared progress
```

Debugging: `?solo` skips the server, and `?god` makes you invulnerable. The game state is exposed as `window.G` in the browser console.

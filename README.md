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
| P | Photo mode: free camera, filters (1-6/E), frames (G: Polaroid, Painted), hero poses (R), hide friends (V). Enter saves a PNG |
| Enter | Chat (the host can type `/weather rain`, `/time dusk`, `/greymoon`) |
| V | Ping the spot under the crosshair for your friends |
| B | Emote: wave, cheer or sit (friends see it too) |
| X | Whistle for your Brushbuck |
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
- Rumble on hits, Flurry Rush, heavy landings, boss slams and damage (toggle in Accessibility)
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

49 Paint Sprites are hidden around the island and inside the trials:
- under odd lavender rocks (strike them)
- in rings of grey flowers (paint the centre stone the colour its gem shows)
- in withered saplings (paint them with Bloom)
- in rainbow sky hoops (fly or glide through)
- on lonely peaks and floating islets (touch the sparkle)
- in each trial's optional side chamber, behind a small colour challenge
- in the chest at the end of each Paint Shrine

Bring every 4 sprites to Pip in Palette Hollow for a Heart Container or Stamina Vessel. Upgrades are shared by the whole party.

## The wider world

### Exploring
- **Painter's Towers.** Four tall painted towers stand between Palette Hollow and each trial (they show on the compass). Their winds ground your brush, so you climb: grow vines (Bloom) up the mossy base, paint a bounce pad (Spring) on the ledge, then vine up the mossy crown. Painting the easel at the top reveals a wide area of the map for everyone in the room.
- **Map exploration.** The map starts as blank parchment and fills in wherever you travel. Flying high reveals more, and activating an easel uncovers the land around it. A rotating minimap in the corner shows the same fog, plus trials, friends, quest targets, pings and race gates. You can turn it off in Accessibility.
- **Weather** cycles between clear, cloudy, rain and storms. It snows in the mountains, rain puts out fire paint, and storms bring lightning. Wind veers slowly and blows harder in bad weather, pushing gliders and riders (the flight readout shows it). Rain makes vines slick, so climbing is slower and you'll slip now and then. When rain clears in daylight, a rainbow arcs across the sky opposite the sun.
- **Cold and heat.** The snowy northern heights are freezing (colder still at night) and the volcano's upper slopes are scorching. After a few seconds exposed you lose half a heart every so often, and the screen edge frosts over or glows red. A Bold (spicy, Emberpepper) meal keeps you warm; an Inky (Frostlily or Prismfin) meal keeps you cool. Easels and trial doorways are always safe to stand by.
- **Living water.** The sea has rolling swells that grow in storms, sky reflections, caustics in the shallows, and ripples when you splash, swim or paint it.
- **Shooting stars.** On clear nights a star sometimes streaks down nearby. Follow its light beam to a Star Fragment worth 20 Pigment. It's shared in co-op, so it's first come, first served.
- **The Chroma Wyrm.** A huge, peaceful rainbow serpent loops the skies over the island (it shows on the compass when near). Hit it with a paint glob to knock loose a Chroma Scale, which drifts to the ground and is worth 40 Pigment. It can drop one every 8 seconds, and everyone in the room sees it in the same place.
- **Painted Memories.** The Journal in your satchel holds eight pencil sketches of places around the island, drawn from the real spots. Find where each one was drawn and stand there to recover the memory, a short scene from the Painters' past. Recovered memories can be replayed from the Journal.
- **Painted Tablets.** Twelve stone tablets with glowing glyphs tell the story of the island and the Hueless King. Read ones go into the Journal in your satchel, where you can reread them.
- **Island puzzles.** Ten small puzzles are hidden around the island:
  - **Colour Totems:** a plinth shows three colours; paint the three pillars to match, in order.
  - **Brazier Rings:** light one brazier with Ember, then the rest before the flames die.
  
  Each one pays Pigment to everyone nearby. Found and solved puzzles show on the map.
- **Fishing.** Schools of fish circle in the lake and the coastal shallows; watch for one leaping out. Paint a Frost floe over a school and the fish under it freeze into the ice, then walk over to pick them up. Glimmerfish heal well, and rare pink Prismfin make meals that fill your ink faster. Fish come back after a few minutes.
- **Critters.** Butterflies flutter over the grass on dry days and fireflies drift about at night. They take fright if you rush at them (or fly in on your brush), so sneak up (C) and walk into one to catch it. Sunwings restore stamina; Glowbugs cook into Hushed meals that let you get closer to enemies before they notice.
- **Brushbucks.** Herds of painted deer with rainbow antlers graze in the meadows. They bolt if you rush at them, so sneak up (C) and press Interact to climb on, then hold on while it bucks (this costs stamina; if you run out you're thrown off). Once tamed, your Brushbuck trots, gallops while you Sprint and jumps with Space; Interact climbs down. Whistle (X, or the gamepad quick menu) and it runs to you, even from far away. Your Brushbuck is saved and shows on the map, and friends see you riding. Rosa the Stablehand, at the western edge of Palette Hollow, can rename your buck or fetch it to her hitching rail. The **Meadow Dash** is a ground course of gates around a meadow herd; ride through the golden start gate on your Brushbuck to begin.
- **Paint Shrines.** Three stone arches with swirling paint lead down to small one-room puzzles, each mixing colours:
  - **Shrine of Crossing:** freeze floes across a cold pool, then melt the ice wall with Ember.
  - **Shrine of Heights:** bounce onto a smooth ledge with Spring, then grow vines up the mossy cliff.
  - **Shrine of Haste:** keep three braziers burning at the same time to raise the gate.

  Each chest holds a Paint Sprite and 15 Pigment. A pale beam of light rises over each shrine you haven't cleared (it turns gold once you have). Shrines show on the map and compass, and friends can solve them together.
- **Sky Races.** Three ring courses for brush flight: Lakeside Loop by the village, Canyon Run through the southern mesas, and Islet Hop around the Sky Citadel. Fly through a golden start gate while riding to begin. Each ring tops up your stamina, and room records are saved and shown on the map.

### Creatures and bosses
- **Enemy camps** have tents, campfires and sometimes a lookout tower with an Inkshot archer. Some are led by a tougher *Great* enemy. Clearing a camp unlocks its chest, which grants a temporary buff: golden hearts, stronger strikes, bottomless ink, or faster movement.
- **Stealth.** Crouch with C to sneak. Enemies show a **?** while you're inside their normal sight range but unseen, and a **!** when they spot you, and a spotted camp alerts all its members. Sneak strikes on unaware foes deal double damage.
- **Inkbats** flock out at night away from the village. They circle and swoop, chase you hard while you fly or glide, and melt away at dawn. One glob or strike pops them.
- **Field bosses.** Blot Giants sleep in the meadows: sneak up for bonus damage and hit the eye up top to topple them. Stone Sentinels pose as boulders until you get close, and only take damage on the crystal on their back, so bounce or glide onto them. **Rainmane**, a painted centaur-lion, prowls the open plain south of Palette Hollow: its mane cycles through the four colours, and only the colour that undoes the current one really hurts it (Frost against a red mane, and so on), sometimes staggering it. Watch for its glaive sweep, charges, paint volleys and leaping slam. All three drop a buff tonic and return after a while.
- **The Grey Moon.** Some nights a violet moon rises at midnight. Every camp and chest refreshes, enemies hit harder, and ink creatures roam until dawn.
- **Boss intros**, a colour-draining final fight, and a credits roll with your party's names.

### Village life
- **Villager quests.** Seven villagers in Palette Hollow have errands, marked with **!** (and **?** when you can turn one in). Gather dyes for Mira, fetch Tilly's kite from a sky islet, bring down both field bosses for Bram, repaint Painter Ochre's four grey statues out by the ruins, catch three Glimmerfish for Old Finn, sneak up on three Glowbugs for Wren's lantern, and tame a Brushbuck and run the Meadow Dash in under 1:40 for Dell the Courier. Rewards are permanent: more stamina, a heart container, stronger strikes, faster ink, quieter sneaking and faster gallops. Active quests are listed in the satchel (I), and their targets appear on the compass.
- **Pigment & the Brushwright.** Ink creatures drop golden Pigment. Sable the Brushwright, at a market stall in Palette Hollow, turns it into permanent brush upgrades: Stiff Bristles (more damage), Deep Reservoir (faster ink) and Wind Lacquer (cheaper flight). Each upgrade has three levels, and your Pigment total shows in the satchel.
- **Tinker the merchant** moves his cart to a different easel every four minutes (check the map or compass). He sells Goldpetals, rare ingredients, a Traveller's Feast and a Stamina Tonic for Pigment.
- **Foraging & cooking.** Apples, sunshrooms, swiftmint, emberpeppers, frostlilies and goldpetals grow by biome and regrow over time. Eat them from the satchel, or cook up to three at a pot (in the village and at every camp) for a stronger meal. Matching buff ingredients make the effect last longer. Every meal you cook goes into the Recipe Book in your satchel; at a pot, click a recipe to fill the pot with it again.
- **Target Gallery.** A booth on the east edge of the village runs a 45-second shooting game. Targets pop up in the field beyond. Splash them with paint for 1 point, or 3 if the paint matches the target's ring. You earn half your score in Pigment, and the best score is the room record.
- **Training yard.** Three straw practice dummies stand on the west side of Palette Hollow. Try combos, globs and element reactions on them. They wobble, show damage and pop back to full, and they never fight back or drop loot.
- **Paint Fox.** A little fox follows you around. It sits when you rest, fetches Pigment you've left behind, and every so often runs ahead and points toward an unsolved puzzle or a hidden Paint Sprite. You can turn it off in Accessibility.

### Playing together
- **Revives.** With friends in the room, fainting leaves you down for 12 seconds instead of respawning straight away. A friend holding Interact beside you for a moment picks you back up with half your hearts, or you can press Interact to respawn at the checkpoint.
- **Pings.** Press V to mark the spot you're looking at. Friends see a beacon and a compass marker.
- **Emotes** (B): wave, cheer or sit, and friends see it.
- Shared progress: shards, quests, puzzles, records and upgrades from Paint Sprites are room-wide. Pigment, brush upgrades and honours are your own.

## Music

The score is generated live and changes with what you're doing: gentle piano for exploring, slower at night, sparse plucks over a heartbeat while sneaking, airy pads when soaring on the brush, drums for skirmishes, driving beats for Sky Races, and full battle themes for bosses. Changes land on the bar line, so they stay musical. Sound effects are synthesised too: your Brushbuck's hoofbeats follow its gait, your whistle is a little two-note call, fish splash as they leap, caught critters chime, recovered memories play a slow melody, and the Paint Shrines hum softly.

## After the credits

Once the Hueless King falls, the village statue opens a way down to the **Gallery of Echoes**: a boss rush against echoes of all four trial bosses, back to back. The fastest clear is saved as the room record, with the names of everyone who ran it.

## Saving

Online rooms save their world progress on the server in `data/rooms.json`, so it survives restarts. Each browser also remembers where you were. Solo games keep everything in the browser's local storage. When a save exists, the title menu shows **Continue** plus a **Start over** button that erases this browser's save after asking to confirm. Shared room progress stays on the server.

## Graphics options

The pause menu (Esc) has Low / Medium / High presets, plus separate toggles for shadows, grass density and *Atmosphere & bloom* (the post-processing pass that draws the haze, sun glow, bloom and colour grade). "Show FPS" displays the frame rate and draw calls. *Dynamic resolution* (on by default) lowers the render scale when the frame rate falls below about 45 fps and raises it again when there is headroom. Try Medium or Low on laptops with integrated graphics.

All art is generated in code: painted canvas textures (bark, leaves, stone, shingles, plaster, wood, cloth, strata), leaf-card trees, sculpted boulders, and rounded characters with a soft cel ramp. No asset files need to be downloaded.

## Painter's Honours

There are thirty achievements, such as First Flight, Soft Bristles (a sneak strike), Record Breaker, Cartographer, Good Samaritan (reviving a friend) and Echo Breaker. Each one pops a toast when earned, is listed with its progress in the satchel, and is saved per player.

### Wardrobe

Honours unlock cosmetics, picked under *Wardrobe* in the pause menu: brush trails (Ember sparks at 3 honours, Rainbow at 6, Starlight at 10) and glider tints (Sunflower gold at 4, Rose at 8, Midnight at 12). Friends see your choices.

## Accessibility

The pause menu's *Accessibility* section has:
- HUD size, field of view and camera distance sliders
- colour symbols (▲ Ember, ❄ Frost, ● Spring, ✿ Bloom) on the potions, colour wheel and compass
- *Reduce motion*, which removes speed lines, the FOV kick and the underwater wobble
- *Reduce screen flashes*
- *Captions for important sounds* (boss roars, thunder, ground shakes, enemies spotting you, shooting stars, the Wyrm...), with an arrow toward the source when it's known
- toggle sprint

*Key bindings* remaps any keyboard action. If the key is already taken, the two actions swap.

## Development

```
npm run lint    # ESLint
npm test        # unit tests (math, terrain/collision, combat rules, progress, quests, shop, puzzles, map fog, honours, key bindings) + server protocol and hardening tests
npm run build   # production build into dist/
npm run smoke   # boots the built game in headless Chromium against the real server and checks a draw-call budget (needs `npx playwright install chromium` once)
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests, build and the smoke test on every push and pull request.

## Project layout

```
server/server.js      static file server + WebSocket rooms (relay, host election, shared flags)
src/main.js           boot, menus, networking glue, main loop
src/core/             shared context, input, procedural audio, math/noise, post-processing (haze, bloom, grade)
src/world/            terrain & biomes, sky/day-night, weather, rainbows, Grey Moon, clouds, floating islands, water, GPU grass,
                      painted textures & props, overworld population, Paint Sprites, foraging/cooking, villager quests,
                      Brushwright shop, Sky Races, island puzzles, Paint Fox, Chroma Wyrm, shooting stars, collision
src/player/           character model/animation and the player controller (walk, glide, climb, swim, ride, combat)
src/combat/           paint globs/splats/elemental effects, particles, brush-stroke trails
src/enemies/          enemy & boss models, AI, camps & chests, projectiles, shockwaves, loot, network snapshots
src/trials/           the four dungeons, their puzzles and boss arenas, the final boss trigger, the Gallery of Echoes, the Paint Shrines
src/ui/               HUD, minimap, map fog, tips & objectives, boss cinematics, photo mode, touch controls, pings, revives,
                      honours, adventure log, accessibility & key bindings, styles
test/                 node:test unit and server tests; test/smoke/ has the headless browser check
src/core/save.js      local save; src/core/progress.js derives hearts/stamina from shared progress
```

Debugging: `?solo` skips the server, and `?god` makes you invulnerable. The game state is exposed as `window.G` in the browser console, and `G.bootTimes` shows how long each part of the world took to build.

The development plan and its progress are in [docs/ROADMAP.md](docs/ROADMAP.md).

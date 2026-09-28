# Witchery roadmap

The development plan being worked through on `claude/friendly-hamilton-cdvh2p`. Each phase ships as its own commit with tests or screenshots checked before it's pushed.

## Done

1. Core game: open world, four Prism Trials, bosses, co-op server, brush flight, four paint elements
2. BotW-style polish: haze, bloom, grade, cel characters, combat feel (buffer, lunge, Flurry Rush)
3. Systems: saves, gamepad, touch, weather, Grey Moon, camps, foraging and cooking, photo mode, Paint Sprites
4. Art pass: painted textures, leaf-card trees, smooth rocks, rounded characters, buildings
5. Overworld field bosses (Blot Giant, Stone Sentinel)
6. Villager side quests, quest log, map and compass markers
7. Water: swells, reflections, caustics, ripples, underwater grade
8. Accessibility: rebinding, colour symbols, HUD scale, reduced motion and flashes, toggle sprint
9. Automated tests (unit, server protocol, browser smoke) and GitHub Actions CI
10. Co-op: pings, emotes
11. Sky Races, night Inkbats, Pigment and Brushwright upgrades, map fog of war
12. Sun shafts, villager barks and night routine, character draw-call merging

## Remaining (in order)

13. ✅ **Sneaking.** Crouch (C on foot, L3 on a pad) to move quietly. Enemies notice you from a much shorter range, and sleeping field bosses stay asleep. Sneak strikes on unaware enemies deal bonus damage.
14. ✅ **Controller and touch parity** for the newer features: ping, emote and shop navigation on the gamepad, plus touch buttons for ping and emote.
15. ✅ **Overworld paint puzzles.** Small Korok-style puzzles scattered across the map that reward Pigment, a Paint Sprite chime and map completion:
    - Colour Totems: paint the pillars to match the shrine.
    - Brazier Rings: light every brazier within a time limit.
16. ✅ **Adaptive music layers** for races, night, sneaking and combat intensity.
17. ✅ **Performance guard in CI.** The smoke test fails if village draw calls go over a budget. Also distance culling for NPC animation.
18. ✅ **Final pass.** Full browser regression, README and credits update, roadmap closed out.

## Next wave

19. ✅ **Server hardening.** Per-connection message rate limits, payload validation, a flag-count cap per room, tests for all of it.
20. ✅ **Camera options.** Field of view and camera distance sliders, and optional camera auto-centering while riding.
21. ✅ **Paint Fox companion.** A small fox that follows you, sniffs toward the nearest unsolved puzzle or Paint Sprite, and fetches nearby Pigment.
22. ✅ **Gallery of Echoes.** A post-game boss rush arena under the citadel with a timed run and a room record.

## Wave three

23. ✅ **Adventure Log.** A satchel tab with completion stats: shards, sprites, quests, puzzles, races, map explored, records, upgrades.
24. ✅ **Weather that matters.** Rain makes rock slippery (climbing costs more and you slip now and then), wind helps or fights your glide and flight.
25. ✅ **Save management.** Continue / New Game on the title menu for solo play, with a confirmation before wiping local progress.

## Wave four

26. ✅ **Shooting stars.** On clear nights a star streaks down somewhere nearby and leaves a glowing Star Fragment worth a pile of Pigment.
27. ✅ **Minimap.** An optional corner minimap (fogged like the map) with markers, rotating with the camera.
28. ✅ **Startup time.** Profile world generation on load and cut the slowest steps.

## Wave five

29. ✅ **Enemy awareness.** A "?" pops up when an enemy grows suspicious and a "!" when it spots you, and camp members alert each other.
30. ✅ **Co-op revives.** A fainted friend stays down briefly where they fell. Hold Interact beside them to pick them back up before they respawn at a checkpoint.
31. ✅ **Painter's Honours.** Achievements unlocked by play (first flight, first sneak strike, race records, full map...), with toasts and a list in the Adventure Log.

## Wave six

32. ✅ **Training yard.** Paint-splattered practice dummies by the village show damage, combos and element reactions, and never fight back.
33. ✅ **Gamepad rumble.** Rumble on hits, Flurry Rush, heavy landings, boss slams and taking damage, with a toggle.
34. ✅ **Dynamic resolution.** When the frame rate drops, the render scale lowers to hold about 50 fps and recovers when there's headroom, with a toggle.

## Wave seven

35. ✅ **The Chroma Wyrm.** A huge, peaceful rainbow serpent loops the island's skies. Hit it with paint to knock loose Chroma Scales worth a lot of Pigment.
36. ✅ **Rainbows.** After rain clears in daylight, a rainbow arcs across the sky opposite the sun.
37. ✅ **Regression and docs.** Full browser regression, README pass, roadmap update.

## Wave eight

38. ✅ **Wardrobe.** Honours unlock cosmetics: brush trail styles (paint, rainbow, starlight, ember sparks) and glider patterns. Picked in the pause menu and synced so friends see them.
39. ✅ **Target Gallery.** A village minigame: 45 seconds to splash popping targets with paint, earning Pigment and a room record.
40. ✅ **Painted Tablets.** Twelve lore tablets across the island tell the story of the Hueless King. Readable in a journal.

## Wave nine

41. ✅ **Closed captions.** An option that captions important sounds (boss roars, thunder, alarms, splashes, pickups nearby) with a direction arrow.
42. ✅ **Wandering merchant.** Tinker travels between the easels, selling rare ingredients, meals and a Stamina Tonic for Pigment.
43. ✅ **Photo mode extras.** Frames (polaroid, painted border), posing the hero with emotes, and a hide-friends toggle.

## Wave ten

44. ✅ **Paint Shrines.** Three single-room puzzle shrines behind stone arches on the surface, each mixing colours (Frost floes and an Ember-melted wall; a Spring bounce and a Bloom climb; three braziers burning at once). Each ends in a chest with a Paint Sprite and Pigment.
45. **Shrine polish.** Shrine entrance cinematic sweep, a "shrine cleared" arch glow for everyone in the room, and a shrine counter in the adventure log.
46. **Regression and docs.** Browser regression of shrines and co-op revive, README, roadmap.

The work continues through this list until the budget is used up.

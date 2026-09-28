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
45. ✅ **Shrine polish.** A camera sweep across each shrine on your first visit, light beams over uncleared shrine arches (gold once cleared, for everyone in the room), and a shrine counter in the adventure log. Cinematics no longer clamp to the surface terrain underground.
46. ✅ **Regression and docs.** Browser regression of shrines and co-op revive, README, roadmap.

## Wave eleven

47. ✅ **Fishing.** Schools of fish swim in the lake and coastal shallows. Freeze them in a Frost floe and pick them up: Glimmerfish heal well, rare Prismfin fill your ink faster.
48. ✅ **Critters.** Butterflies flutter over meadows by day and fireflies drift at night. Sneak up to catch them for cooking: Sunwings give stamina, Glowbugs make Hushed meals that shrink how far away enemies notice you.
49. ✅ **Recipe book.** Every meal you cook is recorded in the satchel with its ingredients and effects, so you can cook it again.

## Wave twelve

50. ✅ **Brushbucks.** Herds of painted deer graze in the meadows. Sneak up, mount one and hold on (it costs stamina) to tame it. Ride at a trot or gallop, jump, and whistle (X) to call your Brushbuck. Friends see you riding.
51. ✅ **Mounted play.** The Meadow Dash, a ground course of gates for Brushbucks with a room record; Rosa's stable post in the village, where you can rename your mount or have it fetched; a higher, wider camera in the saddle.
52. ✅ **Regression and docs.** Full browser regression including shrines, fishing, critters, recipes, Brushbucks and the co-op mount view.

## Wave thirteen

53. ✅ **Rainmane.** A Lynel-style painted centaur prowls the open plain south of Palette Hollow. Its mane cycles through the four colours and only the colour that undoes it bites deep. It sweeps its glaive, charges, fires paint volleys and leaps onto you.
54. ✅ **Cold and heat.** Snowy peaks chill you and the volcano's upper slopes scorch you, slowly costing hearts. Spicy (Bold) meals keep you warm; Inky meals keep you cool. A frost or heat edge on the screen warns you, and easels and trial doorways are safe shelters.
55. **Regression and docs.**

## Wave fourteen

56. ✅ **Painted Memories.** The journal's sketchbook holds eight sketches of places around the island, drawn in-engine from the real spots. Stand where a sketch was drawn to recover the memory: a short scene from the Painters' past, kept in the journal.
57. ✅ **Audio polish.** A whistle melody, hoofbeats that follow the gait, splashes and chimes for fishing and critters, and a soft hum inside the shrines.
58. ✅ **Regression and docs.**

## Wave fifteen

59. ✅ **More villager quests.** Old Finn wants Glimmerfish (more stamina), Wren wants Glowbugs for a lantern (quieter sneaking), and Dell the Courier wants a sub-1:40 Meadow Dash on a Brushbuck (faster, cheaper gallops).
60. ✅ **Painter's Towers.** Four tall painted towers, one per region, ground brush riders nearby. Climb them (vines on the mossy base, a bounce from the ledge, vines up the crown) and paint the easel at the top to reveal the map around it for the whole room.
61. ✅ **Save backup.** Export your save to a file and import it again from the pause menu, plus a text size option.
62. ✅ **Regression and performance.** Full browser and co-op regression; distant NPCs draw as one baked mesh, Brushbuck hooves merge into their legs, and static tower, shrine-arch and stable parts merge by material (spawn view 699 → 571 draw calls).

## Wave sixteen

63. ✅ **More fast travel.** Active Painter's Towers and any Paint Shrine you've entered are fast-travel points on the map.
64. ✅ **Compendium.** Photograph creatures in photo mode to register them (21 entries), with snapshots cut from your photos, kept in your save and shown in the satchel.
65. **Regression and docs.**

## Wave seventeen

66. ✅ **Guidance for new systems.** A side-goal line under the objective (nearest dormant tower, then nearest uncleared shrine) and first-time tips for towers, shrine arches, Brushbucks and the cold.
67. ✅ **Difficulty.** Story, Normal and Hard settings that scale only the damage you take, per player.

## Wave eighteen

68. ✅ **Art pass on new creatures.** Brushbucks get the painted-cloth coat and soft rim light the characters use; Rainmane's hide is painted; fish get rim light.
69. ✅ **Brush tips.** Sable sells Broad, Fine and Splatter tips that change reach, swing speed, damage, flick ink cost and flick spread; bought once, swapped freely, saved per player, and visible on the brush.
70. **Regression and docs.**

## Wave nineteen

71. ✅ **Party panel.** In co-op, friends are listed under your hearts with health, distance, a direction arrow and whether they're down, flying or mounted.
72. ✅ **Quick chat.** T (or the gamepad quick menu) sends a quick phrase to the room.

## Wave twenty

73. ✅ **The Prism Vault.** A post-game dungeon under a spire that rises from the lake after the final boss: four multi-colour chambers (floes and timed braziers; bounce, vines and a bell; brambles and a vine bridge; a crystal colour sequence from a mural) ending in a chest with 100 Pigment and the Prismatic glider.

74. ✅ **Ruin Sentries and parrying.** Guardian-like turrets at the outer ruins lock a beam on you, then fire a bolt; a well-timed swing facing it reflects bolts (and camp arrows) back for 40 damage. Co-op aware: the host checks each player's swing.

75. ✅ **The Colour Festival.** After Mira's quest, nightly fireworks and a ring of coloured lanterns over the village square; quick chat on touch screens.

76. ✅ **Galloping music.** A bouncing lope with a hoofbeat rhythm while riding a Brushbuck.
77. ✅ **Inkspouts.** Octorok-like water enemies at coastal fishing spots: they surface to spit ink and duck under (immune) between volleys; Frost pins them at the surface.

78. ✅ **Map pins.** Click the map to drop up to eight pins that show on the compass (saved locally); secondary map markers label themselves on hover to declutter the map.

79. ✅ **Journey statistics.** Time played, distance walked/flown/ridden/swum, foes defeated, globs flicked and faints, saved locally and listed in the adventure log.

The work continues through this list until the budget is used up.

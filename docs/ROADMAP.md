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
27. **Minimap.** An optional corner minimap (fogged like the map) with markers, rotating with the camera.
28. **Startup time.** Profile world generation on load and cut the slowest steps.

The work continues through this list until the budget is used up.

# Murmur – v1

An endless flocking game for iOS and Android, built from
[`../build-specification.md`](../build-specification.md) and the guidance in
[`../../mobile-game-report.md`](../../mobile-game-report.md). The menus follow
the supplied *Battle Game Apps UI Kit* Figma file: deep violet cards, glowing
cyan pill buttons and Readex Pro type. The sky is the vivid orange-to-violet
gradient the spec asks for.

Steer a flock of birds up the sky:
- Gather strays to grow the flock.
- Weave through storm clouds, wires and pylons.
- Dodge the hawk's marked spot.
- Circle a roost tree to bank your score.
- Cross your own path to make a murmuration.

## Running it

```bash
npm install
```

```bash
npm run dev          # game at http://localhost:5173, chunk editor at /tools/chunk-editor/
```

```bash
npm test             # flight, chunk and game tests (30 autopilot runs; RUNS=500 for the full set)
```

```bash
npm run autopilot    # the full §12 check: 500 random three-minute runs, hawks excluded
```

```bash
npm run build        # checks every chunk's lane, type-checks, builds dist/
```

### Phones

The native projects are in `android/` and `ios/` (Capacitor 7). Minimum
versions are Android 8.0 (API 26) and iOS 15, portrait only.

```bash
npm run android      # build, copy into android/, open Android Studio
```

```bash
npm run ios          # build, copy into ios/, open Xcode (macOS; run `pod install` in ios/App first)
```

The app identifier is `com.promethica.murmur`, set in `src/config/app.ts` and in
the native projects (`android/app/build.gradle`, `strings.xml`, the `MainActivity`
package and the Xcode bundle identifier). The version, `0.1.0`, is in
`package.json`, `src/config/app.ts`, `android/app/build.gradle` and the Xcode project.

## Layout (as §4)

```
src/
  config/   app.ts, tuning.ts (every tuning constant; species table)
  sim/      flight.ts – leader, trail, ribbon flock, hazards, hawks, banking, murmurations, scoring
  world/    chunk format, lane checker, spawner, the 40 chunks (chunkDefs.ts → chunks/chunks.json)
  game/     missions, progress, unlocks, the lane-following autopilot
  render/   PixiJS sky: batched birds, strays, hazards, trees, hawk shadows, trace, effects
  input/    steering: follow my thumb / draw a path
  audio/    synthesised sound and haptics
  state/    save data and settings
  ui/       screens and overlays
tools/      chunks.ts (build + check), autopilot.ts (500-run baseline), chunk-editor/
tests/
```

`sim/` and `world/` contain no drawing code.

## How the spec was met

| Spec | Implementation |
|---|---|
| §6.1–6.4 Flock | The sky scrolls at 3 to 6 tiles/s. The leader heads for the target at its species speed, and "Follow my thumb" aims 2.5 tiles above the thumb. Bird *i* sits *i × SPACING* behind the leader along the trail, offset sideways by `min(0.2 + 0.01N, SPREAD_MAX)`; geese fly in a V. The flock is capped at 300 birds. Strays join within 0.6 tiles, or 1.8 during a murmuration. |
| §6.5 Hazards | Clouds (some drift), wires with gaps, and pylons. Lost birds close up, and the next bird takes over if the leader is lost. A hawk's shadow is fixed where the leader will be in 1.2 s (2 s for the first hawk of each of the first three runs) and takes every bird within 0.8 tiles; taking the leader ends the run. Hawks come every 14 s, shortening to every 6. |
| §6.6–6.9 Score | A full circuit inside a tree's 3-tile circle banks the score, once per tree. A murmuration is a self-crossing within the last 8 tiles, with a 4 s cooldown and +5N, and not near a tree. Thermals give ×1.5 speed and points. Near misses give +2. Unbanked score is lost when the run ends. Feathers are score ÷ 50. |
| §6.10 Revive | Offered for 3 s at 50 feathers. The flock restarts with 10 birds, on-screen hazards are cleared, and unbanked score is kept. "Fly again" restarts in about 0.2 s. |
| §7 Sky | 40 chunks, eight per tier. Each tier's lane widths (6, 4.5, 3.5, 2.5, 2) are checked, and every chunk lines up with any neighbour; the build fails otherwise. The spawner picks from the current tier and the one below, never repeating either of the last two, and forces a tree chunk after 35 s. |
| §7.3 Missions | 40 missions built from the six template kinds, plus "bank at a tree" and "fly for N seconds". Three are active at a time, every five raise your rank, and rank 1 opens the second sky. |
| §8 Steering | Follow my thumb, or draw a path fixed to the sky and flown from its nearest end. It applies from the next run, and both use the same speeds and rules. |
| §9–11 | First launch opens straight into flight with a hand hint and strays ahead. The first tree comes at about 12 s with a looping arrow, and the first hawk at 20 s. The HUD shows banked score (large), unbanked score (pulsing), flock size and pause, with nothing in the lower third. Home, Species, Skies, Missions, Settings and Run over (revive offer, then the result) are all built. Birds are drawn as one batch with their own wobble and wing-beat, plus a ripple down the ribbon on sharp turns. Reduce motion removes the ripple and screen effects. Every sound has a visual twin. |
| §12 Tests | Every automated test listed. The autopilot survived 500 of 500 random three-minute runs, with an average flock of 100 at the end. |

## Decisions and deviations (please review)

1. **Concept document.** The app was built from the spec and the report.
   Where the [concept](../../concepts/04-murmur.md) and the spec differ, the
   spec wins.
2. **Leader speed is measured on screen.** The leader moves at up to its
   species speed relative to the screen, and the scroll carries it up the
   sky. Measured in the sky instead, geese (6.5 tiles/s) could barely move
   sideways once the sky reaches 6 tiles/s.
3. **The first launch** starts with 8 birds and two scripted chunks of
   strays, then the first tree chunk. There is no separate tutorial mode.
4. **Chunk design.** All 40 chunks are written as small named patterns in
   `src/world/chunkDefs.ts` rather than drawn in the editor; the editor can
   load, change and re-save any of them. Every hazard keeps the chunk's
   bottom edge calm enough for the slowest species to change lanes, and the
   weaving chunks space their gaps so every species can reach them at top
   speed.
5. **The trail** keeps at least the last 9 tiles of the leader's path, so
   murmurations can be detected even with a small flock.
6. **Open question 3.** Unbanked score is lost entirely when a run ends, as
   specified.
7. **`?debug`** exposes the app object for automated browser checks.
8. **Ending a run from the pause menu** counts as a finished run: the banked
   score, birds gathered and mission progress are kept, as after any other run.
9. **TypeScript** is pinned to 5.9, because the Capacitor CLI needs its
   compiler API.

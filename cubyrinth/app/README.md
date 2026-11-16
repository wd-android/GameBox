# Cubyrinth – v1

A 3D cube-maze rolling game for iOS and Android, built from
[`../build-specification.md`](../build-specification.md) and the guidance in
[`../../mobile-game-report.md`](../../mobile-game-report.md). The UI follows the
supplied *Battle Game Apps UI Kit* Figma file: deep violet backgrounds,
purple gradient cards, glowing cyan pill buttons and Readex Pro type.

Touch anywhere and drag to tilt the cube. Roll the ball through the maze on
each face. Glowing gates roll the cube over to the next face automatically.
Reach the gold cup on the opposite corner of the cube.

## Running it

```bash
npm install
```

```bash
npm run dev          # http://localhost:5173  (add ?autoplay to watch the automatic player)
```

```bash
npm test             # generator, physics, step-mode, Journey and progress tests
```

```bash
npm run build        # type-check and build into dist/
```

```bash
npm run print -- 5 48213   # print a cube as text, face by face
```

```bash
npm run calibrate && npm run levels   # re-measure bands, re-select the Journey
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

The app identifier is `com.promethica.cubyrinth`. It is set in
`src/config/app.ts` and in the native projects (`android/app/build.gradle`,
`strings.xml`, the `MainActivity` package and the Xcode bundle identifier). The version, `0.1.0`, is likewise in `package.json`,
`src/config/app.ts`, `android/app/build.gradle` and the Xcode project.

## Layout (as §4)

```
src/
  config/    app.ts, tuning.ts (every tuning constant), strings.ts (every visible text)
  maze/      topology, generator, solver, metrics – no rendering code
  physics/   ball simulation, wall geometry, orientation – no rendering code
  game/      levels (+ levels.json), scoring, progress, automatic player
  render/    Three.js cube, camera, ball, trail, materials
  input/     thumb tilt and step swipes
  audio/     synthesised sound and haptics
  state/     save data and settings
  ui/        screens and overlays (styles follow the Figma kit)
tools/       print-cube, calibrate (→ calibration.json), select-levels (→ src/game/levels.json)
tests/
```

`maze/` and `physics/` import nothing from `render/`.

## How the spec was met

| Spec | Implementation |
|---|---|
| §6 Generator | Every cell is placed in 3D (doubled units), and neighbours are derived from geometry. Layer 1 links the faces (`routeFaces`), Layer 2 carves each face with growing tree (`windiness`), then exactly five gates are opened. The cube is accepted or retried against bands, and any face crossed in under 2 cells is rejected. Holes go only in dead ends, off the route and away from gates. A 9 × 9 cube takes a few milliseconds. |
| §6.9 Bands | `tools/calibrate.ts` runs 2,000 cubes for each size and parameter set. "Normal" bands are the middle third of the spread; "long" bands are the upper third. |
| §7 Physics | Fixed 1/120 s ticks, at most 8 per frame, with drawing interpolated between ticks. Tilt has a dead zone, 60 ms smoothing and is quantised to 1/256. The simulation uses drag, rolling friction and a speed cap. Walls are merged segments, collisions use the closest point, and pushes repeat up to 4 times. Inside the simulation only + − × ÷ and √ are used, so runs replay exactly. |
| §7.7 Turn | Physics and the timer pause for the 0.45 s turn while the cube rolls 90°. The ball rides a quarter circle round the edge, and its velocity is carried round the corner and capped at 2 cells/s. Tilt is reset and the current touch becomes the new neutral point. The gate re-arms after 0.6 cells. The orientation is a whole-number matrix. |
| §7.10–7.11 | Holes drop the ball back to the checkpoint and count a fall. The finish cup ends the level. Step mode slides cell to cell at 8 cells/s and remembers one queued swipe. |
| §8 Rendering | Floor per face, merged wall mesh, glowing gates, holes, start ring and a pulsing finish cup. One shadow-casting light, a fading trail and a mini-map of the unfolded cube. The cube is drawn tilted by t × 15° and framed in the upper part of the screen. |
| §9 Levels and modes | The Journey has 80 levels: 10 at 3×3, 20 at 4×4, 25 at 5×5 and 25 at 6×6. They are chosen by script and ordered by how long the automatic player takes. The Daily Cube uses the date as its seed, cycles size 4/5/6, allows unlimited attempts and keeps a streak. Explore has any unlocked size, no timer, no holes, and takes cube codes like `1-5-48213`. Scoring follows §9.4 exactly. |
| §10 Save | One JSON document with a version number, stored with Capacitor Preferences on phones and localStorage on the web. A level in progress resumes at its last checkpoint. |
| §11 Tests | Every automated generator and physics test listed in the spec, including a million random ticks and the automatic player finishing every Journey level with every ball. |

## Decisions and deviations (please review)

1. **Concept document.** The app was built from the spec and the report.
   Where the [concept](../../concepts/08-cubyrinth.md) and the spec differ
   (for example, the spec's exactly five gates), the spec wins.
2. **Turn timing.** The turn lasts a fixed number of ticks inside the
   simulation (54 ticks, or 24 with Reduce motion), so it stays
   deterministic. The timer stops during the turn, as specified (open
   question 3).
3. **Re-crossing a gate.** While a gate is disarmed, the ball is held at the
   edge line instead of passing back through. Step mode does not disarm the
   gate: the ball stops in the entry cell, so it cannot flip back by itself,
   and a dead-end face has no other way out.
4. **Coins.** Each ball's first medal on a level pays 10 coins, and each new
   star pays 10. The Daily Cube pays 30 coins the first time each day.
   The second cube material, Neon Grid, costs 300 coins.
5. **Ball unlocks.** Silver unlocks at level 11 and gold at level 31, matching
   the stages where the spec introduces them. Step-mode completions earn a
   separate step medal (open question 4, as specified).
6. **Unlocking.** The next level unlocks when the current one is finished
   with any ball, or in step mode.
7. **First launch** opens straight into level 1 with a short hint. The first
   three levels are the quickest cubes the selection script found: the
   automatic player takes about 4 s, so a new player should take roughly 20 s.
8. **Cube codes** use each size's default parameters (`defaultParams`).
   Journey levels are referred to by level number, because they use tuned
   parameters.
9. **`?autoplay`** is a developer aid that lets the automatic player steer, for
   demos and screenshots.
10. **TypeScript** is pinned to 5.9, because the Capacitor CLI needs its
    compiler API.

# Stratum – v1

A sand-art pouring game for iOS and Android, built from
[`../build-specification.md`](../build-specification.md) and the design
guidance in [`../../mobile-game-report.md`](../../mobile-game-report.md).
The UI follows the supplied *Battle Game Apps UI Kit* Figma file: deep violet
backgrounds with blurred glows, purple gradient cards, glowing cyan pill
buttons and Readex Pro type.

Hold to pour coloured sand into a jar, drag the rim to tilt it, and match the
target picture. 80 Match jars in four stages, 30 Daily Jars, Free Pour, a shelf
of every jar you finish, themed sets and corks to spend on shelf decorations.

## Running it

```bash
npm install
```

```bash
npm run dev          # game at http://localhost:5173, jar editor at /tools/jar-editor/
```

```bash
npm test             # simulation, jar and progress tests
```

```bash
npm run build        # type-check and build the web bundle into dist/
```

### Phones

The native projects are in `android/` and `ios/` (Capacitor 7).

```bash
npm run android      # build, copy into android/, open Android Studio
```

```bash
npm run ios          # build, copy into ios/, open Xcode (macOS; run `pod install` in ios/App first)
```

Minimum versions are Android 8.0 (API 26) and iOS 15, portrait only. Before
release, set the real app identifier in `src/config/app.ts` (`APP_ID`,
currently the placeholder `com.example.stratum`), then run `npx cap sync`, and
update the identifier in the Android and Xcode projects.

App icons and splash screens are generated from `assets/` with
`npx @capacitor/assets generate`.

## Layout

```
src/
  config/   app.ts (name, id), tuning.ts (every tuning constant), theme.ts (colours, patterns)
  sand/     grid, falling rules, pouring, tilt, undo, scoring, compression – no drawing code
  jars/     shapes, jar files (data/), sets, scripted authoring (designer.ts, generate.ts)
  game/     stars, corks, unlocking, sets, daily streak, shop
  render/   PixiJS jar view, grain painter, glass outlines and thumbnails
  input/    thumb → spout column for both "Pouring" settings
  audio/    synthesised sound (no audio files) and haptics
  state/    the save document
  ui/       screens: pouring, result, shelf, sets, settings, pause, decorate
tools/
  generate-jars.ts   authors all 110 jars (npm run jars)
  jar-editor/        developer page for pouring jars by hand
  recordings/        designer input recordings, kept out of the app bundle
tests/
```

## How the spec was met

| Spec | Implementation |
|---|---|
| §6 Sand | 96 × 128 grid with whole-number rules and one seeded generator, so the same inputs give the same grid on every device. Rows that have been still for 30 ticks are skipped. About 0.05 ms per tick. |
| §6.4 Pouring | 5 grains a tick at the head of the stream. A straight jar fills in about 34 s of sweeping. Pouring stops by itself at the fill line. |
| §6.7 Scoring | Cell-by-cell comparison with a 2-cell tolerance. Thresholds 95 / 85 / 70 %. |
| §6.8–6.9 | Undo snapshots at each pour start, 3 per jar (unlimited in Free Pour). Guide lines are forced on for jars 1–15. Turning them off earns the freehand mark and 5 extra corks. |
| §7 Pouring setting | "Follow my thumb" or "Fixed spout", from Settings or the pause menu, effective at once. Both feed the same grid column to the simulation, so either setting can make every picture. A test checks this. |
| §8 Jars | 3 shapes; 80 Match jars; 30 Daily Jars rotating by date. Every target was made by pouring it through the real simulation, and its recording is kept. |
| §9–10 Screens | First launch opens straight onto jar 1, with the first colour chosen and a hand hint, and no menu. Then: shelf, sets, result (cork drops, jar turns, count-up, stars), settings. |
| §11 Feedback | Grain texture, colour-blind patterns, glass highlights, stream and splash. Synthesised hiss that falls in pitch as the jar fills, tilt rustle, taps, cork pop and rising star notes. Haptics for each event. "Reduce motion" turns off the jar spin. |
| §12 Save | One JSON document with a `version` field, saved after every jar. It uses Capacitor Preferences on phones and localStorage on the web. The jar in progress is saved when the app goes to the background, and resumes. Nothing leaves the device. |
| §13 Tools and tests | The jar editor plus every automated test listed in the spec. The build fails if a jar's recording replays below 97 %. |

## Decisions and deviations (please review)

1. **Concept document.** `concepts/06-stratum.md` is not in the repository, so
   this build follows the build specification and the report only.
2. **Steep-tilt rule.** Followed as written, the steep rules build a vertical
   wall against the low side, and levelling then collapses it. Two extra moves
   fix this:
   - a grain drops diagonally to the high side over an edge steeper than 45°;
   - a grain rolls sideways to the high side where the slope rises more than
     1 cell per 2 columns.

   The result is a smooth slope of about 27° that stays when the jar is levelled.
   `STEEP_SLOPE_RUN` sets how steep it can be.
3. **Pockets in the target.** A round bottle's shoulders can only be filled by
   tilting. Where the designer's own pour left a cell empty, an empty cell there
   counts as correct. Everywhere else, empty cells still count as wrong (§6.7).
4. **"Flat to within one cell".** No two neighbouring columns differ by more
   than one cell, and the whole surface stays within 4 cells. Poured sand keeps
   a ripple about one grain high, which the 45° rules cannot remove without
   also flattening mounds.
5. **Jars authored by script.** All 110 jars were made by a scripted designer
   pouring with the real simulation, rather than by hand: flat layers, mounds,
   slopes, zigzags, and pictures of hills, waves and sunsets. Each pour's inputs
   are recorded and replayed in the tests. Any jar can be re-poured by hand in
   the jar editor.
6. **Corks** are paid only when a jar earns at least one star. The Daily Jar
   pays 20 corks for one star or better. The streak counts days with a scored
   attempt.
7. **Open question 3.** As specified, a jar below 70 % is kept on the shelf but
   does not unlock the next jar.
8. **Undo after a restart.** The jar in progress survives a restart, but its
   undo history does not.
9. **Haptics.** The continuous buzz while pouring is rapid light taps on every
   platform (risk in §15).
10. **TypeScript** is pinned to 5.9, because the Capacitor CLI needs its
    compiler API.

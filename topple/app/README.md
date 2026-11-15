# Topple – v1

A daily domino-chain puzzle for iOS and Android, built from
[`../build-specification.md`](../build-specification.md) and the guidance in
[`../../mobile-game-report.md`](../../mobile-game-report.md). The UI follows the
supplied *Battle Game Apps UI Kit* Figma file: deep violet backgrounds,
purple gradient cards, glowing cyan pill buttons and Readex Pro type.

Drag dominoes from the tray into the gaps, tap the start domino, and watch
the chain run. If it reaches the flag, you've won; match par for the gold
mark. There's a new puzzle every day, a full Archive, and a 30-puzzle pack.

## Running it

```bash
npm install
```

```bash
npm run dev          # game at http://localhost:5173, puzzle editor at /tools/editor/
```

```bash
npm test             # chain, solver, rules and bundled-puzzle tests
```

```bash
npm run build        # checks every bundled puzzle (§6.3), type-checks, builds dist/
```

```bash
npm run puzzles && npm run report   # regenerate candidates, re-arrange the dailies, rewrite the report
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

Before release, set these in `src/config/app.ts`:
- the real app identifier (`APP_ID`, currently `com.example.topple`);
- the launch date (`LAUNCH_DATE`, open question 3; currently 15 November 2026). Puzzle #1 falls on this date. After changing it, run `npm run report` so the weekday order follows the new dates.

## Layout (as §4)

```
src/
  config/     app.ts, tuning.ts
  chain/      puzzle model, chain calculation, solver – no drawing code
  puzzles/    daily/daily.json (120, in schedule order), packs/first-tricks.json, tutorial.json,
              builder and generator used by the tools
  game/       sessions, results, daily schedule, streaks, hints, texts, reminder
  render/     Three.js board, dominoes, ramps, camera, confetti; styles
  audio/      synthesised sound and haptics
  state/      save data and settings
  ui/         screens and overlays (styles follow the Figma kit)
tools/
  editor/     browser puzzle editor with live solver
  report/     report.ts → report.md (solver measures for every puzzle)
  generate-puzzles.ts
tests/
```

`chain/` imports nothing from `render/`.

## How the spec was met

| Spec | Implementation |
|---|---|
| §5–6 Rules | Slots and links. The tall domino bridges exactly one empty slot (+40 ms), forks start every branch, and ramps send a ball after `travelMs`. Events are timed in whole milliseconds with `delay(depth) = max(55, 100 − 1.5·depth)`, and ties are broken by slot id. Stopping points and near misses are reported. |
| §6.3 Solver | Tries every placement. It reports par, winning placements, decoy and essential gaps, whether the tall domino or the ball is needed, and the solution share. It accepts a puzzle only if all five rules hold, and the build fails otherwise. |
| §8 Play | Drag from the tray to a gap; the piece snaps within 0.6 units and is drawn above the finger. Tap a piece to return it. Tap the pulsing start domino to topple. On a miss the camera holds 1.5 s on the circled stopping points, then the run stands back up in 0.6 s. One hint per puzzle costs 20 tokens and marks an essential or a decoy gap. |
| §7 Par setting | Off by default, and changeable from Settings or the pause menu with immediate effect. A test proves par appears in no text before solving and that the setting changes no result. |
| §9 Modes | Daily Topple: the puzzle number comes from the date, difficulty runs Monday 1 to Sunday 7, and a monthly special of 120–150 dominoes falls on the last day of each month. Streak protection forgives one missed day per month and shows a shield. The Archive is a calendar coloured by result. Pack 1 "First Tricks" introduces the elements in the §9.4 order. Tokens follow §9.5. |
| §10–11 | Chunky rounded dominoes, an arrow over the start, a flag on the finish, and the player's pieces in a distinct colour. Each fall turns about the base edge in 180 ms. The camera follows the branch nearest the flag, pulls back on a win for flag and confetti, and stays put with Reduce motion on. Clacks quicken with a matching haptic ripple, and music plays only while planning. |
| §12–13 | First launch goes straight to two short puzzles, then today's Daily Topple. Screens: Home, Archive, Pack, Styles (4 domino styles plus Classic, 2 tables), Statistics with a bar chart, Settings including a daily reminder, Pause, and the Result with a Share button. One JSON save after every change, with resume. |
| §14 Tools | Editor: draw runs, fork or merge, ramps, gaps/start/flag, tray, live solver, play, save/load. `tools/report`: measures every puzzle, arranges the dailies, and its `--check` mode gates the build. |
| §15 Tests | Every automated test in §15. A new player topples within about 4 s of launch, against the 15 s acceptance target, measured in a headless browser. |

## Decisions and deviations (please review)

1. **Concept document.** `concepts/03-topple.md` is not in the repository,
   so this follows the spec and the report only.
2. **Puzzle authoring.** The 120 dailies, 4 monthly specials and the
   30-puzzle pack were proposed by a template generator (`src/puzzles/generator.ts`),
   the "later addition" §17 suggests, and filtered by the solver's §6.3 rules.
   They are worth a designer's review in the editor. Difficulty 1–7 is
   assigned by ranking a weighted score (`DIFFICULTY_WEIGHTS`) across the
   pool, so each weekday gets a seventh of it.
3. **Unique par** means one set of gaps. Putting a tall domino instead of a
   standard one into the same gaps counts as the same answer; otherwise
   almost no tall-tray puzzle could be accepted.
4. **First-launch puzzles** use one domino, as §12 describes, rather than the
   three-piece tray of §5.4. The first has no decoy by design ("a short
   straight run with one gap"), so the build check exempts the two tutorial
   puzzles from the decoy rule.
5. **Tokens.** New players start with 20 tokens, enough for one hint.
   Solving an older daily from the Archive for the first time pays 5 tokens.
   Today's puzzle pays the §9.5 amounts.
6. **The fifth style.** §9.5 lists four styles to buy, so a free "Classic"
   style in bold primary colours is the default. The second table, Walnut,
   costs 150 tokens.
7. **Hint text** never mentions par. "Essential" marks a gap from the unique
   par solution.
8. **`?debug`** exposes the app object for automated browser checks. It is
   unused in normal play.
9. **TypeScript** is pinned to 5.9, because the Capacitor CLI needs its
   compiler API.
